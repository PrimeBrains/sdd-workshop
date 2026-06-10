# Requirements Document

## Introduction

sdd-review-ui は SDD Dashboard のレビュアー体験を担う画面群である。上流の sdd-core が提供する構造化 JSON・トレーサビリティグラフ・変更通知を消費し、スペック成果物（brief / requirements / design / tasks / research）の構造化ビューア、Req ⇄ Design ⇄ Task の相互リンクナビゲーション、サイドバイサイド比較ビュー、トレーサビリティマトリクス、validation レポート表示をブラウザ上で提供する。

本スペックは**読み取り専用**の画面群として完結する。元ファイルの情報を一切欠落させないこと（情報無欠落原則: 構造化表示できない内容は生 markdown として必ず表示する）を最優先要件とし、CLI/AI がスペックを生成・編集している間も画面が自動的に最新状態へ追従する。

## Boundary Context

- **In scope**: スペック一覧とドキュメント選択ナビゲーション、requirements / design / tasks / brief / research の構造化ビューア（生 markdown フォールバック付き）、相互リンクナビゲーション（双方向ジャンプ・ジャンプ履歴）、サイドバイサイド比較（対応箇所ハイライト）、トレーサビリティマトリクス（未カバー・リンク切れの可視化）、validation レポート（gap / design / impl）表示、変更通知による自動更新
- **Out of scope**: 承認・手戻りなどの書込操作 UI（sdd-workflow-ui が本レビュー画面に重ねる）、フロー俯瞰ボード・ヘルプ・steering / スキル / ADR 閲覧（sdd-workflow-ui）、markdown パース・トレーサビリティグラフ構築・診断の判定（sdd-core。本スペックは提供されたグラフと診断をそのまま表示し、独自の解釈・再計算をしない）、`.kiro/` への書込一切
- **Adjacent expectations**:
  - sdd-core の HTTP API（構造化スペックデータ・トレーサビリティグラフ・変更通知ストリーム）と公開契約型が上流契約として安定していること
  - sdd-workflow-ui は同一 SPA 内に画面を追加し、本スペックのレビュー画面へ操作 UI を重ねる。本スペックはそのための画面構成上の前提（読み取り専用画面として完結すること）を壊さない

## Requirements

### Requirement 1: スペック一覧とドキュメント選択

**Objective:** レビュアーとして、スペックの一覧から対象スペックと成果物を選んで開きたい。エディタでファイルを探し回らずにレビューを始めるため。

#### Acceptance Criteria

1. When the user opens the dashboard, the sdd-review-ui client shall display the list of all specs with each spec's feature name, phase, approval state, and artifact availability.
   - 和訳: ユーザーがダッシュボードを開いたとき、sdd-review-ui クライアントはすべてのスペックの一覧を、各スペックの feature 名・フェーズ・承認状態・成果物の有無とともに表示する。
2. When the user selects a spec, the sdd-review-ui client shall present that spec's existing artifacts (brief, requirements, design, tasks, research) and validation reports as selectable document views.
   - 和訳: ユーザーがスペックを選択したとき、sdd-review-ui クライアントはそのスペックに存在する成果物（brief・requirements・design・tasks・research）と validation レポートを、選択可能なドキュメントビューとして提示する。
3. Where an artifact file does not exist for the selected spec, the sdd-review-ui client shall indicate its absence without treating it as an error.
   - 和訳: 選択中のスペックに成果物ファイルが存在しない場合、sdd-review-ui クライアントはそれをエラーとして扱わず、不在であることを表示する。
4. The sdd-review-ui client shall represent the selected spec and document in the URL, so that the same view can be restored by reloading or sharing the URL.
   - 和訳: sdd-review-ui クライアントは選択中のスペックとドキュメントを URL に表現し、リロードや URL 共有で同じビューを復元できるようにする。
5. If a data request fails, the sdd-review-ui client shall display the machine-readable error code and the human-readable message returned by the data source, together with a retry control.
   - 和訳: データ取得が失敗した場合、sdd-review-ui クライアントはデータソースが返した機械可読なエラーコードと人間可読なメッセージを、再試行の操作手段とともに表示する。

### Requirement 2: 構造化ドキュメント表示と情報無欠落

**Objective:** レビュアーとして、スペック成果物を構造化されたビューで読みたい。ただし元ファイルの内容が画面から一切欠落しないことを保証したうえで、md 直読みより速く正確にレビューするため。

#### Acceptance Criteria

1. When displaying a requirements document, the sdd-review-ui client shall render each requirement as a structured view holding its ID, title, objective, and the list of acceptance criteria identified by `<要件番号>.<AC番号>` numbering.
   - 和訳: requirements 文書を表示するとき、sdd-review-ui クライアントは各要件を、ID・タイトル・Objective・`<要件番号>.<AC番号>` 形式の ID を持つ受入基準リストを保持する構造化ビューとして描画する。
2. Where an acceptance criterion has a Japanese translation, the sdd-review-ui client shall display the English statement and its translation together as a pair.
   - 和訳: 受入基準に和訳が付いている場合、sdd-review-ui クライアントは英文と和訳をペアで並べて表示する。
3. When displaying a design document, the sdd-review-ui client shall render the heading hierarchy as a navigable section structure and render the traceability table as a structured table.
   - 和訳: design 文書を表示するとき、sdd-review-ui クライアントは見出し階層をナビゲーション可能なセクション構造として描画し、トレーサビリティテーブルを構造化されたテーブルとして描画する。
4. When displaying a tasks document, the sdd-review-ui client shall render the major/sub-task hierarchy with each task's completion state, parallel and optional markers, and its requirements / depends / boundary annotations.
   - 和訳: tasks 文書を表示するとき、sdd-review-ui クライアントはメジャー/サブタスクの階層を、各タスクの完了状態・並列/後送りマーカー・requirements / depends / boundary 注記とともに描画する。
5. When a structured document contains raw fallback blocks, the sdd-review-ui client shall render each raw block's full markdown content at its position in document order, so that no part of the source document is omitted from the screen.
   - 和訳: 構造化ドキュメントが生フォールバックブロックを含むとき、sdd-review-ui クライアントは各生ブロックの markdown 内容全文を文書順の該当位置に描画し、元文書のいかなる部分も画面から欠落しないようにする。
6. The sdd-review-ui client shall render all document content, including raw fallback blocks, as inert text and styled elements, so that document content can never execute scripts or alter the page outside the viewer.
   - 和訳: sdd-review-ui クライアントは生フォールバックブロックを含むすべてのドキュメント内容を不活性なテキストと装飾要素として描画し、ドキュメント内容がスクリプトを実行したりビューア外のページを改変したりできないようにする。
7. When displaying a brief or research document, the sdd-review-ui client shall render its section structure and content as readable formatted text.
   - 和訳: brief または research 文書を表示するとき、sdd-review-ui クライアントはそのセクション構造と内容を読みやすい整形済みテキストとして描画する。
8. When a document contains a fenced `mermaid` code block, the sdd-review-ui client shall render the block as a diagram.
   - 和訳: ドキュメントが `mermaid` フェンスコードブロックを含むとき、sdd-review-ui クライアントはそのブロックを図として描画する。
9. If rendering of a `mermaid` code block fails, the sdd-review-ui client shall display the block's raw code together with a visible warning instead of silently dropping the block.
   - 和訳: `mermaid` コードブロックの描画が失敗した場合、sdd-review-ui クライアントはそのブロックを黙って欠落させる代わりに、生のコード全文を目に見える警告とともに表示する。

### Requirement 3: 相互リンクナビゲーション

**Objective:** レビュアーとして、要件 ID・設計要素・タスクの参照をクリックして対応先へ双方向にジャンプしたい。番号の目視突き合わせを無くし、どこにいても出自へ戻れるようにするため。

#### Acceptance Criteria

1. When the user activates a requirement ID reference anywhere in the UI, the sdd-review-ui client shall present the design elements and tasks that cover that requirement and allow jumping to each of them.
   - 和訳: ユーザーが UI 上の任意の場所で要件 ID 参照を選択したとき、sdd-review-ui クライアントはその要件をカバーする設計要素とタスクを提示し、それぞれへジャンプできるようにする。
2. When the user activates a design element or a task that references requirements, the sdd-review-ui client shall allow jumping to each referenced requirement.
   - 和訳: ユーザーが要件を参照する設計要素またはタスクを選択したとき、sdd-review-ui クライアントは参照されている各要件へジャンプできるようにする。
3. When a jump is performed, the sdd-review-ui client shall scroll the target element into view and visually highlight it.
   - 和訳: ジャンプが実行されたとき、sdd-review-ui クライアントはジャンプ先の要素を画面内にスクロールし、視覚的にハイライトする。
4. The sdd-review-ui client shall maintain a navigation history of jumps, so that the user can return to the origin of each jump.
   - 和訳: sdd-review-ui クライアントはジャンプのナビゲーション履歴を保持し、ユーザーが各ジャンプの出自へ戻れるようにする。
5. If a reference is reported as a broken link by the traceability data, the sdd-review-ui client shall display the reference with a distinct broken-link indication instead of offering a jump to a nonexistent target.
   - 和訳: 参照がトレーサビリティデータでリンク切れと報告されている場合、sdd-review-ui クライアントは存在しないジャンプ先を提示する代わりに、その参照をリンク切れと判別できる表示で示す。
6. Where a reference uses the cross-spec form `<feature-name>/<ID>`, the sdd-review-ui client shall jump to the referenced requirement in the other spec's requirements document.
   - 和訳: 参照がクロス spec 形式 `<feature-name>/<ID>` を使用している場合、sdd-review-ui クライアントは参照先スペックの requirements 文書内の当該要件へジャンプする。
7. The sdd-review-ui client shall encode the current navigation state — screen, selected spec, document, and focus target (such as a focused acceptance criterion, design section, traceability row, or task) — in the URL.
   - 和訳: sdd-review-ui クライアントは現在のナビゲーション状態 — 画面・選択中のスペック・ドキュメント・フォーカス対象（フォーカス中の受入基準・design セクション・トレーサビリティ行・タスクなど）— を URL に符号化する。
8. When the user activates the browser back or forward control, the sdd-review-ui client shall restore the corresponding navigation state, including the focus and scroll target.
   - 和訳: ユーザーがブラウザの戻る / 進む操作を行ったとき、sdd-review-ui クライアントはフォーカス・スクロール対象を含む該当のナビゲーション状態を復元する。
9. When a URL containing a focus target is opened by reload or as a shared link, the sdd-review-ui client shall restore the same view and scroll the focus target into view.
   - 和訳: フォーカス対象を含む URL がリロードまたは共有リンクとして開かれたとき、sdd-review-ui クライアントは同じビューを復元し、フォーカス対象を画面内にスクロールする。
10. If the anchor of a covering design section cannot be resolved in the design document, the sdd-review-ui client shall navigate to the corresponding structured traceability row instead, so that no jump results in a dead click.
    - 和訳: カバーする design セクションのアンカーが design 文書内で解決できない場合、sdd-review-ui クライアントは代わりに対応する構造化トレーサビリティ行へ遷移し、いかなるジャンプもデッドクリックにならないようにする。

### Requirement 4: サイドバイサイド比較ビュー

**Objective:** レビュアーとして、2 つの成果物を並べて対応箇所を突き合わせたい。requirements と design の整合レビューを 1 画面で完結させるため。

#### Acceptance Criteria

1. When the user opens the comparison view, the sdd-review-ui client shall display two documents of the selected spec side by side.
   - 和訳: ユーザーが比較ビューを開いたとき、sdd-review-ui クライアントは選択中のスペックの 2 つのドキュメントをサイドバイサイドで表示する。
2. The sdd-review-ui client shall allow the user to change which document is shown in each pane.
   - 和訳: sdd-review-ui クライアントは、各ペインに表示するドキュメントをユーザーが切り替えられるようにする。
3. When the user selects an element that has correspondences in one pane, the sdd-review-ui client shall highlight the corresponding elements in the other pane and scroll the first correspondence into view.
   - 和訳: ユーザーが一方のペインで対応関係を持つ要素を選択したとき、sdd-review-ui クライアントはもう一方のペインの対応要素をハイライトし、先頭の対応要素を画面内にスクロールする。
4. While the comparison view is open, the sdd-review-ui client shall keep cross-link navigation available within each pane.
   - 和訳: 比較ビューが開いている間、sdd-review-ui クライアントは各ペイン内で相互リンクナビゲーションを利用可能に保つ。

### Requirement 5: トレーサビリティマトリクス

**Objective:** レビュアーとして、Req × Design × Task のカバレッジを一覧で確認したい。未カバー要件とリンク切れを見落とさずに承認判断するため。

#### Acceptance Criteria

1. When the user opens the traceability matrix, the sdd-review-ui client shall display the coverage of every requirement ID across design elements and tasks, based on the traceability graph provided by the data source.
   - 和訳: ユーザーがトレーサビリティマトリクスを開いたとき、sdd-review-ui クライアントはデータソースが提供するトレーサビリティグラフに基づき、すべての要件 ID の設計要素・タスクにわたるカバレッジを表示する。
2. The sdd-review-ui client shall visually highlight requirement IDs reported as design-uncovered or task-uncovered.
   - 和訳: sdd-review-ui クライアントは、設計未カバーまたはタスク未カバーと報告された要件 ID を視覚的にハイライトする。
3. The sdd-review-ui client shall display the broken-link and unparsable-reference diagnostics reported by the data source alongside the matrix.
   - 和訳: sdd-review-ui クライアントは、データソースが報告したリンク切れおよび解釈不能参照の診断を、マトリクスと併せて表示する。
4. When the user activates a matrix entry, the sdd-review-ui client shall navigate to the corresponding element in the relevant document view.
   - 和訳: ユーザーがマトリクスのエントリを選択したとき、sdd-review-ui クライアントは該当ドキュメントビュー内の対応要素へ遷移する。
5. The sdd-review-ui client shall present the traceability graph and its diagnostics exactly as provided, without computing additional coverage judgments of its own.
   - 和訳: sdd-review-ui クライアントはトレーサビリティグラフとその診断を提供されたとおりに表示し、独自のカバレッジ判定を追加で計算しない。

### Requirement 6: validation レポート表示

**Objective:** レビュアーとして、ギャップ分析・設計検証・実装検証のレポートをダッシュボードで読みたい。検証結果を承認判断の材料として参照するため。

#### Acceptance Criteria

1. When the user selects a spec, the sdd-review-ui client shall list that spec's existing validation reports (gap / design / impl) with their type, date, and decision metadata.
   - 和訳: ユーザーがスペックを選択したとき、sdd-review-ui クライアントはそのスペックに存在する validation レポート（gap / design / impl）を、type・date・decision のメタデータとともに一覧表示する。
2. When the user opens a validation report, the sdd-review-ui client shall render its structured content, rendering raw fallback blocks according to the no-information-loss principle.
   - 和訳: ユーザーが validation レポートを開いたとき、sdd-review-ui クライアントはその構造化された内容を描画し、生フォールバックブロックは情報無欠落原則に従って描画する。
3. If a validation report is provided as raw content due to a parse failure, the sdd-review-ui client shall display the raw content together with the reported diagnostic.
   - 和訳: validation レポートがパース失敗により生の内容として提供された場合、sdd-review-ui クライアントは報告された診断とともにその生の内容を表示する。
4. Where a validation report type has not been generated for the spec, the sdd-review-ui client shall indicate that the report does not exist yet.
   - 和訳: スペックに対して未生成の validation レポート種別がある場合、sdd-review-ui クライアントはそのレポートがまだ存在しないことを表示する。

### Requirement 7: 変更の自動反映

**Objective:** レビュアーとして、CLI/AI がスペックを生成・編集している最中も画面が自動で最新化されてほしい。手動リロードなしで生成中のスペックをリアルタイムに閲覧するため。

#### Acceptance Criteria

1. When a change notification affecting a currently displayed resource is received, the sdd-review-ui client shall automatically refresh the affected views without a manual page reload.
   - 和訳: 表示中のリソースに影響する変更通知を受信したとき、sdd-review-ui クライアントは手動のページリロードなしに、影響を受けるビューを自動的に最新化する。
2. While successive change notifications arrive for the displayed spec, the sdd-review-ui client shall keep the displayed document content up to date and preserve the user's current spec and document selection.
   - 和訳: 表示中のスペックに対して連続的な変更通知が届いている間、sdd-review-ui クライアントは表示中のドキュメント内容を最新に保ち、ユーザーの現在のスペック・ドキュメント選択を維持する。
3. If the change notification connection is lost, the sdd-review-ui client shall indicate the disconnected state and automatically attempt to reconnect, refreshing the displayed data once reconnected.
   - 和訳: 変更通知の接続が失われた場合、sdd-review-ui クライアントは切断状態を表示し、自動的に再接続を試行し、再接続できたら表示中のデータを最新化する。
4. When a change notification concerns only resources that are not currently displayed, the sdd-review-ui client shall not disrupt the user's current view.
   - 和訳: 変更通知が表示中でないリソースのみに関するものであるとき、sdd-review-ui クライアントはユーザーの現在のビューを乱さない。

### Requirement 8: 読み取り専用と完全ローカル動作

**Objective:** リポジトリ所有者として、レビュー画面が一切の書込を行わず外部ネットワークにも依存しないことを保証したい。レビュー閲覧が成果物を汚染せず、オフラインでも動作するようにするため。

#### Acceptance Criteria

1. The sdd-review-ui client shall provide no control that creates, modifies, or deletes any file or repository data.
   - 和訳: sdd-review-ui クライアントは、ファイルやリポジトリのデータを作成・変更・削除する操作手段を一切提供しない。
2. The sdd-review-ui client shall operate without retrieving any resource from external networks, using only locally served assets and the local data source.
   - 和訳: sdd-review-ui クライアントは外部ネットワークからリソースを一切取得せず、ローカル配信されるアセットとローカルのデータソースのみで動作する。
