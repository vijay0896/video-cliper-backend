/**
 * Job processing pipeline constants and default configurations.
 */

export const DEFAULT_JOB_OPTIONS = {
  TARGET_CLIPS: 3,
  CLIP_MIN_SECONDS: 15,
  CLIP_MAX_SECONDS: 60,
  LIVE_CAPTURE_SECONDS: 60,
};

export const PIPELINE_CONFIG = {
  CONCURRENCY: 3, // 3 concurrent renders on Apple Silicon M1
  PROGRESS: {
    INITIAL: 0,
    INGEST_START: 10,
    DOWNLOAD_START: 20,
    PROBE_DONE: 35,
    AUDIO_DONE: 45,
    MOMENTS_DONE: 60,
    RENDER_START: 70,
    COMPLETE: 100,
  },
};

