/**
 * @file src/config/ai.js
 * @description Centralized Google Gemini AI Configuration & Model Fallback Hierarchy
 */
import { env } from './env.js';

export const AI_CONFIG = {
  /**
   * Ordered fallback ladder of candidate Gemini models.
   * Priority: Primary env model -> fastest lightweight flash models -> robust flash fallbacks.
   */
  CANDIDATE_MODELS: [
    ...new Set(
      [
        env.GEMINI_MODEL,
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
      ].filter(Boolean)
    ),
  ],

  /**
   * Retry and backoff tuning for transient errors (429/503)
   */
  RETRY: {
    MAX_ATTEMPTS_PER_MODEL: 2,
    TRANSIENT_BACKOFF_MS: 2000,
  },
};

