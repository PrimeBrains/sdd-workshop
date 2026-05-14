import type { AssigneeEvmOutput } from '../../../server/src/api/evm'

interface AssigneeTableProps {
  assignees: AssigneeEvmOutput[]
}

const rowColor = {
  critical: 'bg-red-50',
  warning:  'bg-yellow-50',
  normal:   'bg-green-50',
  na:       '',
}

function fmt(v: number | null, d = 2): string {
  return v !== null ? v.toFixed(d) : 'N/A'
}

export default function AssigneeTable({ assignees }: AssigneeTableProps) {
  if (assignees.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">担当者データがありません</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-4 py-2 text-left font-semibold">担当者</th>
            <th className="px-4 py-2 text-right font-semibold">BAC</th>
            <th className="px-4 py-2 text-right font-semibold">EV</th>
            <th className="px-4 py-2 text-right font-semibold">PV</th>
            <th className="px-4 py-2 text-right font-semibold">SPI</th>
            <th className="px-4 py-2 text-right font-semibold">AC</th>
            <th className="px-4 py-2 text-right font-semibold">CPI</th>
            <th className="px-4 py-2 text-center font-semibold">ステータス</th>
          </tr>
        </thead>
        <tbody>
          {assignees.map(a => (
            <tr key={a.assigneeId} className={`border-b ${rowColor[a.status]}`}>
              <td className="px-4 py-2">{a.assigneeName}</td>
              <td className="px-4 py-2 text-right">{fmt(a.bac, 1)}</td>
              <td className="px-4 py-2 text-right">{fmt(a.ev, 1)}</td>
              <td className="px-4 py-2 text-right">{fmt(a.pv, 1)}</td>
              <td className="px-4 py-2 text-right">{fmt(a.spi)}</td>
              <td className="px-4 py-2 text-right">{fmt(a.ac, 1)}</td>
              <td className="px-4 py-2 text-right">{fmt(a.cpi)}</td>
              <td className="px-4 py-2 text-center uppercase text-xs font-semibold">{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
