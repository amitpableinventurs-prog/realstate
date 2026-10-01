import DeviceToken from '../../models/deviceTokenModel.js';
import { sendOtp as appSendOtp, verifyOtp as appVerifyOtp, refreshSession, logout as appLogout } from '../appAuthController.js';
import { reshape } from './reshape.js';
import { loadStateIndex, userOut } from '../../utils/v1.js';

// /api/v1/auth — mobile number + OTP login (technical document 4.2 / 6.1).
// The OTP rules (hashing, expiry, 3 sends per 10 minutes, 30 s resend wait,
// 5 attempts) live in appAuthController and are shared with /api/v1/app.

const otpRequestBody = (b) => ({ phone: b.mobile, countryCode: b.country_code });

const otpSentData = (d) => ({
    mobile: d.phone,
    otp_length: d.otpLength,
    expires_in: d.expiresIn,
    resend_after: d.resendAfter,
    ...(d.devOtp && { dev_otp: d.devOtp }),
});

const tokensData = (d) => ({
    token_type: d.tokenType,
    access_token: d.accessToken,
    expires_in: d.accessTokenExpiresIn,
    refresh_token: d.refreshToken,
    refresh_token_expires_at: d.refreshTokenExpiresAt,
});

// POST /auth/send-otp and /auth/resend-otp { mobile, country_code? }
export const sendOtp = reshape(appSendOtp, { body: otpRequestBody, data: otpSentData, errors: { phone: 'mobile' } });

// POST /auth/verify-otp { mobile, otp, device?: { platform, device_id, app_version } }
export const verifyOtp = reshape(appVerifyOtp, {
    body: (b) => ({
        phone: b.mobile,
        countryCode: b.country_code,
        otp: b.otp,
        device: b.device && typeof b.device === 'object'
            ? { platform: b.device.platform, deviceId: b.device.device_id, appVersion: b.device.app_version }
            : undefined,
    }),
    prepare: loadStateIndex,
    data: (d, stateIndex) => ({
        ...tokensData(d),
        is_new_user: d.isNewUser,
        profile_complete: d.user.profileComplete,
        user: userOut({
            _id: d.user.id,
            phone: d.user.phone,
            name: d.user.name,
            email: d.user.email,
            state: d.user.state,
            district: d.user.district ? { _id: d.user.district.id, name: d.user.district.name } : null,
            createdAt: d.user.createdAt,
        }, stateIndex),
    }),
});

// POST /auth/refresh-token { refresh_token } — the refresh token is rotated
export const refreshToken = reshape(refreshSession, {
    body: (b) => ({ refreshToken: b.refresh_token }),
    data: tokensData,
});

// POST /auth/logout { fcm_token? } — ends this device's session and its push token
export const logout = async (req, res, next) => {
    try {
        const fcmToken = typeof req.body?.fcm_token === 'string' ? req.body.fcm_token : null;
        await DeviceToken.deleteMany({
            user: req.appUser._id,
            $or: [{ session: req.appSessionId }, ...(fcmToken ? [{ fcmToken }] : [])],
        });
        await appLogout(req, res);
    } catch (error) {
        next(error);
    }
};

