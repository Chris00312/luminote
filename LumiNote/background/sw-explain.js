/**
 * sw-explain.js — AI explain flow.
 *
 * LumiNote is BYOK-only: every request goes straight from the extension to
 * the AI provider the user configured in Settings. There is no backend proxy,
 * no account, and no quota — the user's own API key (and the provider's own
 * rate limits) is the only thing in the loop.
 */

import { streamExplain, loadConfig } from '../lib/api-providers.js';
import { buildMessages, parseRelatedConcepts, stripRelatedMarker, parseTags, stripTagsMarker } from '../lib/prompts.js';

/* ─── Explain request ───────────────────────────────────────────── */

export async function handleExplainRequest(message, target) {
  const { selectedText, context, markType, imageUrl, imageAlt, sourceTitle } = message;
  let depth = message.depth || 'brief';

  const config = await loadConfig();

  // ── No API key configured — tell the user where to set it ──────
  if (!config.apiKey) {
    relayExplainMessage(target, {
      type: message.type === 'PDF_EXPLAIN_REQUEST' ? 'PDF_EXPLAIN_ERROR' : 'EXPLAIN_ERROR',
      error: 'NO_API_KEY',
      depth,
    });
    return;
  }

  // ── BYOK path — direct call to the user's configured provider ──
  const isVisual = markType === 'image' || markType === 'screenshot';
  const includeImagePayload = isVisual && imageUrl && providerSupportsImageInput(config.provider);
  const imageAsset = includeImagePayload
    ? await prepareImageAsset(imageUrl)
    : null;
  const messages = buildMessages({
    markType: markType || 'text',
    selectedText,
    context,
    imageUrl: includeImagePayload ? imageUrl : '',
    imageAlt,
    imageMimeType: imageAsset?.mimeType || '',
    imageData: imageAsset?.data || '',
    sourceTitle: sourceTitle || '',
    depth,
    outputLanguage: config.outputLanguage || 'English',
  });

  // depth-based max_tokens — brief=256, detailed=1024, deep=2048
  const depthMaxTokens = { brief: 256, detailed: 1024, deep: 2048 };
  const maxTokens = depthMaxTokens[depth] || 2048;

  let fullText = '';

  await streamExplain({
    messages,
    config,
    maxTokens,
    onChunk(chunk) {
      fullText += chunk;
      relayExplainMessage(target, {
        type: message.type === 'PDF_EXPLAIN_REQUEST' ? 'PDF_EXPLAIN_CHUNK' : 'EXPLAIN_CHUNK',
        chunk,
        depth,
      });
    },
    onDone() {
      const related = depth === 'deep' ? parseRelatedConcepts(fullText) : [];
      const tags = parseTags(fullText);
      let cleanText = depth === 'deep' ? stripRelatedMarker(fullText) : fullText;
      cleanText = stripTagsMarker(cleanText);

      relayExplainMessage(target, {
        type: message.type === 'PDF_EXPLAIN_REQUEST' ? 'PDF_EXPLAIN_DONE' : 'EXPLAIN_DONE',
        depth,
        fullText: cleanText,
        related,
        tags,
      });
    },
    onError(error) {
      relayExplainMessage(target, {
        type: message.type === 'PDF_EXPLAIN_REQUEST' ? 'PDF_EXPLAIN_ERROR' : 'EXPLAIN_ERROR',
        error,
        depth,
      });
    },
  });
}

export function relayExplainMessage(target, payload) {
  if (target.tabId) {
    chrome.tabs.sendMessage(target.tabId, payload).catch(() => {});
    return;
  }

  if (target.extensionRuntime) {
    chrome.runtime.sendMessage(payload).catch(() => {});
  }
}

export function providerSupportsImageInput(/* provider */) {
  return true;
}

export async function prepareImageAsset(imageUrl) {
  try {
    // Handle data URLs directly — no need to fetch
    const dataMatch = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (dataMatch) {
      return {
        mimeType: dataMatch[1],
        data: dataMatch[2],
      };
    }

    const response = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type || !blob.type.startsWith('image/')) {
      return null;
    }

    const data = await blobToBase64(blob);
    return {
      mimeType: blob.type,
      data,
    };
  } catch {
    return null;
  }
}

export function blobToBase64(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }

    return btoa(binary);
  });
}
