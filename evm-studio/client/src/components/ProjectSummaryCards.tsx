import type { EvmSummaryOutput } from '../../../server/src/api/evm'

interface ProjectSummaryCardsProps {
  summary: EvmSummaryOutput
}

function spiColor(spi: number | null): string {
  if (spi === null) return 'bg-gray-100'
  if (spi < 0.8) return 'bg-red-100 border-red-300'
  if (spi < 0.9) return 'bg-yellow-100 border-yellow-300'
  return 'bg-green-100 border-green-300'
}

function fmt(v: number | null, digits = 2): string {
  if (v === null) return 'N/A'
  return v.toFixed(digits)
}

export default function ProjectSummaryCards({ summary }: ProjectSummaryCardsProps) {
  const cards = [
    { label: 'BAC', value: fmt(summary.bac, 1) },
    { label: 'PV', value: fmt(summary.pv, 1) },
    { label: 'EV', value: fmt(summary.ev, 1) },
    { label: 'AC', value: fmt(summary.ac, 1) },
    { label: 'SPI', value: fmt(summary.spi), extra: spiColor(summary.spi) },
    { label: 'CPI', value: fmt(summary.cpi), extra: spiColor(summary.cpi) },
    { label: 'EAC', value: fmt(summary.eac, 1) },
    { label: 'VAC', value: fmt(summary.vac, 1) },
    { label: 'ETC', value: fmt(summary.etc, 1) },
    { label: 'TCPI', value: fmt(summary.tcpi) },
  ]
  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {cards.map(card => (
        <div key={card.label} className={`p-3 rounded-lg border text-center ${card.extra ?? 'bg-white border-gray-200'}`}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</div>
          <div className="text-lg font-bold mt-1">{card.value}</div>
        </div>
      ))}
    </div>
  )
}
