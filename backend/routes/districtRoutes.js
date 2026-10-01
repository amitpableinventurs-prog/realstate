import express from 'express';
import { listPublicDistricts, listPublicStates } from '../controller/districtController.js';

// Public: states and active districts for the dropdowns.
// Admin management lives in adminRoutes (/api/admin/districts).
const districtRouter = express.Router();

districtRouter.get('/', listPublicDistricts);
districtRouter.get('/states', listPublicStates);

export default districtRouter;
