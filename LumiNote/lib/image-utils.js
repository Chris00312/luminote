/**
 * Image upload utilities — 5 MB limit + auto-compress
 *
 * Shared by moodboard (drag-drop, paste) and notebook (create/edit dialog).
 * When a file exceeds MAX_BYTES it is down-scaled via OffscreenCanvas /
 * <canvas> and re-encoded as JPEG until the result fits.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/* ── helpers ────────────────────────────────────────────────────────── */

/** data-URL byte length (≈ 75 % of the base64 string length) */
function dataUrlBytes(dataUrl) {
  const idx = dataUrl.indexOf(',');
  if (idx < 0) return dataUrl.length;
  return Math.ceil((dataUrl.length - idx - 1) * 3 / 4);
}

/** Read a File/Blob as data-URL */
function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

/** Draw an image source onto a canvas and export as JPEG data-URL */
function compressViaCanvas(img, maxDim, quality) {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width  = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const c = document.createElement('canvas');
  c.width  = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return c.toDataURL('image/jpeg', quality);
}

/** Load a data-URL into an HTMLImageElement */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* ── public API ─────────────────────────────────────────────────────── */

/**
 * Process an image file before storage.
 * - If ≤ 5 MB → returns original data-URL unchanged.
 * - If > 5 MB → progressively compresses (shrink dimensions + lower JPEG
 *   quality) until the output is under 5 MB.
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} data-URL (original or compressed)
 */
export async function processImageFile(file) {
  const original = await readAsDataUrl(file);

  if (file.size <= MAX_BYTES) return original;

  // Need compression — load into Image element
  const img = await loadImage(original);

  // Progressive compression: try larger dims first, then shrink
  const attempts = [
    { maxDim: 3840, quality: 0.85 },
    { maxDim: 2560, quality: 0.80 },
    { maxDim: 1920, quality: 0.75 },
    { maxDim: 1440, quality: 0.70 },
    { maxDim: 1024, quality: 0.65 },
  ];

  for (const { maxDim, quality } of attempts) {
    const compressed = compressViaCanvas(img, maxDim, quality);
    if (dataUrlBytes(compressed) <= MAX_BYTES) return compressed;
  }

  // Final fallback — very aggressive
  return compressViaCanvas(img, 800, 0.60);
}

/**
 * Same as processImageFile but accepts an existing data-URL string.
 * Useful when the image is already read (e.g. from clipboard).
 *
 * @param {string} dataUrl
 * @returns {Promise<string>} data-URL (original or compressed)
 */
export async function processImageDataUrl(dataUrl) {
  if (dataUrlBytes(dataUrl) <= MAX_BYTES) return dataUrl;

  const img = await loadImage(dataUrl);

  const attempts = [
    { maxDim: 3840, quality: 0.85 },
    { maxDim: 2560, quality: 0.80 },
    { maxDim: 1920, quality: 0.75 },
    { maxDim: 1440, quality: 0.70 },
    { maxDim: 1024, quality: 0.65 },
  ];

  for (const { maxDim, quality } of attempts) {
    const compressed = compressViaCanvas(img, maxDim, quality);
    if (dataUrlBytes(compressed) <= MAX_BYTES) return compressed;
  }

  return compressViaCanvas(img, 800, 0.60);
}
