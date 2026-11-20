import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';

// Core Middlewares & Configurations
import { env } from './src/config/env.js';
import { corsMiddleware } from './src/config/cors.js';
import { requestIdMiddleware } from './src/core/middlewares/requestId.js';
import { httpLogger } from './src/core/middlewares/httpLogger.js';
import { notFoundHandler } from './src/core/middlewares/notFound.js';
import { errorHandler } from './src/core/middlewares/error.js';

// Master Routing Gateways
import mainApiRoutes from './src/routes/index.js';
import healthRoutes from './src/modules/health/health.routes.js';

const app = express();

// =============================================================================
// 1. Core Request Tracking & Structured Logging (Must be first)
// =============================================================================
app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(httpLogger);

// =============================================================================
// 2. Security & Optimization
// =============================================================================
app.use(
  helmet({
    contentSecurityPolicy: false, // Permits media playback & canvas rendering
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows cross-origin video & image access
    crossOriginOpenerPolicy: false, // Allows cross-origin popups and local tab interactions
  })
);

// Private Network Access (PNA) preflight support for local Chrome ports
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(corsMiddleware);
app.use(compression());

// =============================================================================
// 3. Body Parsers
// =============================================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =============================================================================
// 4. Static Media Serving Pipelines
// =============================================================================
const staticOptions = {
  maxAge: '1h',
  etag: true,
  lastModified: true,
};

app.use('/output', express.static(env.OUTPUT_DIR, staticOptions));
app.use('/videos', express.static(env.OUTPUT_DIR, staticOptions));
app.use('/thumbnails', express.static(path.join(env.OUTPUT_DIR, 'thumbnails'), staticOptions));
app.get(['/thumbnails', '/thumbnails/'], (req, res) => {
  res.json({ success: true, message: 'Thumbnails static endpoint active' });
});
app.use('/uploads', express.static(env.UPLOAD_DIR, staticOptions));

// =============================================================================
// 5. System Health & Readiness Probes
// =============================================================================
app.use('/health', healthRoutes);
app.use('/', healthRoutes);

// =============================================================================
// 6. Master API Routing Gateway
// =============================================================================
// Dual mounting: /api and /api/v1 for 100% unified client compatibility
app.use('/api/v1', mainApiRoutes);
app.use('/api', mainApiRoutes);

// =============================================================================
// 7. Route Fallback & Global Error Handlers (Must be last)
// =============================================================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
