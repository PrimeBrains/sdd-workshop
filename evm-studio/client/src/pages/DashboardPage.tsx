/**
 * Task 3.2: DashboardPage コンポーネント
 * Requirements: 4.1, 4.2, 4.3
 *
 * Task 5.1: 全コンポーネントを組み込み
 */

import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { useEvmCalculate } from '../hooks/useEvm'
import AlertBanner from '../components/AlertBanner'
import ProjectSummaryCards from '../components/ProjectSummaryCards'
import SpiTrendChart from '../components/SpiTrendChart'
import FeverChart from '../components/FeverChart'
import AssigneeTable from '../components/AssigneeTable'
import GanttChart from '../components/GanttChart'

// 今日の ISO 日付文字列を返す
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [baseDate, setBaseDate] = useState<string>(todayISO())

  const { data: projects } = trpc.projects.list.useQuery()
  const evmQuery = useEvmCalculate(selectedProjectId, baseDate)

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedProjectId(val ? Number(val) : null)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBaseDate(e.target.value)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">EVM ダッシュボード</h1>

      {/* プロジェクト・基準日選択 */}
      <div className="flex gap-4 mb-6">
        {/* プロジェクトセレクト */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            プロジェクト
          </label>
          <select
            value={selectedProjectId ?? ''}
            onChange={handleProjectChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">-- プロジェクトを選択 --</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* 基準日ピッカー */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            基準日
          </label>
          <input
            type="date"
            value={baseDate}
            onChange={handleDateChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* ローディングスピナー */}
      {evmQuery.isLoading && selectedProjectId && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 text-sm">計算中...</span>
        </div>
      )}

      {/* エラーメッセージ */}
      {evmQuery.isError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded text-sm">
          EVM データの取得中にエラーが発生しました: {evmQuery.error.message}
        </div>
      )}

      {/* ダッシュボードコンテンツ */}
      {evmQuery.data && (
        <div className="space-y-6">
          {/* アラートバナー */}
          <AlertBanner alerts={evmQuery.data.alerts} />

          {/* プロジェクトサマリーカード */}
          <ProjectSummaryCards summary={evmQuery.data.summary} />

          {/* SPI/CPIトレンド + フィーバーチャート（2カラム） */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpiTrendChart data={evmQuery.data.spiTrend} />
            <FeverChart data={evmQuery.data.feverChart} />
          </div>

          {/* 担当者別テーブル */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">担当者別 EVM</h3>
            <AssigneeTable assignees={evmQuery.data.assignees} />
          </div>

          {/* ガントチャート */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">ガントチャート</h2>
            <GanttChart tasks={evmQuery.data.gantt} baseDate={baseDate} />
          </div>
        </div>
      )}

      {/* プロジェクト未選択時のメッセージ */}
      {!selectedProjectId && (
        <p className="text-gray-500 text-sm">
          プロジェクトを選択してください。
        </p>
      )}
    </div>
  )
}
