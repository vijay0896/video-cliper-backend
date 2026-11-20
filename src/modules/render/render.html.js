/**
 * HTML and SVG markup templates for video rendering overlays.
 */

/**
 * Escape HTML / XML special characters to prevent markup injection.
 * @param {string} str
 * @returns {string}
 */
export const escapeHtml = (str = '') => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Calculates optimal layout coordinates for the context pill banner.
 * @param {object} params
 * @param {string} params.hookText
 * @param {number} [params.videoTop=656]
 * @param {number} [params.canvasWidth=1080]
 * @returns {{ boxWidth: number, boxX: number, pillY: number, textY: number }}
 */
export const calculateHookLayout = ({ hookText, videoTop = 656, canvasWidth = 1080 }) => {
  const textLength = (hookText || '').length;
  const boxWidth = Math.min(1000, Math.max(450, textLength * 30 + 100));
  const boxX = Math.round((canvasWidth - boxWidth) / 2);

  // Position pill nicely just above the video frame (with 36px breathing room)
  const pillY = videoTop > 200 ? Math.round(videoTop - 110 - 36) : 140;
  const textY = pillY + 74;

  return { boxWidth, boxX, pillY, textY };
};

/**
 * Generates high-contrast SVG banner for the overall clip context / hook.
 * @param {string} hookText - Raw hook text
 * @param {number} [videoTop=656] - Top offset of video frame inside 9:16 canvas
 * @param {number} [canvasWidth=1080] - Canvas width
 * @param {number} [canvasHeight=1920] - Canvas height
 * @returns {string} SVG XML markup string
 */
export const generateHookSvgMarkup = (
  hookText,
  videoTop = 656,
  canvasWidth = 1080,
  canvasHeight = 1920
) => {
  const cleanText = escapeHtml(hookText);
  const { boxWidth, boxX, pillY, textY } = calculateHookLayout({
    hookText: cleanText,
    videoTop,
    canvasWidth,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>
  <!-- Modern Translucent Context Pill placed just above the video -->
  <rect x="${boxX}" y="${pillY}" width="${boxWidth}" height="110" rx="36" ry="36" fill="rgba(0, 0, 0, 0.78)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="3" filter="url(#shadow)" />
  <text x="${Math.round(canvasWidth / 2)}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="46" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
    ${cleanText}
  </text>
</svg>`;
};

/**
 * Generates an HTML/CSS overlay template for web or Chromium-based rendering pipelines.
 * @param {string} hookText
 * @param {number} [videoTop=656]
 * @returns {string} HTML string
 */
export const generateHookHtmlOverlay = (hookText, videoTop = 656) => {
  const cleanText = escapeHtml(hookText);
  const pillY = videoTop > 200 ? Math.round(videoTop - 110 - 36) : 140;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1920px;
      background: transparent;
      display: flex;
      justify-content: center;
      font-family: Arial, Helvetica, sans-serif;
      position: relative;
    }
    .hook-pill {
      position: absolute;
      top: ${pillY}px;
      padding: 24px 48px;
      background: rgba(0, 0, 0, 0.78);
      border: 3px solid rgba(255, 255, 255, 0.22);
      border-radius: 36px;
      color: #FFFFFF;
      font-size: 46px;
      font-weight: 900;
      letter-spacing: 1px;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.85);
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="hook-pill">${cleanText}</div>
</body>
</html>`;
};

