import type { Task, TaskDependency } from '../db/schema.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

export interface CriticalPathInput {
  tasks: Task[]
  dependencies: TaskDependency[]
}

export interface CriticalPathResult {
  criticalPath: number[]   // タスク ID の配列（起点から終端の順）
  terminalTaskId: number   // 終端タスクの ID（planned_end 最遅）
}

export function findCriticalPath(input: CriticalPathInput): CriticalPathResult {
  const { tasks, dependencies } = input

  // 1. is_buffer=true タスクを除外
  const activeTasks = tasks.filter(t => !t.isBuffer)

  if (activeTasks.length === 0) {
    return { criticalPath: [], terminalTaskId: -1 }
  }

  // 2. planned_end 最遅のタスクを終端として特定（同着は最初に見つかったものを選択）
  const terminalTask = activeTasks.reduce<Task>((latest, current) => {
    if (current.plannedEnd === null) return latest
    if (latest.plannedEnd === null) return current
    return current.plannedEnd > latest.plannedEnd ? current : latest
  }, activeTasks[0]!)

  const terminalTaskId = terminalTask.id

  // タスク ID → Task のマップを構築
  const taskMap = new Map<number, Task>(activeTasks.map(t => [t.id, t]))

  // 3. 終端から depends_on を逆方向にたどり、クリティカルパスを収集
  const path: number[] = []
  const visited = new Set<number>()
  let currentId: number | null = terminalTaskId

  while (currentId !== null) {
    if (visited.has(currentId)) {
      throw new AppError(
        ErrorCode.EVM_CIRCULAR_DEPENDENCY,
        `循環依存を検出しました: タスク ID ${currentId} が既に訪問済みです`,
      )
    }
    visited.add(currentId)
    path.push(currentId)

    // 現タスクの先行タスク（depends_on_task_id）を取得
    const predecessors = dependencies
      .filter(d => d.taskId === currentId)
      .map(d => taskMap.get(d.dependsOnTaskId))
      .filter((t): t is Task => t !== undefined)

    if (predecessors.length === 0) {
      // 先行なし → 起点に到達
      currentId = null
    } else {
      // planned_end 最遅の先行を選択
      const nextTask = predecessors.reduce<Task>((latest, current) => {
        if (current.plannedEnd === null) return latest
        if (latest.plannedEnd === null) return current
        return current.plannedEnd > latest.plannedEnd ? current : latest
      }, predecessors[0]!)
      currentId = nextTask.id
    }
  }

  // 4. 終端→起点の順に収集したのち reverse() して起点→終端の順にする
  path.reverse()

  return { criticalPath: path, terminalTaskId }
}
