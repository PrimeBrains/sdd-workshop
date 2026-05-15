# 要件定義書

## Introduction

EVM Studio の計算コアとして、純粋関数群（`server/src/services/evm-engine.ts`・`server/src/services/evm-assignees.ts` 等）と統合 tRPC エンドポイント `evm.calculate` を提供する。dashboard の `WorkbenchPage`（モックアップ `mockup/variation-a.jsx`）が「サマリーストリップ（前日比トグル）／アラートストリップ／ガント／SPI トレンド／フィーバーチャート／Inspector（Task・Member・Team）」を一括で描画できるように、単一基準日と前日（または任意の参照日）の EVM データを 1 レスポンスで返却する。

既存実装は基本 EVM メトリクス（PV/EV/AC/SPI/CPI/EAC）と一部チャートデータを返すが、モックアップ `mockup/projects-data.jsx` の `PROJECT_DATA` が必要とする `summary` / `prevDay` / `assignees` / `alerts` / `spiTrend` / `fever` / `tasks` / `gantt` を**一括返却できていない**。本スペックはこのギャップを解消し、`evm-engine.ts` を純粋関数のまま保ちつつ、DB I/O 担当の上位レイヤー（tRPC ルーター）からの呼び出しに耐える集約 API に再定義する。

## Boundary Context

- **In scope**:
  - PV / EV / AC / BAC / SPI / CPI / EAC / VAC / ETC / TCPI の決定論的計算（純粋関数）
  - 前日（または任意 `prevDate`）スナップショットから算出する `prevDay`（summary / assignees / tasks）と差分メトリクス（`spiDelta` / `cpiDelta`）
  - 担当者別 EVM 集計（`assignees`: bac / ev / pv / ac / spi / cpi / status）
  - SPI 閾値（< 0.8 critical / < 0.9 warning）ベースのアラート判定
  - SPI/CPI 時系列（`spiTrend`）の集計
  - CCPM フィーバーチャートデータ（`fever`: bufferConsumption / criticalChainCompletion / zone / trail）
  - WBS ツリーを含むタスク別 EVM データ（`tasks`: code / name / level / progress / spi / bac / assignee / leaf / buffer）
  - ガント表示用の日付軸メタデータ（`gantt`: startISO / endISO / totalDays / baseDay / months）
  - tRPC `evm.calculate(projectId, baseDate, options?)` の入力スキーマと出力型の確定
  - Vitest 4 による境界値・エラーケースの単体テスト
- **Out of scope**:
  - SQLite スキーマ・Drizzle テーブル定義（→ `core-data-model`）
  - `ProgressSnapshot` の書き込み・スナップショット日付の解決 UI（→ `progress-tracking`）
  - WBS YAML インポートロジック（→ `core-data-model`）
  - ダッシュボード UI コンポーネント・Inspector・GanttChart・SVG 描画（→ `dashboard`）
  - 認証・認可・マルチユーザー対応（ローカル前提のためプロダクト方針で対象外）
- **Adjacent expectations**:
  - `core-data-model` は `projects` / `tasks` / `task_dependencies` / `members` / `holidays` のスキーマと CRUD を提供し、`Member.availabilityRate`、`Task.estimateDays / plannedStart / plannedEnd / parentId / isBuffer / isLeaf / assigneeId`、`Holiday.date` を本スペックが読み取り専用で参照する前提
  - `progress-tracking` は `ProgressSnapshot(taskId, snapshotDate, progressPct, acDays)` を当日分・前日分の双方で取得可能にする前提。`evm.calculate` 呼び出し時に必要な範囲スナップショットを 1 クエリで取得できるレンジ API を提供する
  - `dashboard` は `evm.calculate` のレスポンスをそのまま消費し、モックアップ `mockup/projects-data.jsx` と同じ `PROJECT_DATA` 構造を期待する
  - `wbs-*` スキルは EVM 計算に直接関与しないが、生成された `task.estimate_days` / `planned_start` / `planned_end` / `depends_on` の品質が計算結果の妥当性に影響する

## Requirements

### Requirement 1: コア EVM メトリクスの集約計算

**Objective:** プロジェクトマネージャー として、基準日時点のプロジェクト全体の EVM メトリクスを 1 回の API 呼び出しで取得したい、そうすることでサマリーストリップに必要な数値をクライアント側で再計算する必要がない。

#### Acceptance Criteria

1. When `evm.calculate(projectId, baseDate)` が呼ばれる、 the EVM Engine shall `summary.bac` をプロジェクト配下の非バッファタスクの `estimateDays` 合計として算出する。
2. When `evm.calculate(projectId, baseDate)` が呼ばれる、 the EVM Engine shall `summary.pv` を WBS-CMN-013 の fill-to-capacity モデル（`min(N * availabilityRate, estimateDays)`、`N` は `plannedStart` から `baseDate` までの稼働日数）で算出する。
3. When `evm.calculate(projectId, baseDate)` が呼ばれる、 the EVM Engine shall `summary.ev` を各タスクの `estimateDays * (progressPct / 100)` の合計として算出する（バッファタスクを除外する）。
4. When `evm.calculate(projectId, baseDate)` が呼ばれる、 the EVM Engine shall `summary.ac` を当該基準日以前の `ProgressSnapshot.acDays` の合計として算出する。
5. When `summary.pv` が `0` より大きい、 the EVM Engine shall `summary.spi` を `ev / pv` として算出する。
6. If `summary.pv` が `0` である、 the EVM Engine shall `summary.spi` を `null` として返却する。
7. When `summary.ac` が `0` より大きい、 the EVM Engine shall `summary.cpi` を `ev / ac` として算出する。
8. If `summary.ac` が `0` である、 the EVM Engine shall `summary.cpi` を `null` として返却する。
9. When `summary.spi` が `null` でなくかつ `0` より大きい、 the EVM Engine shall `summary.eac` を `bac / spi` として算出する。
10. The EVM Engine shall `summary.vac` を `bac - eac`、 `summary.etc` を `eac - ac`、 `summary.tcpi` を `(bac - ev) / (bac - ac)` として算出する（分母 `0` のときは対応する値を `null` とする）。

### Requirement 2: 前日比 (prevDay) 計算

**Objective:** プロジェクトマネージャー として、基準日と前営業日（または任意の参照日）の差分を一括で取得したい、そうすることでサマリーストリップの「前日比トグル」と Inspector の Team モードで差分を即時表示できる。

#### Acceptance Criteria

1. When `evm.calculate(projectId, baseDate)` が呼ばれる、 the EVM Engine shall `baseDate` の直前の営業日（土日と Holiday を除外した直近の日付）を `prevDate` として決定する。
2. When `options.prevDate` が呼び出しで明示的に渡される、 the EVM Engine shall その日付を `prevDate` として優先採用する（"yesterday" 限定ではなく任意の `baseDate - n` を許容する）。
3. The EVM Engine shall `prevDay.summary` を `prevDate` 時点で再計算した `{ pv, ev, ac, spi, cpi, eac, vac, etc, tcpi }` として返却する。
4. The EVM Engine shall `prevDay.assignees` を `prevDate` 時点で担当者別に集計した `{ id, ev, pv, ac, spi, cpi }` 配列として返却する。
5. The EVM Engine shall `prevDay.tasks` を `prevDate` 時点で差分のあるタスクのみ `{ id, progress, spi }` として返却する。
6. The EVM Engine shall `summary.spiDelta` を `summary.spi - prevDay.summary.spi`、 `summary.cpiDelta` を `summary.cpi - prevDay.summary.cpi` として算出する（いずれかが `null` の場合は対応する Delta を `0` とする）。
7. If `prevDate` 時点のスナップショットが存在しない、 the EVM Engine shall `prevDay` を `null` とし `spiDelta` / `cpiDelta` を `0` として返却する。
8. While `prevDate` が `Project.startDate` 以前である、 the EVM Engine shall `prevDay.summary.pv` を `0` として扱い、 `prevDay.summary.spi` を `null` として返却する。

### Requirement 3: 担当者別 EVM 集計 (assignees)

**Objective:** リーダー として、担当者ごとの EVM 状況と前日比を 1 リクエストで取得したい、そうすることで Inspector の Member / Team モードで担当者一覧を即時表示できる。

#### Acceptance Criteria

1. The EVM Engine shall `assignees` を当該プロジェクトに紐づく `Member` 全件分の `{ id, name, bac, ev, pv, ac, spi, cpi, status }` 配列として返却する。
2. When `assignees[].bac` を算出する、 the EVM Engine shall 当該メンバーが `assigneeId` を持つ非バッファタスクの `estimateDays` 合計とする。
3. When `assignees[].pv` を算出する、 the EVM Engine shall そのメンバーの担当タスクの `calculateTaskPv` 合計とする（メンバーの `availabilityRate` を採用する）。
4. When `assignees[].ev` を算出する、 the EVM Engine shall そのメンバーの担当タスクの `estimateDays * progressPct / 100` の合計とする。
5. When `assignees[].ac` を算出する、 the EVM Engine shall そのメンバーの担当タスクに紐づく `ProgressSnapshot.acDays` 合計とする。
6. When `assignees[].pv > 0` かつ `assignees[].ac > 0`、 the EVM Engine shall `spi = ev / pv`、 `cpi = ev / ac` を算出する。
7. If `assignees[].pv === 0` または `assignees[].ac === 0`、 the EVM Engine shall 対応する `spi` / `cpi` を `null` として返却する。
8. When `assignees[].spi !== null`、 the EVM Engine shall `status` を SPI 閾値（`< 0.8` → `'critical'`、 `< 0.9` → `'warning'`、 `>= 0.9` → `'normal'`）で決定する。
9. If `assignees[].spi === null`、 the EVM Engine shall `status` を `'normal'` として返却する。
10. The EVM Engine shall N+1 クエリを避けるため、メンバー・タスク・スナップショットを 1 回の範囲取得で集約し、担当者集計を純粋関数で行う。

### Requirement 4: アラート判定 (alerts)

**Objective:** プロジェクトマネージャー として、SPI が閾値を下回るタスクをアラートとして受け取りたい、そうすることでアラートストリップで遅延タスクを即時把握できる。

#### Acceptance Criteria

1. The EVM Engine shall `alerts` を `{ taskId, taskName, assigneeName, spi, level }` 配列として返却する。
2. When 葉タスク（`isLeaf === true`）かつ `task.spi !== null`、 the EVM Engine shall `task.spi < 0.8` の場合 `level: 'critical'` のアラートを追加する。
3. When 葉タスクかつ `task.spi !== null`、 the EVM Engine shall `0.8 <= task.spi < 0.9` の場合 `level: 'warning'` のアラートを追加する。
4. If `task.spi >= 0.9` または `task.spi === null`、 the EVM Engine shall そのタスクに対するアラートを追加しない。
5. The EVM Engine shall アラートが 0 件の場合に空配列 `[]` を返却する（クライアント側が "HEALTHY" バナーを判断できるようにする）。
6. The EVM Engine shall アラートを `spi` 昇順（重大度高い順）でソートして返却する。

### Requirement 5: SPI/CPI 時系列 (spiTrend)

**Objective:** プロジェクトマネージャー として、過去 N 日分の SPI/CPI 推移を取得したい、そうすることで SpiTrendChart に折れ線として描画できる。

#### Acceptance Criteria

1. The EVM Engine shall `spiTrend` を `{ d: 'MM-DD', spi: number, cpi: number }` 配列として返却する。
2. When `options.trendWindowDays` が指定される、 the EVM Engine shall `baseDate - trendWindowDays + 1` から `baseDate` までの範囲を対象とする。
3. If `options.trendWindowDays` が未指定、 the EVM Engine shall プロジェクト開始日から `baseDate` までの全範囲を対象とする。
4. The EVM Engine shall 入力されたスナップショット日付一覧を昇順に並べ、各スナップショット日付時点の SPI/CPI を再計算してポイントを生成する。
5. When スナップショット日付のうち SPI/CPI が `null` の点、 the EVM Engine shall 当該点を `spi: null` / `cpi: null` のまま含める（クライアント側で線分を欠損として扱えるようにする）。
6. The EVM Engine shall ポイント数が 0 件の場合に `spiTrend: []` を返却する。

### Requirement 6: CCPM フィーバーチャート (fever)

**Objective:** プロジェクトマネージャー として、クリティカルチェーンのバッファ消費とプロジェクト完了率の関係を 1 セットで取得したい、そうすることでフィーバーチャートのゾーンと推移トレイルを描画できる。

#### Acceptance Criteria

1. When プロジェクトがバッファタスク（`isBuffer === true`）を持つ、 the EVM Engine shall `fever.bufferConsumption` を「クリティカルチェーン累積遅延日数 / バッファ総日数」として算出する。
2. The EVM Engine shall `fever.criticalChainCompletion` を「クリティカルチェーン上の完了 EV / クリティカルチェーン BAC」として算出する。
3. The EVM Engine shall `fever.zone` を以下のルールで判定する: `bufferConsumption < criticalChainCompletion * 0.67` → `'GREEN'`、 `< criticalChainCompletion * 1.0` → `'YELLOW'`、 それ以上 → `'RED'`。
4. The EVM Engine shall `fever.trail` を過去 N スナップショット時点での `{ x: criticalChainCompletion, y: bufferConsumption }` 配列として返却する（時系列順）。
5. If プロジェクトがバッファタスクを持たない、 the EVM Engine shall `fever` を `null` として返却する。
6. If `バッファ総日数 === 0` または `クリティカルチェーン BAC === 0`、 the EVM Engine shall ゼロ除算を回避するため `bufferConsumption` / `criticalChainCompletion` を `0` として扱う。

### Requirement 7: タスク別 EVM データ (tasks)

**Objective:** プロジェクトマネージャー として、WBS ツリーを保ったままタスク別の EVM 数値を取得したい、そうすることでガントとガントフルスクリーン両方で行ごとの進捗・SPI を描画できる。

#### Acceptance Criteria

1. The EVM Engine shall `tasks` を `{ id, code, name, level, start, end, progress, spi, assignee, leaf, buffer, bac }` 配列として返却する。
2. The EVM Engine shall `start` / `end` をプロジェクト開始日（`startISO`）からの相対日数（整数）として返却する。
3. When タスクが `isLeaf === true`、 the EVM Engine shall `leaf: true` を、 `isBuffer === true` の場合は `buffer: true` を返却する。
4. When タスクが葉タスクかつ進捗スナップショットが存在する、 the EVM Engine shall `progress` を最新スナップショットの `progressPct`、 `spi` を `ev / pv`（`pv > 0` 時のみ、それ以外は `null`）として返却する。
5. When タスクが葉タスクではない（親タスク）、 the EVM Engine shall `progress` を子葉タスクの BAC 加重平均、 `spi` を子葉タスクの `ev` 合計 / `pv` 合計として返却する。
6. The EVM Engine shall `assignee` を当該タスクの `Member.name`（バッファや未割当の場合は `null`）として返却する。
7. The EVM Engine shall タスクを WBS 表示順（`code` の階層辞書順）で安定ソートして返却する。

### Requirement 8: ガントメタデータ (gantt)

**Objective:** プロジェクトマネージャー として、ガント描画に必要な日付軸情報を 1 オブジェクトで取得したい、そうすることでクライアント側で開始日や月境界を再計算せずに描画できる。

#### Acceptance Criteria

1. The EVM Engine shall `gantt.startISO` を `Project.startDate`、 `gantt.endISO` を `Project.endDate` として返却する。
2. The EVM Engine shall `gantt.totalDays` を `startISO` から `endISO` までの暦日数（両端含む）として返却する。
3. The EVM Engine shall `gantt.baseDay` を `startISO` から `baseDate` までの相対日数（整数）として返却する。
4. The EVM Engine shall `gantt.months` を `{ d: number, l: string }` 配列とし、`startISO` から `endISO` の範囲に含まれる各月初の相対日数 `d` と日本語月ラベル `l`（例: `'5月'`）を返却する。
5. If `baseDate < startISO`、 the EVM Engine shall `baseDay = 0` を返却する。
6. If `baseDate > endISO`、 the EVM Engine shall `baseDay = totalDays - 1` を返却する。

### Requirement 9: tRPC 入出力契約 (evm.calculate)

**Objective:** クライアント開発者 として、`evm.calculate` の入出力型をエンドツーエンドで型安全に扱いたい、そうすることで dashboard 側で型補完を効かせながら実装できる。

#### Acceptance Criteria

1. The EVM tRPC Router shall 入力スキーマを `{ projectId: number, baseDate: 'YYYY-MM-DD', options?: { prevDate?: 'YYYY-MM-DD', trendWindowDays?: number } }` の Zod スキーマとして公開する。
2. When `projectId` が DB に存在しない、 the EVM tRPC Router shall `PROJ_NOT_FOUND` エラーコードを伴う `TRPCError(NOT_FOUND)` をスローする。
3. If `baseDate` が `YYYY-MM-DD` 形式でない、 the EVM tRPC Router shall `EVM_INVALID_BASE_DATE` エラーコードを伴う `TRPCError(BAD_REQUEST)` をスローする。
4. The EVM tRPC Router shall 出力を `{ summary, prevDay, assignees, alerts, spiTrend, fever, tasks, gantt }` の単一オブジェクトとして返却する（モックアップ `mockup/projects-data.jsx` の `PROJECT_DATA` 1 件分と同等の形状）。
5. The EVM tRPC Router shall Drizzle 推論型 `Project` / `Task` / `Member` を経由した型安全な内部参照を維持し、レスポンス型を `EvmCalculateOutput` として再エクスポートする。
6. While `evm.calculate` の処理中、 the EVM tRPC Router shall DB I/O を 1 度（プロジェクト・タスク・メンバー・休日・範囲スナップショットの取得）に集約し、純粋関数群を呼び出して計算する。

### Requirement 10: 純粋性と決定論性

**Objective:** EVM Studio 開発者 として、`services/evm-engine.ts` 配下の関数を副作用なし・決定論的に保ちたい、そうすることで単体テストと将来のリプレイ可能性を保証できる。

#### Acceptance Criteria

1. The EVM Engine shall `services/evm-engine.ts` および `services/evm-assignees.ts`（または同等の集約モジュール）の関数を DB アクセスを持たない純粋関数として実装する。
2. While 関数が同一入力で繰り返し呼ばれる、 the EVM Engine shall 常に同一出力を返す（決定論性）。
3. The EVM Engine shall 入力データ（タスク・メンバー・スナップショット・休日）を引数として受け取り、グローバル変数・ファイル I/O・ネットワーク I/O を一切持たない。
4. If 入力データに `any` 型が混入する、 the TypeScript Compiler shall コンパイルエラーで弾く（`tsc --strict` 通過必須）。
5. The EVM Engine shall `Date` オブジェクトの可変メソッド呼び出し（`setDate`, `setMonth` 等）を入力配列の要素に対して行わず、新しい `Date` インスタンスを生成して計算する。

### Requirement 11: エラー処理とエラーコード

**Objective:** EVM Studio 開発者 として、計算層のエラーをエラーコード経由で一意に識別したい、そうすることで tRPC 層・クライアント層で適切なエラーメッセージを表示できる。

#### Acceptance Criteria

1. If `baseDate` が `YYYY-MM-DD` 形式でないまたは無効な日付、 the EVM Engine shall `AppError` を `ErrorCode.EVM_INVALID_BASE_DATE` でスローする。
2. If `Member.availabilityRate` が `[0, 1]` の範囲外、 the EVM Engine shall `AppError` を `ErrorCode.EVM_INVALID_AVAILABILITY_RATE` でスローする。
3. If クリティカルパス計算で循環依存が検出される、 the EVM Engine shall `AppError` を `ErrorCode.EVM_CIRCULAR_DEPENDENCY` でスローする。
4. The Error Codes Module shall `errors/codes.ts` に `EVM_INVALID_BASE_DATE` / `EVM_INVALID_AVAILABILITY_RATE` / `EVM_CIRCULAR_DEPENDENCY` を定数として定義する。
5. The EVM tRPC Router shall 内部の `AppError` を `TRPCError` に変換し、`code` プロパティをクライアントへ伝搬する。

### Requirement 12: パフォーマンス

**Objective:** プロジェクトマネージャー として、100 タスク規模のプロジェクトでも `evm.calculate` を 200ms 以内に取得したい、そうすることで基準日切り替え時の UI 反応が遅延しない。

#### Acceptance Criteria

1. While プロジェクトのタスク数が 100 件以下、 the EVM Engine shall `evm.calculate` のサーバーサイド合計処理時間（DB I/O + 計算）を 200ms 以内に収める。
2. The EVM Engine shall 担当者別集計・前日比・SPI トレンドを単一の範囲スナップショット取得で完結させ、N+1 クエリを発生させない。
3. The EVM Engine shall 同一基準日に対する複数呼び出しでも同一結果を得るため、計算過程で乱数・現在時刻を一切使用しない。

### Requirement 13: テストカバレッジ

**Objective:** EVM Studio 開発者 として、計算エンジンの正しさをユニットテストで保証したい、そうすることでリファクタリングとリグレッションを安全に行える。

#### Acceptance Criteria

1. The Test Suite shall PV / EV / AC / SPI / CPI / EAC / VAC / ETC / TCPI それぞれについて少なくとも 1 件の境界値テスト（ゼロ除算ケースを含む）を含める。
2. The Test Suite shall `prevDay` 計算について「前営業日が存在するケース」「前営業日が休日のみで存在しないケース」「前営業日がプロジェクト開始日より前のケース」の 3 ケースを含める。
3. The Test Suite shall `assignees` 集計について「複数タスクを持つメンバー」「タスク未割当メンバー」「`availabilityRate` 別」のケースを含める。
4. The Test Suite shall `alerts` 判定について `spi` が 0.79 / 0.80 / 0.89 / 0.90 / 1.00 / null の 6 境界点を含める。
5. The Test Suite shall `fever` ゾーン判定について GREEN / YELLOW / RED 各境界点を含める。
6. The Test Suite shall モックアップ `mockup/projects-data.jsx` の `PROJECT_DATA[0]`（NXP-002）に近い入力で `evm.calculate` を呼び出し、`summary` / `prevDay` / `assignees` / `alerts` / `fever` / `tasks` / `gantt` のキーが全て揃うことを確認する E2E 風の統合テストを含める。
7. When `npm test` を実行する、 the Vitest Runner shall 上記すべてのテストがパスする。
