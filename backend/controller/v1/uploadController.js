import crypto from 'crypto';
import mongoose from 'mongoose';
import PendingUpload from '../../models/pendingUploadModel.js';
import { isS3Configured, presignPut, presignExpirySeconds, s3PublicUrl, headObjectSize } from '../../services/s3Service.js';
import { imagekitConfigured, publicBaseUrl, storeBuffer, expectedUrl } from '../../services/mediaStorageService.js';
import { fail, ok, validationFailed } from '../../utils/v1.js';

// Property photos (technical document 4.6). The client asks for upload URLs,
// PUTs each file to its URL, then sends the returned file_url values as
// image_urls when adding or editing a property.
//
// With S3 configured the URLs are S3 pre-signed PUT URLs. Without it they point
// back to this server (PUT /api/v1/uploads/:id?expires=&signature=), which
// stores the file on ImageKit or local disk, so the client flow is the same.

export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_IMAGE_BYTES = (Number(process.env.UPLOAD_MAX_IMAGE_MB) || 5) * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

const signature = (id, expires) =>
    crypto.createHmac('sha256', process.env.JWT_SECRET).update(`upload:${id}:${expires}`).digest('hex');

const randomName = (contentType) => `${crypto.randomBytes(16).toString('hex')}.${IMAGE_TYPES[contentType]}`;

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
        if (!IMAGE_TYPES[f?.content_type]) errors[`files[${i}].content_type`] = 'Must be image/jpeg, image/png or image/webp';
        if (!Number.isInteger(f?.size) || f.size <= 0) errors[`files[${i}].size`] = 'File size in bytes is required';
        else if (f.size > MAX_IMAGE_BYTES) errors[`files[${i}].size`] = `Each photo must be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB`;
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
        expires_in: expiresIn,
    })));
};

// The file's first bytes must match its declared type
const MAGIC = {
    'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
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

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== record.content_type) {
        return validationFailed(res, { 'Content-Type': `Must be ${record.content_type}, as requested` });
    }
    if (body.length !== record.size) {
        return validationFailed(res, { 'Content-Length': `Expected ${record.size} bytes, got ${body.length}` });
    }
    if (!MAGIC[record.content_type](body)) {
        return validationFailed(res, { file: `The file is not a valid ${record.content_type}` });
    }

    const stored = await storeBuffer(body, record.storage_id);
    record.set({ url: stored.url, storage: stored.storage, storage_id: stored.storage_id, uploaded: true });
    await record.save();
    return ok(res, { file_url: stored.url }, 'Uploaded');
};

/**
 * Turns image_urls into property images. A URL is accepted when it is already
 * on the property (`keep`) or was issued to `uploaderId` by /presign and has
 * been uploaded. Returns { images, pending, error }: `pending` are the upload
 * records to remove once the property is saved.
 */
export const resolveImageUrls = async (uploaderId, urls, keep = []) => {
    const kept = new Set(keep);
    const newUrls = urls.filter((u) => !kept.has(u));
    const records = newUrls.length && uploaderId
        ? await PendingUpload.find({ uploader_id: uploaderId, url: { $in: newUrls } })
        : [];
    const byUrl = new Map(records.map((r) => [r.url, r]));

    for (const url of newUrls) {
        const record = byUrl.get(url);
        if (!record) return { error: `Unknown image URL ${url}. Upload it with /uploads/presign first.` };
        if (record.storage === 's3') {
            const size = await headObjectSize(record.storage_id);
            if (size === null) return { error: `Image ${url} has not been uploaded yet` };
        } else if (!record.uploaded) {
            return { error: `Image ${url} has not been uploaded yet` };
        }
    }
    // sort_order / is_primary are set from the order when the property is saved
    return { images: urls.map((url) => ({ url })), pending: records };
};

/** Removes upload records once their files belong to a property. */
export const consumeUploads = (records = []) =>
    records.length ? PendingUpload.deleteMany({ _id: { $in: records.map((r) => r._id) } }) : undefined;
