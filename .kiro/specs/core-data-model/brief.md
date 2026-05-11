# Brief: core-data-model

## Problem
EVM 計算・進捗管理・レポート生成の基盤となるデータモデルが存在しない。プロジェクト・タスク・メンバーを永続化する手段がなく、wbs-* スキルが生成した YAML を取り込む仕組みもない。

## Current State
`evm-studio/` は空のスキャフォールドのみ。SQLite スキーマ・tRPC ルーター・インポートロジックはいずれも未実装。

## Desired Outcome
- Project / Task / Member / Holiday エンティティの CRUD が tRPC 経由で動作する
- wbs-YAML（tasks.yaml / staffing.yaml / schedule.yaml）をインポートしてDBに格納できる
- 全スペックが参照する共通型（Task 等）が確定する

## Approach
Drizzle ORM で SQLite スキーマを定義し、tRPC ルーターで CRUD を提供する。YAML インポートは `services/wbs-importer.ts` が担い、API 層からは単一エンドポイントで呼び出せるようにする。

## Scope
- **In**: Drizzle スキーマ定義、マイグレーション、tRPC CRUD（Project/Task/Member/Holiday）、wbs-YAML インポートエンドポイント
- **Out**: EVM 計算ロジック、進捗記録、UI コンポーネント、xlsm インポート

## Boundary Candidates
- `server/src/db/schema.ts` — Drizzle スキーマ（全エンティティ）
- `server/src/services/wbs-importer.ts` — YAML → DB 変換ロジック
- `server/src/api/projects.ts`, `tasks.ts`, `members.ts` — tRPC ルーター

## Out of Boundary
- EVM メトリクス計算（evm-engine が担う）
- 進捗スナップショットの記録（progress-tracking が担う）
- 画面表示（dashboard / reporting が担う）

## Upstream / Downstream
- **Upstream**: wbs-* スキル（YAML 生成側）、steering の domain.md（フィールド対応表）
- **Downstream**: evm-engine、progress-tracking（Task エンティティの型を参照）
