import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import jobsRoutes from '../modules/jobs/jobs.routes.js';

const router = Router();

// API V1 Routes
router.use('/health', healthRoutes);
router.use('/jobs', jobsRoutes);

export default router;

