import mongoose from 'mongoose';

// users — technical document 5.2. One account type for buyers and sellers,
// created on OTP verification (mobile app and website) and completed on the
// "Tell us about you" screen.
const UserSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true }, // E.164, e.g. +919876543210
    name: { type: String, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State' },
    district_id: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
}, {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

UserSchema.index({ is_deleted: 1, created_at: -1 }); // admin user list

// The "Tell us about you" screen is done once name and district are set
UserSchema.virtual('profile_complete').get(function () {
    return Boolean(this.name && this.district_id);
});

const User = mongoose.model('User', UserSchema);

export default User;
