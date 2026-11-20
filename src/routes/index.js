/**
 * @file src/routes/index.js
 * @description Central API Routing Gateway
 * Aggregates all domain modules, health monitoring, rate limiting, and client compatibility endpoints.
 */
import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import jobsRoutes from '../modules/jobs/jobs.routes.js';
import thumbnailRoutes from '../modules/thumbnail/thumbnail.routes.js';
import { JobsController } from '../modules/jobs/jobs.controller.js';
import { uploadVideo } from '../core/middlewares/upload.js';
import { validate } from '../core/middlewares/validate.js';
import { asyncHandler } from '../core/utils/asyncHandler.js';
import { ApiResponse } from '../core/utils/apiResponse.js';
import {
  generalApiLimiter,
  heavyJobLimiter,
  aiGenerationLimiter,
} from '../config/rate-limit.js';
import { createJobSchema, generateCopySchema } from '../modules/jobs/jobs.validation.js';

const router = Router();

// =============================================================================
// Global Rate Limiting (Protects general API while skipping polling/streaming)
// =============================================================================
router.use(generalApiLimiter);

// =============================================================================
// 1. Core Domain Resource Routes
// =============================================================================
router.use('/health', healthRoutes);
router.use('/jobs', jobsRoutes);
router.use('/thumbnail', thumbnailRoutes);

// =============================================================================
// 2. Client Compatibility Endpoints (Seamless support for OpenShorts Frontend)
// =============================================================================
// Direct video clipping creation & ingestion (Strict rate limit + Schema Validation)
router.post(
  '/process',
  heavyJobLimiter,
  uploadVideo.single('file'),
  validate(createJobSchema),
  asyncHandler(JobsController.createJob)
);

// Legacy job progress & status polling (EXEMPT from strict rate limits for smooth progress UI)
router.get('/status/:id', asyncHandler(JobsController.getJobLegacy));

// AI Copywriting & Viral Hook Generation (AI rate limit + Schema Validation)
router.post(
  '/clip/generate-copy',
  aiGenerationLimiter,
  validate(generateCopySchema),
  asyncHandler(JobsController.generateClipCopy)
);
router.post(
  '/generate-copy',
  aiGenerationLimiter,
  validate(generateCopySchema),
  asyncHandler(JobsController.generateClipCopy)
);

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
