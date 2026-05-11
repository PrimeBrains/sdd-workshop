# EVM Domain Knowledge

EVM（Earned Value Management）はプロジェクトのスコープ・スケジュール・コストを統合的に管理する手法。
EVM Studio が扱うデータモデルと計算ロジックの定義をここに記述する。

## コアメトリクス

| 指標 | 英語名 | 定義 |
|------|--------|------|
| PV | Planned Value | 基準日時点で「完了しているはずだった」計画工数の累積 |
| EV | Earned Value | 基準日時点で「実際に完了した」作業の計画工数換算値 |
| AC | Actual Cost | 基準日時点で「実際に投入した」工数の累積 |
| BAC | Budget at Completion | プロジェクト全体の計画工数合計 |

## 計算式

```
SPI  = EV / PV          # スケジュール効率（1.0 = 計画通り）
CPI  = EV / AC          # コスト効率（1.0 = 計画通り）
EAC  = BAC / SPI        # 現在の効率が続いた場合の最終工数予測
VAC  = BAC - EAC        # コスト差異（予測）
ETC  = EAC - AC         # 残り必要工数
TCPI = (BAC - EV) / (BAC - AC)  # 残作業の必要効率
```

### PV の算出方法
タスクの計画工数を担当者の稼働率と休日を考慮して日次に配賦し、累積する。

```
日次 PV = タスク計画工数 × (担当者稼働率 / タスク期間営業日数)
累積 PV = Σ(基準日までの日次 PV)
```

### EV の算出方法
```
タスク EV = タスク BAC × タスク完了率(0〜100%)
累積 EV  = Σ(全タスクの EV)
```

### SPI の特殊ケース
- PV = 0（プロジェクト開始前）: SPI は `null`（算出不能）
- EV > PV（前倒し進捗）: SPI > 1.0（正常値として扱う）

## アラート閾値

| 状態 | 条件 | 表示 |
|------|------|------|
| critical | SPI < 0.8 | 赤 |
| warning | 0.8 ≤ SPI < 0.9 | 黄 |
| normal | SPI ≥ 0.9 | 緑 |
| N/A | PV = 0 | グレー |

## データモデル概要

### Project
プロジェクトの基本情報。開始日・終了日・BAC を持つ。

### Task
WBS のタスクノード。階層構造（parent_id）を持ち、以下のフィールドが重要：
- `estimate_days`: 計画工数（BAC に相当）
- `planned_start` / `planned_end`: 計画期間
- `depends_on`: タスク依存関係（クリティカルパス計算に使用）

### Member
担当者。`availability_rate`（0.0〜1.0）と `assignment_start` / `assignment_end` を持つ。

### ProgressSnapshot
日次の進捗記録。`snapshot_date` + `task_id` + `progress_pct` + `ac_days` で構成される。

## バッファ管理（クリティカルチェーン）

CCPM（Critical Chain Project Management）の考え方に基づくバッファ管理。
WBS の末尾にバッファタスクを置き、バッファ消費率とクリティカルチェーン完了率の関係をフィーバーチャートで監視する。

### バッファタスク
- WBS 上で `is_buffer = true` のフラグを持つ特別なタスク
- スコープ作業ではなく「スケジュールの余裕」を表す
- EVM 計算（EV/SPI 等）の対象から除外する

### 主要計算式

```
バッファ消費率 = クリティカルチェーンの累積遅延日数 / バッファ総日数

クリティカルチェーン完了率 = クリティカルチェーン上の完了 EV / クリティカルチェーン BAC

フィーバーチャート座標 = (クリティカルチェーン完了率, バッファ消費率)
```

### フィーバーチャートのゾーン判定

| ゾーン | 条件 | 意味 |
|--------|------|------|
| Green（安全） | 消費率 < 完了率 × 0.67 | バッファに余裕あり |
| Yellow（警戒） | 完了率 × 0.67 ≤ 消費率 < 完了率 × 1.0 | バッファ消費ペースに注意 |
| Red（危険） | 消費率 ≥ 完了率 × 1.0 | 対策が必要 |

### クリティカルチェーンの特定
- タスク依存関係（`depends_on`）グラフのトポロジカルソートで最長経路を計算
- バッファタスクはクリティカルチェーンから除外

---

## wbs-YAML ↔ EVM Studio フィールド対応

| wbs-YAML フィールド | EVM Studio DB | 補足 |
|-------------------|-------------|------|
| `tasks[].id` | `Task.external_id` | wbs-* スキルが生成する "T001" 形式 |
| `tasks[].title` | `Task.name` | |
| `tasks[].estimate_days` | `Task.estimate_days` | BAC に相当 |
| `tasks[].planned_start` | `Task.planned_start` | |
| `tasks[].planned_end` | `Task.planned_end` | |
| `tasks[].parent_id` | `Task.parent_id` | `external_id` から DB の `id` に解決 |
| `tasks[].depends_on[]` | `TaskDependency` テーブル | クリティカルパス計算用 |
| `tasks[].assignee` | `Task.assignee_id` | メンバー ID（"M001"）から DB の `id` に解決 |
| `tasks[].actual_start` | `Task.actual_start` | |
| `tasks[].actual_end` | `Task.actual_end` | |
| `tasks[].progress_pct` | `ProgressSnapshot.progress_pct` | インポート時は初回スナップショットとして記録 |
| `staffing.members[].id` | `Member.external_id` | |
| `staffing.members[].name` | `Member.name` | |
| `staffing.members[].availability_rate` | `Member.availability_rate` | 0.0〜1.0 |
| `staffing.members[].assignment_start` | `Member.assignment_start` | |
| `staffing.members[].assignment_end` | `Member.assignment_end` | |
| `staffing.meta.public_holidays[]` | `Holiday` テーブル | |
| `schedule.meta.schedule_start` | `Project.start_date` | |
| `schedule.meta.schedule_end` | `Project.end_date` | |

---

## xlsm（evmtools-node）↔ EVM Studio フィールド対応

xlsm インポートを将来実装する際の対応表。インターフェース互換性のために維持する。

| xlsm / TaskRow フィールド | EVM Studio DB | 補足 |
|--------------------------|-------------|------|
| `id`（行内連番） | `Task.external_id` | xlsm 固有の数値 ID |
| `sharp`（# 列） | `Task.sort_order` | 表示順 |
| `level` | `Task.level` | 階層深度（1=ルート） |
| `name` | `Task.name` | |
| `assignee` | `Member.name` → `Task.assignee_id` | 名前でメンバーを解決 |
| `workload`（予定工数） | `Task.estimate_days` | BAC 相当 |
| `startDate`（予定開始日） | `Task.planned_start` | |
| `endDate`（予定終了日） | `Task.planned_end` | |
| `actualStartDate` | `Task.actual_start` | |
| `actualEndDate` | `Task.actual_end` | |
| `progressRate`（0〜1） | `ProgressSnapshot.progress_pct` | × 100 で % 変換 |
| `scheduledWorkDays` | PV 計算に使用（DB には保存しない） | plotMap から計算済み |
| `remarks` | `Task.remarks` | |
| `parentId` | `Task.parent_id` | |
| `isLeaf` | `Task.is_leaf` | 集計の二重カウント防止に使用 |
| `plotMap`（日付×bool） | PV 計算に使用（DB には保存しない） | インポート時に PV を事前計算して保存 |
| Project `name` | `Project.name` | |
| Project `startDate` | `Project.start_date` | |
| Project `endDate` | `Project.end_date` | |
| Project `baseDate` | `ProgressSnapshot.snapshot_date` | xlsm スナップショット日 |
