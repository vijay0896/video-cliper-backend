import { z } from 'zod';

/**
 * Validation schemas for Video Processing Jobs API.
 */

export const createJobSchema = z.object({
  url: z.string().trim().url('Must provide a valid URL').optional().or(z.literal('')),
  targetClips: z.coerce.number().int().min(1).max(10).optional(),
  target_clips: z.coerce.number().int().min(1).max(10).optional(),
  clipMinSeconds: z.coerce.number().int().min(5).max(120).optional(),
  clip_min_seconds: z.coerce.number().int().min(5).max(120).optional(),
  clipMaxSeconds: z.coerce.number().int().min(15).max(300).optional(),
  clip_max_seconds: z.coerce.number().int().min(15).max(300).optional(),
  liveCaptureSeconds: z.coerce.number().int().min(15).max(600).optional(),
  live_capture_seconds: z.coerce.number().int().min(15).max(600).optional(),
  max_minutes: z.coerce.number().int().min(1).max(120).optional(),
  startTime: z.union([z.string(), z.number()]).optional(),
  endTime: z.union([z.string(), z.number()]).optional(),
  sourceStart: z.union([z.string(), z.number()]).optional(),
  sourceEnd: z.union([z.string(), z.number()]).optional(),
  geminiApiKey: z.string().trim().optional(),
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

