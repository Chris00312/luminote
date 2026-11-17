// Flow — 3-step diagram: Mark → Explain → Moodboard
function Flow({ lang }) {
  const isMobile = useIsMobile();
  return (
    <section id="flow" style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <SectionHead lang={lang}
          eyebrow={t(COPY.flow.eyebrow, lang)}
          title={t(COPY.flow.title, lang)}
          center
        />
        <div style={{
          marginTop: isMobile ? 32 : 56,
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 20 : 24,
          position: 'relative',
        }}>
          {COPY.flow.steps.map((s, i) => (
            <FlowStep key={i} idx={i} step={s} lang={lang}/>
          ))}
        </div>
      </div>
    </section>
  );
}

function FlowStep({ idx, step, lang }) {
  return (
    <div style={{
      position: 'relative',
      padding: 28,
      borderRadius: 22,
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(16px) saturate(1.3)',
      border: '1px solid rgba(232,239,234,0.7)',
      boxShadow: '0 4px 16px rgba(10,30,18,0.06), inset 0 0 0 1px rgba(255,255,255,0.55)',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--accent-gradient)', color: '#fff',
          display: 'grid', placeItems: 'center',
          font: '700 16px var(--ln-font-brand)',
          boxShadow: 'var(--accent-glow)',
        }}>{step.n}</div>
        <div style={{ font: '700 22px var(--ln-font-brand)', color: 'var(--ln-fg1)', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? step.zh_t : step.en_t}
        </div>
      </div>
      <p style={{ margin: 0, font: '14.5px/1.6 var(--ln-font-body)', color: 'var(--ln-fg2)', textWrap: 'pretty' }}>
        {lang === 'zh' ? step.zh : step.en}
      </p>
      <FlowIllustration idx={idx} lang={lang}/>
    </div>
  );
}

function FlowIllustration({ idx, lang }) {
  const box = {
    position: 'relative', height: 180,
    borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(240,245,241,0.8), rgba(232,240,234,0.6))',
    border: '1px solid rgba(232,239,234,0.6)',
    overflow: 'hidden',
    padding: 14,
  };
  if (idx === 0) {
    return (
      <div style={box}>
        <div style={{ font: '12px/1.55 Georgia, serif', color: '#3a4640' }}>
          {lang === 'zh' ? '在漫长的演化历程中, ' : 'For most of evolutionary history, '}
          <span style={{ background: 'rgba(26,107,74,0.22)', borderRadius: 2, padding: '1px 2px' }}>
            {lang === 'zh' ? '光的节律决定了行为的节律' : 'the rhythm of light defined the rhythm of behavior'}
          </span>
          .
        </div>
        <div style={{
          position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 9999,
          background: 'var(--accent-gradient-hero)', color: '#fff',
          font: '600 12px var(--ln-font-brand)',
          boxShadow: '0 6px 20px rgba(26,107,74,0.4)',
          animation: 'drift 3s ease-in-out infinite',
        }}>
          <IStack size={12}/> Mark
        </div>
      </div>
    );
  }
  if (idx === 1) {
    return (
      <div style={box}>
        <div style={{ display: 'inline-flex', padding: 2, borderRadius: 9999, background: 'rgba(26,107,74,0.08)', marginBottom: 10 }}>
          {[lang === 'zh' ? '简洁' : 'Brief', lang === 'zh' ? '详细' : 'Detailed', lang === 'zh' ? '深度' : 'Deep'].map((l, i) => (
            <div key={i} style={{
              padding: '3px 10px', borderRadius: 9999, font: '600 10.5px var(--ln-font-brand)',
              background: i === 1 ? '#fff' : 'transparent',
              color: i === 1 ? 'var(--accent-deep)' : 'var(--ln-fg4)',
              boxShadow: i === 1 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{l}</div>
          ))}
        </div>
        <div style={{ font: '12.5px/1.55 var(--ln-font-body)', color: 'var(--ln-fg1)' }}>
          {lang === 'zh'
            ? '一个 24 小时计时器, 几乎每个细胞都自带. 光把它拉回相位.'
            : 'A 24-hour timer almost every cell carries. Light pulls it back into phase.'}
          <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--accent-deep)', verticalAlign: '-2px', marginLeft: 2, animation: 'blink 1s steps(2) infinite' }}/>
        </div>
      </div>
    );
  }
  // Step 3: Moodboard — show a mini version of the Remotion-ported MoodCards
  return (
    <div style={{ ...box, backgroundImage: 'radial-gradient(circle, rgba(26,107,74,0.08) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {getMoodCards(lang).map((c, i) => (
          <MoodCard key={i} card={c} scale={0.42} compact/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Flow });
