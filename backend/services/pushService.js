import axios from 'axios';
import jwt from 'jsonwebtoken';
import DeviceToken from '../models/deviceTokenModel.js';
import logger from '../utils/logger.js';

// Push notifications through the Firebase Cloud Messaging HTTP v1 API, using a
// service account (no firebase-admin dependency). Configure either
//   FIREBASE_SERVICE_ACCOUNT  — the service-account JSON (raw or base64), or
//   FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
// Without them pushes are skipped; in-app notifications are still saved.

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const readServiceAccount = () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
        try {
            const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
            const account = JSON.parse(json);
            return { projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key };
        } catch {
            logger.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
            return null;
        }
    }
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return null;
    return {
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
    };
};

export const isPushConfigured = () => Boolean(readServiceAccount());

// OAuth access token, cached until shortly before it expires
let cached = { token: null, expiresAt: 0 };
const getAccessToken = async (account) => {
    if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
        { iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        account.privateKey,
        { algorithm: 'RS256' }
    );
    const { data } = await axios.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
    }), { timeout: 10000 });
    cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cached.token;
};

// FCM data values must be strings
const stringify = (data = {}) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));

/**
 * Sends a push to every registered device of `userId`. Never throws: push is
 * best-effort. Tokens FCM reports as no longer valid are removed.
 */
export const sendPushToUser = async (userId, { title, body, data }) => {
    const account = readServiceAccount();
    if (!account) return { sent: 0, skipped: true };

    try {
        const devices = await DeviceToken.find({ user: userId }).select('fcmToken');
        if (!devices.length) return { sent: 0 };

        const accessToken = await getAccessToken(account);
        const url = `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`;
        const results = await Promise.allSettled(devices.map((d) => axios.post(url, {
            message: { token: d.fcmToken, notification: { title, body }, data: stringify(data) },
        }, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 })));

        const invalid = devices.filter((d, i) => {
            const r = results[i];
            if (r.status === 'fulfilled') return false;
            const status = r.reason.response?.status;
            const code = r.reason.response?.data?.error?.details?.[0]?.errorCode;
            return status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT';
        });
        if (invalid.length) await DeviceToken.deleteMany({ _id: { $in: invalid.map((d) => d._id) } });

        return { sent: results.filter((r) => r.status === 'fulfilled').length };
    } catch (error) {
        logger.warn('Push notification failed', { userId: String(userId), error: error.message });
        return { sent: 0, error: error.message };
    }
};
