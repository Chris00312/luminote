// Root composition — deploy build (no Tweaks panel)
const DEFAULTS = { theme: 'deep', lang: 'zh' };

function App() {
  // Locale precedence (first match wins):
  //   1. localStorage 'ln-lang' (returning visitor's manual choice)
  //   2. navigator.language starts with "zh" → 'zh'
  //   3. navigator.language starts with "ja" → 'ja'
  //   4. everything else → 'en'
  // Default falls back to 'zh' only for the rare case where neither
  // storage nor navigator is available (SSR / privacy mode lockdown).
  const [lang, setLang] = React.useState(() => {
    try {
      const saved = localStorage.getItem('ln-lang');
      if (saved === 'zh' || saved === 'en' || saved === 'ja') return saved;
      const sys = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (sys.startsWith('zh')) return 'zh';
      if (sys.startsWith('ja')) return 'ja';
      return 'en';
    } catch { return DEFAULTS.lang; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem('ln-lang', lang); } catch {}
  }, [lang]);

  React.useEffect(() => {
    document.body.setAttribute('data-theme', DEFAULTS.theme);
  }, []);

  return (
    <>
      <Nav lang={lang} setLang={setLang}/>
      <Hero lang={lang}/>
      <Watch lang={lang}/>
      <LiveDemo lang={lang}/>
      <Flow lang={lang}/>
      <Gallery lang={lang}/>
      <Agent lang={lang}/>
      <Download lang={lang}/>
      <Privacy lang={lang}/>
      <Faq lang={lang}/>
      <Footer lang={lang}/>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App/>);
