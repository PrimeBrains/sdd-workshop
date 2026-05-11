# Technology Stack

## Architecture

フロントエンド（React SPA）とバックエンド（Hono API）を同一リポジトリで管理するモノレポ構成。SQLite によりクラウド不要でローカル完結する。

## Core Technologies

- **Language**: TypeScript（フロント・サーバー共通）
- **Frontend**: React 19.2 + Vite 8 + TailwindCSS 4
- **Backend**: Hono 4.12（Node.js ランタイム）
- **Database**: SQLite（better-sqlite3 12）+ Drizzle ORM 0.45
- **Runtime**: Node.js 22 LTS

## Key Libraries

- **tRPC 11**: サーバー型定義がクライアントに自動で流れるエンドツーエンド型安全 API（REST ではなく tRPC を使う）
- **Drizzle ORM 0.45**: TypeScript ネイティブなスキーマ定義と型推論
- **TanStack Query 5**: tRPC クライアントのデータフェッチ・キャッシュ管理（tRPC の公式 integration を使用）
- **Zod 4**: tRPC ルーターの入力バリデーション
- **pino 10**: サーバーサイドの構造化ログ（JSON 形式）。`hono/logger` ミドルウェアで HTTP リクエストログ、`pino` でビジネスロジック層のログを出力する。クライアントサイドは `console` のみ。
- **js-yaml 4**: WBS YAML インポート（SAFE_LOAD オプション使用）
- **Vitest 4**: 単体テスト
- **concurrently 9**: `npm start` 一発でサーバー + クライアントを同時起動

## Development Standards

### Type Safety
- TypeScript strict モード必須
- Drizzle スキーマから推論される型を優先し、手動 `type` / `interface` 定義は最小限に
- `any` 禁止

### Code Quality
- ESLint + Prettier
- `services/` 層の関数は純粋関数（副作用なし）を原則とし、単体テストを容易にする

### Testing
- EVM 計算エンジン（`services/evm-engine.ts`）は境界値・エラーケースを含む単体テスト必須
- Vitest を使用

### Security

- **入力バリデーション**: tRPC ルーターで Zod によるスキーマバリデーション必須
- **YAML インポート**: パース前に構造検証、`js-yaml` の `SAFE_LOAD` オプション使用
- **SQL インジェクション**: Drizzle ORM のパラメータ化クエリで自動対応
- **XSS**: React のデフォルトエスケープで対応、`dangerouslySetInnerHTML` 禁止
- **CORS**: Hono の CORS を `localhost` のみに制限

**個人情報（担当者名）の取り扱い**
- ログに個人名を含めない。タスク ID・プロジェクト ID に留める
- 匿名化（担当者名 → 担当者A/B/C）は将来対応。レポート出力時に差し込めるよう、担当者名の参照箇所を `Member.name` に集約しておく

### Exception Design

**ビジネスロジック層**: カスタム例外クラスで throw する
```typescript
// server/src/errors/codes.ts — 全エラーコードの唯一の定義場所
export const ErrorCode = {
  EVM_INVALID_BASE_DATE: 'EVM_INVALID_BASE_DATE',
  EVM_PV_ZERO:           'EVM_PV_ZERO',
  PROJ_NOT_FOUND:        'PROJ_NOT_FOUND',
  // ...
} as const
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message)
  }
}
```

- エラーコードは `DOMAIN_REASON` 形式のスネークケース文字列（例: `EVM_INVALID_BASE_DATE`）
- ドメインプレフィックス: `EVM_`, `PROJ_`, `TASK_`, `MEMBER_`, `IMPORT_`
- **文字列リテラルの直書き禁止**。必ず `ErrorCode` 定数から参照する（TypeScript がコンパイルエラーで未定義コードを弾く）

**API 境界（tRPC）**: `AppError` を `TRPCError` に変換する
```typescript
throw new TRPCError({ code: 'NOT_FOUND', message: e.message, cause: e })
```

**クライアント**: TanStack Query の `error` state で受け取り、トースト等でユーザーに表示する

## Development Environment

### Required Tools
- Node.js 20+

### Common Commands
```bash
# 開発サーバー起動（サーバー + クライアント同時）
npm start

# サーバーのみ
npm run dev:server

# クライアントのみ
npm run dev:client

# テスト
npm test
```

## Key Technical Decisions

- **SQLite 選択**: クラウドインフラ不要・インストールゼロ・単一ファイルで永続化。本番環境でも `npm start` のみで動作する。
- **Hono 選択**: Express より軽量かつ型安全。Web 標準ベースで将来のエッジ対応も可能。
- **Anthropic SDK は使用しない**: WBS 生成の AI 対話は外部ツール（wbs-* スキル）が担う。EVM Studio は決定論的なビジネスロジックと可視化に集中する。
