import mongoose from 'mongoose';

// Firebase Cloud Messaging token per device. Linked to the login session so
// logging out a device stops its pushes.
const DeviceTokenSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'AppSession' },
    fcmToken: { type: String, required: true, unique: true, maxlength: 4096 },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
}, {
    timestamps: true
});

DeviceTokenSchema.index({ user: 1 });
DeviceTokenSchema.index({ session: 1 });

const DeviceToken = mongoose.model('DeviceToken', DeviceTokenSchema);

export default DeviceToken;
