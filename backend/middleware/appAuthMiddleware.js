import jwt from 'jsonwebtoken';
import AppUser from '../models/appUserModel.js';
import AppSession from '../models/appSessionModel.js';

// Access tokens for the mobile app carry typ:'app' and the session id, so a
// website token can't be used here (and vice versa), and logging out a device
// invalidates its access token immediately.

const unauthorized = (res, message = 'Please login to continue') =>
    res.status(401).json({ success: false, message, code: 'UNAUTHORIZED' });

const authenticate = async (req, res, next, { optional }) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return optional ? next() : unauthorized(res);
    }

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

    if (payload.typ !== 'app' || !payload.sid) {
        return unauthorized(res, 'Invalid access token');
    }

    try {
        const [user, session] = await Promise.all([
            AppUser.findById(payload.id),
            AppSession.exists({ _id: payload.sid, user: payload.id }),
        ]);

        if (!user || !session) {
            return unauthorized(res, 'Session has ended, please login again');
        }
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: `Your account is ${user.status}`,
                code: 'ACCOUNT_BLOCKED',
            });
        }

        req.appUser = user;
        req.appSessionId = payload.sid;
        next();
    } catch (error) {
        next(error);
    }
};

export const appProtect = (req, res, next) => authenticate(req, res, next, { optional: false });

// Attaches req.appUser when a token is sent (e.g. to mark saved listings),
// but lets anonymous requests through
export const appOptionalAuth = (req, res, next) => authenticate(req, res, next, { optional: true });
