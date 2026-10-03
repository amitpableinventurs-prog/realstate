import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// admins — technical document 5.2 (name, email, password_hash, created_at).
// The account whose email is ADMIN_EMAIL is the super admin. The remaining
// fields support district admins (who review listings of one district only),
// brute-force lockout and the admin panel's refresh-token cookie.
const AdminSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },

    role: { type: String, enum: ['admin', 'district_admin'], default: 'admin' },
    district_id: { type: mongoose.Schema.Types.ObjectId, ref: 'District', default: null },
    is_active: { type: Boolean, default: true },
    last_login_at: { type: Date },

    failed_login_attempts: { type: Number, default: 0 },
    lock_until: { type: Date },

    refresh_token_hash: { type: String },
    refresh_token_expires_at: { type: Date },
}, {
    collection: 'admins',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

AdminSchema.methods.setPassword = async function (password) {
    this.password_hash = await bcrypt.hash(password, 12);
};

AdminSchema.methods.checkPassword = function (password) {
    return typeof password === 'string' && bcrypt.compare(password, this.password_hash);
};

const Admin = mongoose.model('Admin', AdminSchema);

export default Admin;
