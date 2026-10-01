import mongoose from 'mongoose';

// One document per logged-in device. The refresh token is stored as a SHA-256
// hash and rotated on every refresh; deleting the document logs the device out.
const AppSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    device: {
        platform: { type: String, maxlength: 20 },   // android | ios | web
        deviceId: { type: String, maxlength: 200 },
        appVersion: { type: String, maxlength: 20 },
    },
}, {
    timestamps: true
});

AppSessionSchema.index({ user: 1 });
AppSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AppSession = mongoose.model('AppSession', AppSessionSchema);

export default AppSession;
