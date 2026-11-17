// Top navigation bar — glass, sticky, with lang toggle + install CTA
function Nav({ lang, setLang }) {
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    ['flow', t(COPY.nav.flow, lang)],
    ['interfaces', t(COPY.nav.interfaces, lang)],
    ['agent', t(COPY.nav.agent, lang)],
    ['download', t(COPY.nav.download, lang)],
    ['faq', t(COPY.nav.faq, lang)],
  ];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      padding: isMobile ? '10px 12px' : '14px 24px',
      display: 'flex', justifyContent: 'center',
      transition: 'all 200ms',
    }}>
      <div style={{
        width: '100%', maxWidth: 1200,
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
        padding: isMobile ? '8px 12px' : (scrolled ? '10px 18px' : '12px 20px'),
        borderRadius: 9999,
        background: scrolled ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: '1px solid rgba(232,239,234,0.7)',
        boxShadow: scrolled ? '0 8px 32px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)'
          : '0 2px 12px rgba(10,30,18,0.04), inset 0 0 0 1px rgba(255,255,255,0.5)',
        transition: 'all 220ms',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'var(--accent-gradient)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'var(--accent-glow)',
            color: '#fff',
          }}>
            <IStack size={17} />
          </div>
          <div style={{ font: '700 16px var(--ln-font-brand)', color: 'var(--ln-fg1)', letterSpacing: '-0.01em' }}>
            LumiNote
          </div>
        </div>

        <div style={{ flex: 1, display: isMobile ? 'none' : 'flex', justifyContent: 'center', gap: 4 }}>
          {links.map(([id, label]) => (
            <a key={id} href={'#' + id} style={{
              padding: '8px 14px', borderRadius: 9999,
              font: '500 13.5px var(--ln-font-body)',
              color: 'var(--ln-fg2)', textDecoration: 'none',
              transition: 'all 150ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,107,74,0.07)'; e.currentTarget.style.color = 'var(--accent-deep)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ln-fg2)'; }}
            >{label}</a>
          ))}
        </div>

        {isMobile && <div style={{ flex: 1 }}/>}
        <LangToggle lang={lang} setLang={setLang} />

        <a href="downloads/luminote-chrome.zip" download title={lang === 'zh' ? '下载安装包' : lang === 'ja' ? 'インストーラーをダウンロード' : 'Download installer'} style={{
          display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : 7,
          padding: isMobile ? '9px 11px' : '9px 16px', borderRadius: 9999,
          background: 'var(--accent-gradient)',
          color: '#fff', textDecoration: 'none',
          font: '600 13px var(--ln-font-brand)',
          boxShadow: 'var(--accent-glow)',
          transition: 'all 150ms',
          whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--accent-glow-lg)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--accent-glow)'; }}
        >
          <IChrome size={14} />
          {!isMobile && t(COPY.nav.install, lang)}
        </a>
      </div>
    </nav>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 9999,
      background: 'rgba(26,107,74,0.07)',
    }}>
      {['zh', 'en', 'ja'].map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: '5px 11px', borderRadius: 9999, border: 'none',
          background: lang === l ? '#fff' : 'transparent',
          color: lang === l ? 'var(--accent-deep)' : 'var(--ln-fg3)',
          font: '600 11.5px var(--ln-font-brand)',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: lang === l ? '0 1px 3px rgba(10,30,18,0.1)' : 'none',
        }}>{l === 'zh' ? '中' : l === 'ja' ? '日' : 'EN'}</button>
      ))}
    </div>
  );
}

Object.assign(window, { Nav });
