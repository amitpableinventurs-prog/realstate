import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Property documents (registry, khatiyan, ...) are private, unlike photos and
// videos: they are never stored on S3 / ImageKit / a public URL. They stay on
// this server's disk, in a folder no static route serves, and are sent only by
// the owner's download endpoint and the super admin's signed links
// (controller/v1/documentController.js).

export const PRIVATE_DOCUMENTS_DIR = path.join(process.cwd(), 'uploads', 'private-documents');

/** Absolute path of a stored document (`storageId` is a bare file name). */
export const documentPath = (storageId) => path.join(PRIVATE_DOCUMENTS_DIR, path.basename(String(storageId)));

// Moves an uploaded document (streamed to `tmpPath`, on the same disk) into place
export const storeDocument = async (tmpPath, filename) => {
    try {
        await fs.promises.mkdir(PRIVATE_DOCUMENTS_DIR, { recursive: true });
        await fs.promises.rename(tmpPath, documentPath(filename));
        return { storage: 'private', storage_id: filename };
    } finally {
        await fs.promises.rm(tmpPath, { force: true });
    }
};

/** Deletes a stored document. Best effort, like deleteImageByUrl. */
export const deleteDocumentFile = async (storageId) => {
    if (!storageId) return;
    try {
        await fs.promises.rm(documentPath(storageId), { force: true });
    } catch (error) {
        logger.warn('Failed to delete property document', { storageId, error: error.message });
    }
};
