import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import AppUser from '../models/appUserModel.js';
import AppSession from '../models/appSessionModel.js';
import Otp from '../models/otpModel.js';
import { sendOtpSms, getSmsProvider, otpTtlSeconds } from '../services/smsService.js';
import logger from '../utils/logger.js';

// ── OTP settings (all overridable via env) ───────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 30;
const MAX_SENDS_PER_WINDOW = Number(process.env.OTP_MAX_SENDS_PER_HOUR) || 5;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const ACCESS_TOKEN_TTL_SECONDS = (Number(process.env.APP_ACCESS_TOKEN_TTL_MINUTES) || 60) * 60;
const REFRESH_TOKEN_TTL_MS = (Number(process.env.APP_REFRESH_TOKEN_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const hashOtp = (phone, code) =>
    crypto.createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET)
        .update(`${phone}:${code}`)
        .digest('hex');

const safeEqual = (a, b) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// Fixed codes for store reviewers / QA, e.g. OTP_TEST_PHONES="+919999999999:123456"
const testOtpFor = (phone) => {
    const entry = (process.env.OTP_TEST_PHONES || '')
        .split(',')
        .map((pair) => pair.trim().split(':'))
        .find(([testPhone]) => testPhone === phone);
    return entry?.[1];
};

// Same code for every number during development/testing, e.g. OTP_DEFAULT_CODE=123456.
// Ignored in production so real users always get a random code by SMS.
const defaultOtp = () => {
    const code = process.env.OTP_DEFAULT_CODE;
    if (!code || process.env.NODE_ENV === 'production') return undefined;
    return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) ? code : undefined;
};

// Accepts "9876543210", "+91 98765 43210", "0091-9876543210" → "+919876543210"
export const normalizePhone = (raw, countryCode) => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    let phone = String(raw).replace(/[\s\-().]/g, '');
    if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
    if (!phone.startsWith('+')) {
        const cc = String(countryCode || process.env.DEFAULT_COUNTRY_CODE || '+91').replace(/\D/g, '');
        phone = `+${cc}${phone.replace(/^0+/, '')}`;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
    // Indian mobile numbers: 10 digits starting 6-9
    if (phone.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(phone)) return null;
    return phone;
};

const parseDevice = (device) => {
    if (!device || typeof device !== 'object') return undefined;
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
    const platform = str(device.platform, 20)?.toLowerCase();
    return {
        platform: ['android', 'ios', 'web'].includes(platform) ? platform : undefined,
        deviceId: str(device.deviceId, 200),
        appVersion: str(device.appVersion, 20),
    };
};

const signAccessToken = (userId, sessionId) =>
    jwt.sign({ id: userId, sid: sessionId, typ: 'app' }, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

const tokenResponse = (userId, sessionId, refreshToken, refreshExpiresAt) => ({
    tokenType: 'Bearer',
    accessToken: signAccessToken(userId, sessionId),
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt,
});

const createSession = async (user, device) => {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await AppSession.create({
        user: user._id,
        refreshTokenHash: sha256(refreshToken),
        expiresAt,
        device,
    });
    return tokenResponse(user._id, session._id, refreshToken, expiresAt);
};

const tooManyRequests = (res, message, retryAfter) => {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, message, code: 'OTP_THROTTLED', retryAfter });
};

// POST /auth/otp/send  (also used for "Resend OTP")
export const sendOtp = async (req, res) => {
    const phone = normalizePhone(req.body?.phone, req.body?.countryCode);
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Enter a valid mobile number' });
    }

    const now = new Date();
    const existing = await Otp.findOne({ phone });
    let sendCount = 1;
    let windowStartedAt = now;

    if (existing) {
        const secondsSinceLast = (now - existing.lastSentAt) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
            const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
            return tooManyRequests(res, `Please wait ${wait}s before requesting another OTP`, wait);
        }
        const windowEnds = existing.windowStartedAt.getTime() + SEND_WINDOW_MS;
        if (now.getTime() < windowEnds) {
            if (existing.sendCount >= MAX_SENDS_PER_WINDOW) {
                const wait = Math.ceil((windowEnds - now.getTime()) / 1000);
                return tooManyRequests(res, 'Too many OTP requests for this number. Please try again later.', wait);
            }
            sendCount = existing.sendCount + 1;
            windowStartedAt = existing.windowStartedAt;
        }
    }

    const testCode = testOtpFor(phone) || defaultOtp();
    const code = testCode || crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const expiresAt = new Date(now.getTime() + otpTtlSeconds() * 1000);
    const update = {
        codeHash: hashOtp(phone, code),
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
            if (result.modifiedCount === 0) {
                return tooManyRequests(res, 'An OTP was just sent. Please wait before retrying.', RESEND_COOLDOWN_SECONDS);
            }
        } else {
            await Otp.create({ phone, ...update });
        }
    } catch (error) {
        if (error.code === 11000) {
            return tooManyRequests(res, 'An OTP was just sent. Please wait before retrying.', RESEND_COOLDOWN_SECONDS);
        }
        throw error;
    }

    if (!testCode) {
        try {
            await sendOtpSms(phone, code);
        } catch (error) {
            logger.error('OTP SMS delivery failed', { phone, provider: getSmsProvider(), error: error.message });
            // Invalidate the unsent code but keep the throttling counters
            await Otp.updateOne({ phone }, { expiresAt: now, lastSentAt: new Date(0) });
            return res.status(502).json({ success: false, message: 'Could not send OTP. Please try again.' });
        }
    }

    const exposeCode = getSmsProvider() === 'console' && process.env.NODE_ENV !== 'production';
    res.json({
        success: true,
        message: 'OTP sent',
        data: {
            phone,
            otpLength: OTP_LENGTH,
            expiresIn: otpTtlSeconds(),
            resendAfter: RESEND_COOLDOWN_SECONDS,
            ...(exposeCode && { devOtp: code }),
        },
    });
};

// Phone + OTP from the request body, or null when either is malformed
const readOtpRequest = (body = {}) => {
    const phone = normalizePhone(body.phone, body.countryCode);
    const otp = typeof body.otp === 'number' ? String(body.otp) : body.otp;
    if (!phone || typeof otp !== 'string' || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) return null;
    return { phone, otp };
};

/**
 * Checks and consumes the OTP for `phone` (single use, attempt-limited).
 * Sends the error response and returns false when it is not valid.
 */
const consumeOtp = async (res, phone, otp) => {
    const now = new Date();
    // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit
    const record = await Otp.findOneAndUpdate(
        { phone, expiresAt: { $gt: now }, attempts: { $lt: MAX_VERIFY_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true }
    );

    if (!record) {
        const pending = await Otp.findOne({ phone, expiresAt: { $gt: now } });
        if (pending) {
            res.status(429).json({
                success: false,
                message: 'Too many incorrect attempts. Please request a new OTP.',
                code: 'OTP_ATTEMPTS_EXCEEDED',
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.',
                code: 'OTP_EXPIRED',
            });
        }
        return false;
    }

    if (!safeEqual(hashOtp(phone, otp), record.codeHash)) {
        const remainingAttempts = MAX_VERIFY_ATTEMPTS - record.attempts;
        res.status(400).json({
            success: false,
            message: remainingAttempts > 0
                ? `Incorrect OTP. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} left.`
                : 'Incorrect OTP. Please request a new one.',
            code: 'OTP_INVALID',
            remainingAttempts,
        });
        return false;
    }

    // Single use: only one concurrent request can consume the code
    const consumed = await Otp.updateOne(
        { _id: record._id, codeHash: record.codeHash },
        { $set: { codeHash: 'used', expiresAt: now } }
    );
    if (consumed.modifiedCount === 0) {
        res.status(400).json({ success: false, message: 'OTP has already been used', code: 'OTP_EXPIRED' });
        return false;
    }
    return true;
};

// POST /auth/otp/verify
export const verifyOtp = async (req, res) => {
    const credentials = readOtpRequest(req.body);
    if (!credentials) {
        return res.status(400).json({ success: false, message: 'Phone number and a valid OTP are required' });
    }
    const { phone, otp } = credentials;
    if (!(await consumeOtp(res, phone, otp))) return;

    const now = new Date();
    let user = await AppUser.findOne({ phone });
    const isNewUser = !user;
    if (!user) {
        try {
            user = await AppUser.create({ phone, isPhoneVerified: true });
        } catch (error) {
            if (error.code !== 11000) throw error;
            user = await AppUser.findOne({ phone }); // created by a concurrent request
        }
    }

    if (user.status !== 'active') {
        return res.status(403).json({
            success: false,
            message: `Your account is ${user.status}. Please contact support.`,
            code: 'ACCOUNT_BLOCKED',
        });
    }

    user.isPhoneVerified = true;
    user.lastLoginAt = now;
    await user.save();

    const tokens = await createSession(user, parseDevice(req.body.device));
    res.json({
        success: true,
        message: 'Logged in',
        data: { ...tokens, isNewUser, user: user.toPublicJSON() },
    });
};

// POST /auth/refresh — rotates the refresh token (each one is single-use)
export const refreshSession = async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken) {
        return res.status(400).json({ success: false, message: 'refreshToken is required' });
    }

    const newRefreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await AppSession.findOneAndUpdate(
        { refreshTokenHash: sha256(refreshToken), expiresAt: { $gt: new Date() } },
        { $set: { refreshTokenHash: sha256(newRefreshToken), expiresAt, lastUsedAt: new Date() } },
        { new: true }
    );

    if (!session) {
        return res.status(401).json({
            success: false,
            message: 'Session has ended, please login again',
            code: 'REFRESH_INVALID',
        });
    }

    const user = await AppUser.findById(session.user);
    if (!user || user.status !== 'active') {
        await AppSession.deleteOne({ _id: session._id });
        return res.status(403).json({ success: false, message: 'Account is not active', code: 'ACCOUNT_BLOCKED' });
    }

    res.json({
        success: true,
        data: tokenResponse(user._id, session._id, newRefreshToken, expiresAt),
    });
};

// POST /auth/logout — ends the current device's session
export const logout = async (req, res) => {
    await AppSession.deleteOne({ _id: req.appSessionId });
    res.json({ success: true, message: 'Logged out' });
};

// POST /auth/logout-all — ends every session for this account
export const logoutAll = async (req, res) => {
    const { deletedCount } = await AppSession.deleteMany({ user: req.appUser._id });
    res.json({ success: true, message: `Logged out of ${deletedCount} device(s)` });
};
