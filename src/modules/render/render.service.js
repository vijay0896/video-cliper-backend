import { execa } from 'execa';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';

export class RenderService {
  /**
   * Cut and render a 9:16 vertical clip with blurred background
   * @param {string} sourceVideoPath - Input source video
   * @param {number} startSec - Start timestamp in seconds
   * @param {number} endSec - End timestamp in seconds
   * @param {string} outputDir - Directory to save rendered clip
   * @param {object} [options] - Options like hook text
   * @returns {Promise<string>} Path to rendered vertical clip
   */
  static async renderVerticalClip(sourceVideoPath, startSec, endSec, outputDir, options = {}) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const clipId = uuidv4();
    const outputPath = path.join(outputDir, `clip_${clipId}.mp4`);
    const duration = endSec - startSec;

    logger.info(`[RenderService] Rendering 9:16 vertical clip: ${startSec}s to ${endSec}s (${duration.toFixed(1)}s)`);

    // High quality 9:16 blurred background layout filtergraph:
    // 1. Background: scaled up to 1080x1920, cropped and blurred
    // 2. Foreground: original video scaled to 1080 width, centered
    const filterGraph = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]`,
      `[0:v]scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`,
    ].join(';');

    const ffmpegArgs = [
      '-y',
      '-ss', startSec.toString(),
      '-t', duration.toString(),
      '-i', sourceVideoPath,
      '-filter_complex', filterGraph,
      '-map', '[outv]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    try {
      await execa('ffmpeg', ffmpegArgs);
      logger.info(`[RenderService] Successfully rendered clip at: ${outputPath}`);
      return outputPath;
    } catch (err) {
      logger.error(`[RenderService] FFmpeg rendering error: ${err.message}`);
      throw new AppError(`Failed to render clip: ${err.message}`, 500, 'RENDER_ERROR');
    }
  }
}

