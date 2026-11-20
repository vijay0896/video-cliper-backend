import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from './jobs.repository.js';
import { MediaService } from '../media/media.service.js';
import { ClipsService } from '../clips/clips.service.js';
import { RenderService } from '../render/render.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/utils/appError.js';
import { PIPELINE_CONFIG } from './jobs.constants.js';
import {
  calculateVideoTop,
  normalizeCaptionTimestamps,
  buildClipMetadata,
  runConcurrentPool,
} from './jobs.utils.js';

export class JobsService {
  /**
   * Submit and launch video processing pipeline
   * @param {object} payload
   * @param {string} [customApiKey]
   */
  static async submitJob({ url, filePath, options = {} }, customApiKey) {
    if (!url && !filePath) {
      throw new AppError('Either a YouTube URL or an uploaded video file is required', 400, 'INVALID_INPUT');
    }

    const jobId = uuidv4();
    const jobDir = path.join(env.OUTPUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const job = {
      id: jobId,
      status: 'pending',
      progress: PIPELINE_CONFIG.PROGRESS.INITIAL,
      url: url || null,
      sourceFile: filePath || null,
      title: 'Processing video...',
      duration: 0,
      logs: ['Job queued for processing'],
      clips: [],
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobRepository.create(job);

    // Run execution pipeline asynchronously in background
    this.executePipeline(jobId, { url, filePath, options, jobDir }, customApiKey).catch((err) => {
      logger.error(`[JobsService] Pipeline failed for job ${jobId}: ${err.message}`);
      jobRepository.update(jobId, {
        status: 'failed',
        error: err.message,
      });
      jobRepository.addLog(jobId, `Error: ${err.message}`);
    });

    return job;
  }

  /**
   * Background Pipeline Orchestrator
   */
  static async executePipeline(jobId, { url, filePath, options, jobDir }, customApiKey) {
    logger.info(`[JobsService] Starting background pipeline for job: ${jobId}`);
    jobRepository.update(jobId, {
      status: 'processing',
      progress: PIPELINE_CONFIG.PROGRESS.INGEST_START,
    });

    let localVideoPath = filePath;
    let videoTitle = 'Uploaded Video';
    let duration = 0;

    // 1. Ingest Video (Download if YouTube URL)
    if (url) {
      jobRepository.addLog(jobId, `Downloading video from YouTube: ${url}`);
      jobRepository.update(jobId, { progress: PIPELINE_CONFIG.PROGRESS.DOWNLOAD_START });

      const addJobLog = (msg) => {
        logger.info(`[JobsService] [Job ${jobId}] ${msg}`);
        jobRepository.addLog(jobId, msg);
      };

      const downloadResult = await MediaService.downloadYouTube(url, jobDir, options, addJobLog);
      localVideoPath = downloadResult.filePath;
      videoTitle = downloadResult.title;
      duration = downloadResult.duration;

      if (!downloadResult.isLive) {
        jobRepository.addLog(jobId, `Download complete: "${videoTitle}"`);
      }
    }

    // 2. Probe Video Metadata
    const probe = await MediaService.probeVideo(localVideoPath);
    duration = duration || probe.duration;
    jobRepository.update(jobId, {
      title: videoTitle,
      duration,
      progress: PIPELINE_CONFIG.PROGRESS.PROBE_DONE,
    });
    jobRepository.addLog(jobId, `Video probed: ${probe.width}x${probe.height}, ${duration.toFixed(1)}s`);

    // 3. Audio Extraction (Fast 64k mono MP3 for 4x faster Gemini ingestion)
    jobRepository.addLog(jobId, 'Extracting compressed audio for speech analysis...');
    jobRepository.update(jobId, { progress: PIPELINE_CONFIG.PROGRESS.AUDIO_DONE });
    const audioPath = path.join(jobDir, 'audio.mp3');
    await MediaService.extractAudio(localVideoPath, audioPath);

    // 4. Gemini AI Moment Detection
    jobRepository.addLog(jobId, 'Sending audio to Google Gemini AI to detect viral moments...');
    jobRepository.update(jobId, { progress: PIPELINE_CONFIG.PROGRESS.MOMENTS_DONE });
    const detectedMoments = await ClipsService.analyzeAndPickMoments(audioPath, duration, options, customApiKey);
    jobRepository.addLog(jobId, `Gemini found ${detectedMoments.length} viral moment candidate(s)`);

    // 5. Render Vertical 9:16 Clips with Parallel Hardware Concurrency
    jobRepository.addLog(jobId, `Rendering ${detectedMoments.length} vertical clips (Hardware Accelerated)...`);
    jobRepository.update(jobId, { progress: PIPELINE_CONFIG.PROGRESS.RENDER_START });

    let completedCount = 0;
    const videoTop = calculateVideoTop(probe);

    const renderMoment = async (moment, index) => {
      jobRepository.addLog(jobId, `[Rendering] Clip ${index + 1}/${detectedMoments.length}: "${moment.title}"`);

      const clipOutputPath = await RenderService.renderVerticalClip(
        localVideoPath,
        moment.start,
        moment.end,
        jobDir,
        { hook: moment.hook, title: moment.title, videoTop }
      );

      // Normalize speech captions relative to clip start
      const normalizedCaptions = normalizeCaptionTimestamps(moment.captions || [], moment.start);

      completedCount++;
      const currentProgress =
        PIPELINE_CONFIG.PROGRESS.RENDER_START +
        Math.round((completedCount / detectedMoments.length) * 28);
      jobRepository.update(jobId, { progress: currentProgress });

      return buildClipMetadata({
        clipOutputPath,
        moment,
        jobId,
        normalizedCaptions,
        index,
      });
    };

    // Parallel Worker Pool
    const renderedClips = await runConcurrentPool(
      detectedMoments,
      PIPELINE_CONFIG.CONCURRENCY,
      renderMoment
    );

    // Keep clips in original chronological order
    renderedClips.sort((a, b) => a.index - b.index);
    const finalClips = renderedClips.map(({ index, ...clip }) => clip);

    // 6. Complete
    jobRepository.update(jobId, {
      status: 'completed',
      progress: PIPELINE_CONFIG.PROGRESS.COMPLETE,
      clips: finalClips,
    });
    jobRepository.addLog(jobId, 'All clips successfully generated and ready for download!');
    logger.info(`[JobsService] Job ${jobId} finished successfully with ${finalClips.length} clips`);
  }

  static getJobById(id) {
    const job = jobRepository.findById(id);
    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }
    return job;
  }

  static listAllJobs() {
    return jobRepository.findAll();
  }
}
