import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { FeverChartOutput } from '../../../server/src/api/evm'

interface FeverChartProps {
  data: FeverChartOutput | null
}

const zoneColor = { GREEN: '#16a34a', YELLOW: '#eab308', RED: '#dc2626' }
const zoneLabel = { GREEN: '正常 (GREEN)', YELLOW: '注意 (YELLOW)', RED: '危険 (RED)' }

export default function FeverChart({ data }: FeverChartProps) {
  if (data === null) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 h-64 flex items-center justify-center">
        <p className="text-gray-400 text-sm">バッファデータなし</p>
      </div>
    )
  }

  const color = zoneColor[data.zone]
  const scatterData = [{ x: data.criticalChainCompletion, y: data.bufferConsumption }]

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">CCPM フィーバーチャート</h3>
      <div className="mb-2 text-sm font-medium" style={{ color }}>
        ステータス: {zoneLabel[data.zone]}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 1]}
            label={{ value: 'クリティカルチェーン完了率', position: 'insideBottom', offset: -10, fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 1]}
            label={{ value: 'バッファ消費率', angle: -90, position: 'insideLeft', fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? (value * 100).toFixed(1) + '%' : String(value),
              name === 'x' ? 'CC完了率' : 'バッファ消費',
            ]}
          />
          <Scatter data={scatterData} fill={color} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
