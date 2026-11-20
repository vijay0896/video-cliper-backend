import { Router } from 'express';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ThumbnailController } from './thumbnail.controller.js';
import { thumbnailUpload, generateThumbnailUpload } from './thumbnail.utils.js';
import { validate } from '../../core/middlewares/validate.js';
import { heavyJobLimiter, aiGenerationLimiter } from '../../config/rate-limit.js';
import {
  titlesRefinementSchema,
  generateThumbnailSchema,
  describeThumbnailSchema,
  publishThumbnailSchema,
} from './thumbnail.validation.js';

const router = Router();

router.post('/upload', heavyJobLimiter, thumbnailUpload.single('file'), asyncHandler(ThumbnailController.upload));
router.post('/analyze', heavyJobLimiter, thumbnailUpload.single('file'), asyncHandler(ThumbnailController.analyze));
router.post(
  '/titles',
  aiGenerationLimiter,
  validate(titlesRefinementSchema),
  asyncHandler(ThumbnailController.titles)
);
router.get('/frames/:session_id', asyncHandler(ThumbnailController.getFrames));
router.post(
  '/generate',
  aiGenerationLimiter,
  generateThumbnailUpload,
  validate(generateThumbnailSchema),
  asyncHandler(ThumbnailController.generate)
);
router.post(
  '/describe',
  aiGenerationLimiter,
  validate(describeThumbnailSchema),
  asyncHandler(ThumbnailController.describe)
);
router.post(
  '/publish',
  thumbnailUpload.none(),
  validate(publishThumbnailSchema),
  asyncHandler(ThumbnailController.publish)
);
router.get('/publish/status/:id', asyncHandler(ThumbnailController.getPublishStatus));

export default router;
