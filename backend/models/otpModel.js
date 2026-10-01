import mongoose from 'mongoose';

// One pending OTP per phone number. The code itself is never stored — only an
// HMAC of it. Documents are removed by the TTL index once the send window ends.
const OtpSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },

    // Resend throttling: sendCount sends allowed per window starting at windowStartedAt
    lastSentAt: { type: Date, required: true },
    sendCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
});

OtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', OtpSchema);

export default Otp;
