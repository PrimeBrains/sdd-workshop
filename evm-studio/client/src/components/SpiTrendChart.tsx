import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import type { SpiTrendPoint } from '../../../server/src/api/evm'

interface SpiTrendChartProps {
  data: SpiTrendPoint[]
}

export default function SpiTrendChart({ data }: SpiTrendChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400 text-sm">スナップショットデータがありません</div>
  }
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">SPI / CPI トレンド</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="snapshotDate" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [
              value != null ? Number(value).toFixed(3) : 'N/A',
              name ?? '',
            ]}
          />
          <Legend />
          <ReferenceLine y={1.0} stroke="#666" strokeDasharray="4 4" label={{ value: '1.0', fontSize: 10 }} />
          <Line type="monotone" dataKey="spi" stroke="#3b82f6" name="SPI" connectNulls={false} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="cpi" stroke="#f97316" name="CPI" connectNulls={false} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
