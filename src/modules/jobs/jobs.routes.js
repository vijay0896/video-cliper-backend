import { Router } from 'express';
import { JobsController } from './jobs.controller.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { uploadVideo } from '../../core/middlewares/upload.js';

const router = Router();

router.post('/', uploadVideo.single('file'), asyncHandler(JobsController.createJob));
router.get('/', asyncHandler(JobsController.listJobs));
router.get('/:id', asyncHandler(JobsController.getJob));
router.get('/:id/clips/:filename', asyncHandler(JobsController.getClipFile));

export default router;

