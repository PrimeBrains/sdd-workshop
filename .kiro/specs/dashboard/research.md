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

---

## 追補（2026-05-18）: 数値整合性バグの RCA と設計反映

### Discovery Scope（追加分）

- **トリガー**: 実装稼働後のスクリーンショット (FireShot Capture 288, `projectId=39`, `baseDate=2026-05-18`) で SummaryStrip / Inspector の BAC / EV / PV / AC が全て `0.0 MD` 表示。一方で SPI は 0.88 と正常表示。DB 側は健全（84 タスク・estimate_days 合計 70.0 MD・スナップショット 84 件 / `2026-05-14`）。
- **分類**: Extension（既存 spec の表示層バグ + 仕様補強）/ Light Discovery。

### Research Log（追加分）

#### 数値表示パスのトレース

- **Context**: 「API は正しい値を返しているが UI 表示が `0.0 MD`」という症状の原因特定。
- **Sources Consulted**: `server/src/services/evm-engine.ts`, `server/src/api/evm.ts`, `client/src/lib/formatters.ts`, `client/src/components/summary/SummaryStrip.tsx`, `client/src/components/inspector/InspectorTaskMode.tsx`, `e2e/workbench.spec.ts`。
- **Findings**:
  - サーバ側 `calculateEvmMetrics` は `bac = nonBufferTasks.reduce(sum + estimateDays)` で正しく人日単位の合計 70.0 を返す。SPI / CPI は別経路で `.toFixed(2)` 直接呼び出しのため正常表示。
  - `client/src/lib/formatters.ts:1` の `fmtMD` 実装が `(n / 1_000_000).toFixed(1) + ' MD'` となっており、人日単位の数値を **100 万で割って** いた。`70 / 1_000_000 = 0.00007` → `'0.0 MD'` 表示の直接原因。
  - `client/src/components/inspector/InspectorTaskMode.tsx:251` の Inspector Task モード「前日比 BAC」が `value="±0.0 MD"` のハードコード固定文字列。`fmtDeltaMD(dTaskBAC)` が呼ばれていない実装漏れ。
  - 同表示は EV/PV/AC/VAC/EAC/ETC で共通の `fmtMD` を経由するため、サマリー全体・Inspector・GanttChart 系すべてに波及していた。
- **Implications**: 個別バグ修正に加え、要件 4.7 が `(n / 1_000_000).toFixed(1)` を「仕様レベルで」明文化していたことが、レビューおよびテストでの検知をすり抜けた一因。要件側で実装詳細を排除し、人日単位そのまま表示の不変則として書き直す必要がある。

#### テストカバレッジ・ギャップ分析

- **Context**: 「なぜユニットテスト / E2E / コードレビューで検知されなかったか」。
- **Findings**:
  - `client/src/lib/formatters.test.ts` ファイル自体が **存在しなかった**。設計書 (旧 Testing Strategy) で「自明な変換のみで ROI が低い」と省略判断していた。同じ単位系を扱う `client/src/services/ac-unit.test.ts`（`1 MD === 8 h`）は厳密にテスト済みだが、表示フォーマッタは素通りだった。
  - SummaryStrip / Inspector のコンポーネントテストは `tech.md` 方針により不採用 → React Testing Library での検知パスは元から無し。
  - `e2e/workbench.spec.ts` の `readSummaryStat` ヘルパは BAC / EV / PV / AC を **読み取る** が、「値が期待 MD と一致するか」のアサートは皆無。前日比モードの記号 (`▲ / ▼ / ±0`) 検出ロジックは `'0.0 MD'` を正常扱いとして通過させていた。
  - サーバ側計算ロジックは `evm-engine.test.ts` / `evm.test.ts` で網羅的にテストされており、API レスポンスまでは保証済み → サーバーから UI 表示までの「最後の 1 マイル」にテスト断絶があった。
- **Implications**: 「ピュア関数で自明だからテスト不要」という ROI 判断は、定数掛け・単位変換の混入に対しては安全とは言えない。本スペックでは方針を反転し、表示層の単位不変則は Vitest で常時アサートする。

### Design Decisions（追加分）

#### Decision: 人日 (Man-Day) 単位の不変則を `formatters.ts` の契約として明文化

- **Context**: 旧要件 4.7 が `(n / 1_000_000).toFixed(1) + ' MD'` を仕様化していたため、実装者・レビュワー双方が「割算は仕様通り」と誤認した。
- **Alternatives Considered**:
  1. 要件は変えず、実装の `fmtMD` だけ修正する（ピンポイント修正）。
  2. 要件 4.7 から実装詳細 (数式) を排除し、「API 値を人日単位そのまま表示」を不変則として明示。`formatters.ts` 側で同契約を再表現し、`formatters.test.ts` でアサートする。
- **Selected Approach**: Option 2。
- **Rationale**: 要件側の数式記述が誤りの源だったため、表面の実装だけ直しても spec ↔ impl 一貫性は回復しない。Generalization の観点でも、BAC / EV / PV / AC / VAC / EAC / ETC は「Man-Day 単位の `number` を `toFixed(1)` で表示」という同一パターンに集約できる。
- **Trade-offs**: 要件再生成 → 下流 (design, tasks) 再承認のオーバーヘッドが発生するが、再発防止のためには必須コスト。
- **Follow-up**: 新規 Requirement 21 として「API レスポンス値と UI 表示値の整合」を ubiquitous 要件化済み。

#### Decision: Build vs Adopt — ピュア関数テストは既存 Vitest を採用

- **Context**: formatter ピュア関数のテストランナー選定。
- **Selected Approach**: Vitest（既に `evm-studio/client/` で `vitest.config.ts` および `client/src/services/ac-unit.test.ts` 等で稼働中）を採用。新規ライブラリ追加なし。
- **Rationale**: 既存テスト基盤との一貫性。Playwright と用途を切り分け、ピュア関数の決定性テストはピュア関数テストランナーで担う。
- **Trade-offs**: なし。

#### Decision: 「自明な変換だからテスト省略」アンチパターンの撤回

- **Context**: 旧 Testing Strategy の `lib/formatters.ts` 省略根拠 (「自明な変換のみで ROI が低い」)。
- **Selected Approach**: 撤回。Vitest による pure-function テストを必須化し、設計書 Testing Strategy に「自明だから省略してはならない」根拠を明記。
- **Rationale**: 過去の `1_000_000` 割算混入事例が、まさにこの判断の安全性反証となった。ピュア関数のテストはコスト極小（1 関数 1-3 アサート）に対し、リグレッション検知効果は単位スケール混入を完全に防ぐ。
- **Trade-offs**: テストファイル維持の最小コスト（変更時に追従が必要）。

### Risks & Mitigations（追加分）

- **「自明な変換」省略リスク**: 今後別の formatter 拡張時にも同種の誤りが入りうる。Requirement 21.5 を ubiquitous（将来追加にも適用）として書くことで、新規追加 formatter にも自動的に単位整合要件が適用される。
- **要件再承認の連鎖**: dashboard requirements の変更により design / tasks の再承認が必要。本ターンで design → tasks の連鎖を実施することで対応。
- **既存 e2e の前提崩れ**: 旧 `workbench.spec.ts` の `readSummaryStat` ヘルパは保持しつつ、新シナリオ (i) を追加する形で互換性を確保。既存 8 シナリオは破壊しない。
