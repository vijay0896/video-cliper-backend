/**
 * Prompt templates for YouTube thumbnail, title generation, and SEO copy.
 */

/**
 * Builds prompt to analyze video topic/title and generate 10 viral YouTube titles and thumbnail hooks.
 * @param {string} title
 * @returns {string}
 */
export const buildVideoAnalysisPrompt = (title) => `
You are a world-class YouTube strategist (think MrBeast & Colin and Samir style) who specializes in high CTR titles and thumbnail packaging.
Analyze this video: "${title}"

Generate:
1. "titles": 10 viral YouTube titles. Criteria:
   - High curiosity gap (make it impossible not to click)
   - Under 60 characters (so it doesn't get truncated on mobile)
   - Use numbers, extreme words, or relatable pain/curiosity points.
2. "thumbnail_texts": 10 paired bold hook words (2 to 4 words max in ALL CAPS) designed specifically to be placed on the thumbnail image (e.g. "HE REGRETS THIS", "LOST $50,000", "DO NOT DO THIS", "IT'S OVER").
3. "recommended": Array of 2 to 3 top recommended picks with their 0-based index and why it will get clicks (e.g. [{"index": 0, "reason": "Massive curiosity gap"}]).
4. "context": A 2-sentence summary of the video's core appeal.

Respond ONLY with valid JSON matching this schema:
{
  "titles": ["Title 1", "Title 2", ...],
  "thumbnail_texts": ["TEXT 1", "TEXT 2", ...],
  "recommended": [{"index": 0, "reason": "..."}],
  "context": "..."
}
`;

/**
 * Builds prompt for interactive title refinement based on user feedback.
 * @param {object} params
 * @param {string} params.title
 * @param {string[]} [params.currentTitles]
 * @param {string} params.message
 * @returns {string}
 */
export const buildTitleRefinementPrompt = ({ title, currentTitles = [], message }) => `
You are a YouTube viral title consultant.
Current Title Context: "${title}"
Previous Suggestions: ${JSON.stringify(currentTitles)}
User Feedback: "${message}"

Refine and generate 10 new improved YouTube titles taking the user's feedback into account.
Also generate 10 matching 2-4 word thumbnail hook texts in ALL CAPS.

Respond ONLY with valid JSON:
{
  "titles": ["Title 1", ...],
  "thumbnail_texts": ["HOOK 1", ...],
  "language": "en"
}
`;

/**
 * Builds prompt for generating full SEO-optimized YouTube descriptions.
 * @param {string} title
 * @param {string} [context]
 * @returns {string}
 */
export const buildDescriptionPrompt = (title, context = '') => `
You are an expert YouTube SEO copywriter.
Generate a comprehensive, high-ranking YouTube description for a video titled: "${title}".
Video Context: "${context || title}"

Requirements:
1. Opening Hook: 2 engaging lines that hook the audience before the 'Show More' fold.
2. What You'll Learn / Overview: 3-4 bullet points summarizing the core value.
3. Video Chapters (Timestamps): Realistic timestamp breakdown starting at 00:00 (e.g. 00:00 Intro, 01:25 The Key Discovery, etc.).
4. Call to Action: Friendly prompt to Like, Subscribe, and share thoughts in comments.
5. Hashtags: 5-8 relevant, high-traffic YouTube hashtags at the bottom.

Return the formatted description ready for copy-pasting. Do not wrap in markdown json blocks.
`;

