import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { isS3Configured, s3PublicUrl, deleteS3Object } from './s3Service.js';

// Property photos and videos. With S3 configured, clients upload straight to S3 with
// pre-signed URLs. Otherwise uploads go through PUT /api/v1/uploads/:id and are
// stored on ImageKit when it is configured, or on local disk (development),
// served from /uploads/app-media.

export const LOCAL_MEDIA_DIR = path.join(process.cwd(), 'uploads', 'app-media');
export const LOCAL_MEDIA_ROUTE = '/uploads/app-media';
const IMAGEKIT_FOLDER = 'AppListings';

// APP_MEDIA_STORAGE: auto (ImageKit when its keys are set) | imagekit | local
export const imagekitConfigured = () => {
    const mode = (process.env.APP_MEDIA_STORAGE || 'auto').toLowerCase();
    if (mode === 'local') return false;
    if (mode === 'imagekit') return true;
    return Boolean(
        process.env.IMAGEKIT_PUBLIC_KEY &&
        process.env.IMAGEKIT_PRIVATE_KEY &&
        process.env.IMAGEKIT_URL_ENDPOINT
    );
};

// config/imagekit.js throws at import time when keys are missing, so load lazily
let imagekitClient;
const getImagekit = async () => {
    if (!imagekitClient) {
        imagekitClient = (await import('../config/imagekit.js')).default;
    }
    return imagekitClient;
};

export const publicBaseUrl = () =>
    (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');

/** URL a non-S3 upload named `filename` will have once stored (known before the upload). */
export const expectedUrl = (filename) => (imagekitConfigured()
    ? `${process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')}/${IMAGEKIT_FOLDER}/${filename}`
    : `${publicBaseUrl()}${LOCAL_MEDIA_ROUTE}/${filename}`);

// Uploads are streamed here first (same disk as LOCAL_MEDIA_DIR, so a move is a rename)
export const UPLOAD_TMP_DIR = path.join(process.cwd(), 'uploads', 'tmp');

// Stores an uploaded file (PUT /api/v1/uploads/:id, streamed to `tmpPath`)
// under `filename`, streaming it on to ImageKit or moving it into place.
export const storeFile = async (tmpPath, filename) => {
    try {
        if (imagekitConfigured()) {
            const imagekit = await getImagekit();
            const result = await imagekit.upload({
                file: fs.createReadStream(tmpPath),
                fileName: filename,
                folder: IMAGEKIT_FOLDER,
                useUniqueFileName: false,
            });
            return { url: result.url, storage: 'imagekit', storage_id: filename };
        }
        await fs.promises.mkdir(LOCAL_MEDIA_DIR, { recursive: true });
        await fs.promises.rename(tmpPath, path.join(LOCAL_MEDIA_DIR, filename));
        return { url: expectedUrl(filename), storage: 'local', storage_id: filename };
    } finally {
        await fs.promises.rm(tmpPath, { force: true });
    }
};

/**
 * Deletes a stored photo or video by its URL (properties keep only the URL). Best
 * effort: a leftover file is not worth failing a request over.
 */
export const deleteImageByUrl = async (url) => {
    try {
        const localPrefix = `${publicBaseUrl()}${LOCAL_MEDIA_ROUTE}/`;
        const s3Prefix = isS3Configured() ? s3PublicUrl('') : null;
        const imagekitPrefix = process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, '');

        if (url.startsWith(localPrefix)) {
            await fs.promises.unlink(path.join(LOCAL_MEDIA_DIR, path.basename(url)));
        } else if (s3Prefix && url.startsWith(s3Prefix)) {
            await deleteS3Object(url.slice(s3Prefix.length));
        } else if (imagekitPrefix && url.startsWith(`${imagekitPrefix}/`) && imagekitConfigured()) {
            const imagekit = await getImagekit();
            const name = path.basename(new URL(url).pathname);
            const files = await imagekit.listFiles({ searchQuery: `name = "${name}"`, limit: 1 });
            if (files[0]?.fileId) await imagekit.deleteFile(files[0].fileId);
        }
    } catch (error) {
        logger.warn('Failed to delete property media', { url, error: error.message });
    }
};
