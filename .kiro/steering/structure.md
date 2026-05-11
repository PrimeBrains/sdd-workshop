# Project Structure

## Organization Philosophy

サーバーとクライアントをトップレベルで分離し、それぞれ独立してビルド・テスト可能にする。ビジネスロジックはサーバーの `services/` に集約し、API 層・DB 層・UI 層を明確に分ける。

## Directory Patterns

### Backend
**Location**: `server/src/`
- `api/` — Hono ルートハンドラー。ドメインごとにファイル分割（`projects.ts`, `tasks.ts` 等）。ルーティングのみ担当し、ロジックは `services/` に委譲する
- `db/` — Drizzle スキーマ定義（`schema.ts`）とマイグレーションファイル
- `services/` — ビジネスロジック。純粋関数で実装し、副作用は持たない

### Frontend
**Location**: `client/src/`
- `pages/` — ページ単位のコンポーネント（`ProjectsPage`, `DashboardPage` 等）
- `components/` — 再利用可能な UI コンポーネント
- `hooks/` — TanStack Query を使ったデータフェッチフック

### Specs
**Location**: `.kiro/specs/`
- 機能ごとにサブディレクトリを作成（例: `evm-engine/`, `core-data-model/`）
- 各機能に `requirements.md` / `design.md` / `tasks.md` の 3 ファイル

## Naming Conventions

### ファイル名
- **サーバーファイル**: `kebab-case.ts`（例: `evm-engine.ts`, `wbs-importer.ts`）
- **クライアントコンポーネント**: `PascalCase.tsx`（例: `ProjectCard.tsx`, `SpiChart.tsx`）
- **クライアントフック**: `camelCase.ts`、`use` プレフィックス（例: `useProjects.ts`, `useEvm.ts`）
- **テストファイル**: ソースと同じディレクトリにコロケーション、`*.test.ts`（例: `evm-engine.test.ts`）
- **スペック機能名**: `kebab-case`（例: `evm-engine`, `core-data-model`）

### DB テーブル・カラム名
- **テーブル名**: 複数形 snake_case（例: `projects`, `tasks`, `members`, `progress_snapshots`）
- **カラム名**: snake_case（DB 標準。Drizzle の `.$defaultFn` / column mapping で TS 側は camelCase に変換）

```typescript
// DB は snake_case、TS アクセスは camelCase
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
| 集計・計算系 | 動詞 + 名詞 | `evm.calculate`, `reports.morning` |

### TypeScript 型・Zod スキーマ
- **エンティティ型**: PascalCase（例: `Project`, `Task`, `Member`）
- **入力型**: `動詞 + エンティティ + Input`（例: `CreateProjectInput`, `UpdateTaskInput`）
- **Zod スキーマ**: `camelCase + Schema`（例: `createProjectSchema`, `updateTaskSchema`）

### 環境変数
- クライアント公開変数: `VITE_` プレフィックス必須（例: `VITE_API_URL`）
- サーバー変数: UPPER_SNAKE_CASE（例: `PORT`, `DB_PATH`）
- `.env.example` をリポジトリに含め、実際の `.env` は `.gitignore` に追加

## Import Organization

```typescript
// サーバー: 相対パスを基本とする
import { calculateSpi } from '../services/evm-engine'
import { db } from '../db'

// クライアント: Vite パスエイリアス (@/ → src/)
import { SpiChart } from '@/components/SpiChart'
import { useProjects } from '@/hooks/useProjects'
```

## Branch Strategy

GitHub Flow を採用する。

| ブランチ | 用途 | 命名例 |
|---------|------|-------|
| `main` | 常に動作する状態を保つ | — |
| `feature/{spec-name}` | 機能開発（kiro スペック名と対応） | `feature/evm-engine` |
| `fix/{description}` | バグ修正 | `fix/spi-zero-division` |

- **kiro スペック1つ = ブランチ1つ**。`feature/evm-engine` を切ったら `.kiro/specs/evm-engine/` で仕様化 → 実装 → PR → main
- **マージ方法**: Squash merge（feature ブランチの細かいコミットを1つにまとめて main に入れる）
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
