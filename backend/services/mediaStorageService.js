import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Listing photos/videos go to ImageKit when it is configured; otherwise they are
// kept on local disk and served from /uploads/app-media (fine for development).

export const LOCAL_MEDIA_DIR = path.join(process.cwd(), 'uploads', 'app-media');
export const LOCAL_MEDIA_ROUTE = '/uploads/app-media';

// APP_MEDIA_STORAGE: auto (ImageKit when its keys are set) | imagekit | local
const imagekitConfigured = () => {
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

const removeTemp = (file) => fs.promises.unlink(file.path).catch(() => {});

export const cleanupTempFiles = (files = []) => Promise.all(files.map(removeTemp));

const publicBaseUrl = () =>
    (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');

// Stores one multer temp file and returns a Listing media entry
export const storeMedia = async (file) => {
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

    if (imagekitConfigured()) {
        try {
            const imagekit = await getImagekit();
            const result = await imagekit.upload({
                file: await fs.promises.readFile(file.path),
                fileName: file.filename,
                folder: 'AppListings',
            });
            return { url: result.url, type, storage: 'imagekit', storageId: result.fileId };
        } finally {
            await removeTemp(file);
        }
    }

    await fs.promises.mkdir(LOCAL_MEDIA_DIR, { recursive: true });
    await fs.promises.rename(file.path, path.join(LOCAL_MEDIA_DIR, file.filename));
    return {
        url: `${publicBaseUrl()}${LOCAL_MEDIA_ROUTE}/${file.filename}`,
        type,
        storage: 'local',
        storageId: file.filename,
    };
};

// Stores all files; if any upload fails, already-stored ones are removed again
export const storeAllMedia = async (files = []) => {
    const results = await Promise.allSettled(files.map(storeMedia));
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
        await Promise.all(results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => deleteMedia(r.value)));
        await cleanupTempFiles(files);
        throw failed.reason;
    }
    return results.map((r) => r.value);
};

export const deleteMedia = async (media) => {
    try {
        if (media.storage === 'imagekit' && media.storageId) {
            const imagekit = await getImagekit();
            await imagekit.deleteFile(media.storageId);
        } else if (media.storage === 'local' && media.storageId) {
            await fs.promises.unlink(path.join(LOCAL_MEDIA_DIR, path.basename(media.storageId)));
        }
    } catch (error) {
        // A leftover file is not worth failing the request over
        logger.warn('Failed to delete listing media', { storageId: media.storageId, error: error.message });
    }
};
