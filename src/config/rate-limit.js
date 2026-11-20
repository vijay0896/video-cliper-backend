import rateLimit from 'express-rate-limit';

/**
 * Standard 429 Error Response Handler
 * Matches ApiResponse structure for consistent client error handling.
 * @param {string} message
 */
const rateLimitHandler = (message) => (req, res) => {
  return res.status(429).json({
    success: false,
    statusCode: 429,
    message,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      details: null,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * 1. General API Limiter
 * Applied globally to regular browsing, listings, and general API endpoints.
 * Automatically skips health checks, job status polling, and video streaming chunks.
 * 150 requests per 15 minutes.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    // Exempt health checks, high-frequency status polling, and video streaming chunks
    return (
      url.includes('/health') ||
      url.includes('/status/') ||
      url.includes('/clips/') ||
      url.includes('/frames/') ||
      url.startsWith('/videos/')
    );
  },
  handler: rateLimitHandler('Too many requests from this IP. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 2. Heavy Job & Ingestion Limiter
 * Protects server CPU, disk, and FFmpeg pipelines from DoS exhaustion.
 * Max 10 video processing / upload requests per 15 minutes.
 */
export const heavyJobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  handler: rateLimitHandler(
    'Too many video processing or upload requests from this IP. Please wait 15 minutes before submitting a new video.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 3. AI & Generation Limiter
 * Protects Google Gemini API quota and image/thumbnail synthesis resources.
 * Max 30 generation requests per 15 minutes.
 */
export const aiGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  handler: rateLimitHandler(
    'Too many AI generation requests. Please wait a few minutes before generating more titles, thumbnails, or descriptions.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

