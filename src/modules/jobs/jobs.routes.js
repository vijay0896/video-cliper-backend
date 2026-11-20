import { Router } from 'express';
import { JobsController } from './jobs.controller.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { uploadVideo } from '../../core/middlewares/upload.js';
import { validate } from '../../core/middlewares/validate.js';
import { heavyJobLimiter, aiGenerationLimiter } from '../../config/rate-limit.js';
import { createJobSchema, generateCopySchema } from './jobs.validation.js';

const router = Router();

router.post(
  '/',
  heavyJobLimiter,
  uploadVideo.single('file'),
  validate(createJobSchema),
  asyncHandler(JobsController.createJob)
);
router.get('/', asyncHandler(JobsController.listJobs));
router.post(
  '/generate-copy',
  aiGenerationLimiter,
  validate(generateCopySchema),
  asyncHandler(JobsController.generateClipCopy)
);
router.get('/:id', asyncHandler(JobsController.getJob));
router.get('/:id/clips/:filename', asyncHandler(JobsController.getClipFile));

export default router;
