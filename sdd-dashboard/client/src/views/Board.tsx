import type { SpecSummary } from '../api'

const PHASES = ['requirements', 'design', 'tasks'] as const

function nodeState(s: SpecSummary, phase: (typeof PHASES)[number]): { cls: string; label: string } {
  const a = s.approvals?.[phase]
  if (a?.approved) return { cls: 'approved', label: '承認済み' }
  if (a?.generated) return { cls: 'generated', label: 'レビュー待ち' }
  return { cls: '', label: '未着手' }
}

function implState(s: SpecSummary): { cls: string; label: string } {
  const { total, done } = s.taskStats
  if (total === 0) return { cls: '', label: '—' }
  if (done === total) return { cls: 'approved', label: '完了' }
  if (done > 0) return { cls: 'generated', label: `${done}/${total}` }
  return { cls: '', label: `0/${total}` }
}

export function groupByApp(specs: SpecSummary[]): [string, SpecSummary[]][] {
  const groups = new Map<string, SpecSummary[]>()
  for (const s of specs) {
    const app = s.app ?? '（未分類）'
    if (!groups.has(app)) groups.set(app, [])
    groups.get(app)!.push(s)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function Board({ specs, onOpen }: { specs: SpecSummary[]; onOpen: (feature: string) => void }) {
  return (
    <div>
      <h1 className="page-title">パイプラインボード</h1>
      <div className="page-sub">アプリ単位（spec.json の app フィールド）にグルーピング。スペック名クリックで詳細へ。</div>
      {groupByApp(specs).map(([app, group]) => (
        <div key={app} style={{ marginBottom: 22 }}>
          <div className="app-head">
            <span className="app-name">📦 {app}</span>
            <span className="note">{group.length} specs · READY {group.filter((s) => s.readyForImplementation).length} · 実装完了 {group.filter((s) => s.taskStats.total > 0 && s.taskStats.done === s.taskStats.total).length}</span>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {group.map((s) => (
              <div className="lane" key={s.feature}>
                <div className="name" onClick={() => onOpen(s.feature)}>
                  {s.feature}
                  <small>{s.phase}{s.updatedAt ? ` · ${String(s.updatedAt).slice(0, 10)}` : ''}</small>
                </div>
                <div className="pipe">
                  {PHASES.map((p, i) => {
                    const st = nodeState(s, p)
                    return (
                      <span key={p} style={{ display: 'contents' }}>
                        {i > 0 && <span className="arrow">→</span>}
                        <span className={`node ${st.cls}`}>{p}<small>{st.label}</small></span>
                      </span>
                    )
                  })}
                  <span className="arrow">→</span>
                  {(() => { const st = implState(s); return <span className={`node ${st.cls}`}>impl<small>{st.label}</small></span> })()}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.readyForImplementation
                    ? <span className="badge ok">READY</span>
                    : <span className="badge gray">{s.artifacts.requirements ? 'in spec' : 'discovery'}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="note" style={{ marginTop: 12 }}>
        ⛩ スケルトン注記: 本実装ではフロー可視化に @xyflow/react を使い、承認/手戻り操作後は SSE で全画面が即時更新されます。
      </p>
    </div>
  )
}
