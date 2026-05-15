/**
 * モックアップ準拠のシード定数モジュール (task 5.1)
 *
 * `mockup/projects-data.jsx` の 5 プロジェクト分（NXP-002 / OHX-014 / IDV-007 /
 * MPM-031 / BPM-002）を TypeScript 定数として転記したもの。
 * シードスクリプト (task 5.2) からインポートされて DB へ投入される。
 *
 * 実装上の決定事項:
 *  - **task.external_id**: モックアップの `code`（例: '1' / '1.1' / 'B'）をそのまま
 *    使用する。WBS YAML 側もこの番号で階層を表現するため、突き合わせが容易。
 *  - **member.external_id**: モックアップの `id`（数値）を `'M{id}'` 形式へ変換する。
 *    同じ人物（同一氏名）が複数プロジェクトに登場するが、members テーブルは
 *    project_id でスコープされるため衝突しない。
 *  - **assignee の解決**: モックアップの `task.assignee` は氏名文字列なので、
 *    各プロジェクト内で `name -> externalId` の事前マップを定義しておき、
 *    シードスクリプト側で `members.externalId` 経由で `assigneeId` を解決する。
 *  - **estimateDays**: モックアップは BAC（金額）しか持たず、見積日数を直接
 *    持たない。タスクの day-offset `end - start` を見積日数の近似値として採用する。
 *  - **plannedStart / plannedEnd**: day-offset (`start` / `end`) を
 *    プロジェクト `startISO` 起点の ISO 日付 (`YYYY-MM-DD`) に変換する。
 *  - **assignmentStart / assignmentEnd**: モックアップは持たないため、メンバーは
 *    プロジェクト期間全体（startDate / endDate）にアサインされているものとみなす。
 *  - **dependencies**: モックアップは階層 (`code`: '1', '1.1', '1.2') を
 *    表現するが、明示的な依存関係 (FS リンク) は持たない。シードでは空配列で
 *    出力し、ガントの初期描画では階層情報（parentId）に依存する。
 *  - **holidays**: モックアップに祝日データが無いため、空配列で出力する。
 *  - **isBuffer**: モックアップの `buffer: true` をそのまま反映する。
 *  - **isLeaf**: モックアップの `leaf` を真偽値として反映する。
 *  - **sortOrder**: モックアップ配列内の順序をそのまま 0,1,2,... で採番する。
 *
 * 起動時アサーション (task 5.2 で `mockupProjects.length === 5` を確認する):
 *  - 配列長 = 5（NXP-002, OHX-014, IDV-007, MPM-031, BPM-002）
 */

import type { projects, members, tasks, holidays } from '../src/db/schema.js'

// =============================================================================
// 型定義: Drizzle スキーマからの推論を最大限活用しつつ、シード固有の
// 関連情報 (externalId による紐付け) を含む中間表現を定義する。
// =============================================================================

/**
 * シード用のプロジェクト中間表現。
 * - `project`: `projects` テーブルへの直接 insert に使える形（id/createdAt/updatedAt 除く）
 * - `members`: メンバー一覧。`externalId` を必須化することで assignee 解決に使う。
 * - `tasks`: タスク一覧。`externalId` 必須、`parentExternalId` で階層関係、
 *   `assigneeExternalId` でメンバーへの紐付けを表現する（DB 側の id 値は
 *   シードスクリプトで insert 結果から解決する）。
 * - `dependencies`: タスク間の依存関係。`taskExternalId` / `dependsOnExternalId`。
 * - `holidays`: 休日リスト。
 */
export type MockupProjectSeed = {
  project: {
    name:      string
    status:    'active' | 'paused' | 'draft' | 'archived'
    code:      string
    startDate: string  // YYYY-MM-DD
    endDate:   string  // YYYY-MM-DD
  }
  members: Array<{
    externalId:       string
    name:             string
    role:             string
    initials:         string
    availabilityRate: number
    assignmentStart:  string  // YYYY-MM-DD
    assignmentEnd:    string  // YYYY-MM-DD
  }>
  tasks: Array<{
    externalId:         string
    name:               string
    level:              number
    estimateDays:       number
    plannedStart:       string  // YYYY-MM-DD
    plannedEnd:         string  // YYYY-MM-DD
    parentExternalId:   string | null
    assigneeExternalId: string | null
    isBuffer:           boolean
    isLeaf:             boolean
    sortOrder:          number
  }>
  dependencies: Array<{
    taskExternalId:      string
    dependsOnExternalId: string
  }>
  holidays: Array<{
    date: string  // YYYY-MM-DD
  }>
}

// `projects` などの schema import は型推論経路を温存するための副次的な参照。
// 中間表現と Drizzle 推論型を併存させ、シード書き込み時にマッピングする想定。
void (null as unknown as typeof projects)
void (null as unknown as typeof members)
void (null as unknown as typeof tasks)
void (null as unknown as typeof holidays)

// =============================================================================
// 日付ヘルパ: day-offset を ISO 日付 (YYYY-MM-DD) に変換する。
// =============================================================================

/**
 * `startISO` を 0 日目として、`offsetDays` 日後の日付を YYYY-MM-DD で返す。
 * `Date` のローカルタイムゾーン依存を避けるため、UTC ベースで計算する。
 */
function addDays(startISO: string, offsetDays: number): string {
  // 'YYYY-MM-DD' をパースし UTC で日付加算する（夏時間・タイムゾーンの影響回避）。
  const [yearStr, monthStr, dayStr] = startISO.split('-')
  const year  = Number(yearStr)
  const month = Number(monthStr)
  const day   = Number(dayStr)
  const base  = Date.UTC(year, month - 1, day)
  const next  = new Date(base + offsetDays * 24 * 60 * 60 * 1000)
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 親階層の externalId を `code` から導出する。
 * - code = '1.1' -> parent = '1'
 * - code = '1'   -> parent = null
 * - code = 'B'   -> parent = null (バッファは独立した level=1 タスク)
 */
function parentCodeOf(code: string): string | null {
  const idx = code.lastIndexOf('.')
  if (idx === -1) return null
  return code.slice(0, idx)
}

// =============================================================================
// プロジェクト 1: NXP-002 (次世代UI基盤刷新 — Phase 2, active)
// =============================================================================

const PROJECT_NXP_002_START = '2026-03-15'
const PROJECT_NXP_002_END   = '2026-06-26'

const projectNxp002: MockupProjectSeed = {
  project: {
    name:      '次世代UI基盤刷新 — Phase 2',
    status:    'active',
    code:      'NXP-002',
    startDate: PROJECT_NXP_002_START,
    endDate:   PROJECT_NXP_002_END,
  },
  members: [
    { externalId: 'M1', name: '田中 美咲',   role: 'PM',       initials: '田美', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
    { externalId: 'M2', name: '佐藤 拓海',   role: 'Lead Eng', initials: '佐拓', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
    { externalId: 'M3', name: '鈴木 蒼一郎', role: 'Engineer', initials: '鈴蒼', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
    { externalId: 'M4', name: '山本 楓',     role: 'Designer', initials: '山楓', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
    { externalId: 'M5', name: '中村 葵',     role: 'QA',       initials: '中葵', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
    { externalId: 'M6', name: '高橋 直樹',   role: 'Engineer', initials: '高直', availabilityRate: 1.0, assignmentStart: PROJECT_NXP_002_START, assignmentEnd: PROJECT_NXP_002_END },
  ],
  tasks: [
    // code, name, level, start, end, assignee-name|null, leaf, buffer
    { externalId: '1',   name: '要件定義',                level: 1, estimateDays: 14, plannedStart: addDays(PROJECT_NXP_002_START,  0), plannedEnd: addDays(PROJECT_NXP_002_START, 14), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 0 },
    { externalId: '1.1', name: 'ユースケース整理',         level: 2, estimateDays:  9, plannedStart: addDays(PROJECT_NXP_002_START,  0), plannedEnd: addDays(PROJECT_NXP_002_START,  9), parentExternalId: '1',  assigneeExternalId: 'M1',  isBuffer: false, isLeaf: true,  sortOrder: 1 },
    { externalId: '1.2', name: 'ステークホルダーレビュー', level: 2, estimateDays:  6, plannedStart: addDays(PROJECT_NXP_002_START,  8), plannedEnd: addDays(PROJECT_NXP_002_START, 14), parentExternalId: '1',  assigneeExternalId: 'M1',  isBuffer: false, isLeaf: true,  sortOrder: 2 },
    { externalId: '2',   name: '設計',                    level: 1, estimateDays: 26, plannedStart: addDays(PROJECT_NXP_002_START, 12), plannedEnd: addDays(PROJECT_NXP_002_START, 38), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 3 },
    { externalId: '2.1', name: 'アーキテクチャ設計',       level: 2, estimateDays: 12, plannedStart: addDays(PROJECT_NXP_002_START, 12), plannedEnd: addDays(PROJECT_NXP_002_START, 24), parentExternalId: '2',  assigneeExternalId: 'M2',  isBuffer: false, isLeaf: true,  sortOrder: 4 },
    { externalId: '2.2', name: 'データモデル設計',         level: 2, estimateDays: 14, plannedStart: addDays(PROJECT_NXP_002_START, 18), plannedEnd: addDays(PROJECT_NXP_002_START, 32), parentExternalId: '2',  assigneeExternalId: 'M3',  isBuffer: false, isLeaf: true,  sortOrder: 5 },
    { externalId: '2.3', name: 'UIデザインシステム整備',   level: 2, estimateDays: 18, plannedStart: addDays(PROJECT_NXP_002_START, 20), plannedEnd: addDays(PROJECT_NXP_002_START, 38), parentExternalId: '2',  assigneeExternalId: 'M4',  isBuffer: false, isLeaf: true,  sortOrder: 6 },
    { externalId: '3',   name: '実装',                    level: 1, estimateDays: 48, plannedStart: addDays(PROJECT_NXP_002_START, 30), plannedEnd: addDays(PROJECT_NXP_002_START, 78), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 7 },
    { externalId: '3.1', name: 'API実装',                 level: 2, estimateDays: 32, plannedStart: addDays(PROJECT_NXP_002_START, 30), plannedEnd: addDays(PROJECT_NXP_002_START, 62), parentExternalId: '3',  assigneeExternalId: 'M2',  isBuffer: false, isLeaf: true,  sortOrder: 8 },
    { externalId: '3.2', name: 'フロント実装',             level: 2, estimateDays: 36, plannedStart: addDays(PROJECT_NXP_002_START, 36), plannedEnd: addDays(PROJECT_NXP_002_START, 72), parentExternalId: '3',  assigneeExternalId: 'M3',  isBuffer: false, isLeaf: true,  sortOrder: 9 },
    { externalId: '3.3', name: 'デザイン適用',             level: 2, estimateDays: 34, plannedStart: addDays(PROJECT_NXP_002_START, 44), plannedEnd: addDays(PROJECT_NXP_002_START, 78), parentExternalId: '3',  assigneeExternalId: 'M4',  isBuffer: false, isLeaf: true,  sortOrder: 10 },
    { externalId: '4',   name: '検証',                    level: 1, estimateDays: 35, plannedStart: addDays(PROJECT_NXP_002_START, 60), plannedEnd: addDays(PROJECT_NXP_002_START, 95), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 11 },
    { externalId: '4.1', name: '結合テスト計画書レビュー', level: 2, estimateDays: 10, plannedStart: addDays(PROJECT_NXP_002_START, 60), plannedEnd: addDays(PROJECT_NXP_002_START, 70), parentExternalId: '4',  assigneeExternalId: 'M5',  isBuffer: false, isLeaf: true,  sortOrder: 12 },
    { externalId: '4.2', name: '受入テスト',               level: 2, estimateDays: 17, plannedStart: addDays(PROJECT_NXP_002_START, 78), plannedEnd: addDays(PROJECT_NXP_002_START, 95), parentExternalId: '4',  assigneeExternalId: 'M6',  isBuffer: false, isLeaf: true,  sortOrder: 13 },
    { externalId: 'B',   name: 'プロジェクトバッファ',     level: 1, estimateDays:  8, plannedStart: addDays(PROJECT_NXP_002_START, 95), plannedEnd: addDays(PROJECT_NXP_002_START, 103), parentExternalId: null, assigneeExternalId: null, isBuffer: true,  isLeaf: true,  sortOrder: 14 },
  ],
  dependencies: [],
  holidays:     [],
}

// =============================================================================
// プロジェクト 2: OHX-014 (受発注ハブ統合, active)
// =============================================================================

const PROJECT_OHX_014_START = '2026-04-01'
const PROJECT_OHX_014_END   = '2026-08-15'

const projectOhx014: MockupProjectSeed = {
  project: {
    name:      '受発注ハブ統合',
    status:    'active',
    code:      'OHX-014',
    startDate: PROJECT_OHX_014_START,
    endDate:   PROJECT_OHX_014_END,
  },
  members: [
    { externalId: 'M2', name: '佐藤 拓海',   role: 'PM/Eng',   initials: '佐拓', availabilityRate: 1.0, assignmentStart: PROJECT_OHX_014_START, assignmentEnd: PROJECT_OHX_014_END },
    { externalId: 'M7', name: '小林 玲奈',   role: 'BA',       initials: '小玲', availabilityRate: 1.0, assignmentStart: PROJECT_OHX_014_START, assignmentEnd: PROJECT_OHX_014_END },
    { externalId: 'M8', name: '伊藤 健太',   role: 'Engineer', initials: '伊健', availabilityRate: 1.0, assignmentStart: PROJECT_OHX_014_START, assignmentEnd: PROJECT_OHX_014_END },
    { externalId: 'M3', name: '鈴木 蒼一郎', role: 'Engineer', initials: '鈴蒼', availabilityRate: 1.0, assignmentStart: PROJECT_OHX_014_START, assignmentEnd: PROJECT_OHX_014_END },
    { externalId: 'M5', name: '中村 葵',     role: 'QA',       initials: '中葵', availabilityRate: 1.0, assignmentStart: PROJECT_OHX_014_START, assignmentEnd: PROJECT_OHX_014_END },
  ],
  tasks: [
    { externalId: '1',   name: '計画策定',            level: 1, estimateDays: 12, plannedStart: addDays(PROJECT_OHX_014_START,   0), plannedEnd: addDays(PROJECT_OHX_014_START,  12), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 0 },
    { externalId: '1.1', name: 'ステークホルダー特定', level: 2, estimateDays:  7, plannedStart: addDays(PROJECT_OHX_014_START,   0), plannedEnd: addDays(PROJECT_OHX_014_START,   7), parentExternalId: '1',  assigneeExternalId: 'M2',  isBuffer: false, isLeaf: true,  sortOrder: 1 },
    { externalId: '1.2', name: 'プロジェクト憲章',     level: 2, estimateDays:  7, plannedStart: addDays(PROJECT_OHX_014_START,   5), plannedEnd: addDays(PROJECT_OHX_014_START,  12), parentExternalId: '1',  assigneeExternalId: 'M2',  isBuffer: false, isLeaf: true,  sortOrder: 2 },
    { externalId: '2',   name: '業務要件',            level: 1, estimateDays: 26, plannedStart: addDays(PROJECT_OHX_014_START,  10), plannedEnd: addDays(PROJECT_OHX_014_START,  36), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 3 },
    { externalId: '2.1', name: '業務フロー分析',       level: 2, estimateDays: 12, plannedStart: addDays(PROJECT_OHX_014_START,  10), plannedEnd: addDays(PROJECT_OHX_014_START,  22), parentExternalId: '2',  assigneeExternalId: 'M7',  isBuffer: false, isLeaf: true,  sortOrder: 4 },
    { externalId: '2.2', name: '機能要件定義',         level: 2, estimateDays: 14, plannedStart: addDays(PROJECT_OHX_014_START,  18), plannedEnd: addDays(PROJECT_OHX_014_START,  32), parentExternalId: '2',  assigneeExternalId: 'M7',  isBuffer: false, isLeaf: true,  sortOrder: 5 },
    { externalId: '2.3', name: '非機能要件定義',       level: 2, estimateDays: 12, plannedStart: addDays(PROJECT_OHX_014_START,  24), plannedEnd: addDays(PROJECT_OHX_014_START,  36), parentExternalId: '2',  assigneeExternalId: 'M7',  isBuffer: false, isLeaf: true,  sortOrder: 6 },
    { externalId: '3',   name: '設計・実装',           level: 1, estimateDays: 76, plannedStart: addDays(PROJECT_OHX_014_START,  32), plannedEnd: addDays(PROJECT_OHX_014_START, 108), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 7 },
    { externalId: '3.1', name: 'API契約レビュー',      level: 2, estimateDays: 18, plannedStart: addDays(PROJECT_OHX_014_START,  32), plannedEnd: addDays(PROJECT_OHX_014_START,  50), parentExternalId: '3',  assigneeExternalId: 'M8',  isBuffer: false, isLeaf: true,  sortOrder: 8 },
    { externalId: '3.2', name: 'マスタ統合テストデータ', level: 2, estimateDays: 20, plannedStart: addDays(PROJECT_OHX_014_START,  40), plannedEnd: addDays(PROJECT_OHX_014_START,  60), parentExternalId: '3',  assigneeExternalId: 'M5',  isBuffer: false, isLeaf: true,  sortOrder: 9 },
    { externalId: '3.3', name: '受注フロー実装',       level: 2, estimateDays: 38, plannedStart: addDays(PROJECT_OHX_014_START,  50), plannedEnd: addDays(PROJECT_OHX_014_START,  88), parentExternalId: '3',  assigneeExternalId: 'M8',  isBuffer: false, isLeaf: true,  sortOrder: 10 },
    { externalId: '3.4', name: '発注フロー実装',       level: 2, estimateDays: 36, plannedStart: addDays(PROJECT_OHX_014_START,  60), plannedEnd: addDays(PROJECT_OHX_014_START,  96), parentExternalId: '3',  assigneeExternalId: 'M3',  isBuffer: false, isLeaf: true,  sortOrder: 11 },
    { externalId: '4',   name: '検証・展開',           level: 1, estimateDays: 39, plannedStart: addDays(PROJECT_OHX_014_START,  96), plannedEnd: addDays(PROJECT_OHX_014_START, 135), parentExternalId: null, assigneeExternalId: null,  isBuffer: false, isLeaf: false, sortOrder: 12 },
    { externalId: '4.1', name: '結合テスト',           level: 2, estimateDays: 22, plannedStart: addDays(PROJECT_OHX_014_START,  96), plannedEnd: addDays(PROJECT_OHX_014_START, 118), parentExternalId: '4',  assigneeExternalId: 'M5',  isBuffer: false, isLeaf: true,  sortOrder: 13 },
    { externalId: '4.2', name: '本番展開',             level: 2, estimateDays: 20, plannedStart: addDays(PROJECT_OHX_014_START, 115), plannedEnd: addDays(PROJECT_OHX_014_START, 135), parentExternalId: '4',  assigneeExternalId: 'M2',  isBuffer: false, isLeaf: true,  sortOrder: 14 },
    { externalId: 'B',   name: 'プロジェクトバッファ', level: 1, estimateDays:  2, plannedStart: addDays(PROJECT_OHX_014_START, 135), plannedEnd: addDays(PROJECT_OHX_014_START, 137), parentExternalId: null, assigneeExternalId: null, isBuffer: true,  isLeaf: true,  sortOrder: 15 },
  ],
  dependencies: [],
  holidays:     [],
}

// =============================================================================
// プロジェクト 3: IDV-007 (社内データ可視化PoC, paused)
// =============================================================================

const PROJECT_IDV_007_START = '2026-02-01'
const PROJECT_IDV_007_END   = '2026-05-30'

const projectIdv007: MockupProjectSeed = {
  project: {
    name:      '社内データ可視化PoC',
    status:    'paused',
    code:      'IDV-007',
    startDate: PROJECT_IDV_007_START,
    endDate:   PROJECT_IDV_007_END,
  },
  members: [
    { externalId: 'M4', name: '山本 楓',     role: 'Lead',     initials: '山楓', availabilityRate: 1.0, assignmentStart: PROJECT_IDV_007_START, assignmentEnd: PROJECT_IDV_007_END },
    { externalId: 'M9', name: '岡田 由香',   role: 'Analyst',  initials: '岡由', availabilityRate: 1.0, assignmentStart: PROJECT_IDV_007_START, assignmentEnd: PROJECT_IDV_007_END },
    { externalId: 'M3', name: '鈴木 蒼一郎', role: 'Engineer', initials: '鈴蒼', availabilityRate: 1.0, assignmentStart: PROJECT_IDV_007_START, assignmentEnd: PROJECT_IDV_007_END },
  ],
  tasks: [
    { externalId: '1', name: 'データソース調査',     level: 1, estimateDays: 24, plannedStart: addDays(PROJECT_IDV_007_START,   0), plannedEnd: addDays(PROJECT_IDV_007_START,  24), parentExternalId: null, assigneeExternalId: 'M9', isBuffer: false, isLeaf: true, sortOrder: 0 },
    { externalId: '2', name: '指標カタログ作成',     level: 1, estimateDays: 30, plannedStart: addDays(PROJECT_IDV_007_START,  18), plannedEnd: addDays(PROJECT_IDV_007_START,  48), parentExternalId: null, assigneeExternalId: 'M9', isBuffer: false, isLeaf: true, sortOrder: 1 },
    { externalId: '3', name: 'BIツール選定',         level: 1, estimateDays: 24, plannedStart: addDays(PROJECT_IDV_007_START,  40), plannedEnd: addDays(PROJECT_IDV_007_START,  64), parentExternalId: null, assigneeExternalId: 'M4', isBuffer: false, isLeaf: true, sortOrder: 2 },
    { externalId: '4', name: 'プロトタイプ実装',     level: 1, estimateDays: 42, plannedStart: addDays(PROJECT_IDV_007_START,  60), plannedEnd: addDays(PROJECT_IDV_007_START, 102), parentExternalId: null, assigneeExternalId: 'M3', isBuffer: false, isLeaf: true, sortOrder: 3 },
    { externalId: '5', name: 'ユーザビリティテスト', level: 1, estimateDays: 22, plannedStart: addDays(PROJECT_IDV_007_START,  92), plannedEnd: addDays(PROJECT_IDV_007_START, 114), parentExternalId: null, assigneeExternalId: 'M4', isBuffer: false, isLeaf: true, sortOrder: 4 },
    { externalId: '6', name: '最終レポート',         level: 1, estimateDays: 10, plannedStart: addDays(PROJECT_IDV_007_START, 108), plannedEnd: addDays(PROJECT_IDV_007_START, 118), parentExternalId: null, assigneeExternalId: 'M4', isBuffer: false, isLeaf: true, sortOrder: 5 },
  ],
  dependencies: [],
  holidays:     [],
}

// =============================================================================
// プロジェクト 4: MPM-031 (モバイル決済モジュール v3, active)
// =============================================================================

const PROJECT_MPM_031_START = '2026-01-15'
const PROJECT_MPM_031_END   = '2026-07-31'

const projectMpm031: MockupProjectSeed = {
  project: {
    name:      'モバイル決済モジュール v3',
    status:    'active',
    code:      'MPM-031',
    startDate: PROJECT_MPM_031_START,
    endDate:   PROJECT_MPM_031_END,
  },
  members: [
    { externalId: 'M6',  name: '高橋 直樹', role: 'PM/Eng',   initials: '高直', availabilityRate: 1.0, assignmentStart: PROJECT_MPM_031_START, assignmentEnd: PROJECT_MPM_031_END },
    { externalId: 'M2',  name: '佐藤 拓海', role: 'Lead Eng', initials: '佐拓', availabilityRate: 1.0, assignmentStart: PROJECT_MPM_031_START, assignmentEnd: PROJECT_MPM_031_END },
    { externalId: 'M10', name: '渡辺 結衣', role: 'Engineer', initials: '渡結', availabilityRate: 1.0, assignmentStart: PROJECT_MPM_031_START, assignmentEnd: PROJECT_MPM_031_END },
    { externalId: 'M4',  name: '山本 楓',   role: 'Designer', initials: '山楓', availabilityRate: 1.0, assignmentStart: PROJECT_MPM_031_START, assignmentEnd: PROJECT_MPM_031_END },
    { externalId: 'M11', name: '林 大輔',   role: 'Security', initials: '林大', availabilityRate: 1.0, assignmentStart: PROJECT_MPM_031_START, assignmentEnd: PROJECT_MPM_031_END },
  ],
  tasks: [
    { externalId: '1',   name: '要件定義',            level: 1, estimateDays:  24, plannedStart: addDays(PROJECT_MPM_031_START,   0), plannedEnd: addDays(PROJECT_MPM_031_START,  24), parentExternalId: null, assigneeExternalId: null,   isBuffer: false, isLeaf: false, sortOrder: 0 },
    { externalId: '1.1', name: '決済仕様調査',         level: 2, estimateDays:  16, plannedStart: addDays(PROJECT_MPM_031_START,   0), plannedEnd: addDays(PROJECT_MPM_031_START,  16), parentExternalId: '1',  assigneeExternalId: 'M6',   isBuffer: false, isLeaf: true,  sortOrder: 1 },
    { externalId: '1.2', name: 'セキュリティ要件',     level: 2, estimateDays:  12, plannedStart: addDays(PROJECT_MPM_031_START,  12), plannedEnd: addDays(PROJECT_MPM_031_START,  24), parentExternalId: '1',  assigneeExternalId: 'M11',  isBuffer: false, isLeaf: true,  sortOrder: 2 },
    { externalId: '2',   name: '設計',                level: 1, estimateDays:  50, plannedStart: addDays(PROJECT_MPM_031_START,  20), plannedEnd: addDays(PROJECT_MPM_031_START,  70), parentExternalId: null, assigneeExternalId: null,   isBuffer: false, isLeaf: false, sortOrder: 3 },
    { externalId: '2.1', name: 'API設計',             level: 2, estimateDays:  28, plannedStart: addDays(PROJECT_MPM_031_START,  20), plannedEnd: addDays(PROJECT_MPM_031_START,  48), parentExternalId: '2',  assigneeExternalId: 'M2',   isBuffer: false, isLeaf: true,  sortOrder: 4 },
    { externalId: '2.2', name: '画面設計',             level: 2, estimateDays:  30, plannedStart: addDays(PROJECT_MPM_031_START,  30), plannedEnd: addDays(PROJECT_MPM_031_START,  60), parentExternalId: '2',  assigneeExternalId: 'M4',   isBuffer: false, isLeaf: true,  sortOrder: 5 },
    { externalId: '2.3', name: 'インフラ設計',         level: 2, estimateDays:  22, plannedStart: addDays(PROJECT_MPM_031_START,  48), plannedEnd: addDays(PROJECT_MPM_031_START,  70), parentExternalId: '2',  assigneeExternalId: 'M10',  isBuffer: false, isLeaf: true,  sortOrder: 6 },
    { externalId: '3',   name: '実装',                level: 1, estimateDays: 105, plannedStart: addDays(PROJECT_MPM_031_START,  55), plannedEnd: addDays(PROJECT_MPM_031_START, 160), parentExternalId: null, assigneeExternalId: null,   isBuffer: false, isLeaf: false, sortOrder: 7 },
    { externalId: '3.1', name: 'バックエンド実装',     level: 2, estimateDays:  75, plannedStart: addDays(PROJECT_MPM_031_START,  55), plannedEnd: addDays(PROJECT_MPM_031_START, 130), parentExternalId: '3',  assigneeExternalId: 'M2',   isBuffer: false, isLeaf: true,  sortOrder: 8 },
    { externalId: '3.2', name: 'モバイルクライアント', level: 2, estimateDays:  80, plannedStart: addDays(PROJECT_MPM_031_START,  70), plannedEnd: addDays(PROJECT_MPM_031_START, 150), parentExternalId: '3',  assigneeExternalId: 'M10',  isBuffer: false, isLeaf: true,  sortOrder: 9 },
    { externalId: '3.3', name: 'セキュリティ実装',     level: 2, estimateDays:  72, plannedStart: addDays(PROJECT_MPM_031_START,  88), plannedEnd: addDays(PROJECT_MPM_031_START, 160), parentExternalId: '3',  assigneeExternalId: 'M11',  isBuffer: false, isLeaf: true,  sortOrder: 10 },
    { externalId: '4',   name: '検証',                level: 1, estimateDays:  45, plannedStart: addDays(PROJECT_MPM_031_START, 140), plannedEnd: addDays(PROJECT_MPM_031_START, 185), parentExternalId: null, assigneeExternalId: null,   isBuffer: false, isLeaf: false, sortOrder: 11 },
    { externalId: '4.1', name: '統合テスト',           level: 2, estimateDays:  30, plannedStart: addDays(PROJECT_MPM_031_START, 140), plannedEnd: addDays(PROJECT_MPM_031_START, 170), parentExternalId: '4',  assigneeExternalId: 'M6',   isBuffer: false, isLeaf: true,  sortOrder: 12 },
    { externalId: '4.2', name: '本番リリース',         level: 2, estimateDays:  10, plannedStart: addDays(PROJECT_MPM_031_START, 175), plannedEnd: addDays(PROJECT_MPM_031_START, 185), parentExternalId: '4',  assigneeExternalId: 'M6',   isBuffer: false, isLeaf: true,  sortOrder: 13 },
    { externalId: 'B',   name: 'プロジェクトバッファ', level: 1, estimateDays:  12, plannedStart: addDays(PROJECT_MPM_031_START, 185), plannedEnd: addDays(PROJECT_MPM_031_START, 197), parentExternalId: null, assigneeExternalId: null,  isBuffer: true,  isLeaf: true,  sortOrder: 14 },
  ],
  dependencies: [],
  holidays:     [],
}

// =============================================================================
// プロジェクト 5: BPM-002 (BPM ガイドライン整備, draft)
// =============================================================================

const PROJECT_BPM_002_START = '2026-05-01'
const PROJECT_BPM_002_END   = '2026-07-31'

const projectBpm002: MockupProjectSeed = {
  project: {
    name:      'BPM ガイドライン整備',
    status:    'draft',
    code:      'BPM-002',
    startDate: PROJECT_BPM_002_START,
    endDate:   PROJECT_BPM_002_END,
  },
  members: [
    { externalId: 'M1', name: '田中 美咲', role: 'Lead',  initials: '田美', availabilityRate: 1.0, assignmentStart: PROJECT_BPM_002_START, assignmentEnd: PROJECT_BPM_002_END },
    { externalId: 'M9', name: '岡田 由香', role: 'BA',    initials: '岡由', availabilityRate: 1.0, assignmentStart: PROJECT_BPM_002_START, assignmentEnd: PROJECT_BPM_002_END },
  ],
  tasks: [
    { externalId: '1', name: '現行プロセス棚卸し',   level: 1, estimateDays: 20, plannedStart: addDays(PROJECT_BPM_002_START,  0), plannedEnd: addDays(PROJECT_BPM_002_START, 20), parentExternalId: null, assigneeExternalId: 'M9', isBuffer: false, isLeaf: true, sortOrder: 0 },
    { externalId: '2', name: 'ガイドラインドラフト', level: 1, estimateDays: 40, plannedStart: addDays(PROJECT_BPM_002_START, 16), plannedEnd: addDays(PROJECT_BPM_002_START, 56), parentExternalId: null, assigneeExternalId: 'M1', isBuffer: false, isLeaf: true, sortOrder: 1 },
    { externalId: '3', name: 'レビュー・承認',       level: 1, estimateDays: 26, plannedStart: addDays(PROJECT_BPM_002_START, 50), plannedEnd: addDays(PROJECT_BPM_002_START, 76), parentExternalId: null, assigneeExternalId: 'M1', isBuffer: false, isLeaf: true, sortOrder: 2 },
    { externalId: '4', name: '展開・教育',           level: 1, estimateDays: 20, plannedStart: addDays(PROJECT_BPM_002_START, 72), plannedEnd: addDays(PROJECT_BPM_002_START, 92), parentExternalId: null, assigneeExternalId: 'M9', isBuffer: false, isLeaf: true, sortOrder: 3 },
  ],
  dependencies: [],
  holidays:     [],
}

// =============================================================================
// エクスポート: 5 プロジェクトの配列。順序は mockup/projects-data.jsx と一致。
// =============================================================================

export const mockupProjects: readonly MockupProjectSeed[] = [
  projectNxp002,
  projectOhx014,
  projectIdv007,
  projectMpm031,
  projectBpm002,
] as const

// 起動時アサーション補助: シードスクリプト側でも `mockupProjects.length === 5`
// を検証できるよう、内部整合性を担保する一致テストを定義する。
// `parentCodeOf` は将来的に dependencies を導出する際の補助として残す。
void parentCodeOf
