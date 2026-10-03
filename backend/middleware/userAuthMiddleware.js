import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import RefreshToken from '../models/refreshTokenModel.js';
import { reviewerProtect } from './authMiddleware.js';

// User access (technical document 4.3). Access tokens carry typ:'user' and the
// id of the device's refresh_tokens record, so an admin token can't be used
// here (and vice versa) and logging out a device ends its access token at once.

const unauthorized = (res, message = 'Please login to continue') =>
    res.status(401).json({ success: false, message, code: 'UNAUTHORIZED' });

const authenticate = async (req, res, next, { optional }) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return optional ? next() : unauthorized(res);

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        const expired = error.name === 'TokenExpiredError';
        return res.status(401).json({
            success: false,
            message: expired ? 'Access token expired' : 'Invalid access token',
            code: expired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        });
    }
    if (payload.typ !== 'user' || !payload.sid) return unauthorized(res, 'Invalid access token');

    try {
        const [user, session] = await Promise.all([
            User.findById(payload.id).populate([{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }]),
            RefreshToken.exists({ _id: payload.sid, user_id: payload.id }),
        ]);
        if (!user || user.is_deleted || !session) return unauthorized(res, 'Session has ended, please login again');
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Your account has been deactivated', code: 'ACCOUNT_BLOCKED' });
        }
        req.user = user;
        req.sessionId = payload.sid;
        return next();
    } catch (error) {
        return next(error);
    }
};

export const userProtect = (req, res, next) => authenticate(req, res, next, { optional: false });

// Sets req.user when a token is sent (e.g. to mark saved properties) but lets guests through
export const userOptionalAuth = (req, res, next) => authenticate(req, res, next, { optional: true });

/**
 * POST /list-property and /uploads/presign accept a user or an admin (the admin
 * panel adds properties on an owner's behalf). The token type picks the guard.
 */
export const userOrAdminProtect = (req, res, next) => {
    const header = req.headers.authorization || '';
    const payload = header.startsWith('Bearer ') ? jwt.decode(header.slice(7)) : null;
    if (payload?.typ === 'admin') return reviewerProtect(req, res, next);
    return userProtect(req, res, next);
};
