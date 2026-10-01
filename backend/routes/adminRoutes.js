import express from 'express';
import {
  getAdminStats,
  getAllAppointments,
  updateAppointmentStatus,
  getPendingListings,
  listAllProperties,
  getPropertyForAdmin,
  approveListing,
  rejectListing,
  // User Management
  getAllUsers,
  getUserDetails,
  suspendUser,
  banUser,
  unbanUser,
  deleteUser,
  // Bulk Operations
  bulkSuspendUsers,
  bulkBanUsers,
  bulkApproveProperties,
  bulkRejectProperties,
  bulkDeleteProperties,
  // Activity Logs
  getActivityLogs,
  exportActivityLogs,
  // Enhanced Stats
  getUserStats,
  getPropertyStats,
  getEnhancedOverview,
} from '../controller/adminController.js';
import { listModels, createModel, updateModel, deleteModel } from '../controller/aiModelController.js';
import {
  adminListDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  listDistrictAdmins,
  createDistrictAdmin,
  updateDistrictAdmin,
  deleteDistrictAdmin,
  assignPropertyDistrict,
  assignListingDistrict,
} from '../controller/districtController.js';
import { adminProtect, reviewerProtect } from '../middleware/authMiddleware.js';
import { registry } from '../utils/circuitBreaker.js';

const router = express.Router();

// Listing review queue — super admin or district admins (scoped to their
// district in the controllers). Registered before the super-admin guard below.
router.get('/properties/pending', reviewerProtect, getPendingListings);
router.put('/properties/:id/approve', reviewerProtect, approveListing);
router.put('/properties/:id/reject', reviewerProtect, rejectListing);
router.post('/properties/bulk-approve', reviewerProtect, bulkApproveProperties);
router.post('/properties/bulk-reject', reviewerProtect, bulkRejectProperties);

// Everything below is super admin only
router.use(adminProtect);

router.get('/stats', getAdminStats);
router.get('/appointments', getAllAppointments);
router.put('/appointments/status', updateAppointmentStatus);

// All website properties with review status ("All Properties" page)
router.get('/properties', listAllProperties);
router.get('/properties/:id', getPropertyForAdmin);

// Districts and district admins
router.get('/districts', adminListDistricts);
router.post('/districts', createDistrict);
router.put('/districts/:id', updateDistrict);
router.delete('/districts/:id', deleteDistrict);
router.get('/district-admins', listDistrictAdmins);
router.post('/district-admins', createDistrictAdmin);
router.put('/district-admins/:id', updateDistrictAdmin);
router.delete('/district-admins/:id', deleteDistrictAdmin);
router.put('/properties/:id/district', assignPropertyDistrict);
router.put('/app-listings/:id/district', assignListingDistrict);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/unban', unbanUser);
router.delete('/users/:id', deleteUser);

// Bulk User Operations
router.post('/users/bulk-suspend', bulkSuspendUsers);
router.post('/users/bulk-ban', bulkBanUsers);

// Bulk Property Operations (bulk approve/reject are with the review queue above)
router.post('/properties/bulk-delete', bulkDeleteProperties);

// Activity Logs
router.get('/activity-logs', getActivityLogs);
router.get('/activity-logs/export', exportActivityLogs);

// Enhanced Stats
router.get('/stats/users', getUserStats);
router.get('/stats/properties', getPropertyStats);
router.get('/stats/overview', getEnhancedOverview);

// AI Model Management
router.get('/ai-models', listModels);
router.post('/ai-models', createModel);
router.put('/ai-models/:id', updateModel);
router.delete('/ai-models/:id', deleteModel);

// Circuit breaker monitoring endpoint
router.get('/circuit-breakers', (req, res) => {
  try {
    const circuitBreakers = registry.getAll();
    res.json({
      success: true,
      circuitBreakers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching circuit breaker status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch circuit breaker status',
      error: error.message
    });
  }
});

export default router;