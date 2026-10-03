import mongoose from 'mongoose';

// device_tokens — technical document 5.2. Firebase Cloud Messaging token per device.
const DeviceTokenSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fcm_token: { type: String, required: true, unique: true, maxlength: 4096 },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
}, {
    collection: 'device_tokens',
    timestamps: { createdAt: false, updatedAt: 'updated_at' },
});

DeviceTokenSchema.index({ user_id: 1 });

const DeviceToken = mongoose.model('DeviceToken', DeviceTokenSchema);

export default DeviceToken;
