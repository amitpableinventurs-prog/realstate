import mongoose from 'mongoose';

// refresh_tokens — technical document 5.2. One per signed-in device; only a
// hash of the token is stored. Access tokens carry this record's id, so
// logging out a device also ends its access token.
const RefreshTokenSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
}, {
    collection: 'refresh_tokens',
});

RefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL
RefreshTokenSchema.index({ user_id: 1 });

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

export default RefreshToken;
