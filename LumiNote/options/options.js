/**
 * LumiRead — Options Page JS
 */

import { PROVIDERS } from '../lib/api-providers.js';
import { initLocale, setLocale, applyI18n, t } from '../lib/i18n.js';

const MODEL_HINTS = {
  [PROVIDERS.OPENAI_COMPAT]: 'e.g. gpt-4o-mini, gpt-4o, deepseek-chat, qwen-turbo',
  [PROVIDERS.CLAUDE]: 'e.g. claude-haiku-4-5-20251001, claude-sonnet-4-6',
  [PROVIDERS.GEMINI]: 'e.g. gemini-1.5-flash, gemini-1.5-pro',
  [PROVIDERS.VOLCENGINE]: 'doubao-seed-2.0-code（支持视觉） · doubao-seed-2.0-pro · doubao-seed-2.0-lite · minimax-m2.5 · glm-4.7 · deepseek-v3.2 · kimi-k2.5 · ark-code-latest',
  [PROVIDERS.MINIMAX]: 'MiniMax-M2.7 · MiniMax-M2.7-highspeed',
  [PROVIDERS.ALIYUN]: 'qwen3.5-plus · qwen3-coder-plus · qwen3-max-2026-01-23 · qwen3-coder-next · kimi-k2.5 · glm-4.7 · MiniMax-M2.5',
};

const MODEL_DEFAULTS = {
  [PROVIDERS.OPENAI_COMPAT]: 'gpt-4o-mini',
  [PROVIDERS.CLAUDE]: 'claude-haiku-4-5-20251001',
  [PROVIDERS.GEMINI]: 'gemini-1.5-flash',
  [PROVIDERS.VOLCENGINE]: 'ark-code-latest',
  [PROVIDERS.MINIMAX]: 'MiniMax-M2.7',
  [PROVIDERS.ALIYUN]: 'qwen3.5-plus',
};

// MiniMax supported models for the quick-select dropdown
const MINIMAX_MODELS = [
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
];

// Aliyun Coding Plan supported models for the quick-select dropdown
const ALIYUN_MODELS = [
  'qwen3.5-plus',
  'qwen3-coder-plus',
  'qwen3-max-2026-01-23',
  'qwen3-coder-next',
  'kimi-k2.5',
  'glm-4.7',
  'MiniMax-M2.5',
];

// Volcengine supported models for the quick-select dropdown
const VOLCENGINE_MODELS = [
  'ark-code-latest',
  'doubao-seed-2.0-code',
  'doubao-seed-2.0-pro',
  'doubao-seed-2.0-lite',
  'doubao-seed-code',
  'minimax-m2.5',
  'glm-4.7',
  'deepseek-v3.2',
  'kimi-k2.5',
];

const $ = (id) => document.getElementById(id);
const IS_EMBEDDED = new URLSearchParams(window.location.search).get('embedded') === '1';
/* ─── Init ──────────────────────────────────────────────────────── */

async function init() {
  document.body.classList.toggle('settings-embedded', IS_EMBEDDED);
  const config = await loadConfig();

  // Init i18n
  await initLocale();
  applyI18n();

  // BYOK is the only mode — the AI fields are always enabled.
  const customAIFields = $('custom-ai-fields');
  if (customAIFields) customAIFields.classList.remove('disabled');

  $('provider').value = config.provider;
  $('endpoint').value = config.endpoint;
  $('apiKey').value = config.apiKey;
  $('model').value = config.model;

  // Provider 2 (deep think)
  $('p2provider').value = config.p2provider || '';
  $('p2endpoint').value = config.p2endpoint || '';
  $('p2apiKey').value = config.p2apiKey || '';
  $('p2model').value = config.p2model || '';
  updateP2UI(config.p2provider || '');

  // Vision model
  $('visionProvider').value = config.visionProvider || '';
  $('visionEndpoint').value = config.visionEndpoint || '';
  $('visionApiKey').value = config.visionApiKey || '';
  $('visionModel').value = config.visionModel || '';
  updateVisionUI(config.visionProvider || '');

  $('displayLanguage').value = config.displayLanguage;
  $('outputLanguage').value = config.outputLanguage;
  $('aiSummaryDepth').value = config.aiSummaryDepth;

  updateProviderUI(config.provider);

  // Live-switch UI language (the stored value is the only source; no auto-detect)
  $('displayLanguage').addEventListener('change', () => {
    setLocale($('displayLanguage').value);
    applyI18n();
  });

  $('provider').addEventListener('change', () => {
    const p = $('provider').value;
    updateProviderUI(p);
    if (!$('model').value || Object.values(MODEL_DEFAULTS).includes($('model').value)) {
      $('model').value = MODEL_DEFAULTS[p] || '';
    }
  });

  $('p2provider').addEventListener('change', () => {
    updateP2UI($('p2provider').value);
  });

  $('p2-toggle-password')?.addEventListener('click', () => {
    const input = $('p2apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('visionProvider').addEventListener('change', () => {
    updateVisionUI($('visionProvider').value);
  });

  $('vision-toggle-password')?.addEventListener('click', () => {
    const input = $('visionApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('save-btn').addEventListener('click', async () => {
    await saveConfig();
  });
  $('test-btn').addEventListener('click', testConnection);
  $('fetch-models-btn')?.addEventListener('click', fetchModels);

  $('toggle-password').addEventListener('click', () => {
    const input = $('apiKey');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
  });

  // ── Data Export ──────────────────────────────────────────────
  $('export-json-btn')?.addEventListener('click', async () => {
    const status = $('export-status');
    status.textContent = 'Exporting...';
    try {
      const { exportAsJSON, downloadFile } = await import('../lib/data-export.js');
      const json = await exportAsJSON();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(json, `luminote-export-${date}.json`, 'application/json');
      status.textContent = 'Export complete!';
      setTimeout(() => { status.textContent = ''; }, 3000);
    } catch (e) {
      status.textContent = `Export failed: ${e.message}`;
    }
  });

  $('export-md-btn')?.addEventListener('click', async () => {
    const status = $('export-status');
    status.textContent = 'Exporting...';
    try {
      const { exportAsMarkdown, downloadFile } = await import('../lib/data-export.js');
      const md = await exportAsMarkdown();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(md, `luminote-export-${date}.md`, 'text/markdown');
      status.textContent = 'Export complete!';
      setTimeout(() => { status.textContent = ''; }, 3000);
    } catch (e) {
      status.textContent = `Export failed: ${e.message}`;
    }
  });

}

function updateP2UI(provider) {
  const endpointGroup = $('p2-endpoint-group');
  if (endpointGroup) {
    endpointGroup.style.display = provider === PROVIDERS.OPENAI_COMPAT ? 'flex' : 'none';
  }
}

function updateVisionUI(provider) {
  const endpointGroup = $('vision-endpoint-group');
  if (endpointGroup) {
    endpointGroup.style.display = provider === PROVIDERS.OPENAI_COMPAT ? 'flex' : 'none';
  }
}

function updateProviderUI(provider) {
  const endpointGroup = $('endpoint-group');
  const modelHint = $('model-hint');
  const modelGroup = $('model-group');

  // Show endpoint field only for generic OpenAI-compat (other providers have fixed endpoints)
  endpointGroup.style.display = provider === PROVIDERS.OPENAI_COMPAT ? 'flex' : 'none';
  modelHint.textContent = MODEL_HINTS[provider] || '';

  // Tear down all provider-specific select dropdowns and banners first
  $('volcengine-model-select')?.remove();
  $('minimax-model-select')?.remove();
  $('aliyun-model-select')?.remove();
  $('model').style.display = '';
  const volcBanner = $('volcengine-banner');
  if (volcBanner) volcBanner.style.display = 'none';
  const mmBanner = $('minimax-banner');
  if (mmBanner) mmBanner.style.display = 'none';
  const aliyunBanner = $('aliyun-banner');
  if (aliyunBanner) aliyunBanner.style.display = 'none';

  if (provider === PROVIDERS.VOLCENGINE) {
    // Quick-select dropdown
    const sel = document.createElement('select');
    sel.id = 'volcengine-model-select';
    sel.className = 'md3-select';
    sel.style.marginBottom = '4px';
    VOLCENGINE_MODELS.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'ark-code-latest' ? `${m}  （控制台管理）` : m;
      sel.appendChild(opt);
    });
    sel.value = $('model').value || 'ark-code-latest';
    sel.addEventListener('change', () => { $('model').value = sel.value; });
    $('model').style.display = 'none';
    modelGroup.insertBefore(sel, $('model'));

    // Info banner
    let banner = $('volcengine-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'volcengine-banner';
      banner.className = 'provider-banner';
      banner.innerHTML = `
        <div class="banner-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <strong>Volcengine 方舟 Coding Plan</strong>
        </div>
        <div class="banner-detail">Base URL (固定): <code>https://ark.cn-beijing.volces.com/api/coding/v3</code></div>
        <div class="banner-detail">选择 <code>ark-code-latest</code> 可在控制台切换模型（含 Auto 模式）</div>
        <a class="banner-link" href="https://console.volcengine.com/ark/region:ark+cn-beijing/apikey" target="_blank">获取 API Key →</a>
      `;
      endpointGroup.after(banner);
    }
    banner.style.display = 'block';
  } else if (provider === PROVIDERS.MINIMAX) {
    // Quick-select dropdown
    const sel = document.createElement('select');
    sel.id = 'minimax-model-select';
    sel.className = 'md3-select';
    sel.style.marginBottom = '4px';
    MINIMAX_MODELS.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'MiniMax-M2.7-highspeed' ? `${m}  (极速版)` : m;
      sel.appendChild(opt);
    });
    sel.value = $('model').value || 'MiniMax-M2.7';
    sel.addEventListener('change', () => { $('model').value = sel.value; });
    $('model').style.display = 'none';
    modelGroup.insertBefore(sel, $('model'));

    // Info banner
    let banner = $('minimax-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'minimax-banner';
      banner.className = 'provider-banner';
      banner.innerHTML = `
        <div class="banner-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <strong>MiniMax Token Plan</strong>
        </div>
        <div class="banner-detail">Base URL (固定): <code>https://api.minimaxi.com/anthropic</code>（兼容 Anthropic 协议）</div>
        <div class="banner-detail">M2.7 按请求计费，每 5 小时滚动重置；极速版订阅选 M2.7-highspeed</div>
        <div class="banner-detail">⚠️ Token Plan 专属 Key，仅限 AI 编程工具使用</div>
        <a class="banner-link" href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank">获取 Token Plan API Key →</a>
      `;
      endpointGroup.after(banner);
    }
    banner.style.display = 'block';
  } else if (provider === PROVIDERS.ALIYUN) {
    // Quick-select dropdown
    const sel = document.createElement('select');
    sel.id = 'aliyun-model-select';
    sel.className = 'md3-select';
    sel.style.marginBottom = '4px';
    ALIYUN_MODELS.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
    sel.value = $('model').value || 'qwen3.5-plus';
    sel.addEventListener('change', () => { $('model').value = sel.value; });
    $('model').style.display = 'none';
    modelGroup.insertBefore(sel, $('model'));

    // Info banner
    let banner = $('aliyun-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'aliyun-banner';
      banner.className = 'provider-banner';
      banner.innerHTML = `
        <div class="banner-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <strong>Aliyun Coding Plan (阿里云百炼)</strong>
        </div>
        <div class="banner-detail">Base URL (固定): <code>https://coding.dashscope.aliyuncs.com/v1</code></div>
        <div class="banner-detail">仅限 AI 编程工具使用，禁止自动化脚本或应用后端调用</div>
        <a class="banner-link" href="https://bailian.console.aliyun.com/" target="_blank">获取 Coding Plan API Key →</a>
      `;
      endpointGroup.after(banner);
    }
    banner.style.display = 'block';
  }
}

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        provider: PROVIDERS.OPENAI_COMPAT,
        apiKey: '',
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        displayLanguage: 'en',
        outputLanguage: 'English',
        aiSummaryDepth: 'brief',
        p2provider: '',
        p2apiKey: '',
        p2endpoint: 'https://api.openai.com/v1',
        p2model: '',
        visionProvider: '',
        visionApiKey: '',
        visionEndpoint: 'https://api.openai.com/v1',
        visionModel: '',
      },
      resolve
    );
  });
}

async function saveConfig() {
  const config = {
    provider: $('provider').value,
    apiKey: $('apiKey').value.trim(),
    endpoint: $('endpoint').value.trim() || 'https://api.openai.com/v1',
    model: $('model').value.trim(),
    displayLanguage: $('displayLanguage').value,
    outputLanguage: $('outputLanguage').value,
    aiSummaryDepth: $('aiSummaryDepth').value,
    p2provider: $('p2provider').value,
    p2apiKey: $('p2apiKey').value.trim(),
    p2endpoint: $('p2endpoint').value.trim() || 'https://api.openai.com/v1',
    p2model: $('p2model').value.trim(),
    visionProvider: $('visionProvider').value,
    visionApiKey: $('visionApiKey').value.trim(),
    visionEndpoint: $('visionEndpoint').value.trim() || 'https://api.openai.com/v1',
    visionModel: $('visionModel').value.trim(),
  };

  await new Promise((resolve) => chrome.storage.sync.set(config, resolve));

  const status = $('save-status');
  status.textContent = t('settings_saved');
  status.classList.add('save-status--visible');
  setTimeout(() => status.classList.remove('save-status--visible'), 2500);
}

async function testConnection() {
  const btn = $('test-btn');
  const result = $('test-result');

  btn.disabled = true;
  btn.textContent = 'Testing…';
  result.textContent = '';
  result.className = 'test-result';

  // Save current values first so testConnection uses them
  await saveConfig();

  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      Test Connection
    `;

    if (response?.ok) {
      result.textContent = '✓ Connected — ' + (response.message || 'OK');
      result.className = 'test-result test-result--ok';
    } else {
      result.textContent = '✗ ' + (response?.error || 'Connection failed');
      result.className = 'test-result test-result--error';
    }

    notifyEmbeddedHeight();
  });
}

/**
 * F1: Fetch provider's model list (OpenAI-compat only).
 * Populates the <datalist id="model-list"> so users get autocomplete.
 */
async function fetchModels() {
  const btn = $('fetch-models-btn');
  const datalist = $('model-list');
  const hint = $('model-hint');
  if (!btn || !datalist) return;

  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>…</span>';
  // Save current values first so listModels uses them
  await saveConfig();

  try {
    const { listModels } = await import('../lib/api-providers.js');
    const resp = await listModels();
    if (!resp.ok) {
      if (hint) {
        hint.textContent = '✗ ' + resp.error;
        hint.style.color = 'var(--ln-error, #ba1a1a)';
      }
      return;
    }
    // Populate datalist
    datalist.innerHTML = resp.models.map((m) =>
      `<option value="${m.replace(/"/g, '&quot;')}"></option>`
    ).join('');
    if (hint) {
      hint.textContent = `✓ Found ${resp.models.length} models — start typing to filter`;
      hint.style.color = 'var(--ln-primary, #1a6b4a)';
    }
    // Focus the input so the user sees the datalist suggestion arrow
    $('model')?.focus();
  } catch (e) {
    if (hint) {
      hint.textContent = '✗ ' + (e.message || String(e));
      hint.style.color = 'var(--ln-error, #ba1a1a)';
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    notifyEmbeddedHeight();
  }
}

function notifyEmbeddedHeight() {
  if (!IS_EMBEDDED) return;

  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--settings-embedded-height', `${document.documentElement.scrollHeight}px`);
  });
}

document.addEventListener('DOMContentLoaded', init);
