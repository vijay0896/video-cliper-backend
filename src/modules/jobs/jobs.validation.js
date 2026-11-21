import { z } from 'zod';

/**
 * Validation schemas for Video Processing Jobs API.
 */

const emptyToUndefined = (val) => (val === '' || val === null || val === undefined ? undefined : val);

const optionalTime = z.preprocess(
  emptyToUndefined,
  z.union([z.string(), z.number()]).optional()
);

const optionalNumber = (min, max) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(min).max(max).optional()
  );

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url('Must provide a valid URL').optional()
);

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional()
);

export const createJobSchema = z.object({
  url: optionalUrl,
  targetClips: optionalNumber(1, 10),
  target_clips: optionalNumber(1, 10),
  clipMinSeconds: optionalNumber(5, 120),
  clip_min_seconds: optionalNumber(5, 120),
  clipMaxSeconds: optionalNumber(15, 300),
  clip_max_seconds: optionalNumber(15, 300),
  liveCaptureSeconds: optionalNumber(15, 600),
  live_capture_seconds: optionalNumber(15, 600),
  max_minutes: optionalNumber(1, 120),
  startTime: optionalTime,
  endTime: optionalTime,
  sourceStart: optionalTime,
  sourceEnd: optionalTime,
  geminiApiKey: optionalString,
}).passthrough();

export const generateCopySchema = z.object({
  jobId: z.string().trim().optional(),
  clipIndex: z.coerce.number().int().nonnegative().optional(),
  title: z.string().trim().optional(),
  hook: z.string().trim().optional(),
  context: z.string().trim().optional(),
  geminiApiKey: z.string().trim().optional(),
}).refine(
  (data) => data.title || data.hook || data.context || data.jobId,
  {
    message: 'At least one of title, hook, context, or jobId must be provided',
    path: ['title'],
  }
);


