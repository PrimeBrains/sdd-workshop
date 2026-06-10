import { useEffect, useState } from 'react'
import type { SpecSummary } from './api'
import { fetchJson } from './api'
import { navigate, specHash, useHashRoute } from './router'
import { Board } from './views/Board'
import { SpecViewer } from './views/SpecViewer'
import { AdrView, SkillsView, SteeringView } from './views/Knowledge'
import { Help } from './views/Help'

export function App() {
  const route = useHashRoute()
  const [specs, setSpecs] = useState<SpecSummary[]>([])
  const [lastFeature, setLastFeature] = useState('sdd-core')

  useEffect(() => { fetchJson<SpecSummary[]>('/api/specs').then(setSpecs).catch(console.error) }, [])
  useEffect(() => { if (route.feature) setLastFeature(route.feature) }, [route.feature])

  const nav = route.nav
  const feature = route.feature ?? lastFeature

  return (
    <>
      <aside className="sidebar">
        <div className="brand">SDD DASHBOARD<small>walking skeleton · sdd-workshop</small></div>
        <div className="section">WORKFLOW</div>
        <button className={nav === 'board' ? 'active' : ''} onClick={() => navigate('#/board')}>📊 パイプラインボード</button>
        <button className={nav === 'spec' ? 'active' : ''} onClick={() => navigate(specHash(feature, 'requirements'))}>📄 スペックレビュー</button>
        <div className="section">KNOWLEDGE</div>
        <button className={nav === 'steering' ? 'active' : ''} onClick={() => navigate('#/steering')}>🧭 ステアリング</button>
        <button className={nav === 'skills' ? 'active' : ''} onClick={() => navigate('#/skills')}>🛠 スキル (EN/JA)</button>
        <button className={nav === 'adr' ? 'active' : ''} onClick={() => navigate('#/adr')}>📜 ADR</button>
        <div className="section">GUIDE</div>
        <button className={nav === 'help' ? 'active' : ''} onClick={() => navigate('#/help')}>❓ cc-sdd とは</button>
      </aside>
      <main className="main">
        {nav === 'board' && <Board specs={specs} onOpen={(f) => navigate(specHash(f))} />}
        {nav === 'spec' && <SpecViewer specs={specs} feature={feature} tab={route.tab} params={route.params} />}
        {nav === 'steering' && <SteeringView />}
        {nav === 'skills' && <SkillsView />}
        {nav === 'adr' && <AdrView />}
        {nav === 'help' && <Help />}
      </main>
    </>
  )
}
