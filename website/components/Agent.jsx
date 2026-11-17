// Agent + MCP section
function Agent({ lang }) {
  const isMobile = useIsMobile();
  return (
    <section id="agent" style={{ padding: isMobile ? '56px 16px' : '100px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1200, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.1fr', gap: isMobile ? 32 : 48, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span style={{ alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 9999, background: 'rgba(26,107,74,0.08)', color: 'var(--accent-deep)', font: '700 11px var(--ln-font-brand)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{t(COPY.agent.eyebrow, lang)}</span>
          <h2 style={{ margin: 0, font: `700 ${isMobile ? '30px' : '40px'}/1.15 var(--ln-font-brand)`, color: 'var(--ln-fg1)', letterSpacing: '-0.015em' }}>{t(COPY.agent.title, lang)}</h2>
          <p style={{ margin: 0, font: '16px/1.6 var(--ln-font-body)', color: 'var(--ln-fg2)' }}>{t(COPY.agent.lede, lang)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {COPY.agent.tools.map((tool, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(232,239,234,0.7)' }}>
                <span style={{ font: '600 12.5px var(--ln-font-mono)', color: 'var(--accent-deep)', background: 'rgba(26,107,74,0.08)', padding: '3px 9px', borderRadius: 6 }}>{tool.name}</span>
                <span style={{ font: '13px var(--ln-font-body)', color: 'var(--ln-fg3)' }}>— {lang === 'zh' ? tool.zh : tool.en}</span>
              </div>
            ))}
          </div>
        </div>
        <MCPMock lang={lang}/>
      </div>
    </section>
  );
}

function MCPMock({ lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Claude Desktop mock */}
      <div style={{ borderRadius: 16, overflow: 'hidden', background: '#1f1f1d', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 5 }}>{['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }}/>)}</div>
          <div style={{ font: '11px var(--ln-font-body)', color: '#999', marginLeft: 4 }}>Claude Desktop</div>
          <div style={{ marginLeft: 'auto', font: '10px var(--ln-font-mono)', color: '#6a8575', padding: '2px 8px', borderRadius: 9999, background: 'rgba(47,163,115,0.15)', border: '1px solid rgba(47,163,115,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2fa373' }}/> luminote-mcp
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '9px 13px', borderRadius: 13, background: '#3a3a38', color: '#e8e6e0', font: '12.5px/1.5 var(--ln-font-body)' }}>
            {lang === 'zh' ? '看看我这周标记的 circadian 相关内容, 整理成一页' : 'Pull my circadian marks from this week and draft a one-pager'}
          </div>
          <div style={{ padding: '7px 11px', borderRadius: 8, background: 'rgba(47,163,115,0.08)', border: '1px solid rgba(47,163,115,0.25)', font: '11px var(--ln-font-mono)', color: '#7fd0a8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IZap size={11}/> <span style={{ color: '#b4e5cd' }}>luminote.search_memories</span>
            <span style={{ color: '#8aa99b' }}>{'{ query: "circadian", since: "7d" }'}</span>
            <span style={{ marginLeft: 'auto', color: '#5a8d70' }}>→ 8</span>
          </div>
          <div style={{ padding: '7px 11px', borderRadius: 8, background: 'rgba(47,163,115,0.08)', border: '1px solid rgba(47,163,115,0.25)', font: '11px var(--ln-font-mono)', color: '#7fd0a8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IZap size={11}/> <span style={{ color: '#b4e5cd' }}>luminote.read_memory</span>
            <span style={{ color: '#8aa99b' }}>×3</span>
            <span style={{ marginLeft: 'auto', color: '#5a8d70' }}>ok</span>
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: '10px 13px', borderRadius: 13, background: '#2a2a28', color: '#e8e6e0', font: '12.5px/1.55 var(--ln-font-body)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {lang === 'zh'
              ? <>基于你的 8 张记忆卡, 三条主线浮现:<br/>· <b style={{color:'#a6e0c2'}}>时钟很古老</b> (PER/CRY)<br/>· <b style={{color:'#a6e0c2'}}>光是首要 zeitgeber</b>, 但代谢时钟的重置信号仍是开放问题<br/>· <b style={{color:'#a6e0c2'}}>错相位代价很大</b> — 倒班工作者 22 年队列, +23% 全因死亡率</>
              : <>From your 8 memory cards, three threads:<br/>· <b style={{color:'#a6e0c2'}}>The clock is old</b> (PER/CRY)<br/>· <b style={{color:'#a6e0c2'}}>Light is the master zeitgeber</b>, metabolic-clock reset is an open Q<br/>· <b style={{color:'#a6e0c2'}}>Misalignment is costly</b> — shift workers, +23% all-cause mortality at 22y</>}
          </div>
        </div>
      </div>

      {/* MCP config */}
      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(25,28,26,0.92)', color: '#c7d1ca', font: '11.5px/1.55 var(--ln-font-mono)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#8aa99b' }}>
          <ITerminal size={12}/> claude_desktop_config.json
        </div>
<pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit' }}>{`"mcpServers": {
  "luminote": {
    "command": "npx",
    "args": ["@luminote/mcp-server"]
  }
}`}</pre>
      </div>
    </div>
  );
}

Object.assign(window, { Agent });
