import { z } from 'zod';

/**
 * Validation schemas for YouTube Thumbnail & Titles Packaging API.
 */

export const titlesRefinementSchema = z.object({
  session_id: z.string().trim().optional(),
  title: z.string().trim().optional(),
  message: z.string().trim().optional(),
  geminiApiKey: z.string().trim().optional(),
}).refine(
  (data) => data.title || data.message || data.session_id,
  {
    message: 'Either title, message, or session_id must be provided',
    path: ['title'],
  }
);

export const generateThumbnailSchema = z.object({
  session_id: z.string().trim().min(1, 'session_id is required'),
  title: z.string().trim().min(1, 'title is required'),
  count: z.coerce.number().int().min(1).max(6).optional().default(3),
  burn_text: z.union([z.boolean(), z.string()]).optional(),
  frame: z.string().trim().optional(),
  extra_prompt: z.string().trim().optional(),
  geminiApiKey: z.string().trim().optional(),
});

export const describeThumbnailSchema = z.object({
  title: z.string().trim().min(1, 'title is required for generating YouTube description'),
  session_id: z.string().trim().optional(),
  geminiApiKey: z.string().trim().optional(),
});

export const publishThumbnailSchema = z.object({
  title: z.string().trim().min(1, 'title is required for publishing'),
  thumbnail_url: z.string().trim().min(1, 'thumbnail_url is required for publishing'),
});

