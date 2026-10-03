import jwt from 'jsonwebtoken';
import Admin from '../models/adminModel.js';

// Admin access (technical document 4.3: separate admin JWT, email + password).
// Admin access tokens carry typ:'admin'; role and district are re-read from the
// database on every request, so disabling an admin or moving them to another
// district takes effect immediately.

export const isSuperAdminEmail = (email) =>
    Boolean(email) && email.toLowerCase() === String(process.env.ADMIN_EMAIL || '').toLowerCase();

const deny = (res, status, message) =>
    res.status(status).json({ success: false, message, code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' });

/** Verifies the admin token and loads req.admin { id, email, name, role, district_id }. Returns false after sending an error. */
const authenticateAdmin = async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return deny(res, 401, 'Admin login required') && false;

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        const expired = error.name === 'TokenExpiredError';
        res.status(401).json({
            success: false,
            message: expired ? 'Access token expired' : 'Invalid admin token',
            code: expired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        });
        return false;
    }
    if (payload.typ !== 'admin' || !payload.id) return deny(res, 401, 'Invalid admin token') && false;

    const admin = await Admin.findById(payload.id).select('email name role district_id is_active');
    if (!admin) return deny(res, 401, 'Admin account not found') && false;
    const superAdmin = isSuperAdminEmail(admin.email);
    if (!superAdmin && (admin.role !== 'district_admin' || !admin.is_active || !admin.district_id)) {
        return deny(res, 403, 'This admin account is disabled') && false;
    }
    req.admin = {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: superAdmin ? 'superadmin' : 'district_admin',
        district_id: superAdmin ? null : admin.district_id,
    };
    return true;
};

/** Super admin only (the ADMIN_EMAIL account). Guards everything except property review. */
export const adminProtect = async (req, res, next) => {
    try {
        if (!(await authenticateAdmin(req, res))) return undefined;
        if (req.admin.role !== 'superadmin') return deny(res, 403, 'Only the super admin can do this');
        return next();
    } catch (error) {
        return next(error);
    }
};

/** Property review: the super admin, or an active district admin (controllers scope queries to req.admin.district_id). */
export const reviewerProtect = async (req, res, next) => {
    try {
        if (!(await authenticateAdmin(req, res))) return undefined;
        return next();
    } catch (error) {
        return next(error);
    }
};
