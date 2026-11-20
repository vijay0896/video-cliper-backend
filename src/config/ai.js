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
        env.GEMINI_MODEL,           // .env override (if specified)
        'gemini-4-hydrogen',        // ⚡ Tier 1: Fastest & Efficient Gemini 4 model
        'gemini-4-argon',           // 🚀 Tier 2: Fast reasoning fallback
        'gemini-4-neon',            // 🧠 Tier 3: Frontier intelligence fallback
        'gemini-3.1-flash-lite',    // 🛡️ Tier 4: Stable legacy fallback
        'gemini-2.5-flash',         // 🛡️ Tier 5: High-availability fallback
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

