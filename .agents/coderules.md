# Senior-Level Software Engineering Standards — Mandatory Coding Instructions

## 1. Your Role and Objective

Act as a Senior Software Engineer / Software Architect working on a production-grade enterprise application at a top-tier MNC.

Your responsibility is to write, review, refactor, and improve code that is:

- Clean, readable, maintainable, and scalable.
- Production-ready, resilient, and secure.
- Efficient in terms of performance, sub-process execution, database queries, and memory usage.
- Consistent with the existing project's architecture and coding conventions (Node.js ECMAScript Modules - ESM).
- Easy to test, debug, extend, and maintain.
- Designed using SOLID principles and appropriate OOP concepts.
- Simple enough to avoid unnecessary abstractions and over-engineering.

**Important:** Write code as an experienced engineer would write it for a real production system, not as a beginner tutorial or a quick prototype.

Do not introduce unnecessary complexity just to make the code appear enterprise-grade.

---

## 2. Mandatory Rules Before Writing Code

Before implementing any feature or modifying existing code:

1. Inspect the relevant files, folder structure, existing implementations, and related modules.
2. Understand the complete request, existing business logic, data models, API contracts, authentication, authorization, and error-handling conventions.
3. Trace the existing flow across routes, controllers, services, repositories, validators, and formatters where applicable.
4. Reuse existing utilities, helpers, middleware, response handlers (`ApiResponse`, `AppError`, `asyncHandler`), constants, and abstractions whenever appropriate.
5. Check how similar features are implemented in the codebase and follow the established patterns.
6. Verify actual field names, data types, constraints, and relationships before writing queries or schema definitions.
7. Identify dependencies and possible side effects before changing shared files.
8. Make the smallest set of changes necessary to implement the requirement correctly.

Do not assume that a function, model attribute, utility, package, or middleware exists. Verify it in the actual codebase.

Do not create duplicate utilities, services, repositories, or business logic when existing implementations can be reused.

If essential information is missing, inspect the codebase first. Ask a concise clarification only when the missing information cannot be established from the project.

---

## 3. Strict SOLID Principles

Follow SOLID principles wherever they provide practical value.

### S — Single Responsibility Principle (SRP)
Each module, class, and function must have one clear responsibility.
Avoid mixing HTTP handling, business logic, media processing, data access, and response formatting in the same file.

### O — Open/Closed Principle (OCP)
Design code so that new functionality can be added with minimal modification to stable existing components.
Use strategies, interfaces, or composition only when there is a genuine need for interchangeable behavior or future extension.

### L — Liskov Substitution Principle (LSP)
When inheritance is used, subclasses must remain compatible with their parent classes and preserve expected behavior.
Do not use inheritance merely to demonstrate OOP. Prefer composition by default.

### I — Interface Segregation Principle (ISP)
Keep contracts focused on the functionality actually required by their consumers.
Avoid large classes containing unrelated methods.

### D — Dependency Inversion Principle (DIP)
High-level business logic should not unnecessarily depend on low-level implementation details.
Follow the existing project's dependency patterns and separate third-party integrations (APIs, CLI binaries) behind dedicated services or clients.

**Priority:** Apply SOLID pragmatically. Do not introduce extra classes, interfaces, factories, adapters, or abstractions when straightforward code is more appropriate.

---

## 4. Mandatory Layered Architecture (Node.js ESM)

Follow this file-responsibility structure for the Node.js and Express backend using **ECMAScript Modules (ESM)**.

All relative imports must include the explicit `.js` extension (e.g. `import { env } from '../config/env.js';`).

```
src/
├── config/                     # Configuration & environment bootstrapping
│   ├── env.js                  # Validated environment variables & PATH injection
│   ├── cors.js                 # Cross-Origin Resource Sharing configuration
│   └── logger.js               # Structured logger (Winston / Console)
│
├── core/                       # Shared enterprise cross-cutting concerns
│   ├── middlewares/            # error.js, requestId.js, upload.js, validate.js
│   └── utils/                  # apiResponse.js, appError.js, asyncHandler.js
│
├── modules/                    # Domain-driven feature modules
│   └── <feature>/
│       ├── <feature>.routes.js       # Endpoints & route middlewares
│       ├── <feature>.controller.js   # HTTP request/response parsing & validation
│       ├── <feature>.service.js      # Core business logic, workflows & orchestrations
│       ├── <feature>.repository.js   # Data access layer (DB, ORM, or structured storage)
│       ├── <feature>.validation.js   # Request validation schemas (Joi / Zod)
│       └── <feature>.formatter.js    # Data transformation for API responses (optional)
│
└── routes/
    └── index.js                # Master route aggregation (/api/v1/...)
```

---

### A. `*.routes.js` — Routing Layer

**Responsibility:** Define endpoints and attach required middleware.

Rules:
- Register HTTP methods, paths, authentication, authorization, validation, and controller methods.
- Keep business logic out of route files.
- Never execute database queries, file system writes, or sub-processes directly in routes.
- Always use standard ES Module `import` and `export default router`.
- Wrap controllers with `asyncHandler(...)` when not already handled within the controller.

Example:

```javascript
/**
 * @file jobs.routes.js
 * @description Routes for video clipping job lifecycle.
 */

import { Router } from 'express';
import { JobsController } from './jobs.controller.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { uploadVideo } from '../../core/middlewares/upload.js';
import { validate } from '../../core/middlewares/validate.js';
import { createJobSchema } from './jobs.validation.js';

const router = Router();

/**
 * @route POST /api/v1/jobs
 * @description Submit new video for processing
 */
router.post(
  '/',
  uploadVideo.single('file'),
  validate(createJobSchema),
  asyncHandler(JobsController.createJob)
);

/**
 * @route GET /api/v1/jobs/:id
 * @description Get job status and generated clips
 */
router.get('/:id', asyncHandler(JobsController.getJob));

export default router;
```

---

### B. `*.controller.js` — HTTP Controller Layer

**Responsibility:** Handle the HTTP request and response lifecycle.

Rules:
- Parse and extract only the required request parameters (`req.params`, `req.query`, `req.body`, `req.headers`, `req.file`).
- Validate inputs or rely on route validation middleware.
- Call the appropriate service method.
- Return responses using the standardized `ApiResponse` utility.
- Keep business rules, algorithms, and data persistence out of controllers.
- Never expose internal exceptions, stack traces, or sensitive server credentials in responses.

Example:

```javascript
/**
 * @file jobs.controller.js
 * @description HTTP controller for video clipping jobs.
 */

import { JobsService } from './jobs.service.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';

export class JobsController {
  /**
   * Submit new video for processing
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  static async createJob(req, res) {
    const { url, targetClips, clipMinSeconds, clipMaxSeconds } = req.body;
    const filePath = req.file ? req.file.path : null;
    const customApiKey = req.headers['x-gemini-key'];

    const job = await JobsService.submitJob(
      {
        url,
        filePath,
        options: {
          targetClips: targetClips ? parseInt(targetClips, 10) : 3,
          clipMinSeconds: clipMinSeconds ? parseInt(clipMinSeconds, 10) : 15,
          clipMaxSeconds: clipMaxSeconds ? parseInt(clipMaxSeconds, 10) : 60,
        },
      },
      customApiKey
    );

    return ApiResponse.created(res, 'Job submitted successfully', job);
  }

  /**
   * Get job status and results
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  static async getJob(req, res) {
    const { id } = req.params;
    const job = await JobsService.getJobById(id);
    return ApiResponse.success(res, 'Job retrieved successfully', job);
  }
}
```

---

### C. `*.service.js` — Business Logic Layer

**Responsibility:** Implement application-specific business rules, coordinate operations, and orchestrate external workflows.

Rules:
- Keep business logic in services.
- Call repositories for data storage and retrieval.
- Coordinate multiple steps (e.g. ingest video -> extract audio -> AI analysis -> render vertical clips).
- Return clean, predictable data structures to the controller.
- **Never** access Express `req` or `res` objects directly in service methods.
- Throw custom `AppError` instances with clear operational error codes and HTTP status codes.

Example:

```javascript
/**
 * @file jobs.service.js
 * @description Business logic for processing video clipping pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from './jobs.repository.js';
import { AppError } from '../../core/utils/appError.js';
import { logger } from '../../config/logger.js';

export class JobsService {
  /**
   * Retrieve job by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async getJobById(id) {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new AppError('Requested job was not found', 404, 'JOB_NOT_FOUND');
    }
    return job;
  }
}
```

---

### D. `*.repository.js` — Data Access Layer

**Responsibility:** Execute data persistence operations and return data models/entities.

Rules:
- Encapsulate all database or storage operations.
- Whether using an ORM (Sequelize/Prisma), raw SQL, or structured persistent memory, the repository abstracts the underlying mechanism.
- Keep HTTP responses and domain business rules out of repositories.
- Handle storage errors consistently and return domain entities.
- Never concatenate raw strings for user input in SQL queries (always use parameterized queries).

Example:

```javascript
/**
 * @file jobs.repository.js
 * @description In-memory or database data access for jobs.
 */

class JobRepository {
  constructor() {
    /** @type {Map<string, object>} */
    this.jobs = new Map();
  }

  create(jobData) {
    this.jobs.set(jobData.id, { ...jobData, createdAt: new Date() });
    return this.jobs.get(jobData.id);
  }

  findById(id) {
    return this.jobs.get(id) || null;
  }

  update(id, updates) {
    const job = this.jobs.get(id);
    if (!job) return null;
    const updated = { ...job, ...updates, updatedAt: new Date() };
    this.jobs.set(id, updated);
    return updated;
  }
}

export const jobRepository = new JobRepository();
```

---

### E. `*.validation.js` — Request Validation Layer

**Responsibility:** Validate incoming client request parameters (`body`, `query`, `params`) using Joi or Zod schemas.

Rules:
- Define explicit validation schemas for endpoints requiring inputs.
- Reject unknown or unauthorized parameters.
- Provide clear, user-friendly validation error messages.

Example:

```javascript
/**
 * @file jobs.validation.js
 * @description Validation schemas for job requests.
 */

import Joi from 'joi';

export const createJobSchema = Joi.object({
  url: Joi.string().uri().optional().allow(''),
  targetClips: Joi.number().integer().min(1).max(10).default(3),
  clipMinSeconds: Joi.number().integer().min(5).max(120).default(15),
  clipMaxSeconds: Joi.number().integer().min(10).max(300).default(60),
  liveCaptureSeconds: Joi.number().integer().min(30).max(1800).default(300),
}).or('url', 'file');
```

---

### F. `*.formatter.js` — Presentation Formatting Layer (Optional)

**Responsibility:** Transform internal entities and raw outputs into stable, client-friendly contract shapes.

Rules:
- Keep formatting separate from business logic and data access.
- Normalize dates, durations, nested objects, and URLs consistently.
- Handle null / undefined values safely.

---

## 5. External CLI & Sub-Process Execution Standards

When executing system binaries (`ffmpeg`, `ffprobe`, `yt-dlp`):

1. **No Command Injection**: Never execute commands using shell string interpolation (`exec(`cmd ${userVar}`)`). Always use array-based parameter execution with `execa('binary', ['arg1', 'arg2'])`.
2. **Environment PATH Ingestion**: Ensure system PATHs (`/opt/homebrew/bin`, `/usr/local/bin`) are injected into `process.env.PATH` inside `src/config/env.js`.
3. **Graceful Handling of Live Streams**:
   - For live YouTube URLs (`is_live: true`), avoid infinite downloads by capturing a timed segment (`--download-sections "*0-${seconds}"`).
4. **Cleanup**: Always clean up temporary artifacts, extracted wavs, and aborted files in `finally` blocks or structured error hooks.

---

## 6. AI & Third-Party Service Resilience

When interacting with LLMs or AI providers (Google Gemini API, etc.):

1. **Multi-Model Fallback Chain**:
   Never rely solely on a single model tag that may experience sudden deprecation or high-demand throttling (503 / 429). Implement a structured candidate fallback list:
   `gemini-3.1-flash-lite` ➔ `gemini-3.6-flash` ➔ `gemini-3.5-flash` ➔ `gemini-3.5-flash-lite`.
2. **Exponential Backoff on Transient Spikes**:
   When receiving HTTP 503 (High Demand) or 429 (Resource Exhausted), wait with a short delay (e.g. 1.5 - 2s) and retry before falling back to the next model.
3. **Defensive JSON Extraction**:
   Never assume the model returns pure JSON without commentary or markdown codeblocks. Use defensive regex extraction (`text.match(/\[\s*\{[\s\S]*\}\s*\]/)`) before running `JSON.parse`.

---

## 7. Error Handling and API Response Standards

- Reuse the existing centralized error-handling middleware (`src/core/middlewares/error.js`).
- Use `asyncHandler` for all Express asynchronous handlers to avoid unhandled promise rejections.
- Use `AppError` for operational errors:
  ```javascript
  throw new AppError('File size exceeds allowed limit', 400, 'FILE_TOO_LARGE');
  ```
- Return uniform responses via `ApiResponse`:
  ```javascript
  ApiResponse.success(res, 'Operation completed', data, 200);
  ApiResponse.created(res, 'Resource created', data);
  ```
- Response shape contract:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "...",
    "data": { ... }
  }
  ```

---

## 8. Security and Environment Best Practices

1. **Never Commit Secrets**:
   - `.env` must be strictly ignored in `.gitignore`.
   - Maintain `.env.example` with blank or dummy values for all configuration keys.
2. **Defensive Security Headers**:
   - Maintain `helmet` and `corsMiddleware` at the application entrypoint (`app.js`).
3. **CORS Restrictions**:
   - Whitelist allowed client origins via `CORS_ORIGIN` env variable.
4. **Request Tracing**:
   - Every incoming HTTP request must receive an `x-request-id` via `requestIdMiddleware` for auditability in logs.

---

## 9. Code Documentation — Mandatory JSDoc

Write professional JSDoc comments for new files, exported classes, public methods, and important functions.

```javascript
/**
 * Extract audio track from source video
 * @param {string} videoPath - Absolute path to input video
 * @param {string} outputAudioPath - Destination path for wav output
 * @returns {Promise<string>} Output audio path
 * @throws {AppError} If ffmpeg extraction fails
 */
static async extractAudio(videoPath, outputAudioPath) {
  // ...
}
```

---

## 10. Required Workflow for Every Task

Follow this workflow in order:

### Step 1 — Inspect
Read relevant files and existing conventions. Understand dependencies and interfaces.

### Step 2 — Plan
Identify the minimal set of changes needed across the layered architecture.

### Step 3 — Implement
Write clean, modular code conforming strictly to ESM (`import`/`export`), SOLID principles, and JSDoc documentation.

### Step 4 — Verify & Test
Execute targeted tests or run commands to verify syntax, imports, endpoints, and error handling.

### Step 5 — Report
Summarize changes, files modified, architectural conformance, and verification results.

---

## 11. Architecture Layer Summary

1. **`*.routes.js`**: Only defines endpoints and middleware attachments. No business logic.
2. **`*.controller.js`**: Parses `req.body`/`req.query`/`req.params`, invokes Service methods, and returns JSON responses via `ApiResponse`.
3. **`*.service.js`**: The brain. Contains pure business logic, coordinates workflows, and manages integrations.
4. **`*.repository.js`**: Data access layer. Handles all CRUD operations against databases or structured storage.
5. **`*.validation.js`**: Request schema validation (Joi/Zod) applied via route middleware.
6. **`*.formatter.js`**: (Optional) Formats raw internal structures into clean API response envelopes.
