import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Ensure Homebrew and standard CLI paths are always in PATH for sub-processes
const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
const currentPath = process.env.PATH || '';
for (const p of extraPaths) {
  if (!currentPath.includes(p)) {
    process.env.PATH = `${p}:${process.env.PATH}`;
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '8000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  OUTPUT_DIR: path.resolve(process.env.OUTPUT_DIR || './output'),
  TEMP_DIR: path.resolve(process.env.TEMP_DIR || './temp'),
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5175')
    .split(',')
    .map((o) => o.trim()),
};

