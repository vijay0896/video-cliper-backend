import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execa } from 'execa';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { generateHookSvgMarkup } from './render.html.js';
import {
  createHookOverlayFile,
  rasterizeSvgToPng,
  getVideoEncoderArgs,
  buildVerticalFilterGraph,
  buildFfmpegRenderArgs,
  cleanupFiles,
} from './render.utils.js';

export class RenderService {
  /**
   * Helper: Generate a high-contrast SVG banner for the overall clip context / hook
   * Positioned just above the center video frame for optimal reel readability.
   * (Maintained for backward-compatibility)
   */
  static generateHookSvg(hookText, svgPath, videoTop = 656) {
    const svgContent = generateHookSvgMarkup(hookText, videoTop);
    fs.writeFileSync(svgPath, svgContent, 'utf-8');
    return svgPath;
  }

  /**
   * Rasterize SVG to 1080x1920 PNG with true alpha transparency using rsvg-convert
   * (Maintained for backward-compatibility)
   */
  static async rasterizeSvg(svgPath) {
    return rasterizeSvgToPng(svgPath, 1080, 1920);
  }

  /**
   * Cut and render a 9:16 vertical clip with hardware acceleration and optimized background blur
   * @param {string} sourceVideoPath - Input source video
   * @param {number} startSec - Start timestamp in seconds
   * @param {number} endSec - End timestamp in seconds
   * @param {string} outputDir - Directory to save rendered clip
   * @param {object} [options] - Options like hook text, title, videoTop
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

    // Generate hook context overlay if provided and rasterizer succeeds
    const hookText = options.hook || options.title;
    const { svgPath: hookSvgPath, pngPath: hookPngPath } = await createHookOverlayFile({
      hookText,
      outputDir,
      clipId,
      videoTop: options.videoTop,
    });

    // Prepare filter graph and platform-specific video encoder
    const hasHookOverlay = Boolean(hookPngPath && fs.existsSync(hookPngPath));
    const filterGraph = buildVerticalFilterGraph({ hasHookOverlay });
    const encoderArgs = getVideoEncoderArgs();

    const ffmpegArgs = buildFfmpegRenderArgs({
      sourceVideoPath,
      startSec,
      duration,
      outputPath,
      filterGraph,
      encoderArgs,
      hookPngPath,
    });

    try {
      await execa('ffmpeg', ffmpegArgs);
      logger.info(`[RenderService] Successfully rendered clip at: ${outputPath}`);
      return outputPath;
    } catch (err) {
      logger.error(`[RenderService] FFmpeg rendering error: ${err.message}`);
      throw new AppError(`Failed to render clip: ${err.message}`, 500, 'RENDER_ERROR');
    } finally {
      // Clean up temporary hook overlay files
      cleanupFiles([hookSvgPath, hookPngPath]);
    }
  }
}
