/**
 * LumiNote — Deep Think Orchestration
 *
 * Sends the user's question to both Provider 1 (primary) and Provider 2 (deep think),
 * then synthesizes their answers into a final streaming response.
 *
 * Flow:
 *   1. Classify question type
 *   2. Load both provider configs
 *   3. Send question to P1 (authoritative) and P2 (adaptive role) in parallel
 *   4. Synthesize via P1 with streaming output
 */

import { loadConfig, streamExplain } from './api-providers.js';

const EXPERT_TIMEOUT_MS = 90_000;
/* ─── Adaptive Expert 2 Role Profiles ────────────────────────────── */

const ROLE_PROFILES = {
  debate: {
    expert1: `你是一位权威领域专家。请基于主流共识、最佳实践和充分的论据，给出全面、深入的分析。立场明确，论证有力。`,
    expert2: `你是"红队"对抗专家。你的任务是论证与主流观点相反的立场。

规则：
1. 找出该问题最热门或最"安全"的答案，然后系统性地反驳它。
2. 为少数派或逆主流的立场构建有说服力的、基于证据的论证。
3. 你必须坚守对立立场——不要用"双方都有道理"来骑墙。
4. 使用真实案例、数据和边界情况来支撑你的逆向论点。
5. 如果所有人都会说 X，你就说"非 X"并彻底论证。

你的目标是通过对抗实现思维严谨，而非寻求共识。`,
    synthesis: `你是综合分析专家。两位专家从对立角度分析了同一个问题——一位持主流立场，另一位作为红队进行了系统性反驳。

**原始问题：** {question}

{experts}

请将两种对立观点综合为一个平衡、高质量的回答：
- 整合双方最有力的论点，不偏不倚。
- 在分歧之处，解释微妙差异和适用条件——不要简单选边站。
- 呈现一个承认复杂性的全面结论。
- 不要提及"专家 1"或"专家 2"——以一篇连贯的分析呈现。`,
  },

  technical: {
    expert1: `你是一位资深技术专家。请给出你认为最佳的技术方案，包含具体的实现细节、代码示例（如适用）和架构考量。`,
    expert2: `你是一位持不同技术路线的资深工程师。你的任务是提出一种完全不同的技术方案来解决同一个问题。

规则：
1. 不要沿用显而易见或最流行的技术方案。
2. 提出一种替代方案——可以是不同的技术栈、不同的架构模式、或不同的设计哲学。
3. 详细论证你的替代方案的优势，以及主流方案可能忽略的问题。
4. 给出具体的实现思路和技术细节。
5. 明确指出你的方案在什么场景下更优，什么场景下不适用。`,
    synthesis: `你是技术方案评审专家。两位工程师针对同一个技术问题提出了不同的方案。

**原始问题：** {question}

{experts}

请综合两个方案，给出最终的技术建议：
- 对比两种方案的优劣，给出清晰的适用场景分析。
- 如果可以融合两者的优点，给出融合方案。
- 如果必须二选一，给出明确推荐及理由。
- 提供具体可落地的实现建议。
- 不要提及"专家 1"或"专家 2"——直接呈现技术分析。`,
  },

  risk: {
    expert1: `你是一位权威领域专家。请对该问题给出全面、乐观但务实的分析，重点关注机会、优势和最佳路径。`,
    expert2: `你是一位风险审计专家和压力测试者。你的任务是找出方案、观点或计划中所有可能的漏洞、风险和失败模式。

规则：
1. 系统性地检查每一个假设，找出隐含的前提条件。
2. 列举最可能的失败场景和边界情况。
3. 评估最坏情况下的后果和影响范围。
4. 指出被忽视的依赖关系、隐性成本和二阶效应。
5. 对每个风险给出严重程度评估（高/中/低）。

你的目标是确保没有盲点，而非否定方案本身。`,
    synthesis: `你是决策分析专家。一位专家给出了积极的分析，另一位风险审计专家进行了系统性的压力测试。

**原始问题：** {question}

{experts}

请综合为一个既看到机会又正视风险的完整分析：
- 保留积极分析中的核心洞见和机会。
- 整合风险审计中发现的关键风险和盲点。
- 对每个重要风险给出缓解建议。
- 给出一个务实的行动方案，标注关键决策点和风险检查项。
- 不要提及"专家 1"或"专家 2"——直接呈现分析。`,
  },

  creative: {
    expert1: `你是该领域的资深专家。请从本领域的专业视角给出深入、系统的分析和建议。`,
    expert2: `你是一位跨学科思维专家。你的任务是从完全不同的学科或领域引入视角来分析这个问题。

规则：
1. 从至少 2-3 个不同的学科视角（如心理学、经济学、生物学、哲学、艺术、物理学等）来审视这个问题。
2. 找出与其他领域中类似问题的类比和模式。
3. 提出本领域专家可能想不到的创新思路。
4. 用其他学科的框架和概念重新定义问题。
5. 给出具有启发性的、非常规的解决方向。

你的目标是打破思维定式，带来跨领域的灵感。`,
    synthesis: `你是创新整合专家。一位领域专家给出了专业分析，另一位跨学科思维者带来了来自其他领域的全新视角。

**原始问题：** {question}

{experts}

请将专业深度与跨领域灵感融合为一个富有洞察力的回答：
- 保留领域专家的核心专业分析。
- 整合跨学科视角中最有启发性的观点。
- 找出不同视角之间的共鸣点和创新交叉点。
- 给出既有专业深度又有创新视野的综合建议。
- 不要提及"专家 1"或"专家 2"——以一篇连贯的分析呈现。`,
  },
};

/* ─── Question Classifier ────────────────────────────────────────── */

/**
 * Classify question into a role profile type.
 * Uses keyword heuristics — fast, no API call needed.
 */
function classifyQuestion(text) {
  const t = text.toLowerCase();

  // Debate: decisions, comparisons, opinions, should/whether
  const debatePatterns = [
    /应该.+还是/, /该不该/, /好还是/, /值不值/, /是否应该/,
    /vs\.?/i, /versus/i, /or\b.*\bshould/i, /should\s+\w+\s+or/i,
    /哪个更好/, /如何选择/, /怎么选/, /利弊/, /优劣/,
    /有没有必要/, /是不是/, /对不对/, /合理吗/, /值得吗/,
    /争议/, /观点/, /看法/, /立场/,
  ];

  // Technical: implementation, how-to, code, architecture
  const techPatterns = [
    /怎么实现/, /如何实现/, /怎么写/, /如何写/, /代码/,
    /how\s+to/i, /implement/i, /architecture/i, /design\s+pattern/i,
    /技术方案/, /架构/, /部署/, /性能优化/, /算法/,
    /bug/, /error/, /报错/, /异常/, /调试/, /debug/i,
    /api/, /sdk/, /框架/, /数据库/, /缓存/,
    /配置/, /搭建/, /集成/, /迁移/,
  ];

  // Risk: evaluation, planning, feasibility, strategy
  const riskPatterns = [
    /风险/, /可行性/, /评估/, /分析.*方案/, /计划/,
    /risk/i, /feasib/i, /evaluat/i, /assess/i,
    /会不会失败/, /有什么隐患/, /可能的问题/,
    /投资/, /创业/, /商业模式/, /市场/,
    /安全/, /合规/, /法律/, /监管/,
    /战略/, /策略/, /规划/, /预测/,
  ];

  // Score each category
  const scores = {
    debate: debatePatterns.reduce((s, p) => s + (p.test(t) ? 1 : 0), 0),
    technical: techPatterns.reduce((s, p) => s + (p.test(t) ? 1 : 0), 0),
    risk: riskPatterns.reduce((s, p) => s + (p.test(t) ? 1 : 0), 0),
  };

  // Find highest scoring category
  const maxScore = Math.max(scores.debate, scores.technical, scores.risk);

  if (maxScore === 0) return 'creative'; // default: cross-discipline for open-ended questions
  if (scores.technical >= scores.debate && scores.technical >= scores.risk) return 'technical';
  if (scores.debate >= scores.risk) return 'debate';
  return 'risk';
}

/* ─── Provider 2 Config ──────────────────────────────────────────── */

/**
 * Load Provider 2 config. Returns null if not configured.
 */
async function loadP2Config() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { p2provider: '', p2apiKey: '', p2endpoint: 'https://api.openai.com/v1', p2model: '' },
      (r) => {
        if (!r.p2provider || !r.p2apiKey) return resolve(null);
        resolve({
          provider: r.p2provider,
          apiKey: r.p2apiKey,
          endpoint: r.p2endpoint || 'https://api.openai.com/v1',
          model: r.p2model || 'gpt-4o-mini',
        });
      }
    );
  });
}

/* ─── Expert Caller ──────────────────────────────────────────────── */

/**
 * Call one provider non-streaming with a timeout.
 * @param {string} label
 * @param {Array}  messages
 * @param {object} config
 * @param {string} [systemPrompt] - optional system prompt prepended to messages
 * Returns { label, text } or { label, error }.
 */
async function askExpert(label, messages, config, systemPrompt) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ label, error: 'timeout' }),
      EXPERT_TIMEOUT_MS
    );

    const msgs = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    let collected = '';
    streamExplain({
      messages: msgs,
      config,
      onChunk: (t) => { collected += t; },
      onDone: () => {
        clearTimeout(timer);
        resolve({ label, text: collected.trim() });
      },
      onError: (err) => {
        clearTimeout(timer);
        resolve({ label, error: String(err) });
      },
    });
  });
}

/* ─── Main Orchestration ─────────────────────────────────────────── */

/**
 * Run deep think: classify → parallel expert opinions → streaming synthesis.
 *
 * @param {object} opts
 * @param {Array}  opts.messages      - Conversation messages (role/content)
 * @param {function} opts.onStatus    - (statusText) called with progress updates
 * @param {function} opts.onChunk     - (text) streaming synthesis tokens
 * @param {function} opts.onExperts   - ({ p1, p2 }) raw expert answers for display
 * @param {function} opts.onUsage     - ({ expertTokens, synthesisTokens }) estimated token usage
 * @param {function} opts.onDone      - () called when synthesis completes
 * @param {function} opts.onError     - (err) called on fatal error
 */
export async function runDeepThink({ messages, onStatus, onChunk, onExperts, onUsage, onDone, onError }) {
  try {
    let [p1Config, p2Config] = await Promise.all([loadConfig(), loadP2Config()]);

    // LumiNote is BYOK-only — Deep Think needs a user-configured API key.
    if (!p1Config.apiKey) {
      onError('Deep Think 需要先在设置中配置你自己的 AI API Key。');
      return;
    }

    // If the user has P1 but no P2, reuse P1 config (same model, different system prompt)
    if (!p2Config) {
      p2Config = { ...p1Config };
    }

    // ── Step 0: Classify question ───────────────────────────────────
    const userQuestion = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const questionType = classifyQuestion(userQuestion);
    const profile = ROLE_PROFILES[questionType];

    const TYPE_LABELS = {
      debate: '辩论对抗',
      technical: '技术方案对比',
      risk: '风险压力测试',
      creative: '跨学科思维',
    };

    const experts = [
      { label: 'Expert 1', config: p1Config, system: profile.expert1 },
    ];
    if (p2Config) {
      experts.push({ label: 'Expert 2', config: p2Config, system: profile.expert2 });
    }

    // ── Step 1: Parallel expert calls ─────────────────────────────
    onStatus(
      experts.length > 1
        ? `深度思考 · ${TYPE_LABELS[questionType]} · 专家分析中…`
        : '深度思考中…'
    );

    const results = await Promise.all(
      experts.map(({ label, config, system }) => askExpert(label, messages, config, system))
    );

    const successful = results.filter((r) => r.text);
    const failed = results.filter((r) => r.error);

    if (failed.length) {
      const labels = failed.map((r) => r.label).join(', ');
      onStatus(`${labels} 超时 — 正在综合已有回答…`);
    }

    if (successful.length === 0) {
      onError('所有专家均失败或超时。');
      return;
    }

    // Emit raw expert answers
    const expertMap = {};
    for (const r of results) expertMap[r.label] = r.text || `(${r.error})`;
    onExperts(expertMap);

    // Estimate expert tokens (rough: ~1.5 chars/token for mixed CJK/Latin)
    const expertChars = successful.reduce((s, r) => s + r.text.length, 0);
    const expertTokensEst = Math.round(expertChars / 1.5);

    // ── Step 2: If only one expert succeeded, stream directly ──────
    if (successful.length === 1) {
      onStatus(null);
      const text = successful[0].text;
      for (const ch of text) onChunk(ch);
      if (onUsage) onUsage({ expertTokens: expertTokensEst, synthesisTokens: 0 });
      onDone();
      return;
    }

    // ── Step 3: Synthesis prompt ───────────────────────────────────
    onStatus('综合分析中…');

    const expertBlock = successful
      .map((r) => `### ${r.label}\n${r.text}`)
      .join('\n\n');

    const synthesisContent = profile.synthesis
      .replace('{question}', userQuestion)
      .replace('{experts}', expertBlock);

    const synthesisMessages = [
      { role: 'user', content: synthesisContent },
    ];

    onStatus(null);

    let synthesisText = '';
    await streamExplain({
      messages: synthesisMessages,
      config: p1Config,
      onChunk: (t) => { synthesisText += t; onChunk(t); },
      onDone: () => {
        const synthesisTokensEst = Math.round(synthesisText.length / 1.5);
        if (onUsage) onUsage({ expertTokens: expertTokensEst, synthesisTokens: synthesisTokensEst });
        onDone();
      },
      onError,
    });
  } catch (err) {
    onError(String(err));
  }
}
