// PortfolioShell — the portfolio-mode app root (issue #23): a read-only
// juxtaposition of N independently-derived homes. Two views (案件並置 / 人横断)
// plus drill-down: selecting a project mounts the EXISTING single-project
// workbench (MoiraProvider + App) over that project's slice — the drilled view
// is byte-for-byte the same dashboard the project shows on its own.
//
// Label/roster registries are module-global and PER PROJECT here, so they are
// installed synchronously in the click handler BEFORE the state change that
// triggers the render (the live-bridge ordering rule: registries first, then
// the state swap).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EVM } from '../theme/tokens';
import { App } from '../App';
import { usePortfolio, useMoira } from '../moira/hooks';
import { setUserLabels } from '../moira/labels';
import { setRoster } from '../moira/roster';
import { MoiraProvider } from '../moira/store';
import type { PortfolioProjectData } from '../moira/portfolio-context';
import { PortfolioOverview } from '../surfaces/portfolio/PortfolioOverview';
import { PersonView } from '../surfaces/portfolio/PersonView';

type PortfolioView = 'overview' | 'people';

const VIEWS: Array<{ id: PortfolioView; label: string; axis: string }> = [
  { id: 'overview', label: '案件並置', axis: '案件ごとの会計を並べて見る' },
  { id: 'people', label: '人横断', axis: '同じ人の掛け持ちを見る' },
];

export function PortfolioShell() {
  const { label, asOf, setAsOf, projects } = usePortfolio();
  const [view, setView] = useState<PortfolioView>('overview');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const okProjects = projects.flatMap((p) => (p.kind === 'ok' ? [p.data] : []));
  const errorCount = projects.length - okProjects.length;

  const openProject = (key: string): void => {
    const proj = okProjects.find((d) => d.key === key);
    if (proj === undefined) return;
    // Registries BEFORE the state change (see module header).
    setUserLabels(proj.nodeLabels, proj.actorLabels);
    setRoster(proj.members, undefined);
    setSelectedKey(key);
  };

  if (selectedKey !== null) {
    const proj = okProjects.find((d) => d.key === selectedKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 18px',
            background: EVM.brandWash,
            borderBottom: `1px solid ${EVM.rule}`,
            flex: '0 0 auto',
          }}
        >
          <button
            data-testid="portfolio-back"
            onClick={() => setSelectedKey(null)}
            style={{
              border: `1px solid ${EVM.rule}`,
              borderRadius: 6,
              background: EVM.card,
              fontSize: 11.5,
              padding: '4px 12px',
              cursor: 'pointer',
              color: EVM.ink2,
              fontWeight: 600,
            }}
          >
            ← ポートフォリオへ戻る
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{proj?.label ?? selectedKey}</span>
          <span style={{ fontSize: 10.5, color: EVM.ink3 }}>
            単一案件ビュー — 会計はこの案件単独（横断合成なし）
          </span>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          {proj === undefined ? (
            <div style={{ padding: 24, fontSize: 12.5, color: EVM.crit }}>
              この案件はライブ更新で読めなくなりました（ポートフォリオへ戻って確認してください）。
            </div>
          ) : (
            <MoiraProvider
              key={proj.key}
              initialEvents={proj.events}
              initialCapacity={proj.capacityEntries}
              initialAsOf={asOf}
              initialDeadline={proj.deadline}
              initialTargetDate={proj.targetDate}
            >
              <DrillSyncBridge project={proj} />
              <App />
            </MoiraProvider>
          )}
        </div>
      </div>
    );
  }

  let body: ReactNode;
  switch (view) {
    case 'overview':
      body = <PortfolioOverview onOpenProject={openProject} />;
      break;
    case 'people':
      body = <PersonView />;
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* top bar — mirrors WorkbenchShell's layout language */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 18px',
          background: EVM.card,
          borderBottom: `1px solid ${EVM.rule}`,
          flex: '0 0 auto',
        }}
      >
        <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>Moira</div>
        <div style={{ fontSize: 11, color: EVM.ink3 }}>
          ポートフォリオ{label !== null ? ` — ${label}` : ''}（読み取り専用の並置）
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>
            {okProjects.length}案件
            {errorCount > 0 ? `＋読込エラー${errorCount}件` : ''}
          </span>
          <label style={{ fontSize: 12, color: EVM.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            基準日（全案件で統一）
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              data-testid="portfolio-asof-input"
              style={{
                fontFamily: EVM.fontMono,
                border: `1px solid ${EVM.rule}`,
                borderRadius: 6,
                padding: '4px 8px',
                background: EVM.paperWarm,
              }}
            />
          </label>
        </div>
      </header>

      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        {/* left rail */}
        <nav
          style={{
            width: 208,
            flex: '0 0 auto',
            background: EVM.card,
            borderRight: `1px solid ${EVM.rule}`,
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: EVM.ink4, padding: '2px 8px 6px' }}>
            ポートフォリオ
          </div>
          {VIEWS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                data-testid={`portfolio-nav:${item.id}`}
                style={{
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 7,
                  padding: '7px 9px',
                  cursor: 'pointer',
                  background: active ? EVM.brandWash : 'transparent',
                  borderLeft: active ? `2px solid ${EVM.brandDeep}` : '2px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? EVM.brandDeep : EVM.ink }}>
                  {item.label}
                </span>
                <span style={{ fontSize: 10, color: EVM.ink3 }}>{item.axis}</span>
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', fontSize: 10, color: EVM.ink4, padding: '8px', lineHeight: 1.5 }}>
            home ごとに独立導出<br />
            ログのマージなし（D-50）
          </div>
        </nav>

        {/* main */}
        <main
          data-testid={`portfolio-root:${view}`}
          style={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', background: EVM.paper }}
        >
          {body}
        </main>
      </div>
    </div>
  );
}

/**
 * Keeps a drilled single-project view following portfolio live updates: when
 * the portfolio fixture is refetched, push the project's fresh slice into the
 * mounted MoiraProvider (registries first, then the snapshot swap — the
 * live.tsx ordering). Renders nothing.
 */
function DrillSyncBridge({ project }: { project: PortfolioProjectData }) {
  const { replaceSnapshot } = useMoira();
  const lastRef = useRef(project);
  useEffect(() => {
    // Initial mount: MoiraProvider was already seeded via initial* props and the
    // click handler installed the registries — only LATER slices need pushing.
    if (lastRef.current === project) return;
    lastRef.current = project;
    setUserLabels(project.nodeLabels, project.actorLabels);
    setRoster(project.members, undefined);
    replaceSnapshot(project.events, project.capacityEntries);
  }, [project, replaceSnapshot]);
  return null;
}
