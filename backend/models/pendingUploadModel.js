import mongoose from 'mongoose';

// A photo, video or document slot handed out by POST /api/v1/uploads/presign.
// The client uploads the file, then sends its URL in image_urls (photos and
// videos) or its id in document_ids (documents, which have no public URL).
// Only files issued to the same uploader (a user, or an admin adding/editing a
// property) are accepted. Unused slots expire after a day, and
// utils/cleanupUploads.js deletes their files.
const PendingUploadSchema = new mongoose.Schema({
    uploader_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    uploader_type: { type: String, enum: ['user', 'admin'], required: true },
    purpose: { type: String, enum: ['MEDIA', 'DOCUMENT'], default: 'MEDIA' },
    url: { type: String, required() { return this.purpose !== 'DOCUMENT'; } },
    file_name: { type: String }, // documents: the name shown to the owner and the admin
    content_type: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['s3', 'imagekit', 'local', 'private'], required: true },
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
