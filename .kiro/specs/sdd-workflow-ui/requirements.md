# Requirements Document

## Introduction

sdd-workflow-ui は SDD Dashboard のワークフロー/オペレーション体験を担う画面群である。cc-sdd の開発フロー（Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装）を初見の開発者にも分かる形で可視化し、全スペックのフェーズ進行・承認状態を俯瞰するパイプラインボード、レビュー画面に重ねる承認操作、影響範囲を確認した上で実行する手戻り（フェーズ巻き戻し）操作、フロー解説のヘルプ/オンボーディング、steering・スキル（英日切替）・ADR のナレッジビューアを提供する。

本スペックは sdd-review-ui と同一 SPA 内の画面群として動作し、状態の読取と書込（承認・巻き戻し）はすべて上流のデータソース（sdd-core）に委ねる。GUI が行う状態変更は spec.json の承認フラグ操作（承認・巻き戻し）に限定され、スペック内容の再生成は CLI スキルが担う。GUI は状態変更と「次に打つべき CLI コマンド」の案内までを責務とする。承認・手戻りはいずれも明示的な確認ステップなしには実行されない。

## Boundary Context

- **In scope**: パイプライン俯瞰ボード（全スペックのフェーズ進行・承認状態のグラフィカル表示）、レビュー画面上の承認操作（確認ステップ・次アクション案内付き）、手戻り操作（影響範囲の可視化付き確認ダイアログ・次 CLI コマンド案内）、ヘルプ/オンボーティング画面、steering ビューア、スキルビューア（英/日タブ切替）、ADR ビューア、これら画面の変更自動反映
- **Out of scope**: スペックドキュメントの精読・相互リンク・トレーサビリティ表示（sdd-review-ui）、markdown パース・ファイル書込の実処理・書込バリデーション（sdd-core）、スペック再生成そのもの（CLI スキルが担う）、承認可否の判断ロジック（人間が判断する）、ADR の作成・編集 UI（将来候補）、AI 実行連携（Claude Code 起動。将来候補）、リモートアクセス・認証・マルチユーザー
- **Adjacent expectations**:
  - sdd-core の HTTP API（スペック・steering・スキル・ADR の読取、承認更新・フェーズ巻き戻しの書込、変更通知ストリーム）が上流契約として安定していること。書込の妥当性検証（生成済み前提・フェーズ順序・パス制限）は sdd-core が実施し、本スペックはその結果を表示する
  - sdd-review-ui が SPA シェル（レイアウト・ルート登録・レビュー画面への操作挿入点・変更通知の反映基盤）を提供すること。本スペックはその拡張点に画面と操作を追加し、既存レビュー画面の動作を変更しない

## Requirements

### Requirement 1: パイプライン俯瞰ボード

**Objective:** 開発者として、全スペックのフェーズ進行と承認状態を 1 画面でグラフィカルに俯瞰したい。spec.json を直接開かずに各スペックの現在地を一目で把握するため。

#### Acceptance Criteria

1. When the user opens the pipeline board, the sdd-workflow-ui client shall display every spec as a graphical flow showing the phase progression (requirements → design → tasks → implementation) with the generated and approved state of each phase.
   - 和訳: ユーザーがパイプラインボードを開いたとき、sdd-workflow-ui クライアントはすべてのスペックを、フェーズ進行（requirements → design → tasks → implementation）と各フェーズの生成済み・承認済み状態を示すグラフィカルなフローとして表示する。
2. The sdd-workflow-ui client shall visually distinguish each spec's current phase position and whether the spec is ready for implementation.
   - 和訳: sdd-workflow-ui クライアントは、各スペックの現在のフェーズ位置と、実装準備が完了しているかどうかを視覚的に判別できるように表示する。
3. If a spec's metadata cannot be read correctly, the sdd-workflow-ui client shall still show that spec on the board with a diagnostic indication instead of omitting it.
   - 和訳: スペックのメタデータが正しく読み取れない場合、sdd-workflow-ui クライアントはそのスペックをボードから省略せず、診断表示付きでボード上に表示する。
4. When the user activates a spec on the board, the sdd-workflow-ui client shall navigate to that spec's review screens.
   - 和訳: ユーザーがボード上のスペックを選択したとき、sdd-workflow-ui クライアントはそのスペックのレビュー画面へ遷移する。
5. The sdd-workflow-ui client shall represent the board view in the URL, so that the same view can be restored by reloading or sharing the URL.
   - 和訳: sdd-workflow-ui クライアントはボードビューを URL に表現し、リロードや URL 共有で同じビューを復元できるようにする。
6. When the user opens the pipeline board, the sdd-workflow-ui client shall group the spec lanes into sections by each spec's `app`, ordering the app sections by app name.
   - 和訳: ユーザーがパイプラインボードを開いたとき、sdd-workflow-ui クライアントはスペックのレーンを各スペックの `app` ごとのセクションにグルーピングし、app セクションを app 名順に並べて表示する。
7. The sdd-workflow-ui client shall display, for each app section, a summary showing the number of specs, the number of specs ready for implementation, and the number of specs whose implementation is complete.
   - 和訳: sdd-workflow-ui クライアントは、各 app セクションに、スペック数・実装準備完了（READY）のスペック数・実装完了のスペック数を示すサマリーを表示する。
8. If a spec's `app` is null, the sdd-workflow-ui client shall display that spec's lane in an unclassified group (未分類).
   - 和訳: スペックの `app` が null の場合、sdd-workflow-ui クライアントはそのスペックのレーンを「未分類」グループに表示する。

### Requirement 2: 承認操作

**Objective:** レビュアーとして、レビュー画面から確認ステップ付きで承認を実行したい。spec.json の手編集なしに、レビューの流れのまま次フェーズへ進むため。

#### Acceptance Criteria

1. While the user is viewing a spec's review screens, the sdd-workflow-ui client shall present an approval action for a phase whose document is generated but not yet approved.
   - 和訳: ユーザーがスペックのレビュー画面を表示している間、sdd-workflow-ui クライアントは、ドキュメントが生成済みかつ未承認のフェーズに対する承認操作を提示する。
2. When the user activates the approval action, the sdd-workflow-ui client shall display a confirmation step showing the target spec and phase before any state change occurs.
   - 和訳: ユーザーが承認操作を起動したとき、sdd-workflow-ui クライアントは、いかなる状態変更も発生する前に、対象のスペックとフェーズを示す確認ステップを表示する。
3. If the user cancels the confirmation step, the sdd-workflow-ui client shall issue no approval request and make no state change.
   - 和訳: ユーザーが確認ステップをキャンセルした場合、sdd-workflow-ui クライアントは承認リクエストを一切発行せず、状態を変更しない。
4. When the user confirms the approval, the sdd-workflow-ui client shall request the approval update from the data source and display the updated approval state.
   - 和訳: ユーザーが承認を確定したとき、sdd-workflow-ui クライアントはデータソースへ承認更新をリクエストし、更新後の承認状態を表示する。
5. When an approval completes successfully, the sdd-workflow-ui client shall present the recommended next action, including the CLI command for proceeding to the next phase.
   - 和訳: 承認が正常に完了したとき、sdd-workflow-ui クライアントは、次フェーズへ進むための CLI コマンドを含む推奨される次アクションを提示する。
6. If the data source rejects the approval request, the sdd-workflow-ui client shall display the returned error code and message, and shall not present the phase as approved.
   - 和訳: データソースが承認リクエストを拒否した場合、sdd-workflow-ui クライアントは返却されたエラーコードとメッセージを表示し、そのフェーズを承認済みとして表示しない。

### Requirement 3: 手戻り（フェーズ巻き戻し）操作

**Objective:** 開発者として、影響範囲を確認した上で任意のフェーズへ巻き戻したい。実装中に追加要件が出てスペックへ戻る際の定型操作を、下流フェーズへの影響を見落とさずに GUI で安全に行うため。

#### Acceptance Criteria

1. While the user is viewing a spec's review screens, the sdd-workflow-ui client shall present a rollback action that allows selecting requirements, design, or tasks as the rollback target phase.
   - 和訳: ユーザーがスペックのレビュー画面を表示している間、sdd-workflow-ui クライアントは、requirements・design・tasks のいずれかを巻き戻し先フェーズとして選択できる手戻り操作を提示する。
2. When the user selects a rollback target phase, the sdd-workflow-ui client shall display, before execution, the impact of the rollback: which downstream phases will lose approval and require re-approval, and that the spec will no longer be ready for implementation.
   - 和訳: ユーザーが巻き戻し先フェーズを選択したとき、sdd-workflow-ui クライアントは実行前に、どの下流フェーズの承認が解除され再承認が必要になるか、およびスペックが実装準備完了でなくなることを、影響範囲として表示する。
3. If the user cancels the rollback confirmation, the sdd-workflow-ui client shall issue no rollback request and make no state change.
   - 和訳: ユーザーが手戻りの確認をキャンセルした場合、sdd-workflow-ui クライアントは巻き戻しリクエストを一切発行せず、状態を変更しない。
4. When the user confirms the rollback, the sdd-workflow-ui client shall request the rollback from the data source and display the updated phase and approval states.
   - 和訳: ユーザーが手戻りを確定したとき、sdd-workflow-ui クライアントはデータソースへ巻き戻しをリクエストし、更新後のフェーズと承認状態を表示する。
5. When a rollback completes successfully, the sdd-workflow-ui client shall present the CLI command to run next for the rolled-back phase (for example `/kiro-spec-requirements`).
   - 和訳: 手戻りが正常に完了したとき、sdd-workflow-ui クライアントは、巻き戻したフェーズに対して次に実行すべき CLI コマンド（例: `/kiro-spec-requirements`）を提示する。
6. If the data source rejects the rollback request, the sdd-workflow-ui client shall display the returned error code and message, and keep displaying the unchanged state.
   - 和訳: データソースが巻き戻しリクエストを拒否した場合、sdd-workflow-ui クライアントは返却されたエラーコードとメッセージを表示し、変更前の状態を表示し続ける。

### Requirement 4: ヘルプ/オンボーディング

**Objective:** 初見の開発者として、cc-sdd の開発フロー全体を画面上で理解したい。リポジトリ内の資料を探し回らずに、どのフェーズで何をすべきか把握するため。

#### Acceptance Criteria

1. When the user opens the help screen, the sdd-workflow-ui client shall explain the cc-sdd flow in order: Discovery → Requirements → approval → Design → approval → Tasks → approval → Implementation.
   - 和訳: ユーザーがヘルプ画面を開いたとき、sdd-workflow-ui クライアントは cc-sdd のフローを Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装 の順に解説する。
2. The sdd-workflow-ui client shall describe, for each phase of the flow, its artifact, the meaning of its approval, and the CLI command that drives the phase.
   - 和訳: sdd-workflow-ui クライアントは、フローの各フェーズについて、その成果物・承認の意味・フェーズを進める CLI コマンドを説明する。
3. The sdd-workflow-ui client shall make the help screen reachable from the dashboard's common navigation.
   - 和訳: sdd-workflow-ui クライアントは、ダッシュボードの共通ナビゲーションからヘルプ画面へ到達できるようにする。

### Requirement 5: steering ビューア

**Objective:** 開発者として、プロジェクト横断ルール（steering 文書）を GUI から参照したい。エディタを開かずにプロジェクトの規約・文脈を確認するため。

#### Acceptance Criteria

1. When the user opens the steering view, the sdd-workflow-ui client shall display the list of all steering documents.
   - 和訳: ユーザーが steering ビューを開いたとき、sdd-workflow-ui クライアントはすべての steering 文書の一覧を表示する。
2. When the user selects a steering document, the sdd-workflow-ui client shall render its content as readable formatted text without omitting any part of the source document.
   - 和訳: ユーザーが steering 文書を選択したとき、sdd-workflow-ui クライアントはその内容を、元文書のいかなる部分も欠落させずに、読みやすい整形済みテキストとして描画する。

### Requirement 6: スキルビューア（英日切替）

**Objective:** 開発者として、各スキルの説明を英語・日本語を切り替えながら読みたい。スキルの使い方を母国語で素早く把握しつつ、正典である英語版も参照できるようにするため。

#### Acceptance Criteria

1. When the user opens the skills view, the sdd-workflow-ui client shall display the list of all skills with the availability of their English and Japanese documents.
   - 和訳: ユーザーがスキルビューを開いたとき、sdd-workflow-ui クライアントはすべてのスキルの一覧を、英語版・日本語版ドキュメントの有無とともに表示する。
2. When the user views a skill, the sdd-workflow-ui client shall allow switching between the English document and the Japanese document by tabs.
   - 和訳: ユーザーがスキルを表示したとき、sdd-workflow-ui クライアントは英語版ドキュメントと日本語版ドキュメントをタブで切り替えられるようにする。
3. Where a skill has no Japanese document, the sdd-workflow-ui client shall indicate its absence without treating it as an error and display the English document.
   - 和訳: スキルに日本語版ドキュメントが存在しない場合、sdd-workflow-ui クライアントはそれをエラーとして扱わずに不在であることを表示し、英語版ドキュメントを表示する。
4. When the user opens the skills view, the sdd-workflow-ui client shall group the skills list by each skill's `origin` into three groups — cc-sdd standard (`origin` is `"cc-sdd"`), custom skills (`origin` is `"custom"`), and unclassified (`origin` is null) — displayed in this fixed order: standard, custom, unclassified.
   - 和訳: ユーザーがスキルビューを開いたとき、sdd-workflow-ui クライアントはスキル一覧を各スキルの `origin` で「cc-sdd 標準」（`origin` が `"cc-sdd"`）・「独自スキル」（`origin` が `"custom"`）・「未分類」（`origin` が null）の 3 グループにグルーピングし、標準 → 独自 → 未分類 の固定順で表示する。
5. The sdd-workflow-ui client shall display the number of skills in each origin group together with that group's heading.
   - 和訳: sdd-workflow-ui クライアントは、各 origin グループの見出しとともに、そのグループに属するスキル数を表示する。
6. When the user views a skill, the sdd-workflow-ui client shall display a badge indicating the skill's origin classification.
   - 和訳: ユーザーがスキルを表示したとき、sdd-workflow-ui クライアントはそのスキルの origin 分類を示すバッジを表示する。

### Requirement 7: ADR ビューア

**Objective:** 開発者として、プロジェクト横断のアーキテクチャ決定（ADR）を一覧・参照したい。過去の決定の背景と帰結を GUI から素早く確認するため。

#### Acceptance Criteria

1. When the user opens the ADR view, the sdd-workflow-ui client shall display the list of all ADRs with each ADR's id, title, status shown as a badge, date, and affected specs.
   - 和訳: ユーザーが ADR ビューを開いたとき、sdd-workflow-ui クライアントはすべての ADR の一覧を、各 ADR の id・タイトル・バッジ表示のステータス・日付・関連スペックとともに表示する。
2. When the user selects an ADR, the sdd-workflow-ui client shall render its body sections (Context, Decision, Consequences, and Alternatives when present) as readable prose.
   - 和訳: ユーザーが ADR を選択したとき、sdd-workflow-ui クライアントはその本文セクション（Context・Decision・Consequences、存在する場合は Alternatives）を読みやすい散文として描画する。
3. If an ADR's metadata cannot be parsed, the sdd-workflow-ui client shall display the ADR's raw content together with the reported diagnostic instead of omitting the ADR.
   - 和訳: ADR のメタデータがパースできない場合、sdd-workflow-ui クライアントはその ADR を省略する代わりに、報告された診断とともに生の内容を表示する。
4. When the user opens the ADR view, the sdd-workflow-ui client shall group the ADR list by each ADR's frontmatter `app`.
   - 和訳: ユーザーが ADR ビューを開いたとき、sdd-workflow-ui クライアントは ADR 一覧を各 ADR の frontmatter `app` ごとにグルーピングして表示する。
5. If an ADR's `app` is null, the sdd-workflow-ui client shall display that ADR under a repository-cross-cutting group (リポジトリ横断).
   - 和訳: ADR の `app` が null の場合、sdd-workflow-ui クライアントはその ADR を「リポジトリ横断」グループに表示する。

### Requirement 8: 変更の自動反映

**Objective:** 開発者として、CLI/AI や GUI 操作によって状態が変わったら、ワークフロー画面が自動で最新化されてほしい。手動リロードなしで常に現在の状態を信頼できるようにするため。

#### Acceptance Criteria

1. When a change notification affecting specs, steering documents, skills, or ADRs currently displayed in a workflow screen is received, the sdd-workflow-ui client shall automatically refresh the affected views without a manual page reload.
   - 和訳: ワークフロー画面に表示中のスペック・steering 文書・スキル・ADR に影響する変更通知を受信したとき、sdd-workflow-ui クライアントは手動のページリロードなしに、影響を受けるビューを自動的に最新化する。
2. When an approval or rollback completes successfully, the sdd-workflow-ui client shall reflect the updated state in all dashboard views that display that spec's state without a manual page reload.
   - 和訳: 承認または手戻りが正常に完了したとき、sdd-workflow-ui クライアントはそのスペックの状態を表示しているすべてのダッシュボードビューに、手動のページリロードなしで更新後の状態を反映する。
3. When a change notification concerns only resources that are not currently displayed, the sdd-workflow-ui client shall not disrupt the user's current view.
   - 和訳: 変更通知が表示中でないリソースのみに関するものであるとき、sdd-workflow-ui クライアントはユーザーの現在のビューを乱さない。

### Requirement 9: SPA 統合・誤操作防止・ローカル完結

**Objective:** リポジトリ所有者として、ワークフロー画面がレビュー画面と一体のダッシュボードとして動作し、誤操作で承認状態が変わらず、外部ネットワークにも依存しないことを保証したい。安全にローカルで運用するため。

#### Acceptance Criteria

1. The sdd-workflow-ui client shall provide its screens within the same dashboard application as the review screens, reachable from the common navigation.
   - 和訳: sdd-workflow-ui クライアントは、その画面群をレビュー画面と同一のダッシュボードアプリケーション内で提供し、共通ナビゲーションから到達できるようにする。
2. The sdd-workflow-ui client shall keep the existing review screens functioning unchanged when its screens and actions are added.
   - 和訳: sdd-workflow-ui クライアントは、その画面と操作が追加されても、既存のレビュー画面が変わらず機能し続けるようにする。
3. The sdd-workflow-ui client shall execute no state-changing operation without an explicit user confirmation step.
   - 和訳: sdd-workflow-ui クライアントは、明示的なユーザーの確認ステップなしには、いかなる状態変更操作も実行しない。
4. The sdd-workflow-ui client shall provide no state-changing capability other than the approval and rollback operations.
   - 和訳: sdd-workflow-ui クライアントは、承認操作と手戻り操作以外の状態変更手段を一切提供しない。
5. The sdd-workflow-ui client shall operate without retrieving any resource from external networks, using only locally served assets and the local data source.
   - 和訳: sdd-workflow-ui クライアントは外部ネットワークからリソースを一切取得せず、ローカル配信されるアセットとローカルのデータソースのみで動作する。
6. If a data request fails, the sdd-workflow-ui client shall display the machine-readable error code and the human-readable message returned by the data source, together with a retry control.
   - 和訳: データ取得が失敗した場合、sdd-workflow-ui クライアントはデータソースが返した機械可読なエラーコードと人間可読なメッセージを、再試行の操作手段とともに表示する。
