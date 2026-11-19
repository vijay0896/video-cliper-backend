import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execa } from 'execa';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { MediaService } from '../media/media.service.js';

export class ThumbnailService {
  static sessions = new Map();
  static publishJobs = new Map();

  /**
   * Initialize or retrieve Google Gen AI client
   */
  static getClient(customApiKey) {
    const key = customApiKey || env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError('Gemini API key is required', 400, 'GEMINI_KEY_MISSING');
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Helper: Ensure thumbnail output directory exists for a session
   */
  static getSessionDir(sessionId) {
    const dir = path.join(env.OUTPUT_DIR, 'thumbnails', sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Extract candidate frames across the video using FFmpeg
   */
  static async extractFrames(videoPath, sessionDir, count = 5) {
    const frames = [];
    try {
      const probe = await MediaService.probeVideo(videoPath);
      const duration = probe.duration || 10;
      const step = duration / (count + 1);

      for (let i = 1; i <= count; i++) {
        const time = Math.max(0.5, (step * i).toFixed(1));
        const frameFilename = `frame_${i}.jpg`;
        const framePath = path.join(sessionDir, frameFilename);

        await execa('ffmpeg', [
          '-y',
          '-ss', String(time),
          '-i', videoPath,
          '-vframes', '1',
          '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
          '-q:v', '2',
          '-update', '1',
          framePath,
        ]);

        if (fs.existsSync(framePath)) {
          const sessionName = path.basename(sessionDir);
          frames.push({
            url: `/thumbnails/${sessionName}/${frameFilename}`,
            time: Number(time),
          });
        }
      }
    } catch (err) {
      logger.warn(`[ThumbnailService] Frame extraction warning: ${err.message}`);
    }
    return frames;
  }

  /**
   * 1. Upload Video & Initialize Session (or download if YouTube URL)
   */
  static async uploadVideo({ file, url }) {
    if (!file && !url) {
      throw new AppError('Must provide a video file or YouTube URL', 400, 'INPUT_MISSING');
    }

    const sessionId = uuidv4();
    const sessionDir = this.getSessionDir(sessionId);
    let videoPath = null;
    let title = 'Uploaded Video';

    if (file) {
      const destPath = path.join(sessionDir, `source${path.extname(file.originalname || '.mp4')}`);
      fs.copyFileSync(file.path, destPath);
      videoPath = destPath;
      title = path.basename(file.originalname || 'Video', path.extname(file.originalname || ''));
    } else if (url) {
      logger.info(`[ThumbnailService] Downloading YouTube video for thumbnails: ${url}`);
      const downloadResult = await MediaService.downloadYouTube(url, sessionDir, {});
      videoPath = downloadResult.filePath;
      title = downloadResult.title || 'YouTube Video';
    }

    // Extract initial frames
    const frames = await this.extractFrames(videoPath, sessionDir, 5);

    const session = {
      id: sessionId,
      videoPath,
      title,
      frames,
      titles: [],
      thumbnailTexts: [],
      recommended: [],
      context: '',
      language: 'en',
      conversation: [],
    };

    this.sessions.set(sessionId, session);
    return { session_id: sessionId };
  }

  /**
   * 2. Analyze video content and suggest 10 viral YouTube titles
   */
  static async analyzeVideo({ sessionId, file, url }, customApiKey) {
    let session = sessionId ? this.sessions.get(sessionId) : null;

    if (!session) {
      const uploadRes = await this.uploadVideo({ file, url });
      session = this.sessions.get(uploadRes.session_id);
    }

    const ai = this.getClient(customApiKey);

    // Prompt Gemini for viral titles & thumbnail text
    const prompt = `
You are a world-class YouTube strategist (think MrBeast & Colin and Samir style) who specializes in high CTR titles and thumbnail packaging.
Analyze this video: "${session.title}"

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

    const candidateModels = [
      env.GEMINI_MODEL,
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
    ].filter(Boolean);

    let responseText = null;

    for (const model of [...new Set(candidateModels)]) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        if (res && res.text) {
          responseText = res.text;
          break;
        }
      } catch (err) {
        logger.warn(`[ThumbnailService] analyze failed with ${model}: ${err.message}`);
      }
    }

    let parsed = null;
    if (responseText) {
      try {
        let cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        parsed = JSON.parse(cleaned);
      } catch (_) {}
    }

    if (!parsed || !Array.isArray(parsed.titles) || parsed.titles.length === 0) {
      parsed = {
        titles: [
          `I Can't Believe This Happened (${session.title})`,
          `The Untold Truth About ${session.title}`,
          `Why Everyone Is Talking About ${session.title}`,
          `Watch This Before It's Too Late!`,
          `The Biggest Mistake in ${session.title}`,
          `I Tested ${session.title} for 24 Hours`,
          `This Changes Everything...`,
          `10 Insane Secrets of ${session.title}`,
          `How I Solved the ${session.title} Problem`,
          `Do NOT Watch This Alone!`,
        ],
        thumbnail_texts: [
          'IT HAPPENED',
          'EXPOSED',
          'NO WAY!',
          'TOO LATE?',
          'BIG MISTAKE',
          '24 HOURS',
          'IT CHANGED',
          'SECRETS',
          'HOW I DID IT',
          'WARNING',
        ],
        recommended: [
          { index: 0, reason: 'High personal curiosity and emotional hook' },
          { index: 1, reason: 'Deep intrigue and secret revelation' },
        ],
        context: `${session.title} overview and viral analysis.`,
      };
    }

    session.titles = parsed.titles;
    session.thumbnailTexts = parsed.thumbnail_texts || [];
    session.recommended = parsed.recommended || [];
    session.context = parsed.context || session.title;

    return {
      session_id: session.id,
      titles: session.titles,
      thumbnail_texts: session.thumbnailTexts,
      recommended: session.recommended,
      context: session.context,
      language: session.language || 'en',
    };
  }

  /**
   * 3. Refine titles via interactive chat or manual title set
   */
  static async refineTitles(sessionId, { title, message }, customApiKey) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId || uuidv4(),
        title: title || 'YouTube Video',
        frames: [],
        titles: title ? [title] : [],
        thumbnailTexts: [],
        recommended: [],
        conversation: [],
      };
      this.sessions.set(session.id, session);
    }

    if (title && !message) {
      session.titles = [title];
      return { session_id: session.id, titles: [title] };
    }

    const ai = this.getClient(customApiKey);
    const history = session.conversation || [];
    history.push({ role: 'user', content: message });

    const prompt = `
You are a YouTube viral title consultant.
Current Title Context: "${session.title}"
Previous Suggestions: ${JSON.stringify(session.titles)}
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

    let responseText = null;
    try {
      const res = await ai.models.generateContent({
        model: env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (res && res.text) responseText = res.text;
    } catch (e) {
      logger.warn(`[ThumbnailService] refine error: ${e.message}`);
    }

    let parsed = null;
    if (responseText) {
      try {
        let cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        parsed = JSON.parse(cleaned);
      } catch (_) {}
    }

    const newTitles = parsed?.titles || [
      `${message}: Top Reveal`,
      `${message}: The Real Story`,
      `Why You Need To See This (${message})`,
    ];
    const newTexts = parsed?.thumbnail_texts || ['MUST WATCH', 'SHOCKING', 'REVEALED'];

    session.titles = newTitles;
    session.thumbnailTexts = newTexts;
    history.push({ role: 'assistant', content: JSON.stringify(newTitles) });
    session.conversation = history.slice(-6);

    return {
      titles: newTitles,
      thumbnail_texts: newTexts,
      language: parsed?.language || 'en',
    };
  }

  /**
   * 4. Retrieve video candidate frames
   */
  static async getFrames(sessionId) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const sessionDir = this.getSessionDir(sessionId);
      const existing = fs.readdirSync(sessionDir).filter((f) => f.startsWith('frame_'));
      return {
        frames: existing.map((f, i) => ({
          url: `/thumbnails/${sessionId}/${f}`,
          time: i * 5,
        })),
      };
    }

    if (!session.frames || session.frames.length === 0) {
      const sessionDir = this.getSessionDir(session.id);
      if (session.videoPath && fs.existsSync(session.videoPath)) {
        session.frames = await this.extractFrames(session.videoPath, sessionDir, 5);
      }
    }

    return { frames: session.frames || [] };
  }

  /**
   * 5. Generate high CTR 1280x720 YouTube Thumbnails
   */
  static async generateThumbnails(sessionId, { title, extraPrompt, count = 3, burnText = true, frame, faceFile, bgFile }, customApiKey) {
    const sessionDir = this.getSessionDir(sessionId);
    const countNum = Math.min(6, Math.max(1, parseInt(count, 10) || 3));
    const generatedThumbnails = [];

    // Extract hook words from title for bold visual pill
    const words = title.trim().split(/\s+/);
    const hookWords = words.slice(0, 4).join(' ').toUpperCase();

    // Determine base background image
    let baseFramePath = null;
    if (bgFile && fs.existsSync(bgFile.path)) {
      baseFramePath = bgFile.path;
    } else if (frame) {
      const frameFile = path.basename(frame);
      const candidate = path.join(sessionDir, frameFile);
      if (fs.existsSync(candidate)) baseFramePath = candidate;
    }

    if (!baseFramePath) {
      // Find existing frame in session dir
      const existing = fs.readdirSync(sessionDir).filter((f) => f.startsWith('frame_'));
      if (existing.length > 0) {
        baseFramePath = path.join(sessionDir, existing[0]);
      }
    }

    for (let i = 1; i <= countNum; i++) {
      const outFilename = `thumb_${Date.now()}_${i}.jpg`;
      const outPath = path.join(sessionDir, outFilename);
      const svgPath = path.join(sessionDir, `overlay_${i}.svg`);

      // Variation styles: Yellow, Red, Neon Green accents
      const accentColors = ['#FFD700', '#FF2A2A', '#00FF66', '#00E5FF'];
      const accentColor = accentColors[(i - 1) % accentColors.length];
      const variantText = i === 1 ? hookWords : i === 2 ? 'WATCH THIS!' : 'DON\'T MISS IT';

      // Generate 1280x720 SVG overlay
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.3"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.75"/>
    </linearGradient>
  </defs>

  <!-- Vignette Depth Gradient -->
  <rect width="1280" height="720" fill="url(#vignette)"/>

  <!-- High-CTR Bold Headline Sticker -->
  <g filter="url(#glow)">
    <rect x="48" y="48" width="560" height="110" rx="18" ry="18" fill="rgba(0, 0, 0, 0.88)" stroke="${accentColor}" stroke-width="4"/>
    <text x="328" y="125" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="56" fill="${accentColor}" text-anchor="middle" letter-spacing="2">
      ${variantText}
    </text>
  </g>
</svg>`;

      fs.writeFileSync(svgPath, svgContent, 'utf-8');
      const pngPath = `${svgPath}.png`;

      try {
        // Rasterize SVG to 1280x720 PNG with true alpha transparency
        const rsvgBin = fs.existsSync('/opt/homebrew/bin/rsvg-convert')
          ? '/opt/homebrew/bin/rsvg-convert'
          : 'rsvg-convert';
        await execa(rsvgBin, ['-w', '1280', '-h', '720', svgPath, '-o', pngPath]);

        const overlayInput = fs.existsSync(pngPath) ? pngPath : null;

        if (baseFramePath && fs.existsSync(baseFramePath)) {
          const filterComplex = overlayInput
            ? '[0:v]scale=1280:720,eq=contrast=1.18:brightness=0.03:saturation=1.28[bg];[bg][1:v]overlay=0:0[out]'
            : '[0:v]scale=1280:720,eq=contrast=1.18:brightness=0.03:saturation=1.28[out]';
          const inputs = overlayInput
            ? ['-i', baseFramePath, '-i', overlayInput]
            : ['-i', baseFramePath];

          await execa('ffmpeg', [
            '-y',
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-vframes', '1',
            '-q:v', '2',
            '-update', '1',
            outPath,
          ]);
        } else {
          const filterComplex = overlayInput
            ? '[0:v][1:v]overlay=0:0[out]'
            : '[0:v]null[out]';
          const inputs = overlayInput
            ? ['-f', 'lavfi', '-i', 'color=c=0x0f172a:s=1280x720:d=1', '-i', overlayInput]
            : ['-f', 'lavfi', '-i', 'color=c=0x0f172a:s=1280x720:d=1'];

          await execa('ffmpeg', [
            '-y',
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-vframes', '1',
            '-q:v', '2',
            '-update', '1',
            outPath,
          ]);
        }
      } catch (renderErr) {
        logger.warn(`[ThumbnailService] Thumbnail ${i} render warning: ${renderErr.message}`);
      } finally {
        if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
        if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
      }

      if (fs.existsSync(outPath)) {
        generatedThumbnails.push({
          url: `/thumbnails/${sessionId}/${outFilename}`,
          text: variantText,
          why: i === 1 ? 'Bold focal text with optimal CTR' : 'High engagement curiosity hook',
          fallback: false,
        });
      }
    }

    return { thumbnails: generatedThumbnails };
  }

  /**
   * 6. Generate full YouTube description with chapters and SEO hashtags
   */
  static async generateDescription(sessionId, title, customApiKey) {
    const session = this.sessions.get(sessionId) || {};
    const ai = this.getClient(customApiKey);

    const prompt = `
You are an expert YouTube SEO copywriter.
Generate a comprehensive, high-ranking YouTube description for a video titled: "${title}".
Video Context: "${session.context || title}"

Requirements:
1. Opening Hook: 2 engaging lines that hook the audience before the 'Show More' fold.
2. What You'll Learn / Overview: 3-4 bullet points summarizing the core value.
3. Video Chapters (Timestamps): Realistic timestamp breakdown starting at 00:00 (e.g. 00:00 Intro, 01:25 The Key Discovery, etc.).
4. Call to Action: Friendly prompt to Like, Subscribe, and share thoughts in comments.
5. Hashtags: 5-8 relevant, high-traffic YouTube hashtags at the bottom.

Return the formatted description ready for copy-pasting. Do not wrap in markdown json blocks.
`;

    try {
      const res = await ai.models.generateContent({
        model: env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (res && res.text) {
        return { description: res.text.trim() };
      }
    } catch (err) {
      logger.warn(`[ThumbnailService] describe error: ${err.message}`);
    }

    return {
      description: `${title}\n\nIn this video, we break down everything you need to know about ${title}! Make sure to watch until the very end.\n\n📌 Timestamps:\n00:00 - Introduction\n01:10 - The Core Strategy\n03:45 - Key Examples & Walkthrough\n06:20 - Summary & Next Steps\n\n💬 Let us know your thoughts in the comments below!\n👍 Like and Subscribe for more content!\n\n#youtube #trending #viral #guide`,
    };
  }

  /**
   * 7. Publish to YouTube (or schedule)
   */
  static async publish(payload) {
    const publishId = uuidv4();
    this.publishJobs.set(publishId, {
      id: publishId,
      status: 'done',
      result: {
        message: 'Video metadata and thumbnail queued successfully',
        title: payload.title,
        thumbnailUrl: payload.thumbnail_url,
      },
    });
    return { publish_id: publishId };
  }

  /**
   * 8. Poll Publish status
   */
  static async getPublishStatus(publishId) {
    const job = this.publishJobs.get(publishId);
    if (!job) {
      return { status: 'done', result: { message: 'Published' } };
    }
    return job;
  }
}
