import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import mongoose from 'mongoose';
import PendingUpload from '../../models/pendingUploadModel.js';
import { DOCUMENT_CONTENT_TYPES } from '../../models/propertyModel.js';
import { isS3Configured, presignPut, presignExpirySeconds, s3PublicUrl, headObjectSize } from '../../services/s3Service.js';
import { imagekitConfigured, publicBaseUrl, storeFile, expectedUrl, UPLOAD_TMP_DIR } from '../../services/mediaStorageService.js';
import { storeDocument } from '../../services/documentStorageService.js';
import { fail, ok, validationFailed, parseEnum } from '../../utils/v1.js';

// Property photos and videos (technical document 4.6), and property documents.
// The client asks for upload URLs, PUTs each file to its URL, then sends the
// returned file_url values as image_urls (photos and videos) or the
// document_id values as document_ids (documents) when adding or editing a property.
//
// With S3 configured, photo and video URLs are S3 pre-signed PUT URLs. Without
// it they point back to this server (PUT /api/v1/uploads/:id?expires=&signature=),
// which streams the file to disk and stores it on ImageKit or local disk, so
// the client flow is the same. Documents (`purpose: DOCUMENT`) always come to
// this server and are kept private (services/documentStorageService.js).

export const MEDIA_TYPES = {
    'image/jpeg': { ext: 'jpg', kind: 'IMAGE' },
    'image/png': { ext: 'png', kind: 'IMAGE' },
    'image/webp': { ext: 'webp', kind: 'IMAGE' },
    'video/mp4': { ext: 'mp4', kind: 'VIDEO' },
    'video/quicktime': { ext: 'mov', kind: 'VIDEO' },
    'video/webm': { ext: 'webm', kind: 'VIDEO' },
};
export const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB) || 500;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

const DOCUMENT_EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
export const MAX_DOCUMENT_MB = Number(process.env.DOCUMENT_MAX_MB) || 10;
const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;
const PURPOSES = ['MEDIA', 'DOCUMENT'];

/** IMAGE or VIDEO for an upload's content type. */
export const mediaKind = (contentType) => MEDIA_TYPES[contentType]?.kind || 'IMAGE';

const signature = (id, expires) =>
    crypto.createHmac('sha256', process.env.JWT_SECRET).update(`upload:${id}:${expires}`).digest('hex');

const extensionOf = (contentType, purpose) =>
    (purpose === 'DOCUMENT' ? DOCUMENT_EXT[contentType] : MEDIA_TYPES[contentType].ext);

const randomName = (contentType, purpose) => `${crypto.randomBytes(16).toString('hex')}.${extensionOf(contentType, purpose)}`;

/**
 * Name a document is shown with: the client's file name without folders or
 * control characters (at most 120 characters), else "Document <n>.<ext>".
 */
const documentName = (name, contentType, index) => {
    const clean = typeof name === 'string'
        ? name.replace(/^.*[\\/]/, '').replace(/[\p{Cc}"]/gu, '').replace(/\s+/g, ' ').trim()
        : '';
    const ext = DOCUMENT_EXT[contentType];
    if (!clean) return `Document ${index + 1}.${ext}`;
    if (clean.length <= 120) return clean;
    return `${clean.slice(0, 120 - ext.length - 1)}.${ext}`;
};

const isDocument = (record) => record.purpose === 'DOCUMENT';

/** Who is uploading: the signed-in user, or an admin adding/editing a property. */
export const uploaderOf = (req) => (req.admin
    ? { uploader_id: req.admin.id, uploader_type: 'admin' }
    : { uploader_id: req.user._id, uploader_type: 'user' });

// POST /uploads/presign { files: [{ content_type, size, purpose?, file_name? }] }
// purpose: MEDIA (default: a photo or video) or DOCUMENT (a private property document)
export const presign = async (req, res) => {
    const files = req.body?.files;
    if (!Array.isArray(files) || !files.length || files.length > MAX_FILES_PER_REQUEST) {
        return validationFailed(res, { files: `Send 1-${MAX_FILES_PER_REQUEST} files as [{ content_type, size }]` });
    }
    const errors = {};
    const purposes = files.map((f, i) => {
        const purpose = parseEnum(f?.purpose, PURPOSES) ?? 'MEDIA';
        if (purpose === null) {
            errors[`files[${i}].purpose`] = `Must be one of ${PURPOSES.join(', ')}`;
            return null;
        }
        const document = purpose === 'DOCUMENT';
        const types = document ? DOCUMENT_CONTENT_TYPES : Object.keys(MEDIA_TYPES);
        if (!types.includes(f?.content_type)) errors[`files[${i}].content_type`] = `Must be one of ${types.join(', ')}`;
        const maxMb = document ? MAX_DOCUMENT_MB : MAX_UPLOAD_MB;
        if (!Number.isInteger(f?.size) || f.size <= 0) errors[`files[${i}].size`] = 'File size in bytes is required';
        else if (f.size > (document ? MAX_DOCUMENT_BYTES : MAX_UPLOAD_BYTES)) {
            errors[`files[${i}].size`] = `Each ${document ? 'document' : 'file'} must be at most ${maxMb} MB`;
        }
        return purpose;
    });
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const uploader = uploaderOf(req);
    const expiresIn = presignExpirySeconds();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const useS3 = isS3Configured();
    // Upload target on this server (always used for documents)
    const directUrl = (id) => `${publicBaseUrl()}/api/v1/uploads/${id}?expires=${expires}&signature=${signature(id, expires)}`;

    const uploads = await Promise.all(files.map(async ({ content_type: contentType, size, file_name: fileName }, i) => {
        const purpose = purposes[i];
        const filename = randomName(contentType, purpose);
        const base = { ...uploader, purpose, content_type: contentType, size, expires_at: expiresAt };
        if (purpose === 'DOCUMENT') {
            const id = new mongoose.Types.ObjectId();
            const record = {
                ...base, _id: id, file_name: documentName(fileName, contentType, i), storage: 'private', storage_id: filename,
            };
            return { record, uploadUrl: directUrl(id) };
        }
        if (useS3) {
            const key = `properties/${uploader.uploader_id}/${filename}`;
            const uploadUrl = await presignPut({ key, contentType, size });
            return { record: { ...base, url: s3PublicUrl(key), storage: 's3', storage_id: key }, uploadUrl };
        }
        const id = new mongoose.Types.ObjectId();
        const record = {
            ...base, _id: id, url: expectedUrl(filename), storage: imagekitConfigured() ? 'imagekit' : 'local', storage_id: filename,
        };
        return { record, uploadUrl: directUrl(id) };
    }));

    const saved = await PendingUpload.insertMany(uploads.map((u) => u.record));
    return ok(res, uploads.map(({ record, uploadUrl }, i) => {
        const target = { upload_url: uploadUrl, method: 'PUT', headers: { 'Content-Type': record.content_type } };
        if (isDocument(record)) {
            // No file_url: documents are private. Send document_id in document_ids.
            return { ...target, document_id: saved[i]._id, file_name: record.file_name, media_type: 'DOCUMENT', expires_in: expiresIn };
        }
        return { ...target, file_url: record.url, media_type: mediaKind(record.content_type), expires_in: expiresIn };
    }));
};

// The file's first bytes must match its declared type
const MP4_BOXES = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);
const MAGIC = {
    'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
    'video/mp4': (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
    'video/quicktime': (b) => MP4_BOXES.has(b.subarray(4, 8).toString('latin1')),
    'video/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
    'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};
const MAGIC_BYTES = 12;

class UploadRejected extends Error {
    constructor(field, message) {
        super(message);
        this.field = field;
    }
}

/**
 * Streams the request body to a temp file (videos can be hundreds of MB, so
 * the body is never held in memory), checking its size and first bytes on the
 * way. Returns the temp file's path.
 */
const receiveToTempFile = async (req, record) => {
    await fs.promises.mkdir(UPLOAD_TMP_DIR, { recursive: true });
    const tmpPath = path.join(UPLOAD_TMP_DIR, `${record._id}.part`);
    let received = 0;
    let head = Buffer.alloc(0);
    const verify = (final) => {
        if (head.length >= MAGIC_BYTES || final) {
            if (!MAGIC[record.content_type](head)) throw new UploadRejected('file', `The file is not a valid ${record.content_type}`);
            return true;
        }
        return false;
    };
    let verified = false;

    const check = new Transform({
        transform(chunk, _encoding, callback) {
            received += chunk.length;
            if (received > record.size) {
                return callback(new UploadRejected('Content-Length', `Expected ${record.size} bytes, got more`));
            }
            try {
                if (!verified) {
                    head = Buffer.concat([head, chunk.subarray(0, MAGIC_BYTES - head.length)]);
                    verified = verify(false);
                }
            } catch (error) {
                return callback(error);
            }
            return callback(null, chunk);
        },
    });

    try {
        await pipeline(req, check, fs.createWriteStream(tmpPath));
        if (received !== record.size) {
            throw new UploadRejected('Content-Length', `Expected ${record.size} bytes, got ${received}`);
        }
        if (!verified) verify(true);
        return tmpPath;
    } catch (error) {
        await fs.promises.rm(tmpPath, { force: true });
        throw error;
    }
};

// PUT /uploads/:id?expires=&signature= — the non-S3 upload target. Authorised
// by the signed URL (like S3), so no Authorization header is needed.
export const receiveUpload = async (req, res) => {
    const { id } = req.params;
    const expires = Number(req.query.expires);
    const given = String(req.query.signature || '');
    const expected = mongoose.isValidObjectId(id) && Number.isFinite(expires) ? signature(id, expires) : '';
    const valid = expected && given.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!valid) return fail(res, 403, 'Invalid upload URL', 'UPLOAD_URL_INVALID');
    if (Date.now() / 1000 > expires) return fail(res, 403, 'Upload URL has expired', 'UPLOAD_URL_EXPIRED');

    const record = await PendingUpload.findById(id);
    if (!record || record.storage === 's3') return fail(res, 404, 'Upload not found', 'NOT_FOUND');
    if (record.uploaded) return fail(res, 409, 'This file was already uploaded', 'CONFLICT');

    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== record.content_type) {
        return validationFailed(res, { 'Content-Type': `Must be ${record.content_type}, as requested` });
    }
    // Refuse a wrong size before reading the body
    const declared = req.headers['content-length'];
    if (declared !== undefined && Number(declared) !== record.size) {
        return validationFailed(res, { 'Content-Length': `Expected ${record.size} bytes, got ${declared}` });
    }

    let tmpPath;
    try {
        tmpPath = await receiveToTempFile(req, record);
    } catch (error) {
        if (error instanceof UploadRejected) return validationFailed(res, { [error.field]: error.message });
        if (req.destroyed || error.code === 'ERR_STREAM_PREMATURE_CLOSE') return undefined; // client went away
        throw error;
    }

    if (isDocument(record)) {
        await storeDocument(tmpPath, record.storage_id);
        record.uploaded = true;
        await record.save();
        return ok(res, { document_id: record._id, file_name: record.file_name, media_type: 'DOCUMENT' }, 'Uploaded');
    }

    const stored = await storeFile(tmpPath, record.storage_id);
    record.set({ url: stored.url, storage: stored.storage, storage_id: stored.storage_id, uploaded: true });
    await record.save();
    return ok(res, { file_url: stored.url, media_type: mediaKind(record.content_type) }, 'Uploaded');
};

/**
 * Turns image_urls into property media ({ url, type: IMAGE | VIDEO }). A URL
 * is accepted when it is already on the property (`keep`, its current media)
 * or was issued to `uploaderId` by /presign and has been uploaded. Returns
 * { images, pending, error }: `pending` are the upload records to remove once
 * the property is saved.
 */
export const resolveImageUrls = async (uploaderId, urls, keep = []) => {
    const kept = new Map(keep.map((m) => [m.url, m.type || 'IMAGE']));
    const newUrls = urls.filter((u) => !kept.has(u));
    const records = newUrls.length && uploaderId
        ? await PendingUpload.find({ uploader_id: uploaderId, url: { $in: newUrls }, purpose: { $ne: 'DOCUMENT' } })
        : [];
    const byUrl = new Map(records.map((r) => [r.url, r]));

    for (const url of newUrls) {
        const record = byUrl.get(url);
        if (!record) return { error: `Unknown file URL ${url}. Upload it with /uploads/presign first.` };
        if (record.storage === 's3') {
            const size = await headObjectSize(record.storage_id);
            if (size === null) return { error: `File ${url} has not been uploaded yet` };
        } else if (!record.uploaded) {
            return { error: `File ${url} has not been uploaded yet` };
        }
    }
    // sort_order / is_primary are set from the order when the property is saved
    const images = urls.map((url) => ({ url, type: kept.get(url) || mediaKind(byUrl.get(url).content_type) }));
    return { images, pending: records };
};

/**
 * Turns document_ids into property documents. An id is accepted when it is
 * already on the property (`keep`, its current documents) or is a document
 * issued to `uploaderId` by /presign that has been uploaded. Returns
 * { documents, pending, error }, like resolveImageUrls.
 */
export const resolveDocumentIds = async (uploaderId, ids, keep = []) => {
    const kept = new Map(keep.map((d) => [String(d._id), d]));
    const newIds = ids.filter((id) => !kept.has(id));
    const records = newIds.length && uploaderId
        ? await PendingUpload.find({ _id: { $in: newIds }, uploader_id: uploaderId, purpose: 'DOCUMENT' })
        : [];
    const byId = new Map(records.map((r) => [String(r._id), r]));

    for (const id of newIds) {
        const record = byId.get(id);
        if (!record) return { error: `Unknown document ${id}. Upload it with /uploads/presign (purpose DOCUMENT) first.` };
        if (!record.uploaded) return { error: `Document ${record.file_name || id} has not been uploaded yet` };
    }
    const documents = ids.map((id) => {
        if (kept.has(id)) return kept.get(id);
        const record = byId.get(id);
        return {
            _id: record._id,
            file_name: record.file_name,
            content_type: record.content_type,
            size: record.size,
            storage_id: record.storage_id,
            uploaded_at: new Date(),
        };
    });
    return { documents, pending: records };
};

/** Removes upload records once their files belong to a property. */
export const consumeUploads = (records = []) =>
    records.length ? PendingUpload.deleteMany({ _id: { $in: records.map((r) => r._id) } }) : undefined;
