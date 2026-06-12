# Brief: sdd-design-system

## Problem
sdd-dashboard アプリの「スケルトン（`skeleton-client`）」と「本番（`client`）」でビジュアルデザインが一致していない。スケルトンはリッチで見やすい手書きのデザインシステム（paper/ink/brand のトークン、ダークグリーンのサイドバー、カード/バッジ/チップ/パイプラインノード/タブ/ポップオーバー/モーダル）を持つのに対し、本番は Tailwind v4 のデフォルト slate パレットそのままで素っ気ない「Tailwind スターター」的な見た目になっている。利用者（ダッシュボード閲覧者・開発者）にとって本番の視認性・一貫性が劣る。

## Current State
- スケルトン: `sdd-dashboard/skeleton-client/src/styles.css`（184行）に完成度の高いデザイン言語。
  - トークン: `--paper #f7f4ec` / `--paper-warm` / `--ink` / `--ink-soft` / `--line` / `--brand #7ea61f` / `--brand-soft` / `--ok` / `--warn` / `--bad` / `--gray` / `--mono (JetBrains Mono)`
  - 構成要素: ダークグリーン sidebar、page-title/sub、card、badge、chip、btn、board の lane/pipe/node、spec viewer の tabs/req-card/ac/viewer-grid/toc/task-line/matrix、markdown（.md）、popover、modal、knowledge グリッド、help flow
- 本番: `sdd-dashboard/client/src/index.css`（23行）は `@import "tailwindcss"` とハイライト用クラスのみ。装飾は各 `.tsx` の Tailwind ユーティリティ（`bg-slate-50` `text-slate-800` `border-slate-200` など）に分散。カスタムテーマは未定義。
- ギャップ: 本番にはデザイントークンも統一されたコンポーネント装飾も無く、スケルトンの「正」とされるデザインと乖離している。

## Desired Outcome
- 本番アプリの見た目がスケルトンのデザイン言語（paper/ink/brand のあたたかいトーン、ダークグリーン sidebar、統一されたカード/バッジ/チップ等）に一致する。
- スケルトン由来のデザイントークンが Tailwind v4 の `@theme` として一元定義され、本番全コンポーネントがそれを参照する。
- 本番の機能・画面構成・情報設計・既存テストの振る舞いは維持されたまま、視覚表現のみが刷新される。

## Approach
スケルトンの paper/ink/brand トークンを **Tailwind v4 の `@theme`**（`client/src/index.css`）に移植してデザイントークンの単一の真実源を作り、本番のユーティリティクラス運用を維持したまま、AppShell（sidebar/header/nav）と各機能エリア（spec 一覧/概要、document viewer のタブ・要件カード・タスク行・TOC、matrix、compare、validation、board、markdown レンダリング、共有プリミティブの badge/chip/modal/popover）の className をスケルトン相当の見た目になるよう再スキンする。手書き CSS をそのまま持ち込むのではなくトークン化して Tailwind に統合することで、本番の既存構造・テストを壊しにくくする。

## Scope
- **In**:
  - スケルトンのデザイントークン（色・フォント・角丸など）の Tailwind `@theme` 化
  - AppShell（サイドバー・ヘッダ・ナビ）の再スキン
  - 各機能ビューのビジュアル再スキン（spec list/overview、viewer/tabs/cards/tasks/toc、matrix、compare、validation、board）
  - 共有プリミティブ（badge / chip / button / card / modal / popover）の装飾統一
  - markdown レンダリング（見出し・コード・blockquote・table・mermaid 枠）の装飾
- **Out**:
  - 機能追加・画面構成変更・情報設計の変更（純粋に見た目のみ）
  - スケルトンにあって本番に無い画面/レイアウト（Board のパイプライン表示、リッチな Help フロー等）の機能的取り込み
  - バックエンド/サーバ・API 契約・データモデルの変更
  - skeleton-client 自体の改変（参照源として保持）

## Boundary Candidates
- デザイントークン層（`@theme` 定義）= 全ビューが依存する基盤
- アプリシェル層（AppShell: sidebar/header/nav）
- 共有プリミティブ層（badge/chip/button/card/modal/popover/markdown）
- 機能ビュー層（specs / viewer / matrix / compare / validation / board）への適用

## Out of Boundary
- 本番の機能ロジック・ルーティング・状態管理・API 連携
- skeleton-client の保守・拡張（このスペックは本番を正に近づける片方向作業）
- 新規画面・新規ナビゲーション項目の追加

## Upstream / Downstream
- **Upstream**: `skeleton-client/src/styles.css`（デザインの正・トークンと装飾の出典）、本番の既存実装（sdd-core / sdd-review-ui / sdd-workflow-ui の各コンポーネント）
- **Downstream**: 今後 sdd-dashboard に追加される全 UI スペックは、このスペックで確立したトークン/装飾規約に準拠する

## Existing Spec Touchpoints
- **Extends**: 機能仕様としては既存3スペックを変更しない（見た目のみ再スキン）。スタイル実装ファイルは sdd-core（AppShell/index.css）・sdd-review-ui（viewer/compare/matrix/validation）・sdd-workflow-ui（board/workflow）の各コンポーネントに跨って触れる
- **Adjacent**: sdd-core / sdd-review-ui / sdd-workflow-ui（機能境界を侵さず、装飾のみ調整する点に注意）

## Constraints
- 本番は React + Tailwind v4 + react-router 構成。Tailwind v4 の `@theme` でカスタムトークンを定義する。
- 既存の単体テスト（`*.test.tsx`）・E2E（`e2e/*.spec.ts`）の振る舞いを壊さない。`data-testid` やアクセシビリティ属性（`aria-label` 等）は維持する。
- ローカル完結・外部URL非依存の方針を維持（`e2e/check-dist-no-external-urls.ts` に抵触しないこと。Web フォント等は同梱前提）。
- skeleton-client はデザイン参照源として残す（削除・改変しない）。
- ドキュメントは spec.json の language（ja）で記述する。
