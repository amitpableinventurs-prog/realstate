import mongoose from 'mongoose';

// A photo slot handed out by POST /api/v1/uploads/presign. The client uploads
// the file, then sends its URL in image_urls; only URLs issued to that user
// are accepted. Unused slots expire after a day.
const PendingUploadSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    url: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['s3', 'imagekit', 'local'], required: true },
    storageId: { type: String }, // S3 key, local filename, or ImageKit fileId once uploaded
    uploaded: { type: Boolean, default: false }, // set by the direct (non-S3) upload endpoint
    expiresAt: { type: Date, required: true },
}, {
    timestamps: true
});

PendingUploadSchema.index({ user: 1, url: 1 });
PendingUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const PendingUpload = mongoose.model('PendingUpload', PendingUploadSchema);

export default PendingUpload;
