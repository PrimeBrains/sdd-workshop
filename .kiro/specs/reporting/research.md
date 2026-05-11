# 調査ログ: reporting

## Discovery Scope

**フィーチャー種別**: Extension（既存システムへの追加）
**発見プロセス**: light discovery（統合ポイント・既存パターン重点）

---

## 主要調査結果

### 1. evm-engine との統合ポイント

**調査対象**: `.kiro/specs/evm-engine/design.md`

| 項目 | 内容 |
|------|------|
| 利用可能な関数 | `calculateEvmMetrics(EvmInput): ProjectEvmMetrics`、`evaluateAlertLevel`、`calculateFeverChart` |
| 入力型 | `EvmInput = { tasks, members, holidays, snapshots, baseDate }` |
| 出力型 | `ProjectEvmMetrics = { bac, pv, ev, ac, spi, cpi, eac, vac, etc, tcpi, taskMetrics }` |
| 設計制約 | 純粋関数・DB アクセスなし。呼び出し側がデータを渡す必要がある |
| アラートレベル型 | `'CRITICAL_DELAY' | 'WARNING_DELAY' | 'NORMAL' | 'OVERDUE' | 'NA'` |

**含意**: `report-generator.ts` は DB アクセスを API レイヤー（ReportsRouter）に委譲し、純粋関数として実装する。これにより evm-engine と同じ設計パターンを踏襲できる。

### 2. progress-tracking との統合ポイント

**調査対象**: `.kiro/specs/progress-tracking/design.md`

| 項目 | 内容 |
|------|------|
| 利用可能なプロシージャ | `progress.getByDate`・`progress.getLatest`・`progress.getHistory` |
| スナップショット型 | `ProgressSnapshot = { id, taskId, snapshotDate, progressPct, acDays, createdAt }` |
| 重要制約 | `(task_id, snapshot_date)` がユニーク制約 |
| パフォーマンス | `idx_progress_snapshots_task_date` インデックス済み |

**設計判断**: ReportsRouter は `progress.*` tRPC を呼び出さず、Drizzle で直接クエリする。理由:
- サーバーサイド処理のため tRPC クライアント経由は不要（HTTP ラウンドトリップを避ける）
- `prevDate` 自動選択（`MAX(snapshot_date) WHERE snapshot_date < ?`）は tRPC プロシージャに存在しない

### 3. 既存アーキテクチャパターン

**調査対象**: `progress-tracking/design.md`・`structure.md`・`tech.md`

| パターン | 詳細 |
|---------|------|
| API レイヤー分離 | `api/` はルーティングのみ、ビジネスロジックは `services/` に委譲 |
| tRPC 命名規則 | `reports.morning`・`reports.delayed`・`reports.summary`（動詞+名詞形式） |
| エラー変換 | `AppError` → `TRPCError` をルーター境界で変換 |
| ログルール | 個人名NG、`task_id`・`project_id`・`snapshot_date` のみ |
| Markdown ダウンロード | `dangerouslySetInnerHTML` 禁止。Blob + URL.createObjectURL パターン |

### 4. 遅延判定ロジックの確認

**ドメイン知識** (`domain.md`・プロジェクトコンテキスト):

| 条件 | 定義 |
|------|------|
| SPI ベース | `spi < 0.9`（warning 閾値と同じ） |
| 日程ベース | `planned_end < baseDate` かつ `progress_pct < 100` |
| 組み合わせ | OR 評価（どちらか一方でも遅延と判定） |
| 除外対象 | `is_buffer = true` タスク |

---

## アーキテクチャ決定

### AD-1: report-generator を純粋関数サービスとして実装する

**決定**: `report-generator.ts` は DB アクセスを持たない純粋関数のみで構成する。

**理由**: evm-engine と同じ設計パターン。テスト容易性が高く、副作用の分離が明確。DB アクセスは `api/reports.ts`（ReportsRouter）が担う。

**トレードオフ**: ReportsRouter が複数テーブルをクエリする責任を持つため、ルーターコードがやや厚くなる。ただし `api/` の責任範囲内（ルーティング＋DB アクセス集約）。

### AD-2: Markdown 生成に外部ライブラリを使用しない

**決定**: 文字列テンプレートのみで Markdown を生成する。

**理由**: EVM Studio は決定論的ビジネスロジックに集中するプロジェクト（tech.md の方針）。Markdown 生成に外部ライブラリを追加するコストは ROI が低い。テンプレートは Vitest でシンプルにテスト可能。

### AD-3: prevDate 自動選択をサーバーサイドで処理する

**決定**: `reports.morning` で `prevDate` が省略された場合、Drizzle で `SELECT MAX(snapshot_date) WHERE snapshot_date < ?` を実行してサーバーサイドで解決する。

**理由**: クライアントに余分なクエリを要求しない。ユーザーは「前日と比較」という意図を持つが、毎日スナップショットが存在するとは限らない。

---

## リスクと軽減策

| リスク | 軽減策 |
|--------|--------|
| スナップショットが存在しない日付を指定 | `REPORT_NO_SNAPSHOT` エラーで明示的にフィードバック |
| `prevDate` 自動選択時にスナップショットが一件もない（初回実行時） | `prevDate` が見つからない場合は空のスナップショット配列で計算（デルタは 0）|
| Markdown が長大になりブラウザ表示が重くなる | `<pre>` タグで単純表示。将来的に仮想スクロール対応 |
