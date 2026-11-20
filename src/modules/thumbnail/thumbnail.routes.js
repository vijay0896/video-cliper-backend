import { Router } from 'express';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ThumbnailController } from './thumbnail.controller.js';
import { thumbnailUpload, generateThumbnailUpload } from './thumbnail.utils.js';

const router = Router();

router.post('/upload', thumbnailUpload.single('file'), asyncHandler(ThumbnailController.upload));
router.post('/analyze', thumbnailUpload.single('file'), asyncHandler(ThumbnailController.analyze));
router.post('/titles', asyncHandler(ThumbnailController.titles));
router.get('/frames/:session_id', asyncHandler(ThumbnailController.getFrames));
router.post('/generate', generateThumbnailUpload, asyncHandler(ThumbnailController.generate));
router.post('/describe', asyncHandler(ThumbnailController.describe));
router.post('/publish', thumbnailUpload.none(), asyncHandler(ThumbnailController.publish));
router.get('/publish/status/:id', asyncHandler(ThumbnailController.getPublishStatus));

export default router;
