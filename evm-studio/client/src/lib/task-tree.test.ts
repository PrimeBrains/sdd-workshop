/**
 * Task 4.2a: deriveAncestors の単体テスト
 * Requirements: 8.2
 */

import { describe, it, expect } from 'vitest'
import { deriveAncestors } from './task-tree'
import type { TaskEvm } from '@/types/workbench'

/** テスト用 TaskEvm ファクトリ */
function makeTask(partial: Partial<TaskEvm> & Pick<TaskEvm, 'id' | 'code' | 'name'>): TaskEvm {
  return {
    level: partial.code.split('.').length,
    start: 0,
    end: 1,
    progress: 0,
    spi: null,
    assignee: null,
    leaf: false,
    bac: 0,
    ...partial,
  }
}

describe('deriveAncestors', () => {
  const all: ReadonlyArray<TaskEvm> = [
    makeTask({ id: 1, code: '1', name: '要件定義' }),
    makeTask({ id: 2, code: '1.1', name: '要件整理' }),
    makeTask({ id: 3, code: '1.1.1', name: 'ヒアリング' }),
    makeTask({ id: 4, code: '1.2', name: 'EARS 化' }),
    makeTask({ id: 5, code: '2', name: '設計' }),
  ]

  it('ルートタスクは空配列を返す', () => {
    const task = all.find((t) => t.code === '1')!
    expect(deriveAncestors(task, all)).toEqual([])
  })

  it('中間タスクは祖先 1 件を返す', () => {
    const task = all.find((t) => t.code === '1.1')!
    expect(deriveAncestors(task, all)).toEqual([{ id: 1, name: '要件定義' }])
  })

  it('葉タスクは祖先を複数件返す（ルート → 親 の順）', () => {
    const task = all.find((t) => t.code === '1.1.1')!
    expect(deriveAncestors(task, all)).toEqual([
      { id: 1, name: '要件定義' },
      { id: 2, name: '要件整理' },
    ])
  })

  it('一致しないプレフィックスはスキップする（祖先欠落に安全）', () => {
    const orphans: ReadonlyArray<TaskEvm> = [
      makeTask({ id: 10, code: '3.2.1', name: 'orphan leaf' }),
      // '3' / '3.2' は存在しない
    ]
    expect(deriveAncestors(orphans[0]!, orphans)).toEqual([])
  })
})
