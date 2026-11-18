import path from 'path';
import fs from 'fs';
import { JobsService } from './jobs.service.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import { AppError } from '../../core/utils/appError.js';
import { env } from '../../config/env.js';

export class JobsController {
  /**
   * Submit new video for processing
   */
  static async createJob(req, res) {
    const customApiKey = req.headers['x-gemini-key'] || req.body.geminiApiKey;
    const url = req.body.url;
    const filePath = req.file ? req.file.path : null;

    const options = {
      target_clips: req.body.targetClips || req.body.target_clips ? parseInt(req.body.targetClips || req.body.target_clips, 10) : 3,
      clip_min_seconds: req.body.clipMinSeconds || req.body.clip_min_seconds ? parseInt(req.body.clipMinSeconds || req.body.clip_min_seconds, 10) : 15,
      clip_max_seconds: req.body.clipMaxSeconds || req.body.clip_max_seconds ? parseInt(req.body.clipMaxSeconds || req.body.clip_max_seconds, 10) : 60,
      live_capture_seconds: req.body.live_capture_seconds || req.body.liveCaptureSeconds ? parseInt(req.body.live_capture_seconds || req.body.liveCaptureSeconds, 10) : 300,
      max_minutes: req.body.max_minutes ? parseInt(req.body.max_minutes, 10) : null,
    };

    const job = await JobsService.submitJob({ url, filePath, options }, customApiKey);

    // If client requested directly via /api/process (legacy format)
    if (req.originalUrl.startsWith('/api/process')) {
      return res.status(200).json({
        job_id: job.id,
        status: job.status,
      });
    }

    return ApiResponse.created(res, 'Job submitted successfully', job);
  }

  /**
   * Legacy status polling endpoint (/api/status/:id)
   */
  static async getJobLegacy(req, res) {
    const { id } = req.params;
    let job;
    try {
      job = JobsService.getJobById(id);
    } catch (_) {
      return res.status(200).json({
        status: 'queued',
        progress: 0,
        logs: ['Job queued for processing'],
        log_times: [Date.now() / 1000],
        result: null,
        error: null,
      });
    }

    return res.status(200).json({
      status: job.status,
      progress: job.progress || 0,
      logs: job.logs || [],
      log_times: job.logs ? job.logs.map(() => Date.now() / 1000) : [],
      result: job.status === 'completed' ? {
        clips: job.clips || [],
        video_path: job.sourceFile || '',
      } : null,
      error: job.error || null,
    });
  }

  /**
   * Get Job status and progress
   */
  static async getJob(req, res) {
    const { id } = req.params;
    const job = JobsService.getJobById(id);
    return ApiResponse.success(res, 'Job retrieved successfully', job);
  }

  /**
   * List all jobs
   */
  static async listJobs(req, res) {
    const jobs = JobsService.listAllJobs();
    return ApiResponse.success(res, 'Jobs list retrieved', jobs);
  }

  /**
   * Stream / Download rendered clip file
   */
  static async getClipFile(req, res) {
    const { id, filename } = req.params;
    const clipPath = path.join(env.OUTPUT_DIR, id, filename);

    if (!fs.existsSync(clipPath)) {
      throw new AppError('Requested clip file was not found', 404, 'FILE_NOT_FOUND');
    }

    return res.sendFile(clipPath);
  }

  /**
   * Get word-level captions/transcript for a specific clip
   */
  static async getClipTranscript(req, res) {
    const { jobId, clipIndex } = req.params;
    const job = JobsService.getJobById(jobId);
    const idx = parseInt(clipIndex, 10);
    const clip = job.clips?.[idx];
    if (!clip) {
      throw new AppError('Clip not found', 404, 'CLIP_NOT_FOUND');
    }
    return res.status(200).json({
      captions: clip.captions || [],
      durationSec: clip.duration || 30,
      text: (clip.captions || []).map((c) => c.text).join(' '),
    });
  }

  /**
   * Subtitle compatibility handler
   */
  static async handleSubtitle(req, res) {
    const { job_id, clip_index } = req.body;
    const job = JobsService.getJobById(job_id);
    const idx = parseInt(clip_index, 10);
    const clip = job.clips?.[idx];
    if (!clip) {
      throw new AppError('Clip not found', 404, 'CLIP_NOT_FOUND');
    }
    return res.status(200).json({
      success: true,
      new_video_url: clip.video_url,
    });
  }
}

