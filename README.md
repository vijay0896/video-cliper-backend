# Video Clipper Backend

High-performance Node.js ESM backend for AI-powered video clipping and YouTube Shorts / TikTok Reels generation.

## Features
- **YouTube Video & Live Stream Support**: Ingest standard YouTube videos or capture active live streams with `yt-dlp`.
- **AI Moment Detection**: Uses Google Gemini Multimodal API (`gemini-3.1-flash-lite` / `gemini-3.6-flash`) for audio analysis, viral hook generation, and word-level timestamp alignment.
- **Vertical 9:16 Rendering**: Automated FFmpeg compositing with 1080x1920 blurred background and centered source video.
- **Layered Architecture**: Strictly follows Clean Architecture principles (Config, Core, Modules with Controllers, Services, Repositories, Routes).

## Tech Stack
- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **AI / LLM**: `@google/genai` (Google Gemini)
- **Media Processing**: `ffmpeg`, `ffprobe`, `yt-dlp`
- **Security & Logging**: Helmet, CORS, Morgan, Winston

## Getting Started

### Prerequisites
- Node.js (v18+)
- FFmpeg & ffprobe
- yt-dlp

```bash
# macOS
brew install ffmpeg yt-dlp
```

### Setup
1. Clone the repository:
```bash
git clone https://github.com/vijay0896/video-cliper-backend.git
cd video-cliper-backend
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

4. Start development server:
```bash
npm run dev
```

Server runs on `http://localhost:5050` by default.
