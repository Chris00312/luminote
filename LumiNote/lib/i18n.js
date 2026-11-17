/**
 * LumiRead — Lightweight i18n module
 *
 * Usage:
 *   import { applyI18n, t, setLocale, getLocale } from '../lib/i18n.js';
 *
 *   // In HTML, tag translatable elements:
 *   <span data-i18n="key">Fallback</span>
 *   <input data-i18n-placeholder="key" placeholder="Fallback">
 *
 *   // Apply all translations to the current page:
 *   await applyI18n();
 *
 *   // Or get a single string:
 *   t('save_settings')  // → "Save Settings" or "保存设置"
 */

const MESSAGES = {
  en: {
    // ─── Options page ─────────────────────────────────────
    settings: 'Settings',
    ai_provider: 'AI Provider',
    provider: 'Provider',
    api_endpoint: 'API Endpoint',
    endpoint_hint: 'For OpenAI-compatible providers (DeepSeek, Qwen, local, etc.)',
    api_key: 'API Key',
    model: 'Model',
    test_connection: 'Test Connection',
    language: 'Language',
    display_language: 'Display Language',
    display_language_hint: 'Controls the language of the extension UI',
    ai_explanation_language: 'AI Explanation Language',
    ai_explanation_hint: 'AI will explain in this language regardless of the source text language',
    ai_summary_depth: 'AI Summary Depth',
    summary_depth_hint: "Controls the default depth behind the card's single AI button.",
    brief: 'Brief',
    detailed: 'Detailed',
    deep: 'Deep',
    keyboard_shortcut: 'Keyboard Shortcut',
    shortcut_desc: '— Open mark card for selected text',
    shortcut_change_hint: 'To change the shortcut, go to',
    save_settings: 'Save Settings',
    settings_saved: '✓ Settings saved',
    testing: 'Testing…',
    connected: '✓ Connected',
    connection_failed: '✗ Connection failed',

    // ─── Popup ────────────────────────────────────────────
    marked: 'Marked',
    today: 'Today',
    search_notebook: 'Search your notebook…',
    no_marks: 'No marks yet.',
    no_marks_hint: 'Select text on any page and click <strong>Mark</strong> to start building your memory library.',
    clear_all: 'Clear all',
    open_pdf_mode: 'PDF',
    open_notebook: 'Open full notebook',

    // ─── Notebook ─────────────────────────────────────────
    memory_library: 'Memory Library',
    my_memory_library: 'My Memory Library',
    search_placeholder: 'Search marks, notes, summaries…',
    all: 'All',
    copy_mcp_prompt: 'Copy MCP setup prompt',
    openclaw: 'OpenClaw',
    moodboard: 'Moodboard',
    mb_new_board: 'New Board',
    mb_new_note: 'New Note',
    mb_empty_hint: 'Press <kbd>C</kbd> to search and add memory cards',
    marks_saved_today: 'marks saved today',
    calendar: 'Calendar',
    active_days_this_month: 'active days this month',
    clear_all_entries: 'Clear all entries',
    embedded_settings: 'Embedded Settings',
    embedded_settings_desc: 'This is the same LumiNote settings page, now embedded as a notebook subpage.',
    new_note: 'New Note',
    title_optional: 'Title (optional)',
    note: 'Note',
    note_placeholder: 'Write why this matters, what to revisit, or leave a quick snapshot note...',
    saved_to_memory: 'Saved to Memory Library',
    no_results: 'No results found.',
    no_marks_notebook: 'No marks yet.',
    no_marks_notebook_hint: 'Select any text on a webpage and click <strong>Mark</strong> to start building your memory library.',
    open_source_page: 'Open source page',
    edit_memory: 'Edit Memory',
    title: 'Title',
    original_text: 'Original Text',
    save_changes: 'Save Changes',
    saving: 'Saving…',
    changes_saved: '✓ Saved',
    ai_polish_text: 'Polish Text',
    ai_polishing: 'Polishing…',
    ai_vision: 'Image AI',
    ai_summarizing: 'Summarizing…',
    start_from_today: 'Start from what matters today',
    memories_captured_today: '{n} memories captured today.',
    create_note: 'Create Note',
    no_marks_saved_today: 'No marks saved today.',
    no_marks_today_hint: 'Your older memories are still here. Open <strong>Calendar</strong> to browse previous days like a date-based archive.',
    calendar_day: 'Calendar Day',
    memories_saved_on_day: '{n} memories saved on this day.',
    no_memories_for_date: 'No saved memories for this date.',
    back_to_calendar: 'Back to Calendar',
    nothing_saved_on_date: 'Nothing is saved on this date yet.',
    active_days_in_month: '{n} active days in this month. Click a stack to open that day.',
    no_memories_in_month: 'No memories saved in {month} yet.',
    search_results_label: 'Showing <strong>{n}</strong> results for "<strong>{q}</strong>" across your full memory library',

    // ─── OpenClaw page ────────────────────────────────────
    oc_mcp_bridge: 'MCP Bridge',
    oc_connect_title: 'Connect AI Agents to LumiNote',
    oc_connect_lead: 'LumiNote is a shared data center for humans and AI. You mark memories from the browser; AI agents read and write the same Memory Blocks via MCP (Model Context Protocol) to search, create, update, and resume from the exact web or PDF location.',
    oc_what_is_title: 'What is MCP + LumiNote',
    oc_what_is_body: 'LumiNote is the shared data layer. Humans mark memories from the browser; AI agents read and write the same Memory Blocks through MCP. Both sides operate on an identical schema — there is no separate human format or agent format.',
    oc_how_to_connect: 'How to connect',
    oc_how_to_connect_body: 'Install the <strong>luminote-mcp-server</strong> to bridge any MCP-compatible AI agent (Claude, OpenClaw, etc.) to this extension. The MCP server communicates with LumiNote through a local WebSocket bridge.',
    oc_step1_title: 'Install the MCP server',
    oc_step2_title: 'Add to your AI agent config',
    oc_step3_title: 'Keep this page open',
    oc_step3_desc: 'The extension auto-connects to the MCP server\'s WebSocket bridge. This page must be open for the bridge to stay alive.',
    oc_mcp_checking: 'Checking MCP bridge…',
    oc_mcp_connected: 'MCP bridge connected',
    oc_mcp_disconnected: 'MCP server not running — start luminote-mcp-server to connect',
    oc_alt_method: 'Alternative: manual handoff',
    oc_alt_method_desc: 'Click <strong>Copy context to clipboard</strong> above to export the full library as a structured context block and paste it directly into an AI chat session.',
    oc_write_api: 'Write API — OpenClaw → LumiNote',
    oc_write_api_desc: 'OpenClaw can create and manage Memory Blocks using the same schema.',
    oc_create_memory: 'Create a memory',
    oc_create_memory_desc: 'Add a new Memory Block. <code>id</code> is auto-generated if omitted.',
    oc_update_memory: 'Update a memory',
    oc_update_memory_desc: 'Patch <code>note</code>, <code>aiSummary</code>, or <code>tags</code> on an existing block.',
    oc_delete_memory: 'Delete a memory',
    oc_delete_memory_desc: 'Permanently remove a Memory Block from the library.',
    oc_read_api: 'Read API — OpenClaw ← LumiNote',
    oc_read_api_desc: 'Command templates for read access.',
    oc_search_memories: 'Search memories',
    oc_search_memories_desc: 'Find Memory Blocks by term, note content, source kind, or domain.',
    oc_read_one: 'Read one memory',
    oc_read_one_desc: 'Retrieve the full Memory Block including note, AI summary, anchor, and locator.',
    oc_open_source: 'Open original source',
    oc_open_source_desc: 'Reopen the saved page or PDF at the saved page number.',
    oc_resume_anchor: 'Resume from anchor',
    oc_resume_anchor_desc: 'Re-locate by quote + prefix/suffix, then fall back to sourceLocator block offset.',
    oc_message_api: 'Message API',
    oc_message_api_desc: 'All APIs are available via chrome.runtime.sendMessage(). Use the message type as the type field.',
    oc_api_create_desc: 'Add a new Memory Block following the LumiNote schema. <code>id</code> and <code>timestamp</code> are auto-generated. All other fields follow the same schema used by human marks.',
    oc_api_update_desc: 'Patch mutable fields: <code>term</code>, <code>note</code>, <code>aiSummary</code>, <code>tags</code>. Immutable fields (<code>sourceUrl</code>, <code>sourceAnchor</code>, <code>timestamp</code>) are ignored.',
    oc_api_delete_desc: 'Permanently remove a Memory Block. Reflected immediately in the human-facing Memory Library.',
    oc_api_search_desc: 'Search across <code>term</code>, <code>note</code>, <code>aiSummary</code>, and <code>context</code>. Filter by <code>sourceKind</code>, <code>entryType</code>, <code>domain</code>, or date range.',
    oc_api_get_desc: 'Return the full Memory Block: <code>note</code>, <code>aiSummary</code>, <code>sourceAnchor</code>, <code>sourceLocator</code>, and image metadata where applicable.',
    oc_api_open_desc: 'Return <code>sourceUrl</code>, <code>sourceTitle</code>, <code>sourcePage</code> (PDF), and resume metadata. Opens the source in a new tab.',
    oc_memory_schema: 'Memory Block Schema',
    oc_pdf_schema: 'PDF Memory Block',
    oc_image_schema: 'Image Memory Block',
    copy: 'Copy',
    copied: 'Copied',
    copy_json: 'Copy JSON',

    // ─── PDF Viewer ───────────────────────────────────────
    pdf_mode: 'LumiNote PDF Mode',
    loading_pdf: 'Loading PDF…',
    preparing_pdf: 'LumiNote is preparing a selectable text view.',
    cannot_open_pdf: 'Could not open this PDF',
    open_original: 'Open original',
    previous_page: 'Previous page',
    next_page: 'Next page',
    zoom_in: 'Zoom in',
    zoom_out: 'Zoom out',
    fit_width: 'Fit width',
    pdf_upload_title: 'No PDF opened',
    pdf_upload_desc: 'Upload a local PDF file, or open a PDF page in your browser and click the PDF button again.',
    pdf_upload_btn: 'Choose PDF file',
    pdf_hint: 'Select text in this PDF to mark it into LumiNote. Scanned image PDFs are not supported in v1.',

    // ─── Trash ────────────────────────────────────────────
    trash: 'Trash',
    trash_meta: '{n} items · auto-deleted after 15 days',
    trash_days_left: '{n} days left',
    trash_restore: 'Restore',
    trash_perma_delete: 'Delete permanently',
    trash_empty: 'Trash is empty',
    trash_empty_all: 'Empty Trash',
    trash_empty_confirm: 'Empty trash? All items will be permanently deleted and cannot be recovered.',
    trash_deleted_at: 'Deleted on {date}',

    // ─── Agent Chat ────────────────────────────────────────
    agent_title: 'LumiNote Agent',
    agent_placeholder: 'Ask the agent anything…',
    agent_cancel: 'Cancel',
    agent_confirm: 'Confirm',
    agent_confirm_delete_memory: 'Delete memory block',
    agent_confirm_delete_board: 'Delete moodboard',
    agent_confirm_action: 'Execute',
    agent_error_config: 'Failed to load AI config',
    agent_error_no_key: 'API key not configured. Please open LumiNote Settings.',
    agent_error_no_tools: 'Current AI provider does not support tool calling.',
    agent_error_loop: 'Agent reached maximum tool call rounds.',
    agent_error_model_not_found: 'This model may not support tool calling. Try switching to a different model in Settings (e.g. GPT-4o, Claude, Gemini).',

    // ─── Auth / Login / Signup ────────────────────────────
    sync_desc: 'Sign in to sync data and use free AI',
    or_use_email: 'or use email',
    tab_login: 'Login',
    tab_signup: 'Sign up',
    email_placeholder: 'Email address',
    password_placeholder: 'Password',
    confirm_password_placeholder: 'Confirm password',
    btn_login: 'Login',
    btn_signup: 'Sign up',
    forgot_password: 'Forgot password?',
    forgot_desc: 'Enter your registered email to receive a verification code.',
    forgot_email_placeholder: 'Registered email',
    btn_send_code: 'Send code',
    code_placeholder: '6-digit code',
    new_password_placeholder: 'New password (min 8 chars)',
    btn_reset_password: 'Reset password',
    back_to_login: '\u2190 Back to login',
    signing_in: 'Signing in\u2026',
    signing_up: 'Signing up\u2026',
    login_success: 'Signed in, data synced',
    login_failed: 'Login failed',
    signup_failed: 'Sign up failed',
    enter_email_password: 'Please enter email and password',
    password_mismatch: 'Passwords do not match',
    password_min_8: 'Password must be at least 8 characters',
    complete_captcha: 'Please complete the verification',
    code_sent: 'Code sent! Check your email (valid 10 min)',
    send_failed: 'Failed to send',
    btn_sending: 'Sending\u2026',
    enter_6_digit_code: 'Please enter 6-digit code',
    new_password_min_8: 'New password must be at least 8 characters',
    resetting: 'Resetting\u2026',
    reset_success: 'Password reset! Log in with your new password.',
    reset_failed: 'Reset failed',
    please_login_first: 'Please sign in first',
    syncing: 'Syncing\u2026',
    sync_complete: 'Sync complete',
    sync_failed: 'Sync failed',

    // ─── Quota / AI ──────────────────────────────────────
    quota_tip: 'Set up your own API key below — LumiNote stores nothing on a server.',
    no_api_key: 'No AI API key configured. ',
    no_api_key_link: 'Open Settings to add your key \u2192',

    // ─── Notebook / Moodboard extras ─────────────────────
    sidebar_boards: 'Boards',
    deep_think_prefix: '[Deep Think]',

    // ─── Common ───────────────────────────────────────────
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    close: 'Close',
    preview: 'Preview',

    // ─── Onboarding (welcome/ deck) ──────────────────────
    onboarding_next:             'Next',
    onboarding_prev:             'Back',
    onboarding_skip:             'Skip intro',
    onboarding_cta_start:        'Start using LumiNote',
    onboarding_step_of:          'Step {n} of {total}',

    onboarding_ch1_eyebrow:      'Welcome',
    onboarding_ch1_headline:     'Your internet memory library.',
    onboarding_ch1_body:         "Mark what matters on any page. Build a searchable knowledge base. Let AI read and write alongside you.",

    onboarding_ch2_eyebrow:      'Feature 1 — Mark',
    onboarding_ch2_headline:     'Highlight any text. Get instant clarity.',
    onboarding_ch2_body:         'Select text on any webpage or PDF, click Mark, and LumiNote explains it — brief, detailed, or deep — with related concepts you can click to explore further.',
    onboarding_ch2_card_related: 'Related concepts',

    onboarding_ch3_eyebrow:      'Feature 2 — Visual AI',
    onboarding_ch3_headline:     "Don't just read — capture what you see.",
    onboarding_ch3_body:         'Screenshot any chart, diagram, or photo. LumiNote describes it, extracts the key entities, and saves it alongside your text notes.',
    onboarding_ch3_card_entities: 'Extracted entities',

    onboarding_ch4_eyebrow:      'Feature 3 — Moodboard',
    onboarding_ch4_headline:     'Arrange memories on an infinite canvas.',
    onboarding_ch4_body:         'Group related marks visually. Drag, resize, and export the whole board as one PNG to share the thinking behind a decision.',
    onboarding_ch4_hint_export:  'Tip: use Export PNG to share your whole board at once.',

    onboarding_ch5_eyebrow:      'Feature 4 — Agent',
    onboarding_ch5_headline:     'An AI that reasons about your moodboard.',
    onboarding_ch5_body:         'Ask questions. The agent can read every card, add new ones, and update notes — with every tool call shown inline, so you always see what it did.',

    onboarding_final_headline:   "You're all set.",
    onboarding_final_body:       'We created a starter board to show you around. Open your notebook to begin.',

    // ─── Reusable actions / toasts ───────────────────────
    undo:                        'Undo',
    memory_moved_to_trash:       'Moved to trash',
    polish_empty_hint:           'Type something first',
    fetch_models:                'Fetch',
  },

  zh: {
    // ─── Options page ─────────────────────────────────────
    settings: '设置',
    ai_provider: 'AI 服务',
    provider: '服务商',
    api_endpoint: 'API 地址',
    endpoint_hint: '用于 OpenAI 兼容的服务商（DeepSeek、Qwen、本地部署等）',
    api_key: 'API 密钥',
    model: '模型',
    test_connection: '测试连接',
    language: '语言',
    display_language: '界面语言',
    display_language_hint: '控制插件界面的显示语言',
    ai_explanation_language: 'AI 解释语言',
    ai_explanation_hint: 'AI 将始终使用此语言进行解释，无论原文是什么语言',
    ai_summary_depth: 'AI 摘要深度',
    summary_depth_hint: '控制卡片 AI 按钮的默认摘要深度',
    brief: '简要',
    detailed: '详细',
    deep: '深入',
    keyboard_shortcut: '键盘快捷键',
    shortcut_desc: '— 为选中文本打开标记卡片',
    shortcut_change_hint: '如需更改快捷键，请前往',
    save_settings: '保存设置',
    settings_saved: '✓ 设置已保存',
    testing: '测试中…',
    connected: '✓ 已连接',
    connection_failed: '✗ 连接失败',

    // ─── Popup ────────────────────────────────────────────
    marked: '已标记',
    today: '今天',
    search_notebook: '搜索你的笔记本…',
    no_marks: '还没有标记。',
    no_marks_hint: '在任意网页上选择文字，点击 <strong>Mark</strong> 开始构建你的记忆库。',
    clear_all: '清除全部',
    open_pdf_mode: 'PDF',
    open_notebook: '打开完整笔记本',

    // ─── Notebook ─────────────────────────────────────────
    memory_library: '记忆库',
    my_memory_library: '我的记忆库',
    search_placeholder: '搜索标记、笔记、摘要…',
    all: '全部',
    copy_mcp_prompt: '复制 MCP 安装提示词',
    openclaw: 'OpenClaw',
    moodboard: '灵感板',
    mb_new_board: '新建画板',
    mb_new_note: '新建笔记',
    mb_empty_hint: '按 <kbd>C</kbd> 搜索并添加记忆卡片',
    marks_saved_today: '今日保存的标记',
    calendar: '日历',
    active_days_this_month: '本月活跃天数',
    clear_all_entries: '清除所有记录',
    embedded_settings: '嵌入式设置',
    embedded_settings_desc: '这是同一个 LumiNote 设置页面，现在作为笔记本子页面嵌入。',
    new_note: '新笔记',
    title_optional: '标题（可选）',
    note: '笔记',
    note_placeholder: '写下为什么重要、需要回顾什么，或留个快速笔记...',
    saved_to_memory: '已保存到记忆库',
    no_results: '未找到结果。',
    no_marks_notebook: '还没有标记。',
    no_marks_notebook_hint: '在任意网页上选择文字，点击 <strong>Mark</strong> 开始构建你的记忆库。',
    open_source_page: '打开来源页面',
    edit_memory: '编辑记忆',
    title: '标题',
    original_text: '原文',
    save_changes: '保存更改',
    saving: '保存中…',
    changes_saved: '✓ 已保存',
    ai_polish_text: '润色文字',
    ai_polishing: '润色中…',
    ai_vision: '图片理解',
    ai_summarizing: '理解中…',
    start_from_today: '从今天重要的事开始',
    memories_captured_today: '今天已保存 {n} 条记忆。',
    create_note: '新建笔记',
    no_marks_saved_today: '今天还没有保存标记。',
    no_marks_today_hint: '之前的记忆仍在这里。打开 <strong>日历</strong> 浏览往日的记录。',
    calendar_day: '日历日',
    memories_saved_on_day: '这一天保存了 {n} 条记忆。',
    no_memories_for_date: '该日期没有保存的记忆。',
    back_to_calendar: '返回日历',
    nothing_saved_on_date: '该日期尚无保存内容。',
    active_days_in_month: '本月有 {n} 个活跃日。点击色块查看当天内容。',
    no_memories_in_month: '{month}还没有保存任何记忆。',
    search_results_label: '在完整记忆库中找到 <strong>{n}</strong> 条关于 "<strong>{q}</strong>" 的结果',

    // ─── OpenClaw page ────────────────────────────────────
    oc_mcp_bridge: 'MCP 桥接',
    oc_connect_title: '连接 AI 代理到 LumiNote',
    oc_connect_lead: 'LumiNote 是人类和 AI 的共享数据中心。你在浏览器中标记记忆；AI 代理通过 MCP（模型上下文协议）读写相同的 Memory Block，可以搜索、创建、更新，并从精确的网页或 PDF 位置恢复。',
    oc_what_is_title: '什么是 MCP + LumiNote',
    oc_what_is_body: 'LumiNote 是共享数据层。人类从浏览器标记记忆；AI 代理通过 MCP 读写相同的 Memory Block。双方使用完全相同的 schema——没有单独的人类格式或 AI 格式。',
    oc_how_to_connect: '如何连接',
    oc_how_to_connect_body: '安装 <strong>luminote-mcp-server</strong> 即可将任何 MCP 兼容的 AI 代理（Claude、OpenClaw 等）桥接到此扩展。MCP 服务器通过本地 WebSocket 桥接与 LumiNote 通信。',
    oc_step1_title: '安装 MCP 服务器',
    oc_step2_title: '添加到 AI 代理配置',
    oc_step3_title: '保持此页面打开',
    oc_step3_desc: '扩展会自动连接到 MCP 服务器的 WebSocket 桥接。此页面需要保持打开以维持桥接连接。',
    oc_mcp_checking: '正在检查 MCP 桥接…',
    oc_mcp_connected: 'MCP 桥接已连接',
    oc_mcp_disconnected: 'MCP 服务器未运行——请启动 luminote-mcp-server 以连接',
    oc_alt_method: '替代方案：手动交接',
    oc_alt_method_desc: '点击上方 <strong>复制协议上下文</strong> 将完整库导出为结构化上下文块，直接粘贴到 AI 对话中。',
    oc_write_api: '写入 API — OpenClaw → LumiNote',
    oc_write_api_desc: 'OpenClaw 可以使用相同的 schema 创建和管理 Memory Block。',
    oc_create_memory: '创建记忆',
    oc_create_memory_desc: '添加新的 Memory Block。<code>id</code> 省略时自动生成。',
    oc_update_memory: '更新记忆',
    oc_update_memory_desc: '修改已有 block 的 <code>note</code>、<code>aiSummary</code> 或 <code>tags</code>。',
    oc_delete_memory: '删除记忆',
    oc_delete_memory_desc: '永久移除一个 Memory Block。',
    oc_read_api: '读取 API — OpenClaw ← LumiNote',
    oc_read_api_desc: '读取访问的命令模板。',
    oc_search_memories: '搜索记忆',
    oc_search_memories_desc: '按术语、笔记内容、来源类型或域名查找 Memory Block。',
    oc_read_one: '读取单条记忆',
    oc_read_one_desc: '获取完整的 Memory Block，包括笔记、AI 摘要、锚点和定位器。',
    oc_open_source: '打开原始来源',
    oc_open_source_desc: '重新打开保存的页面或 PDF 到指定页码。',
    oc_resume_anchor: '从锚点恢复',
    oc_resume_anchor_desc: '通过引用文本 + 前后缀重新定位，失败时回退到 sourceLocator 块偏移。',
    oc_message_api: '消息 API',
    oc_message_api_desc: '所有 API 通过 <code>chrome.runtime.sendMessage()</code> 调用。使用消息类型作为 <code>type</code> 字段。',
    oc_api_create_desc: '添加新的 Memory Block。<code>id</code> 和 <code>timestamp</code> 自动生成，其他字段遵循与人工标记相同的 schema。',
    oc_api_update_desc: '修改可变字段：<code>term</code>、<code>note</code>、<code>aiSummary</code>、<code>tags</code>。不可变字段（<code>sourceUrl</code>、<code>sourceAnchor</code>、<code>timestamp</code>）将被忽略。',
    oc_api_delete_desc: '永久移除一个 Memory Block。更改会立即反映在用户界面的记忆库中。',
    oc_api_search_desc: '搜索 <code>term</code>、<code>note</code>、<code>aiSummary</code> 和 <code>context</code>。可按 <code>sourceKind</code>、<code>entryType</code>、<code>domain</code> 或日期范围过滤。',
    oc_api_get_desc: '返回完整的 Memory Block：<code>note</code>、<code>aiSummary</code>、<code>sourceAnchor</code>、<code>sourceLocator</code> 及图片元数据。',
    oc_api_open_desc: '返回 <code>sourceUrl</code>、<code>sourceTitle</code>、<code>sourcePage</code>（PDF）和恢复元数据。同时在新标签页中打开来源。',
    oc_memory_schema: 'Memory Block Schema',
    oc_pdf_schema: 'PDF Memory Block',
    oc_image_schema: '图片 Memory Block',
    copy: '复制',
    copied: '已复制',
    copy_json: '复制 JSON',

    // ─── PDF Viewer ───────────────────────────────────────
    pdf_mode: 'LumiNote PDF 模式',
    loading_pdf: '正在加载 PDF…',
    preparing_pdf: 'LumiNote 正在准备可选择文本的视图。',
    cannot_open_pdf: '无法打开此 PDF',
    open_original: '打开原始链接',
    previous_page: '上一页',
    next_page: '下一页',
    zoom_in: '放大',
    zoom_out: '缩小',
    fit_width: '适应宽度',
    pdf_upload_title: '未打开 PDF',
    pdf_upload_desc: '上传本地 PDF 文件，或在浏览器中打开 PDF 页面后再次点击 PDF 按钮。',
    pdf_upload_btn: '选择 PDF 文件',
    pdf_hint: '选择 PDF 中的文本即可标记到 LumiNote。扫描的图片 PDF 暂不支持。',

    // ─── Trash ────────────────────────────────────────────
    trash: '回收站',
    trash_meta: '{n} 条记录 · 15 天内自动永久删除',
    trash_days_left: '{n} 天后删除',
    trash_restore: '恢复',
    trash_perma_delete: '永久删除',
    trash_empty: '回收站是空的',
    trash_empty_all: '清空回收站',
    trash_empty_confirm: '清空回收站？其中的记录将被永久删除，无法恢复。',
    trash_deleted_at: '删除于 {date}',

    // ─── Agent Chat ────────────────────────────────────────
    agent_title: 'LumiNote 智能助手',
    agent_placeholder: '向助手提问…',
    agent_cancel: '取消',
    agent_confirm: '确认',
    agent_confirm_delete_memory: '删除记忆卡片',
    agent_confirm_delete_board: '删除灵感板',
    agent_confirm_action: '执行',
    agent_error_config: '加载 AI 配置失败',
    agent_error_no_key: 'API Key 未配置，请打开 LumiNote 设置。',
    agent_error_no_tools: '当前 AI 提供商不支持工具调用。',
    agent_error_loop: '助手已达最大工具调用轮次。',
    agent_error_model_not_found: '当前模型可能不支持工具调用。请在设置中切换模型（如 GPT-4o、Claude、Gemini）。',

    // ─── Auth / Login / Signup ────────────────────────────
    sync_desc: '登录以同步数据并使用免费 AI 功能',
    or_use_email: '或使用邮箱',
    tab_login: '登录',
    tab_signup: '注册',
    email_placeholder: '邮箱地址',
    password_placeholder: '密码',
    confirm_password_placeholder: '确认密码',
    btn_login: '登录',
    btn_signup: '注册',
    forgot_password: '忘记密码？',
    forgot_desc: '输入注册邮箱，我们会发送验证码。',
    forgot_email_placeholder: '注册邮箱',
    btn_send_code: '发送验证码',
    code_placeholder: '6 位验证码',
    new_password_placeholder: '新密码（至少 8 位）',
    btn_reset_password: '重置密码',
    back_to_login: '\u2190 返回登录',
    signing_in: '登录中\u2026',
    signing_up: '注册中\u2026',
    login_success: '已登录，数据已同步',
    login_failed: '登录失败',
    signup_failed: '注册失败',
    enter_email_password: '请输入邮箱和密码',
    password_mismatch: '两次密码不一致',
    password_min_8: '密码至少 8 位',
    complete_captcha: '请先完成人机验证',
    code_sent: '验证码已发送到邮箱，请查收（10 分钟内有效）',
    send_failed: '发送失败',
    btn_sending: '发送中\u2026',
    enter_6_digit_code: '请输入 6 位验证码',
    new_password_min_8: '新密码至少 8 位',
    resetting: '重置中\u2026',
    reset_success: '密码重置成功！请用新密码登录。',
    reset_failed: '重置失败',
    please_login_first: '请先登录',
    syncing: '正在同步\u2026',
    sync_complete: '同步完成',
    sync_failed: '同步失败',

    // ─── Quota / AI ──────────────────────────────────────
    quota_tip: '在下方配置你自己的 API Key，数据只存在本地。',
    no_api_key: '尚未配置 AI API Key。',
    no_api_key_link: '前往设置添加你的 Key \u2192',

    // ─── Notebook / Moodboard extras ─────────────────────
    sidebar_boards: '灵感板',
    deep_think_prefix: '[深度思考]',

    // ─── Common ───────────────────────────────────────────
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    close: '关闭',
    preview: '预览',

    // ─── Onboarding（welcome/ 轮播） ──────────────────────
    onboarding_next:             '下一步',
    onboarding_prev:             '上一步',
    onboarding_skip:             '跳过介绍',
    onboarding_cta_start:        '开始使用 LumiNote',
    onboarding_step_of:          '第 {n} / {total} 步',

    onboarding_ch1_eyebrow:      '欢迎',
    onboarding_ch1_headline:     '你的互联网记忆库。',
    onboarding_ch1_body:         '标记任意页面上重要的内容，构建可搜索的知识库，让 AI 与你并肩阅读和写作。',

    onboarding_ch2_eyebrow:      '功能 1 — 标记',
    onboarding_ch2_headline:     '高亮任意文字，即刻获得理解。',
    onboarding_ch2_body:         '在任何网页或 PDF 上选中文字，点击"Mark"，LumiNote 就会给出简洁、详细或深度的解释，以及可点击进一步探索的相关概念。',
    onboarding_ch2_card_related: '相关概念',

    onboarding_ch3_eyebrow:      '功能 2 — 视觉 AI',
    onboarding_ch3_headline:     '不只阅读——把所见一同收藏。',
    onboarding_ch3_body:         '截取任意图表、示意图或照片。LumiNote 会描述它、提取关键实体，并与文字笔记一同保存。',
    onboarding_ch3_card_entities: '提取的关键信息',

    onboarding_ch4_eyebrow:      '功能 3 — 灵感板',
    onboarding_ch4_headline:     '在无限画布上整理记忆。',
    onboarding_ch4_body:         '把相关的标记按视觉关系拼在一起。拖动、缩放，然后把整块画板导出为一张 PNG，分享你决策背后的思考。',
    onboarding_ch4_hint_export:  '提示：用"导出 PNG"一次性分享整块画板。',

    onboarding_ch5_eyebrow:      '功能 4 — Agent',
    onboarding_ch5_headline:     '会对你的灵感板进行推理的 AI。',
    onboarding_ch5_body:         '向它提问。Agent 能读取每张卡片、添加新卡片、更新笔记——每一次工具调用都会内联显示，你始终清楚它做了什么。',

    onboarding_final_headline:   '一切准备就绪。',
    onboarding_final_body:       '我们为你创建了一个入门画板。打开笔记本开始使用吧。',

    // ─── 通用动作 / toast ─────────────────────────────────
    undo:                        '撤销',
    memory_moved_to_trash:       '已移到回收站',
    polish_empty_hint:           '先输入一些内容',
    fetch_models:                '拉取',
  },

};

/** Resolve the effective locale: user pref → 'en' */
let _locale = 'en';

/**
 * LumiNote ships two locales. English is the default for everyone; Chinese is
 * opt-in from Settings. We deliberately do not auto-switch on navigator.language
 * so the UI a fresh install shows is always the same.
 */
function detectSystemLocale() {
  return 'en';
}

/**
 * Load the saved displayLanguage. Defaults to English; a previously stored
 * 'auto' (from older builds) also resolves to English so nobody is left with an
 * unknown locale.
 */
export async function initLocale() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ displayLanguage: 'en' }, (cfg) => {
      _locale = MESSAGES[cfg.displayLanguage] ? cfg.displayLanguage : detectSystemLocale();
      resolve(_locale);
    });
  });
}

/** Get the current effective locale code */
export function getLocale() {
  return _locale;
}

/** Manually set locale (does NOT persist — call chrome.storage.sync.set separately) */
export function setLocale(code) {
  _locale = MESSAGES[code] ? code : detectSystemLocale();
}

/** Translate a single key */
export function t(key) {
  return (MESSAGES[_locale] && MESSAGES[_locale][key]) || MESSAGES.en[key] || key;
}

/**
 * Apply translations to all [data-i18n] and [data-i18n-placeholder] elements
 * within a root element (defaults to document.body).
 */
export function applyI18n(root = document.body) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (!text) return;
    // Use innerHTML for keys containing HTML tags (e.g. <strong>)
    if (text.includes('<')) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = t(key);
    if (text) el.placeholder = text;
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const text = t(key);
    if (text) el.title = text;
  });
}
