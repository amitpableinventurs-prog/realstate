import express from 'express';
import { appProtect, appOptionalAuth } from '../middleware/appAuthMiddleware.js';
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

// Bhoomi Bazar API, mounted at /api/v1 — follows section 6 of the Development &
// Technical Document. Documented in docs/openapiV1.js (/api-docs/v1).
// Shares data with the older mobile API at /api/v1/app.

// Express 4 doesn't forward rejected promises to the error handler
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const router = express.Router();
router.use(errorFormat);

// 6.1 Authentication
router.post('/auth/send-otp', otpSendLimiter, auth.sendOtp);
router.post('/auth/resend-otp', otpSendLimiter, auth.sendOtp);
router.post('/auth/verify-otp', otpVerifyLimiter, auth.verifyOtp);
router.post('/auth/refresh-token', auth.refreshToken);
router.post('/auth/logout', appProtect, auth.logout);

// 6.2 Profile
router.get('/users/me', appProtect, wrap(users.getMe));
router.put('/users/me', appProtect, wrap(users.updateMe));
router.post('/users/me/device-token', appProtect, wrap(users.saveDeviceToken));
router.delete('/users/me', appProtect, wrap(users.deleteMe));

// 6.3 Property (owner)
router.post('/properties', appProtect, wrap(properties.createProperty));
router.get('/properties/my', appProtect, wrap(properties.myProperties));
router.get('/properties/:id', appOptionalAuth, wrap(properties.getProperty));
router.put('/properties/:id', appProtect, wrap(properties.updateProperty));
router.delete('/properties/:id', appProtect, wrap(properties.deleteProperty));
router.patch('/properties/:id/status', appProtect, wrap(properties.updatePropertyStatus));
router.post('/uploads/presign', appProtect, wrap(uploads.presign));
// Upload target when S3 isn't configured; authorised by the signed URL
router.put('/uploads/:id',
    express.raw({ type: () => true, limit: uploads.MAX_IMAGE_BYTES }),
    wrap(uploads.receiveUpload));

// 6.4 Public listing
router.get('/listings', appOptionalAuth, wrap(properties.listListings));
router.get('/master/states', wrap(master.listStates));
router.get('/master/states/:stateId/districts', wrap(master.listStateDistricts));

// 6.5 Wishlist
router.get('/wishlist', appProtect, wrap(properties.getWishlist));
router.post('/wishlist/:propertyId', appProtect, wrap(properties.addToWishlist));
router.delete('/wishlist/:propertyId', appProtect, wrap(properties.removeFromWishlist));

// 6.6 Enquiries and notifications
router.post('/properties/:id/enquiries', appProtect, activity.createEnquiry);
router.get('/enquiries/received', appProtect, wrap(activity.receivedEnquiries));
router.get('/notifications', appProtect, wrap(activity.listNotifications));
router.patch('/notifications/:id/read', appProtect, wrap(activity.markNotificationRead));

// 6.7 Admin. Review endpoints accept district admins (scoped to their district);
// editing, deleting, users and master data are super admin only.
router.post('/admin/auth/login', loginLimiter, admin.login);
router.get('/admin/dashboard', reviewerProtect, wrap(admin.dashboard));
router.get('/admin/properties', reviewerProtect, wrap(admin.listProperties));
router.get('/admin/properties/:id', reviewerProtect, wrap(admin.getProperty));
router.patch('/admin/properties/:id/approve', reviewerProtect, wrap(admin.approveProperty));
router.patch('/admin/properties/:id/reject', reviewerProtect, wrap(admin.rejectProperty));
router.put('/admin/properties/:id', adminProtect, wrap(admin.updateProperty));
router.delete('/admin/properties/:id', adminProtect, wrap(admin.deleteProperty));
router.patch('/admin/properties/:id/restore', adminProtect, wrap(admin.restoreProperty));
router.get('/admin/users', adminProtect, wrap(admin.listUsers));
router.get('/admin/users/:id/properties', adminProtect, wrap(admin.userProperties));
router.get('/admin/states', adminProtect, wrap(admin.listStates));
router.post('/admin/states', adminProtect, wrap(admin.createState));
router.put('/admin/states/:id', adminProtect, wrap(admin.updateState));
router.delete('/admin/states/:id', adminProtect, wrap(admin.deleteState));
router.get('/admin/districts', adminProtect, wrap(admin.listDistricts));
router.post('/admin/districts', adminProtect, wrap(admin.createDistrict));
router.put('/admin/districts/:id', adminProtect, wrap(admin.updateDistrict));
router.delete('/admin/districts/:id', adminProtect, wrap(admin.deleteDistrict));

router.use((req, res) => fail(res, 404, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND'));

export default router;
