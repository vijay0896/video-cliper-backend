import cors from 'cors';
import { env } from './env.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser callers (curl, postman, server-to-server) or listed origins
    if (!origin || env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Gemini-Key', 'X-Request-Id'],
});

