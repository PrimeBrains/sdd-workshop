import type { AlertOutput } from '../../../server/src/api/evm'

interface AlertBannerProps {
  alerts: AlertOutput[]
}

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => (
        <div
          key={alert.taskId}
          className={`p-3 rounded-lg flex items-center gap-4 text-sm ${
            alert.level === 'critical'
              ? 'bg-red-100 text-red-800 border border-red-300'
              : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
          }`}
        >
          <span className="font-semibold">{alert.level === 'critical' ? 'CRITICAL' : 'WARNING'}</span>
          <span className="font-medium">{alert.taskName}</span>
          <span className="text-gray-600">担当: {alert.assigneeName}</span>
          <span>SPI: {alert.spi !== null ? alert.spi.toFixed(2) : 'N/A'}</span>
        </div>
      ))}
    </div>
  )
}
