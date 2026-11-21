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
 * Splits text into readable word-wrapped lines for viral title display.
 * @param {string} text
 * @param {number} [maxChars=26]
 * @returns {string[]}
 */
export const wrapTextLines = (text = '', maxChars = 26) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let current = '';

  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

/**
 * Generates viral reel title SVG overlay (CarryMinati / Shorts / Reels style).
 * Renders bold white multi-line text with shadow centered in the top black canvas area.
 * @param {string} hookText - Raw hook / title text
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
  const rawLines = wrapTextLines(cleanText, 26);
  const lines = rawLines.length > 0 ? rawLines : [cleanText];

  // Dynamic font sizing & line heights for optimal readability
  const fontSize = lines.length > 2 ? 46 : lines.length === 2 ? 50 : 54;
  const lineHeight = lines.length > 2 ? 62 : 68;
  const totalTextHeight = (lines.length - 1) * lineHeight;

  // Vertically center text in the top black zone (Y: 130 to videoTop - 40)
  const topSafe = 130;
  const bottomSafe = Math.max(topSafe + 80, videoTop - 40);
  const centerY = Math.round((topSafe + bottomSafe) / 2);
  const startY = Math.max(topSafe + fontSize, Math.round(centerY - (totalTextHeight / 2)));
  const centerX = Math.round(canvasWidth / 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
  </defs>
  <!-- Viral Bold Reel Title (Clean white text with drop shadow in top black canvas) -->
  <text x="${centerX}" y="${startY}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5" filter="url(#shadow)">
    ${lines.map((line, idx) => `<tspan x="${centerX}" dy="${idx === 0 ? 0 : lineHeight}">${line}</tspan>`).join('\n    ')}
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

