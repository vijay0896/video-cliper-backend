import fs from 'fs';
import path from 'path';
import { AppError } from '../../core/utils/appError.js';
import {
  YT_DLP_CONFIG,
  LIVE_STREAM_CONFIG,
  AUDIO_CONFIG,
  DEFAULT_VIDEO_PROBE,
} from './media.constants.js';

/**
 * Media processing utilities for arguments construction, fps calculations, and path resolution.
 */

/**
 * Safely parses frame rate string (e.g. "30/1", "60000/1001", "29.97") without using eval().
 * @param {string|number} fpsStr
 * @param {number} [fallback=30]
 * @returns {number}
 */
export const parseFps = (fpsStr, fallback = 30) => {
  if (!fpsStr) return fallback;
  if (typeof fpsStr === 'number') return fpsStr;

  const str = String(fpsStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }

  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parses ffprobe JSON output into structured video metadata.
 * @param {string} stdout - Raw JSON stdout from ffprobe
 * @returns {{ duration: number, width: number, height: number, fps: number, codec: string }}
 */
export const parseFfprobeOutput = (stdout) => {
  try {
    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find((s) => s.width && s.height) || {};
    const duration = parseFloat(data.format?.duration || 0);

    return {
      duration: Number.isFinite(duration) ? duration : DEFAULT_VIDEO_PROBE.duration,
      width: videoStream.width || DEFAULT_VIDEO_PROBE.width,
      height: videoStream.height || DEFAULT_VIDEO_PROBE.height,
      fps: parseFps(videoStream.r_frame_rate, DEFAULT_VIDEO_PROBE.fps),
      codec: videoStream.codec_name || DEFAULT_VIDEO_PROBE.codec,
    };
  } catch (_) {
    return { ...DEFAULT_VIDEO_PROBE };
  }
};

/**
 * Builds arguments for yt-dlp live stream slice capture.
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.liveFilePath
 * @param {number} params.captureSec
 * @returns {string[]}
 */
export const buildYtDlpLiveArgs = ({ url, liveFilePath, captureSec }) => [
  '--no-playlist',
  '--no-live-from-start',
  '--hls-use-mpegts',
  '--concurrent-fragments', LIVE_STREAM_CONFIG.CONCURRENT_FRAGMENTS,
  '--socket-timeout', LIVE_STREAM_CONFIG.SOCKET_TIMEOUT,
  '--download-sections', `*0-${captureSec}`,
  '-o', liveFilePath,
  url,
];

/**
 * Builds arguments for regular YouTube video download up to 1080p.
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.outputTemplate
 * @returns {string[]}
 */
export const buildYtDlpVideoArgs = ({ url, outputTemplate }) => [
  '-f', YT_DLP_CONFIG.VIDEO_FORMAT,
  '--merge-output-format', YT_DLP_CONFIG.OUTPUT_FORMAT,
  '--no-playlist',
  '-o', outputTemplate,
  url,
];

/**
 * Builds arguments for audio extraction (MP3 or WAV).
 * @param {object} params
 * @param {string} params.videoPath
 * @param {string} params.outputAudioPath
 * @returns {string[]}
 */
export const buildAudioExtractionArgs = ({ videoPath, outputAudioPath }) => {
  const isMp3 = outputAudioPath.endsWith('.mp3');
  const baseArgs = ['-y', '-i', videoPath, '-vn'];

  if (isMp3) {
    return [
      ...baseArgs,
      '-c:a', AUDIO_CONFIG.MP3_CODEC,
      '-b:a', AUDIO_CONFIG.MP3_BITRATE,
      '-ar', AUDIO_CONFIG.SAMPLE_RATE,
      '-ac', AUDIO_CONFIG.CHANNELS,
      outputAudioPath,
    ];
  }

  return [
    ...baseArgs,
    '-acodec', AUDIO_CONFIG.WAV_CODEC,
    '-ar', AUDIO_CONFIG.SAMPLE_RATE,
    '-ac', AUDIO_CONFIG.CHANNELS,
    outputAudioPath,
  ];
};

/**
 * Resolves the downloaded file path on disk, with fallback for varying file extensions.
 * @param {string} outputDir
 * @param {string} fileId
 * @returns {string} Absolute file path
 */
export const resolveDownloadedFile = (outputDir, fileId) => {
  const expectedPath = path.join(outputDir, `${fileId}.mp4`);
  if (fs.existsSync(expectedPath)) {
    return expectedPath;
  }

  const matchingFiles = fs.readdirSync(outputDir).filter((f) => f.startsWith(fileId));
  if (matchingFiles.length === 0) {
    throw new AppError('Downloaded file not found on disk', 500, 'DOWNLOAD_FAILED');
  }

  return path.join(outputDir, matchingFiles[0]);
};

