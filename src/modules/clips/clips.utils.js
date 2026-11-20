import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AI_CONFIG } from '../../config/ai.js';
import { AppError } from '../../core/utils/appError.js';

/**
 * Clips module utilities for audio payload preparation, AI model execution with fallback, and copy resolution.
 */

/**
 * Initializes and returns an authenticated Google GenAI client instance.
 * @param {string} [customApiKey] - Optional per-request API key override
 * @returns {GoogleGenAI}
 */
export const getGeminiClient = (customApiKey) => {
  const key = customApiKey || env.GEMINI_API_KEY;
  if (!key) {
    throw new AppError('Google Gemini API Key is required for clip generation', 400, 'GEMINI_KEY_MISSING');
  }
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Prepares base64 payload and MIME type for multimodal audio processing.
 * @param {string} audioFilePath - Local path to audio file
 * @returns {{ mimeType: string, data: string }}
 */
export const prepareAudioPayload = (audioFilePath) => {
  if (!fs.existsSync(audioFilePath)) {
    throw new AppError(`Audio file not found at: ${audioFilePath}`, 404, 'AUDIO_NOT_FOUND');
  }

  const audioBuffer = fs.readFileSync(audioFilePath);
  const mimeType = audioFilePath.toLowerCase().endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';
  return {
    mimeType,
    data: audioBuffer.toString('base64'),
  };
};

/**
 * Executes Gemini content generation across candidate models with automatic retry on transient errors.
 * @param {GoogleGenAI} ai - Initialized GoogleGenAI client
 * @param {Array} contents - Request contents array
 * @param {string} [operationName='Gemini'] - Context name for logging
 * @returns {Promise<string>} Raw text response from the first succeeding model
 */
export const executeWithModelFallback = async (ai, contents, operationName = 'Gemini') => {
  let lastError = null;

  for (const modelName of AI_CONFIG.CANDIDATE_MODELS) {
    logger.info(`[ClipsUtils:${operationName}] Attempting model: ${modelName}`);

    for (let attempt = 1; attempt <= AI_CONFIG.RETRY.MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents,
        });

        if (res?.text) {
          logger.info(`[ClipsUtils:${operationName}] Received response from ${modelName} on attempt ${attempt} (${res.text.length} chars)`);
          return res.text;
        }
      } catch (err) {
        lastError = err;
        const isTransient = /503|429|demand|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(err.message);
        logger.warn(`[ClipsUtils:${operationName}] Model ${modelName} attempt ${attempt} error: ${err.message}`);

        if (isTransient && attempt === 1) {
          logger.info(`[ClipsUtils:${operationName}] Transient spike detected on ${modelName}, backing off for ${AI_CONFIG.RETRY.TRANSIENT_BACKOFF_MS}ms...`);
          await new Promise((resolve) => setTimeout(resolve, AI_CONFIG.RETRY.TRANSIENT_BACKOFF_MS));
        } else {
          break; // Try next candidate model
        }
      }
    }
  }

  throw new Error(lastError ? lastError.message : `All candidate Gemini models failed for ${operationName}`);
};

/**
 * Resolves viral title and social description with fallback defaults.
 * @param {object} params
 * @param {object|null} params.parsed
 * @param {string} [params.title]
 * @param {string} params.candidateTopic
 * @returns {{ title: string, description: string }}
 */
export const resolveCopyFallback = ({ parsed, title, candidateTopic }) => {
  const fallbackTitle = title || `${candidateTopic} 😱`;
  const fallbackDesc = `${candidateTopic}! What would you do? Let us know in the comments! 👇\n\n#shorts #viral #trending #reels #fyp`;

  return {
    title: parsed?.title || parsed?.youtube_title || parsed?.shorts_title || fallbackTitle,
    description:
      parsed?.description ||
      parsed?.caption ||
      parsed?.desc ||
      parsed?.short_description ||
      parsed?.tiktok_description ||
      fallbackDesc,
  };
};

