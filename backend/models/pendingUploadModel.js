import mongoose from 'mongoose';

// A photo slot handed out by POST /api/v1/uploads/presign. The client uploads
// the file, then sends its URL in image_urls; only URLs issued to the same
// uploader (a user, or an admin adding/editing a property) are accepted.
// Unused slots expire after a day.
const PendingUploadSchema = new mongoose.Schema({
    uploader_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    uploader_type: { type: String, enum: ['user', 'admin'], required: true },
    url: { type: String, required: true },
    content_type: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['s3', 'imagekit', 'local'], required: true },
    storage_id: { type: String }, // S3 key, local filename or ImageKit file name
    uploaded: { type: Boolean, default: false }, // set by the direct (non-S3) upload endpoint
    expires_at: { type: Date, required: true },
}, {
    collection: 'pending_uploads',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

PendingUploadSchema.index({ uploader_id: 1, url: 1 });
PendingUploadSchema.index({ expires_at: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const PendingUpload = mongoose.model('PendingUpload', PendingUploadSchema);

export default PendingUpload;
