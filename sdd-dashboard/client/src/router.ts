import { useSyncExternalStore } from 'react'

export type Nav = 'board' | 'spec' | 'steering' | 'skills' | 'adr' | 'help'
export type SpecTab = 'requirements' | 'design' | 'tasks' | 'trace' | 'docs'

export interface Route {
  nav: Nav
  feature: string | null
  tab: SpecTab
  params: URLSearchParams
}

const NAVS: Nav[] = ['board', 'spec', 'steering', 'skills', 'adr', 'help']
const TABS: SpecTab[] = ['requirements', 'design', 'tasks', 'trace', 'docs']

export function parseHash(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, '').split('?')
  const seg = path.split('/').filter(Boolean)
  const params = new URLSearchParams(query ?? '')
  const nav = NAVS.includes(seg[0] as Nav) ? (seg[0] as Nav) : 'board'
  if (nav === 'spec') {
    const tab = TABS.includes(seg[2] as SpecTab) ? (seg[2] as SpecTab) : 'requirements'
    return { nav, feature: seg[1] ?? null, tab, params }
  }
  return { nav, feature: null, tab: 'requirements', params }
}

/** location.hash へ反映する。同一ハッシュなら履歴を積まない */
export function navigate(hash: string): void {
  if (window.location.hash !== hash) window.location.hash = hash
}

export const specHash = (feature: string, tab: SpecTab = 'requirements', params?: Record<string, string>): string => {
  const q = params ? '?' + new URLSearchParams(params).toString() : ''
  return `#/spec/${feature}/${tab}${q}`
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}
