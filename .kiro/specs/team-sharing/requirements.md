# Requirements Document

## Introduction

team-sharing は、EVM Studio をローカル単独利用からチーム共有運用へ移行する機能である（GitHub Issue #2）。現状はサーバーが localhost バインド + ローカルファイル DB のため、PM の PC 上の WBS・進捗データを他メンバーが参照・更新できない。本機能により、チーム全員が同じ URL にブラウザでアクセスして同一の WBS・進捗データを参照・更新でき、各メンバーが自分の進捗を日次入力し、他メンバーの更新が画面に反映されるようになる。運用コストは無料とする。

アクセス制御はチーム共有のシークレットキー 1 つのみとし、個別ユーザー認証・ロール権限は持たない。チーム間の分離（A チームは B チームの WBS を見られない）は、アプリ内の権限管理ではなく「チームごとの独立インスタンス」によって実現する。

## Boundary Context

- **In scope**: 共有 URL による同一データの参照・更新、チーム共有シークレットによるアクセス制御、チーム間のインスタンス分離、他メンバー更新の画面反映、同時更新時のデータ整合性、既存機能の維持、無料運用、デプロイ手順とローカル開発環境
- **Out of scope**: 個別ユーザー認証・ロールベース権限管理、リアルタイム共同編集・競合マージ（CRDT 等）、複数チームを 1 インスタンスに同居させるマルチテナント、オフライン動作・ローカルファースト同期、EVM 計算ロジック・ダッシュボード UI 機能の変更
- **Adjacent expectations**:
  - データモデル（スキーマ・CRUD 仕様）の正典は core-data-model スペック。本機能はスキーマを変更しない
  - WBS YAML の生成は wbs-* スキルが担う。本機能はインポート仕様を変更しない
  - evm-engine / progress-tracking / dashboard の各スペックが定義するユーザー可視の挙動は不変。本機能はそれらが動作する基盤（共有環境）を提供する

## Requirements

### Requirement 1: チーム共有データアクセス

**Objective:** チームメンバーとして、自分の PC のブラウザから共通の WBS・進捗データにアクセスしたい。PM の PC に依存せず全員が同じ状況を見られるようにするため。

#### Acceptance Criteria

1. The EVM Studio system shall serve the team's shared WBS and progress data through a single shared URL that team members access from their own browsers.
   - 和訳: EVM Studio システムは、チームメンバーが各自のブラウザからアクセスする単一の共有 URL を通じて、チーム共有の WBS・進捗データを提供する。
2. When a team member opens the shared URL from any machine, the EVM Studio system shall present the same projects, tasks, members, and progress data that all other team members see.
   - 和訳: チームメンバーが任意のマシンから共有 URL を開いたとき、EVM Studio システムは他のすべてのメンバーが見ているものと同一のプロジェクト・タスク・メンバー・進捗データを表示する。
3. When a team member records progress or modifies WBS data, the EVM Studio system shall persist the change to the team's shared dataset so that it becomes visible to all other members.
   - 和訳: チームメンバーが進捗を記録または WBS データを変更したとき、EVM Studio システムはその変更をチーム共有データセットに永続化し、他のすべてのメンバーから見えるようにする。
4. The EVM Studio system shall serve all communication between the browser and the server over encrypted connections (HTTPS).
   - 和訳: EVM Studio システムは、ブラウザとサーバー間のすべての通信を暗号化された接続（HTTPS）で行う。
5. If the shared server cannot be reached, the EVM Studio client shall display a connection error instead of silently presenting stale data as current.
   - 和訳: 共有サーバーに到達できない場合、EVM Studio クライアントは古いデータを最新であるかのように黙って表示するのではなく、接続エラーを表示する。

### Requirement 2: 共有シークレットによるアクセス制御

**Objective:** PM として、URL を知っているだけの第三者にプロジェクトデータを見られたくない。ただし個別アカウントの管理運用はしたくない。

#### Acceptance Criteria

1. The EVM Studio system shall require a team-shared secret key before granting access to any project data.
   - 和訳: EVM Studio システムは、いかなるプロジェクトデータへのアクセスを許可する前にも、チーム共有のシークレットキーを要求する。
2. If a request does not carry a valid shared secret, the EVM Studio system shall reject the request without disclosing any project data.
   - 和訳: リクエストが有効な共有シークレットを持たない場合、EVM Studio システムはいかなるプロジェクトデータも開示せずにリクエストを拒否する。
3. When a team member enters the correct shared secret, the EVM Studio client shall store it in the browser and reuse it for subsequent requests without prompting again.
   - 和訳: チームメンバーが正しい共有シークレットを入力したとき、EVM Studio クライアントはそれをブラウザに保存し、以降のリクエストで再入力を求めずに再利用する。
4. When a team member enters an incorrect shared secret, the EVM Studio client shall display an authentication error and prompt for re-entry.
   - 和訳: チームメンバーが誤った共有シークレットを入力したとき、EVM Studio クライアントは認証エラーを表示して再入力を促す。
5. The EVM Studio system shall not require individual user accounts, passwords, or role-based permissions.
   - 和訳: EVM Studio システムは、個別のユーザーアカウント・パスワード・ロールベース権限を要求しない。

### Requirement 3: チーム間データ分離

**Objective:** 運用者として、A チームのメンバーが B チームの WBS を見られないようにしたい。アプリ内の権限管理機能を運用せずに実現するため。

#### Acceptance Criteria

1. The EVM Studio system shall hold exactly one team's data per team instance.
   - 和訳: EVM Studio システムは、1 つのチームインスタンスにつき 1 チーム分のデータのみを保持する。
2. The EVM Studio system shall configure each team instance with its own shared secret, independent of every other team instance.
   - 和訳: EVM Studio システムは、各チームインスタンスに他のすべてのチームインスタンスから独立した固有の共有シークレットを設定する。
3. While multiple team instances are deployed, the EVM Studio system shall not provide any view or operation that exposes another team instance's data.
   - 和訳: 複数のチームインスタンスがデプロイされている間、EVM Studio システムは他のチームインスタンスのデータを露出するいかなる画面・操作も提供しない。

### Requirement 4: 他メンバー更新の画面反映

**Objective:** チームメンバーとして、ダッシュボードを開いている間に他メンバーの進捗入力が自動で反映されてほしい。古い数値を見て誤った判断をしないため。

#### Acceptance Criteria

1. While a team member has the dashboard open, the EVM Studio client shall reflect updates committed by other members within 60 seconds without a manual page reload.
   - 和訳: チームメンバーがダッシュボードを開いている間、EVM Studio クライアントは他メンバーが確定した更新を、手動のページリロードなしに 60 秒以内に反映する。
2. When refreshed shared data is received, the EVM Studio client shall update the EVM metrics, alerts, and all dashboard views to reflect the new data.
   - 和訳: 更新された共有データを受信したとき、EVM Studio クライアントは EVM メトリクス・アラート・すべてのダッシュボード表示を新しいデータを反映した状態に更新する。
3. When a team member commits their own change, the EVM Studio client shall reflect that change in their own view immediately after the operation completes.
   - 和訳: チームメンバーが自分の変更を確定したとき、EVM Studio クライアントは操作完了後ただちにその変更を本人の画面に反映する。

### Requirement 5: 同時更新時のデータ整合性

**Objective:** チームメンバーとして、複数人が同時に進捗入力してもデータが失われたり壊れたりしないでほしい。安心して各自のタイミングで入力するため。

#### Acceptance Criteria

1. When multiple team members concurrently update different tasks, the EVM Studio system shall persist all of the updates without losing any of them.
   - 和訳: 複数のチームメンバーが異なるタスクを同時に更新したとき、EVM Studio システムはいずれの更新も失わずにすべて永続化する。
2. If two team members concurrently update the same task's progress for the same snapshot date, the EVM Studio system shall persist the most recently received update as the final state and keep the dataset consistent.
   - 和訳: 2 人のチームメンバーが同一タスクの同一スナップショット日付の進捗を同時に更新した場合、EVM Studio システムは最後に受信した更新を最終状態として永続化し、データセットの整合性を保つ。
3. If a WBS YAML import fails partway, the EVM Studio system shall leave the shared dataset unchanged so that other members never observe a partially imported state.
   - 和訳: WBS YAML インポートが途中で失敗した場合、EVM Studio システムは共有データセットを変更しないままにし、他のメンバーが部分的にインポートされた状態を観測することがないようにする。

### Requirement 6: 既存機能の維持

**Objective:** ユーザーとして、共有化後もこれまでの全機能を同じ操作感で使いたい。移行によって日常の進捗管理フローを変えないため。

#### Acceptance Criteria

1. The EVM Studio system shall preserve all existing user-facing capabilities in shared operation: WBS YAML import, project/task/member management, daily progress input, EVM metrics with previous-day comparison, and all dashboard views (gantt, charts, inspector, fullscreen modals).
   - 和訳: EVM Studio システムは、共有運用においても既存のユーザー向け機能すべて（WBS YAML インポート、プロジェクト/タスク/メンバー管理、日次進捗入力、前日比付き EVM メトリクス、ガント・チャート・Inspector・全画面モーダルを含むすべてのダッシュボード表示）を維持する。
2. When a team member opens the dashboard over a typical broadband connection, the EVM Studio system shall display the project data within 3 seconds.
   - 和訳: チームメンバーが一般的なブロードバンド回線でダッシュボードを開いたとき、EVM Studio システムは 3 秒以内にプロジェクトデータを表示する。
3. The EVM Studio system shall pass the existing end-to-end user flows (WBS import, progress input, and dashboard verification) in the shared environment.
   - 和訳: EVM Studio システムは、既存のエンドツーエンドのユーザーフロー（WBS インポート・進捗入力・ダッシュボード確認）を共有環境においても満たす。

### Requirement 7: 無料運用と運用可観測性

**Objective:** 運用者（PM）として、追加の金銭コストなしでチーム共有運用を続けたい。また問題発生時に状況を確認できるようにしたい。

#### Acceptance Criteria

1. The EVM Studio system shall operate at zero infrastructure cost for typical team usage, assuming daily progress input and dashboard viewing by a team of up to 10 members.
   - 和訳: EVM Studio システムは、最大 10 名のチームによる日次進捗入力とダッシュボード閲覧という典型的な利用において、インフラコストゼロで運用できる。
2. The EVM Studio system shall document the usage limits of free operation and the maximum number of concurrently operable team instances, so that the operator can anticipate capacity in advance.
   - 和訳: EVM Studio システムは、無料運用の利用上限と同時運用可能なチームインスタンス数の上限を文書化し、運用者が事前にキャパシティを見積もれるようにする。
3. The EVM Studio system shall emit server logs in a structured form viewable by the operator, and shall not include member personal names in any log output.
   - 和訳: EVM Studio システムは、運用者が閲覧できる構造化された形式でサーバーログを出力し、いかなるログ出力にもメンバーの個人名を含めない。

### Requirement 8: デプロイとローカル開発

**Objective:** 開発者として、クラウドに依存せずローカルで開発・検証し、簡単な手順でチームインスタンスをデプロイしたい。開発の往復を速く保ち、チーム追加を低コストにするため。

#### Acceptance Criteria

1. When a developer runs the documented startup command, the EVM Studio system shall start a complete local development environment (server, client, and local data) without requiring any cloud account or credentials.
   - 和訳: 開発者が文書化された起動コマンドを実行したとき、EVM Studio システムはクラウドアカウントや認証情報を一切要求せずに、完全なローカル開発環境（サーバー・クライアント・ローカルデータ）を起動する。
2. The EVM Studio system shall provide a documented deployment procedure that publishes a new team instance, including its data store and shared secret configuration.
   - 和訳: EVM Studio システムは、データストアと共有シークレットの設定を含む新しいチームインスタンスを公開する、文書化されたデプロイ手順を提供する。
3. When the deployment procedure completes, the EVM Studio system shall make the new team instance immediately accessible at its URL using its configured shared secret.
   - 和訳: デプロイ手順が完了したとき、EVM Studio システムは新しいチームインスタンスを、設定された共有シークレットを用いてその URL からただちにアクセス可能にする。
