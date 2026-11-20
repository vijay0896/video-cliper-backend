import { ThumbnailService } from './thumbnail.service.js';
import { extractGeminiKey } from './thumbnail.utils.js';

export class ThumbnailController {
  /**
   * POST /api/thumbnail/upload
   */
  static async upload(req, res) {
    const file = req.file;
    const url = req.body.url;
    const result = await ThumbnailService.uploadVideo({ file, url });
    return res.status(200).json(result);
  }

  /**
   * POST /api/thumbnail/analyze
   */
  static async analyze(req, res) {
    const customApiKey = extractGeminiKey(req);
    const file = req.file;
    const url = req.body.url;
    const sessionId = req.body.session_id;

    const result = await ThumbnailService.analyzeVideo(
      { sessionId, file, url },
      customApiKey
    );
    return res.status(200).json(result);
  }

  /**
   * POST /api/thumbnail/titles
   */
  static async titles(req, res) {
    const customApiKey = extractGeminiKey(req);
    const { session_id, title, message } = req.body;

    const result = await ThumbnailService.refineTitles(
      session_id,
      { title, message },
      customApiKey
    );
    return res.status(200).json(result);
  }

  /**
   * GET /api/thumbnail/frames/:session_id
   */
  static async getFrames(req, res) {
    const { session_id } = req.params;
    const result = await ThumbnailService.getFrames(session_id);
    return res.status(200).json(result);
  }

  /**
   * POST /api/thumbnail/generate
   */
  static async generate(req, res) {
    const customApiKey = extractGeminiKey(req);
    const {
      session_id,
      title,
      extra_prompt,
      count,
      burn_text,
      frame,
    } = req.body;

    const faceFile = req.files?.face?.[0] || null;
    const bgFile = req.files?.background?.[0] || null;

    const result = await ThumbnailService.generateThumbnails(
      session_id,
      {
        title,
        extraPrompt: extra_prompt,
        count,
        burnText: burn_text !== 'false',
        frame,
        faceFile,
        bgFile,
      },
      customApiKey
    );
    return res.status(200).json(result);
  }

  /**
   * POST /api/thumbnail/describe
   */
  static async describe(req, res) {
    const customApiKey = extractGeminiKey(req);
    const { session_id, title } = req.body;

    const result = await ThumbnailService.generateDescription(
      session_id,
      title,
      customApiKey
    );
    return res.status(200).json(result);
  }

  /**
   * POST /api/thumbnail/publish
   */
  static async publish(req, res) {
    const result = await ThumbnailService.publish(req.body);
    return res.status(200).json(result);
  }

  /**
   * GET /api/thumbnail/publish/status/:id
   */
  static async getPublishStatus(req, res) {
    const { id } = req.params;
    const result = await ThumbnailService.getPublishStatus(id);
    return res.status(200).json(result);
  }
}
