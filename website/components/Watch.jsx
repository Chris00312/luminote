// Watch — dedicated section for the 18-second Remotion promo video.
// Sits between Hero and LiveDemo; video autoplays muted + loops, with an
// unmute pill overlay that dismisses after first toggle.
function Watch({ lang }) {
  const isMobile = useIsMobile();
  const videoRef = React.useRef(null);
  const [muted, setMuted] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(false);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    // Some browsers pause when toggling muted via JS; make sure it keeps going
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    setMuted(false);
    setDismissed(true);
  };

  return (
    <section id="watch" style={{
      padding: isMobile ? '56px 16px' : '100px 24px',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 1100 }}>
        <SectionHead
          lang={lang}
          eyebrow={t(COPY.watch.eyebrow, lang)}
          title={t(COPY.watch.title, lang)}
          sub={t(COPY.watch.sub, lang)}
          center
        />

        <div style={{
          position: 'relative',
          marginTop: isMobile ? 28 : 44,
          marginLeft: 'auto', marginRight: 'auto',
          maxWidth: 960,
          borderRadius: isMobile ? 18 : 22,
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 30px 80px rgba(10,30,18,0.18), 0 8px 24px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)',
          border: '1px solid rgba(232,239,234,0.7)',
        }}>
          <video
            ref={videoRef}
            src="assets/luminote-preview.mp4"
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-label={lang === 'zh' ? 'LumiNote 18 秒产品演示' : 'LumiNote 18-second product demo'}
            style={{
              width: '100%', height: 'auto', display: 'block',
              aspectRatio: '16 / 9',
            }}
          />

          {!dismissed && (
            <button
              onClick={toggleMute}
              style={{
                position: 'absolute',
                top: isMobile ? 10 : 14, right: isMobile ? 10 : 14,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: isMobile ? '7px 12px' : '8px 14px',
                borderRadius: 9999, border: 'none',
                background: 'rgba(25,28,26,0.78)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: '#fff',
                font: '600 12.5px var(--ln-font-brand)',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(25,28,26,0.92)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(25,28,26,0.78)'; e.currentTarget.style.transform = 'none'; }}
            >
              {t(COPY.watch.unmute, lang)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Watch });
