import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { env } from '../../config/env.js';

export class ClipsService {
  /**
   * Initialize Gemini client with provided or env API key
   * @param {string} [customApiKey]
   */
  static getClient(customApiKey) {
    const key = customApiKey || env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError('Google Gemini API Key is required for clip generation', 400, 'GEMINI_KEY_MISSING');
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Transcribe and detect viral moments directly from audio file using Gemini Multimodal
   * @param {string} audioFilePath - Path to extracted audio file
   * @param {number} totalDuration - Total video duration in seconds
   * @param {object} options - Options like target_clips, min_seconds, max_seconds
   * @param {string} [customApiKey]
   */
  static async analyzeAndPickMoments(audioFilePath, totalDuration, options = {}, customApiKey) {
    const ai = this.getClient(customApiKey);
    logger.info(`[ClipsService] Analyzing audio with Google Gemini: ${audioFilePath}`);

    try {
      // 1. Read audio buffer and convert to base64
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioBase64 = audioBuffer.toString('base64');

      const targetClips = options.target_clips || 3;
      const minSeconds = options.clip_min_seconds || 15;
      const maxSeconds = options.clip_max_seconds || 60;

      const prompt = `
You are an expert viral video editor specializing in TikTok, Instagram Reels, and YouTube Shorts.
Analyze this audio recording of a video that is ${Math.round(totalDuration)} seconds long.

Your goal is to detect the top ${targetClips} most engaging, viral moments.
Criteria for viral moments:
- Strong opening hook within the first 3 seconds
- High energy, contrarian statement, emotional resonance, or valuable insight
- Clean standalone narrative (makes sense without watching the rest of the video)
- Duration must be strictly between ${minSeconds} and ${maxSeconds} seconds

Respond ONLY with a valid JSON array of clip objects matching this schema:
[
  {
    "start": 12.5,
    "end": 45.0,
    "title": "Catchy YouTube Shorts Title",
    "hook": "Punchy overall context text for this clip (3 to 6 words with 1 relevant emoji, e.g. 'First shark attack 💀', 'Bro thought he was safe 😂', 'The $10M mistake 💸', 'Never do this in public ❌'). This text is overlaid at the top of the video so viewers immediately understand the context of the reel.",
    "score": 9.2,
    "reason": "Why this moment will perform well on social media",
    "captions": [
      { "text": "word", "startMs": 12500, "endMs": 12800 }
    ]
  }
]
Do not wrap in markdown or backticks. Return raw JSON array only.
`;

      const candidateModels = [
        env.GEMINI_MODEL,
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
      ].filter(Boolean);
      const uniqueModels = [...new Set(candidateModels)];

      let responseText = null;
      let lastError = null;

      for (const modelName of uniqueModels) {
        logger.info(`[ClipsService] Attempting Gemini model: ${modelName}`);

        // Try model with 1 retry for transient spikes (503/429)
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const res = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/wav',
                        data: audioBase64,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
            });

            if (res && res.text) {
              responseText = res.text;
              logger.info(`[ClipsService] Successfully received response from ${modelName} on attempt ${attempt} (${responseText.length} chars)`);
              break;
            }
          } catch (modelErr) {
            lastError = modelErr;
            const isTransient = /503|429|demand|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(modelErr.message);
            logger.warn(`[ClipsService] Model ${modelName} attempt ${attempt} failed: ${modelErr.message}`);

            if (isTransient && attempt === 1) {
              logger.info(`[ClipsService] Transient error detected on ${modelName}, waiting 2s before retry...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } else {
              break; // move to next candidate model
            }
          }
        }

        if (responseText) break;
      }

      if (!responseText) {
        throw new Error(lastError ? lastError.message : 'All candidate Gemini models failed to generate clips');
      }

      // Robust JSON extraction (strip markdown wrappers or surrounding text)
      let cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const moments = JSON.parse(cleaned);

      if (!Array.isArray(moments) || moments.length === 0) {
        throw new Error('Gemini returned an empty or invalid clips array');
      }

      return moments;
    } catch (err) {
      logger.error(`[ClipsService] Error in Gemini clip detection: ${err.message}`);
      throw new AppError(`Clip detection failed: ${err.message}`, 500, 'GEMINI_DETECTION_ERROR');
    }
  }
}

