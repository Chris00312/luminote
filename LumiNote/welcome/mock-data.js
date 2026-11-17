/**
 * mock-data.js — Pre-baked content for the onboarding demo.
 *
 * Every AI result, highlight, moodboard screenshot, and agent conversation
 * is static. No network, no API calls. Locale-keyed so switching display
 * language (en/zh) rewrites the demo copy on ?force=1 re-open.
 *
 * Assets referenced in `*ImageSrc` / `boardScreenshot` live in ./assets/ and
 * are provided separately (founder-prepared). Placeholder URLs are OK during
 * dev — missing images degrade to blank frames without breaking the layout.
 */

export const MOCK = {
  en: {
    /* ─── Chapter 2: Mark + AI Explain ───────────────────────── */
    ch2: {
      // Pure-HTML article mock (no PNG dependency). Paragraphs are rendered
      // as <p> inside a Wikipedia-lite container; the phrase below is wrapped
      // with .lumiread-revisit-highlight and anchors the floating Mark bubble.
      articleTitle: 'Transformer (machine learning model)',
      articleMeta:  'From Wikipedia, the free encyclopedia',
      paragraphs: [
        'The Transformer is a deep learning architecture based on the multi-head attention mechanism, introduced in the 2017 paper "Attention Is All You Need" by researchers at Google.',
        'Text is converted to numerical representations called tokens, and each token is converted into a vector via lookup from a word embedding table.',
        'At each layer, each token is contextualized within the scope of the context window with other (unmasked) tokens via a parallel multi-head attention mechanism — allowing the signal for key tokens to be amplified and less important tokens to be diminished.',
      ],
      highlightPhrase: 'Attention Is All You Need',
      explain: {
        term: 'Attention Is All You Need',
        sourceLabel: 'en.wikipedia.org',
        aiSummary:
          'A 2017 paper that introduced the **Transformer** architecture, replacing ' +
          'recurrence and convolution with pure self-attention. The design became the ' +
          'foundation of modern LLMs — GPT, BERT, LLaMA, and Claude all descend from it.',
        related: ['Transformer', 'Self-Attention', 'Encoder–Decoder', 'BERT', 'GPT'],
      },
    },

    /* ─── Chapter 3: Visual AI / Screenshot ──────────────────── */
    ch3: {
      // CSS-drawn "whiteboard" with 4-stage AARRR funnel (no JPG dependency)
      boardTitle: 'Growth Plan · Q4',
      funnelStages: [
        { label: 'Acquisition', note: 'ads, organic, referrals' },
        { label: 'Activation',  note: 'sign-up → first Mark' },
        { label: 'Retention',   note: 'drop-off here ⚠️' },
        { label: 'Revenue',     note: 'Pro / Max upgrade' },
      ],
      explain: {
        term: 'Screenshot — Product funnel whiteboard',
        aiSummary:
          'A four-stage **AARRR funnel** sketched in marker: Acquisition → Activation → ' +
          'Retention → Revenue. Handwritten annotations highlight the drop-off between ' +
          'Activation and Retention as the key leverage point.',
        extractedEntities: ['AARRR', 'Funnel', 'Activation', 'Retention', 'Revenue'],
      },
    },

    /* ─── Chapter 4: Moodboard ───────────────────────────────── */
    ch4: {
      // CSS-drawn mock board (no PNG dependency): 6 glass cards on a dot grid
      boardName: 'Welcome to LumiNote',
      cards: [
        { title: 'What is LumiNote?',     body: 'Your internet memory library.',             x:  6, y: 10, w: 30 },
        { title: 'How to Mark',           body: 'Select text → click Mark. Works on PDF too.', x: 40, y: 12, w: 30 },
        { title: 'Three Explain Depths',  body: 'Brief · Detailed · Deep.',                   x: 72, y: 14, w: 24 },
        { title: 'Moodboards',            body: 'Arrange memories on an infinite canvas.',    x:  6, y: 58, w: 30 },
        { title: 'Agent Chat',            body: 'Ask an AI about this very board.',           x: 40, y: 56, w: 30 },
        { title: 'MCP Integration',       body: 'Connect Claude or any MCP client.',          x: 72, y: 60, w: 24 },
      ],
      hint: 'Tip: use Export PNG to share your whole board at once.',
    },

    /* ─── Chapter 5: Agent Chat ──────────────────────────────── */
    ch5: {
      boardName: 'Welcome to LumiNote',
      messages: [
        { role: 'user', text: "What's the theme of this board?" },
        { role: 'tool', name: 'list_cards', summary: '6 cards read' },
        { role: 'assistant', text:
          "This board is a **self-introduction to LumiNote**. Six cards explain the " +
          "product: what LumiNote is, how to Mark text, the three explain depths, " +
          "Moodboards, Agent Chat, and MCP integration for external AI agents." },
        { role: 'user', text: 'Add one more card about privacy.' },
        { role: 'tool', name: 'add_moodboard_card', summary: 'Card added' },
        { role: 'assistant', text:
          'Done — added a **Privacy** card in the bottom-right. Your marks stay on your ' +
          'device by default; Cloud Sync is opt-in.' },
      ],
    },
  },

  zh: {
    /* ─── Chapter 2: Mark + AI 解释 ──────────────────────────── */
    ch2: {
      articleTitle: 'Transformer（机器学习模型）',
      articleMeta:  '来自维基百科，自由的百科全书',
      paragraphs: [
        'Transformer 是一种基于多头注意力机制的深度学习架构，由 Google 的研究人员在 2017 年的论文 "Attention Is All You Need" 中首次提出。',
        '文本会先被转换为称为 token 的数值表示，每个 token 通过查词嵌入表转换为向量。',
        '在每一层，每个 token 都会在上下文窗口内通过并行的多头注意力机制与其他（未被遮蔽的）token 建立联系——关键 token 的信号被放大，次要 token 的信号则被抑制。',
      ],
      highlightPhrase: 'Attention Is All You Need',
      explain: {
        term: 'Attention Is All You Need',
        sourceLabel: 'zh.wikipedia.org',
        aiSummary:
          '2017 年的一篇论文，提出了 **Transformer** 架构，用纯粹的自注意力取代循环和卷积。' +
          '这一设计成为了现代 LLM 的基石——GPT、BERT、LLaMA、Claude 都是它的后代。',
        related: ['Transformer', '自注意力', '编码器-解码器', 'BERT', 'GPT'],
      },
    },

    /* ─── Chapter 3: 视觉 AI / 截图 ──────────────────────────── */
    ch3: {
      boardTitle: '增长计划 · Q4',
      funnelStages: [
        { label: '获取',  note: '广告、自然流量、推荐' },
        { label: '激活',  note: '注册 → 首次标记' },
        { label: '留存',  note: '流失最严重⚠️' },
        { label: '收入',  note: 'Pro / Max 订阅' },
      ],
      explain: {
        term: '截图 — 产品漏斗白板',
        aiSummary:
          '白板上用马克笔绘制的四阶段 **AARRR 漏斗**：获取 → 激活 → 留存 → 收入。' +
          '手写批注强调"激活到留存"之间的流失是最关键的撬动点。',
        extractedEntities: ['AARRR', '漏斗', '激活', '留存', '收入'],
      },
    },

    /* ─── Chapter 4: 灵感板 ──────────────────────────────────── */
    ch4: {
      boardName: '欢迎使用 LumiNote',
      cards: [
        { title: '什么是 LumiNote？',  body: '你的互联网记忆库。',                  x:  6, y: 10, w: 30 },
        { title: '如何标记',          body: '选中文字 → 点击 Mark，PDF 也支持。',    x: 40, y: 12, w: 30 },
        { title: '三种解释深度',      body: '简洁 · 详细 · 深度。',                 x: 72, y: 14, w: 24 },
        { title: '灵感板',            body: '在无限画布上整理记忆。',                x:  6, y: 58, w: 30 },
        { title: 'Agent 对话',        body: '向 AI 提问这块板子的内容。',            x: 40, y: 56, w: 30 },
        { title: 'MCP 集成',          body: '连接 Claude 或任意 MCP 客户端。',       x: 72, y: 60, w: 24 },
      ],
      hint: '提示：用"导出 PNG"一次性分享整块画板。',
    },

    /* ─── Chapter 5: Agent 对话 ──────────────────────────────── */
    ch5: {
      boardName: '欢迎使用 LumiNote',
      messages: [
        { role: 'user', text: '这个板子的主题是什么？' },
        { role: 'tool', name: 'list_cards', summary: '读取 6 张卡片' },
        { role: 'assistant', text:
          '这个板子是 **LumiNote 的产品自介**。六张卡片分别讲解了：什么是 LumiNote、' +
          '如何标记、三种解释深度、灵感板、Agent 对话，以及供外部 AI 使用的 MCP 集成。' },
        { role: 'user', text: '再加一张讲隐私的卡片。' },
        { role: 'tool', name: 'add_moodboard_card', summary: '已添加卡片' },
        { role: 'assistant', text:
          '已完成——在右下角新增了一张 **隐私** 卡片。默认情况下你的标记只存在本地，' +
          '云同步需要你主动开启。' },
      ],
    },
  },
};
