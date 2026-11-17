// Shared moodboard-card visual system.
// Ported from Remotion-Lumi's Moodboard scene — same source pill / title /
// visual / meta structure, hero glow, inline stylized illustrations.
// Used by Hero (phase 5 overlay), Flow (step 03), and Gallery (MoodboardCanvas).

// --- Inline stylized visuals (no images) -----------------------------------

function ChartVisual({ compact }) {
  const bars = [32, 54, 40, 72, 48, 66, 58, 80, 44, 62];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, rgba(240,245,241,1) 0%, rgba(234,242,236,1) 100%)',
      borderRadius: 8,
      padding: compact ? 6 : 10,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: compact ? 1.5 : 3,
    }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: h + '%',
          background: i === 7
            ? 'linear-gradient(180deg, #2fa373 0%, #1a6b4a 100%)'
            : 'rgba(26,107,74,0.35)',
          borderRadius: 2,
        }}/>
      ))}
    </div>
  );
}

function DoughVisual() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(100% 80% at 50% 40%, #f5e6c8 0%, #e8d4a8 60%, #d4b888 100%)',
      borderRadius: 8,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '20%', left: '25%', width: '28%', height: '30%',
        borderRadius: 9999,
        background: 'radial-gradient(circle, rgba(255,253,240,0.6), transparent)' }}/>
      <div style={{ position: 'absolute', bottom: '15%', right: '20%', width: '18%', height: '20%',
        borderRadius: 9999,
        background: 'rgba(180,150,100,0.3)' }}/>
    </div>
  );
}

function NightCityVisual() {
  const lights = [
    { x: 10, y: 70, s: 2 }, { x: 25, y: 60, s: 3 }, { x: 40, y: 75, s: 2 },
    { x: 55, y: 55, s: 4 }, { x: 70, y: 70, s: 2 }, { x: 85, y: 65, s: 3 },
    { x: 15, y: 80, s: 2 }, { x: 35, y: 85, s: 2 }, { x: 60, y: 82, s: 3 },
    { x: 80, y: 80, s: 2 }, { x: 20, y: 45, s: 2 }, { x: 50, y: 40, s: 2 },
    { x: 75, y: 50, s: 2 },
  ];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #0a1628 0%, #1a2d4a 50%, #2a4568 100%)',
      borderRadius: 8,
      position: 'relative', overflow: 'hidden',
    }}>
      {lights.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: d.x + '%', top: d.y + '%',
          width: d.s, height: d.s, borderRadius: 9999,
          background: '#ffd27a',
          boxShadow: '0 0 4px rgba(255,210,122,0.8)',
        }}/>
      ))}
    </div>
  );
}

function QuoteVisual({ text, hero }) {
  return (
    <div style={{
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fontSize: hero ? 15 : 12,
      lineHeight: 1.4,
      color: '#191c1a',
      padding: hero ? '8px 11px' : '6px 9px',
      background: hero
        ? 'linear-gradient(135deg, rgba(47,163,115,0.18) 0%, rgba(47,163,115,0.10) 100%)'
        : 'rgba(47,163,115,0.12)',
      borderLeft: `3px solid rgba(47,163,115,${hero ? 0.8 : 0.6})`,
      borderRadius: 8,
    }}>
      "{text}"
    </div>
  );
}

function BodyVisual({ text }) {
  return (
    <div style={{
      font: '400 11.5px/1.5 var(--ln-font-body)',
      color: 'var(--ln-fg2)',
    }}>
      {text}
    </div>
  );
}

function PaperQuoteVisual({ text, byline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <div style={{
        font: '500 italic 13px/1.35 var(--ln-font-brand)',
        color: '#191c1a',
      }}>
        "{text}"
      </div>
      <div style={{
        marginTop: 5, font: '400 9.5px var(--ln-font-mono)',
        color: 'var(--ln-fg3)', letterSpacing: '0.08em',
      }}>
        {byline}
      </div>
    </div>
  );
}

function MoodVisual({ visual, hero, compact }) {
  if (visual.kind === 'quote')      return <QuoteVisual text={visual.text} hero={hero}/>;
  if (visual.kind === 'body')       return <BodyVisual text={visual.text}/>;
  if (visual.kind === 'paperQuote') return <PaperQuoteVisual text={visual.text} byline={visual.byline}/>;
  if (visual.kind === 'chart')      return <ChartVisual compact={compact}/>;
  if (visual.kind === 'dough')      return <DoughVisual/>;
  return <NightCityVisual/>;
}

// --- The card ---------------------------------------------------------------

function MoodCard({ card, scale = 1, compact = false }) {
  const s = scale;
  const padding = compact ? 10 * s : 14 * s;
  const titleSize = (card.hero ? 15 : 13) * s;
  return (
    <div style={{
      position: 'absolute',
      left: card.x * s, top: card.y * s,
      width: card.w * s, height: card.h * s,
      transform: `rotate(${card.rot || 0}deg)`,
      borderRadius: 14 * s,
      background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(12px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
      boxShadow: card.hero
        ? `0 16px 38px rgba(26,107,74,0.32), 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1.5px rgba(47,163,115,0.55), 0 0 0 1px rgba(255,255,255,0.6) inset`
        : '0 10px 22px rgba(25,28,26,0.12), 0 3px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.5) inset',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      padding,
      fontFamily: 'var(--ln-font-brand)',
      color: '#191c1a',
    }}>
      {/* Source pill + optional "just saved" accent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 * s, flexShrink: 0 }}>
        <div style={{
          font: `500 ${9 * s}px var(--ln-font-mono)`,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: card.hero ? 'var(--accent-deep)' : 'var(--ln-fg3)',
          padding: `${2 * s}px ${6 * s}px`,
          background: card.hero ? 'rgba(47,163,115,0.14)' : 'rgba(220,229,222,0.5)',
          borderRadius: 5 * s,
        }}>
          {card.source}
        </div>
        {card.hero && (
          <div style={{
            font: `500 ${8.5 * s}px var(--ln-font-mono)`,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--accent-deep)',
          }}>
            · just saved
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{
        marginTop: 6 * s,
        font: `700 ${titleSize}px/1.25 var(--ln-font-brand)`,
        letterSpacing: '-0.005em',
        flexShrink: 0,
      }}>
        {card.title}
      </div>

      {/* Visual */}
      <div style={{ flex: 1, marginTop: 7 * s, minHeight: 0, overflow: 'hidden' }}>
        <MoodVisual visual={card.visual} hero={!!card.hero} compact={compact}/>
      </div>

      {/* Meta */}
      {card.meta && (
        <div style={{
          marginTop: 6 * s,
          font: `400 ${8.5 * s}px var(--ln-font-mono)`,
          letterSpacing: '0.08em',
          color: 'var(--ln-fg5)',
          flexShrink: 0,
        }}>
          {card.meta}
        </div>
      )}
    </div>
  );
}

// --- Demo card curation (matches Remotion-Lumi's story) --------------------
// Positions are LAYOUT-space — each consumer (Hero/Flow/Gallery) supplies its
// own canvas dimensions and scaling. x/y are LEFT/TOP of the card.

const MOOD_CARDS_EN = [
  {
    source: 'Wikipedia', title: 'Circadian rhythm',
    visual: { kind: 'body', text: 'Endogenous 24-hour cycles found in most living organisms, driven by PER and CRY feedback loops.' },
    meta: 'Saved · 2 days ago',
    x: 8, y: 6, w: 200, h: 132, rot: -2.5,
  },
  {
    source: 'MIT Tech Review', title: 'The jet-lag economy',
    visual: { kind: 'nightCity' },
    meta: 'Saved · 5 days ago',
    x: 228, y: 18, w: 180, h: 126, rot: 2,
  },
  {
    source: 'NYT Cooking', title: 'Sourdough timing',
    visual: { kind: 'dough' },
    meta: 'Saved · 1 week ago',
    x: 24, y: 160, w: 170, h: 118, rot: 1.8,
  },
  {
    source: 'arXiv · 2309.11461', title: 'Shift-work & cortisol',
    visual: { kind: 'chart' },
    meta: 'Saved · 1 week ago',
    x: 232, y: 176, w: 180, h: 118, rot: -1.5,
  },
  {
    source: 'Nature', title: 'The geometry of biological time',
    visual: { kind: 'quote', text: 'What looks like a habit is, very often, a clock.' },
    meta: 'Saved · just now',
    x: 430, y: 96, w: 220, h: 168, rot: 1,
    hero: true,
  },
];

const MOOD_CARDS_ZH = [
  {
    source: '维基百科', title: '昼夜节律',
    visual: { kind: 'body', text: '几乎所有生物自带的 24 小时内源性周期, 由 PER 和 CRY 蛋白的反馈回路驱动.' },
    meta: '保存于 · 2 天前',
    x: 8, y: 6, w: 200, h: 132, rot: -2.5,
  },
  {
    source: 'MIT 科技评论', title: '时差经济学',
    visual: { kind: 'nightCity' },
    meta: '保存于 · 5 天前',
    x: 228, y: 18, w: 180, h: 126, rot: 2,
  },
  {
    source: 'NYT Cooking', title: '酸面团发酵时机',
    visual: { kind: 'dough' },
    meta: '保存于 · 1 周前',
    x: 24, y: 160, w: 170, h: 118, rot: 1.8,
  },
  {
    source: 'arXiv · 2309.11461', title: '倒班工作 & 皮质醇',
    visual: { kind: 'chart' },
    meta: '保存于 · 1 周前',
    x: 232, y: 176, w: 180, h: 118, rot: -1.5,
  },
  {
    source: 'Nature', title: '生物时间的几何',
    visual: { kind: 'quote', text: '看似是习惯的东西, 其实往往是一只钟.' },
    meta: '保存于 · 刚刚',
    x: 430, y: 96, w: 220, h: 168, rot: 1,
    hero: true,
  },
];

function getMoodCards(lang) {
  return lang === 'zh' ? MOOD_CARDS_ZH : MOOD_CARDS_EN;
}

Object.assign(window, { MoodCard, MoodVisual, getMoodCards });
