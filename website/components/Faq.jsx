// FAQ — accordion
function Faq({ lang }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 860 }}>
        <SectionHead lang={lang} eyebrow={t(COPY.faq.eyebrow, lang)} title={t(COPY.faq.title, lang)} center/>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {COPY.faq.items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{
                borderRadius: 16,
                background: isOpen ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(14px) saturate(1.3)',
                border: '1px solid rgba(232,239,234,0.7)',
                boxShadow: isOpen ? '0 6px 20px rgba(10,30,18,0.07), inset 0 0 0 1px rgba(255,255,255,0.55)' : 'inset 0 0 0 1px rgba(255,255,255,0.5)',
                overflow: 'hidden',
                transition: 'all 220ms',
              }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{
                  width: '100%', padding: '18px 22px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                }}>
                  <span style={{ flex: 1, font: '600 15.5px var(--ln-font-brand)', color: 'var(--ln-fg1)' }}>
                    {lang === 'zh' ? it.q_zh : it.q_en}
                  </span>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: isOpen ? 'var(--accent-gradient)' : 'rgba(26,107,74,0.08)',
                    color: isOpen ? '#fff' : 'var(--accent-deep)',
                    display: 'grid', placeItems: 'center',
                    transition: 'all 220ms',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                  }}><IPlus size={13}/></span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 22px 22px', font: '14px/1.65 var(--ln-font-body)', color: 'var(--ln-fg2)', maxWidth: 680, animation: 'fadeInUp 220ms' }}>
                    {lang === 'zh' ? it.a_zh : it.a_en}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Faq });
