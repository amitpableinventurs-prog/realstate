import express from 'express';
import { getActivityLogs, exportActivityLogs } from '../controller/activityLogController.js';
import { listModels, createModel, updateModel, deleteModel } from '../controller/aiModelController.js';
import { getAllAppointments, updateAppointmentStatus } from '../controller/appointmentController.js';
import { adminProtect } from '../middleware/authMiddleware.js';
import { registry } from '../utils/circuitBreaker.js';

// Admin-panel features outside the technical document's API: audit log,
// appointments, AI models and monitoring. Properties, users, states, districts
// and district admins are managed through /api/v1/admin. Super admin only.
const router = express.Router();
router.use(adminProtect);

router.get('/appointments', getAllAppointments);
router.put('/appointments/status', updateAppointmentStatus);

// Activity Logs
router.get('/activity-logs', getActivityLogs);
router.get('/activity-logs/export', exportActivityLogs);

// AI Model Management
router.get('/ai-models', listModels);
router.post('/ai-models', createModel);
router.put('/ai-models/:id', updateModel);
router.delete('/ai-models/:id', deleteModel);

// Circuit breaker monitoring endpoint
router.get('/circuit-breakers', (req, res) => {
  res.json({ success: true, circuitBreakers: registry.getAll(), timestamp: new Date().toISOString() });
});

export default router;
