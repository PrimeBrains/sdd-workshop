# Research & Design Decisions: dashboard

## Summary

- **Feature**: `dashboard`
- **Discovery Scope**: New Feature（グリーンフィールド — UI コンポーネントと tRPC エンドポイントの新規追加）
- **Key Findings**:
  - evm-engine の `calculateEvmMetrics` / `calculateFeverChart` / `findCriticalPath` はすでに設計済みであり、dashboard はこれらを呼び出すだけで EVM 計算を行える
  - progress-tracking が `progress.getLatest` tRPC プロシージャを提供しているため、dashboard の `evm.calculate` ルーターから直接 DB クエリで最新スナップショットを取得するか、同等のクエリを再実装する
  - recharts は既存の EVM Studio の依存ライブラリ一覧にはないが、軽量 SVG ベースのチャートライブラリとして steering で明示的に指定されている。SPI トレンドには `LineChart`、フィーバーチャートには `ScatterChart` を使用する

## Research Log

### evm-engine インターフェース調査

- **Context**: dashboard が evm-engine をどう呼び出すかを確定する
- **Sources Consulted**: `.kiro/specs/evm-engine/design.md`
- **Findings**:
  - `calculateEvmMetrics(input: EvmInput): ProjectEvmMetrics` — PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI + `taskMetrics[]` を一括返却する
  - `calculateFeverChart(cumulativeDelayDays, bufferTotalDays, completedEvOnChain, bacOfChain): FeverChartData` — フィーバーチャート座標とゾーン判定を返す
  - `evaluateAlertLevel(spi, delayDays, isOverdue): AlertLevel` — タスク単位のアラートレベル評価
  - `findCriticalPath(input: CriticalPathInput): CriticalPathResult` — クリティカルチェーン（タスク ID 配列）
  - `AlertLevel` は `'CRITICAL_DELAY' | 'WARNING_DELAY' | 'NORMAL' | 'OVERDUE' | 'NA'`
- **Implications**: dashboard の `evm.calculate` ルーターは、DB クエリで取得したデータを `EvmInput` に変換して `calculateEvmMetrics` に渡すだけでよい。担当者別集計とアラート生成はルーター内で組み立てる

### progress-tracking インターフェース調査

- **Context**: SPI トレンドに複数スナップショット日のデータが必要であり、`progress.getLatest` だけでは最新日付のみしか取れない
- **Sources Consulted**: `.kiro/specs/progress-tracking/design.md`
- **Findings**:
  - `progress.getLatest({ projectId })` は各タスクの最新スナップショット 1 件のみを返す
  - SPI トレンドには過去の全スナップショット日が必要であるため、`progressSnapshots` テーブルを `snapshot_date` でグループ化したクエリが必要
- **Implications**: `evm.calculate` ルーター内で直接 Drizzle クエリを実行し、全 `snapshot_date` 一覧を取得して各日付ごとに EVM 計算を行う。`progress.getHistory` を per-task で呼ぶのは非効率なため、プロジェクト全体のスナップショットをバルク取得するクエリを `evm.ts` 内に記述する

### recharts バージョン・API 調査

- **Context**: SPI トレンドチャートとフィーバーチャートに recharts を使用する
- **Sources Consulted**: recharts 公式 API リファレンス（概念確認）
- **Findings**:
  - `LineChart` + `Line` でマルチライン折れ線チャートが実装可能
  - `connectNulls={false}` で null 値の前後を接続しない（折れ線を途切れさせる）
  - `ReferenceLine` で水平・垂直の基準線を追加できる（SPI=1.0 基準線に使用）
  - `ScatterChart` + `Scatter` で散布図（フィーバーチャートのプロット）が実装可能
  - `ReferenceArea` で特定領域への背景色塗りつぶしが可能（Green/Yellow/Red ゾーン描画に使用）
  - `Tooltip` コンポーネントは `content` props でカスタマイズ可能
- **Implications**: recharts を採用し、`SpiTrendChart` は `LineChart`・`FeverChart` は `ScatterChart` で実装する。ゾーン境界線の正確な描画は `ReferenceArea` の `x1/x2/y1/y2` を計算して配置する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 集約エンドポイント（evm.calculate 1本） | 1 回の tRPC 呼び出しで全 EVM データを返す | クライアントの並列リクエスト不要・キャッシュ管理が単純 | レスポンスペイロードがやや大きくなる | steering の設計方針と整合。採用 |
| 複数エンドポイント分割 | summary/alerts/chart ごとに別プロシージャを定義 | レスポンスが細かく分割される | クライアントで複数クエリの依存管理が必要 | 複雑性増加。不採用 |

## Design Decisions

### Decision: SPI トレンドデータの生成方法

- **Context**: SPI トレンドは複数の `snapshot_date` にわたるデータが必要
- **Alternatives Considered**:
  1. `progress.getHistory` を各タスクごとに呼び出して集約する
  2. `evm.calculate` ルーター内でプロジェクト全体の `progressSnapshots` をバルク取得して各 `snapshot_date` ごとに EVM 計算を実行する
- **Selected Approach**: Option 2 を採用。`progressSnapshots` テーブルから `project_id` 配下の全レコードをバルク取得し、`snapshot_date` の一意リストを抽出して各日付で `calculateEvmMetrics` を実行する
- **Rationale**: Option 1 は N+1 クエリになりパフォーマンスが悪い。Option 2 はバルク取得のため DB ラウンドトリップが 1 回で済む
- **Trade-offs**: プロジェクトの規模が大きい場合（スナップショット件数が多い）はレスポンスが遅くなるが、ローカルファースト用途では許容範囲
- **Follow-up**: スナップショット件数が多い場合にクエリ時間を実測して問題があれば過去日付の絞り込みを追加する

### Decision: フィーバーチャートの null ハンドリング

- **Context**: バッファタスク（`is_buffer=true`）が存在しないプロジェクトではフィーバーチャートを表示できない
- **Selected Approach**: `evm.calculate` で `feverChart: null` を返し、`FeverChart` コンポーネントが "バッファデータなし" を表示する
- **Rationale**: フィーバーチャートのデータなしは正常な状態であり、エラーではない。UI でのグレースフルデグラデーションとして処理する
- **Trade-offs**: `null` チェックをコンポーネント側で行う必要があるが、型安全に処理できる

### Decision: recharts の採用

- **Context**: チャートライブラリの選択
- **Selected Approach**: recharts を採用（steering で指定済み）
- **Rationale**: 軽量・React ネイティブ・TypeScript 型サポート・`LineChart`/`ScatterChart`/`ReferenceArea`/`Tooltip` で要件を満たせる
- **Trade-offs**: SVG ベースのため極端に大量のデータポイントでは描画が遅くなるが、EVM Studio のスナップショット件数（日次・数十件程度）では問題なし

## Risks & Mitigations

- SPI トレンドのバルク計算でレスポンスが遅くなるリスク — スナップショット日のフィルタリング（過去 N 日間）を将来追加することで対応可能
- evm-engine の `TaskEvmMetrics` 型変更による breaking change — 設計書の Revalidation Triggers で明示し、型変更時に dashboard スペックの再確認を義務づける
- `assigneeId = null`（担当者未割当タスク）の処理 — 担当者別集計でグループ化できないため、"未割当" グループとして集約するか除外するかを実装時に判断する（デフォルトは除外）

## References

- evm-engine 設計書: `.kiro/specs/evm-engine/design.md`
- progress-tracking 設計書: `.kiro/specs/progress-tracking/design.md`
- domain.md アラート閾値定義: `.kiro/steering/domain.md`
- recharts 公式サイト: https://recharts.org/en-US/api
