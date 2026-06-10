import { useEffect, useState } from 'react'
import type { AdrDoc, SkillDoc, SteeringFile } from '../api'
import { fetchJson } from '../api'
import { Md } from '../Md'

export function SteeringView() {
  const [files, setFiles] = useState<SteeringFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { fetchJson<SteeringFile[]>('/api/steering').then((f) => { setFiles(f); setSelected(f[0]?.name ?? null) }) }, [])
  const current = files.find((f) => f.name === selected)
  return (
    <div>
      <h1 className="page-title">ステアリング</h1>
      <div className="page-sub">プロジェクト全体の規約・コンテキスト（.kiro/steering/）。AI はこれを毎セッション読み込みます。</div>
      <div className="k-grid">
        <div className="k-list card" style={{ padding: 8 }}>
          {files.map((f) => (
            <button key={f.name} className={f.name === selected ? 'active' : ''} onClick={() => setSelected(f.name)}>{f.name}</button>
          ))}
        </div>
        <div className="card">{current?.content ? <Md>{current.content}</Md> : <div className="note">選択してください</div>}</div>
      </div>
    </div>
  )
}

const ORIGIN_LABEL: Record<string, string> = { 'cc-sdd': 'cc-sdd 標準', custom: '独自スキル' }

function groupSkillsByOrigin(skills: SkillDoc[]): [string, SkillDoc[]][] {
  const groups = new Map<string, SkillDoc[]>()
  for (const s of skills) {
    const key = ORIGIN_LABEL[s.origin ?? ''] ?? '（未分類）'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  // cc-sdd 標準 → 独自スキル → 未分類 の順
  const order = ['cc-sdd 標準', '独自スキル', '（未分類）']
  return [...groups.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
}

export function SkillsView() {
  const [skills, setSkills] = useState<SkillDoc[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [lang, setLang] = useState<'ja' | 'en'>('ja')
  useEffect(() => { fetchJson<SkillDoc[]>('/api/skills').then((s) => { setSkills(s); setSelected(s[0]?.name ?? null) }) }, [])
  const current = skills.find((s) => s.name === selected)
  const content = lang === 'ja' ? current?.ja ?? current?.en : current?.en
  return (
    <div>
      <h1 className="page-title">スキル</h1>
      <div className="page-sub">開発フローを構成するコマンド群（.claude/skills/）。frontmatter の metadata.origin で cc-sdd 標準と独自スキルを区別。英/日タブ切替。</div>
      <div className="k-grid">
        <div className="k-list card" style={{ padding: 8 }}>
          {groupSkillsByOrigin(skills).map(([label, group]) => (
            <div key={label}>
              <div className="k-group">{label === 'cc-sdd 標準' ? '🏛' : '🔧'} {label}（{group.length}）</div>
              {group.map((s) => (
                <button key={s.name} className={s.name === selected ? 'active' : ''} onClick={() => setSelected(s.name)}>
                  /{s.name} {s.ja ? '' : ' (EN only)'}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span>
              <b style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>/{current?.name}</b>{' '}
              <span className={`badge ${current?.origin === 'custom' ? 'warn' : 'gray'}`}>{ORIGIN_LABEL[current?.origin ?? ''] ?? '未分類'}</span>
            </span>
            <div className="lang-tabs">
              <button className={lang === 'ja' ? 'active' : ''} onClick={() => setLang('ja')}>日本語</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
            </div>
          </div>
          {content ? <Md>{content}</Md> : <div className="note">SKILL.md がありません</div>}
        </div>
      </div>
    </div>
  )
}

const STATUS_CLS: Record<string, string> = { accepted: 'ok', proposed: 'warn', deprecated: 'gray', superseded: 'bad' }

function groupAdrsByApp(adrs: AdrDoc[]): [string, AdrDoc[]][] {
  const groups = new Map<string, AdrDoc[]>()
  for (const a of adrs) {
    const app = typeof a.meta.app === 'string' ? a.meta.app : '（リポジトリ横断）'
    if (!groups.has(app)) groups.set(app, [])
    groups.get(app)!.push(a)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function AdrView() {
  const [adrs, setAdrs] = useState<AdrDoc[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { fetchJson<AdrDoc[]>('/api/adr').then((a) => { setAdrs(a); setSelected(a[0]?.file ?? null) }) }, [])
  const current = adrs.find((a) => a.file === selected)
  return (
    <div>
      <h1 className="page-title">ADR — アーキテクチャ決定記録</h1>
      <div className="page-sub">複数スペックに影響する決定の記録（.kiro/adr/）。frontmatter の app でアプリ単位にグルーピング。</div>
      <div className="k-grid">
        <div className="k-list card" style={{ padding: 8 }}>
          {groupAdrsByApp(adrs).map(([app, group]) => (
            <div key={app}>
              <div className="k-group">📦 {app}</div>
              {group.map((a) => (
                <button key={a.file} className={a.file === selected ? 'active' : ''} onClick={() => setSelected(a.file)}>
                  <span className={`badge ${STATUS_CLS[String(a.meta.status)] ?? 'gray'}`}>{String(a.meta.status ?? '?')}</span>{' '}
                  {String(a.meta.title ?? a.file)}
                  <span className="note" style={{ display: 'block' }}>{String(a.meta.date ?? '')}</span>
                </button>
              ))}
            </div>
          ))}
          {adrs.length === 0 && <div className="note" style={{ padding: 8 }}>ADR はまだありません</div>}
        </div>
        {current && (
          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <span className={`badge ${STATUS_CLS[String(current.meta.status)] ?? 'gray'}`}>{String(current.meta.status)}</span>
              <span className="note">{String(current.meta.date ?? '')}</span>
              {Array.isArray(current.meta.specs) && (current.meta.specs as string[]).map((s) => <span key={s} className="chip plain">{s}</span>)}
            </div>
            <Md>{current.body}</Md>
          </div>
        )}
      </div>
    </div>
  )
}
