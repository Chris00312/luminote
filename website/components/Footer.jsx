// Final CTA + Footer
function Footer({ lang }) {
  const isMobile = useIsMobile();
  return (
    <>
      {/* Final CTA banner */}
      <section style={{ padding: isMobile ? '48px 16px' : '80px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: 1100,
          padding: isMobile ? '36px 24px' : '56px 48px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, var(--accent-deep), var(--accent-bright))',
          color: '#fff',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(26,107,74,0.3), inset 0 0 0 1px rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap',
        }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)' }}/>
          <div style={{ position: 'absolute', bottom: -60, left: 100, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)' }}/>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
            <h2 style={{ margin: 0, font: `700 ${isMobile ? '26px' : '36px'}/1.15 var(--ln-font-brand)`, letterSpacing: '-0.015em' }}>
              {lang === 'zh' ? '把整个网页变成你的记忆层.' : 'Turn the whole web into your memory layer.'}
            </h2>
            <p style={{ margin: '14px 0 0', font: '15px/1.55 var(--ln-font-body)', opacity: 0.9 }}>
              {lang === 'zh' ? '免费 · 开源 · 无需注册. 下载即用.' : 'Free · open source · no sign-up. Download and go.'}
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="downloads/luminote-chrome.zip" download style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '15px 26px', borderRadius: 9999,
              background: '#fff', color: 'var(--accent-deep)', textDecoration: 'none',
              font: '700 15px var(--ln-font-brand)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
              <IChrome size={17}/> {t(COPY.hero.cta, lang)} <IArrowRight size={16} strokeWidth={2.5}/>
            </a>
            <a href="#download" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '14px 22px', borderRadius: 9999,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff', textDecoration: 'none',
              font: '600 15px var(--ln-font-brand)',
              backdropFilter: 'blur(8px)',
            }}>
              <IEdge size={17}/> {t(COPY.hero.edgeCta, lang)}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: isMobile ? '40px 16px 32px' : '60px 24px 40px', display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(192,201,194,0.4)' }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.5fr 1fr 1fr 1fr', gap: isMobile ? 24 : 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><IStack size={17}/></div>
              <div style={{ font: '700 16px var(--ln-font-brand)', color: 'var(--ln-fg1)' }}>LumiNote</div>
            </div>
            <p style={{ margin: 0, maxWidth: 320, font: '13px/1.55 var(--ln-font-body)', color: 'var(--ln-fg3)' }}>{t(COPY.footer.tagline, lang)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span style={{ padding: '4px 9px', borderRadius: 9999, background: 'rgba(26,107,74,0.08)', font: '600 11px var(--ln-font-brand)', color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><IChrome size={11}/> Chrome</span>
              <span style={{ padding: '4px 9px', borderRadius: 9999, background: 'rgba(26,107,74,0.08)', font: '600 11px var(--ln-font-brand)', color: 'var(--accent-deep)' }}>Edge</span>
              <span style={{ padding: '4px 9px', borderRadius: 9999, background: 'rgba(26,107,74,0.08)', font: '600 11px var(--ln-font-brand)', color: 'var(--accent-deep)' }}>Brave</span>
            </div>
          </div>
          <FCol title={t(COPY.footer.product, lang)} items={lang === 'zh' ? ['功能', '工作流', '下载', '更新日志'] : ['Features','How it works','Download','Changelog']}/>
          <FCol title={t(COPY.footer.company, lang)} items={lang === 'zh' ? ['关于', '博客', '联系', 'MCP 服务器'] : ['About','Blog','Contact','MCP server']}/>
          <FCol title={t(COPY.footer.legal, lang)} items={lang === 'zh' ? ['隐私政策', '许可证', '开源声明'] : ['Privacy','License','Open source']}/>
        </div>
      </footer>
      <div style={{ padding: '16px 24px 32px', textAlign: 'center', font: '12px var(--ln-font-body)', color: 'var(--ln-fg4)' }}>
        {t(COPY.footer.copyright, lang)}
      </div>
    </>
  );
}

function FCol({ title, items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ font: '700 11px var(--ln-font-brand)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ln-fg4)' }}>{title}</div>
      {items.map((x, i) => (
        <a key={i} href="#" style={{ font: '13px var(--ln-font-body)', color: 'var(--ln-fg2)', textDecoration: 'none' }}>{x}</a>
      ))}
    </div>
  );
}

Object.assign(window, { Footer });
