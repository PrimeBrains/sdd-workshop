# Requirements Document

## Introduction

sdd-core は SDD Dashboard のデータ/API 層である。起動引数で指定した任意リポジトリの `.kiro/` 配下（スペック・steering・ADR・validation レポート）とスキル文書（SKILL.md / SKILL.ja.md）を読み取り、markdown を構造化パースして HTTP API として提供する。requirements / design / tasks の番号体系を解析した双方向トレーサビリティグラフ（未カバー要件・リンク切れ検出付き）、ファイル監視 + SSE によるプッシュ通知、および `.kiro/` 限定の書込 API（承認フラグ更新・フェーズ巻き戻し・ADR 作成）を含む。UI は一切持たず、下流の sdd-review-ui / sdd-workflow-ui が本 API の消費者となる。

データベースは使用せず、ファイルシステムを唯一の真実とする。構造化パースに失敗した部分は position 情報付きの生 markdown として返し、情報を一切欠落させない（情報無欠落原則）。

## Boundary Context

- **In scope**: `.kiro/` スキャンと構造化パース、トレーサビリティグラフ構築（ID 正規化・旧範囲表記の後方互換展開・逆引き・欠損検出）、ファイル監視 + SSE 配信、承認/手戻り/ADR 作成の書込 API、パース失敗時の生データフォールバック
- **Out of scope**: UI 一切（sdd-review-ui / sdd-workflow-ui が担う）、AI 実行連携、認証・マルチユーザー、`.kiro/` 以外のファイル管理、スペック内容の生成・再生成、トレーサビリティ表記法そのものの定義（steering の trace-notation.md が正典）
- **Adjacent expectations**:
  - 表記法の正典は `.kiro/steering/trace-notation.md`・`.kiro/steering/adr.md`・kiro-validate-* スキルの validation レポート規約。sdd-core はこれらに従って解釈するのみで、定義は所有しない
  - SKILL.ja.md の生成は skill-ja 直接実装が担う。sdd-core は存在するファイルを読むだけ
  - sdd-review-ui / sdd-workflow-ui は本 API の構造化 JSON と SSE イベントを消費する。API 契約の安定性が前提となる

## Requirements

### Requirement 1: サーバー起動と対象リポジトリ指定

**Objective:** 開発者として、起動引数で任意リポジトリを指定して sdd-core サーバーを立ち上げたい。SDD Dashboard をどのリポジトリにも使える汎用ツールにするため。

#### Acceptance Criteria

1. When the sdd-core server is started with a repository path argument, the sdd-core server shall resolve the argument to an absolute path and treat that repository's `.kiro/` directory as the single source of truth for all read and write operations.
   - 和訳: sdd-core サーバーがリポジトリパス引数付きで起動されたとき、sdd-core サーバーは引数を絶対パスに解決し、そのリポジトリの `.kiro/` ディレクトリをすべての読み書きの唯一の真実として扱う。
2. If the specified repository path does not exist or does not contain a `.kiro/` directory, the sdd-core server shall terminate with a non-zero exit code and an error message identifying the invalid path.
   - 和訳: 指定されたリポジトリパスが存在しないか `.kiro/` ディレクトリを含まない場合、sdd-core サーバーは非ゼロの終了コードと、不正なパスを特定できるエラーメッセージとともに終了する。
3. The sdd-core server shall listen on a configurable port, using a documented default port when none is specified.
   - 和訳: sdd-core サーバーは設定可能なポートで待ち受け、未指定時は文書化されたデフォルトポートを使用する。
4. The sdd-core server shall operate without any database, so that every API response reflects the current file contents on disk.
   - 和訳: sdd-core サーバーはいかなるデータベースも使用せずに動作し、すべての API レスポンスがディスク上の現在のファイル内容を反映する。
5. The sdd-core server shall accept HTTP requests from localhost origins only.
   - 和訳: sdd-core サーバーは localhost オリジンからの HTTP リクエストのみを受け付ける。

### Requirement 2: スペック一覧と成果物の取得

**Objective:** GUI クライアントとして、スペックの一覧と各成果物を構造化 JSON で取得したい。md を直接読まずにレビュー・俯瞰画面を構成するため。

#### Acceptance Criteria

1. When a client requests the spec list, the sdd-core server shall return every spec directory under `.kiro/specs/` with its feature name, phase, approval flags, language, timestamps, and the presence of each artifact file.
   - 和訳: クライアントがスペック一覧を要求したとき、sdd-core サーバーは `.kiro/specs/` 配下のすべてのスペックディレクトリを、feature 名・フェーズ・承認フラグ・言語・タイムスタンプ・各成果物ファイルの有無とともに返す。
2. When a client requests a single spec, the sdd-core server shall return structured representations of every artifact file that exists in the spec directory (spec.json, brief, requirements, design, tasks, research, validation reports).
   - 和訳: クライアントが単一スペックを要求したとき、sdd-core サーバーはスペックディレクトリに存在するすべての成果物ファイル（spec.json・brief・requirements・design・tasks・research・validation レポート）の構造化表現を返す。
3. If a spec directory lacks `spec.json` or contains invalid JSON, the sdd-core server shall still include the spec in responses with a parse-failure diagnostic instead of omitting it.
   - 和訳: スペックディレクトリに `spec.json` が無いか不正な JSON を含む場合でも、sdd-core サーバーはそのスペックを省略せず、パース失敗の診断情報を付けてレスポンスに含める。
4. When an artifact file changes on disk, the sdd-core server shall reflect the new content in subsequent API responses without requiring a server restart.
   - 和訳: 成果物ファイルがディスク上で変更されたとき、sdd-core サーバーはサーバー再起動なしに、以降の API レスポンスへ新しい内容を反映する。
5. When parsing a spec's `spec.json`, the sdd-core server shall expose the optional `app` field in the spec metadata as `app: string | null`, returning `null` when the field is absent so that clients can treat the spec as uncategorized.
   - 和訳: スペックの `spec.json` をパースするとき、sdd-core サーバーは任意の `app` フィールドをスペックメタデータの `app: string | null` として公開し、フィールドが存在しない場合は `null` を返してクライアントがそのスペックを未分類として扱えるようにする。

### Requirement 3: requirements.md の構造化パース

**Objective:** GUI クライアントとして、要件文書を要件・受入基準（AC）単位の構造化データとして取得したい。番号の目視突き合わせなしにレビューできるようにするため。

#### Acceptance Criteria

1. When parsing a requirements document, the sdd-core server shall extract each requirement heading with a leading numeric ID into a requirement entry holding its ID, title, and objective text.
   - 和訳: requirements 文書をパースするとき、sdd-core サーバーは先頭に数値 ID を持つ各要件見出しを、ID・タイトル・Objective テキストを保持する要件エントリとして抽出する。
2. When parsing a requirements document, the sdd-core server shall extract each acceptance criterion as an entry identified by `<要件番号>.<AC番号>` numbering.
   - 和訳: requirements 文書をパースするとき、sdd-core サーバーは各受入基準を `<要件番号>.<AC番号>` 形式の ID を持つエントリとして抽出する。
3. Where an acceptance criterion is followed by an indented `- 和訳:` bullet, the sdd-core server shall attach the bullet text to that criterion as its Japanese translation.
   - 和訳: 受入基準の直後にインデント付き `- 和訳:` 箇条書きが続く場合、sdd-core サーバーはその箇条書きテキストを当該基準の和訳として関連付ける。
4. The sdd-core server shall include source position information (start line, end line, and character offsets) for every structured element extracted from a markdown document.
   - 和訳: sdd-core サーバーは、markdown 文書から抽出したすべての構造化要素に、ソース位置情報（開始行・終了行・文字オフセット）を含める。

### Requirement 4: design.md の構造化パース

**Objective:** GUI クライアントとして、設計文書のセクション構造とトレーサビリティ宣言を構造化データとして取得したい。設計と要件の対応を機械的に辿れるようにするため。

#### Acceptance Criteria

1. When parsing a design document, the sdd-core server shall return the heading hierarchy as a section tree in which every section carries its title, depth, and source position.
   - 和訳: design 文書をパースするとき、sdd-core サーバーは見出し階層を、各セクションがタイトル・深さ・ソース位置を持つセクションツリーとして返す。
2. When parsing a design document that contains a Requirements Traceability section, the sdd-core server shall extract each table row into a structured entry holding the referenced requirement IDs, summary, components, interfaces, and flows.
   - 和訳: Requirements Traceability セクションを含む design 文書をパースするとき、sdd-core サーバーは各テーブル行を、参照要件 ID・Summary・Components・Interfaces・Flows を保持する構造化エントリとして抽出する。
3. When parsing a design document, the sdd-core server shall extract requirement ID references from component detail `Requirements` fields and component summary `Req Coverage` columns.
   - 和訳: design 文書をパースするとき、sdd-core サーバーはコンポーネント詳細の `Requirements` フィールドおよびサマリーテーブルの `Req Coverage` 列から要件 ID 参照を抽出する。
4. If a traceability table row cannot be parsed structurally, the sdd-core server shall return the row's raw text with a diagnostic while continuing to parse the remaining rows.
   - 和訳: トレーサビリティテーブルの行が構造的にパースできない場合、sdd-core サーバーはその行の生テキストを診断情報付きで返し、残りの行のパースを継続する。

### Requirement 5: tasks.md の構造化パース

**Objective:** GUI クライアントとして、実装計画をタスク単位の構造化データとして取得したい。進捗とタスク⇄要件の対応を画面に表示するため。

#### Acceptance Criteria

1. When parsing a tasks document, the sdd-core server shall extract each checkbox line into a task entry holding its task ID, description, completion state, optional parallel marker `(P)`, and optional deferrable marker `*`.
   - 和訳: tasks 文書をパースするとき、sdd-core サーバーは各チェックボックス行を、タスク ID・説明・完了状態・任意の並列マーカー `(P)`・任意の後送りマーカー `*` を保持するタスクエントリとして抽出する。
2. When parsing a tasks document, the sdd-core server shall represent the major-task / sub-task hierarchy so that each sub-task is associated with its parent major task.
   - 和訳: tasks 文書をパースするとき、sdd-core サーバーはメジャータスク/サブタスクの階層を表現し、各サブタスクが親のメジャータスクに関連付けられるようにする。
3. When parsing a tasks document, the sdd-core server shall extract the `_Requirements:_`, `_Depends:_`, and `_Boundary:_` annotations attached to each task.
   - 和訳: tasks 文書をパースするとき、sdd-core サーバーは各タスクに付与された `_Requirements:_`・`_Depends:_`・`_Boundary:_` 注記を抽出する。
4. The sdd-core server shall preserve the detail bullets of each task as part of the task entry.
   - 和訳: sdd-core サーバーは、各タスクの詳細箇条書きをタスクエントリの一部として保持する。

### Requirement 6: トレーサビリティグラフ

**Objective:** レビューする人間として、Req ⇄ Design ⇄ Task の双方向対応と欠損・リンク切れを一目で確認したい。md の番号を目視で突き合わせる作業を無くすため。

#### Acceptance Criteria

1. When a client requests the traceability graph for a spec, the sdd-core server shall return a bidirectional graph linking requirement IDs, design elements, and tasks, navigable from any node to its counterparts in both directions.
   - 和訳: クライアントがスペックのトレーサビリティグラフを要求したとき、sdd-core サーバーは要件 ID・設計要素・タスクを結ぶ双方向グラフを返し、任意のノードから両方向に対応先を辿れるようにする。
2. The sdd-core server shall interpret reference lists according to the canonical grammar defined in `.kiro/steering/trace-notation.md` (comma-separated, individually enumerated numeric IDs).
   - 和訳: sdd-core サーバーは、参照リストを `.kiro/steering/trace-notation.md` に定義された正典文法（カンマ区切り・個別全列挙の数値 ID）に従って解釈する。
3. Where a reference list in an existing document uses legacy range notation (for example `1.1-1.6`), the sdd-core server shall expand the range into consecutive IDs by enumerating integer minor numbers between both endpoints and shall verify each expanded ID against the requirements document.
   - 和訳: 既存文書の参照リストが旧範囲表記（例 `1.1-1.6`）を使用している場合、sdd-core サーバーは両端の整数 minor 番号間を列挙して連番 ID に展開し、展開した各 ID を requirements 文書と照合する。
4. If a referenced requirement ID does not exist in the requirements document, the sdd-core server shall report it as a broken link in the graph diagnostics.
   - 和訳: 参照された要件 ID が requirements 文書に存在しない場合、sdd-core サーバーはそれをグラフ診断のリンク切れとして報告する。
5. The sdd-core server shall report requirement IDs that appear in no design traceability row as design-uncovered, and requirement IDs that appear in no task `_Requirements:_` annotation as task-uncovered.
   - 和訳: sdd-core サーバーは、どの設計トレーサビリティ行にも現れない要件 ID を設計未カバーとして、どのタスクの `_Requirements:_` 注記にも現れない要件 ID をタスク未カバーとして報告する。
6. Where a reference uses the cross-spec form `<feature-name>/<ID>`, the sdd-core server shall resolve the ID against the referenced spec's requirements document.
   - 和訳: 参照がクロス spec 形式 `<feature-name>/<ID>` を使用している場合、sdd-core サーバーはその ID を参照先スペックの requirements 文書に対して解決する。
7. If a reference token does not match any known notation, the sdd-core server shall report the token as an unparsable-reference diagnostic without aborting graph construction.
   - 和訳: 参照トークンが既知のどの表記にも一致しない場合、sdd-core サーバーはそのトークンを解釈不能参照の診断として報告し、グラフ構築を中断しない。

### Requirement 7: steering・スキル・ADR・validation レポートの取得

**Objective:** GUI クライアントとして、steering 文書・スキル（英日）・ADR・validation レポートを構造化データとして取得したい。プロジェクト規約と検証結果をダッシュボードで閲覧するため。

#### Acceptance Criteria

1. When a client requests steering documents, the sdd-core server shall return every markdown file under `.kiro/steering/` with its content and section structure.
   - 和訳: クライアントが steering 文書を要求したとき、sdd-core サーバーは `.kiro/steering/` 配下のすべての markdown ファイルを、内容とセクション構造付きで返す。
2. When a client requests skills, the sdd-core server shall return every skill directory containing a `SKILL.md`, together with its `SKILL.ja.md` counterpart when present, so that clients can switch between English and Japanese versions.
   - 和訳: クライアントがスキルを要求したとき、sdd-core サーバーは `SKILL.md` を含むすべてのスキルディレクトリを、存在する場合は対応する `SKILL.ja.md` とともに返し、クライアントが英語版と日本語版を切り替えられるようにする。
3. When a client requests ADRs, the sdd-core server shall return every ADR under `.kiro/adr/` with its frontmatter fields (`id`, `title`, `status`, `date`, `specs`, `requirements`, `supersedes`, `superseded_by`) parsed and its body structured.
   - 和訳: クライアントが ADR を要求したとき、sdd-core サーバーは `.kiro/adr/` 配下のすべての ADR を、frontmatter フィールド（`id`・`title`・`status`・`date`・`specs`・`requirements`・`supersedes`・`superseded_by`）をパースし本文を構造化して返す。
4. When a client requests a spec's validation reports, the sdd-core server shall return each `validation-gap.md`, `validation-design.md`, and `validation-impl.md` that exists, with its frontmatter fields (`type`, `feature`, `date`, and `decision` when present) parsed.
   - 和訳: クライアントがスペックの validation レポートを要求したとき、sdd-core サーバーは存在する `validation-gap.md`・`validation-design.md`・`validation-impl.md` を、frontmatter フィールド（`type`・`feature`・`date`、および存在する場合 `decision`）をパースして返す。
5. If the frontmatter of an ADR or validation report is missing or malformed, the sdd-core server shall return the file content as raw markdown with a parse-failure diagnostic.
   - 和訳: ADR または validation レポートの frontmatter が欠落または不正な場合、sdd-core サーバーはファイル内容をパース失敗の診断情報付きの生 markdown として返す。
6. When a client requests ADRs, the sdd-core server shall parse the optional `app` frontmatter field and expose it as `app: string | null`, returning `null` when the field is absent to indicate a repository-cross-cutting decision.
   - 和訳: クライアントが ADR を要求したとき、sdd-core サーバーは任意の `app` frontmatter フィールドをパースして `app: string | null` として公開し、フィールドが存在しない場合はリポジトリ横断の決定を示す `null` を返す。
7. When a client requests skills, the sdd-core server shall parse the `metadata.origin` field (`"cc-sdd"` | `"custom"`) from the `SKILL.md` frontmatter and expose it as `origin: string | null`, returning `null` when the field is absent.
   - 和訳: クライアントがスキルを要求したとき、sdd-core サーバーは `SKILL.md` frontmatter の `metadata.origin` フィールド（`"cc-sdd"` | `"custom"`）をパースして `origin: string | null` として公開し、フィールドが存在しない場合は `null` を返す。

### Requirement 8: ファイル監視と SSE プッシュ

**Objective:** GUI クライアントとして、CLI/AI がファイルを変更した瞬間に通知を受け取りたい。手動リロードなしで常に最新状態を表示するため。

#### Acceptance Criteria

1. While the sdd-core server is running, the sdd-core server shall watch the monitored directories (`.kiro/` and the skill directories) for file additions, modifications, and deletions.
   - 和訳: sdd-core サーバーの稼働中、sdd-core サーバーは監視対象ディレクトリ（`.kiro/` およびスキルディレクトリ）のファイル追加・変更・削除を監視する。
2. When a watched file changes, the sdd-core server shall push an SSE event to all connected clients within 2 seconds, identifying the change type, the affected file path, and the affected resource category.
   - 和訳: 監視対象ファイルが変更されたとき、sdd-core サーバーは 2 秒以内に、変更種別・対象ファイルパス・対象リソースカテゴリを特定できる SSE イベントを接続中の全クライアントへプッシュする。
3. The sdd-core server shall emit change events only for files relevant to dashboard resources, excluding temporary and hidden files.
   - 和訳: sdd-core サーバーは、ダッシュボードのリソースに関連するファイルについてのみ変更イベントを発行し、一時ファイル・隠しファイルを除外する。
4. While an SSE connection is open, the sdd-core server shall send a keepalive ping at a regular interval so that idle connections are not dropped.
   - 和訳: SSE 接続が開いている間、sdd-core サーバーは一定間隔で keepalive ping を送信し、アイドル接続が切断されないようにする。
5. When an SSE client disconnects, the sdd-core server shall release all resources associated with that connection.
   - 和訳: SSE クライアントが切断したとき、sdd-core サーバーはその接続に関連するすべてのリソースを解放する。
6. The sdd-core server shall deliver the same change events to multiple concurrent SSE clients.
   - 和訳: sdd-core サーバーは、同時接続する複数の SSE クライアントへ同一の変更イベントを配信する。

### Requirement 9: 承認フラグ更新 API

**Objective:** ワークフロー操作者として、スペックの承認を GUI から実行したい。CLI に戻らずレビュー → 承認を完結させるため。

#### Acceptance Criteria

1. When a client requests an approval update for a phase (requirements / design / tasks), the sdd-core server shall update the corresponding approval flag in the spec's `spec.json` and return the updated spec metadata.
   - 和訳: クライアントがフェーズ（requirements / design / tasks）の承認更新を要求したとき、sdd-core サーバーは当該スペックの `spec.json` の対応する承認フラグを更新し、更新後のスペックメタデータを返す。
2. If an approval is requested for a phase whose `generated` flag is false, the sdd-core server shall reject the request with a validation error.
   - 和訳: `generated` フラグが false のフェーズに承認が要求された場合、sdd-core サーバーはバリデーションエラーでリクエストを拒否する。
3. If an approval is requested for a phase whose preceding phase is not approved, the sdd-core server shall reject the request with a validation error.
   - 和訳: 先行フェーズが未承認のフェーズに承認が要求された場合、sdd-core サーバーはバリデーションエラーでリクエストを拒否する。
4. When approval flags change, the sdd-core server shall recompute `ready_for_implementation` so that it is true only while all three phases are approved.
   - 和訳: 承認フラグが変化したとき、sdd-core サーバーは `ready_for_implementation` を再計算し、3 フェーズすべてが承認済みの間のみ true になるようにする。
5. When updating `spec.json`, the sdd-core server shall preserve all fields it does not modify and shall refresh the `updated_at` timestamp.
   - 和訳: `spec.json` を更新するとき、sdd-core サーバーは変更対象外のすべてのフィールドを保持し、`updated_at` タイムスタンプを更新する。

### Requirement 10: フェーズ巻き戻し API

**Objective:** ワークフロー操作者として、手戻りが必要になったスペックのフェーズを GUI から巻き戻したい。承認状態を矛盾なくやり直し可能な状態に戻すため。

#### Acceptance Criteria

1. When a client requests a rollback to a target phase, the sdd-core server shall set the target phase's `approved` flag to false, clear both flags of every later phase, and update the `phase` field to a value consistent with the resulting flags.
   - 和訳: クライアントが対象フェーズへの巻き戻しを要求したとき、sdd-core サーバーは対象フェーズの `approved` フラグを false にし、それより後のすべてのフェーズの両フラグをクリアし、`phase` フィールドを結果のフラグと整合する値に更新する。
2. When a rollback completes, the sdd-core server shall set `ready_for_implementation` to false.
   - 和訳: 巻き戻しが完了したとき、sdd-core サーバーは `ready_for_implementation` を false にする。
3. If the rollback target phase is unknown or the spec does not exist, the sdd-core server shall reject the request with a validation error.
   - 和訳: 巻き戻し対象フェーズが不明であるか、スペックが存在しない場合、sdd-core サーバーはバリデーションエラーでリクエストを拒否する。
4. The sdd-core server shall not delete or modify any artifact markdown files during a rollback.
   - 和訳: sdd-core サーバーは、巻き戻しの際にいかなる成果物 markdown ファイルも削除・変更しない。

### Requirement 11: ADR 作成 API

**Objective:** ワークフロー操作者として、アーキテクチャ決定を GUI から ADR として起票したい。規約準拠のファイルを手書きせずに記録するため。

#### Acceptance Criteria

1. When a client requests ADR creation with a title and body sections, the sdd-core server shall create a new file under `.kiro/adr/` named with the next sequential 4-digit number and a kebab-case slug, leaving no gaps in the numbering.
   - 和訳: クライアントがタイトルと本文セクション付きで ADR 作成を要求したとき、sdd-core サーバーは `.kiro/adr/` 配下に、次の 4 桁連番と kebab-case スラッグで命名された新規ファイルを、欠番を作らずに作成する。
2. The created ADR shall contain frontmatter conforming to the project ADR conventions (`id`, `title`, `status`, `date`, `specs`, `requirements`, `supersedes`, `superseded_by`) and the required body sections `## Context`, `## Decision`, and `## Consequences`.
   - 和訳: 作成された ADR は、プロジェクトの ADR 規約に準拠した frontmatter（`id`・`title`・`status`・`date`・`specs`・`requirements`・`supersedes`・`superseded_by`）と、必須本文セクション `## Context`・`## Decision`・`## Consequences` を含む。
3. When ADR creation input omits a status, the sdd-core server shall default the status to `proposed` and the date to the current date.
   - 和訳: ADR 作成入力に status が省略されたとき、sdd-core サーバーは status を `proposed` に、date を当日にデフォルト設定する。
4. If ADR creation input is missing required fields, or its `requirements` references do not follow the cross-spec reference form, the sdd-core server shall reject the request with a field-level validation error.
   - 和訳: ADR 作成入力に必須フィールドが欠けている場合、または `requirements` 参照がクロス spec 参照形式に従っていない場合、sdd-core サーバーはフィールド単位のバリデーションエラーでリクエストを拒否する。
5. If the computed ADR number collides with an existing file at write time, the sdd-core server shall fail the request without overwriting the existing file.
   - 和訳: 算出した ADR 番号が書込時に既存ファイルと衝突する場合、sdd-core サーバーは既存ファイルを上書きせずにリクエストを失敗させる。
6. Where ADR creation input includes an optional `app` field, the sdd-core server shall write its value into the created ADR's `app` frontmatter key, and shall set the key to `null` when the input omits it.
   - 和訳: ADR 作成入力に任意の `app` フィールドが含まれる場合、sdd-core サーバーはその値を作成された ADR の `app` frontmatter キーに書き込み、入力で省略された場合はキーを `null` に設定する。

### Requirement 12: 書込の安全性と監査

**Objective:** リポジトリ所有者として、ダッシュボード経由の書込が `.kiro/` の外に及ばないことを保証したい。汎用ツールとして安心して任意リポジトリへ向けられるようにするため。

#### Acceptance Criteria

1. The sdd-core server shall restrict all write operations to paths inside the target repository's `.kiro/` directory.
   - 和訳: sdd-core サーバーは、すべての書込操作を対象リポジトリの `.kiro/` ディレクトリ内のパスに限定する。
2. If a write request resolves, after path normalization and symlink resolution, to a path outside the `.kiro/` directory, the sdd-core server shall reject the request.
   - 和訳: 書込リクエストがパス正規化とシンボリックリンク解決の後に `.kiro/` ディレクトリ外のパスへ解決される場合、sdd-core サーバーはリクエストを拒否する。
3. When any write operation is attempted, the sdd-core server shall record an audit log entry containing the timestamp, operation type, target path, and outcome.
   - 和訳: いずれかの書込操作が試行されたとき、sdd-core サーバーはタイムスタンプ・操作種別・対象パス・結果を含む監査ログエントリを記録する。
4. If a write operation fails midway, the sdd-core server shall leave the target file in a valid state, holding either the previous content or the complete new content.
   - 和訳: 書込操作が途中で失敗した場合、sdd-core サーバーは対象ファイルを、従前の内容か完全な新内容のいずれかを保持する正常な状態のままにする。

### Requirement 13: エラー応答と情報無欠落原則

**Objective:** GUI クライアントとして、エラーを機械可読に受け取り、パースに失敗した内容も欠落なく表示したい。どんな入力でもダッシュボードが情報を失わないようにするため。

#### Acceptance Criteria

1. If an API request fails, the sdd-core server shall return a structured error response containing a machine-readable error code, a human-readable message, and an appropriate HTTP status.
   - 和訳: API リクエストが失敗した場合、sdd-core サーバーは機械可読なエラーコード・人間可読なメッセージ・適切な HTTP ステータスを含む構造化エラーレスポンスを返す。
2. If part of a markdown document cannot be parsed structurally, the sdd-core server shall return that part as a raw markdown block with its source position, while returning the successfully parsed remainder as structured data.
   - 和訳: markdown 文書の一部が構造的にパースできない場合、sdd-core サーバーはその部分をソース位置付きの生 markdown ブロックとして返し、パースに成功した残りは構造化データとして返す。
3. The sdd-core server shall guarantee that the union of structured elements and raw fallback blocks covers the entire source document content without omission.
   - 和訳: sdd-core サーバーは、構造化要素と生フォールバックブロックの和がソース文書の全内容を欠落なくカバーすることを保証する。
4. If an unexpected exception occurs while serving a request, the sdd-core server shall return a structured server-error response without terminating the server process.
   - 和訳: リクエスト処理中に予期しない例外が発生した場合、sdd-core サーバーはサーバープロセスを終了させることなく、構造化されたサーバーエラーレスポンスを返す。
