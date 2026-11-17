// Gallery — 8 product surfaces as mini glass cards
function Gallery({ lang }) {
  const isMobile = useIsMobile();
  const items = COPY.gallery.items;
  const previews = [Popup, MarkBubble, ExplainCard, FullNotebook, MoodboardCanvas, AgentPanel, Settings, PDFViewer];
  return (
    <section id="interfaces" style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <SectionHead lang={lang} eyebrow={t(COPY.gallery.eyebrow, lang)} title={t(COPY.gallery.title, lang)} center/>
        <div style={{
          marginTop: isMobile ? 28 : 48,
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? 16 : 20,
        }}>
          {items.map((it, i) => {
            const Preview = previews[i];
            return (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', gap: 14,
                padding: 18,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(16px) saturate(1.3)',
                border: '1px solid rgba(232,239,234,0.7)',
                boxShadow: '0 4px 14px rgba(10,30,18,0.06), inset 0 0 0 1px rgba(255,255,255,0.55)',
                transition: 'all 200ms',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{
                  height: 180, borderRadius: 12, overflow: 'hidden',
                  background: 'var(--page-bg)',
                  position: 'relative',
                  border: '1px solid rgba(192,201,194,0.3)',
                }}>
                  <div style={{ transform: 'scale(0.58)', transformOrigin: 'top left', width: '172%', height: '172%' }}>
                    <Preview/>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: '700 10px var(--ln-font-brand)', letterSpacing: '0.08em', color: 'var(--accent-deep)' }}>0{i+1}</span>
                    <div style={{ font: '600 14.5px var(--ln-font-brand)', color: 'var(--ln-fg1)' }}>
                      {lang === 'zh' ? it.zh_t : it.en_t}
                    </div>
                  </div>
                  <div style={{ font: '12.5px/1.5 var(--ln-font-body)', color: 'var(--ln-fg3)' }}>
                    {lang === 'zh' ? it.zh : it.en}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -- mini previews (simplified) --
const pbox = { width: 320, height: 220, borderRadius: 10, background: '#fff', border: '1px solid rgba(192,201,194,0.4)', overflow: 'hidden', boxShadow: '0 6px 20px rgba(10,30,18,0.1)' };

function Popup() {
  return (
    <div style={{ ...pbox, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(220,229,222,0.6)', background: 'rgba(255,255,255,0.7)' }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><IStack size={10}/></div>
        <div style={{ flex: 1, font: '600 11px var(--ln-font-brand)' }}>LumiNote</div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '5px 8px 0' }}>
        {['Today','Calendar','Boards'].map((x, i) => (
          <div key={i} style={{ flex: 1, padding: '4px 6px', font: '600 9px var(--ln-font-body)', textAlign: 'center',
            color: i === 0 ? 'var(--accent-deep)' : 'var(--ln-fg4)',
            borderBottom: i === 0 ? '1.5px solid var(--accent-deep)' : 'none' }}>{x}</div>
        ))}
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(232,239,234,0.7)' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', font: '9px var(--ln-font-body)', color: 'var(--ln-fg4)', marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-gradient)' }}/> nature.com
            </div>
            <div style={{ font: '10.5px/1.35 Georgia, serif', color: 'var(--ln-fg2)', paddingLeft: 6, borderLeft: '2px solid rgba(26,107,74,0.35)' }}>
              {['Circadian rhythms organize…','Idempotency keys allow you…','Shift work, jet lag, pushed…'][i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkBubble() {
  return (
    <div style={{ ...pbox, position: 'relative', background: '#fafaf7', padding: 20 }}>
      <div style={{ font: '700 14px Georgia, serif', marginBottom: 10 }}>The geometry of time</div>
      <div style={{ font: '11.5px/1.55 Georgia, serif', color: '#2a2a28' }}>
        Plants tilt to the sun; humans wake with it.{' '}
        <span style={{ background: 'rgba(26,107,74,0.22)', padding: '1px 2px' }}>Circadian rhythms organize behavior on 24-hour cycles</span>.
      </div>
      <div style={{
        position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 9999,
        background: 'var(--accent-gradient-hero)', color: '#fff',
        font: '600 11px var(--ln-font-brand)',
        boxShadow: '0 6px 20px rgba(26,107,74,0.4)',
      }}><IStack size={11}/> Mark</div>
    </div>
  );
}

function ExplainCard() {
  return (
    <div style={{ ...pbox, background: 'var(--page-bg)', position: 'relative', padding: 16 }}>
      <div style={{ font: '10px Georgia, serif', color: 'var(--ln-fg4)', marginBottom: 8 }}>... lorem ipsum article content continues ...</div>
      <div style={{
        position: 'absolute', bottom: 10, right: 10, width: 220,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(232,239,234,0.7)',
        borderRadius: 14,
        boxShadow: '0 12px 30px rgba(10,30,18,0.15)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(232,239,234,0.6)' }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><IBolt size={9}/></div>
          <div style={{ font: '9.5px var(--ln-font-body)', color: 'var(--ln-fg3)' }}>nature.com</div>
        </div>
        <div style={{ padding: 8, font: '9.5px/1.35 Georgia, serif', borderLeft: '2px solid rgba(26,107,74,0.4)', margin: 6, color: 'var(--ln-fg2)' }}>
          Circadian rhythms organize behavior on 24-hour cycles…
        </div>
        <div style={{ padding: 8, font: '9.5px/1.45 var(--ln-font-body)', color: 'var(--ln-fg1)' }}>
          A 24-hour timer almost every cell carries. Light pulls it back into phase.
        </div>
        <div style={{ padding: 8, borderTop: '1px solid rgba(232,239,234,0.6)' }}>
          <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--accent-gradient)', color: '#fff', font: '600 10px var(--ln-font-brand)', textAlign: 'center' }}>Save to memory</div>
        </div>
      </div>
    </div>
  );
}

function FullNotebook() {
  return (
    <div style={{ ...pbox, display: 'grid', gridTemplateColumns: '70px 1fr 90px', background: 'var(--page-bg)' }}>
      <div style={{ padding: 6, background: 'rgba(255,255,255,0.5)', borderRight: '1px solid rgba(220,229,222,0.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: 4, fontSize: 9 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--accent-gradient)' }}/>
          <span style={{ fontWeight: 700 }}>LN</span>
        </div>
        {['Today','Calendar','Search'].map((l,i) => (
          <div key={i} style={{ padding: '4px 6px', font: '9px var(--ln-font-body)', color: i === 0 ? 'var(--accent-deep)' : 'var(--ln-fg3)', background: i === 0 ? 'rgba(26,107,74,0.1)' : 'transparent', borderRadius: 5 }}>{l}</div>
        ))}
        <div style={{ font: '8px var(--ln-font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ln-fg4)', padding: '6px 4px 2px' }}>Boards</div>
        {['Circadian','Inference'].map((l,i) => (
          <div key={i} style={{ padding: '3px 6px', font: '8.5px var(--ln-font-body)', color: 'var(--ln-fg3)' }}>· {l}</div>
        ))}
      </div>
      <div style={{ padding: 10, position: 'relative', backgroundImage: 'radial-gradient(circle, rgba(26,107,74,0.1) 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
        <div style={{ font: '700 11px var(--ln-font-brand)', marginBottom: 8 }}>Circadian biology</div>
        {[{x:0,y:22,w:70,accent:true},{x:80,y:28,w:60},{x:20,y:80,w:90},{x:115,y:82,w:65,warm:true}].map((c,i) => (
          <div key={i} style={{ position: 'absolute', left: c.x+10, top: c.y+20, width: c.w, height: 40, borderRadius: 6,
            background: c.warm?'linear-gradient(135deg,#c87a3a,#d49530)':'rgba(255,255,255,0.85)',
            border: c.accent?'1.5px solid var(--accent-deep)':'1px solid rgba(232,239,234,0.7)',
            boxShadow: '0 2px 6px rgba(10,30,18,0.08)' }}/>
        ))}
      </div>
      <div style={{ padding: 6, background: 'rgba(255,255,255,0.5)', borderLeft: '1px solid rgba(220,229,222,0.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ font: '9px var(--ln-font-brand)', fontWeight: 700, marginBottom: 4 }}>Agent</div>
        <div style={{ padding: 5, borderRadius: 6, background: 'var(--accent-gradient)', color: '#fff', font: '8px var(--ln-font-body)', alignSelf: 'flex-end' }}>
          What does my board say…
        </div>
        <div style={{ padding: 5, borderRadius: 6, background: 'rgba(26,107,74,0.07)', border: '1px solid rgba(26,107,74,0.18)', font: '7.5px var(--ln-font-mono)', color: 'var(--accent-deep)' }}>
          search_memories…
        </div>
        <div style={{ padding: 5, borderRadius: 6, background: 'rgba(255,255,255,0.8)', font: '8px var(--ln-font-body)', color: 'var(--ln-fg1)' }}>
          Three threads…
        </div>
      </div>
    </div>
  );
}

function MoodboardCanvas() {
  return (
    <div style={{ ...pbox, background: 'var(--page-bg)', position: 'relative',
      backgroundImage: 'radial-gradient(circle, rgba(26,107,74,0.1) 1px, transparent 1px)', backgroundSize: '14px 14px', padding: 10 }}>
      <div style={{ font: '700 10px var(--ln-font-brand)', marginBottom: 4, color: 'var(--accent-deep)', letterSpacing: '-0.005em' }}>
        <IMoodboard size={10} style={{ verticalAlign: '-1px', marginRight: 4 }}/>
        Circadian biology
      </div>
      <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 18px)' }}>
        {getMoodCards('en').map((c, i) => (
          <MoodCard key={i} card={c} scale={0.45} compact/>
        ))}
      </div>
    </div>
  );
}

function AgentPanel() {
  return (
    <div style={{ ...pbox, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.5)', padding: 10 }}>
      <div style={{ font: '700 11px var(--ln-font-brand)', marginBottom: 8 }}>Agent · Chat</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ alignSelf: 'flex-end', padding: '6px 9px', borderRadius: 9, background: 'var(--accent-gradient)', color: '#fff', font: '10px var(--ln-font-body)', maxWidth: '82%' }}>Summarize my circadian notes</div>
        <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(26,107,74,0.07)', border: '1px solid rgba(26,107,74,0.2)', font: '9.5px var(--ln-font-mono)', color: 'var(--accent-deep)', display: 'flex', gap: 4 }}>
          <ISearch size={9}/> search_memories · 8 hits
        </div>
        <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(26,107,74,0.07)', border: '1px solid rgba(26,107,74,0.2)', font: '9.5px var(--ln-font-mono)', color: 'var(--accent-deep)' }}>read_memory ×3 · ok</div>
        <div style={{ padding: '6px 9px', borderRadius: 9, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(232,239,234,0.7)', font: '10px/1.4 var(--ln-font-body)', maxWidth: '88%' }}>
          Three threads run through your board: <b>the clock is old</b>, light is the master zeitgeber…
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: 6, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(232,239,234,0.7)', borderRadius: 9, marginTop: 8 }}>
        <div style={{ flex: 1, font: '9px var(--ln-font-body)', color: 'var(--ln-fg5)', padding: '3px 4px' }}>Ask about your memories…</div>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent-gradient)', display: 'grid', placeItems: 'center', color: '#fff' }}><ISend size={10}/></div>
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div style={{ ...pbox, background: 'var(--page-bg)', padding: 14 }}>
      <div style={{ font: '700 12px var(--ln-font-brand)', color: 'var(--accent-deep)', marginBottom: 2 }}>LumiNote</div>
      <div style={{ font: '9.5px var(--ln-font-body)', color: 'var(--ln-fg4)', marginBottom: 10 }}>Settings</div>
      <div style={{ padding: 10, borderRadius: 10, background: 'linear-gradient(135deg,#fff,#e8f5ec)', border: '1px solid rgba(26,107,74,0.3)', marginBottom: 8 }}>
        <div style={{ font: '700 11px var(--ln-font-brand)', color: 'var(--accent-deep)' }}>AI Provider</div>
        <div style={{ font: '8.5px var(--ln-font-body)', color: 'var(--ln-fg3)' }}>Your own API key · local only</div>
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(232,239,234,0.7)' }}>
        <div style={{ font: '700 10px var(--ln-font-brand)', marginBottom: 6 }}>Data</div>
        <div style={{ height: 5, borderRadius: 9999, background: 'rgba(26,107,74,0.1)', overflow: 'hidden' }}>
          <div style={{ width: '24%', height: '100%', background: 'var(--accent-gradient)' }}/>
        </div>
        <div style={{ font: '8px var(--ln-font-body)', color: 'var(--ln-fg4)', marginTop: 4 }}>Stored on this device</div>
      </div>
    </div>
  );
}

function PDFViewer() {
  return (
    <div style={{ ...pbox, background: '#e8edec', padding: 12, position: 'relative' }}>
      <div style={{ background: '#fff', borderRadius: 6, padding: 10, boxShadow: '0 2px 6px rgba(10,30,18,0.1)', height: '100%' }}>
        <div style={{ font: '700 10px Georgia, serif', marginBottom: 5 }}>Dynamic stability of brain networks</div>
        <div style={{ font: '8px var(--ln-font-body)', color: 'var(--ln-fg4)', marginBottom: 8 }}>arXiv:2403.04132 · 14 pp</div>
        {[0,1,2,3,4,5,6].map(i => (
          <div key={i} style={{ height: 4, borderRadius: 2, background: 'rgba(64,73,67,0.15)', marginBottom: 5, width: `${85 - (i%3)*10}%` }}/>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[IPlus, IImage, IBolt].map((I, i) => (
          <div key={i} style={{ width: 28, height: 28, borderRadius: '50%',
            background: i === 2 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.95)',
            display: 'grid', placeItems: 'center',
            color: i === 2 ? '#fff' : 'var(--accent-deep)',
            boxShadow: i === 2 ? 'var(--accent-glow)' : '0 4px 10px rgba(10,30,18,0.12)' }}>
            <I size={14}/>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Gallery });
