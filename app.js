import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';

import { corsMiddleware } from './src/config/cors.js';
import { requestIdMiddleware } from './src/core/middlewares/requestId.js';
import { errorHandler } from './src/core/middlewares/error.js';
import { env } from './src/config/env.js';
import apiRoutes from './src/routes/index.js';
import healthRoutes from './src/modules/health/health.routes.js';
import { JobsController } from './src/modules/jobs/jobs.controller.js';
import { uploadVideo } from './src/core/middlewares/upload.js';
import { asyncHandler } from './src/core/utils/asyncHandler.js';

const app = express();

app.set('trust proxy', 1);

// 1. Core Request Tracking
app.use(requestIdMiddleware);

// 2. Security & Performance
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(corsMiddleware);
app.use(compression());

// 3. Body Parsers & Loggers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (env.NODE_ENV !== 'test') {
  app.use(morgan(':date[iso] :method :url :status :response-time ms - :res[content-length] [req-id: :req[x-request-id]]'));
}

// 4. Static Media Serving
app.use('/output', express.static(env.OUTPUT_DIR));
app.use('/videos', express.static(env.OUTPUT_DIR));
app.use('/uploads', express.static(env.UPLOAD_DIR));

// 5. Mount API Routes
app.use('/health', healthRoutes);
app.use('/api/v1', apiRoutes);

// Direct compatibility endpoints for Frontend App
app.post('/api/process', uploadVideo.single('file'), asyncHandler(JobsController.createJob));
app.get('/api/status/:id', asyncHandler(JobsController.getJobLegacy));
app.get('/api/config', (req, res) => res.json({ billing_enabled: false, version: '1.0.0' }));

// 6. 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route [${req.method}] ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// 7. Global Error Handler
app.use(errorHandler);

export default app;

