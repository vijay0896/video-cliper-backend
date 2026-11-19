/**
 * @file src/modules/clips/clips.prompts.js
 * @description Specialized prompt builders for viral moment detection and social copywriting.
 */

/**
 * Builds the multimodal prompt for viral moment detection from audio analysis.
 *
 * @param {object} params
 * @param {number} params.totalDuration - Total video duration in seconds
 * @param {number} [params.targetClips=3] - Number of viral moments to identify
 * @param {number} [params.minSeconds=15] - Minimum clip duration
 * @param {number} [params.maxSeconds=60] - Maximum clip duration
 * @returns {string} Fully formulated LLM prompt
 */
export const buildMomentsDetectionPrompt = ({
  totalDuration,
  targetClips = 3,
  minSeconds = 15,
  maxSeconds = 45,
}) => `
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
    "youtube_title": "Catchy YouTube Shorts Title with emoji (under 55 chars)",
    "description": "Engaging 2-3 line viral caption with trending hashtags (e.g. #shorts #viral #fyp #reels)",
    "score": 9.2,
    "reason": "Why this moment will perform well on social media",
    "captions": [
      { "text": "word", "startMs": 12500, "endMs": 12800 }
    ]
  }
]
Do not wrap in markdown or backticks. Return raw JSON array only.
`;

/**
 * Builds the prompt for generating viral social media copy and hashtags.
 *
 * @param {object} params
 * @param {string} params.candidateTopic - Extracted hook or context topic
 * @param {string} [params.title] - Current title if available
 * @returns {string} Formatted prompt string
 */
export const buildCopyGenerationPrompt = ({ candidateTopic, title }) => `
You are a viral social media strategist specializing in YouTube Shorts, TikTok, and Instagram Reels.
Generate a high-converting, viral title and a punchy short-version description with hashtags for this video clip:

Context / Hook: "${candidateTopic}"
Current Title: "${title || candidateTopic}"

Requirements:
1. "title": High CTR, curiosity-inducing YouTube Shorts title (under 55 characters) with 1-2 relevant emojis. Do not make it cheesy; make it punchy and viral.
2. "description": An engaging 2-3 line short-version description for TikTok/Instagram/Shorts that encourages comments or shares, followed by 4-6 high-traffic relevant hashtags (e.g. #shorts #viral #reels #fyp #trending).

Respond ONLY with valid JSON matching this schema:
{
  "title": "...",
  "description": "..."
}
Do not include markdown or code block wrappers.
`;
