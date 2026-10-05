import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import mongoose from 'mongoose';
import PendingUpload from '../../models/pendingUploadModel.js';
import { isS3Configured, presignPut, presignExpirySeconds, s3PublicUrl, headObjectSize } from '../../services/s3Service.js';
import { imagekitConfigured, publicBaseUrl, storeFile, expectedUrl, UPLOAD_TMP_DIR } from '../../services/mediaStorageService.js';
import { fail, ok, validationFailed } from '../../utils/v1.js';

// Property photos and videos (technical document 4.6). The client asks for
// upload URLs, PUTs each file to its URL, then sends the returned file_url
// values as image_urls when adding or editing a property.
//
// With S3 configured the URLs are S3 pre-signed PUT URLs. Without it they point
// back to this server (PUT /api/v1/uploads/:id?expires=&signature=), which
// streams the file to disk and stores it on ImageKit or local disk, so the
// client flow is the same.

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

/** IMAGE or VIDEO for an upload's content type. */
export const mediaKind = (contentType) => MEDIA_TYPES[contentType]?.kind || 'IMAGE';

const signature = (id, expires) =>
    crypto.createHmac('sha256', process.env.JWT_SECRET).update(`upload:${id}:${expires}`).digest('hex');

const randomName = (contentType) => `${crypto.randomBytes(16).toString('hex')}.${MEDIA_TYPES[contentType].ext}`;

/** Who is uploading: the signed-in user, or an admin adding/editing a property. */
export const uploaderOf = (req) => (req.admin
    ? { uploader_id: req.admin.id, uploader_type: 'admin' }
    : { uploader_id: req.user._id, uploader_type: 'user' });

// POST /uploads/presign { files: [{ content_type, size }] }
export const presign = async (req, res) => {
    const files = req.body?.files;
    if (!Array.isArray(files) || !files.length || files.length > MAX_FILES_PER_REQUEST) {
        return validationFailed(res, { files: `Send 1-${MAX_FILES_PER_REQUEST} files as [{ content_type, size }]` });
    }
    const errors = {};
    files.forEach((f, i) => {
        if (!MEDIA_TYPES[f?.content_type]) {
            errors[`files[${i}].content_type`] = `Must be one of ${Object.keys(MEDIA_TYPES).join(', ')}`;
        }
        if (!Number.isInteger(f?.size) || f.size <= 0) errors[`files[${i}].size`] = 'File size in bytes is required';
        else if (f.size > MAX_UPLOAD_BYTES) errors[`files[${i}].size`] = `Each file must be at most ${MAX_UPLOAD_MB} MB`;
    });
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const uploader = uploaderOf(req);
    const expiresIn = presignExpirySeconds();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const useS3 = isS3Configured();

    const uploads = await Promise.all(files.map(async ({ content_type: contentType, size }) => {
        const filename = randomName(contentType);
        const base = { ...uploader, content_type: contentType, size, expires_at: expiresAt };
        if (useS3) {
            const key = `properties/${uploader.uploader_id}/${filename}`;
            const uploadUrl = await presignPut({ key, contentType, size });
            return { record: { ...base, url: s3PublicUrl(key), storage: 's3', storage_id: key }, uploadUrl };
        }
        const id = new mongoose.Types.ObjectId();
        const expires = Math.floor(expiresAt.getTime() / 1000);
        const record = {
            ...base, _id: id, url: expectedUrl(filename), storage: imagekitConfigured() ? 'imagekit' : 'local', storage_id: filename,
        };
        const uploadUrl = `${publicBaseUrl()}/api/v1/uploads/${id}?expires=${expires}&signature=${signature(id, expires)}`;
        return { record, uploadUrl };
    }));

    await PendingUpload.insertMany(uploads.map((u) => u.record));
    return ok(res, uploads.map(({ record, uploadUrl }) => ({
        upload_url: uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': record.content_type },
        file_url: record.url,
        media_type: mediaKind(record.content_type),
        expires_in: expiresIn,
    })));
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
        ? await PendingUpload.find({ uploader_id: uploaderId, url: { $in: newUrls } })
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

/** Removes upload records once their files belong to a property. */
export const consumeUploads = (records = []) =>
    records.length ? PendingUpload.deleteMany({ _id: { $in: records.map((r) => r._id) } }) : undefined;
