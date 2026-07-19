# 技術方針: sdd-workshop

> moira 関連の steering は専用リポジトリへ移転しました（2026-07-20、issue #42）。詳細は [`moira/README.md`](../../moira/README.md)。

## 基本方針

本リポジトリはワークショップ教材リポジトリであり、単一の製品スタックを持たない。構成物ごとに用途に応じた技術を採用する。

## 構成物ごとのスタック

- **atelier/** — Markdown ベースのコンテンツ制作。スライドは Slidev（`@slidev/theme-default`）で生成する（`draft-to-slides` スキル）。
- **evm-studio/** — ハンズオン用プロトタイプアプリ。
  - server: Hono + tRPC + Drizzle ORM + better-sqlite3（TypeScript, ESM）
  - client: React 19 + Vite + Tailwind CSS + TanStack Query / tRPC client
  - テストは Vitest（server/client 双方）、E2E は Playwright
- **mockup/** — 使い捨ての HTML/JSX モックアップ。ビルドパイプラインを持たない。
- **ルート package.json** — `@slidev/theme-default`（スライド生成）、`playwright-chromium`（E2E 用ブラウザ）を持つのみ。ワークショップ本体のビルド成果物ではない。

## 言語・記述規約

- 生成ドキュメント（requirements／design／tasks 等）の言語は各 spec の `spec.json.language` に従う。
- EARS 記法・トレーサビリティ表記・テスト戦略の汎用原則は [requirements-style.md](requirements-style.md) / [trace-notation.md](trace-notation.md) / [testing-conventions.md](testing-conventions.md) を参照する。
