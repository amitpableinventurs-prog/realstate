/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 */

import rateLimit from 'express-rate-limit';

/**
 * Registration rate limiter
 * Limits: 5 registration attempts per 15 minutes per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 registration requests per windowMs
  message: {
    message: 'Too many registration attempts from this IP. Please try again later.',
    success: false,
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (only count failed attempts)
  skipSuccessfulRequests: false,
  // Use IP address for identification
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * Login rate limiter
 * Limits: 10 login attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: {
    message: 'Too many login attempts from this IP. Please try again later.',
    success: false,
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * Password reset rate limiter
 * Limits: 3 password reset requests per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    message: 'Too many password reset requests. Please try again later.',
    success: false,
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful password resets
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * Password reset token verification limiter
 * Limits: 5 attempts per hour per IP — prevents brute-forcing the reset token
 */
export const passwordResetVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    message: 'Too many password reset attempts. Please try again later.',
    success: false,
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip,
});

/**
 * Email verification resend limiter
 * Limits: 3 resend requests per hour per IP
 */
export const emailResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    message: 'Too many verification email requests. Please try again later.',
    success: false,
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: 'Too many requests from this IP. Please try again later.',
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * OTP send limiter (mobile app)
 * Limits: 10 OTP requests per 15 minutes per IP — per-phone limits are enforced
 * separately in controller/v1/authController so one IP can't flood a single number
 */
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: 'Too many OTP requests from this IP. Please try again later.',
    success: false,
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

/**
 * OTP verify limiter (mobile app)
 * Limits: 20 verification attempts per 15 minutes per IP
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    message: 'Too many verification attempts. Please try again later.',
    success: false,
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

/**
 * Job application limiter (careers page)
 * Limits: 5 applications per hour per IP
 */
export const jobApplicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    message: 'Too many applications from this IP. Please try again later.',
    success: false,
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // validation errors don't use up the allowance
  keyGenerator: (req) => req.ip,
});

/** App rating and feedback submissions: 10 per hour per IP. */
export const appFeedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many feedback submissions. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => req.ip,
});
