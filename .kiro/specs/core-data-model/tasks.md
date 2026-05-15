# 実装計画

## 1. 基盤整備（スキーマと共通定数）

- [x] 1.1 Drizzle スキーマに `projects.status` / `projects.code` / `members.role` / `members.initials` の 4 カラムを追加する
  - `evm-studio/server/src/db/schema.ts` の `projects` テーブル定義に `status: text('status').notNull().default('active')` と `code: text('code')` を追記する
  - 同ファイルの `members` テーブル定義に `role: text('role')` と `initials: text('initials')` を追記する
  - Drizzle の型推論経由で `Project` / `Member` の型に新カラムが現れることを `tsc --noEmit` で確認する
  - 観測可能な完了条件: `pnpm tsc --noEmit`（または `npx tsc --noEmit`）が成功し、`Project` / `Member` 型に新カラムが含まれることを `import type` で別ファイルから参照しても通る
  - _Requirements: 1.1, 1.2, 2.1, 2.2_
  - _Boundary: db/schema.ts_

- [x] 1.2 マイグレーション `0001_add_status_code_role_initials.sql` を生成し、既存データを保持する形式に手動調整する
  - `drizzle-kit generate` で差分 SQL を出力し、`evm-studio/server/src/db/migrations/0001_add_status_code_role_initials.sql` として保存する
  - SQL が `ALTER TABLE ADD COLUMN` 形式になっているかを確認し、テーブル再作成方式が選ばれていたら 4 行の `ALTER TABLE ADD COLUMN` 文に書き換える
  - drizzle-kit のメタディレクトリ (`migrations/meta`) を更新内容に合わせて整合させる
  - 観測可能な完了条件: クリーンな DB に `drizzle-kit migrate` を実行すると `0000_*` → `0001_*` の順で適用が成功し、`PRAGMA table_info(projects)` / `PRAGMA table_info(members)` の出力に新 4 カラムが現れる
  - _Requirements: 1.6, 2.8, 3.1, 3.2_
  - _Boundary: db/migrations_
  - _Depends: 1.1_

- [x] 1.3 `IMPORT_INVALID_PROJECT_STATUS` エラーコードを `ErrorCode` 定数に追加する
  - `evm-studio/server/src/errors/codes.ts` の `ErrorCode` オブジェクトに `IMPORT_INVALID_PROJECT_STATUS: 'IMPORT_INVALID_PROJECT_STATUS'` を追加する
  - 観測可能な完了条件: `ErrorCode.IMPORT_INVALID_PROJECT_STATUS` を別ファイルから参照しても TypeScript 型エラーが出ない
  - _Requirements: 4.6_
  - _Boundary: errors/codes.ts_

## 2. ドメインサービス（イニシャル自動生成）

- [x] 2.1 (P) `services/members-service.ts` にイニシャル自動生成関数 `generateInitials` を実装する
  - `evm-studio/server/src/services/members-service.ts` を新規作成する
  - 半角空白 / 全角空白で `name` を分割し、2 トークン以上なら姓 + 名の先頭 1 文字ずつを連結して返す
  - 分割できない場合は `Array.from(name).slice(0, 2).join('')` を返す
  - サロゲートペア・絵文字を考慮し、コード単位ではなく文字単位で扱う
  - 観測可能な完了条件: `generateInitials('田中 美咲') === '田美'`、`generateInitials('田中　美咲') === '田美'`、`generateInitials('伊藤健太') === '伊藤'` が成立する
  - _Requirements: 2.6, 2.7_
  - _Boundary: services/members-service.ts_

- [x] 2.2 (P) `services/members-service.test.ts` を追加し、`generateInitials` の単体テストを実装する
  - Vitest 4 を用いて、半角空白 / 全角空白 / 空白なし / サロゲートペア（絵文字を含む名前）の 4 ケースをテストする
  - 観測可能な完了条件: `npm test -- members-service` で 4 ケースがすべてパスする
  - _Requirements: 2.6, 2.7, 8.4_
  - _Boundary: services/members-service.test.ts_

## 3. データアクセスとインポーター拡張

- [x] 3.1 WBS Importer の Zod スキーマに新オプショナルフィールドを追加する
  - `evm-studio/server/src/services/wbs-importer.ts` の `schedule.meta` 用 Zod スキーマに `project_status: z.enum(['active','paused','draft','archived']).optional()` と `project_code: z.string().optional()` を追加する
  - `staffing.members[]` 用 Zod スキーマに `role: z.string().nullable().optional()` と `initials: z.string().min(1).max(4).nullable().optional()` を追加する
  - 既存の `meta` / `members` 構造は維持し、新フィールド以外の検証ルールを変えない
  - 観測可能な完了条件: 新フィールドを含む YAML テキストを Zod 経由でパースした結果に、`project_status` / `project_code` / `role` / `initials` が含まれる（または `undefined`）になる
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_
  - _Boundary: services/wbs-importer.ts_
  - _Depends: 1.1, 1.3_

- [x] 3.2 WBS Importer の DB 書き込み処理に新フィールドの反映と `IMPORT_INVALID_PROJECT_STATUS` ハンドリングを追加する
  - パース後の `project_status` が enum 範囲外と判定された場合は `AppError` を `ErrorCode.IMPORT_INVALID_PROJECT_STATUS` でスローする（Zod が enum 違反を捕捉する場合は `ZodError` を `IMPORT_INVALID_PROJECT_STATUS` に変換する）
  - `projects.upsert` 時に `project_status` が指定されていればそれを、未指定なら DB のデフォルト `'active'` を採用する
  - `members.upsert` 時に `role` / `initials` を反映し、`initials` が省略 (`undefined`) かつ `name` から自動生成可能な場合は `generateInitials(name)` で補完する。`null` が明示されている場合は `null` のまま保存する
  - 観測可能な完了条件: 新フィールド付き YAML を import すると DB の `projects.status` / `projects.code` / `members.role` / `members.initials` に値が反映される
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - _Boundary: services/wbs-importer.ts_
  - _Depends: 2.1, 3.1_

- [x] 3.3 (P) WBS Importer のテストに新フィールドの取り込み・後方互換・無効 status の 3 ケースを追加する
  - `evm-studio/server/src/services/wbs-importer.test.ts` に新フィールドあり YAML、新フィールドなし YAML、`project_status: 'unknown'` の YAML の 3 ケースを追加する
  - 観測可能な完了条件: 3 ケースを含む `npm test -- wbs-importer` が全件パスし、無効 status ケースで `IMPORT_INVALID_PROJECT_STATUS` がスローされる
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.3_
  - _Boundary: services/wbs-importer.test.ts_
  - _Depends: 3.2_

## 4. tRPC ルーター拡張

- [x] 4.1 (P) `api/projects.ts` の入力 Zod スキーマと出力型を拡張する
  - `createProjectSchema` / `updateProjectSchema` に `status: z.enum(['active','paused','draft','archived']).default('active')` と `code: z.string().nullable().optional()` を追加する
  - `projects.list` / `projects.getById` のレスポンスが Drizzle 推論型 `Project` のまま `status` / `code` を含むことをコメントで明示する
  - 観測可能な完了条件: `projects.create` で `status='paused'` / `code='NXP-002'` を送信して保存できる
  - _Requirements: 1.3, 1.4, 1.5, 6.1, 6.3, 6.5_
  - _Boundary: api/projects.ts_
  - _Depends: 1.1_

- [x] 4.2 (P) `api/members.ts` の入力 Zod スキーマと出力型を拡張し、`initials` 自動生成を統合する
  - `createMemberSchema` / `updateMemberSchema` に `role: z.string().nullable().optional()` と `initials: z.string().min(1).max(4).nullable().optional()` を追加する
  - `members.create` ハンドラ内で `initials === undefined` かつ `name` が非空の場合に `generateInitials(name)` で補完する。`initials === null` のときは `null` を保存する
  - `members.listByProject` / `members.getById` のレスポンスが Drizzle 推論型 `Member` のまま `role` / `initials` を含むことを確認する
  - 観測可能な完了条件: `members.create` を `initials` 未指定で呼ぶと DB 上で `'田美'` 等が保存され、`role` の任意文字列も受け入れられる
  - _Requirements: 2.3, 2.4, 2.5, 6.2, 6.4, 6.5_
  - _Boundary: api/members.ts_
  - _Depends: 1.1, 2.1_

- [x] 4.3 (P) Projects tRPC ルーターのテストに `status` / `code` の入出力検証を追加する
  - `evm-studio/server/src/api/projects.test.ts` に、 `status='invalid'` で Zod バリデーションエラーが返ること、`status='paused'` / `code='NXP-002'` で create が成功し list / getById のレスポンスに新カラムが含まれることを確認するケースを追加する
  - 観測可能な完了条件: `npm test -- projects` が拡張ケースを含めて全件パスする
  - _Requirements: 1.3, 1.4, 1.5, 6.1, 6.3, 8.2_
  - _Boundary: api/projects.test.ts_
  - _Depends: 4.1_

- [x] 4.4 (P) Members tRPC ルーターのテストに `role` / `initials` の入出力検証を追加する
  - `evm-studio/server/src/api/members.test.ts` に、`initials='12345'` で Zod バリデーションエラーが返ること、`initials` 未指定で create を呼ぶと自動生成された値が保存されること、`role` の任意文字列が保存・取得できることを確認するケースを追加する
  - 観測可能な完了条件: `npm test -- members` が拡張ケースを含めて全件パスする
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 6.2, 6.4, 8.1_
  - _Boundary: api/members.test.ts_
  - _Depends: 4.2_

## 5. シードデータ

- [x] 5.1 モックアップ準拠のシード定数モジュールを作成する
  - `evm-studio/server/seeds/mockup-projects.ts` を新規作成し、`mockup/projects-data.jsx` の 5 プロジェクト分（projects / members / tasks / dependencies / holidays）を TypeScript 定数として転記する
  - `assignee` 文字列を `external_id` ベースで突き合わせられるように事前マップを定義する
  - 観測可能な完了条件: `import { mockupProjects } from './mockup-projects'` がコンパイル通過し、配列長が `5` であることを起動時アサーションで確認できる
  - _Requirements: 5.1, 5.3_
  - _Boundary: seeds/mockup-projects.ts_

- [x] 5.2 シードスクリプト `seeds/seed.ts` と `npm run seed` を実装する
  - `evm-studio/server/seeds/seed.ts` を新規作成し、better-sqlite3 / Drizzle 経由で `projects` → `members` → `tasks` → `task_dependencies` → `holidays` の順で投入する
  - `--reset` フラグで既存テーブルを `DELETE FROM` してから投入する。フラグなしでも安全側に倒し、デフォルトで初期化挙動を取る
  - 投入はトランザクション内で実行し、失敗時はロールバック + `process.exit(1)`
  - 完了時に件数を `console.log` で表示する
  - `evm-studio/package.json` の `scripts` に `"seed": "tsx server/seeds/seed.ts"` を追加する
  - 観測可能な完了条件: `npm run seed` 実行後に `projects: 5 / members: N / tasks: N / dependencies: N / holidays: N` が標準出力に表示され、SQLite を直接読むと各テーブルにデータが入っている
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - _Boundary: seeds/seed.ts, package.json_
  - _Depends: 1.2, 5.1_

## 6. ステアリング更新

- [x] 6.1 `.kiro/steering/domain.md` のフィールド対応表とデータモデル概要を更新する
  - 「wbs-YAML ↔ EVM Studio フィールド対応」表に 4 行を追加する: `schedule.meta.project_status` → `Project.status` / `schedule.meta.project_code` → `Project.code` / `staffing.members[].role` → `Member.role` / `staffing.members[].initials` → `Member.initials`
  - 「データモデル概要」セクションの `Project` 行に `status` の有効値リスト（`active` / `paused` / `draft` / `archived`）と `code` を追記する
  - 同セクションの `Member` 行に `role` の参考プリセット（`PM`, `Lead Eng`, `Engineer`, `Designer`, `QA`, `BA`, `Security`, `Analyst`）と `initials` の説明を追記する
  - 観測可能な完了条件: `domain.md` を grep して `project_status` と `Member.role` が記載されていることを確認できる
  - _Requirements: 7.1, 7.2_
  - _Boundary: .kiro/steering/domain.md_

## 7. 統合検証

- [x] 7.1 マイグレーション後方互換の統合テストを追加する
  - `evm-studio/server/src/db/db.test.ts` に、既存 `0000_*.sql` 適用済みの SQLite に `0001_*.sql` を追加適用するシナリオを書き、`projects` / `members` / `tasks` / `progress_snapshots` / `task_dependencies` / `holidays` が全件保持されており、新カラムが `status='active'` / NULL になっていることを確認する
  - エラー注入テスト（不正 SQL を渡す等）でロールバックが効くことも 1 ケース追加する
  - 観測可能な完了条件: `npm test -- db` が新規ケースを含めて全件パスする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: db/db.test.ts_
  - _Depends: 1.2, 4.1, 4.2_

- [x] 7.2 `npm test` のフルラン + シード投入で受け入れ条件を最終確認する
  - `npm test` を実行し、全テスト（schema / members-service / wbs-importer / projects / members / db）がパスすることを確認する
  - クリーンな DB に `drizzle-kit migrate` + `npm run seed` を順に実行し、SQLite クライアントで 5 プロジェクト分のデータと新カラムが入っていることを目視確認する
  - 観測可能な完了条件: `npm test` が green、`npm run seed` 後の DB に `projects.code='NXP-002'` 等が存在することを `SELECT` 文で確認できる
  - _Requirements: 8.5_
  - _Boundary: 統合検証_
  - _Depends: 2.2, 3.3, 4.3, 4.4, 5.2, 7.1_
