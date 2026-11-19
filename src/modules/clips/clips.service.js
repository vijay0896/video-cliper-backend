/**
 * @file src/modules/clips/clips.service.js
 * @description Domain service for viral moment detection, audio transcription,
 * and social media copy generation using Google Gemini Multimodal models.
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AI_CONFIG } from '../../config/ai.js';
import { AppError } from '../../core/utils/appError.js';
import { parseLlmJson } from '../../core/utils/jsonParser.js';
import {
  buildMomentsDetectionPrompt,
  buildCopyGenerationPrompt,
} from './clips.prompts.js';

export class ClipsService {
  /**
   * Initializes and returns an authenticated Google GenAI client instance.
   * @param {string} [customApiKey] - Optional per-request API key override
   * @returns {GoogleGenAI}
   */
  static getClient(customApiKey) {
    const key = customApiKey || env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError('Google Gemini API Key is required for clip generation', 400, 'GEMINI_KEY_MISSING');
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Helper: Prepares base64 payload and MIME type for multimodal audio processing.
   * @private
   * @param {string} audioFilePath - Local path to audio file
   * @returns {{ mimeType: string, data: string }}
   */
  static prepareAudioPayload(audioFilePath) {
    if (!fs.existsSync(audioFilePath)) {
      throw new AppError(`Audio file not found at: ${audioFilePath}`, 404, 'AUDIO_NOT_FOUND');
    }

    const audioBuffer = fs.readFileSync(audioFilePath);
    const mimeType = audioFilePath.toLowerCase().endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';
    return {
      mimeType,
      data: audioBuffer.toString('base64'),
    };
  }

  /**
   * Helper: Executes Gemini content generation across candidate models with automatic retry on transient errors.
   * @private
   * @param {GoogleGenAI} ai - Initialized GoogleGenAI client
   * @param {Array} contents - Request contents array
   * @param {string} operationName - Logging context name
   * @returns {Promise<string>} Raw text response from the first succeeding model
   */
  static async executeWithModelFallback(ai, contents, operationName = 'Gemini') {
    let lastError = null;

    for (const modelName of AI_CONFIG.CANDIDATE_MODELS) {
      logger.info(`[ClipsService:${operationName}] Attempting model: ${modelName}`);

      for (let attempt = 1; attempt <= AI_CONFIG.RETRY.MAX_ATTEMPTS_PER_MODEL; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents,
          });

          if (res?.text) {
            logger.info(`[ClipsService:${operationName}] Received response from ${modelName} on attempt ${attempt} (${res.text.length} chars)`);
            return res.text;
          }
        } catch (err) {
          lastError = err;
          const isTransient = /503|429|demand|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(err.message);
          logger.warn(`[ClipsService:${operationName}] Model ${modelName} attempt ${attempt} error: ${err.message}`);

          if (isTransient && attempt === 1) {
            logger.info(`[ClipsService:${operationName}] Transient spike detected on ${modelName}, backing off for ${AI_CONFIG.RETRY.TRANSIENT_BACKOFF_MS}ms...`);
            await new Promise((resolve) => setTimeout(resolve, AI_CONFIG.RETRY.TRANSIENT_BACKOFF_MS));
          } else {
            break; // Try next candidate model
          }
        }
      }
    }

    throw new Error(lastError ? lastError.message : `All candidate Gemini models failed for ${operationName}`);
  }

  /**
   * Analyzes an audio stream to transcribe and detect the top viral moments.
   * @param {string} audioFilePath - Path to extracted audio file
   * @param {number} totalDuration - Total video duration in seconds
   * @param {object} [options] - Ingestion constraints and user preferences
   * @param {string} [customApiKey] - Optional per-request API key override
   * @returns {Promise<Array<object>>} Array of detected viral clip descriptors
   */
  static async analyzeAndPickMoments(audioFilePath, totalDuration, options = {}, customApiKey) {
    const ai = this.getClient(customApiKey);
    logger.info(`[ClipsService] Analyzing audio with Google Gemini: ${audioFilePath}`);

    try {
      const audioPayload = this.prepareAudioPayload(audioFilePath);
      const prompt = buildMomentsDetectionPrompt({
        totalDuration,
        targetClips: options.target_clips || 3,
        minSeconds: options.clip_min_seconds || 15,
        maxSeconds: options.clip_max_seconds || 60,
      });

      const contents = [
        {
          role: 'user',
          parts: [
            { inlineData: audioPayload },
            { text: prompt },
          ],
        },
      ];

      const responseText = await this.executeWithModelFallback(ai, contents, 'MomentsDetection');
      const moments = parseLlmJson(responseText, []);

      if (!Array.isArray(moments) || moments.length === 0) {
        throw new Error('Gemini returned an empty or invalid clips array');
      }

      return moments;
    } catch (err) {
      logger.error(`[ClipsService] Error in Gemini clip detection: ${err.message}`);
      throw new AppError(`Clip detection failed: ${err.message}`, 500, 'GEMINI_DETECTION_ERROR');
    }
  }

  /**
   * Generates viral titles and short-form descriptions with hashtags on demand.
   * @param {object} params
   * @param {string} [params.title]
   * @param {string} [params.hook]
   * @param {string} [params.context]
   * @param {string} [customApiKey] - Optional per-request API key override
   * @returns {Promise<{ title: string, description: string }>}
   */
  static async generateCopy({ title, hook, context } = {}, customApiKey) {
    const ai = this.getClient(customApiKey);
    const candidateTopic = hook || title || context || 'Trending Viral Video';

    const prompt = buildCopyGenerationPrompt({ candidateTopic, title });
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    let parsed = null;

    try {
      const responseText = await this.executeWithModelFallback(ai, contents, 'CopyGeneration');
      parsed = parseLlmJson(responseText, null);
    } catch (err) {
      logger.warn(`[ClipsService:CopyGeneration] Fallback execution failed: ${err.message}`);
    }

    // Default high-converting fallbacks if LLM fails or response is malformed
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
  }
}
