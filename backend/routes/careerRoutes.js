import express from 'express';
import { adminProtect } from '../middleware/authMiddleware.js';
import { jobApplicationLimiter } from '../middleware/rateLimitMiddleware.js';
import {
  listOpenJobs, getJob, applyForJob,
  adminListJobs, adminCreateJob, adminUpdateJob, adminDeleteJob,
  adminListApplications, adminUpdateApplication,
} from '../controller/careerController.js';

const careerRouter = express.Router();

// Admin
careerRouter.get('/admin/jobs', adminProtect, adminListJobs);
careerRouter.post('/admin/jobs', adminProtect, adminCreateJob);
careerRouter.put('/admin/jobs/:id', adminProtect, adminUpdateJob);
careerRouter.delete('/admin/jobs/:id', adminProtect, adminDeleteJob);
careerRouter.get('/admin/applications', adminProtect, adminListApplications);
careerRouter.patch('/admin/applications/:id', adminProtect, adminUpdateApplication);

// Public
careerRouter.get('/jobs', listOpenJobs);
careerRouter.get('/jobs/:slug', getJob);
careerRouter.post('/jobs/:slug/apply', jobApplicationLimiter, applyForJob);

export default careerRouter;
