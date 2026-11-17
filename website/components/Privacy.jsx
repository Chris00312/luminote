// Privacy section — 4 bullet cards
function Privacy({ lang }) {
  const isMobile = useIsMobile();
  const icons = [ILayers, ILock, IDownload, IGlobe];
  return (
    <section style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <SectionHead lang={lang} eyebrow={t(COPY.privacy.eyebrow, lang)} title={t(COPY.privacy.title, lang)} center/>
        <div style={{ marginTop: isMobile ? 28 : 48, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 12 : 18 }}>
          {COPY.privacy.bullets.map((b, i) => {
            const I = icons[i];
            return (
              <div key={i} style={{
                padding: 22,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(14px) saturate(1.3)',
                border: '1px solid rgba(232,239,234,0.7)',
                boxShadow: '0 4px 14px rgba(10,30,18,0.05), inset 0 0 0 1px rgba(255,255,255,0.55)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(26,107,74,0.08)', display: 'grid', placeItems: 'center', color: 'var(--accent-deep)' }}>
                  <I size={20}/>
                </div>
                <div style={{ font: '700 15.5px var(--ln-font-brand)', color: 'var(--ln-fg1)' }}>{lang === 'zh' ? b.zh_t : b.en_t}</div>
                <p style={{ margin: 0, font: '13px/1.55 var(--ln-font-body)', color: 'var(--ln-fg3)' }}>{lang === 'zh' ? b.zh : b.en}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Privacy });
