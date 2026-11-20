/**
 * @file src/modules/clips/clips.service.js
 * @description Domain service for viral moment detection, audio transcription,
 * and social media copy generation using Google Gemini Multimodal models.
 */
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { parseLlmJson } from '../../core/utils/jsonParser.js';
import {
  buildMomentsDetectionPrompt,
  buildCopyGenerationPrompt,
} from './clips.prompts.js';
import {
  getGeminiClient,
  prepareAudioPayload,
  executeWithModelFallback,
  resolveCopyFallback,
} from './clips.utils.js';

export class ClipsService {
  /**
   * Initializes and returns an authenticated Google GenAI client instance.
   * (Maintained for backward-compatibility)
   * @param {string} [customApiKey] - Optional per-request API key override
   * @returns {import('@google/genai').GoogleGenAI}
   */
  static getClient(customApiKey) {
    return getGeminiClient(customApiKey);
  }

  /**
   * Helper: Prepares base64 payload and MIME type for multimodal audio processing.
   * (Maintained for backward-compatibility)
   * @param {string} audioFilePath - Local path to audio file
   * @returns {{ mimeType: string, data: string }}
   */
  static prepareAudioPayload(audioFilePath) {
    return prepareAudioPayload(audioFilePath);
  }

  /**
   * Helper: Executes Gemini content generation across candidate models with automatic retry.
   * (Maintained for backward-compatibility)
   * @param {import('@google/genai').GoogleGenAI} ai - Initialized client
   * @param {Array} contents - Request contents array
   * @param {string} [operationName] - Logging context name
   * @returns {Promise<string>}
   */
  static async executeWithModelFallback(ai, contents, operationName = 'Gemini') {
    return executeWithModelFallback(ai, contents, operationName);
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
    const ai = getGeminiClient(customApiKey);
    logger.info(`[ClipsService] Analyzing audio with Google Gemini: ${audioFilePath}`);

    try {
      const audioPayload = prepareAudioPayload(audioFilePath);
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

      const responseText = await executeWithModelFallback(ai, contents, 'MomentsDetection');
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
   * @param {object} [params]
   * @param {string} [params.title]
   * @param {string} [params.hook]
   * @param {string} [params.context]
   * @param {string} [customApiKey] - Optional per-request API key override
   * @returns {Promise<{ title: string, description: string }>}
   */
  static async generateCopy({ title, hook, context } = {}, customApiKey) {
    const ai = getGeminiClient(customApiKey);
    const candidateTopic = hook || title || context || 'Trending Viral Video';

    const prompt = buildCopyGenerationPrompt({ candidateTopic, title });
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    let parsed = null;

    try {
      const responseText = await executeWithModelFallback(ai, contents, 'CopyGeneration');
      parsed = parseLlmJson(responseText, null);
    } catch (err) {
      logger.warn(`[ClipsService:CopyGeneration] Fallback execution failed: ${err.message}`);
    }

    return resolveCopyFallback({ parsed, title, candidateTopic });
  }
}
