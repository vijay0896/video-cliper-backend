import cors from 'cors';

export const corsMiddleware = cors({
  origin: true, // Permissive in development across all local frontend ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Gemini-Key',
    'X-Request-Id',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Range',
    'access-control-allow-private-network',
  ],
});
