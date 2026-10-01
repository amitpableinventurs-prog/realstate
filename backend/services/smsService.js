import axios from 'axios';
import logger from '../utils/logger.js';

// SMS_PROVIDER selects how OTPs are delivered:
//   console — logs the code (development only; refused in production)
//   msg91   — MSG91 Flow API with a DLT-approved template
//   twilio  — Twilio Programmable Messaging
export const getSmsProvider = () => (process.env.SMS_PROVIDER || 'console').toLowerCase();

const otpMessage = (code) =>
    `${code} is your Bhumi Bazar verification code. It expires in ${Math.round(otpTtlSeconds() / 60)} minutes. Do not share it with anyone.`;

export const otpTtlSeconds = () => Number(process.env.OTP_TTL_SECONDS) || 300;

const sendViaMsg91 = async (phone, code) => {
    const { MSG91_AUTH_KEY, MSG91_TEMPLATE_ID } = process.env;
    if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
        throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set');
    }
    await axios.post('https://control.msg91.com/api/v5/flow', {
        template_id: MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [{
            mobiles: phone.replace('+', ''),
            [process.env.MSG91_OTP_VAR || 'otp']: code,
        }],
    }, {
        headers: { authkey: MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
        timeout: 10000,
    });
};

const sendViaTwilio = async (phone, code) => {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
        throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER must be set');
    }
    await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: otpMessage(code) }),
        {
            auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
            timeout: 10000,
        }
    );
};

export const sendOtpSms = async (phone, code) => {
    const provider = getSmsProvider();
    switch (provider) {
        case 'msg91':
            return sendViaMsg91(phone, code);
        case 'twilio':
            return sendViaTwilio(phone, code);
        case 'console':
            if (process.env.NODE_ENV === 'production') {
                throw new Error('SMS_PROVIDER=console is not allowed in production');
            }
            logger.info('OTP (console SMS provider)', { phone, otp: code });
            return;
        default:
            throw new Error(`Unknown SMS_PROVIDER "${provider}"`);
    }
};
