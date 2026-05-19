# Project Structure

## Organization Philosophy

サーバーとクライアントをトップレベルで分離し、それぞれ独立してビルド・テスト可能にする。ビジネスロジックはサーバーの `services/` に集約し、API 層・DB 層・UI 層を明確に分ける。

クライアントは **単一ワークベンチ画面** (`WorkbenchPage`) + **モーダル群** の構成を取り、ページルーティングを最小化する（pages/ には 1 ページのみ）。コンポーネントはモックアップ `mockup/variation-a.jsx` のセクション構造に対応させる。

## Directory Patterns

### Backend
**Location**: `server/src/`
- `api/` — Hono ルートハンドラー。ドメインごとにファイル分割（`projects.ts`, `tasks.ts` 等）。ルーティングのみ担当し、ロジックは `services/` に委譲する
- `db/` — Drizzle スキーマ定義（`schema.ts`）とマイグレーションファイル
- `services/` — ビジネスロジック。純粋関数で実装し、副作用は持たない
- `services/evm-engine.ts` — PV/EV/AC/SPI/CPI/EAC + 前日比計算
- `services/wbs-importer.ts` — wbs-YAML → DB

### Frontend
**Location**: `client/src/`
- `pages/`
  - `WorkbenchPage.tsx` — 唯一のページ。トップバー + 左レール + 中央 + 右 Inspector を構成
- `components/`
  - **shell/**
    - `TopBar.tsx` — ブランド + プロジェクトピッカー + 基準日ピッカー + 通知/アバター
    - `ProjectRail.tsx` — 左レール（Projects + Members）
    - `Inspector.tsx` — 右パネル（Task/Member/Team タブ）
  - **summary/**
    - `SummaryStrip.tsx` — 中央上部の数値帯（前日比トグル付き）
    - `SummaryStat.tsx` — 個別メトリクスの表示原子
  - **alerts/**
    - `AlertStrip.tsx` — アラートストリップ or HEALTHY バナー
  - **gantt/**
    - `GanttChart.tsx` — 通常表示のミニガント
    - `GanttFullscreen.tsx` — モーダル版（フィルタ・検索・進捗入力サブパネル含む）
    - `ProgressInputPanel.tsx` — GanttFullscreen 内サブパネル（スナップショット日付・進捗率・AC追加・メモ）
  - **charts/**
    - `SpiTrendChart.tsx` — SPI/CPI 折れ線（SVG）
    - `FeverChart.tsx` — CCPM フィーバー（4象限散布図、SVG）
    - `Sparkline.tsx` — Inspector 用ミニ折れ線
    - `ChartFullscreen.tsx` — モーダル版（trend / fever）
  - **inspector/**
    - `InspectorTaskMode.tsx`
    - `InspectorMemberMode.tsx`
    - `InspectorTeamMode.tsx`
  - **atoms/**
    - `Card.tsx` / `Pill.tsx` / `Dot.tsx` / `Eyebrow.tsx` / `Avatar.tsx` / `BrandMark.tsx` / `FilterChip.tsx` / `Chevron.tsx`
- `hooks/` — TanStack Query を使ったデータフェッチフック（`useProjects`, `useEvm`, `usePrevDay` 等）
- `state/` — 軽量グローバル状態（選択中プロジェクト ID / 基準日 / Inspector モード / フィルター）。Zustand または React Context を検討
- `tokens/` — `evm-tokens.ts`（mockup の EVM オブジェクト由来の色・フォント定数）

### Specs
**Location**: `.kiro/specs/`
- 機能ごとにサブディレクトリを作成（例: `evm-engine/`, `dashboard/`）
- 各機能に `requirements.md` / `design.md` / `tasks.md` の 3 ファイル
- 任意で `brief.md`（Discovery で生成）/ `research.md`

### Mockup（実装の正典）
**Location**: `mockup/`
- `evm-app.html` — エントリポイント
- `workbench-shell.jsx` / `variation-a.jsx` — 画面実装
- `shared.jsx` — トークン・原子コンポーネント・チャート
- `projects-data.jsx` — 5プロジェクトのテストデータ
- 実装フェーズでの参照源とする。UI 仕様の最終判断は mockup に従う

## Naming Conventions

### ファイル名
- **サーバーファイル**: `kebab-case.ts`（例: `evm-engine.ts`, `wbs-importer.ts`）
- **クライアントコンポーネント**: `PascalCase.tsx`（例: `ProjectRail.tsx`, `SpiTrendChart.tsx`）
- **クライアントフック**: `camelCase.ts`、`use` プレフィックス（例: `useProjects.ts`, `useEvm.ts`）
- **テストファイル**: ソースと同じディレクトリにコロケーション、`*.test.ts`（例: `evm-engine.test.ts`）
- **スペック機能名**: `kebab-case`（例: `evm-engine`, `core-data-model`）

### DB テーブル・カラム名
- **テーブル名**: 複数形 snake_case（例: `projects`, `tasks`, `members`, `progress_snapshots`）
- **カラム名**: snake_case（DB 標準。Drizzle の `.$defaultFn` / column mapping で TS 側は camelCase に変換）

```typescript
plannedStart: text('planned_start')
createdAt:    integer('created_at', { mode: 'timestamp' })
```

### tRPC プロシージャ名
CRUD は以下の動詞に統一する：

| 操作 | 名前 | 例 |
|------|------|---|
| 一覧取得 | `list` | `projects.list` |
| 単件取得 | `getById` | `projects.getById` |
| 作成 | `create` | `projects.create` |
| 更新 | `update` | `projects.update` |
| 削除 | `delete` | `projects.delete` |
| 集計・計算系 | 動詞 + 名詞 | `evm.calculate`, `evm.calculateWithDelta`, `reports.morning` |

### TypeScript 型・Zod スキーマ
- **エンティティ型**: PascalCase（例: `Project`, `Task`, `Member`）
- **入力型**: `動詞 + エンティティ + Input`（例: `CreateProjectInput`, `RecordProgressInput`）
- **Zod スキーマ**: `camelCase + Schema`（例: `createProjectSchema`, `recordProgressSchema`）

### 環境変数
- クライアント公開変数: `VITE_` プレフィックス必須（例: `VITE_API_URL`）
- サーバー変数: UPPER_SNAKE_CASE（例: `PORT`, `DB_PATH`）

## Import Organization

```typescript
// サーバー: 相対パスを基本とする
import { calculateSpi } from '../services/evm-engine'
import { db } from '../db'

// クライアント: Vite パスエイリアス (@/ → src/)
import { Inspector } from '@/components/shell/Inspector'
import { useEvm } from '@/hooks/useEvm'
import { EVM } from '@/tokens/evm-tokens'
```

## Branch Strategy

GitHub Flow を採用する。

| ブランチ | 用途 | 命名例 |
|---------|------|-------|
| `main` | 常に動作する状態を保つ | — |
| `feature/{spec-name}` | 機能開発（kiro スペック名と対応） | `feature/evm-engine` |
| `fix/{description}` | バグ修正 | `fix/spi-zero-division` |

- **kiro スペック1つ = ブランチ1つ**。`feature/dashboard` を切ったら `.kiro/specs/dashboard/` で仕様化 → 実装 → PR → main
- **マージ方法**: Squash merge
- **コミットメッセージ**: Conventional Commits に統一

```
feat: EVM 計算エンジンの SPI 算出を実装
fix: PV=0 時の SPI が null にならない問題を修正
docs: domain.md にバッファ管理の計算式を追記
```

## Code Organization Principles

- `api/` はルーティングと入力バリデーションのみ。ビジネスロジックは書かない
- `services/evm-engine.ts` は純粋関数のみ構成し、DB アクセスを持たない
- `services/wbs-importer.ts` が wbs-YAML → DB エンティティへの変換を単一責任で担う
- クライアントのデータフェッチは TanStack Query を介し、`hooks/` に封じ込める
- **UI 仕様の正典は `mockup/variation-a.jsx`**。実装中に判断に迷ったらモックアップを参照する
- **コンポーネントの責務単位** はモックアップのセクションに対応させる（例: AlertStrip / SummaryStrip / Inspector などはモックアップの境界をそのまま採用）
- グローバル状態の最小化: 選択中プロジェクト ID・基準日・Inspector モード・フィルター以外は React Query キャッシュに任せる

## Single Source of Truth (defect-pdca #0002 由来)

同一リソース (DB ファイルパス / 環境変数 / ポート / 設定値) を複数箇所で独立に解決すると、解決基準のズレで分裂する。

- **DB パス / 環境変数 / ポート / config 値は 1 箇所で定義し、他は import 経由で参照** する
- **相対パスは解決基準 (`__dirname` vs cwd) が異なるプロセスを跨ぐと壊れる**。CLI とサーバの両方が使うパスは絶対パス or 環境変数で統一
- **ライブラリ固有の落とし穴** (SQLite AUTOINCREMENT / WAL モード / better-sqlite3 transaction 等) は design.md の Allowed Dependencies / Revalidation Triggers で明示文書化

Evidence: `.kiro/postmortem/defects.md` #0002 — `seed.ts` (root 起点) と `server/src/db/index.ts` (cwd 起点) が別ファイルの `evm-studio.db` を独立に作っていた。
