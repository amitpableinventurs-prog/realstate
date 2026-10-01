import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Collected at sign-up, same as the app's "Tell us about you"
    phone: { type: String, trim: true },  // E.164, e.g. +919876543210
    state: { type: String, trim: true },  // copied from the district
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },

    resetToken: { type: String },
    resetTokenExpire: { type: Date },

    // Email verification fields
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    verificationTokenExpiry: { type: Date },

    // User status management fields
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned'],
        default: 'active'
    },
    suspendedUntil: { type: Date },
    banReason: { type: String },
    suspendReason: { type: String },
    bannedAt: { type: Date },
    suspendedAt: { type: Date },
    bannedBy: { type: String },      // Admin email
    suspendedBy: { type: String },   // Admin email
    lastActive: { type: Date },

    // Brute-force protection: 5 failed logins → 15 min lock
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Rotating httpOnly refresh token (SHA-256 hash of the cookie value)
    userRefreshTokenHash: { type: String },
    userRefreshTokenExpiry: { type: Date }
}, {
    timestamps: true  // Adds createdAt and updatedAt
});

// Indexes for efficient queries
UserSchema.index({ status: 1, createdAt: -1 });       // Filter by status + sort
UserSchema.index({ suspendedUntil: 1 });              // Auto-unsuspend cron
UserSchema.index({ email: 'text', name: 'text' });    // Text search

const User = mongoose.model('User', UserSchema);

// Admin model with password hashing.
// The account whose email is ADMIN_EMAIL is the super admin (full access).
// 'district_admin' accounts are created by the super admin and can only
// review (approve/reject) listings in their assigned district.
const AdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'district_admin'], default: 'admin' },
    name: { type: String, trim: true, default: '' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District', default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    // Brute-force protection
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Refresh token (SHA-256 hash of the httpOnly cookie value)
    refreshTokenHash: { type: String },
    refreshTokenExpiry: { type: Date }
});

// Hash password before saving
AdminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const Admin = mongoose.model('Admin', AdminSchema);

export { Admin };
export default User;