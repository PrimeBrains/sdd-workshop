# Roadmap

## Overview

EVM Studio は WBS YAML を取り込み進捗を記録して EVM メトリクスをリアルタイム可視化するローカル Web アプリ。
wbs-* スキルが生成する YAML（tasks / staffing / schedule）を入力とし、決定論的な EVM 計算エンジンと単一ワークベンチ型ダッシュボード UI を提供する。

UI の正典は `mockup/variation-a.jsx`。**3画面構成（旧）から1画面ワークベンチ + モーダル群（新）への全面リストラクチャ**を目的に、既存4スペック (`core-data-model` / `evm-engine` / `progress-tracking` / `dashboard`) を再生成する。

## Approach Decision

- **Chosen**: ローカルファースト Web アプリ（Hono + SQLite + React）+ **mockup 駆動のワークベンチ UI**
- **Why**: クラウドインフラ不要、`npm start` のみで起動、PM の毎日の状況確認・進捗反映を1画面で完結
- **Rejected alternatives**: Firebase/SaaS（クラウド依存）、CLI ツール（UI なし）、複数ページ SPA（モックアップ通りでない・遷移コスト大）

## Scope

- **In**: WBS YAML インポート、プロジェクト/タスク/メンバー管理、EVM 計算 + 前日比、進捗入力（モーダル）、単一ワークベンチダッシュボード、GanttFullscreen、ChartFullscreen、Inspector (Task/Member/Team)
- **Out**: WBS 生成（wbs-* スキルが担う）、認証・認可（ローカル限定）、xlsm インポート（将来対応）、朝報エクスポート（将来対応）

## Constraints

- Node.js 22、Hono 4 + tRPC 11 + Drizzle ORM 0.45 + React 19 + Vite 8 + TailwindCSS 4
- Anthropic SDK 不使用
- `evm-studio/` 配下に全コードを配置（`server/`, `client/`, `e2e/`）
- **UI 仕様の正典は `mockup/variation-a.jsx`**。実装は同モックアップを TSX に移植する形を取る
- 既存実装 (`evm-studio/`) は段階的に置き換える。コアロジック（EVM 計算・スキーマ）は流用、UI 層は全面書き換え

## Boundary Strategy

- **Why this split**: データモデル → 計算 → 進捗 → UI の依存方向に沿って分割。上流が固まってから下流を仕様化する
- **Shared seams to watch**:
  - Task / Member エンティティは全スペックが参照する中核
  - **前日比 (prevDay)** は evm-engine / progress-tracking / dashboard 共通の概念で、責務分担を明確にする
  - **status (active / paused / draft / archived)** は core-data-model で持ち、dashboard が表示する

## Specs (dependency order)

- [x] core-data-model -- Project/Task/Member の CRUD + SQLite スキーマ + wbs-YAML インポート。**Project.status / Member.role / 担当者カラーの追加**。Dependencies: none
- [x] evm-engine -- PV/EV/AC/SPI/CPI/EAC/CCPM バッファ計算 + クリティカルパス + **前日比 (prevDay) 計算 + 担当者別 EVM**。Dependencies: core-data-model
- [x] progress-tracking -- 日次進捗スナップショット + **過去日付指定 / 本日のAC追加（MD・h単位） / 計画線比較 / メモ**。Dependencies: core-data-model
- [x] dashboard -- **mockup/variation-a.jsx を正典とする単一ワークベンチ画面**。トップバー / 左レール / サマリストリップ（前日比トグル）/ アラートストリップ / ガント / SPIトレンド / フィーバーチャート / Inspector (Task/Member/Team) / GanttFullscreen（検索・フィルター・進捗入力サブパネル）/ ChartFullscreen。Dependencies: evm-engine, progress-tracking

## 既存 spec の再生成方針

各 spec の `phase` を `implemented` のままにせず、Discovery 完了後に再生成する：

1. `brief.md` を mockup ベースで書き直す（このフェーズで完了）
2. `/kiro-spec-batch` または各 spec で `/kiro-spec-requirements` を実行して requirements / design / tasks を再生成
3. `/kiro-impl` で実装をやり直す（既存実装は段階的に置き換え）

既存実装の扱い：
- **流用**: SQLite スキーマの大半、EVM 計算純粋関数、tRPC ルーター骨格
- **書き換え**: client/src/ 全体（pages 分離 → 単一ワークベンチ）、進捗入力（独立ページ → モーダル）
- **新規**: ProjectRail, Inspector (3モード), GanttFullscreen, ChartFullscreen, SummaryStrip（前日比トグル付き）, AlertStrip
