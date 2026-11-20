import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { execa } from 'execa';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { MediaService } from '../media/media.service.js';

/**
 * Thumbnail module utilities & helper functions.
 */

// Multer storage configuration for thumbnail assets
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = env.UPLOAD_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const thumbnailUpload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max
});

export const generateThumbnailUpload = thumbnailUpload.fields([
  { name: 'face', maxCount: 1 },
  { name: 'background', maxCount: 1 },
]);

/**
 * Extract Gemini API Key from request headers or body.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export const extractGeminiKey = (req) => {
  return req.headers['x-gemini-key'] || req.body?.geminiApiKey || null;
};

/**
 * Ensures session thumbnail directory exists.
 * @param {string} sessionId
 * @returns {string} Absolute directory path
 */
export const getSessionDir = (sessionId) => {
  const dir = path.join(env.OUTPUT_DIR, 'thumbnails', sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Extract candidate frames across the video using FFmpeg.
 * @param {string} videoPath
 * @param {string} sessionDir
 * @param {number} [count=5]
 * @returns {Promise<Array<{ url: string, time: number }>>}
 */
export const extractCandidateFrames = async (videoPath, sessionDir, count = 5) => {
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
    logger.warn(`[ThumbnailUtils] Frame extraction warning: ${err.message}`);
  }
  return frames;
};

/**
 * Extract hook words from title for bold visual pill.
 * @param {string} title
 * @param {number} [maxWords=4]
 * @returns {string}
 */
export const extractHookWords = (title = '', maxWords = 4) => {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ').toUpperCase();
};

/**
 * Generate 1280x720 SVG overlay markup.
 * @param {object} params
 * @param {string} params.accentColor
 * @param {string} params.variantText
 * @returns {string}
 */
export const generateOverlaySvg = ({ accentColor, variantText }) => `<?xml version="1.0" encoding="UTF-8"?>
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

/**
 * Resolves rsvg-convert binary location.
 * @returns {string}
 */
const getRsvgBinary = () => {
  if (fs.existsSync('/opt/homebrew/bin/rsvg-convert')) {
    return '/opt/homebrew/bin/rsvg-convert';
  }
  return 'rsvg-convert';
};

/**
 * Render thumbnail image with styled SVG overlay using FFmpeg & rsvg-convert.
 * @param {object} params
 * @param {string} [params.baseFramePath]
 * @param {string} params.sessionDir
 * @param {string} params.outPath
 * @param {string} params.accentColor
 * @param {string} params.variantText
 * @param {number} params.index
 * @returns {Promise<boolean>}
 */
export const renderThumbnailWithOverlay = async ({
  baseFramePath,
  sessionDir,
  outPath,
  accentColor,
  variantText,
  index,
}) => {
  const svgPath = path.join(sessionDir, `overlay_${index}.svg`);
  const pngPath = `${svgPath}.png`;

  try {
    const svgContent = generateOverlaySvg({ accentColor, variantText });
    fs.writeFileSync(svgPath, svgContent, 'utf-8');

    // Rasterize SVG to 1280x720 PNG with true alpha transparency
    const rsvgBin = getRsvgBinary();
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

    return fs.existsSync(outPath);
  } catch (err) {
    logger.warn(`[ThumbnailUtils] Thumbnail render error for index ${index}: ${err.message}`);
    return false;
  } finally {
    if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
  }
};

/**
 * Returns default fallback analysis object if AI extraction fails.
 * @param {string} title
 * @returns {object}
 */
export const getDefaultAnalysis = (title) => ({
  titles: [
    `I Can't Believe This Happened (${title})`,
    `The Untold Truth About ${title}`,
    `Why Everyone Is Talking About ${title}`,
    `Watch This Before It's Too Late!`,
    `The Biggest Mistake in ${title}`,
    `I Tested ${title} for 24 Hours`,
    `This Changes Everything...`,
    `10 Insane Secrets of ${title}`,
    `How I Solved the ${title} Problem`,
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
  context: `${title} overview and viral analysis.`,
});

/**
 * Returns default fallback description if AI generation fails.
 * @param {string} title
 * @returns {string}
 */
export const getDefaultDescription = (title) => {
  return `${title}\n\nIn this video, we break down everything you need to know about ${title}! Make sure to watch until the very end.\n\n📌 Timestamps:\n00:00 - Introduction\n01:10 - The Core Strategy\n03:45 - Key Examples & Walkthrough\n06:20 - Summary & Next Steps\n\n💬 Let us know your thoughts in the comments below!\n👍 Like and Subscribe for more content!\n\n#youtube #trending #viral #guide`;
};

