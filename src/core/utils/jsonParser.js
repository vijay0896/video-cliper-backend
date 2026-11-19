/**
 * @file src/core/utils/jsonParser.js
 * @description Safe JSON extraction and parsing utility for LLM/Gemini responses
 */

/**
 * Safely extracts and parses JSON from raw LLM text output.
 * Handles markdown code fences (```json ... ```), preamble commentary,
 * trailing text, and malformed wrapper characters.
 *
 * @template T
 * @param {string} rawText - Raw output string from LLM
 * @param {T} [fallback=null] - Default value returned if parsing fails
 * @returns {T} Parsed JSON object, array, or fallback
 */
export const parseLlmJson = (rawText, fallback = null) => {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  try {
    // 1. Strip markdown fences and whitespace
    let cleaned = rawText
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    // 2. Extract balanced JSON Array or Object if wrapped by commentary
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      cleaned = arrayMatch[0];
    } else if (objectMatch) {
      cleaned = objectMatch[0];
    }

    const parsed = JSON.parse(cleaned);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
};

