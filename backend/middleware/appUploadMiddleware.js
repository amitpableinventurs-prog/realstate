import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cleanupTempFiles } from '../services/mediaStorageService.js';

// Photos and videos for app listings, sent as multipart field "media".
// Extensions come from the MIME type because phones often send generic names.

const IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
};
const VIDEO_TYPES = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/3gpp': '.3gp',
    'video/webm': '.webm',
};
const ALLOWED_TYPES = { ...IMAGE_TYPES, ...VIDEO_TYPES };

export const MAX_FILES_PER_REQUEST = 10;
export const MAX_MEDIA_PER_LISTING = 20;
const MAX_IMAGE_BYTES = (Number(process.env.APP_MAX_IMAGE_MB) || 10) * 1024 * 1024;
const MAX_VIDEO_BYTES = (Number(process.env.APP_MAX_VIDEO_MB) || 100) * 1024 * 1024;

const tempDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(tempDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, tempDir),
        filename: (req, file, cb) =>
            cb(null, `${crypto.randomBytes(16).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`),
    }),
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_TYPES[file.mimetype]) {
            const error = new Error(`Unsupported file type ${file.mimetype}. Allowed: JPEG, PNG, WebP, HEIC, MP4, MOV, 3GP, WebM`);
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
    limits: {
        fileSize: Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES),
        files: MAX_FILES_PER_REQUEST,
    },
});

const MULTER_MESSAGES = {
    LIMIT_FILE_SIZE: 'File is too large',
    LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES_PER_REQUEST} files at a time`,
    LIMIT_UNEXPECTED_FILE: 'Files must be sent in the "media" field',
};

export const uploadListingMedia = (req, res, next) => {
    upload.array('media', MAX_FILES_PER_REQUEST)(req, res, async (err) => {
        if (err) {
            await cleanupTempFiles(req.files);
            const message = err instanceof multer.MulterError
                ? (MULTER_MESSAGES[err.code] || err.message)
                : err.message;
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || 400);
            return res.status(status).json({ success: false, message });
        }

        const tooBig = (req.files || []).find((f) =>
            f.size > (VIDEO_TYPES[f.mimetype] ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES));
        if (tooBig) {
            await cleanupTempFiles(req.files);
            const limitMb = (VIDEO_TYPES[tooBig.mimetype] ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES) / 1024 / 1024;
            return res.status(413).json({
                success: false,
                message: `${tooBig.originalname} is larger than ${limitMb} MB`,
            });
        }
        next();
    });
};
