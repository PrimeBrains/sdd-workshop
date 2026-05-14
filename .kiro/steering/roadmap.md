# Roadmap

## Overview

EVM Studio は WBS YAML を取り込み進捗を記録して EVM メトリクスをリアルタイム可視化するローカル Web アプリ。
wbs-* スキルが生成する YAML（tasks / staffing / schedule）を入力とし、決定論的な EVM 計算エンジンと可視化 UI を提供する。

## Approach Decision

- **Chosen**: ローカルファースト Web アプリ（Hono + SQLite + React）
- **Why**: クラウドインフラ不要、`npm start` のみで起動、インターネット環境がない現場でも動作する
- **Rejected alternatives**: Firebase/SaaS（クラウド依存）、CLI ツール（UI なし）

## Scope

- **In**: WBS YAML インポート、プロジェクト/タスク/メンバー管理、EVM 計算、進捗入力、ダッシュボード
- **Out**: WBS 生成（wbs-* スキルが担う）、認証・認可（ローカル限定）、xlsm インポート（将来対応）

## Constraints

- Node.js 22、Hono 4 + tRPC 11 + Drizzle ORM 0.45 + React 19 + Vite 8 + TailwindCSS 4
- Anthropic SDK 不使用
- `evm-studio/` 配下に全コードを配置（`server/`, `client/`, `e2e/`）

## Boundary Strategy

- **Why this split**: データモデル → 計算 → UI の依存方向に沿って分割。上流が固まってから下流を仕様化する
- **Shared seams to watch**: Task エンティティは全スペックが参照する中核。型定義の変更は全スペックに影響する

## Specs (dependency order)

- [x] core-data-model -- Project/Task/Member の CRUD + SQLite スキーマ + wbs-YAML インポート。Dependencies: none
- [x] evm-engine -- PV/EV/AC/SPI/CPI/EAC/CCPM バッファ計算エンジン + クリティカルパス算出。Dependencies: core-data-model
- [x] progress-tracking -- 進捗記録（実績工数・完了率の日次入力）+ スナップショット管理。Dependencies: core-data-model
- [x] dashboard -- SPI トレンドチャート・フィーバーチャート・アラート・担当者別 EVM 可視化。Dependencies: evm-engine, progress-tracking
