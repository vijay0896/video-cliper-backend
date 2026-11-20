import { execa } from 'execa';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { LIVE_STREAM_CONFIG } from './media.constants.js';
import {
  parseFfprobeOutput,
  buildYtDlpLiveArgs,
  buildYtDlpVideoArgs,
  buildAudioExtractionArgs,
  resolveDownloadedFile,
} from './media.utils.js';

export class MediaService {
  /**
   * Download a YouTube video or slice of an active Live Stream using yt-dlp binary
   * @param {string} url - YouTube URL
   * @param {string} outputDir - Directory to save downloaded file
   * @param {object} [options] - Ingestion options (e.g. liveCaptureSeconds)
   * @param {function} [onLog] - Real-time status update callback
   * @returns {Promise<{ filePath: string, title: string, duration: number, isLive?: boolean }>}
   */
  static async downloadYouTube(url, outputDir, options = {}, onLog = null) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileId = uuidv4();
    const outputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);

    logger.info(`[MediaService] Starting YouTube download for URL: ${url}`);
    if (onLog) onLog('Connecting to YouTube and analyzing stream metadata...');

    try {
      // 1. Fetch metadata first
      const { stdout: metaOutput } = await execa('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        url,
      ]);
      const metadata = JSON.parse(metaOutput);
      const isLive = metadata.is_live === true || metadata.live_status === 'is_live';

      // 2. Handle Active Live Stream Capture
      if (isLive) {
        const captureSec =
          options.live_capture_seconds ||
          options.liveCaptureSeconds ||
          (options.max_minutes ? options.max_minutes * 60 : LIVE_STREAM_CONFIG.DEFAULT_CAPTURE_SEC);

        logger.info(`[MediaService] Active LIVE STREAM detected: "${metadata.title}". Capturing fast ${captureSec}s slice...`);
        if (onLog) {
          onLog(`🔴 Live stream detected: "${metadata.title}". Fast-capturing ${captureSec}s stream slice...`);
        }

        const liveFilePath = path.join(outputDir, `${fileId}.mp4`);
        const liveArgs = buildYtDlpLiveArgs({ url, liveFilePath, captureSec });
        await execa('yt-dlp', liveArgs);

        if (onLog) {
          onLog(`⚡ Live stream slice captured successfully (${captureSec}s).`);
        }

        return {
          filePath: liveFilePath,
          title: `[LIVE] ${metadata.title || 'Live Stream'}`,
          duration: captureSec,
          isLive: true,
        };
      }

      // 3. Regular Video Download (up to 1080p MP4 for optimal pipeline throughput)
      if (onLog) onLog(`Downloading video stream: "${metadata.title}"...`);
      const videoArgs = buildYtDlpVideoArgs({ url, outputTemplate });
      await execa('yt-dlp', videoArgs);

      const filePath = resolveDownloadedFile(outputDir, fileId);

      return {
        filePath,
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
   * Probe video file with ffprobe to extract dimensions, duration, codec, and fps
   * @param {string} filePath - Local video file path
   * @returns {Promise<{ duration: number, width: number, height: number, fps: number, codec: string }>}
   */
  static async probeVideo(filePath) {
    try {
      const { stdout } = await execa('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_name',
        '-of', 'json',
        filePath,
      ]);

      return parseFfprobeOutput(stdout);
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
   * @returns {Promise<string>} outputAudioPath
   */
  static async extractAudio(videoPath, outputAudioPath) {
    logger.info(`[MediaService] Extracting audio from ${videoPath} to ${outputAudioPath}`);
    try {
      const ffmpegArgs = buildAudioExtractionArgs({ videoPath, outputAudioPath });
      await execa('ffmpeg', ffmpegArgs);
      return outputAudioPath;
    } catch (err) {
      logger.error(`[MediaService] ffmpeg audio extraction error: ${err.message}`);
      throw new AppError(`Audio extraction failed: ${err.message}`, 500, 'AUDIO_EXTRACTION_ERROR');
    }
  }
}
