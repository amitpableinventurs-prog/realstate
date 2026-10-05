import express from 'express';
import { userProtect, userOptionalAuth, userOrAdminProtect } from '../middleware/userAuthMiddleware.js';
import { adminProtect, reviewerProtect } from '../middleware/authMiddleware.js';
import { otpSendLimiter, otpVerifyLimiter, loginLimiter } from '../middleware/rateLimitMiddleware.js';
import { errorFormat, fail } from '../utils/v1.js';
import * as auth from '../controller/v1/authController.js';
import * as users from '../controller/v1/userController.js';
import * as properties from '../controller/v1/propertyController.js';
import * as activity from '../controller/v1/activityController.js';
import * as master from '../controller/v1/masterController.js';
import * as uploads from '../controller/v1/uploadController.js';
import * as admin from '../controller/v1/adminController.js';

// Bhoomi Bazar API, mounted at /api/v1 — section 6 of the Development &
// Technical Document. Used by the mobile app, the website and the admin panel.
// Documented in docs/openapiV1.js (/api-docs).

// Express 4 doesn't forward rejected promises to the error handler
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const router = express.Router();
router.use(errorFormat);

// 6.1 Authentication
router.post('/auth/send-otp', otpSendLimiter, wrap(auth.sendOtp));
router.post('/auth/resend-otp', otpSendLimiter, wrap(auth.sendOtp));
router.post('/auth/verify-otp', otpVerifyLimiter, wrap(auth.verifyOtp));
router.post('/auth/refresh-token', wrap(auth.refreshToken));
router.post('/auth/logout', userProtect, wrap(auth.logout));

// 6.2 Profile
router.get('/users/me', userProtect, wrap(users.getMe));
router.put('/users/me', userProtect, wrap(users.updateMe));
router.post('/users/me/device-token', userProtect, wrap(users.saveDeviceToken));
router.delete('/users/me', userProtect, wrap(users.deleteMe));

// 6.3 Property (owner) — the document's /properties endpoints, renamed to
// /list-property on request. POST /list-property is the one create API for
// SELL / RENT / LEASE; the admin panel uses it too, adding properties for an owner.
router.post('/list-property', userOrAdminProtect, wrap(properties.createProperty));
// 6.4 Public listing: all approved properties (the document's GET /listings)
router.get('/list-property', userOptionalAuth, wrap(properties.listListings));
router.get('/list-property/my', userProtect, wrap(properties.myProperties));
router.get('/list-property/:id', userOptionalAuth, wrap(properties.getProperty));
router.put('/list-property/:id', userProtect, wrap(properties.updateProperty));
router.delete('/list-property/:id', userProtect, wrap(properties.deleteProperty));
router.patch('/list-property/:id/status', userProtect, wrap(properties.updatePropertyStatus));
router.post('/uploads/presign', userOrAdminProtect, wrap(uploads.presign));
// Upload target when S3 isn't configured; authorised by the signed URL. The
// controller streams the body to disk (videos up to UPLOAD_MAX_MB).
router.put('/uploads/:id', wrap(uploads.receiveUpload));

// 6.4 Master data
router.get('/master/states', wrap(master.listStates));
router.get('/master/states/:stateId/districts', wrap(master.listStateDistricts));

// 6.5 Wishlist
router.get('/wishlist', userProtect, wrap(properties.getWishlist));
router.post('/wishlist/:propertyId', userProtect, wrap(properties.addToWishlist));
router.delete('/wishlist/:propertyId', userProtect, wrap(properties.removeFromWishlist));

// 6.6 Enquiries and notifications
router.post('/properties/:id/enquiries', userProtect, wrap(activity.createEnquiry));
router.get('/enquiries/received', userProtect, wrap(activity.receivedEnquiries));
router.get('/notifications', userProtect, wrap(activity.listNotifications));
router.patch('/notifications/:id/read', userProtect, wrap(activity.markNotificationRead));

// 6.7 Admin. Review endpoints accept district admins (scoped to their district);
// editing, deleting, users and master data are super admin only.
router.post('/admin/auth/login', loginLimiter, wrap(admin.login));
router.post('/admin/auth/refresh', wrap(admin.refresh));
router.post('/admin/auth/logout', wrap(admin.logout));
router.get('/admin/auth/me', reviewerProtect, wrap(admin.me));
router.get('/admin/dashboard', reviewerProtect, wrap(admin.dashboard));
router.get('/admin/properties', reviewerProtect, wrap(admin.listProperties));
router.get('/admin/properties/:id', reviewerProtect, wrap(admin.getProperty));
router.patch('/admin/properties/:id/approve', reviewerProtect, wrap(admin.approveProperty));
router.patch('/admin/properties/:id/reject', reviewerProtect, wrap(admin.rejectProperty));
router.put('/admin/properties/:id', adminProtect, wrap(admin.updateProperty));
router.delete('/admin/properties/:id', adminProtect, wrap(admin.deleteProperty));
router.patch('/admin/properties/:id/restore', adminProtect, wrap(admin.restoreProperty));
router.get('/admin/users', adminProtect, wrap(admin.listUsers));
router.get('/admin/users/:id', adminProtect, wrap(admin.getUser));
router.patch('/admin/users/:id', adminProtect, wrap(admin.setUserActive));
router.get('/admin/users/:id/properties', adminProtect, wrap(admin.userProperties));
router.get('/admin/states', adminProtect, wrap(admin.listStates));
router.post('/admin/states', adminProtect, wrap(admin.createState));
router.put('/admin/states/:id', adminProtect, wrap(admin.updateState));
router.delete('/admin/states/:id', adminProtect, wrap(admin.deleteState));
router.get('/admin/districts', adminProtect, wrap(admin.listDistricts));
router.post('/admin/districts', adminProtect, wrap(admin.createDistrict));
router.put('/admin/districts/:id', adminProtect, wrap(admin.updateDistrict));
router.delete('/admin/districts/:id', adminProtect, wrap(admin.deleteDistrict));
router.get('/admin/district-admins', adminProtect, wrap(admin.listDistrictAdmins));
router.post('/admin/district-admins', adminProtect, wrap(admin.createDistrictAdmin));
router.put('/admin/district-admins/:id', adminProtect, wrap(admin.updateDistrictAdmin));
router.delete('/admin/district-admins/:id', adminProtect, wrap(admin.deleteDistrictAdmin));

router.use((req, res) => fail(res, 404, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND'));

export default router;
