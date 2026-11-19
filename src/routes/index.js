/**
 * @file src/routes/index.js
 * @description Central API Routing Gateway
 * Aggregates all domain modules, health monitoring, and client compatibility endpoints.
 */
import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import jobsRoutes from '../modules/jobs/jobs.routes.js';
import thumbnailRoutes from '../modules/thumbnail/thumbnail.routes.js';
import { JobsController } from '../modules/jobs/jobs.controller.js';
import { uploadVideo } from '../core/middlewares/upload.js';
import { asyncHandler } from '../core/utils/asyncHandler.js';
import { ApiResponse } from '../core/utils/apiResponse.js';

const router = Router();

// =============================================================================
// 1. Core Domain Resource Routes
// =============================================================================
router.use('/health', healthRoutes);
router.use('/jobs', jobsRoutes);
router.use('/thumbnail', thumbnailRoutes);

// =============================================================================
// 2. Client Compatibility Endpoints (Seamless support for OpenShorts Frontend)
// =============================================================================
// Direct video clipping creation & ingestion
router.post('/process', uploadVideo.single('file'), asyncHandler(JobsController.createJob));

// Legacy job progress & status polling
router.get('/status/:id', asyncHandler(JobsController.getJobLegacy));

// AI Copywriting & Viral Hook Generation
router.post('/clip/generate-copy', asyncHandler(JobsController.generateClipCopy));
router.post('/generate-copy', asyncHandler(JobsController.generateClipCopy));

// Platform Environment & Feature Flags
router.get('/config', (req, res) => {
  return ApiResponse.success(res, 'Configuration retrieved successfully', {
    billing_enabled: false,
    managed: false,
    version: '1.0.0',
    platform: process.platform,
    timestamp: new Date().toISOString(),
  });
});

export default router;
