import express from 'express';
import { appProtect, appOptionalAuth } from '../middleware/appAuthMiddleware.js';
import { reviewerProtect } from '../middleware/authMiddleware.js';
import { listPublicDistricts, listPublicStates } from '../controller/districtController.js';
import { uploadListingMedia } from '../middleware/appUploadMiddleware.js';
import { otpSendLimiter, otpVerifyLimiter } from '../middleware/rateLimitMiddleware.js';
import {
    sendOtp, verifyOtp, refreshSession, logout, logoutAll,
} from '../controller/appAuthController.js';
import { getMe, updateMe, deleteMe, registerProfile } from '../controller/appUserController.js';
import {
    searchListings, getListing, getListingContact, saveListing, unsaveListing,
    getSavedListings, getMyListings, createListing, updateListing, deleteListing,
    addListingMedia, removeListingMedia, adminListListings, adminUpdateListing, forListingType,
} from '../controller/appListingController.js';
import {
    createEnquiry, getSentEnquiries, getReceivedEnquiries, updateEnquiryStatus, withdrawEnquiry,
} from '../controller/appEnquiryController.js';
import { getMeta, convertAreaUnits } from '../controller/appMetaController.js';

// Mobile app API, mounted at /api/v1/app. Documented in docs/openapi.js (/api-docs).

// Express 4 doesn't forward rejected promises to the error handler
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const router = express.Router();

// Auth (OTP)
router.post('/auth/otp/send', otpSendLimiter, wrap(sendOtp));
router.post('/auth/otp/resend', otpSendLimiter, wrap(sendOtp));
router.post('/auth/otp/verify', otpVerifyLimiter, wrap(verifyOtp));
router.post('/auth/register', appProtect, wrap(registerProfile));
router.post('/auth/refresh', wrap(refreshSession));
router.post('/auth/logout', appProtect, wrap(logout));
router.post('/auth/logout-all', appProtect, wrap(logoutAll));

// Profile
router.get('/me', appProtect, wrap(getMe));
router.patch('/me', appProtect, wrap(updateMe));
router.delete('/me', appProtect, wrap(deleteMe));
router.get('/me/listings', appProtect, wrap(getMyListings));
router.get('/me/saved', appProtect, wrap(getSavedListings));
router.get('/me/enquiries/sent', appProtect, wrap(getSentEnquiries));
router.get('/me/enquiries/received', appProtect, wrap(getReceivedEnquiries));

// Buy / Sell / Rent / Lease — same handlers as /listings with the listing type fixed
router.get('/buy', appOptionalAuth, forListingType('sell'), wrap(searchListings));
router.post('/sell', appProtect, uploadListingMedia, forListingType('sell'), wrap(createListing));
router.get('/rent', appOptionalAuth, forListingType('rent'), wrap(searchListings));
router.post('/rent', appProtect, uploadListingMedia, forListingType('rent'), wrap(createListing));
router.get('/lease', appOptionalAuth, forListingType('lease'), wrap(searchListings));
router.post('/lease', appProtect, uploadListingMedia, forListingType('lease'), wrap(createListing));

// Listings
router.get('/listings', appOptionalAuth, wrap(searchListings));
router.post('/listings', appProtect, uploadListingMedia, wrap(createListing));
router.get('/listings/:id', appOptionalAuth, wrap(getListing));
router.patch('/listings/:id', appProtect, wrap(updateListing));
router.delete('/listings/:id', appProtect, wrap(deleteListing));
router.post('/listings/:id/media', appProtect, uploadListingMedia, wrap(addListingMedia));
router.delete('/listings/:id/media/:mediaId', appProtect, wrap(removeListingMedia));
router.post('/listings/:id/contact', appProtect, wrap(getListingContact));
router.post('/listings/:id/save', appProtect, wrap(saveListing));
router.delete('/listings/:id/save', appProtect, wrap(unsaveListing));

// Enquiries ("I want to buy / rent / lease this")
router.post('/listings/:id/enquiries', appProtect, wrap(createEnquiry));
router.patch('/enquiries/:id', appProtect, wrap(updateEnquiryStatus));
router.delete('/enquiries/:id', appProtect, wrap(withdrawEnquiry));

// Reference data
router.get('/meta', getMeta);
router.get('/states', listPublicStates);
router.get('/districts', listPublicDistricts);
router.get('/utils/area-convert', convertAreaUnits);

// Admin moderation (uses the existing admin JWT from POST /api/users/admin).
// District admins only see and moderate listings in their own district.
router.get('/admin/listings', reviewerProtect, wrap(adminListListings));
router.patch('/admin/listings/:id', reviewerProtect, wrap(adminUpdateListing));

export default router;
