import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../../models/userModel.js';
import RefreshToken from '../../models/refreshTokenModel.js';
import DeviceToken from '../../models/deviceTokenModel.js';
import Otp from '../../models/otpModel.js';
import { sendOtpSms, getSmsProvider, otpTtlSeconds } from '../../services/smsService.js';
import logger from '../../utils/logger.js';
import { fail, ok, userOut, validationFailed, PLACE_POPULATE } from '../../utils/v1.js';

// /api/v1/auth — mobile number + OTP login for the app and the website
// (technical document 4.2 / 6.1).

// ── Settings (all overridable via env) ───────────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 30;
// At most 3 OTPs per number in 10 minutes
const MAX_SENDS_PER_WINDOW = Number(process.env.OTP_MAX_SENDS_PER_WINDOW) || 3;
const SEND_WINDOW_MS = (Number(process.env.OTP_SEND_WINDOW_MINUTES) || 10) * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const ACCESS_TOKEN_TTL_SECONDS = (Number(process.env.APP_ACCESS_TOKEN_TTL_MINUTES) || 60) * 60;
const REFRESH_TOKEN_TTL_MS = (Number(process.env.APP_REFRESH_TOKEN_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const hashOtp = (mobile, code) =>
    crypto.createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET)
        .update(`${mobile}:${code}`)
        .digest('hex');

const safeEqual = (a, b) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// Fixed codes for store reviewers / QA, e.g. OTP_TEST_PHONES="+919999999999:123456"
const testOtpFor = (mobile) => {
    const entry = (process.env.OTP_TEST_PHONES || '')
        .split(',')
        .map((pair) => pair.trim().split(':'))
        .find(([testMobile]) => testMobile === mobile);
    return entry?.[1];
};

// Same code for every number during development, e.g. OTP_DEFAULT_CODE=123456.
// Ignored in production so real users always get a random code by SMS.
const defaultOtp = () => {
    const code = process.env.OTP_DEFAULT_CODE;
    if (!code || process.env.NODE_ENV === 'production') return undefined;
    return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) ? code : undefined;
};

// Accepts "9876543210", "+91 98765 43210", "0091-9876543210" → "+919876543210"
export const normalizeMobile = (raw, countryCode) => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    let mobile = String(raw).replace(/[\s\-().]/g, '');
    if (mobile.startsWith('00')) mobile = `+${mobile.slice(2)}`;
    if (!mobile.startsWith('+')) {
        const cc = String(countryCode || process.env.DEFAULT_COUNTRY_CODE || '+91').replace(/\D/g, '');
        mobile = `+${cc}${mobile.replace(/^0+/, '')}`;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(mobile)) return null;
    // Indian mobile numbers: 10 digits starting 6-9
    if (mobile.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(mobile)) return null;
    return mobile;
};

const signAccessToken = (userId, sessionId) =>
    jwt.sign({ id: userId, sid: sessionId, typ: 'user' }, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

const tokensOut = (userId, sessionId, refreshToken, expiresAt) => ({
    token_type: 'Bearer',
    access_token: signAccessToken(userId, sessionId),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    refresh_token_expires_at: expiresAt,
});

// A refresh token per signed-in device (technical document 4.2)
const createSession = async (user) => {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await RefreshToken.create({ user_id: user._id, token_hash: sha256(refreshToken), expires_at: expiresAt });
    return tokensOut(user._id, session._id, refreshToken, expiresAt);
};

const throttled = (res, message, retryAfter) => {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, message, errorCode: 'OTP_THROTTLED', retry_after: retryAfter });
};

// POST /auth/send-otp and /auth/resend-otp { mobile, country_code? }
export const sendOtp = async (req, res) => {
    const mobile = normalizeMobile(req.body?.mobile, req.body?.country_code);
    if (!mobile) return validationFailed(res, { mobile: 'Enter a valid mobile number' });

    const now = new Date();
    const existing = await Otp.findOne({ phone: mobile });
    let sendCount = 1;
    let windowStartedAt = now;

    if (existing) {
        const secondsSinceLast = (now - existing.lastSentAt) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
            const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
            return throttled(res, `Please wait ${wait}s before requesting another OTP`, wait);
        }
        const windowEnds = existing.windowStartedAt.getTime() + SEND_WINDOW_MS;
        if (now.getTime() < windowEnds) {
            if (existing.sendCount >= MAX_SENDS_PER_WINDOW) {
                const wait = Math.ceil((windowEnds - now.getTime()) / 1000);
                return throttled(res, 'Too many OTP requests for this number. Please try again later.', wait);
            }
            sendCount = existing.sendCount + 1;
            windowStartedAt = existing.windowStartedAt;
        }
    }

    const testCode = testOtpFor(mobile) || defaultOtp();
    const code = testCode || crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const expiresAt = new Date(now.getTime() + otpTtlSeconds() * 1000);
    const update = {
        codeHash: hashOtp(mobile, code),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        sendCount,
        windowStartedAt,
        purgeAt: new Date(Math.max(windowStartedAt.getTime() + SEND_WINDOW_MS, expiresAt.getTime())),
    };

    // Conditional on lastSentAt so two simultaneous requests can't both pass the cooldown
    try {
        if (existing) {
            const result = await Otp.updateOne({ _id: existing._id, lastSentAt: existing.lastSentAt }, update);
            if (result.modifiedCount === 0) return throttled(res, 'An OTP was just sent. Please wait before retrying.', RESEND_COOLDOWN_SECONDS);
        } else {
            await Otp.create({ phone: mobile, ...update });
        }
    } catch (error) {
        if (error.code === 11000) return throttled(res, 'An OTP was just sent. Please wait before retrying.', RESEND_COOLDOWN_SECONDS);
        throw error;
    }

    if (!testCode) {
        try {
            await sendOtpSms(mobile, code);
        } catch (error) {
            logger.error('OTP SMS delivery failed', { mobile, provider: getSmsProvider(), error: error.message });
            // Invalidate the unsent code but keep the throttling counters
            await Otp.updateOne({ phone: mobile }, { expiresAt: now, lastSentAt: new Date(0) });
            return fail(res, 502, 'Could not send OTP. Please try again.', 'UPSTREAM_ERROR');
        }
    }

    const exposeCode = getSmsProvider() === 'console' && process.env.NODE_ENV !== 'production';
    return ok(res, {
        mobile,
        otp_length: OTP_LENGTH,
        expires_in: otpTtlSeconds(),
        resend_after: RESEND_COOLDOWN_SECONDS,
        ...(exposeCode && { dev_otp: code }),
    }, 'OTP sent');
};

/**
 * Checks and consumes the OTP for `mobile` (single use, attempt-limited).
 * Sends the error response and returns false when it is not valid.
 */
const consumeOtp = async (res, mobile, otp) => {
    const now = new Date();
    // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit
    const record = await Otp.findOneAndUpdate(
        { phone: mobile, expiresAt: { $gt: now }, attempts: { $lt: MAX_VERIFY_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true }
    );

    if (!record) {
        const pending = await Otp.findOne({ phone: mobile, expiresAt: { $gt: now } });
        if (pending) fail(res, 429, 'Too many incorrect attempts. Please request a new OTP.', 'OTP_ATTEMPTS_EXCEEDED');
        else fail(res, 400, 'OTP has expired. Please request a new one.', 'OTP_EXPIRED');
        return false;
    }

    if (!safeEqual(hashOtp(mobile, otp), record.codeHash)) {
        const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
        res.status(400).json({
            success: false,
            message: remaining > 0
                ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
                : 'Incorrect OTP. Please request a new one.',
            errorCode: 'OTP_INVALID',
            remaining_attempts: remaining,
        });
        return false;
    }

    // Single use, and deleted after successful verification (technical document 4.2)
    const consumed = await Otp.deleteOne({ _id: record._id, codeHash: record.codeHash });
    if (consumed.deletedCount === 0) {
        fail(res, 400, 'OTP has already been used', 'OTP_EXPIRED');
        return false;
    }
    return true;
};

// POST /auth/verify-otp { mobile, otp } — creates the user on first login
export const verifyOtp = async (req, res) => {
    const mobile = normalizeMobile(req.body?.mobile, req.body?.country_code);
    const otp = typeof req.body?.otp === 'number' ? String(req.body.otp) : req.body?.otp;
    if (!mobile || typeof otp !== 'string' || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
        return validationFailed(res, {
            ...(!mobile && { mobile: 'Enter a valid mobile number' }),
            ...(mobile && { otp: `Enter the ${OTP_LENGTH}-digit OTP` }),
        });
    }
    if (!(await consumeOtp(res, mobile, otp))) return undefined;

    let user = await User.findOne({ mobile });
    let isNewUser = !user;
    if (!user) {
        try {
            user = await User.create({ mobile });
        } catch (error) {
            if (error.code !== 11000) throw error;
            user = await User.findOne({ mobile }); // created by a concurrent request
        }
    }

    // A deleted account comes back as a new, empty profile
    if (user.is_deleted) {
        user.set({ is_deleted: false, name: undefined, email: undefined, state_id: undefined, district_id: undefined });
        await user.save();
        isNewUser = true;
    }
    if (!user.is_active) {
        return fail(res, 403, 'Your account has been deactivated. Please contact support.', 'ACCOUNT_BLOCKED');
    }

    const tokens = await createSession(user);
    await user.populate(PLACE_POPULATE);
    return ok(res, {
        ...tokens,
        is_new_user: isNewUser,
        profile_complete: user.profile_complete,
        user: userOut(user),
    }, 'Logged in');
};

// POST /auth/refresh-token { refresh_token } — each refresh token works once
export const refreshToken = async (req, res) => {
    const token = req.body?.refresh_token;
    if (typeof token !== 'string' || !token) return validationFailed(res, { refresh_token: 'refresh_token is required' });

    const newToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await RefreshToken.findOneAndUpdate(
        { token_hash: sha256(token), expires_at: { $gt: new Date() } },
        { $set: { token_hash: sha256(newToken), expires_at: expiresAt } },
        { new: true }
    );
    if (!session) return fail(res, 401, 'Session has ended, please login again', 'REFRESH_INVALID');

    const user = await User.findById(session.user_id);
    if (!user || user.is_deleted || !user.is_active) {
        await RefreshToken.deleteOne({ _id: session._id });
        return fail(res, 403, 'Account is not active', 'ACCOUNT_BLOCKED');
    }
    return ok(res, tokensOut(user._id, session._id, newToken, expiresAt));
};

// POST /auth/logout { fcm_token? } — revokes this device's refresh token and push token
export const logout = async (req, res) => {
    const fcmToken = typeof req.body?.fcm_token === 'string' ? req.body.fcm_token.trim() : '';
    await Promise.all([
        RefreshToken.deleteOne({ _id: req.sessionId }),
        fcmToken ? DeviceToken.deleteOne({ user_id: req.user._id, fcm_token: fcmToken }) : null,
    ]);
    return ok(res, {}, 'Logged out');
};
