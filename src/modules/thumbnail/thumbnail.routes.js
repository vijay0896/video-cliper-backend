import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ThumbnailController } from './thumbnail.controller.js';

const router = Router();

// Storage supporting video files and images for thumbnails
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = env.UPLOAD_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max
});

const generateUpload = upload.fields([
  { name: 'face', maxCount: 1 },
  { name: 'background', maxCount: 1 },
]);

router.post('/upload', upload.single('file'), asyncHandler(ThumbnailController.upload));
router.post('/analyze', upload.single('file'), asyncHandler(ThumbnailController.analyze));
router.post('/titles', asyncHandler(ThumbnailController.titles));
router.get('/frames/:session_id', asyncHandler(ThumbnailController.getFrames));
router.post('/generate', generateUpload, asyncHandler(ThumbnailController.generate));
router.post('/describe', asyncHandler(ThumbnailController.describe));
router.post('/publish', upload.none(), asyncHandler(ThumbnailController.publish));
router.get('/publish/status/:id', asyncHandler(ThumbnailController.getPublishStatus));

export default router;

