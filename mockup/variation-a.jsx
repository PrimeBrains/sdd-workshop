// variation-a.jsx — ワークベンチ型 (Master/Detail with Inspector)
// 完全インタラクティブ: プロジェクト切替・タスク選択・基準日変更・フィルタ・全画面ガント.

const { useState, useEffect, useRef } = React;

// ── Helpers ─────────────────────────────────────────────────────────────
function deriveTaskMetrics(task, baseDay) {
  if (!task.bac) return { bac: 0, pv: 0, ev: 0, ac: 0, cpi: null };
  const duration = Math.max(1, task.end - task.start);
  const planned  = Math.max(0, Math.min(1, (baseDay - task.start) / duration));
  const pv = task.bac * planned;
  const ev = task.bac * (task.progress / 100);
  const cpi = task.spi == null ? null : (task.assignee ? 1.02 : 1.00); // simple stub
  const ac = cpi ? ev / cpi : ev;
  return { bac: task.bac, pv, ev, ac, cpi };
}

function initialsOf(name) {
  return name ? name.split(' ').map(s => s[0] || '').join('').slice(0, 2) : '';
}

function statusJp(s) {
  return { active: '稼働中', paused: '一時停止', draft: '計画中', archived: 'アーカイブ' }[s] || s;
}

// ── Main ────────────────────────────────────────────────────────────────
function VariationA({ onTabChange }) {
  const [projectId, setProjectId] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState(32);
  const [baseDate, setBaseDate] = useState(BASE_DATE);
  const [ganttFull, setGanttFull] = useState(false);
  const [chartFull, setChartFull] = useState(null); // null | 'trend' | 'fever'
  const [filter, setFilter] = useState('all');
  const [inspectorMode, setInspectorMode] = useState('task'); // 'task' | 'member'
  const [inspectorMemberId, setInspectorMemberId] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  const project = PROJECT_DATA.find(p => p.id === projectId);

  // Reset task selection when switching projects
  useEffect(() => {
    if (!project.tasks.find(t => t.id === selectedTaskId)) {
      const leaf = project.tasks.find(t => t.leaf && t.progress > 0 && t.progress < 100)
                || project.tasks.find(t => t.leaf)
                || project.tasks[0];
      setSelectedTaskId(leaf.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const task = project.tasks.find(t => t.id === selectedTaskId) || project.tasks.find(t => t.leaf) || project.tasks[0];
  const taskMetrics = deriveTaskMetrics(task, project.baseDay);
  const taskTone = spiTone(task.spi);

  // SPI deltas for header indicator
  const trend = project.spiTrend;
  const spiPrev = trend[trend.length - 2]?.spi;
  const spiNow  = trend[trend.length - 1]?.spi;

  return (
    <div style={{
      width: '100%', height: '100%', background: EVM.paper, color: EVM.ink,
      fontFamily: EVM.font, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Top app bar ─────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 20px', borderBottom: `1px solid ${EVM.rule}`,
        background: EVM.card, flex: '0 0 auto',
      }}>
        <BrandMark size={26}/>
        <div style={{ width: 1, height: 22, background: EVM.rule }}/>
        <div style={{ fontFamily: EVM.fontBrand, fontSize: 13, letterSpacing: '0.18em', color: EVM.ink2 }}>EVM STUDIO</div>

        <nav style={{ display: 'flex', gap: 4, marginLeft: 18 }}>
          {['ダッシュボード', 'レポート'].map((t, i) => (
            <button key={t} className={i === 0 ? 'evm-tab active' : 'evm-tab'}
              onClick={() => onTabChange && onTabChange(t)}
              style={{
                padding: '6px 12px', borderRadius: 4, border: 0,
                background: i === 0 ? EVM.brandWash : 'transparent',
                color: i === 0 ? EVM.brandDeep : EVM.ink3,
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: i === 0 ? 600 : 500,
                cursor: 'pointer',
              }}>{t}</button>
          ))}
        </nav>

        <div style={{ flex: 1 }}/>

        {/* Project picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setProjectMenuOpen(o => !o)}
            className="evm-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
              background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
              fontFamily: 'inherit', fontSize: 13, color: EVM.ink, cursor: 'pointer',
            }}
          >
            <Dot tone={project.status === 'active' ? 'normal' : project.status === 'paused' ? 'warning' : 'na'} size={6}/>
            <span style={{ fontWeight: 500 }}>{project.name}</span>
            <span style={{ color: EVM.ink3, fontSize: 11, fontFamily: EVM.fontMono }}>{project.code}</span>
            <Chevron open={projectMenuOpen}/>
          </button>

          {projectMenuOpen && (
            <Overlay onDismiss={() => setProjectMenuOpen(false)}>
              <div className="evm-popover" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 360, background: EVM.card, borderRadius: 6,
                border: `1px solid ${EVM.rule}`,
                boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
                zIndex: 20, padding: 6,
              }}>
                <div style={{ padding: '8px 10px 6px' }}>
                  <Eyebrow>プロジェクト切替</Eyebrow>
                </div>
                {PROJECT_DATA.map(p => {
                  const active = p.id === projectId;
                  return (
                    <button key={p.id} onClick={() => {
                      setProjectId(p.id); setProjectMenuOpen(false);
                    }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '10px 12px', border: 0,
                        background: active ? EVM.brandWash : 'transparent',
                        cursor: 'pointer', borderRadius: 4, textAlign: 'left',
                        fontFamily: 'inherit', color: 'inherit',
                      }}>
                      <Dot tone={p.status === 'active' ? 'normal' : p.status === 'paused' ? 'warning' : 'na'} size={7}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: EVM.ink, fontWeight: active ? 600 : 500 }}>{p.name}</div>
                        <div style={{ fontSize: 10.5, color: EVM.ink3, fontFamily: EVM.fontMono }}>
                          {p.code} · SPI {p.summary.spi.toFixed(2)} · {p.tasks.length}件
                        </div>
                      </div>
                      <Pill tone={spiTone(p.summary.spi)}>{p.summary.spi.toFixed(2)}</Pill>
                    </button>
                  );
                })}
              </div>
            </Overlay>
          )}
        </div>

        {/* Base date */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDatePickerOpen(o => !o)}
            className="evm-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
              fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>基準日</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: EVM.ink }}>{baseDate}</span>
            <Chevron open={datePickerOpen}/>
          </button>

          {datePickerOpen && (
            <Overlay onDismiss={() => setDatePickerOpen(false)}>
              <div className="evm-popover" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: EVM.card, borderRadius: 6,
                border: `1px solid ${EVM.rule}`,
                boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
                zIndex: 20, padding: 14, minWidth: 280,
              }}>
                <Eyebrow style={{ marginBottom: 10 }}>基準日を選択</Eyebrow>
                <input type="date" value={baseDate} onChange={(e) => {
                  setBaseDate(e.target.value);
                }}
                  style={{
                    width: '100%', padding: '8px 10px',
                    border: `1px solid ${EVM.rule}`, borderRadius: 4,
                    fontFamily: EVM.fontMono, fontSize: 13, color: EVM.ink,
                    background: EVM.paperWarm,
                  }}/>
                <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                  {[
                    { l: '今日', v: '2026-05-13' },
                    { l: '1週前', v: '2026-05-06' },
                    { l: '月初', v: '2026-05-01' },
                  ].map(p => (
                    <button key={p.l} onClick={() => setBaseDate(p.v)}
                      className="evm-chip"
                      style={{
                        padding: '4px 10px', borderRadius: 4,
                        background: EVM.paperWarm, border: `1px solid ${EVM.rule}`,
                        fontFamily: 'inherit', fontSize: 11.5, color: EVM.ink2,
                        cursor: 'pointer',
                      }}>{p.l}</button>
                  ))}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${EVM.rule}`, fontSize: 11, color: EVM.ink3 }}>
                  ※ 表示用モック · データは再計算されません
                </div>
              </div>
            </Overlay>
          )}
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

      {/* ── Body 3-column ─────────────────────────────────── */}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>

        {/* Left rail */}
        <aside style={{
          width: 232, flex: '0 0 auto', background: EVM.card,
          borderRight: `1px solid ${EVM.rule}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Eyebrow>Projects · {PROJECT_DATA.length}</Eyebrow>
            <button className="evm-icon-btn" style={{
              fontSize: 14, color: EVM.ink3, background: 'transparent', border: 0,
              padding: 2, borderRadius: 3, cursor: 'pointer',
            }}>+</button>
          </div>
          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
            {PROJECT_DATA.map(p => {
              const active = p.id === projectId;
              const tone = spiTone(p.summary.spi);
              return (
                <button key={p.id}
                  onClick={() => setProjectId(p.id)}
                  className="evm-project-btn"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 10px', borderRadius: 4, border: 0,
                    background: active ? EVM.brandWash : 'transparent',
                    borderLeft: `3px solid ${active ? EVM.brandDeep : 'transparent'}`,
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    color: 'inherit',
                  }}>
                  <Dot tone={p.status === 'active' ? 'normal' : p.status === 'paused' ? 'warning' : 'na'} size={6}/>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: EVM.ink, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: EVM.ink3, fontFamily: EVM.fontMono, letterSpacing: '0.02em' }}>
                      {p.code} · {p.tasks.length}件
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 10, fontFamily: EVM.fontMono, color: statusColor(tone), fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}>SPI {p.summary.spi.toFixed(2)}</span>
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

          <div style={{ flex: 1 }}/>

          <div style={{ padding: '14px 16px 8px', borderTop: `1px solid ${EVM.rule}` }}>
            <Eyebrow>Members · {project.members.length}</Eyebrow>
          </div>
          <div style={{ padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {project.members.map(m => {
              const a = project.assignees.find(a => a.name === m.name);
              const active = inspectorMode === 'member' && inspectorMemberId === (a && a.id);
              return (
                <button key={m.id}
                  onClick={() => { if (a) { setInspectorMemberId(a.id); setInspectorMode('member'); } }}
                  className="evm-assignee-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px',
                    border: 0, borderRadius: 4, textAlign: 'left', fontFamily: 'inherit',
                    background: active ? EVM.brandWash : 'transparent',
                    borderLeft: `3px solid ${active ? EVM.brandDeep : 'transparent'}`,
                    cursor: a ? 'pointer' : 'default', color: 'inherit',
                  }}>
                  <Avatar initials={m.initials} size={22}/>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: EVM.ink, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: 9.5, color: EVM.ink3 }}>{m.role}</div>
                  </div>
                  {a && <span style={{ fontSize: 10, fontFamily: EVM.fontMono, color: statusColor(spiTone(a.spi)), fontWeight: 600 }}>{a.spi.toFixed(2)}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center */}
        <main style={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Summary strip */}
          <div style={{
            background: EVM.card, borderBottom: `1px solid ${EVM.rule}`,
            padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 28,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, maxWidth: 260 }}>
              <Eyebrow>Project · {statusJp(project.status)}</Eyebrow>
              <div style={{ fontFamily: EVM.fontSerif, fontSize: 22, color: EVM.ink, lineHeight: 1.1 }}>
                {project.name}
              </div>
              <div style={{ fontSize: 11, color: EVM.ink3 }}>
                {project.startISO.slice(5)} → {project.endISO.slice(5)} · 残 {project.remaining}日 · 進捗 {project.progress}%
              </div>
            </div>
            <div style={{ width: 1, height: 56, background: EVM.rule }}/>
            <SummaryStat label="SPI" value={project.summary.spi.toFixed(2)} tone="brand"
              sub={project.summary.spiDelta ? `vs先週 ${project.summary.spiDelta > 0 ? '+' : ''}${project.summary.spiDelta.toFixed(2)}` : '横ばい'}/>
            <SummaryStat label="CPI" value={project.summary.cpi.toFixed(2)} tone="brand"
              sub={project.summary.cpiDelta ? `vs先週 ${project.summary.cpiDelta > 0 ? '+' : ''}${project.summary.cpiDelta.toFixed(2)}` : '横ばい'}/>
            <div style={{ width: 1, height: 56, background: EVM.rule }}/>
            <SummaryStat label="BAC" value={fmtYen(project.summary.bac)} sub="計画総予算"/>
            <SummaryStat label="EV"  value={fmtYen(project.summary.ev)}  sub={`PV ${fmtYen(project.summary.pv)}`}/>
            <SummaryStat label="AC"  value={fmtYen(project.summary.ac)}  sub={`残ETC ${fmtYen(project.summary.etc)}`}/>
            <SummaryStat label="VAC" value={fmtSignedYen(project.summary.vac)}
              tone={project.summary.vac >= 0 ? 'normal' : 'critical'}
              sub={`EAC ${fmtYen(project.summary.eac)}`}/>
          </div>

          {/* Alert strip */}
          {project.alerts.length > 0 && (
            <AlertStrip alerts={project.alerts} onJump={(a) => setSelectedTaskId(a.taskId)}/>
          )}
          {project.alerts.length === 0 && (
            <div style={{
              background: EVM.brandSoft, borderBottom: `1px solid #cee08a`,
              padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 12, color: EVM.brandDeep,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: EVM.brandDeep,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11,
              }}>✓</div>
              <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>HEALTHY</span>
              <span>遅延・警告は検出されていません</span>
            </div>
          )}

          {/* Tasks — Gantt */}
          <div style={{
            background: EVM.card, margin: 24, marginBottom: 12,
            border: `1px solid ${EVM.rule}`, borderRadius: 6, overflow: 'hidden',
            flex: '0 0 auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}`,
            }}>
              <Eyebrow>Tasks · WBS</Eyebrow>
              <span style={{ fontSize: 13, color: EVM.ink, fontWeight: 500 }}>
                {project.tasks.filter(t => t.leaf || t.buffer).length} leaf / {project.tasks.length} total
              </span>
              <div style={{ flex: 1 }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: EVM.ink3 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot tone="critical"/> SPI&lt;0.8</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot tone="warning"/> &lt;0.9</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3d6f9f', display: 'inline-block' }}/>
                  ≥0.9
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 8, background: `repeating-linear-gradient(135deg, ${EVM.ink4} 0 3px, ${EVM.paperWarm} 3px 6px)`, border: `1px solid ${EVM.ink4}`, display: 'inline-block' }}/>
                  バッファ
                </span>
              </div>
              <div style={{ width: 1, height: 18, background: EVM.rule, marginLeft: 4 }}/>
              <button
                onClick={() => setGanttFull(true)}
                title="WBSを全画面で表示"
                className="evm-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 4,
                  background: EVM.paperWarm, border: `1px solid ${EVM.rule}`,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
                  color: EVM.ink2, fontWeight: 500,
                }}
              >
                <ExpandIcon size={12}/>
                <span>全画面で見る</span>
              </button>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              <Gantt
                tasks={project.tasks}
                range={{ totalDays: project.totalDays, baseDay: project.baseDay, months: project.months }}
                width={1100} labelW={290}
                selectedTaskId={selectedTaskId}
                onTaskClick={(t) => { setSelectedTaskId(t.id); setInspectorMode('task'); }}
              />
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'flex', gap: 12, padding: '0 24px 24px', flex: '0 0 auto' }}>
            <Card pad={0} style={{ flex: 1.2, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eyebrow>Trend · Snapshots × Time</Eyebrow>
                <span style={{ fontSize: 13, color: EVM.ink, fontWeight: 500 }}>SPI / CPI 推移</span>
                <div style={{ flex: 1 }}/>
                <span style={{ fontSize: 11, color: EVM.ink3 }}>過去 {project.spiTrend.length} スナップショット</span>
                <div style={{ width: 1, height: 18, background: EVM.rule, marginLeft: 4 }}/>
                <button onClick={() => setChartFull('trend')} title="全画面で表示" className="evm-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, color: EVM.ink2, fontWeight: 500 }}>
                  <ExpandIcon size={12}/><span>全画面で見る</span>
                </button>
              </div>
              <div style={{ padding: '14px 16px 8px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SpiTrendChart data={project.spiTrend} w={620} h={210}/>
              </div>
            </Card>
            <Card pad={0} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eyebrow>CCPM Fever</Eyebrow>
                <span style={{ fontSize: 13, color: EVM.ink, fontWeight: 500 }}>バッファ消費 vs 完了率</span>
                <div style={{ flex: 1 }}/>
                {project.fever ? (
                  <Pill tone={project.fever.zone === 'GREEN' ? 'brand' : project.fever.zone === 'YELLOW' ? 'warning' : 'critical'}>
                    {project.fever.zone}
                  </Pill>
                ) : <Pill tone="na">N/A</Pill>}
                <div style={{ width: 1, height: 18, background: EVM.rule, marginLeft: 4 }}/>
                <button onClick={() => setChartFull('fever')} title="全画面で表示" className="evm-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, color: EVM.ink2, fontWeight: 500 }}>
                  <ExpandIcon size={12}/><span>全画面で見る</span>
                </button>
              </div>
              <div style={{ padding: '8px 12px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {project.fever
                  ? <FeverChart data={project.fever} w={400} h={220}/>
                  : <div style={{ color: EVM.ink3, fontStyle: 'italic', fontFamily: EVM.fontSerif, padding: 40, textAlign: 'center' }}>
                      バッファタスク未定義<br/>
                      <span style={{ fontSize: 11, fontStyle: 'normal' }}>CCPM プロジェクトのみ表示</span>
                    </div>
                }
              </div>
            </Card>
          </div>
        </main>

        {/* Right Inspector */}
        <Inspector
          task={task}
          taskMetrics={taskMetrics}
          taskTone={taskTone}
          project={project}
          mode={inspectorMode}
          memberId={inspectorMemberId}
          onSwitchTask={() => setInspectorMode('task')}
          onSwitchMember={(a) => { if (a) setInspectorMemberId(a.id); setInspectorMode('member'); }}
        />
      </div>

      {ganttFull && (
        <GanttFullscreen
          project={project}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          filter={filter}
          onFilterChange={setFilter}
          onClose={() => setGanttFull(false)}
        />
      )}
      {chartFull && (
        <ChartFullscreen
          type={chartFull}
          project={project}
          onClose={() => setChartFull(null)}
        />
      )}
    </div>
  );
}

// ── Alert strip ─────────────────────────────────────────────────────────
function AlertStrip({ alerts, onJump }) {
  const hasCritical = alerts.some(a => a.level === 'critical');
  const bg = hasCritical ? EVM.critSoft : EVM.warnSoft;
  const border = hasCritical ? '#e0b8a6' : '#e6d29a';
  const dotBg = hasCritical ? EVM.crit : EVM.warn;
  const fg = hasCritical ? EVM.crit : '#8a6c1a';

  return (
    <div style={{
      background: bg, borderBottom: `1px solid ${border}`,
      padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 14,
      fontSize: 12, color: fg,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: dotBg,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11,
      }}>!</div>
      <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
        {hasCritical ? 'CRITICAL' : 'WARNING'}
      </span>
      <span>{hasCritical ? '即時対応が必要なタスク' : '遅延の兆候'}: {alerts.length}件</span>
      <div style={{ flex: 1 }}/>
      {alerts.map((a, i) => (
        <button key={i} onClick={() => onJump(a)}
          className="evm-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '3px 10px',
            border: `1px solid ${border}`, borderRadius: 4, background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', fontSize: 12,
          }}>
          <span style={{ fontWeight: 600 }}>{a.taskName}</span>
          <span>{a.assigneeName}</span>
          <span style={{ fontFamily: EVM.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>SPI {a.spi.toFixed(2)}</span>
          <span style={{ fontSize: 11 }}>→</span>
        </button>
      ))}
    </div>
  );
}

// ── Inspector ───────────────────────────────────────────────────────────
function Inspector({ task, taskMetrics, taskTone, project, mode, memberId, onSwitchTask, onSwitchMember }) {
  const dateFromOffset = (offset) => {
    const s = new Date(project.startISO);
    const d = new Date(s.getTime() + offset * 86400000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const assignee   = task.assignee ? project.assignees.find(a => a.name === task.assignee) : null;
  const memberData = memberId ? project.assignees.find(a => a.id === memberId) : null;
  const memberInfo = memberData ? project.members.find(m => m.name === memberData.name) : null;
  const memberTasks = memberData ? project.tasks.filter(t => t.assignee === memberData.name) : [];

  const TabBar = () => (
    <div style={{ display: 'flex', borderBottom: `1px solid ${EVM.rule}`, flex: '0 0 auto' }}>
      {[['task', 'Task'], ['member', 'Member']].map(([key, label]) => (
        <button key={key}
          onClick={() => key === 'task' ? onSwitchTask() : onSwitchMember(memberData)}
          style={{
            flex: 1, padding: '10px 0', border: 0,
            borderBottom: `2px solid ${mode === key ? EVM.brandDeep : 'transparent'}`,
            background: 'transparent', color: mode === key ? EVM.brandDeep : EVM.ink3,
            fontFamily: 'inherit', fontSize: 11, fontWeight: mode === key ? 700 : 500,
            cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{label}</button>
      ))}
    </div>
  );

  return (
    <aside style={{
      width: 380, flex: '0 0 auto', background: EVM.card,
      borderLeft: `1px solid ${EVM.rule}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <TabBar/>

      {/* ── TASK MODE ── */}
      {mode === 'task' && (
        <>
          <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${EVM.rule}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow>Inspector · Task</Eyebrow>
              <span style={{ fontSize: 10, color: EVM.ink4 }}>{project.tasks.findIndex(t => t.id === task.id) + 1} / {project.tasks.length}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: EVM.fontMono, fontSize: 11, color: EVM.ink3 }}>{task.code}</span>
              <span style={{ fontFamily: EVM.fontSerif, fontSize: 19, color: EVM.ink, lineHeight: 1.2 }}>{task.name}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone={taskTone}>
                {task.spi == null ? 'N/A' : taskTone === 'normal' ? 'On Track' : taskTone === 'warning' ? 'Watch' : 'Delayed'}
              </Pill>
              {task.buffer && <Pill>CCPM バッファ</Pill>}
              {!task.leaf && !task.buffer && <Pill>サマリ</Pill>}
              {task.leaf && !task.buffer && <Pill>Leaf</Pill>}
            </div>
          </div>

          {/* Progress */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <Eyebrow>Progress</Eyebrow>
              <span style={{ fontFamily: EVM.fontSerif, fontSize: 26, color: EVM.ink, fontVariantNumeric: 'tabular-nums' }}>
                {task.progress}<span style={{ fontSize: 14, color: EVM.ink3 }}>%</span>
              </span>
            </div>
            <div style={{ height: 8, background: EVM.paperWarm, borderRadius: 4, overflow: 'hidden', border: `1px solid ${EVM.rule}` }}>
              <div style={{ width: `${task.progress}%`, height: '100%', background: EVM.brandDeep }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: EVM.ink3 }}>
              <span>{dateFromOffset(task.start)} 開始</span>
              <span>{dateFromOffset(task.end)} 計画終了</span>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <SummaryStat label="SPI" value={task.spi == null ? 'N/A' : task.spi.toFixed(2)} tone={taskTone}/>
            <SummaryStat label="CPI" value={taskMetrics.cpi == null ? 'N/A' : taskMetrics.cpi.toFixed(2)} tone={taskMetrics.cpi == null ? 'na' : 'normal'}/>
            <SummaryStat label="EV"  value={fmtYen(taskMetrics.ev)}/>
            <SummaryStat label="PV"  value={fmtYen(taskMetrics.pv)}/>
            <SummaryStat label="AC"  value={fmtYen(taskMetrics.ac)}/>
            <SummaryStat label="BAC" value={fmtYen(taskMetrics.bac)}/>
          </div>

          {/* Task SPI trend */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <Eyebrow>Task SPI Trend</Eyebrow>
              <span style={{ fontSize: 10, color: EVM.ink3 }}>
                {task.spi == null ? '— → —' : `${(task.spi - 0.08).toFixed(2)} → ${task.spi.toFixed(2)}`}
              </span>
            </div>
            <Sparkline
              data={task.spi == null ? [1,1,1,1,1,1] :
                [task.spi-0.08, task.spi-0.06, task.spi-0.04, task.spi-0.02, task.spi-0.01, task.spi]}
              w={340} h={50} color={task.spi == null ? EVM.ink4 : statusColor(taskTone)}/>
          </div>

          {/* Assignee card — 1 person */}
          <div style={{ padding: '14px 20px', flex: '1 1 auto' }}>
            <Eyebrow style={{ marginBottom: 10 }}>Assignee</Eyebrow>
            {assignee ? (
              <button onClick={() => onSwitchMember(assignee)}
                className="evm-assignee-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 12px', borderRadius: 6, border: `1px solid ${EVM.rule}`,
                  background: EVM.paperWarm, cursor: 'pointer', fontFamily: 'inherit',
                  color: 'inherit', textAlign: 'left',
                }}>
                <Avatar initials={initialsOf(assignee.name)} size={28}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: EVM.ink, fontWeight: 600 }}>{assignee.name}</div>
                  <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 2 }}>
                    EV {fmtYen(assignee.ev)} · BAC {fmtYen(assignee.bac)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: EVM.fontMono, fontSize: 14, fontWeight: 700, color: statusColor(spiTone(assignee.spi)) }}>
                    {assignee.spi.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9.5, color: EVM.ink3 }}>SPI</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: EVM.ink4 }}>
                  <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <div style={{ fontSize: 12, color: EVM.ink3, fontStyle: 'italic', padding: '8px 0' }}>担当者未割当</div>
            )}
          </div>
        </>
      )}

      {/* ── MEMBER MODE ── */}
      {mode === 'member' && memberData && (
        <>
          {/* Member header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
            <Eyebrow style={{ marginBottom: 10 }}>Inspector · Member</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar initials={initialsOf(memberData.name)} size={38} tone="brand"/>
              <div>
                <div style={{ fontFamily: EVM.fontSerif, fontSize: 20, color: EVM.ink, lineHeight: 1.2 }}>{memberData.name}</div>
                <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 3 }}>{memberInfo ? memberInfo.role : ''}</div>
              </div>
            </div>
          </div>

          {/* Member aggregate metrics */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <SummaryStat label="SPI" value={memberData.spi.toFixed(2)} tone={spiTone(memberData.spi)}/>
            <SummaryStat label="CPI" value={memberData.cpi.toFixed(2)} tone={memberData.cpi >= 1 ? 'normal' : memberData.cpi >= 0.9 ? 'warning' : 'critical'}/>
            <SummaryStat label="EV"  value={fmtYen(memberData.ev)}  sub={`PV ${fmtYen(memberData.pv)}`}/>
            <SummaryStat label="BAC" value={fmtYen(memberData.bac)} sub={`AC ${fmtYen(memberData.ac)}`}/>
          </div>

          {/* Member SPI sparkline */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <Eyebrow>SPI Trend</Eyebrow>
              <span style={{ fontSize: 10, color: EVM.ink3 }}>
                {`${(memberData.spi - 0.06).toFixed(2)} → ${memberData.spi.toFixed(2)}`}
              </span>
            </div>
            <Sparkline
              data={[memberData.spi-0.06, memberData.spi-0.05, memberData.spi-0.03, memberData.spi-0.02, memberData.spi-0.01, memberData.spi]}
              w={340} h={48} color={statusColor(spiTone(memberData.spi))}/>
          </div>

          {/* Member's task list */}
          <div style={{ padding: '14px 20px', flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <Eyebrow>担当タスク</Eyebrow>
              <span style={{ fontSize: 10, color: EVM.ink3 }}>{memberTasks.length} 件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {memberTasks.map(t => {
                const tone = spiTone(t.spi);
                return (
                  <div key={t.id} style={{
                    padding: '9px 12px', borderRadius: 5,
                    border: `1px solid ${EVM.rule}`, background: EVM.paperWarm,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3 }}>{t.code}</span>
                        <span style={{ fontSize: 12.5, color: EVM.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      </div>
                      <div style={{ height: 4, background: EVM.rule, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${t.progress}%`, height: '100%', background: t.progress === 100 ? EVM.ok : EVM.brandDeep }}/>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: EVM.fontMono, fontSize: 12, fontWeight: 700, color: t.spi == null ? EVM.ink4 : statusColor(tone) }}>
                        {t.spi == null ? 'N/A' : t.spi.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 9, color: EVM.ink3 }}>{t.progress}%</div>
                    </div>
                  </div>
                );
              })}
              {memberTasks.length === 0 && (
                <div style={{ color: EVM.ink3, fontSize: 12, fontStyle: 'italic' }}>担当タスクなし</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Member tab selected but no member chosen yet */}
      {mode === 'member' && !memberData && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: EVM.ink3, padding: 40 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
            左レールまたはタスクの担当者カードから<br/>メンバーを選択してください
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Fullscreen Gantt ────────────────────────────────────────────────────
function GanttFullscreen({ project, selectedTaskId, onSelectTask, filter, onFilterChange, onClose }) {
  const [ganttW, setGanttW] = useState(() =>
    Math.max(typeof window !== 'undefined' ? window.innerWidth - 200 : 1600, 1400)
  );
  const [progressTask, setProgressTask] = useState(null);
  const [progressEdit, setProgressEdit] = useState({});
  const [snapshotDate, setSnapshotDate] = useState(BASE_DATE);
  const [acUnit, setAcUnit] = useState('MD'); // 'MD' | 'h'
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const isPast = snapshotDate < BASE_DATE;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (progressTask) setProgressTask(null); else onClose(); } };
    const onResize = () => setGanttW(Math.max(window.innerWidth - 200, 1400));
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prev;
    };
  }, [onClose, progressTask]);

  const handleTaskClick = (t) => {
    onSelectTask(t.id);
    if (t.leaf && !t.buffer) {
      setProgressTask(t);
      setProgressEdit({});
    }
  };

  // 担当者ごとの未完了タスク数
  const incompleteByAssignee = {};
  project.tasks.forEach(t => {
    if (t.leaf && !t.buffer && t.progress < 100 && t.assignee)
      incompleteByAssignee[t.assignee] = (incompleteByAssignee[t.assignee] || 0) + 1;
  });

  // 担当者フィルター適用後の基底タスク集合（カウント計算用）
  const baseTasks = assigneeFilter
    ? project.tasks.filter(t => t.assignee === assigneeFilter)
    : project.tasks;

  const applyStatusFilter = (tasks) => tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'delayed') return t.spi !== null && t.spi < 0.9;
    if (filter === 'notdone') return (t.leaf || t.buffer) && t.progress < 100;
    if (filter === 'inprogress') return (t.leaf || t.buffer) && t.progress > 0 && t.progress < 100;
    if (filter === 'todo') return (t.leaf || t.buffer) && t.progress === 0;
    if (filter === 'done') return (t.leaf || t.buffer) && t.progress === 100;
    return true;
  });

  const filtered = (() => {
    const statusFiltered = applyStatusFilter(baseTasks);
    if (!assigneeFilter) return statusFiltered;

    // 担当者フィルター時: マッチした葉タスクの親コードを逆算して親行も含める
    const includedCodes = new Set(statusFiltered.map(t => t.code));
    const parentCodes = new Set();
    includedCodes.forEach(code => {
      const parts = code.split('.');
      for (let i = 1; i < parts.length; i++)
        parentCodes.add(parts.slice(0, i).join('.'));
    });
    return project.tasks.filter(t => includedCodes.has(t.code) || parentCodes.has(t.code));
  })();

  // タスクID / 名前検索
  const q = searchQuery.trim();
  const displayTasks = q ? (() => {
    const matched = filtered.filter(t =>
      t.code.startsWith(q) || t.name.includes(q)
    );
    const matchedCodes = new Set(matched.map(t => t.code));
    const parentCodes  = new Set();
    matchedCodes.forEach(code => {
      const parts = code.split('.');
      for (let i = 1; i < parts.length; i++)
        parentCodes.add(parts.slice(0, i).join('.'));
    });
    return filtered.filter(t => matchedCodes.has(t.code) || parentCodes.has(t.code));
  })() : filtered;

  const counts = {
    all: baseTasks.length,
    delayed: baseTasks.filter(t => t.spi !== null && t.spi < 0.9).length,
    notdone: baseTasks.filter(t => (t.leaf || t.buffer) && t.progress < 100).length,
    todo: baseTasks.filter(t => (t.leaf || t.buffer) && t.progress === 0).length,
    inprogress: baseTasks.filter(t => (t.leaf || t.buffer) && t.progress > 0 && t.progress < 100).length,
    done: baseTasks.filter(t => (t.leaf || t.buffer) && t.progress === 100).length,
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(20, 18, 14, 0.55)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      padding: 32, animation: 'evmFadeIn 0.18s ease-out',
    }}>
      <style>{`
        @keyframes evmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes evmSlideUp { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: none } }
      `}</style>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 2100,
        background: EVM.card, borderRadius: 8,
        boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'evmSlideUp 0.22s cubic-bezier(.2,.7,.3,1)',
        fontFamily: EVM.font,
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${EVM.rule}`,
          display: 'flex', alignItems: 'center', gap: 18, background: EVM.card, flex: '0 0 auto',
        }}>
          <BrandMark size={22}/>
          <div style={{ width: 1, height: 22, background: EVM.rule }}/>
          <div>
            <div style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
              Tasks · WBS · Fullscreen
            </div>
            <div style={{ fontFamily: EVM.fontSerif, fontSize: 18, color: EVM.ink, marginTop: 2, lineHeight: 1.1 }}>
              {project.name}
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: EVM.rule }}/>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: EVM.ink2 }}>
            <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>基準日</span>
            <span style={{ fontFamily: EVM.fontMono, fontVariantNumeric: 'tabular-nums' }}>{BASE_DATE}</span>
          </div>
          <div style={{ width: 1, height: 22, background: EVM.rule }}/>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>担当者</span>
            <select
              value={assigneeFilter || ''}
              onChange={e => { setAssigneeFilter(e.target.value || null); setProgressTask(null); }}
              style={{
                padding: '4px 10px', border: `1px solid ${assigneeFilter ? EVM.brand : EVM.rule}`,
                borderRadius: 4, background: assigneeFilter ? EVM.brandSoft : EVM.paperWarm,
                fontFamily: EVM.font, fontSize: 12,
                color: assigneeFilter ? EVM.brandDeep : EVM.ink,
                fontWeight: assigneeFilter ? 600 : 400,
                cursor: 'pointer', outline: 'none',
              }}>
              <option value=''>全員</option>
              {(project.assignees || []).map(a => (
                <option key={a.id} value={a.name}>
                  {a.name}　未完 {incompleteByAssignee[a.name] || 0}件
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}/>

          {/* タスク検索 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: EVM.ink3, flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text" placeholder="コード / タスク名" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: 160, padding: '4px 8px',
                border: `1px solid ${searchQuery ? EVM.brand : EVM.rule}`,
                borderRadius: 4, background: searchQuery ? EVM.brandSoft : EVM.paperWarm,
                fontFamily: EVM.fontMono, fontSize: 12,
                color: searchQuery ? EVM.brandDeep : EVM.ink,
                outline: 'none',
              }}/>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: EVM.ink3, padding: '0 2px', fontSize: 13 }}>✕</button>
            )}
          </div>
          <div style={{ width: 1, height: 22, background: EVM.rule }}/>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FilterChip active={filter === 'all'}        onClick={() => onFilterChange('all')}>すべて · {counts.all}</FilterChip>
            <FilterChip active={filter === 'delayed'}    onClick={() => onFilterChange('delayed')}    tone={counts.delayed > 0 ? 'warn' : null}>遅延 {counts.delayed}</FilterChip>
            <FilterChip active={filter === 'notdone'}    onClick={() => onFilterChange('notdone')}>完了以外 {counts.notdone}</FilterChip>
            <FilterChip active={filter === 'todo'}       onClick={() => onFilterChange('todo')}>未着手 {counts.todo}</FilterChip>
            <FilterChip active={filter === 'inprogress'} onClick={() => onFilterChange('inprogress')}>進行中 {counts.inprogress}</FilterChip>
            <FilterChip active={filter === 'done'}       onClick={() => onFilterChange('done')}>完了 {counts.done}</FilterChip>
          </div>

          <div style={{ width: 1, height: 22, background: EVM.rule }}/>

          <button onClick={onClose} title="閉じる (Esc)"
            className="evm-icon-btn"
            style={{
              width: 34, height: 34, borderRadius: 6, marginLeft: 4,
              background: EVM.paperWarm, border: `1px solid ${EVM.rule}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: EVM.ink2, fontFamily: 'inherit',
            }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: '1 1 auto', display: 'flex', overflow: 'hidden', background: EVM.paperWarm }}>

          {/* Gantt area */}
          <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '20px 28px' }}>
            <div style={{ background: EVM.card, border: `1px solid ${EVM.rule}`, borderRadius: 6, padding: '8px 16px 16px' }}>
              {displayTasks.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: EVM.ink3, fontStyle: 'italic', fontFamily: EVM.fontSerif }}>
                  該当するタスクはありません
                </div>
              ) : (
                <Gantt
                  tasks={displayTasks}
                  range={{ totalDays: project.totalDays, baseDay: project.baseDay, months: project.months }}
                  width={ganttW} labelW={460} rowH={34}
                  selectedTaskId={selectedTaskId}
                  onTaskClick={handleTaskClick}
                  showInfoCols={true}
                  startISO={project.startISO}
                />
              )}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: EVM.ink3 }}>
              <span style={{ fontStyle: 'italic', fontFamily: EVM.fontSerif }}>
                {progressTask ? `「${progressTask.name}」の進捗を入力中` :
                  assigneeFilter ? `${assigneeFilter} · ${filtered.length}件表示 — 行をクリックして進捗を入力` :
                  '行をクリックして進捗を入力'}
              </span>
              <span>
                <kbd style={{ background: EVM.card, border: `1px solid ${EVM.rule}`, padding: '1px 6px', borderRadius: 3, fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink2 }}>Esc</kbd>
                {progressTask ? ' でパネルを閉じる' : ' でモーダルを閉じる'}
              </span>
            </div>
          </div>

          {/* Progress input panel */}
          {progressTask && (() => {
            const t = progressTask;
            const progress    = progressEdit.progress != null ? progressEdit.progress : t.progress;
            const prevAcDays  = Math.round((t.end - t.start) * t.progress / 100 * (1 + (t.id % 3) * 0.08));
            const acDaysToday = progressEdit.acDays != null ? progressEdit.acDays : 0;
            const totalAcDays = prevAcDays + acDaysToday;
            const note  = progressEdit.note || '';
            const dirty = (progressEdit.progress != null && progressEdit.progress !== t.progress) || acDaysToday > 0;
            const tone  = spiTone(t.spi);
            const upd   = (patch) => setProgressEdit(prev => ({ ...prev, ...patch }));
            // 今日の計画進捗率 (PV%) — スケジュール上でスナップショット日時点に何%進んでいるべきか
            const snapshotOffset = Math.floor((new Date(snapshotDate) - new Date(project.startISO)) / 86400000);
            const taskDuration   = Math.max(1, t.end - t.start);
            const plannedPct     = Math.min(100, Math.max(0, Math.round((snapshotOffset - t.start) / taskDuration * 100)));
            const diffPct        = progress - plannedPct; // + 先行 / - 遅延
            const onTrack        = diffPct >= 0;
            const diffColor      = diffPct >= 0 ? EVM.ok : diffPct >= -10 ? EVM.warn : EVM.crit;
            const dateOf = (offset) => {
              const s = new Date(project.startISO);
              const d = new Date(s.getTime() + offset * 86400000);
              return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
            };
            // ancestry
            const ancestors = [];
            const parts = t.code.split('.');
            for (let i = 1; i < parts.length; i++) {
              const code = parts.slice(0, i).join('.');
              const p = project.tasks.find(x => x.code === code);
              if (p) ancestors.push(p);
            }
            return (
              <aside style={{ width: 440, flex: '0 0 auto', background: EVM.card, borderLeft: `1px solid ${EVM.rule}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Panel header */}
                <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${EVM.rule}`, flex: '0 0 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    {/* スナップショット日（目立つ位置に昇格） */}
                    <div style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: isPast ? EVM.warnSoft : EVM.brandSoft,
                      border: `1.5px solid ${isPast ? EVM.warn : EVM.brand}`,
                      borderRadius: 6,
                      marginRight: 10,
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: isPast ? '#8a6c1a' : EVM.brandDeep, marginBottom: 5 }}>
                        記録日 (スナップショット)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <input type="date" value={snapshotDate} max={BASE_DATE}
                          onChange={e => { setSnapshotDate(e.target.value); setProgressEdit({}); }}
                          style={{
                            padding: '2px 6px', border: `1px solid ${isPast ? EVM.warn : EVM.brand}`,
                            borderRadius: 4, fontFamily: EVM.fontMono, fontSize: 16, fontWeight: 600,
                            color: isPast ? '#8a6c1a' : EVM.brandDeep,
                            background: 'transparent', outline: 'none',
                          }}/>
                        <span style={{ fontSize: 11, color: isPast ? '#8a6c1a' : EVM.brandDeep, fontWeight: 500 }}>
                          {snapshotDate === BASE_DATE ? '今日' : `${Math.round((new Date(BASE_DATE) - new Date(snapshotDate)) / 86400000)}日前`}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setProgressTask(null)} style={{ width: 26, height: 26, borderRadius: 4, border: `1px solid ${EVM.rule}`, background: EVM.paperWarm, cursor: 'pointer', fontSize: 13, color: EVM.ink3, fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                  </div>
                  {ancestors.length > 0 && (
                    <div style={{ fontSize: 11, color: EVM.ink3, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {ancestors.map(a => <React.Fragment key={a.id}><span>{a.name}</span><span style={{ color: EVM.ink4 }}>›</span></React.Fragment>)}
                      <span style={{ color: EVM.ink, fontWeight: 600 }}>{t.name}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: EVM.fontMono, fontSize: 11, color: EVM.ink3 }}>{t.code}</span>
                    {ancestors.length === 0 && <span style={{ fontFamily: EVM.fontSerif, fontSize: 18, color: EVM.ink }}>{t.name}</span>}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: EVM.ink3 }}>
                    <span>担当 <strong style={{ color: EVM.ink2 }}>{t.assignee || '—'}</strong></span>
                    <span>{dateOf(t.start)} → {dateOf(t.end)}</span>
                    <Pill tone={tone}>{t.spi == null ? 'N/A' : tone === 'normal' ? 'On Track' : tone === 'warning' ? 'Watch' : 'Delayed'}</Pill>
                  </div>
                </div>

                {/* Scrollable form */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Card pad={18}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Eyebrow>進捗率</Eyebrow>
                      {dirty && <span style={{ fontSize: 10, color: EVM.brandDeep, fontWeight: 700 }}>{t.progress}% → {progress}%</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <input type="range" min={0} max={100} step={5} value={progress}
                          onChange={e => upd({ progress: +e.target.value })}
                          style={{ width: '100%', accentColor: EVM.brandDeep }}/>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <input type="number" min={0} max={100} step={1} value={progress}
                          onChange={e => upd({ progress: Math.max(0, Math.min(100, +e.target.value || 0)) })}
                          style={{ width: 62, padding: '5px 8px', textAlign: 'right', border: `1px solid ${EVM.rule}`, borderRadius: 4, fontFamily: EVM.fontSerif, fontSize: 22, color: EVM.ink, background: EVM.paperWarm }}/>
                        <span style={{ fontSize: 14, color: EVM.ink3 }}>%</span>
                      </div>
                    </div>

                    {/* Progress bar with planned-line marker */}
                    <div style={{ marginTop: 10, position: 'relative' }}>
                      <div style={{ height: 10, background: EVM.paperWarm, borderRadius: 5, overflow: 'visible', border: `1px solid ${EVM.rule}`, position: 'relative' }}>
                        {/* Actual progress fill */}
                        <div style={{ width: `${progress}%`, height: '100%', background: onTrack ? EVM.brandDeep : diffPct >= -10 ? EVM.warn : EVM.crit, borderRadius: 5, transition: 'width 0.15s' }}/>
                        {/* Planned position marker */}
                        {plannedPct > 0 && plannedPct <= 100 && (
                          <div style={{
                            position: 'absolute', top: -4, bottom: -4,
                            left: `calc(${plannedPct}% - 1px)`,
                            width: 2, background: EVM.ink2, borderRadius: 1,
                            zIndex: 2,
                          }}>
                            <div style={{
                              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                              marginBottom: 2, fontSize: 9, color: EVM.ink2, fontWeight: 700,
                              whiteSpace: 'nowrap', fontFamily: EVM.fontMono,
                              background: EVM.card, padding: '1px 3px', borderRadius: 2,
                            }}>計画 {plannedPct}%</div>
                          </div>
                        )}
                      </div>
                      {/* Legend */}
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: EVM.ink3 }}>
                          <span style={{ display: 'inline-block', width: 2, height: 10, background: EVM.ink2, borderRadius: 1 }}/>
                          今日の計画: <strong style={{ fontFamily: EVM.fontMono, color: EVM.ink2 }}>{plannedPct}%</strong>
                        </span>
                        <span style={{ color: EVM.ink4 }}>|</span>
                        <span style={{ color: diffColor, fontWeight: 600 }}>
                          {diffPct === 0 ? '計画通り' : diffPct > 0 ? `+${diffPct}% 先行` : `${diffPct}% 遅延`}
                        </span>
                        {!onTrack && (
                          <span style={{ color: EVM.ink3 }}>
                            · 今日中に <strong style={{ color: diffColor, fontFamily: EVM.fontMono }}>{plannedPct}%</strong> 到達が目標
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card pad={18}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Eyebrow>本日のAC追加入力</Eyebrow>
                      {/* 単位トグル */}
                      <div style={{ display: 'flex', border: `1px solid ${EVM.rule}`, borderRadius: 4, overflow: 'hidden' }}>
                        {['MD', 'h'].map(u => (
                          <button key={u} onClick={() => { setAcUnit(u); upd({ acDays: 0 }); }}
                            style={{
                              padding: '2px 10px', border: 'none', cursor: 'pointer',
                              fontFamily: EVM.fontMono, fontSize: 11, fontWeight: 600,
                              background: acUnit === u ? EVM.brandDeep : EVM.paperWarm,
                              color: acUnit === u ? '#fff' : EVM.ink3,
                            }}>{u}</button>
                        ))}
                      </div>
                    </div>
                    {(() => {
                      const factor = acUnit === 'h' ? 8 : 1;
                      const step   = 0.5;
                      const prevDisp  = (prevAcDays * factor).toFixed(1);
                      const todayDisp = (acDaysToday * factor).toFixed(1);
                      const totalMD   = totalAcDays; // always in MD for EV/AC/CPI
                      const totalDisp = (totalMD * factor).toFixed(1);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 10, color: EVM.ink3, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{snapshotDate}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <input type="number" min={0} step={step} value={acDaysToday * factor}
                                  onChange={e => upd({ acDays: Math.max(0, (+e.target.value || 0) / factor) })}
                                  style={{ width: 80, padding: '6px 10px', textAlign: 'right', border: `1px solid ${EVM.rule}`, borderRadius: 4, fontFamily: EVM.fontSerif, fontSize: 22, color: EVM.ink, background: EVM.paperWarm }}/>
                                <span style={{ fontSize: 13, color: EVM.ink3 }}>{acUnit}</span>
                              </div>
                            </div>
                            <div style={{ paddingTop: 20, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ color: EVM.ink3 }}>{prevDisp} <span style={{ color: EVM.ink4 }}>前回累積</span></div>
                              <div style={{ color: acDaysToday > 0 ? EVM.brandDeep : EVM.ink4 }}>+{todayDisp} 本日</div>
                              <div style={{ borderTop: `1px solid ${EVM.rule}`, paddingTop: 3, color: EVM.ink, fontWeight: 600 }}>{totalDisp} 累積合計</div>
                            </div>
                          </div>
                          <div style={{ marginTop: 10, padding: 8, background: EVM.paperWarm, borderRadius: 4, fontSize: 11, color: EVM.ink2, display: 'flex', gap: 14 }}>
                            <span>EV <strong style={{ fontFamily: EVM.fontMono }}>{(((t.bac||0)*progress/100)/1_000_000).toFixed(2)}M</strong></span>
                            <span>AC <strong style={{ fontFamily: EVM.fontMono }}>{(totalMD*600_000/1_000_000).toFixed(2)}M</strong></span>
                            <span>CPI <strong style={{ fontFamily: EVM.fontMono, color: EVM.brandDeep }}>{(((t.bac||0)*progress/100)/(totalMD*600_000||1)).toFixed(2)}</strong></span>
                          </div>
                        </>
                      );
                    })()}
                  </Card>

                  <Card pad={18}>
                    <Eyebrow style={{ marginBottom: 8 }}>メモ · 任意</Eyebrow>
                    <textarea value={note} onChange={e => upd({ note: e.target.value })}
                      placeholder="進捗の状況・課題・次のアクションなど"
                      style={{ width: '100%', minHeight: 72, padding: 8, border: `1px solid ${EVM.rule}`, borderRadius: 4, background: EVM.paperWarm, fontFamily: 'inherit', fontSize: 12.5, color: EVM.ink, resize: 'vertical', outline: 'none' }}/>
                  </Card>
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${EVM.rule}`, display: 'flex', gap: 8, flex: '0 0 auto', background: EVM.card }}>
                  <span style={{ fontSize: 11, color: EVM.ink3, flex: 1, alignSelf: 'center' }}>{snapshotDate}{isPast ? ' · 過去日付' : ''}</span>
                  <button onClick={() => setProgressTask(null)} style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${EVM.rule}`, background: 'transparent', color: EVM.ink2, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>キャンセル</button>
                  <button disabled={!dirty} onClick={() => setProgressTask(null)} style={{ padding: '7px 18px', borderRadius: 4, background: dirty ? EVM.brandDeep : EVM.paperWarm, border: `1px solid ${dirty ? EVM.brandDeep : EVM.rule}`, color: dirty ? '#fff' : EVM.ink3, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed' }}>保存</button>
                </div>
              </aside>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Chart Fullscreen ────────────────────────────────────────────────────
function ChartFullscreen({ type, project, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isTrend = type === 'trend';
  const eyebrow = isTrend ? 'Trend · Snapshots × Time' : 'CCPM Fever';
  const title   = isTrend ? 'SPI / CPI 推移' : 'バッファ消費 vs 完了率';

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const availW = vw  - 64 - 96;  // modal padding + card padding
  const availH = vh  - 64 - 60 - 56 - 48; // modal pad + header + footer + card pad

  let chartW, chartH;
  if (isTrend) {
    chartW = Math.max(availW, 480);
    chartH = Math.max(Math.min(availH, Math.round(availW * 0.38)), 260);
  } else {
    const sq = Math.max(Math.min(availW * 0.72, availH), 320);
    chartW = sq;
    chartH = sq;
  }

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(20, 18, 14, 0.55)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, animation: 'evmFadeIn 0.18s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: EVM.card, borderRadius: 8,
        boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'evmSlideUp 0.22s cubic-bezier(.2,.7,.3,1)',
        fontFamily: EVM.font,
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${EVM.rule}`,
          display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto',
        }}>
          <BrandMark size={22}/>
          <div style={{ width: 1, height: 22, background: EVM.rule }}/>
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <div style={{ fontFamily: EVM.fontSerif, fontSize: 18, color: EVM.ink, marginTop: 2 }}>{title}</div>
          </div>
          <div style={{ width: 1, height: 30, background: EVM.rule }}/>
          <div style={{ fontFamily: EVM.fontSerif, fontSize: 14, color: EVM.ink2 }}>{project.name}</div>
          <div style={{ flex: 1 }}/>
          {isTrend && (
            <span style={{ fontSize: 11, color: EVM.ink3 }}>過去 {project.spiTrend.length} スナップショット</span>
          )}
          {!isTrend && project.fever && (
            <Pill tone={project.fever.zone === 'GREEN' ? 'brand' : project.fever.zone === 'YELLOW' ? 'warning' : 'critical'}>
              {project.fever.zone}
            </Pill>
          )}
          <button onClick={onClose} title="閉じる (Esc)" className="evm-icon-btn"
            style={{
              width: 34, height: 34, borderRadius: 6, marginLeft: 12,
              background: EVM.paperWarm, border: `1px solid ${EVM.rule}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: EVM.ink2,
            }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Chart */}
        <div style={{ padding: '28px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isTrend
            ? <SpiTrendChart data={project.spiTrend} w={chartW} h={chartH}/>
            : project.fever
              ? <FeverChart data={project.fever} w={chartW} h={chartH}/>
              : <div style={{ color: EVM.ink3, fontStyle: 'italic', fontFamily: EVM.fontSerif, padding: 60 }}>バッファタスク未定義</div>
          }
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 24px', borderTop: `1px solid ${EVM.rule}`, display: 'flex', justifyContent: 'flex-end', flex: '0 0 auto' }}>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>
            <kbd style={{ background: EVM.card, border: `1px solid ${EVM.rule}`, padding: '1px 6px', borderRadius: 3, fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink2 }}>Esc</kbd>
            {' '}で閉じる
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────
function FilterChip({ children, active, onClick, tone }) {
  return (
    <button onClick={onClick}
      className={'evm-chip' + (active ? ' active' : '')}
      style={{
        padding: '5px 10px', borderRadius: 4,
        background: tone === 'warn' && !active ? EVM.warnSoft : EVM.paperWarm,
        border: `1px solid ${tone === 'warn' && !active ? '#e6d29a' : EVM.rule}`,
        color: tone === 'warn' && !active ? '#8a6c1a' : EVM.ink2,
        fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
      }}>{children}</button>
  );
}

function Chevron({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{
      transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flex: '0 0 auto',
    }}>
      <path d="M2 3 L5 7 L8 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2 C5.5 2 4 4 4 6.5 V10 L3 12 H13 L12 10 V6.5 C12 4 10.5 2 8 2 Z M6.5 13 C6.5 13.8 7.2 14.5 8 14.5 C8.8 14.5 9.5 13.8 9.5 13"
        stroke={EVM.ink2} strokeWidth="1.3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function ExpandIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
      <path d="M2 5 L2 2 L5 2 M9 2 L12 2 L12 5 M12 9 L12 12 L9 12 M5 12 L2 12 L2 9"
        stroke={color} strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
    </svg>
  );
}

// Invisible click-catcher to dismiss popovers
function Overlay({ children, onDismiss }) {
  return (
    <>
      <div onClick={onDismiss} style={{
        position: 'fixed', inset: 0, zIndex: 18, background: 'transparent',
      }}/>
      {children}
    </>
  );
}

window.VariationA = VariationA;
