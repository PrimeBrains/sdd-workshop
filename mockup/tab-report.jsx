// tab-report.jsx — レポート タブ. 朝報レポートのドキュメント風プレビュー + 設定.
// OOUI: Report オブジェクト. 設定→生成→プレビュー→共有 の構造.

const { useState: useStateRP } = React;

function ReportWorkbench({ onTabChange }) {
  const [projectId, setProjectId] = useStateRP(1);
  const [reportType, setReportType] = useStateRP('morning'); // morning | weekly | monthly | custom
  const [sections, setSections] = useStateRP({
    summary: true, alerts: true, trend: true, fever: true, assignees: true, gantt: false, notes: true,
  });
  const [recipients] = useStateRP([
    { name: '田中 美咲', role: 'PM' },
    { name: '佐藤 拓海', role: 'Lead Eng' },
    { name: '部門長 #pmo-daily', role: 'Slack' },
  ]);

  const project = PROJECT_DATA.find(p => p.id === projectId);

  const toolbar = (
    <div style={{
      background: EVM.card, borderBottom: `1px solid ${EVM.rule}`,
      padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
      flex: '0 0 auto',
    }}>
      <Eyebrow>Report</Eyebrow>
      <span style={{ fontSize: 13, color: EVM.ink, fontWeight: 500 }}>朝報 — {project.name}</span>
      <span style={{ fontSize: 11, color: EVM.ink3, fontFamily: EVM.fontMono }}>
        {BASE_DATE} · v3
      </span>
      <div style={{ flex: 1 }}/>

      <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden', border: `1px solid ${EVM.rule}` }}>
        {[
          { v: 'morning', l: '朝報' },
          { v: 'weekly', l: '週次' },
          { v: 'monthly', l: '月次' },
          { v: 'custom', l: 'カスタム' },
        ].map((o, i) => (
          <button key={o.v} onClick={() => setReportType(o.v)}
            style={{
              padding: '6px 14px', border: 0,
              borderRight: i < 3 ? `1px solid ${EVM.rule}` : 'none',
              background: reportType === o.v ? EVM.brandWash : EVM.paperWarm,
              color: reportType === o.v ? EVM.brandDeep : EVM.ink2,
              fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
              fontWeight: reportType === o.v ? 600 : 500,
            }}>{o.l}</button>
        ))}
      </div>

      <button style={{
        padding: '6px 12px', borderRadius: 4,
        background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, color: EVM.ink2,
        fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 5 L6 8 L9 5 M6 8 L6 1 M2 10 L10 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        PDF
      </button>
      <button style={{
        padding: '6px 12px', borderRadius: 4,
        background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, color: EVM.ink2,
        fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
      }}>クリップボードへ</button>
      <button style={{
        padding: '6px 16px', borderRadius: 4,
        background: EVM.brandDeep, border: `1px solid ${EVM.brandDeep}`, color: '#fff',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>Slack へ送信 →</button>
    </div>
  );

  return (
    <WorkbenchShell activeTab="レポート" onTabChange={onTabChange} projectId={projectId} onProjectChange={setProjectId}
      toolbar={toolbar}
      rightPanel={<ReportConfig sections={sections} setSections={setSections} recipients={recipients} project={project}/>}>

      <div style={{ background: EVM.paper, padding: '40px 40px 60px', minHeight: '100%' }}>
        {/* Document */}
        <div style={{
          maxWidth: 820, margin: '0 auto', background: EVM.card,
          boxShadow: '0 6px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
          borderRadius: 4, overflow: 'hidden',
        }}>
          <ReportDocument project={project} sections={sections}/>
        </div>
      </div>
    </WorkbenchShell>
  );
}

// ── Document body ───────────────────────────────────────────────────────
function ReportDocument({ project, sections }) {
  return (
    <div style={{ padding: '60px 70px', fontFamily: EVM.fontSerif, color: EVM.ink, lineHeight: 1.6 }}>
      {/* Letterhead */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingBottom: 20, borderBottom: `2px solid ${EVM.ink}`,
      }}>
        <div>
          <div style={{
            fontFamily: EVM.fontBrand, fontSize: 16, letterSpacing: '0.24em',
            color: EVM.ink, fontWeight: 600,
          }}>EVM STUDIO</div>
          <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 4, letterSpacing: '0.08em' }}>
            Project Health Briefing · Morning Edition
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: EVM.fontMono, fontSize: 11, color: EVM.ink3 }}>{BASE_DATE}</div>
          <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 2 }}>第 47 報</div>
        </div>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: EVM.fontSerif, fontWeight: 400, fontSize: 38, color: EVM.ink,
        margin: '32px 0 8px', lineHeight: 1.15, letterSpacing: '-0.01em',
      }}>{project.name}</h1>
      <div style={{ fontSize: 13, color: EVM.ink3, fontStyle: 'italic' }}>
        {project.code} · 期間 {project.startISO} → {project.endISO} · 進捗 {project.progress}% (残 {project.remaining}日)
      </div>

      {/* Lede paragraph */}
      <p style={{
        fontFamily: EVM.fontSerif, fontSize: 15.5, color: EVM.ink2,
        margin: '24px 0 0', lineHeight: 1.75,
        borderLeft: `3px solid ${EVM.brandDeep}`, paddingLeft: 18,
      }}>
        {reportLede(project)}
      </p>

      {/* Sections */}
      {sections.summary && <ReportSection num="01" title="プロジェクトサマリー">
        <SummaryBlock project={project}/>
      </ReportSection>}

      {sections.alerts && <ReportSection num="02" title="アラート">
        <AlertsBlock project={project}/>
      </ReportSection>}

      {sections.trend && <ReportSection num="03" title="SPI / CPI 推移">
        <div style={{ background: EVM.paperWarm, padding: '20px 0 0', borderRadius: 4, border: `1px solid ${EVM.rule}` }}>
          <SpiTrendChart data={project.spiTrend} w={640} h={220}/>
        </div>
        <p style={{ fontFamily: EVM.fontSerif, fontSize: 13, color: EVM.ink2, marginTop: 14, lineHeight: 1.7 }}>
          {trendCommentary(project)}
        </p>
      </ReportSection>}

      {sections.fever && project.fever && <ReportSection num="04" title="CCPM フィーバーチャート">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
          <div style={{ background: EVM.paperWarm, padding: 16, border: `1px solid ${EVM.rule}` }}>
            <FeverChart data={project.fever} w={300} h={220}/>
          </div>
          <div>
            <div style={{
              fontFamily: EVM.fontSerif, fontSize: 36, color: EVM.brandDeep, lineHeight: 1,
            }}>{project.fever.zone}</div>
            <p style={{ fontFamily: EVM.fontSerif, fontSize: 13, color: EVM.ink2, marginTop: 12, lineHeight: 1.7 }}>
              バッファ消費 {fmtPct(project.fever.bufferConsumption)} に対し完了率
              {' '}{fmtPct(project.fever.criticalChainCompletion)}。
              クリティカルチェーンは健全に進行している。
            </p>
          </div>
        </div>
      </ReportSection>}

      {sections.assignees && <ReportSection num="05" title="担当者別ハイライト">
        <AssigneesBlock project={project}/>
      </ReportSection>}

      {sections.notes && <ReportSection num="06" title="編集者ノート">
        <p style={{ fontFamily: EVM.fontSerif, fontSize: 14, color: EVM.ink2, lineHeight: 1.8, fontStyle: 'italic' }}>
          結合テスト計画書レビュー (中村 葵) が遅延気味。
          5/15 までに完了見通しを共有してもらう予定。
          API実装 (佐藤 拓海) は当初想定より好調に推移しており、
          来週半ばに前倒し完了の可能性あり。
        </p>
      </ReportSection>}

      {/* Footer */}
      <div style={{
        marginTop: 60, paddingTop: 20, borderTop: `1px solid ${EVM.rule}`,
        display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: EVM.ink3, fontFamily: EVM.font,
      }}>
        <span>編集: 田中 美咲 · PM</span>
        <span>EVM Studio Auto-Generated · {BASE_DATE} 06:00</span>
        <span>1 / 1</span>
      </div>
    </div>
  );
}

function reportLede(p) {
  if (p.summary.spi >= 1.0) return `プロジェクトは予定を上回るペースで進行中。SPI ${p.summary.spi.toFixed(2)} / CPI ${p.summary.cpi.toFixed(2)}、VAC ${fmtSignedYen(p.summary.vac)} と計画予算より好転。今週は実装フェーズの中盤を順調に通過。`;
  if (p.summary.spi >= 0.9) return `プロジェクトは概ね計画通りに進行中。SPI ${p.summary.spi.toFixed(2)} / CPI ${p.summary.cpi.toFixed(2)}。1件の警告タスクあり、対応中。`;
  if (p.summary.spi >= 0.8) return `スケジュールに遅れの兆候。SPI ${p.summary.spi.toFixed(2)} (先週比 ${p.summary.spiDelta > 0 ? '+' : ''}${p.summary.spiDelta.toFixed(2)})。${p.alerts.length}件の遅延タスクの早期リカバリが必要。`;
  return `プロジェクトは重大な遅延状態。SPI ${p.summary.spi.toFixed(2)} まで低下、計画見直しを推奨。`;
}

function trendCommentary(p) {
  const last = p.spiTrend[p.spiTrend.length - 1].spi;
  const first = p.spiTrend[0].spi;
  const diff = last - first;
  if (diff > 0.05) return `SPI は ${first.toFixed(2)} から ${last.toFixed(2)} へ ${(diff*100).toFixed(1)}pt 改善。リカバリ施策が効果を示している。`;
  if (diff < -0.05) return `SPI は ${first.toFixed(2)} から ${last.toFixed(2)} へ ${(Math.abs(diff)*100).toFixed(1)}pt 低下。減速トレンドに留意が必要。`;
  return `SPI は ${first.toFixed(2)} → ${last.toFixed(2)} と横ばい推移。`;
}

// ── Blocks ──────────────────────────────────────────────────────────────
function ReportSection({ num, title, children }) {
  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 8, borderBottom: `1px solid ${EVM.rule}`, marginBottom: 18 }}>
        <span style={{ fontFamily: EVM.fontMono, fontSize: 11, color: EVM.brandDeep, fontWeight: 700, letterSpacing: '0.16em' }}>{num}</span>
        <h2 style={{ fontFamily: EVM.fontSerif, fontWeight: 500, fontSize: 20, color: EVM.ink, margin: 0, lineHeight: 1.2 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryBlock({ project }) {
  const s = project.summary;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      border: `1px solid ${EVM.rule}`, background: EVM.paperWarm,
      fontFamily: EVM.font,
    }}>
      {[
        { l: 'SPI', v: s.spi.toFixed(2), tone: 'brand', sub: `vs先週 ${s.spiDelta > 0 ? '+' : ''}${s.spiDelta.toFixed(2)}` },
        { l: 'CPI', v: s.cpi.toFixed(2), tone: 'brand', sub: `vs先週 ${s.cpiDelta > 0 ? '+' : ''}${s.cpiDelta.toFixed(2)}` },
        { l: 'VAC', v: fmtSignedYen(s.vac), tone: s.vac >= 0 ? 'normal' : 'critical', sub: `EAC ${fmtYen(s.eac)}` },
        { l: 'TCPI', v: s.tcpi.toFixed(2), sub: '残作業効率指数' },
      ].map((c, i) => (
        <div key={c.l} style={{
          padding: '18px 22px', borderRight: i < 3 ? `1px solid ${EVM.rule}` : 'none',
        }}>
          <SummaryStat label={c.l} value={c.v} tone={c.tone} sub={c.sub}/>
        </div>
      ))}
    </div>
  );
}

function AlertsBlock({ project }) {
  if (project.alerts.length === 0) {
    return (
      <p style={{ fontFamily: EVM.fontSerif, fontSize: 13, color: EVM.ink2, fontStyle: 'italic', lineHeight: 1.7 }}>
        本日 critical/warning 閾値を下回るタスクはありません。
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {project.alerts.map((a, i) => (
        <div key={i} style={{
          padding: '14px 18px', background: a.level === 'critical' ? EVM.critSoft : EVM.warnSoft,
          borderLeft: `3px solid ${a.level === 'critical' ? EVM.crit : EVM.warn}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{
            fontFamily: EVM.fontMono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em',
            color: a.level === 'critical' ? EVM.crit : '#8a6c1a',
            padding: '3px 8px', background: EVM.card, borderRadius: 2,
          }}>{a.level.toUpperCase()}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: EVM.fontSerif, fontSize: 15, color: EVM.ink }}>{a.taskName}</div>
            <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 2, fontFamily: EVM.font }}>{a.assigneeName}</div>
          </div>
          <div style={{
            fontFamily: EVM.fontMono, fontSize: 14, fontWeight: 700,
            color: a.level === 'critical' ? EVM.crit : EVM.warn,
            fontVariantNumeric: 'tabular-nums',
          }}>SPI {a.spi.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

function AssigneesBlock({ project }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {project.assignees.slice(0, 4).map(a => {
        const tone = spiTone(a.spi);
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0',
            borderBottom: `1px solid ${EVM.ruleSoft}`, fontFamily: EVM.font,
          }}>
            <Avatar initials={a.name.split(' ').map(s => s[0]).join('').slice(0, 2)} size={32}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: EVM.fontSerif, fontSize: 15, color: EVM.ink }}>{a.name}</div>
              <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 2 }}>
                EV {fmtYen(a.ev)} / BAC {fmtYen(a.bac)} · 進捗 {((a.ev / a.bac) * 100).toFixed(0)}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: EVM.ink3, letterSpacing: '0.12em', fontWeight: 600 }}>SPI</div>
                <div style={{ fontFamily: EVM.fontMono, fontSize: 14, color: statusColor(tone), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{a.spi.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: EVM.ink3, letterSpacing: '0.12em', fontWeight: 600 }}>CPI</div>
                <div style={{ fontFamily: EVM.fontMono, fontSize: 14, color: EVM.ink2, fontVariantNumeric: 'tabular-nums' }}>{a.cpi.toFixed(2)}</div>
              </div>
              <Pill tone={tone}>
                {tone === 'normal' ? '健全' : tone === 'warning' ? '注意' : '遅延'}
              </Pill>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Right config panel ──────────────────────────────────────────────────
function ReportConfig({ sections, setSections, recipients, project }) {
  const sectionMeta = [
    { k: 'summary', l: '01 · プロジェクトサマリー' },
    { k: 'alerts', l: '02 · アラート' },
    { k: 'trend', l: '03 · SPI/CPI 推移' },
    { k: 'fever', l: '04 · CCPM フィーバー', disabled: !project.fever },
    { k: 'assignees', l: '05 · 担当者別' },
    { k: 'gantt', l: '06 · ガント (β)' },
    { k: 'notes', l: '07 · 編集者ノート' },
  ];
  const versions = [
    { v: 'v3 (現在)', when: '今日 06:00 自動生成', by: 'Auto', active: true },
    { v: 'v2', when: '昨日 06:00', by: '田中 美咲 · 編集' },
    { v: 'v1', when: '5/12 06:00', by: 'Auto' },
  ];

  return (
    <aside style={{
      width: 340, flex: '0 0 auto', background: EVM.card,
      borderLeft: `1px solid ${EVM.rule}`,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
    }}>
      {/* Sections */}
      <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${EVM.rule}` }}>
        <Eyebrow>含めるセクション</Eyebrow>
      </div>
      <div style={{ padding: '6px 14px 12px' }}>
        {sectionMeta.map(s => {
          const enabled = sections[s.k];
          return (
            <label key={s.k} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px',
              cursor: s.disabled ? 'not-allowed' : 'pointer', borderRadius: 4,
              opacity: s.disabled ? 0.5 : 1,
            }}>
              <input type="checkbox" checked={enabled} disabled={s.disabled}
                onChange={e => setSections({ ...sections, [s.k]: e.target.checked })}
                style={{ accentColor: EVM.brandDeep }}/>
              <span style={{ fontSize: 12.5, color: enabled ? EVM.ink : EVM.ink3, fontFamily: EVM.font }}>
                {s.l}
              </span>
            </label>
          );
        })}
      </div>

      {/* Recipients */}
      <div style={{ padding: '14px 20px 10px', borderTop: `1px solid ${EVM.rule}`, borderBottom: `1px solid ${EVM.rule}` }}>
        <Eyebrow>送信先 · {recipients.length}</Eyebrow>
      </div>
      <div style={{ padding: '6px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {recipients.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 4,
          }}>
            <Avatar initials={r.name.startsWith('#') ? '#' : r.name.split(' ').map(s => s[0]).join('').slice(0, 2)} size={22}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: EVM.ink }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: EVM.ink3 }}>{r.role}</div>
            </div>
            <button style={{ border: 0, background: 'transparent', color: EVM.ink4, cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        ))}
        <button style={{
          padding: '8px 10px', background: 'transparent', border: `1px dashed ${EVM.rule}`,
          borderRadius: 4, color: EVM.ink3, fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
        }}>＋ 追加</button>
      </div>

      {/* Schedule */}
      <div style={{ padding: '14px 20px 10px', borderTop: `1px solid ${EVM.rule}`, borderBottom: `1px solid ${EVM.rule}` }}>
        <Eyebrow>配信スケジュール</Eyebrow>
      </div>
      <div style={{ padding: '12px 20px 14px', fontSize: 12, color: EVM.ink2, lineHeight: 1.7 }}>
        <div>毎営業日 <strong style={{ color: EVM.ink, fontWeight: 600 }}>06:00</strong> 自動生成</div>
        <div>営業日カレンダー: <span style={{ fontFamily: EVM.fontMono, fontSize: 11.5 }}>JP/Tokyo</span></div>
        <button style={{
          marginTop: 8, padding: '4px 10px', background: EVM.paperWarm,
          border: `1px solid ${EVM.rule}`, borderRadius: 4, color: EVM.ink2,
          fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
        }}>編集</button>
      </div>

      {/* Versions */}
      <div style={{ padding: '14px 20px 10px', borderTop: `1px solid ${EVM.rule}`, borderBottom: `1px solid ${EVM.rule}` }}>
        <Eyebrow>バージョン履歴</Eyebrow>
      </div>
      <div style={{ padding: '6px 14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {versions.map((v, i) => (
          <button key={i} className="evm-project-btn" style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
            border: 0, background: v.active ? EVM.brandWash : 'transparent',
            borderLeft: `3px solid ${v.active ? EVM.brandDeep : 'transparent'}`,
            borderRadius: 4, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: EVM.ink, fontWeight: v.active ? 600 : 500 }}>{v.v}</div>
              <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 2 }}>{v.when} · {v.by}</div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

window.ReportWorkbench = ReportWorkbench;
