/**
 * Media module configuration constants for video ingestion, probing, and audio extraction.
 */

export const YT_DLP_CONFIG = {
  VIDEO_FORMAT: 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  OUTPUT_FORMAT: 'mp4',
};

export const LIVE_STREAM_CONFIG = {
  CONCURRENT_FRAGMENTS: '5',
  SOCKET_TIMEOUT: '10',
  DEFAULT_CAPTURE_SEC: 60,
};

export const AUDIO_CONFIG = {
  SAMPLE_RATE: '16000',
  CHANNELS: '1',
  MP3_BITRATE: '64k',
  MP3_CODEC: 'libmp3lame',
  WAV_CODEC: 'pcm_s16le',
};

export const DEFAULT_VIDEO_PROBE = {
  duration: 0,
  width: 1920,
  height: 1080,
  fps: 30,
  codec: 'h264',
};

