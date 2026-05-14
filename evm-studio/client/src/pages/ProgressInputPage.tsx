/**
 * Task 4.1–4.2: ProgressInputPage コンポーネント
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import { useState, useEffect } from 'react'
import {
  useProjects,
  useTasksByProject,
  useProgressByDate,
  useRecordProgress,
} from '../hooks/useProgress'

// 今日の ISO 日付文字列を返す
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RowInput {
  progressPct: string
  acDays: string
}

interface RowErrors {
  progressPct?: string
  acDays?: string
}

export default function ProgressInputPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [inputs, setInputs] = useState<Record<number, RowInput>>({})
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data: projects } = useProjects()
  const { data: taskList } = useTasksByProject(selectedProjectId)
  const { data: existingSnapshots } = useProgressByDate(selectedProjectId, selectedDate)
  const recordMutation = useRecordProgress()

  // is_leaf=true のタスクのみ
  const leafTasks = taskList?.filter((t) => t.isLeaf) ?? []

  // 既存スナップショットを inputs の初期値に設定（要件 5.8）
  useEffect(() => {
    if (!existingSnapshots) return
    setInputs((prev) => {
      const next = { ...prev }
      for (const snap of existingSnapshots) {
        if (!(snap.taskId in next)) {
          next[snap.taskId] = {
            progressPct: String(snap.progressPct),
            acDays: String(snap.acDays),
          }
        }
      }
      return next
    })
  }, [existingSnapshots])

  // プロジェクトまたは日付が変わったら inputs と errors をリセット
  useEffect(() => {
    setInputs({})
    setRowErrors({})
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [selectedProjectId, selectedDate])

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedProjectId(val ? Number(val) : null)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDate(e.target.value)
  }

  function handleInputChange(
    taskId: number,
    field: 'progressPct' | 'acDays',
    value: string,
  ) {
    setInputs((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? { progressPct: '', acDays: '' }),
        [field]: value,
      },
    }))
    // 入力変更時にエラーをクリア
    setRowErrors((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? {}),
        [field]: undefined,
      },
    }))
  }

  function validate(): boolean {
    const newErrors: Record<number, RowErrors> = {}
    let valid = true

    for (const task of leafTasks) {
      const row = inputs[task.id]
      if (!row) continue

      const errors: RowErrors = {}
      const pct = Number(row.progressPct)
      const ac = Number(row.acDays)

      if (row.progressPct !== '') {
        if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
          errors.progressPct = '0〜100 の整数を入力してください'
          valid = false
        }
      }

      if (row.acDays !== '') {
        if (isNaN(ac) || ac < 0) {
          errors.acDays = '0 以上の数値を入力してください'
          valid = false
        }
      }

      if (Object.keys(errors).length > 0) {
        newErrors[task.id] = errors
      }
    }

    setRowErrors(newErrors)
    return valid
  }

  async function handleSave() {
    if (!selectedProjectId || !selectedDate) return
    if (!validate()) return

    setSuccessMessage(null)
    setErrorMessage(null)

    // 入力のあるタスクのみ送信
    const mutations = leafTasks
      .filter((task) => {
        const row = inputs[task.id]
        return row && (row.progressPct !== '' || row.acDays !== '')
      })
      .map((task) => {
        const row = inputs[task.id]!
        return recordMutation.mutateAsync({
          taskId: task.id,
          snapshotDate: selectedDate,
          progressPct: row.progressPct !== '' ? Number(row.progressPct) : 0,
          acDays: row.acDays !== '' ? Number(row.acDays) : 0,
        })
      })

    if (mutations.length === 0) {
      setErrorMessage('保存するデータがありません。')
      return
    }

    try {
      await Promise.all(mutations)
      setSuccessMessage('進捗データを保存しました。')
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました。'
      setErrorMessage(`保存中にエラーが発生しました: ${message}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">進捗入力</h1>

      {/* 成功メッセージ（要件 5.4） */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 rounded">
          {successMessage}
        </div>
      )}

      {/* エラーメッセージ（要件 5.5） */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded">
          {errorMessage}
        </div>
      )}

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

        {/* 日付インプット */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            スナップショット日
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* タスクテーブル */}
      {selectedProjectId && leafTasks.length > 0 && (
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-3 py-2 border border-gray-300 font-medium">
                  タスク名
                </th>
                <th className="text-left px-3 py-2 border border-gray-300 font-medium w-36">
                  進捗率 (0-100)
                </th>
                <th className="text-left px-3 py-2 border border-gray-300 font-medium w-36">
                  実績工数 (日)
                </th>
              </tr>
            </thead>
            <tbody>
              {leafTasks.map((task) => {
                const row = inputs[task.id] ?? { progressPct: '', acDays: '' }
                const errors = rowErrors[task.id] ?? {}

                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 border border-gray-300">{task.name}</td>
                    <td className="px-3 py-2 border border-gray-300">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.progressPct}
                        onChange={(e) =>
                          handleInputChange(task.id, 'progressPct', e.target.value)
                        }
                        placeholder="0"
                        className={`w-full border rounded px-2 py-1 text-sm ${
                          errors.progressPct
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                        }`}
                      />
                      {/* バリデーションエラー（要件 5.6） */}
                      {errors.progressPct && (
                        <p className="text-red-600 text-xs mt-1">{errors.progressPct}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-gray-300">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={row.acDays}
                        onChange={(e) =>
                          handleInputChange(task.id, 'acDays', e.target.value)
                        }
                        placeholder="0"
                        className={`w-full border rounded px-2 py-1 text-sm ${
                          errors.acDays
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                        }`}
                      />
                      {/* バリデーションエラー（要件 5.7） */}
                      {errors.acDays && (
                        <p className="text-red-600 text-xs mt-1">{errors.acDays}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedProjectId && leafTasks.length === 0 && (
        <p className="text-gray-500 text-sm mb-6">
          入力可能なリーフタスクがありません。
        </p>
      )}

      {/* 保存ボタン */}
      <button
        onClick={() => void handleSave()}
        disabled={recordMutation.isPending}
        className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {recordMutation.isPending ? '保存中...' : '保存'}
      </button>
    </div>
  )
}
