import { execa } from 'execa';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';

export class RenderService {
  /**
   * Helper: Generate a high-contrast SVG banner for the overall clip context / hook
   * Positioned just above the center video frame for optimal reel readability.
   */
  static generateHookSvg(hookText, svgPath, videoTop = 656) {
    const cleanText = (hookText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const textLength = cleanText.length;
    const boxWidth = Math.min(1000, Math.max(450, textLength * 30 + 100));
    const boxX = (1080 - boxWidth) / 2;

    // Position pill nicely just above the video frame (with 36px breathing room)
    const pillY = videoTop > 200 ? Math.round(videoTop - 110 - 36) : 140;
    const textY = pillY + 74;

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>
  <!-- Modern Translucent Context Pill placed just above the video -->
  <rect x="${boxX}" y="${pillY}" width="${boxWidth}" height="110" rx="36" ry="36" fill="rgba(0, 0, 0, 0.78)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="3" filter="url(#shadow)" />
  <text x="540" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="46" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
    ${cleanText}
  </text>
</svg>`;

    fs.writeFileSync(svgPath, svgContent, 'utf-8');
    return svgPath;
  }

  /**
   * Rasterize SVG to 1080x1920 PNG with true alpha transparency using rsvg-convert
   */
  static async rasterizeSvg(svgPath) {
    try {
      const pngPath = `${svgPath}.png`;
      const rsvgBin = fs.existsSync('/opt/homebrew/bin/rsvg-convert')
        ? '/opt/homebrew/bin/rsvg-convert'
        : 'rsvg-convert';

      await execa(rsvgBin, ['-w', '1080', '-h', '1920', svgPath, '-o', pngPath]);
      if (fs.existsSync(pngPath)) {
        return pngPath;
      }
    } catch (e) {
      logger.warn(`[RenderService] Could not rasterize hook SVG via rsvg-convert: ${e.message}`);
    }
    return null;
  }

  /**
   * Cut and render a 9:16 vertical clip with hardware acceleration and optimized background blur
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

    // Generate hook context overlay if provided and rasterizer succeeds
    let hookPngPath = null;
    let hookSvgPath = null;
    const hookText = options.hook || options.title;
    if (hookText && typeof hookText === 'string' && hookText.trim()) {
      try {
        hookSvgPath = path.join(outputDir, `hook_${clipId}.svg`);
        RenderService.generateHookSvg(hookText.trim(), hookSvgPath, options.videoTop);
        hookPngPath = await RenderService.rasterizeSvg(hookSvgPath);
      } catch (e) {
        logger.warn(`[RenderService] Hook overlay generation skipped: ${e.message}`);
      }
    }

    // High performance background blur: downscaling to 270x480 before blur runs 16x faster
    let filterGraph;
    const ffmpegArgs = [
      '-y',
      '-ss', startSec.toString(),
      '-t', duration.toString(),
      '-i', sourceVideoPath,
    ];

    if (hookPngPath && fs.existsSync(hookPngPath)) {
      ffmpegArgs.push('-i', hookPngPath);
      filterGraph = [
        `[0:v]scale=270:480,boxblur=10:2,scale=1080:1920[bg]`,
        `[0:v]scale=1080:-2[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
        `[base][1:v]overlay=0:0[outv]`,
      ].join(';');
    } else {
      filterGraph = [
        `[0:v]scale=270:480,boxblur=10:2,scale=1080:1920[bg]`,
        `[0:v]scale=1080:-2[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`,
      ].join(';');
    }

    // Hardware accelerated video encoding on Apple Silicon (VideoToolbox) or software fallback
    let encoderArgs = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '22'];
    if (process.platform === 'darwin') {
      encoderArgs = ['-c:v', 'h264_videotoolbox', '-b:v', '4500k'];
    }

    ffmpegArgs.push(
      '-filter_complex', filterGraph,
      '-map', '[outv]',
      '-map', '0:a?',
      ...encoderArgs,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    );

    try {
      await execa('ffmpeg', ffmpegArgs);
      logger.info(`[RenderService] Successfully rendered clip at: ${outputPath}`);
      return outputPath;
    } catch (err) {
      logger.error(`[RenderService] FFmpeg rendering error: ${err.message}`);
      throw new AppError(`Failed to render clip: ${err.message}`, 500, 'RENDER_ERROR');
    } finally {
      // Clean up temporary hook overlay files
      if (hookSvgPath && fs.existsSync(hookSvgPath)) try { fs.unlinkSync(hookSvgPath); } catch (_) {}
      if (hookPngPath && fs.existsSync(hookPngPath)) try { fs.unlinkSync(hookPngPath); } catch (_) {}
    }
  }
}
