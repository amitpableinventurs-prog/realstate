import crypto from 'crypto';
import fs from 'fs';
import Admin from '../../models/adminModel.js';
import Property from '../../models/propertyModel.js';
import { documentPath } from '../../services/documentStorageService.js';
import { publicBaseUrl } from '../../services/mediaStorageService.js';
import { logAdminActivity } from '../../utils/activityLogger.js';
import { documentOut, fail, forbidden, isObjectId, notFound, ok, validationFailed } from '../../utils/v1.js';

// Property documents (registry, khatiyan, ...): locked files. Buyers only see
// how many there are (document_count). The owner can open their own. Only the
// super admin can unlock them, with the document password (DOCUMENT_UNLOCK_PASSWORD,
// separate from every login password); unlocking returns links that work for
// UNLOCK_TTL_SECONDS. Every unlock and every wrong password is in the activity log.

const UNLOCK_TTL_SECONDS = 10 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const propertyName = (p) => `Khata ${p.khata_number}, Khasra ${p.khasra_number}`;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
// Hashing first gives equal lengths, so timingSafeEqual can compare any input
const samePassword = (given, expected) => crypto.timingSafeEqual(sha256(given), sha256(expected));

const linkSignature = (propertyId, documentId, expires) => crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`property-document:${propertyId}:${documentId}:${expires}`)
    .digest('hex');

// Content-Disposition with a non-ASCII (e.g. Hindi) file name: an ASCII fallback plus filename*
const contentDisposition = (name) => {
    const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

/** Streams one of `property`'s documents, or sends 404. */
const sendDocument = async (res, property, documentId) => {
    const doc = property.documents.find((d) => String(d._id) === String(documentId));
    if (!doc) return notFound(res, 'Document');
    const file = documentPath(doc.storage_id);
    if (!(await fs.promises.stat(file).catch(() => null))) return notFound(res, 'Document file');
    return res.sendFile(file, {
        headers: {
            'Content-Type': doc.content_type,
            'Content-Disposition': contentDisposition(doc.file_name),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            // The admin panel shows photo documents in <img> from its own origin
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    });
};

// GET /list-property/:id/documents/:documentId — the owner opens their own document
export const ownerDocument = async (req, res) => {
    const property = isObjectId(req.params.id) && await Property.findById(req.params.id).select('owner_id documents');
    if (!property) return notFound(res);
    if (!property.owner_id.equals(req.user._id)) return forbidden(res, 'Property documents are locked. Only the owner can open them.');
    return sendDocument(res, property, req.params.documentId);
};

// POST /admin/properties/:id/documents/unlock { password } — super admin only.
// Returns the documents with links that open them for 10 minutes.
export const unlockDocuments = async (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) return validationFailed(res, { password: 'Enter the document password' });
    const expected = process.env.DOCUMENT_UNLOCK_PASSWORD || '';
    if (!expected) {
        return fail(res, 503, 'Document unlocking is not set up. Set DOCUMENT_UNLOCK_PASSWORD on the server.', 'DOCUMENT_LOCK_NOT_CONFIGURED');
    }

    const property = isObjectId(req.params.id) && await Property.findById(req.params.id).setOptions({ withDeleted: true });
    if (!property) return notFound(res);
    if (!property.documents.length) return notFound(res, 'Document');

    const admin = await Admin.findById(req.admin.id);
    if (admin.document_unlock_lock_until && admin.document_unlock_lock_until > Date.now()) {
        const minutes = Math.ceil((admin.document_unlock_lock_until - Date.now()) / 60000);
        return fail(res, 429, `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 'DOCUMENT_UNLOCK_LOCKED');
    }

    if (!samePassword(password, expected)) {
        const attempts = (admin.document_unlock_failed_attempts || 0) + 1;
        const locked = attempts >= MAX_FAILED_ATTEMPTS;
        admin.set(locked
            ? { document_unlock_failed_attempts: 0, document_unlock_lock_until: new Date(Date.now() + LOCK_DURATION_MS) }
            : { document_unlock_failed_attempts: attempts });
        await admin.save();
        await logAdminActivity(req.admin.email, 'unlock_documents_failed', 'property', property._id, propertyName(property),
            { attempts, locked }, req);
        // 403, not 401: a 401 would make the admin panel log out
        if (locked) {
            return fail(res, 429, 'Too many wrong passwords. Document unlocking is locked for 15 minutes.', 'DOCUMENT_UNLOCK_LOCKED');
        }
        const left = MAX_FAILED_ATTEMPTS - attempts;
        return fail(res, 403, `Wrong document password. ${left} ${left === 1 ? 'try' : 'tries'} left.`, 'DOCUMENT_PASSWORD_INVALID');
    }

    if (admin.document_unlock_failed_attempts || admin.document_unlock_lock_until) {
        admin.set({ document_unlock_failed_attempts: 0, document_unlock_lock_until: undefined });
        await admin.save();
    }
    await logAdminActivity(req.admin.email, 'unlock_documents', 'property', property._id, propertyName(property),
        { documents: property.documents.length }, req);

    const expires = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
    const base = `${publicBaseUrl()}/api/v1/admin/properties/${property._id}/documents`;
    return ok(res, {
        expires_in: UNLOCK_TTL_SECONDS,
        expires_at: new Date(expires * 1000),
        documents: property.documents.map((doc) => ({
            ...documentOut(doc),
            url: `${base}/${doc._id}/file?expires=${expires}&signature=${linkSignature(property._id, doc._id, expires)}`,
        })),
    }, 'Documents unlocked');
};

// GET /admin/properties/:id/documents/:documentId/file?expires=&signature= — a
// link from the unlock response. Authorised by its signature (it is opened in
// a new browser tab, which can't send the admin token).
export const unlockedDocumentFile = async (req, res) => {
    const { id, documentId } = req.params;
    const expires = Number(req.query.expires);
    const given = String(req.query.signature || '');
    const expected = isObjectId(id) && isObjectId(documentId) && Number.isFinite(expires)
        ? linkSignature(id, documentId, expires)
        : '';
    const valid = expected && given.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!valid) return fail(res, 403, 'Invalid document link', 'DOCUMENT_LINK_INVALID');
    if (Date.now() / 1000 > expires) {
        return fail(res, 403, 'This document link has expired. Unlock the documents again.', 'DOCUMENT_LINK_EXPIRED');
    }

    const property = await Property.findById(id).select('documents').setOptions({ withDeleted: true });
    if (!property) return notFound(res);
    return sendDocument(res, property, documentId);
};
