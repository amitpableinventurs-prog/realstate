import fs from 'fs';
import path from 'path';
import PendingUpload from '../models/pendingUploadModel.js';
import Property from '../models/propertyModel.js';
import { deleteImageByUrl, UPLOAD_TMP_DIR } from '../services/mediaStorageService.js';
import logger from './logger.js';

// Files uploaded with /api/v1/uploads/presign but never added to a property
// (the form was abandoned). Videos can be 500 MB, so the files are deleted,
// not just their records: an hour before the records' TTL index removes them
// (a day after the upload URL expired). Half-written temp files go after a day.

const HOUR = 60 * 60 * 1000;

export const cleanupAbandonedUploads = async () => {
    const stale = await PendingUpload.find({ expires_at: { $lt: new Date(Date.now() - 23 * HOUR) } }).limit(500);
    if (stale.length) {
        // Never delete a file a property uses (in case its record wasn't removed)
        const inUse = new Set((await Property.find({ 'images.url': { $in: stale.map((r) => r.url) } }, 'images.url')
            .setOptions({ withDeleted: true }).lean())
            .flatMap((p) => p.images.map((i) => i.url)));
        for (const record of stale) {
            const stored = record.uploaded || record.storage === 's3';
            if (stored && !inUse.has(record.url)) await deleteImageByUrl(record.url);
        }
        await PendingUpload.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
        logger.info('Removed abandoned uploads', { count: stale.length });
    }

    const names = await fs.promises.readdir(UPLOAD_TMP_DIR).catch(() => []);
    for (const name of names) {
        const file = path.join(UPLOAD_TMP_DIR, name);
        const stat = await fs.promises.stat(file).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 24 * HOUR) await fs.promises.rm(file, { force: true });
    }
};

/** Runs the cleanup now and then every hour. */
export const startUploadCleanup = () => {
    const run = () => cleanupAbandonedUploads()
        .catch((error) => logger.warn('Upload cleanup failed', { error: error.message }));
    run();
    setInterval(run, HOUR).unref();
};
