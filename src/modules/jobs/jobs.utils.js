import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_JOB_OPTIONS } from './jobs.constants.js';
import { parseTimeToSeconds } from '../media/media.utils.js';

/**
 * Job module utilities for options parsing, caption normalization, layout calculations, and concurrency.
 */

/**
 * Extracts Gemini API key from request headers or body.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export const extractGeminiKey = (req) => {
  return req.headers['x-gemini-key'] || req.body?.geminiApiKey || null;
};

/**
 * Parses and normalizes job processing options from request body.
 * @param {object} [body]
 * @returns {object} Normalized options
 */
export const parseJobOptions = (body = {}) => {
  return {
    target_clips: body.targetClips || body.target_clips
      ? parseInt(body.targetClips || body.target_clips, 10)
      : DEFAULT_JOB_OPTIONS.TARGET_CLIPS,
    clip_min_seconds: body.clipMinSeconds || body.clip_min_seconds
      ? parseInt(body.clipMinSeconds || body.clip_min_seconds, 10)
      : DEFAULT_JOB_OPTIONS.CLIP_MIN_SECONDS,
    clip_max_seconds: body.clipMaxSeconds || body.clip_max_seconds
      ? parseInt(body.clipMaxSeconds || body.clip_max_seconds, 10)
      : DEFAULT_JOB_OPTIONS.CLIP_MAX_SECONDS,
    live_capture_seconds: body.live_capture_seconds || body.liveCaptureSeconds
      ? parseInt(body.live_capture_seconds || body.liveCaptureSeconds, 10)
      : DEFAULT_JOB_OPTIONS.LIVE_CAPTURE_SECONDS,
    max_minutes: body.max_minutes ? parseInt(body.max_minutes, 10) : null,
    start_time: parseTimeToSeconds(body.startTime ?? body.sourceStart),
    end_time: parseTimeToSeconds(body.endTime ?? body.sourceEnd),
  };
};

/**
 * Normalizes speech captions so their timestamps start at 0ms relative to clip start.
 * @param {Array<object>} [rawCaptions]
 * @param {number} [clipStartSec=0]
 * @returns {Array<{ text: string, startMs: number, endMs: number }>}
 */
export const normalizeCaptionTimestamps = (rawCaptions = [], clipStartSec = 0) => {
  const clipStartMs = Math.round(clipStartSec * 1000);
  return rawCaptions.map((c) => {
    let s = Number(c.startMs) || 0;
    let e = Number(c.endMs) || 0;
    if (s >= clipStartMs) {
      s -= clipStartMs;
      e -= clipStartMs;
    }
    return {
      text: c.text,
      startMs: Math.max(0, Math.round(s)),
      endMs: Math.max(0, Math.round(e)),
    };
  });
};

/**
 * Calculates video vertical offset (videoTop) for 9:16 layout based on probed video dimensions.
 * For landscape videos, height is increased by 30% (scale 1404 cropped to 1080).
 * @param {object} [probe]
 * @returns {number}
 */
export const calculateVideoTop = (probe = {}) => {
  const isLandscape = !probe.width || !probe.height || probe.width > probe.height;
  const fgHeight = probe.width && probe.height
    ? (isLandscape
        ? Math.round(1404 * (probe.height / probe.width))
        : Math.round(1080 * (probe.height / probe.width)))
    : 790;
  return Math.max(0, Math.round((1920 - fgHeight) / 2));
};

/**
 * Formats clip metadata object for client consumption and repository persistence.
 * @param {object} params
 * @param {string} params.clipOutputPath
 * @param {object} params.moment
 * @param {string} params.jobId
 * @param {Array<object>} params.normalizedCaptions
 * @param {number} params.index
 * @returns {object} Formatted clip object
 */
export const buildClipMetadata = ({
  clipOutputPath,
  moment,
  jobId,
  normalizedCaptions,
  index,
}) => {
  const filename = path.basename(clipOutputPath);
  const generatedTitle = moment.youtube_title || moment.title;
  const defaultDesc =
    moment.description ||
    moment.caption ||
    `${moment.hook || moment.title || 'Viral Short'}! 🔥 Watch till the end! Let us know what you think in the comments below! 👇\n\n#shorts #viral #reels #trending #fyp`;

  return {
    id: uuidv4(),
    index,
    title: moment.title,
    video_title_for_youtube_short: generatedTitle,
    hook: moment.hook,
    description: defaultDesc,
    video_description_for_tiktok: defaultDesc,
    video_description_for_instagram: defaultDesc,
    score: moment.score,
    reason: moment.reason,
    start: moment.start,
    end: moment.end,
    duration: Math.round(moment.end - moment.start),
    video_url: `/videos/${jobId}/${filename}`,
    videoUrl: `/videos/${jobId}/${filename}`,
    captions: normalizedCaptions,
  };
};

/**
 * Concurrently processes an array of items with a fixed concurrency worker pool.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} workerFn
 * @returns {Promise<R[]>}
 */
export const runConcurrentPool = async (items, limit, workerFn) => {
  const results = [];
  const pool = [];

  for (let i = 0; i < items.length; i++) {
    const task = Promise.resolve(workerFn(items[i], i)).then((res) => {
      results.push(res);
      pool.splice(pool.indexOf(task), 1);
    });
    pool.push(task);
    if (pool.length >= limit) {
      await Promise.race(pool);
    }
  }

  await Promise.all(pool);
  return results;
};

