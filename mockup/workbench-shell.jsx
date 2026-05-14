// workbench-shell.jsx — A型ワークベンチ共通の chrome (top bar + project rail).
// 各タブはこの中に中央コンテンツを差し込む.

const { useState: useStateWS, useEffect: useEffectWS } = React;

function WorkbenchShell({
  activeTab = 'ダッシュボード',
  onTabChange,
  projectId, onProjectChange,
  rightPanel, children, baseDate = BASE_DATE,
  toolbar,
}) {
  const [projectMenuOpen, setProjectMenuOpen] = useStateWS(false);
  const project = PROJECT_DATA.find(p => p.id === projectId);

  return (
    <div style={{
      width: '100%', height: '100%', background: EVM.paper, color: EVM.ink,
      fontFamily: EVM.font, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 20px', borderBottom: `1px solid ${EVM.rule}`,
        background: EVM.card, flex: '0 0 auto',
      }}>
        <BrandMark size={26}/>
        <div style={{ width: 1, height: 22, background: EVM.rule }}/>
        <div style={{ fontFamily: EVM.fontBrand, fontSize: 13, letterSpacing: '0.18em', color: EVM.ink2 }}>EVM STUDIO</div>

        <nav style={{ display: 'flex', gap: 4, marginLeft: 18 }}>
          {['ダッシュボード', 'レポート'].map(t => {
            const active = t === activeTab;
            return (
              <button key={t} className={active ? 'evm-tab active' : 'evm-tab'}
                onClick={() => onTabChange && onTabChange(t)}
                style={{
                  padding: '6px 12px', borderRadius: 4, border: 0,
                  background: active ? EVM.brandWash : 'transparent',
                  color: active ? EVM.brandDeep : EVM.ink3,
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}>{t}</button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }}/>

        {/* Project picker */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setProjectMenuOpen(o => !o)}
            className="evm-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
              background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
              fontFamily: 'inherit', fontSize: 13, color: EVM.ink, cursor: 'pointer',
            }}>
            <Dot tone={project.status === 'active' ? 'normal' : project.status === 'paused' ? 'warning' : 'na'} size={6}/>
            <span style={{ fontWeight: 500 }}>{project.name}</span>
            <span style={{ color: EVM.ink3, fontSize: 11, fontFamily: EVM.fontMono }}>{project.code}</span>
            <Chevron open={projectMenuOpen}/>
          </button>
          {projectMenuOpen && (
            <Overlay onDismiss={() => setProjectMenuOpen(false)}>
              <div className="evm-popover" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 360,
                background: EVM.card, borderRadius: 6, border: `1px solid ${EVM.rule}`,
                boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
                zIndex: 20, padding: 6,
              }}>
                <div style={{ padding: '8px 10px 6px' }}><Eyebrow>プロジェクト切替</Eyebrow></div>
                {PROJECT_DATA.map(p => (
                  <button key={p.id} onClick={() => { onProjectChange(p.id); setProjectMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '10px 12px', border: 0,
                      background: p.id === projectId ? EVM.brandWash : 'transparent',
                      cursor: 'pointer', borderRadius: 4, textAlign: 'left',
                      fontFamily: 'inherit', color: 'inherit',
                    }}>
                    <Dot tone={p.status === 'active' ? 'normal' : p.status === 'paused' ? 'warning' : 'na'} size={7}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: EVM.ink, fontWeight: p.id === projectId ? 600 : 500 }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: EVM.ink3, fontFamily: EVM.fontMono }}>{p.code}</div>
                    </div>
                    <Pill tone={spiTone(p.summary.spi)}>{p.summary.spi.toFixed(2)}</Pill>
                  </button>
                ))}
              </div>
            </Overlay>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
          fontFamily: 'inherit', fontSize: 13,
        }}>
          <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>基準日</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: EVM.ink }}>{baseDate}</span>
        </div>

        <div className="evm-icon-btn" style={{
          width: 32, height: 32, borderRadius: 16, background: EVM.paperWarm,
          border: `1px solid ${EVM.rule}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}>
          <BellIcon/>
        </div>
        <Avatar initials="田美" tone="brand" size={30}/>
      </header>

      {/* Body: Project rail + Center + Right */}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        {/* Left: project rail */}
        <aside style={{
          width: 232, flex: '0 0 auto', background: EVM.card,
          borderRight: `1px solid ${EVM.rule}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 6px' }}><Eyebrow>Projects · {PROJECT_DATA.length}</Eyebrow></div>
          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
            {PROJECT_DATA.map(p => {
              const active = p.id === projectId;
              const tone = spiTone(p.summary.spi);
              return (
                <button key={p.id} onClick={() => onProjectChange(p.id)} className="evm-project-btn"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 10px',
                    borderRadius: 4, border: 0,
                    background: active ? EVM.brandWash : 'transparent',
                    borderLeft: `3px solid ${active ? EVM.brandDeep : 'transparent'}`,
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
                  }}>
                  <Dot tone={p.status === 'active' ? 'normal' : p.status === 'paused' ? 'warning' : 'na'} size={6}/>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: EVM.ink, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: EVM.ink3, fontFamily: EVM.fontMono }}>{p.code} · {p.tasks.length}件</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontFamily: EVM.fontMono, color: statusColor(tone), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>SPI {p.summary.spi.toFixed(2)}</span>
                      {p.alerts.length > 0 && (
                        <span style={{
                          fontSize: 9.5, color: '#8a6c1a', background: EVM.warnSoft,
                          padding: '0 5px', borderRadius: 999, fontWeight: 700,
                          border: '1px solid #e6d29a',
                        }}>!{p.alerts.length}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center */}
        <main style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {toolbar}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
            {children}
          </div>
        </main>

        {rightPanel}
      </div>
    </div>
  );
}

window.WorkbenchShell = WorkbenchShell;
