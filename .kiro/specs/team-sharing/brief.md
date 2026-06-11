# Brief: team-sharing

## Problem

EVM Studio は現状ローカル完結型（localhost バインド + ファイルベース SQLite）であり、PM が自分の PC で起動した WBS・進捗データを他のチームメンバーが参照・更新できない。実運用ではチーム全員が同じ WBS を見て、各自が自分の進捗を入力できる必要がある（GitHub Issue #2）。

## Current State

- サーバーは `localhost:3001` 固定バインド、CORS も `localhost:5173` 限定
- DB は better-sqlite3（同期 API・ネイティブモジュール）によるローカルファイル `evm-studio.db`
- 認証・ユーザー概念なし（tRPC context は空オブジェクト）
- 他者の変更を検知する仕組みなし（キャッシュ無効化は自分のミューテーション起点のみ）
- ロードマップ上「認証・認可はスコープ外（ローカル限定）」という制約で設計されてきた

## Desired Outcome

- チーム全員が同じ URL にブラウザでアクセスし、同一の WBS・進捗データを参照・更新できる
- 各メンバーが自分の進捗を日次入力でき、他メンバーの更新が画面に反映される
- 運用コストは無料（課金なし）
- チーム間分離（A チームは B チームの WBS を見られない）は、アプリ内の権限管理コードではなく「チームごとの別デプロイ」で実現する

## Approach

**Cloudflare Workers + D1 への移行**（Discovery 2026-06-11 で 3 案比較の上選定、viability 検証済み）

- Hono サーバーを Cloudflare Workers に移植（Hono は Workers ネイティブ）
- DB を better-sqlite3 → D1（Cloudflare マネージド SQLite）+ Drizzle D1 ドライバに置き換え
- React SPA は同 Worker の静的アセット（Workers Assets）として配信
- アクセス制御はチーム共有のシークレットキー 1 つをミドルウェアで検証（個別ユーザー認証なし）
- 他メンバーの更新反映は TanStack Query の定期 refetch（ポーリング）で実現
- ローカル開発は Cloudflare 公式 Vite プラグイン + ローカル D1（Miniflare）

**選定理由**: 「課金なし」を確実に満たし、サーバー保守ゼロ、Cloudflare 1 社で完結。チーム分離がデプロイ分離だけで済み権限管理コードが一切不要になるため、Issue の「権限管理が面倒」という懸念に最も忠実。

**却下した代替案**:
- Turso + 無料 PaaS（Node サーバー温存）: 非同期化コストは同等に発生する一方、コールドスタートと複数ベンダー構成を抱える
- 無料 VM（Oracle Cloud Always Free）: コード変更は最小だが、VM 確保・Linux 構築・HTTPS・保守が属人的な手作業になる

## Scope

- **In**:
  - Hono サーバーの Workers ランタイム移植（Node 専用 API の除去）
  - DB アクセス層の D1 移行（同期 → 非同期化、`db.transaction()` → `db.batch()` 書き換え、YAML インポートの一括投入化）
  - Drizzle マイグレーションの D1 対応（FK/cascade 挙動の手動レビュー含む）
  - React SPA の Workers Assets 配信（SPA ルーティング設定、`run_worker_first` で API パス分離）
  - 共有シークレットキーによるアクセス制御ミドルウェア（クライアント側のキー入力・保持含む）
  - 他メンバー更新の画面反映（TanStack Query 定期 refetch）
  - pino → console JSON + Workers Logs への置き換え
  - wrangler 設定・デプロイ手順・チーム別デプロイ手順のドキュメント化
  - ローカル開発環境の再構築（Cloudflare Vite プラグイン + ローカル D1）
- **Out**:
  - ユーザー個別認証・ロールベース権限管理（チーム分離はデプロイ分離で実現）
  - リアルタイム共同編集・競合解決（CRDT 等）。同一タスクの同時編集はまれという前提
  - チームをまたぐデータ統合・横断ビュー
  - オフライン対応・ローカルファースト同期
  - EVM 計算ロジック・UI 機能の変更（プラットフォーム移行に徹する）

## Boundary Candidates

- **ランタイム移植層**: Node → Workers（エントリポイント、ログ、環境変数、ビルド・デプロイ設定）
- **DB アクセス層**: better-sqlite3 → D1（ドライバ差し替え、非同期化、トランザクション再編、マイグレーション）
- **アクセス制御**: 共有キー検証ミドルウェア + クライアントのキー管理
- **鮮度同期**: 定期 refetch によるダッシュボード・ガントの他者更新反映

## Out of Boundary

- WBS 生成（wbs-* スキルが担う）
- スペック再生成・既存機能の仕様変更（EVM 計算、ダッシュボード UI の挙動は不変）
- 複数チームを 1 インスタンスに同居させるマルチテナント設計

## Upstream / Downstream

- **Upstream**: core-data-model（SQLite スキーマ・CRUD の正典）、evm-engine / progress-tracking / dashboard（全スペックが DB アクセス層に依存しており、非同期化の影響を受ける）
- **Downstream**: 将来の朝報エクスポート・xlsm インポート（クラウド配置が前提になれば本スペックの構成に乗る）

## Existing Spec Touchpoints

- **Extends**: なし（新規境界。ただし実装は全既存スペックの DB アクセスコードに横断的に触れる）
- **Adjacent**: core-data-model（スキーマ定義は不変のまま流用）、dashboard / progress-tracking（クライアントの refetch 設定を追加）

## Constraints

- **無料枠で運用**: Workers 無料プラン（10 万リクエスト/日、CPU 10ms/呼び出し）、D1 無料枠（DB あたり 500MB、アカウント 10 DB まで、書込 10 万行/日をアカウント全体で共有）。チーム分離 = デプロイ分離のため実質最大 10 チーム
- **D1 制約**: 対話的トランザクション非対応（`BEGIN` 拒否、Drizzle `db.transaction()` は実行時エラー）。アトミック性は `db.batch()` で担保。`PRAGMA foreign_keys = OFF` 不可のためテーブル再作成型マイグレーションは cascade delete 誤発火に注意
- **Workers ランタイム**: Node 専用 API・ネイティブモジュール不可（better-sqlite3、pino transport が非互換）。静的アセットリクエストは無料・リクエスト数にカウントされない
- **バージョン**: Drizzle ORM は 0.44.x 系に pin（v1.0 beta への追従は別判断）。@hono/trpc-server を tRPC 統合に使用
- **既存スタック維持**: TypeScript strict、Hono 4、tRPC 11、React 19、Vite、TanStack Query 5、Zod 4 は変更しない
