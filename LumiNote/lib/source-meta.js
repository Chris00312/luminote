/**
 * LumiRead — Source metadata helpers
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'chrome-extension:']);

/** Sanitize a URL: only allow safe protocols, return '' for dangerous schemes. */
function sanitizeHref(url) {
  if (!url) return '';
  const parsed = tryParseUrl(url);
  if (!parsed || !ALLOWED_PROTOCOLS.has(parsed.protocol)) return '';
  return url;
}

export function getEntrySourceMeta(entry) {
  if (entry?.sourceKind === 'pdf') {
    return getPdfSourceMeta(entry);
  }

  const parsed = tryParseUrl(entry?.sourceUrl);
  const hostname = parsed?.hostname?.replace(/^www\./, '') || '';

  return {
    href: sanitizeHref(entry?.sourceUrl),
    label: hostname || (entry?.sourceUrl || ''),
    title: entry?.sourceTitle || entry?.sourceUrl || '',
    pageLabel: '',
    rel: 'noopener noreferrer',
  };
}

function getPdfSourceMeta(entry) {
  const parsed = tryParseUrl(entry?.sourceUrl);
  const fileName = entry?.sourceName || getFileNameFromUrl(entry?.sourceUrl) || 'PDF';
  const isLocalFile = parsed?.protocol === 'file:';
  const hostname = parsed?.hostname?.replace(/^www\./, '') || '';

  let label = fileName;
  if (!isLocalFile && hostname && fileName === 'PDF') {
    label = `PDF · ${hostname}`;
  }

  return {
    href: buildPdfViewerUrl(entry),
    label: isLocalFile ? fileName || 'Local PDF' : label,
    title: entry?.sourceTitle || fileName || entry?.sourceUrl || 'PDF',
    pageLabel: entry?.sourcePage ? `p.${entry.sourcePage}` : '',
    rel: 'noopener noreferrer',
  };
}

function buildPdfViewerUrl(entry) {
  const sourceUrl = entry?.sourceUrl || '';
  if (!sourceUrl) return '';

  try {
    const viewerUrl = new URL(chrome.runtime.getURL('pdf-viewer/pdf-viewer.html'));
    viewerUrl.searchParams.set('src', sourceUrl);

    if (entry?.id) {
      viewerUrl.searchParams.set('entryId', entry.id);
    }

    if (Number.isFinite(entry?.sourcePage)) {
      viewerUrl.searchParams.set('page', String(entry.sourcePage));
    }

    return viewerUrl.toString();
  } catch {
    return sourceUrl;
  }
}

function getFileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : '';
  } catch {
    return '';
  }
}

function tryParseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
