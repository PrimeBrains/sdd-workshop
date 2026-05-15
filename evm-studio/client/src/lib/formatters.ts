export const fmtMD = (n: number) => (n / 1_000_000).toFixed(1) + ' MD'
export const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
export const fmtNum = (n: number | null, d: number = 2) => n == null ? 'N/A' : n.toFixed(d)
export const fmtSignedMD = (n: number) =>
  (n >= 0 ? '+' : '−') + (Math.abs(n) / 1_000_000).toFixed(1) + ' MD'
export const fmtDeltaIdx = (d: number) =>
  d === 0 ? '±0.00' : (d > 0 ? '▲' : '▼') + Math.abs(d).toFixed(2)
export const fmtDeltaMD = (d: number) =>
  d === 0 ? '±0.0 MD' : (d > 0 ? '+' : '−') + (Math.abs(d) / 1_000_000).toFixed(1) + ' MD'
export const fmtDeltaPct = (d: number) =>
  d === 0 ? '±0pp' : (d > 0 ? '+' : '−') + Math.abs(d) + 'pp'

export type Tone = 'normal' | 'warning' | 'critical' | 'na' | 'brand'

export const deltaTone = (d: number, posGood: boolean = true): Tone =>
  d === 0 ? 'na' : (d > 0) === posGood ? 'normal' : 'critical'

export const statusColor = (s: Tone) =>
  s === 'critical' ? '#b8482e'
  : s === 'warning' ? '#c89a2d'
  : s === 'normal' ? '#5d8a3a'
  : '#9a958a'

export const spiTone = (spi: number | null): Tone =>
  spi == null ? 'na' : spi < 0.8 ? 'critical' : spi < 0.9 ? 'warning' : 'normal'

export const statusJp = (s: string) =>
  ({ active: '稼働中', paused: '一時停止', draft: '計画中', archived: 'アーカイブ' } as Record<string, string>)[s] ?? s

export const initialsOf = (name: string | null) =>
  name ? Array.from(name).filter(c => c !== ' ' && c !== '　').slice(0, 2).join('') : ''

export const dateOffsetToISO = (startISO: string, offset: number): string => {
  const [y, m, d] = startISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + offset))
  return dt.toISOString().slice(0, 10)
}
