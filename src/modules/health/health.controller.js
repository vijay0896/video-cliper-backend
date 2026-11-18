import { ApiResponse } from '../../core/utils/apiResponse.js';

export class HealthController {
  static getHealth(req, res) {
    return ApiResponse.success(res, 'OpenShorts Node.js backend is healthy', {
      status: 'ready',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}

