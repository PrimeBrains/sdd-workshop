import { useEffect, useRef, useState } from 'react'
import type { SpecDetail, SpecSummary, TaskItem, TraceRow } from '../api'
import { fetchJson } from '../api'
import { Md, slug } from '../Md'
import { navigate, specHash, type SpecTab } from '../router'
import { groupByApp } from './Board'

interface Popover { acId: string; x: number; y: number }

/** トレーサビリティ行の Components セルから design.md 内の見出しアンカーを推定する */
function findDesignAnchor(row: TraceRow, headings: { depth: number; text: string }[]): string | null {
  const tokens = row.components
    .split(/[`,、()（）\s]+/)
    .map((t) => t.replace(/\.(tsx?|md|css|json)$/, '').split('/').pop() ?? '')
    .filter((t) => t.length >= 3)
  for (const token of tokens) {
    const hit = headings.find((h) => h.depth >= 3 && (h.text.includes(token) || token.includes(h.text)))
    if (hit) return slug(hit.text)
  }
  return null
}

export function SpecViewer({ specs, feature, tab, params }: {
  specs: SpecSummary[]
  feature: string
  tab: SpecTab
  params: URLSearchParams
}) {
  const [detail, setDetail] = useState<SpecDetail | null>(null)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [modal, setModal] = useState<'approve' | 'rollback' | null>(null)

  // URL がナビゲーション状態の単一の真実（ブラウザバックで戻れる）
  const focusAc = params.get('ac')
  const designFocus = { rowIdx: params.has('row') ? Number(params.get('row')) : null, anchor: params.get('anchor') }
  const taskFocus = params.get('task')

  useEffect(() => {
    setDetail(null)
    setPopover(null)
    fetchJson<SpecDetail>(`/api/specs/${feature}`).then(setDetail).catch(console.error)
  }, [feature])

  const openPopover = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPopover({ acId: id, x: Math.min(e.clientX, window.innerWidth - 360), y: e.clientY })
  }
  const jumpToMatrix = (id: string) => { navigate(specHash(feature, 'trace', { ac: id })); setPopover(null) }
  const jumpToDesign = (rowIdx: number) => {
    if (!detail) return
    const anchor = findDesignAnchor(detail.design.traceRows[rowIdx], detail.design.headings)
    navigate(specHash(feature, 'design', { row: String(rowIdx), ...(anchor ? { anchor } : {}) }))
    setPopover(null)
  }
  const jumpToTask = (taskId: string) => { navigate(specHash(feature, 'tasks', { task: taskId })); setPopover(null) }

  if (!detail) return <div className="note">読み込み中…</div>
  const summary = specs.find((s) => s.feature === feature)

  return (
    <div onClick={() => setPopover(null)}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <select value={feature} onChange={(e) => navigate(specHash(e.target.value))}
            style={{ fontSize: 15, fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff' }}>
            {groupByApp(specs).map(([app, group]) => (
              <optgroup key={app} label={`📦 ${app}`}>
                {group.map((s) => <option key={s.feature} value={s.feature}>{s.feature}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="badge ok">{summary?.phase}</span>
          {summary?.readyForImplementation && <span className="badge ok">READY</span>}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => setModal('approve')}>次フェーズを承認…</button>
          <button className="btn danger" onClick={() => setModal('rollback')}>手戻り…</button>
        </div>
      </div>

      <div className="tabs">
        {([
          ['requirements', `Requirements (${detail.matrix.acIds.length} AC)`],
          ['design', 'Design'],
          ['tasks', `Tasks (${detail.tasks.filter((t) => !t.major).length})`],
          ['trace', 'トレーサビリティ'],
          ['docs', 'brief / research'],
        ] as [SpecTab, string][]).map(([t, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => navigate(specHash(feature, t))}>{label}</button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        {tab === 'requirements' && <RequirementsTab detail={detail} onAcClick={openPopover} />}
        {tab === 'design' && <DesignTab detail={detail} focus={designFocus} onRefClick={openPopover} />}
        {tab === 'tasks' && <TasksTab tasks={detail.tasks} focusTask={taskFocus} onRefClick={openPopover} />}
        {tab === 'trace' && <TraceTab detail={detail} focusAc={focusAc} jumpDesign={jumpToDesign} jumpTask={jumpToTask} />}
        {tab === 'docs' && <DocsTab detail={detail} />}
      </div>

      {popover && (
        <AcPopover detail={detail} popover={popover}
          onJumpDesign={jumpToDesign} onJumpTask={jumpToTask} onJumpMatrix={jumpToMatrix} />
      )}
      {modal && <ActionModal kind={modal} feature={feature} onClose={() => setModal(null)} />}
    </div>
  )
}

/** AC チップクリックで開く直接リンクメニュー */
function AcPopover({ detail, popover, onJumpDesign, onJumpTask, onJumpMatrix }: {
  detail: SpecDetail
  popover: Popover
  onJumpDesign: (rowIdx: number) => void
  onJumpTask: (taskId: string) => void
  onJumpMatrix: (acId: string) => void
}) {
  const { acId } = popover
  const cov = detail.matrix.coverage[acId] ?? { design: [], tasks: [] }
  const designRows = [...new Set(cov.design)]
  const taskIds = [...new Set(cov.tasks)]
  const ac = detail.requirements.flatMap((r) => r.criteria).find((c) => c.id === acId)
  const below = popover.y < window.innerHeight - 320
  return (
    <div className="popover" onClick={(e) => e.stopPropagation()}
      style={{ left: popover.x, ...(below ? { top: popover.y + 14 } : { bottom: window.innerHeight - popover.y + 14 }) }}>
      <div className="popover-head">
        <span className="chip plain">{acId}</span>
        <span className="popover-ac">{(ac?.ja ?? ac?.en ?? '').slice(0, 60)}</span>
      </div>
      <div className="popover-section">設計箇所へ {designRows.length === 0 && <span className="badge bad">未カバー</span>}</div>
      {designRows.map((i) => (
        <button key={i} className="popover-item" onClick={() => onJumpDesign(i)}>
          🏗 {detail.design.traceRows[i]?.summary || `Traceability row ${i + 1}`}
          <small>{detail.design.traceRows[i]?.components}</small>
        </button>
      ))}
      <div className="popover-section">タスクへ {taskIds.length === 0 && <span className="badge bad">未カバー</span>}</div>
      {taskIds.map((t) => {
        const task = detail.tasks.find((x) => x.id === t)
        return (
          <button key={t} className="popover-item" onClick={() => onJumpTask(t)}>
            {task?.done ? '☑' : '☐'} {t} {task?.title}
          </button>
        )
      })}
      <button className="popover-item matrix-link" onClick={() => onJumpMatrix(acId)}>⊞ トレーサビリティマトリクスで見る</button>
    </div>
  )
}

function RequirementsTab({ detail, onAcClick }: { detail: SpecDetail; onAcClick: (id: string, e: React.MouseEvent) => void }) {
  if (detail.requirements.length === 0) return <Fallback raw={detail.raw.requirements} label="requirements.md" />
  return (
    <div>
      <div className="note" style={{ marginBottom: 6 }}>AC 番号チップをクリックすると、紐づく設計・タスクへ直接ジャンプできます。ジャンプ後はブラウザバックで戻れます。</div>
      {detail.requirements.map((r) => (
        <div className="card req-card" key={r.id}>
          <h3><span className="chip plain">Req {r.id}</span> {r.title}</h3>
          {r.objective && <div className="objective">{r.objective}</div>}
          {r.criteria.map((c) => (
            <div className="ac" key={c.id}>
              <span className="chip" onClick={(e) => onAcClick(c.id, e)} title="紐づく設計・タスクを表示">{c.id}</span>
              <div>
                <div className="en">{c.en}</div>
                {c.ja && <div className="ja">和訳: {c.ja}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function DesignTab({ detail, focus, onRefClick }: {
  detail: SpecDetail
  focus: { rowIdx: number | null; anchor: string | null }
  onRefClick: (id: string, e: React.MouseEvent) => void
}) {
  useEffect(() => {
    const target = focus.anchor ?? (focus.rowIdx !== null ? `trace-row-${focus.rowIdx}` : null)
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }, [focus.anchor, focus.rowIdx])
  if (!detail.raw.design) return <Fallback raw={null} label="design.md" />
  return (
    <div className="viewer-grid">
      <nav className="toc card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.08em', marginBottom: 6 }}>目次</div>
        {detail.design.headings.map((h, i) => (
          <a key={i} className={`d${h.depth}`} href={`#${slug(h.text)}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(slug(h.text))?.scrollIntoView({ behavior: 'smooth' }) }}>
            {h.text}
          </a>
        ))}
      </nav>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <b style={{ fontSize: 13 }}>Requirements Traceability（構造化ビュー）</b>
          <div className="note" style={{ margin: '4px 0 8px' }}>要件 ID チップをクリックで直接リンクメニュー。残りの design 本文は下に raw markdown フォールバックで全文表示しています（情報無欠落）。</div>
          <table className="matrix">
            <thead><tr><th style={{ width: 170 }}>Requirements</th><th>Summary</th><th>Components</th></tr></thead>
            <tbody>
              {detail.design.traceRows.map((row, i) => (
                <tr key={i} id={`trace-row-${i}`} className={focus.rowIdx === i && !focus.anchor ? 'focus' : ''}>
                  <td>
                    {row.refs.map((ref) => <span key={ref} className="chip" onClick={(e) => onRefClick(ref, e)}>{ref}</span>)}
                    {row.legacyRanges.length > 0 && <div className="note">旧範囲表記 {row.legacyRanges.join(', ')} を展開</div>}
                  </td>
                  <td>{row.summary}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{row.components}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Md>{detail.raw.design}</Md>
      </div>
    </div>
  )
}

function TasksTab({ tasks, focusTask, onRefClick }: {
  tasks: TaskItem[]
  focusTask: string | null
  onRefClick: (id: string, e: React.MouseEvent) => void
}) {
  useEffect(() => {
    if (focusTask) setTimeout(() => document.getElementById(`task-${focusTask}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }, [focusTask])
  if (tasks.length === 0) return <Fallback raw={null} label="tasks.md" />
  return (
    <div className="card">
      {tasks.map((t) => (
        <div className={`task-line ${t.major ? 'major' : ''} ${t.id === focusTask ? 'focus' : ''}`} key={t.id} id={`task-${t.id}`}>
          <span>{t.done ? '☑' : '☐'}</span>
          <span className="tid">{t.id}</span>
          <span>
            {t.title} {t.parallel && <span className="badge warn">P</span>}
            {t.boundary && <span className="note"> 　_Boundary: {t.boundary}_</span>}
          </span>
          <span className="meta">
            {t.requirements.map((r) => <span key={r} className="chip" onClick={(e) => onRefClick(r, e)}>{r}</span>)}
            {t.depends.length > 0 && <span className="note"> ⇐ {t.depends.join(', ')}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function TraceTab({ detail, focusAc, jumpDesign, jumpTask }: {
  detail: SpecDetail
  focusAc: string | null
  jumpDesign: (rowIdx: number) => void
  jumpTask: (taskId: string) => void
}) {
  const m = detail.matrix
  const focusRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => { focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [focusAc])
  const covered = m.acIds.filter((id) => m.coverage[id].design.length > 0 && m.coverage[id].tasks.length > 0).length
  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="card"><b>{covered} / {m.acIds.length}</b> AC が設計・タスク両方でカバー</div>
        <div className="card">設計未カバー <b style={{ color: m.uncoveredByDesign.length ? 'var(--bad)' : 'var(--ok)' }}>{m.uncoveredByDesign.length}</b></div>
        <div className="card">タスク未カバー <b style={{ color: m.uncoveredByTasks.length ? 'var(--bad)' : 'var(--ok)' }}>{m.uncoveredByTasks.length}</b></div>
        <div className="card">リンク切れ <b style={{ color: m.brokenRefs.length ? 'var(--bad)' : 'var(--ok)' }}>{m.brokenRefs.length}</b></div>
      </div>
      {m.brokenRefs.length > 0 && (
        <div className="impact"><b>リンク切れ参照:</b> {m.brokenRefs.map((b, i) => <div key={i}>{b.source} → <span className="chip danger">{b.ref}</span></div>)}</div>
      )}
      <table className="matrix">
        <thead><tr><th style={{ width: 60 }}>AC</th><th>受け入れ基準（和訳）</th><th style={{ width: 280 }}>設計カバレッジ（クリックで設計へ）</th><th style={{ width: 160 }}>タスク（クリックでタスクへ）</th></tr></thead>
        <tbody>
          {m.acIds.map((id) => {
            const cov = m.coverage[id]
            const ac = detail.requirements.flatMap((r) => r.criteria).find((c) => c.id === id)
            const uncovered = cov.design.length === 0 || cov.tasks.length === 0
            return (
              <tr key={id} ref={id === focusAc ? focusRef : undefined}
                className={id === focusAc ? 'focus' : uncovered ? 'uncovered' : ''}>
                <td><span className="chip plain">{id}</span></td>
                <td>{ac?.ja ?? ac?.en ?? <i className="note">（AC 本文不明）</i>}</td>
                <td>
                  {cov.design.length === 0 ? <span className="badge bad">未カバー</span>
                    : [...new Set(cov.design)].map((i) => (
                      <div key={i}><a href="#" onClick={(e) => { e.preventDefault(); jumpDesign(i) }} className="note" style={{ color: 'var(--brand)' }}>
                        ・{detail.design.traceRows[i]?.summary || `row ${i + 1}`}
                      </a></div>
                    ))}
                </td>
                <td>
                  {cov.tasks.length === 0 ? <span className="badge bad">未カバー</span>
                    : [...new Set(cov.tasks)].map((t) => <span key={t} className="chip" onClick={() => jumpTask(t)}>{t}</span>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DocsTab({ detail }: { detail: SpecDetail }) {
  const [doc, setDoc] = useState<'brief' | 'research'>('brief')
  const content = detail.raw[doc]
  return (
    <div>
      <div className="lang-tabs" style={{ marginBottom: 14 }}>
        <button className={doc === 'brief' ? 'active' : ''} onClick={() => setDoc('brief')}>brief.md</button>
        <button className={doc === 'research' ? 'active' : ''} onClick={() => setDoc('research')}>research.md</button>
      </div>
      {content ? <div className="card"><Md>{content}</Md></div> : <div className="note">ファイルがありません。</div>}
    </div>
  )
}

function Fallback({ raw, label }: { raw: string | null; label: string }) {
  if (!raw) return <div className="note">{label} がありません。</div>
  return (
    <div className="card">
      <div className="badge warn" style={{ marginBottom: 8 }}>構造化パース対象外 — raw markdown 表示（情報無欠落フォールバック）</div>
      <Md>{raw}</Md>
    </div>
  )
}

function ActionModal({ kind, feature, onClose }: { kind: 'approve' | 'rollback'; feature: string; onClose: () => void }) {
  const [target, setTarget] = useState('design')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {kind === 'approve' ? (
          <>
            <h3>承認の確認 — {feature}</h3>
            <p style={{ fontSize: 13 }}>現在レビュー待ちのフェーズを承認します。承認すると spec.json の <code>approvals</code> が更新され、次フェーズへ進めます。</p>
            <div className="impact">この操作は spec.json を書き換えます。レビューを終えてから実行してください。</div>
          </>
        ) : (
          <>
            <h3>手戻り（フェーズ巻き戻し） — {feature}</h3>
            <p style={{ fontSize: 13 }}>巻き戻し先フェーズを選択してください。</p>
            <div className="row" style={{ margin: '10px 0' }}>
              {(['requirements', 'design', 'tasks'] as const).map((p) => (
                <label key={p} style={{ fontSize: 13 }}>
                  <input type="radio" name="target" checked={target === p} onChange={() => setTarget(p)} /> {p}
                </label>
              ))}
            </div>
            <div className="impact">
              <b>影響範囲:</b>
              <div className="bad-line">▸ {target} 以降の承認はすべて取り消され、再レビュー・再承認が必要になります。</div>
              <div>▸ 実行後の次アクション: <code>/kiro-spec-{target === 'requirements' ? 'requirements' : target} {feature}</code> を CLI で実行</div>
            </div>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className={`btn ${kind === 'approve' ? 'primary' : 'danger'}`}
            onClick={() => { alert(`スケルトンのため書込は未実装です。\n本実装では sdd-core の ${kind === 'approve' ? 'PUT /api/specs/:feature/approvals' : 'POST /api/specs/:feature/rollback'} を呼び出します。`); onClose() }}>
            {kind === 'approve' ? '承認する' : '巻き戻す'}
          </button>
        </div>
      </div>
    </div>
  )
}
