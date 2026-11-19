import { execa } from 'execa';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';

export class MediaService {
  /**
   * Download a YouTube video using yt-dlp binary
   * @param {string} url - YouTube URL
   * @param {string} outputDir - Directory to save downloaded file
   * @returns {Promise<{ filePath: string, title: string, duration: number }>}
   */
  /**
   * Download a YouTube video or slice of a Live Stream using yt-dlp binary
   * @param {string} url - YouTube URL
   * @param {string} outputDir - Directory to save downloaded file
   * @param {object} [options] - Ingestion options
   * @returns {Promise<{ filePath: string, title: string, duration: number, isLive?: boolean }>}
   */
  static async downloadYouTube(url, outputDir, options = {}) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileId = uuidv4();
    const outputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);

    logger.info(`[MediaService] Starting YouTube download for URL: ${url}`);

    try {
      // 1. Get metadata first
      const { stdout: metaOutput } = await execa('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        url,
      ]);
      const metadata = JSON.parse(metaOutput);

      const isLive = metadata.is_live === true || metadata.live_status === 'is_live';

      // 2. Handle Active Live Stream Capture
      if (isLive) {
        const captureSec = options.live_capture_seconds || (options.max_minutes ? options.max_minutes * 60 : 300);
        logger.info(`[MediaService] Active LIVE STREAM detected: "${metadata.title}". Capturing ${captureSec}s slice...`);

        const liveFilePath = path.join(outputDir, `${fileId}.mp4`);
        await execa('yt-dlp', [
          '--no-playlist',
          '--download-sections', `*0-${captureSec}`,
          '-o', liveFilePath,
          url,
        ]);

        return {
          filePath: liveFilePath,
          title: `[LIVE] ${metadata.title || 'Live Stream'}`,
          duration: captureSec,
          isLive: true,
        };
      }

      // 3. Regular Video: Download highest quality video (up to 1080p for efficient processing)
      await execa('yt-dlp', [
        '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '-o', outputTemplate,
        url,
      ]);

      const expectedPath = path.join(outputDir, `${fileId}.mp4`);
      if (!fs.existsSync(expectedPath)) {
        // Fallback check if ext was different
        const files = fs.readdirSync(outputDir).filter((f) => f.startsWith(fileId));
        if (files.length === 0) {
          throw new AppError('Downloaded file not found on disk', 500, 'DOWNLOAD_FAILED');
        }
        return {
          filePath: path.join(outputDir, files[0]),
          title: metadata.title || 'Untitled Video',
          duration: metadata.duration || 0,
          isLive: false,
        };
      }

      return {
        filePath: expectedPath,
        title: metadata.title || 'Untitled Video',
        duration: metadata.duration || 0,
        isLive: false,
      };
    } catch (err) {
      logger.error(`[MediaService] yt-dlp error: ${err.message}`);
      throw new AppError(`Failed to download YouTube video: ${err.message}`, 400, 'YOUTUBE_DOWNLOAD_ERROR');
    }
  }

  /**
   * Probe video file with ffprobe
   * @param {string} filePath
   */
  static async probeVideo(filePath) {
    try {
      const { stdout } = await execa('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_name',
        '-of', 'json',
        filePath,
      ]);
      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find((s) => s.width && s.height) || {};
      const duration = parseFloat(data.format?.duration || 0);

      return {
        duration,
        width: videoStream.width || 1920,
        height: videoStream.height || 1080,
        fps: videoStream.r_frame_rate ? eval(videoStream.r_frame_rate) : 30,
        codec: videoStream.codec_name || 'h264',
      };
    } catch (err) {
      logger.error(`[MediaService] ffprobe error: ${err.message}`);
      throw new AppError(`Failed to probe video file: ${err.message}`, 500, 'FFPROBE_ERROR');
    }
  }

  /**
   * Extract audio from video for speech analysis
   * Supports 64kbps mono MP3 (for 4x faster Gemini uploads) or 16kHz mono WAV
   * @param {string} videoPath
   * @param {string} outputAudioPath
   */
  static async extractAudio(videoPath, outputAudioPath) {
    logger.info(`[MediaService] Extracting audio from ${videoPath} to ${outputAudioPath}`);
    try {
      const isMp3 = outputAudioPath.endsWith('.mp3');
      const ffmpegArgs = [
        '-y',
        '-i', videoPath,
        '-vn',
      ];

      if (isMp3) {
        ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '16000', '-ac', '1', outputAudioPath);
      } else {
        ffmpegArgs.push('-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputAudioPath);
      }

      await execa('ffmpeg', ffmpegArgs);
      return outputAudioPath;
    } catch (err) {
      logger.error(`[MediaService] ffmpeg audio extraction error: ${err.message}`);
      throw new AppError(`Audio extraction failed: ${err.message}`, 500, 'AUDIO_EXTRACTION_ERROR');
    }
  }
}

