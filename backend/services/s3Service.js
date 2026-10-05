import logger from '../utils/logger.js';

// AWS S3 (+ optional CloudFront) for property photos and videos uploaded directly by the
// client with pre-signed URLs. Used when S3_BUCKET and AWS_REGION are set;
// otherwise /api/v1/uploads falls back to ImageKit / local disk.
// Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or the
// default AWS chain (e.g. an instance role).

export const isS3Configured = () => Boolean(process.env.S3_BUCKET && process.env.AWS_REGION);

// An hour, so the last of several large videos can still start uploading
export const presignExpirySeconds = () => Number(process.env.S3_PRESIGN_EXPIRES_SECONDS) || 3600;

// CloudFront domain when set, else the bucket's own URL
export const s3PublicUrl = (key) => {
    const base = process.env.S3_PUBLIC_BASE_URL ||
        `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    return `${base.replace(/\/$/, '')}/${key}`;
};

// The SDK is loaded lazily so the server starts without it being configured
let clientPromise;
const getClient = () => {
    clientPromise ??= import('@aws-sdk/client-s3').then(({ S3Client }) =>
        new S3Client({ region: process.env.AWS_REGION }));
    return clientPromise;
};

/** Pre-signed PUT URL. Content-Type and Content-Length are signed, so the upload must match them. */
export const presignPut = async ({ key, contentType, size }) => {
    const [{ PutObjectCommand }, { getSignedUrl }, client] = await Promise.all([
        import('@aws-sdk/client-s3'),
        import('@aws-sdk/s3-request-presigner'),
        getClient(),
    ]);
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
    });
    return getSignedUrl(client, command, {
        expiresIn: presignExpirySeconds(),
        signableHeaders: new Set(['content-type', 'content-length']),
    });
};

/** Size of an uploaded object, or null when it doesn't exist (not uploaded yet). */
export const headObjectSize = async (key) => {
    const [{ HeadObjectCommand }, client] = await Promise.all([import('@aws-sdk/client-s3'), getClient()]);
    try {
        const head = await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
        return head.ContentLength ?? 0;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return null;
        throw error;
    }
};

export const deleteS3Object = async (key) => {
    const [{ DeleteObjectCommand }, client] = await Promise.all([import('@aws-sdk/client-s3'), getClient()]);
    try {
        await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    } catch (error) {
        logger.warn('Failed to delete S3 object', { key, error: error.message });
    }
};
