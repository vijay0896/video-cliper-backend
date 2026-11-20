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
 * Parse any time string or number into total seconds.
 * Supports: "02:30:15" -> 9015, "45:30" -> 2730, "90m" -> 5400, "2h 30m" -> 9000, 7200 -> 7200
 * @param {string|number} [input]
 * @returns {number|null}
 */
export const parseTimeToSeconds = (input) => {
  if (input == null || input === '') return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input) : null;
  }

  const str = String(input).trim().toLowerCase();
  if (!str) return null;
  if (/^\d+$/.test(str)) return parseInt(str, 10);

  // Parse "1h 30m" or "90m" or "45s"
  let total = 0;
  let hasUnit = false;
  const hMatch = str.match(/(\d+)\s*h/);
  const mMatch = str.match(/(\d+)\s*m/);
  const sMatch = str.match(/(\d+)\s*s/);
  if (hMatch) { total += parseInt(hMatch[1], 10) * 3600; hasUnit = true; }
  if (mMatch) { total += parseInt(mMatch[1], 10) * 60; hasUnit = true; }
  if (sMatch) { total += parseInt(sMatch[1], 10); hasUnit = true; }
  if (hasUnit) return total;

  // Parse "HH:MM:SS" or "MM:SS"
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return null;
};

/**
 * Format total seconds into "HH:MM:SS" string for yt-dlp / ffmpeg.
 * @param {number} totalSeconds
 * @returns {string}
 */
export const formatSecondsToTimestamp = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Builds arguments for regular YouTube video download up to 1080p.
 * If startTime or endTime is specified, uses --download-sections to only download that range.
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.outputTemplate
 * @param {number|string} [params.startTime]
 * @param {number|string} [params.endTime]
 * @returns {string[]}
 */
export const buildYtDlpVideoArgs = ({ url, outputTemplate, startTime = null, endTime = null }) => {
  const args = [
    '-f', YT_DLP_CONFIG.VIDEO_FORMAT,
    '--merge-output-format', YT_DLP_CONFIG.OUTPUT_FORMAT,
    '--no-playlist',
  ];

  if (startTime != null || endTime != null) {
    const startSec = parseTimeToSeconds(startTime) || 0;
    const endSec = parseTimeToSeconds(endTime);
    const startStr = formatSecondsToTimestamp(startSec);
    const endStr = endSec != null ? formatSecondsToTimestamp(endSec) : 'inf';
    // Download only the requested slice directly via HTTP byte ranges
    args.push('--download-sections', `*${startStr}-${endStr}`);
    args.push('--force-keyframes-at-cuts');
  }

  args.push('-o', outputTemplate, url);
  return args;
};

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

