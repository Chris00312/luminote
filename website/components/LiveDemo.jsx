// LiveDemo — user can actually select text and see Mark → Explain flow.
// Deploy note: wire window.explainPassage(prompt, {lang}) to your backend proxy.
// Falls back to a local deterministic mock so the demo still works offline.
async function mockExplain(text, lang) {
  await new Promise(r => setTimeout(r, 700 + Math.random() * 600));
  const snippet = text.length > 60 ? text.slice(0, 60) + '…' : text;
  return lang === 'zh'
    ? `关于"${snippet}" — 这是一段需要接入真实模型才能生动解释的文本. 部署后把 window.explainPassage 指向你的 /api/explain 端点, 就会生成 2-3 句平静友好的背景解释.`
    : `On "${snippet}" — once you wire window.explainPassage to your /api/explain endpoint, a real model will produce a 2-3 sentence calm, friendly explanation here.`;
}
function LiveDemo({ lang }) {
  const isMobile = useIsMobile();
  const articleRef = React.useRef(null);
  const [selection, setSelection] = React.useState(null);  // {text, rect}
  const [bubble, setBubble] = React.useState(null);         // {x,y,text}
  const [card, setCard] = React.useState(null);             // {text, loading, response, depth}
  const [toast, setToast] = React.useState(false);

  const passages = COPY.demo.passages[lang];

  React.useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !articleRef.current) {
        setBubble(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!articleRef.current.contains(range.commonAncestorContainer)) {
        setBubble(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 4) { setBubble(null); return; }
      const rect = range.getBoundingClientRect();
      const parentRect = articleRef.current.getBoundingClientRect();
      setBubble({
        x: rect.left + rect.width / 2 - parentRect.left,
        y: rect.top - parentRect.top,
        text,
      });
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setBubble(null);
    });
    return () => document.removeEventListener('mouseup', onUp);
  }, []);

  const onMark = async () => {
    if (!bubble) return;
    setCard({ text: bubble.text, loading: true, response: '', depth: 'detailed' });
    setBubble(null);
    window.getSelection()?.removeAllRanges();
    try {
      const prompt = lang === 'zh'
        ? `用 2-3 句话, 以平静友好的口吻, 解释下面这段话的背景和含义. 不要说 "这段话是…". 直接用中文解释.\n\n"${bubble.text}"`
        : `In 2-3 sentences, calm & friendly tone, explain the context and meaning of this passage. Don't start with "This passage is…". Just explain.\n\n"${bubble.text}"`;
      // TODO(deploy): replace this with a call to your backend proxy (e.g. /api/explain)
      // that forwards to Anthropic / OpenAI. Never expose API keys in the client.
      const response = await window.explainPassage
        ? await window.explainPassage(prompt, { lang })
        : await mockExplain(bubble.text, lang);
      setCard(c => c ? { ...c, loading: false, response } : null);
    } catch (e) {
      setCard(c => c ? { ...c, loading: false, response: lang === 'zh'
        ? '抱歉, 请求失败了. 真实产品中会自动重试.'
        : 'Request failed. Real product auto-retries.' } : null);
    }
  };

  const onSave = () => {
    setCard(null);
    setToast(true);
    setTimeout(() => setToast(false), 2800);
  };

  return (
    <section id="demo" style={{ padding: isMobile ? '48px 16px' : '80px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1100 }}>
        <SectionHead lang={lang}
          eyebrow={t(COPY.demo.eyebrow, lang)}
          title={t(COPY.demo.title, lang)}
        />

        <div ref={articleRef} style={{
          position: 'relative',
          marginTop: isMobile ? 24 : 32,
          padding: isMobile ? '28px 20px 40px' : '44px 56px 64px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(232,239,234,0.7)',
          boxShadow: '0 24px 60px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.55)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, font: '11px var(--ln-font-mono)', color: 'var(--ln-fg4)' }}>
            <ILock size={11}/> nature.com / the-geometry-of-biological-time
          </div>
          <h3 style={{ margin: 0, marginBottom: 6, font: `700 ${isMobile ? '26px' : '34px'}/1.15 Georgia, serif`, color: '#1a1a18', letterSpacing: '-0.01em' }}>
            {t(COPY.demo.articleTitle, lang)}
          </h3>
          <div style={{ font: '13px var(--ln-font-body)', color: 'var(--ln-fg4)', marginBottom: 28 }}>{t(COPY.demo.byline, lang)}</div>
          {passages.map((p, i) => (
            <p key={i} style={{ font: '17px/1.7 Georgia, serif', color: '#2a2a28', margin: '0 0 18px' }}>{p}</p>
          ))}

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            marginTop: 8,
            padding: '7px 14px', borderRadius: 9999,
            background: 'rgba(26,107,74,0.07)',
            border: '1px dashed rgba(26,107,74,0.3)',
            font: '500 12.5px var(--ln-font-body)', color: 'var(--ln-fg3)',
          }}>
            <IMouse size={13}/> {t(COPY.demo.hint, lang)}
          </div>

          {bubble && (
            <button onClick={onMark} style={{
              position: 'absolute',
              left: bubble.x, top: bubble.y - 12,
              transform: 'translate(-50%, -100%)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 9999, border: 'none',
              background: 'var(--accent-gradient-hero)', color: '#fff',
              font: '600 13px var(--ln-font-brand)',
              boxShadow: '0 6px 20px rgba(26,107,74,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              cursor: 'pointer',
              animation: 'bubbleIn 220ms cubic-bezier(0.3,1.3,0.4,1)',
              zIndex: 10,
            }}>
              <IStack size={14}/> Mark
            </button>
          )}
        </div>

        {card && <LiveCard card={card} lang={lang} onClose={() => setCard(null)} onSave={onSave} setCard={setCard}/>}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '10px 18px', borderRadius: 12,
            background: 'rgba(25,28,26,0.94)', color: '#fff',
            font: '13px var(--ln-font-body)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            zIndex: 100,
            animation: 'fadeInUp 200ms',
          }}>
            <ICheck size={14} style={{ color: '#adf2cc' }} strokeWidth={2.5}/>
            {lang === 'zh' ? '已保存到记忆 · 在你的灵感板上了' : 'Saved to memory · it\'s on your moodboard'}
          </div>
        )}
      </div>
    </section>
  );
}

function LiveCard({ card, lang, onClose, onSave, setCard }) {
  const isMobile = useIsMobile();
  return (
    <aside style={{
      position: 'fixed',
      bottom: isMobile ? 12 : 24,
      right: isMobile ? 12 : 24,
      left: isMobile ? 12 : 'auto',
      width: isMobile ? 'auto' : 380,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      border: '1px solid rgba(232,239,234,0.7)',
      borderRadius: 20,
      boxShadow: '0 24px 60px rgba(10,30,18,0.18), 0 4px 16px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)',
      overflow: 'hidden',
      zIndex: 80,
      animation: 'cardIn 300ms cubic-bezier(0.2,0.9,0.3,1)',
    }}>
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(232,239,234,0.7)' }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><IBolt size={13}/></div>
        <div style={{ flex: 1, font: '11px var(--ln-font-body)', color: 'var(--ln-fg4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--ln-fg2)', fontWeight: 600 }}>nature.com</strong> · {t(COPY.demo.articleTitle, lang)}
        </div>
        <button onClick={onClose} style={{ width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: '50%', cursor: 'pointer', color: 'var(--ln-fg4)', display: 'grid', placeItems: 'center' }}>
          <IClose size={12} strokeWidth={2.5}/>
        </button>
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ font: '13px/1.45 Georgia, serif', color: 'var(--ln-fg2)', paddingLeft: 10, borderLeft: '3px solid rgba(26,107,74,0.4)' }}>
          {card.text.length > 180 ? card.text.slice(0, 180) + '…' : card.text}
        </div>
      </div>
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{ display: 'inline-flex', padding: 3, borderRadius: 9999, background: 'rgba(26,107,74,0.08)' }}>
          {[['brief', lang === 'zh' ? '简洁' : 'Brief'], ['detailed', lang === 'zh' ? '详细' : 'Detailed'], ['deep', lang === 'zh' ? '深度' : 'Deep']].map(([k, l]) => (
            <button key={k} onClick={() => setCard(c => ({ ...c, depth: k }))} style={{
              padding: '5px 12px', border: 'none', borderRadius: 9999,
              background: card.depth === k ? '#fff' : 'transparent',
              color: card.depth === k ? 'var(--accent-deep)' : 'var(--ln-fg3)',
              boxShadow: card.depth === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              font: '600 11px var(--ln-font-brand)', cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '4px 16px 14px', font: '13.5px/1.55 var(--ln-font-body)', color: 'var(--ln-fg1)', minHeight: 60 }}>
        {card.loading
          ? <span style={{ color: 'var(--ln-fg4)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(26,107,74,0.2)', borderTopColor: 'var(--accent-deep)', animation: 'spin-slow 700ms linear infinite' }}/>
              {lang === 'zh' ? '让 AI 想一下…' : 'Thinking…'}
            </span>
          : <>{card.response}<span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--accent-deep)', verticalAlign: '-2px', marginLeft: 2, animation: 'blink 1s steps(2) infinite' }}/></>}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: '1px solid rgba(232,239,234,0.7)', background: 'rgba(244,250,246,0.4)' }}>
        <button onClick={onSave} disabled={card.loading} style={{
          flex: 1, padding: '9px 12px', border: 'none', borderRadius: 10,
          background: card.loading ? 'rgba(26,107,74,0.3)' : 'var(--accent-gradient)',
          color: '#fff', font: '600 12.5px var(--ln-font-brand)',
          cursor: card.loading ? 'not-allowed' : 'pointer',
          boxShadow: card.loading ? 'none' : 'var(--accent-glow)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <ICheck size={12} strokeWidth={3}/> {lang === 'zh' ? '保存到记忆' : 'Save to memory'}
        </button>
      </div>
    </aside>
  );
}

function SectionHead({ lang, eyebrow, title, sub, center }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ textAlign: center ? 'center' : 'left', display: 'flex', flexDirection: 'column', gap: 14, alignItems: center ? 'center' : 'flex-start' }}>
      <span style={{
        padding: '5px 12px', borderRadius: 9999,
        background: 'rgba(26,107,74,0.08)',
        color: 'var(--accent-deep)',
        font: '700 11px var(--ln-font-brand)',
        letterSpacing: '0.09em', textTransform: 'uppercase',
      }}>{eyebrow}</span>
      <h2 style={{
        margin: 0,
        font: `700 ${isMobile ? (lang === 'zh' ? '28px' : '30px') : (lang === 'zh' ? '40px' : '42px')}/1.15 var(--ln-font-brand)`,
        color: 'var(--ln-fg1)', letterSpacing: '-0.015em',
        maxWidth: 720,
      }}>{title}</h2>
      {sub && <p style={{ margin: 0, font: '16px/1.55 var(--ln-font-body)', color: 'var(--ln-fg2)', maxWidth: 620 }}>{sub}</p>}
    </div>
  );
}

Object.assign(window, { LiveDemo, SectionHead });
