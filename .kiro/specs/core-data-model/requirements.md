# Requirements Document

## Project Description (Input)

EVM Studio のコアデータモデル（Project / Member / Task / ProgressSnapshot / TaskDependency / Holiday）を、モックアップ `mockup/variation-a.jsx` のワークベンチ UI を支えるために拡張する。具体的には次の 4 つのカラムを追加し、SQLite スキーマ・マイグレーション・WBS YAML インポーター・tRPC レスポンス型・シードデータをそれぞれ整合させる。

- `projects.status` (`active` / `paused` / `draft` / `archived`)
- `projects.code` (例: `NXP-002` のような短縮コード、表示用、unique 制約なし)
- `members.role` (例: `PM`, `Lead Eng`, `Engineer`, `Designer`, `QA`, `BA`, `Security`, `Analyst`)
- `members.initials` (例: `田美` のような表示用 2 文字イニシャル)

既存レコードを破壊せず、`Project.status` のみデフォルト `'active'` を入れ、その他は NULL を許容する。WBS YAML のフィールド追加は後方互換とし、新フィールドが無い既存 YAML はそのまま読み込めること。

このスペックはダッシュボード／EVM エンジン／進捗トラッキングの全スペックが参照する最上流データモデルであり、UI 表示・EVM 計算・進捗記録の責務は他スペックに委ねる。

## Boundary Context

- **In scope**:
  - `projects` / `members` テーブルへの `status` / `code` / `role` / `initials` カラム追加（Drizzle スキーマ更新 + マイグレーション）
  - WBS YAML インポーターが上記 4 フィールドをオプショナルに受け入れること（後方互換）
  - tRPC `projects.list` / `projects.getById` / `members.listByProject` の出力型に新カラムを含めること
  - tRPC `projects.create` / `projects.update` / `members.create` / `members.update` の入力スキーマで新カラムを受け入れ、バリデーションを行うこと
  - シードデータをモックアップ `mockup/projects-data.jsx` の 5 プロジェクト分（プロジェクト・メンバー・タスク・依存関係・休日）を `evm-studio/server/seeds/` に追加すること
  - `.kiro/steering/domain.md` の「wbs-YAML ↔ EVM Studio フィールド対応」表に新フィールドを追記すること
- **Out of scope**:
  - `progress_snapshots.note` カラム追加（→ `progress-tracking` spec）
  - クリティカルパス計算・PV/EV/AC 算出（→ `evm-engine` spec）
  - 進捗入力 UI・ダッシュボード表示・Inspector 表示（→ `dashboard` / `progress-tracking` spec）
  - 認証・認可・マルチユーザー対応（ローカル前提のため対象外）
- **Adjacent expectations**:
  - `dashboard` スペックは `projects.status` を Dot 色分けに、`projects.code` を TopBar / ProjectRail のラベルに、`members.role` を Members リストに、`members.initials` を Avatar に表示する前提でレスポンス型を参照する
  - `evm-engine` スペックは `members` / `tasks` の既存カラムのみを参照し、新カラムを計算入力に使わない
  - `wbs-*` スキルが生成する YAML は将来的に `status` / `code` / `role` / `initials` を出力できるが、当面は未出力でも動作すること

## Requirements

### Requirement 1: プロジェクトスキーマ拡張

**Objective:** プロジェクトマネージャー として、プロジェクトの稼働状態と短縮コードを保持したい、そうすることでダッシュボードの左レール・TopBar・プロジェクトピッカーに識別情報を表示できる。

#### Acceptance Criteria

1. The EVM Studio Schema shall `projects` テーブルに `status` カラム（テキスト、NULL 不可、デフォルト値 `'active'`）を保持する。
2. The EVM Studio Schema shall `projects` テーブルに `code` カラム（テキスト、NULL 許容、unique 制約なし）を保持する。
3. When `projects.status` に `'active'` / `'paused'` / `'draft'` / `'archived'` のいずれかを書き込む、 the EVM Studio Schema shall 書き込みを成功させる。
4. If `projects.status` に上記 4 値以外の値を書き込もうとする、 the Projects tRPC Router shall Zod バリデーションエラーを返し、 DB への書き込みを行わない。
5. The Projects tRPC Router shall `projects.list` / `projects.getById` のレスポンスに `status` と `code` を含めて返す。
6. While 既存マイグレーション適用済みの DB に新マイグレーションを適用する、 the Migration shall 既存レコードの `status` を `'active'` で埋め、`code` を NULL のままにする。

### Requirement 2: メンバースキーマ拡張

**Objective:** プロジェクトマネージャー として、メンバーの役割と表示用イニシャルを保持したい、そうすることで Inspector の Member モード・Members リスト・Avatar 表示に活用できる。

#### Acceptance Criteria

1. The EVM Studio Schema shall `members` テーブルに `role` カラム（テキスト、NULL 許容）を保持する。
2. The EVM Studio Schema shall `members` テーブルに `initials` カラム（テキスト、NULL 許容）を保持する。
3. The Members tRPC Router shall `members.listByProject` / `members.getById` のレスポンスに `role` と `initials` を含めて返す。
4. When `members.create` / `members.update` に `role` を渡す、 the Members tRPC Router shall 任意文字列として受け入れる（プリセット値 `PM` / `Lead Eng` / `Engineer` / `Designer` / `QA` / `BA` / `Security` / `Analyst` の参考リストはあるが、自由入力を許容する）。
5. When `members.create` / `members.update` に `initials` を渡す、 the Members tRPC Router shall 文字数 1〜4 までの文字列として受け入れる。
6. If `members.initials` が省略され、かつ `members.name` から自動生成できる、 the Members Service shall `name` の先頭 1 文字 + 姓名区切り後の名の先頭 1 文字（半角空白または全角空白で分割）の 2 文字を `initials` の既定値として算出する。
7. If `members.name` を空白で分割できない、 the Members Service shall `name` の先頭最大 2 文字を `initials` の既定値として算出する。
8. While 既存マイグレーション適用済みの DB に新マイグレーションを適用する、 the Migration shall 既存メンバーレコードの `role` と `initials` を NULL のままにする。

### Requirement 3: マイグレーションの後方互換性

**Objective:** EVM Studio 利用者 として、既存の SQLite データベースを保持したままアプリを更新したい、そうすることで作業中の進捗データが失われない。

#### Acceptance Criteria

1. The Migration shall 既存の `projects` / `members` テーブルに対し、`ALTER TABLE ADD COLUMN` 形式で 4 カラムを追加する。
2. The Migration shall 既存レコードを削除・置換せず、欠落カラムを既定値（`status = 'active'`、それ以外は NULL）で埋める。
3. When 新規マイグレーションを適用済みの DB をアプリで起動する、 the EVM Studio Server shall 既存タスク・進捗スナップショット・依存関係を全件読み込めることを確認する。
4. If マイグレーション SQL の実行中にエラーが発生する、 the Migration Runner shall トランザクションをロールバックし、変更前の状態を維持する。

### Requirement 4: WBS YAML インポーターの拡張

**Objective:** WBS 作成者 として、wbs-* スキルが生成する YAML に新フィールド（`status` / `code` / `role` / `initials`）を含めたい、そうすることでインポート時にダッシュボード表示用のメタデータを一括投入できる。

#### Acceptance Criteria

1. When WBS YAML の `schedule.meta.project_status` フィールドが存在する、 the WBS Importer shall その値を `projects.status` に書き込む。
2. When WBS YAML の `schedule.meta.project_code` フィールドが存在する、 the WBS Importer shall その値を `projects.code` に書き込む。
3. When WBS YAML の `staffing.members[].role` フィールドが存在する、 the WBS Importer shall その値を `members.role` に書き込む。
4. When WBS YAML の `staffing.members[].initials` フィールドが存在する、 the WBS Importer shall その値を `members.initials` に書き込む。
5. If WBS YAML のいずれかの新フィールドが省略されている、 the WBS Importer shall 既定値（`status = 'active'`、`code` / `role` / `initials` は NULL）でインポートを継続し、エラーを発生させない。
6. If `schedule.meta.project_status` が `'active'` / `'paused'` / `'draft'` / `'archived'` 以外の値を持つ、 the WBS Importer shall インポートを中断し、`IMPORT_INVALID_PROJECT_STATUS` エラーコードで失敗する。
7. The WBS Importer shall 後方互換のため、新フィールドを一切持たない既存 YAML を従来通りインポートできる。

### Requirement 5: シードデータ

**Objective:** 開発者 として、モックアップ `mockup/variation-a.jsx` と同等の 5 プロジェクト分のテストデータを CLI 一発で投入したい、そうすることで dashboard / evm-engine / progress-tracking の動作確認をローカルで素早く再現できる。

#### Acceptance Criteria

1. The Seed Script shall モックアップ `mockup/projects-data.jsx` の 5 プロジェクト（`NXP-002` / `OHX-014` / `KYR-007` / `MNT-021` / `RVL-105` 相当）を `projects` テーブルに投入する。
2. The Seed Script shall 各プロジェクトに対応する `members` / `tasks` / `task_dependencies` / `holidays` を投入し、Foreign Key 整合性を保つ。
3. The Seed Script shall モックアップに記載された `status` / `code` / `role` / `initials` をそのまま反映する。
4. When `npm run seed` を実行する、 the Seed Script shall 既存の `evm.db` を初期化（または上書き）して、シードデータを投入完了する。
5. If シード投入中に Foreign Key 違反が発生する、 the Seed Script shall トランザクションをロールバックし、非ゼロ終了コードで終了する。
6. The Seed Script shall シード完了後に投入件数（projects / members / tasks / dependencies / holidays）を標準出力に表示する。

### Requirement 6: tRPC レスポンス型・入力スキーマの更新

**Objective:** クライアント開発者 として、サーバーから返ってくるエンティティ型に新カラムを含む確実な型情報がほしい、そうすることでダッシュボード側の TypeScript コードを安全に書ける。

#### Acceptance Criteria

1. The Projects tRPC Router shall Drizzle 推論型 `Project` を経由した出力型に `status` と `code` を含める。
2. The Members tRPC Router shall Drizzle 推論型 `Member` を経由した出力型に `role` と `initials` を含める。
3. When `projects.create` / `projects.update` の入力スキーマを生成する、 the Projects tRPC Router shall `status` を `z.enum(['active','paused','draft','archived'])` 型、 `code` を `z.string().nullable().optional()` 型として受け入れる。
4. When `members.create` / `members.update` の入力スキーマを生成する、 the Members tRPC Router shall `role` を `z.string().nullable().optional()` 型、 `initials` を `z.string().min(1).max(4).nullable().optional()` 型として受け入れる。
5. The tRPC Schema shall クライアント側の TypeScript コードから `Project.status` / `Project.code` / `Member.role` / `Member.initials` が直接参照可能になる。

### Requirement 7: ステアリングドキュメントの更新

**Objective:** 後続スペック開発者 として、wbs-YAML フィールド対応表と新カラムの定義が一目で分かるようにしたい、そうすることで dashboard / progress-tracking 設計時に齟齬なく参照できる。

#### Acceptance Criteria

1. The Domain Steering Document shall `.kiro/steering/domain.md` の「wbs-YAML ↔ EVM Studio フィールド対応」表に `schedule.meta.project_status` → `Project.status`、`schedule.meta.project_code` → `Project.code`、`staffing.members[].role` → `Member.role`、`staffing.members[].initials` → `Member.initials` の 4 行を追加する。
2. The Domain Steering Document shall 「データモデル概要」セクションに `Project.status` の有効値リスト（`active` / `paused` / `draft` / `archived`）と `Member.role` の参考プリセットリストを追記する。

### Requirement 8: テストカバレッジ

**Objective:** EVM Studio 開発者 として、スキーマ拡張とインポーター挙動が想定通りであることをユニットテストで保証したい、そうすることでリグレッションを早期に検知できる。

#### Acceptance Criteria

1. The Test Suite shall `members` テーブルへの `role` / `initials` 書き込み・読み出しを検証する単体テストを含める。
2. The Test Suite shall `projects` テーブルへの `status` / `code` 書き込み・読み出しを検証する単体テストを含める。
3. The Test Suite shall WBS Importer が新フィールドを正しく取り込むケースと、新フィールドを欠いた YAML を後方互換で処理するケースの両方を検証する。
4. The Test Suite shall Members Service の `initials` 自動生成ロジックを少なくとも 3 ケース（半角空白で分割可、全角空白で分割可、空白なしで先頭 2 文字）検証する。
5. When `npm test` を実行する、 the Vitest Runner shall 上記すべてのテストがパスする。
