// Hero — left: copy + CTA; right: animated browser window showing Mark → Explain → Moodboard loop
function Hero({ lang }) {
  const isMobile = useIsMobile();
  return (
    <section style={{
      padding: isMobile ? '24px 16px 56px' : '40px 24px 80px',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 1200,
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr',
        gap: isMobile ? 32 : 48,
        alignItems: 'center',
      }}>
        <HeroCopy lang={lang} />
        <HeroAnimation lang={lang} />
      </div>
    </section>
  );
}

function HeroCopy({ lang }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 18 : 22, animation: 'fadeInUp 500ms both' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start',
        padding: '6px 12px', borderRadius: 9999,
        background: 'rgba(26,107,74,0.08)',
        border: '1px solid rgba(26,107,74,0.14)',
        color: 'var(--accent-deep)',
        font: '700 11px var(--ln-font-brand)',
        letterSpacing: '0.09em', textTransform: 'uppercase',
      }}>
        <ISparkle size={12} />
        {t(COPY.hero.eyebrow, lang)}
      </span>

      <h1 style={{
        margin: 0,
        font: `700 ${isMobile ? (lang === 'zh' ? '38px' : '40px') : (lang === 'zh' ? '58px' : '62px')}/1.05 var(--ln-font-brand)`,
        letterSpacing: '-0.02em',
        color: 'var(--ln-fg1)',
      }}>
        {t(COPY.hero.title1, lang)}<br/>
        <span style={{
          background: 'var(--accent-gradient-hero)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>{t(COPY.hero.title2, lang)}</span>
      </h1>

      <p style={{
        margin: 0, maxWidth: 520,
        font: '400 17px/1.6 var(--ln-font-body)',
        color: 'var(--ln-fg2)',
        textWrap: 'pretty',
      }}>{t(COPY.hero.lede, lang)}</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }} id="install">
        <a href="https://github.com/Chris00312/luminote/releases/latest" target="_blank" rel="noopener" style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          padding: '14px 22px', borderRadius: 9999,
          background: 'var(--accent-gradient)',
          color: '#fff', textDecoration: 'none',
          font: '600 15px var(--ln-font-brand)',
          boxShadow: 'var(--accent-glow-lg)',
          transition: 'all 180ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        >
          <IChrome size={17} />
          {t(COPY.hero.cta, lang)}
          <IArrowRight size={15} strokeWidth={2.5} />
        </a>
        <a href="#download" style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          padding: '13px 20px', borderRadius: 9999,
          background: 'rgba(26,107,74,0.08)',
          border: '1px solid rgba(26,107,74,0.22)',
          color: 'var(--accent-deep)', textDecoration: 'none',
          font: '600 15px var(--ln-font-brand)',
          transition: 'all 180ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,107,74,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,107,74,0.08)'; e.currentTarget.style.transform = 'none'; }}
        >
          <IEdge size={17} />
          {t(COPY.hero.edgeCta, lang)}
        </a>
        <a href="#watch" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '13px 18px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(192,201,194,0.6)',
          color: 'var(--ln-fg1)', textDecoration: 'none',
          font: '600 14px var(--ln-font-brand)',
          backdropFilter: 'blur(10px)',
        }}>
          {t(COPY.hero.subcta, lang)}
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ln-fg4)', font: '13px var(--ln-font-body)' }}>
        <ICheck size={14} strokeWidth={2.5} style={{ color: 'var(--accent-deep)' }} />
        {t(COPY.hero.meta, lang)}
      </div>

      <HeroStats lang={lang} />
    </div>
  );
}

function HeroStats({ lang }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14,
      marginTop: 10, paddingTop: 22,
      borderTop: '1px solid rgba(192,201,194,0.5)',
    }}>
      {COPY.stats.map((s, i) => (
        <div key={i}>
          <div style={{ font: '700 22px var(--ln-font-brand)', color: 'var(--accent-deep)', letterSpacing: '-0.02em' }}>{s.num}</div>
          <div style={{ font: '12px var(--ln-font-body)', color: 'var(--ln-fg3)', marginTop: 4 }}>{t({ zh: s.zh, en: s.en }, lang)}</div>
        </div>
      ))}
    </div>
  );
}

/* Animated browser window — loops through Mark → Explain → Moodboard states */
function HeroAnimation({ lang }) {
  const isMobile = useIsMobile();
  // Phase 0: clean page, 1: selected, 2: mark bubble, 3: explain card, 4: saved + flying card, 5: on moodboard
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    const steps = [
      [0, 1200],
      [1, 900],
      [2, 900],
      [3, 2400],
      [4, 1200],
      [5, 1800],
    ];
    let t;
    let i = 0;
    const tick = () => {
      const [p, d] = steps[i];
      setPhase(p);
      i = (i + 1) % steps.length;
      t = setTimeout(tick, d);
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  // Hide on mobile after hooks run — the browser mockup has absolute-positioned moodboard cards that overflow below 420px viewport
  if (isMobile) return null;

  const passage = lang === 'zh'
    ? '昼夜节律以大约 24 小时为周期组织行为, 由光设定, 每个清晨重置.'
    : 'Circadian rhythms organize behavior on roughly 24-hour cycles, set by light and reset every morning.';

  return (
    <div style={{ position: 'relative', animation: 'fadeInUp 600ms 100ms both' }}>
      {/* Browser chrome */}
      <div style={{
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(10,30,18,0.18), 0 8px 24px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)',
        background: '#fff',
      }}>
        {/* Chrome top bar */}
        <div style={{
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(180deg,#eceff0,#e2e6e8)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c =>
              <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }}/>)}
          </div>
          <div style={{
            flex: 1, margin: '0 10px',
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.85)', borderRadius: 8,
            font: '11.5px var(--ln-font-mono)', color: '#6a7570',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ILock size={11} />
            nature.com / circadian-rhythms
          </div>
          {/* LumiNote toolbar icon with pulse */}
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--accent-gradient)',
            display: 'grid', placeItems: 'center',
            color: '#fff',
            animation: phase === 0 ? 'pulse-green 2s infinite' : 'none',
            boxShadow: 'var(--accent-glow)',
          }}><IStack size={13}/></div>
        </div>

        {/* Page body */}
        <div style={{
          position: 'relative',
          height: 460, overflow: 'hidden',
          background: '#fafaf7',
          padding: '32px 36px',
        }}>
          <div style={{ font: '700 22px/1.2 Georgia, serif', color: '#1a1a18', marginBottom: 6, letterSpacing: '-0.005em' }}>
            {lang === 'zh' ? '生物时间的几何' : 'The geometry of biological time'}
          </div>
          <div style={{ font: '12px var(--ln-font-body)', color: '#8a918d', marginBottom: 20 }}>
            {lang === 'zh' ? 'Nature · 2026 年 4 月' : 'Nature · April 2026 · 7 min read'}
          </div>
          <p style={{ font: '14.5px/1.65 Georgia, serif', color: '#2a2a28', margin: 0, marginBottom: 14 }}>
            {lang === 'zh'
              ? '在漫长的演化历程中, 光的节律决定了行为的节律. 植物朝着太阳倾斜, 人类随着日出醒来. '
              : 'For most of evolutionary history, the rhythm of light defined the rhythm of behavior. Plants tilt to the sun; humans wake with it. '}
            <span style={{
              background: phase >= 1 ? 'rgba(26,107,74,0.22)' : 'transparent',
              borderRadius: 2,
              transition: 'background 250ms',
              padding: '1px 2px',
            }}>{passage}</span>
            {' '}
            {lang === 'zh'
              ? '看似是习惯的东西, 其实往往是一只钟.'
              : 'What looks like a habit is, very often, a clock.'}
          </p>
          <p style={{ font: '14.5px/1.65 Georgia, serif', color: '#2a2a28', margin: 0, opacity: 0.6 }}>
            {lang === 'zh'
              ? '这套机制比动物更古老. PER 和 CRY 蛋白之间的几个反馈回路…'
              : 'The mechanism turns out to be older than animals. A handful of feedback loops…'}
          </p>

          {/* Mark bubble */}
          {phase >= 2 && phase <= 3 && (
            <div style={{
              position: 'absolute',
              top: 220, left: 220,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 9999,
              background: 'var(--accent-gradient-hero)',
              color: '#fff', font: '600 12px var(--ln-font-brand)',
              boxShadow: '0 6px 20px rgba(26,107,74,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              animation: 'bubbleIn 220ms cubic-bezier(0.3,1.3,0.4,1)',
              zIndex: 5,
            }}>
              <IStack size={13}/> Mark
            </div>
          )}

          {/* Explain card */}
          {phase >= 3 && phase <= 4 && (
            <div style={{
              position: 'absolute',
              bottom: 16, right: 16,
              width: 300,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px) saturate(1.4)',
              border: '1px solid rgba(232,239,234,0.7)',
              boxShadow: '0 24px 60px rgba(10,30,18,0.2), inset 0 0 0 1px rgba(255,255,255,0.6)',
              overflow: 'hidden',
              animation: phase === 4 ? 'flyOut 700ms forwards' : 'cardIn 300ms cubic-bezier(0.2,0.9,0.3,1)',
              zIndex: 6,
            }}>
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(232,239,234,0.7)' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><IBolt size={11}/></div>
                <div style={{ flex: 1, font: '10.5px var(--ln-font-body)', color: 'var(--ln-fg4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: 'var(--ln-fg2)', fontWeight: 600 }}>nature.com</strong> · {lang === 'zh' ? '生物时间的几何' : 'The geometry of biological time'}
                </div>
              </div>
              <div style={{ padding: '10px 12px 0' }}>
                <div style={{ font: '11.5px/1.4 Georgia, serif', color: 'var(--ln-fg2)', paddingLeft: 8, borderLeft: '2.5px solid rgba(26,107,74,0.4)' }}>{passage}</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'inline-flex', padding: 2, borderRadius: 9999, background: 'rgba(26,107,74,0.08)' }}>
                  {[lang === 'zh' ? '简洁' : 'Brief', lang === 'zh' ? '详细' : 'Detailed', lang === 'zh' ? '深度' : 'Deep'].map((l, i) => (
                    <div key={i} style={{
                      padding: '3px 9px', borderRadius: 9999, font: '600 10px var(--ln-font-brand)',
                      background: i === 1 ? '#fff' : 'transparent',
                      color: i === 1 ? 'var(--accent-deep)' : 'var(--ln-fg4)',
                      boxShadow: i === 1 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>{l}</div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '2px 12px 12px', font: '12px/1.5 var(--ln-font-body)', color: 'var(--ln-fg1)' }}>
                {lang === 'zh'
                  ? '一个几乎每个细胞都自带的 24 小时计时器. 黎明的光会把它拉回与世界同相位; 没有光, 它每天漂移 ~10 分钟.'
                  : 'A 24-hour timer almost every cell carries. Dawn light nudges it into phase with the world; without it, drifts ~10 min/day.'}
                <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--accent-deep)', verticalAlign: '-2px', marginLeft: 2, animation: 'blink 1s steps(2) infinite' }}/>
              </div>
              <div style={{ display: 'flex', gap: 5, padding: '9px 10px', borderTop: '1px solid rgba(232,239,234,0.7)', background: 'rgba(244,250,246,0.4)' }}>
                <button style={{
                  flex: 1, padding: '7px 10px', border: 'none', borderRadius: 9,
                  background: 'var(--accent-gradient)', color: '#fff',
                  font: '600 11.5px var(--ln-font-brand)',
                  boxShadow: 'var(--accent-glow)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}><ICheck size={11} strokeWidth={3}/> {lang === 'zh' ? '保存到记忆' : 'Save to memory'}</button>
              </div>
            </div>
          )}

          {/* Flying card — appears phase 4 */}
          {phase === 4 && (
            <div style={{
              position: 'absolute', bottom: 80, right: 30,
              width: 120, height: 70, borderRadius: 12,
              background: 'linear-gradient(135deg,rgba(255,255,255,0.9),rgba(240,252,246,0.8))',
              border: '1px solid rgba(26,107,74,0.3)',
              animation: 'flyCard 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
              zIndex: 7,
              boxShadow: '0 8px 24px rgba(26,107,74,0.25)',
            }}/>
          )}

          {/* Moodboard overlay — phase 5 */}
          {phase === 5 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 8,
              background: 'linear-gradient(135deg, #f0f5f1 0%, #e8f0ea 40%, #f2f6f0 70%, #edf5ef 100%)',
              animation: 'fadeInUp 400ms',
              padding: 18,
              backgroundImage: 'radial-gradient(circle, rgba(26,107,74,0.08) 1px, transparent 1px), linear-gradient(135deg, #f0f5f1 0%, #e8f0ea 40%, #f2f6f0 70%, #edf5ef 100%)',
              backgroundSize: '18px 18px, 100% 100%',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <IMoodboard size={16} style={{ color: 'var(--accent-deep)' }}/>
                <div style={{ font: '700 14px var(--ln-font-brand)', color: 'var(--ln-fg1)' }}>
                  {lang === 'zh' ? '昼夜生物学' : 'Circadian biology'}
                </div>
                <div style={{ font: '11px var(--ln-font-body)', color: 'var(--ln-fg4)' }}>
                  {lang === 'zh' ? '5 张卡 · 刚刚更新' : '5 cards · just updated'}
                </div>
              </div>
              {/* Scaled moodboard canvas — cards use Remotion-ported MoodCard design */}
              <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 30px)', animation: 'cardLand 500ms cubic-bezier(0.3,1.3,0.4,1)' }}>
                {getMoodCards(lang).map((c, i) => (
                  <MoodCard key={i} card={c} scale={0.78}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating label */}
      <PhaseLabel phase={phase} lang={lang} />
    </div>
  );
}

function MiniCard({ x, y, w, warm, img, first, children, accent, newEntry }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y + 40, width: w,
      padding: 8,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.85)',
      border: accent ? '1.5px solid var(--accent-deep)' : '1px solid rgba(232,239,234,0.7)',
      boxShadow: accent
        ? '0 0 0 2px rgba(26,107,74,0.2), 0 8px 24px rgba(26,107,74,0.18), inset 0 0 0 1px rgba(255,255,255,0.55)'
        : '0 6px 16px rgba(10,30,18,0.08), inset 0 0 0 1px rgba(255,255,255,0.55)',
      backdropFilter: 'blur(12px)',
      animation: newEntry ? 'cardLand 500ms cubic-bezier(0.3,1.3,0.4,1)' : 'none',
    }}>
      <div style={{
        aspectRatio: '16/10', borderRadius: 8,
        background: img ? 'linear-gradient(135deg,#2a4d3a,#1a6b4a)'
          : warm ? 'linear-gradient(135deg,#c87a3a,#d49530)'
          : 'linear-gradient(135deg,rgba(26,107,74,0.18),rgba(47,163,115,0.28))',
        marginBottom: 6,
      }}/>
      {children}
    </div>
  );
}

function PhaseLabel({ phase, lang }) {
  const labels = lang === 'zh'
    ? ['打开任意网页', '选中一段文字', '点击 Mark 气泡', 'AI 流式解释', '保存到记忆', '落到灵感板']
    : ['Open any page', 'Select text', 'Click Mark', 'AI streams in', 'Save to memory', 'Lands on moodboard'];
  return (
    <div style={{
      position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '8px 14px', borderRadius: 9999,
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(232,239,234,0.7)',
      boxShadow: '0 4px 12px rgba(10,30,18,0.08)',
      font: '600 12px var(--ln-font-brand)', color: 'var(--accent-deep)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-deep)', animation: 'blink 1.5s infinite' }}/>
      {`0${phase + 1}`.slice(-2)} · {labels[phase]}
      <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>
        {labels.map((_, i) => (
          <span key={i} style={{
            width: 4, height: 4, borderRadius: '50%',
            background: i === phase ? 'var(--accent-deep)' : 'rgba(26,107,74,0.25)',
          }}/>
        ))}
      </span>
    </div>
  );
}

// Keyframe injection
const heroAnimStyle = document.createElement('style');
heroAnimStyle.textContent = `
  @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px) scale(0.85); } to { opacity: 1; transform: none; } }
  @keyframes cardIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: none; } }
  @keyframes cardLand { 0% { opacity: 0; transform: translate(30px, -40px) scale(0.7) rotate(8deg); } 100% { opacity: 1; transform: none; } }
  @keyframes flyCard { 0% { opacity: 0; transform: translate(0,0) scale(0.4); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-260px, -260px) scale(1) rotate(-10deg); } }
  @keyframes flyOut { to { opacity: 0; transform: translateY(-40px) scale(0.8); } }
  @keyframes blink { 50% { opacity: 0.3; } }
`;
document.head.appendChild(heroAnimStyle);

Object.assign(window, { Hero });
