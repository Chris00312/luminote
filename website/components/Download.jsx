// Download — direct installer download, replacing the old pricing section.
//
// LumiNote is open source and free. There is no account, no subscription and
// no quota, so there is nothing to price: this section just hands you the zip.
//
// The zip in website/downloads/ is built from this repo by scripts/package-extension.mjs.
const DOWNLOADS = {
  chrome: {
    href: 'https://github.com/Chris00312/luminote/releases/latest',
    label: { zh: '下载 Chrome / Edge 安装包', en: 'Download for Chrome / Edge', ja: 'Chrome / Edge 版をダウンロード' },
  },
  source: {
    href: '#source',
    label: { zh: '查看源码', en: 'View source', ja: 'ソースを見る' },
  },
};

function Download({ lang }) {
  const isMobile = useIsMobile();
  const L = (o) => o[lang] || o.en;

  const steps = [
    {
      n: '01',
      zh_t: '下载并解压', en_t: 'Download & unzip', ja_t: 'ダウンロードして解凍',
      zh: '下载 zip，解压得到一个文件夹。',
      en: 'Download the zip and unzip it into a folder.',
      ja: 'zip をダウンロードしてフォルダに解凍します。',
    },
    {
      n: '02',
      zh_t: '打开扩展管理页', en_t: 'Open the extensions page', ja_t: '拡張機能ページを開く',
      zh: '浏览器地址栏输入 chrome://extensions（Edge 为 edge://extensions）。',
      en: 'Go to chrome://extensions (edge://extensions on Edge).',
      ja: 'アドレスバーに chrome://extensions と入力（Edge は edge://extensions）。',
    },
    {
      n: '03',
      zh_t: '加载已解压的扩展', en_t: 'Load unpacked', ja_t: 'パッケージ化されていない拡張機能を読み込む',
      zh: '打开右上角「开发者模式」，点「加载已解压的扩展程序」，选中刚解压的文件夹。',
      en: 'Turn on "Developer mode" (top right), click "Load unpacked", and pick the unzipped folder.',
      ja: '右上の「デベロッパーモード」をオンにし、「パッケージ化されていない拡張機能を読み込む」で解凍したフォルダを選択。',
    },
    {
      n: '04',
      zh_t: '填入你自己的 API Key', en_t: 'Add your own API key', ja_t: '自分の API Key を設定',
      zh: '打开设置，选择 AI 服务商并粘贴你的 API Key。之后所有请求都由你的浏览器直接发给该服务商。',
      en: 'Open Settings, pick an AI provider and paste your API key. From then on every request goes straight from your browser to that provider.',
      ja: '設定を開き、AI プロバイダーを選んで API Key を貼り付けます。以降のリクエストはブラウザから直接プロバイダーへ送られます。',
    },
  ];

  const facts = [
    { zh: '永久免费 · 无需注册', en: 'Free forever · no sign-up', ja: '永久無料 · 登録不要' },
    { zh: '数据只存在本地', en: 'Data stays on your device', ja: 'データはローカルのみ' },
    { zh: '自带 API Key', en: 'Bring your own API key', ja: '自分の API Key を持ち込み' },
    { zh: 'MIT 开源', en: 'MIT licensed', ja: 'MIT ライセンス' },
  ];

  return (
    <section id="download" style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1100 }}>
        <SectionHead
          lang={lang}
          eyebrow={L({ zh: '下载', en: 'Download', ja: 'ダウンロード' })}
          title={L({ zh: '直接下载安装包.', en: 'Download the installer directly.', ja: 'インストーラーを直接ダウンロード。' })}
          sub={L({
            zh: '不经过任何应用商店 —— 下载 zip，加载到浏览器即可。',
            en: 'No store in between — grab the zip and load it into your browser.',
            ja: 'ストアを経由しません — zip を取得してブラウザに読み込むだけ。',
          })}
          center
        />

        <div style={{
          marginTop: isMobile ? 28 : 40,
          padding: isMobile ? '28px 22px' : '44px 48px',
          borderRadius: 26,
          background: 'linear-gradient(180deg, #ffffff, #f4fbf6)',
          border: '1.5px solid rgba(26,107,74,0.28)',
          boxShadow: '0 14px 44px rgba(26,107,74,0.13), inset 0 0 0 1px rgba(255,255,255,0.6)',
          display: 'flex', flexDirection: 'column', gap: 26,
        }}>
          {/* Primary CTA row */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={DOWNLOADS.chrome.href} download style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '15px 26px', borderRadius: 9999,
              background: 'var(--accent-gradient)',
              color: '#fff', textDecoration: 'none',
              font: '700 15px var(--ln-font-brand)',
              boxShadow: 'var(--accent-glow-lg)',
              transition: 'all 180ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              <IChrome size={17} />
              {L(DOWNLOADS.chrome.label)}
              <IArrowRight size={15} strokeWidth={2.5} />
            </a>

            <a href="#source" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 22px', borderRadius: 9999,
              background: 'rgba(26,107,74,0.07)',
              border: '1px solid rgba(26,107,74,0.24)',
              color: 'var(--accent-deep)', textDecoration: 'none',
              font: '600 14.5px var(--ln-font-brand)',
            }}>
              {L(DOWNLOADS.source.label)}
            </a>
          </div>

          {/* Reassurance strip */}
          <div style={{ display: 'flex', gap: isMobile ? 14 : 26, flexWrap: 'wrap' }}>
            {facts.map((f, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                font: '13px var(--ln-font-body)', color: 'var(--ln-fg2)',
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'rgba(26,107,74,0.14)',
                  display: 'grid', placeItems: 'center', color: 'var(--accent-deep)',
                  flexShrink: 0,
                }}>
                  <ICheck size={10} strokeWidth={3} />
                </span>
                {L(f)}
              </span>
            ))}
          </div>

          {/* Install steps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? 18 : 20,
            paddingTop: 8,
          }}>
            {steps.map((s) => (
              <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{
                  font: '700 12px var(--ln-font-mono)', color: 'var(--accent-deep)',
                  letterSpacing: '0.06em',
                }}>{s.n}</span>
                <div style={{ font: '600 14.5px var(--ln-font-brand)', color: '#0f2a1d' }}>
                  {L({ zh: s.zh_t, en: s.en_t, ja: s.ja_t })}
                </div>
                <p style={{ margin: 0, font: '13px/1.55 var(--ln-font-body)', color: 'var(--ln-fg3)' }}>
                  {L({ zh: s.zh, en: s.en, ja: s.ja })}
                </p>
              </div>
            ))}
          </div>

          <p style={{ margin: 0, font: '12px/1.6 var(--ln-font-body)', color: 'var(--ln-fg5)' }}>
            {L({
              zh: '以开发者模式加载的扩展不会自动更新。想获得新版本时，重新下载 zip 并覆盖原文件夹即可，本地数据不会丢失。',
              en: 'An unpacked extension does not auto-update. To get a newer version, download the zip again and replace the folder — your local data stays intact.',
              ja: 'デベロッパーモードで読み込んだ拡張機能は自動更新されません。新しいバージョンを得るには zip を再ダウンロードしてフォルダを置き換えてください（ローカルデータは保持されます）。',
            })}
          </p>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Download });
