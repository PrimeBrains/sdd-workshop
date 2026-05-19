# 要件定義書: defect-pdca

## Introduction

AI 駆動の開発作業で発生する不具合 (実装ミス・仕様の見落とし・レビューすり抜け・テストギャップ・環境設定漏れなど) を、その場限りの個別修正で終わらせず **プロジェクトの学習資産として体系化する PDCA 基盤** を構築する。不具合 1 件ごとに 10 項目 (発生機能 + 9 分析項目) を記録する追記型 Markdown ledger (`.kiro/postmortem/defects.md`) と、それを操作・分析する 2 つの skill (`/kiro-postmortem-add`, `/kiro-postmortem-review`) を導入し、抽出された Try を既存 `/kiro-steering-custom` 経由で `.kiro/steering/*.md` に反映する Plan → Do → Check → Act のサイクルを実装する。

主たる利用者は、AI と協働して本リポジトリで開発する個人開発者・プロジェクトオーナー。今セッションだけでも「自明な変換だからテスト省略」「要件文に実装詳細を埋め込む」「seed と runtime の DB パス分裂」「Playwright `text=` セレクター + `first()` の脆弱化」のような繰り返し起こりうる判断ミスが顕在化しており、これらを次セッションに引き継がない仕組みが必要である。

> **記述スタイル**: 本要件は `.kiro/steering/requirements-style.md` の規約に従い、Acceptance Criteria は EARS 英文 + 和訳併記で記述する。Introduction / Objective / Boundary Context は日本語のみ。

## Boundary Context

- **In scope（本スペックで実装する成果物）**:
  - `.kiro/postmortem/defects.md` ledger ファイルの設計と空テンプレ（ヘッダ・PDCA 運用ガイド・スキーマ説明・分類タクソノミー定義を含む）
  - Entry スキーマ（10 項目）の定義と Markdown 構造化テンプレ
  - 要因分類タクソノミー / 根本要因分類タクソノミー / 検知工程タクソノミー / 発生機能タクソノミーの定義
  - `.claude/skills/kiro-postmortem-add/` skill 定義（記録フロー）
  - `.claude/skills/kiro-postmortem-review/` skill 定義（集約分析・Try 抽出フロー）
  - 既存 `/kiro-steering-custom` への Try ハンドオフ手順（呼び出し側のみ）
  - 初期 seed entry 3 件（今セッションで明らかになった `fmtMD` / seed DB 分裂 / Playwright セレクター脆弱性）の登録
  - PDCA 運用ガイドラインの ledger ヘッダ文書化
- **Out of scope（本スペックでは実装しない）**:
  - `/kiro-steering-custom` 自体の修正（既存・流用のみ）
  - 既存機能 spec（`core-data-model` / `evm-engine` / `progress-tracking` / `dashboard`）の修正
  - `.claude/settings.json` への hook 追加による完全自動化
  - 過去不具合の遡及登録（運用開始以降の新規 entry + 3 件の初期 seed のみ対象）
  - 自動分類（LLM ベースのカテゴリ推論）
  - 外部 issue tracker（GitHub Issues / Backlog / Linear）との同期
  - 可視化ツール（チャート・dashboard 化）
- **Adjacent expectations（隣接スペック / 既存資産へ求める前提）**:
  - `/kiro-steering-custom` skill が現状の signature で動作し続けること（Try 文字列を受け取り `.kiro/steering/*.md` に反映する）
  - `.kiro/steering/` ディレクトリが project-wide な AI memory として読み込まれ続けること（CLAUDE.md の "Load entire .kiro/steering/ as project memory" 規約）
  - Git による `.kiro/postmortem/` ディレクトリのバージョン管理が可能であること（`.gitignore` で除外されていない）

## Requirements

### Requirement 1: Ledger ファイルの配置と初期化

**Objective**: 開発者として、不具合事例の保管場所を一意に定め、誰でも追記・参照できる単一の永続ファイルとしたい。

#### Acceptance Criteria

1. The defect-pdca system shall persist all defect entries to a single Markdown file at `.kiro/postmortem/defects.md`.
   - 和訳: defect-pdca システムは、すべての不具合エントリを `.kiro/postmortem/defects.md` の単一 Markdown ファイルに永続化する。
2. When `.kiro/postmortem/defects.md` does not exist at the time of the first entry creation, the `/kiro-postmortem-add` skill shall create it with a documented header containing (a) the PDCA workflow description, (b) the 10-item entry schema, (c) the 要因分類 taxonomy, (d) the 検知工程 taxonomy, (e) the 発生機能 taxonomy.
   - 和訳: `.kiro/postmortem/defects.md` が最初のエントリ作成時点で存在しない場合、`/kiro-postmortem-add` skill は (a) PDCA ワークフローの説明、(b) 10 項目スキーマ、(c) 要因分類タクソノミー、(d) 検知工程タクソノミー、(e) 発生機能タクソノミーを含む文書化されたヘッダ付きで、このファイルを作成する。
3. While `/kiro-postmortem-add` operates, the skill shall use append-only semantics: existing entries shall NOT be edited or deleted by this skill.
   - 和訳: `/kiro-postmortem-add` の動作中、本 skill は append-only セマンティクスを用い、既存エントリの編集・削除は行わない。
4. The ledger file shall reside under `.kiro/postmortem/` and shall be Git-trackable (not excluded by `.gitignore`).
   - 和訳: ledger ファイルは `.kiro/postmortem/` 配下に配置し、`.gitignore` で除外されず Git 管理可能とする。

### Requirement 2: Entry スキーマ（必須 10 項目）

**Objective**: 開発者として、不具合 1 件を一意に分析できる十分な情報を構造化された形で記録し、かつ「どの機能で起きたか」も後から横断検索できるようにしたい。

#### Acceptance Criteria

1. Each defect entry in the ledger shall record the following 10 fields in this order: (1) 発生機能, (2) 発生した不具合, (3) 検知した工程, (4) 検知すべき工程, (5) 検知すべき工程で検知できなかった理由, (6) 要因分類, (7) 根本要因分類, (8) 根本要因詳細, (9) 同件調査, (10) 次回からの対応策.
   - 和訳: ledger 内の各不具合エントリは、(1) 発生機能、(2) 発生した不具合、(3) 検知した工程、(4) 検知すべき工程、(5) 検知すべき工程で検知できなかった理由、(6) 要因分類、(7) 根本要因分類、(8) 根本要因詳細、(9) 同件調査、(10) 次回からの対応策の 10 項目をこの順序で記録する。
2. The `発生機能` field shall reference exactly one label from the 発生機能 taxonomy defined in Requirement 13, optionally followed by a free-text sub-scope (例: `dashboard / SummaryStrip`, `core-data-model / seed`, `e2e / workbench.spec.ts`).
   - 和訳: `発生機能` フィールドは Requirement 13 で定義する発生機能タクソノミーから 1 ラベルを参照し、任意で自由テキストの sub-scope を続けて記述してよい (例: `dashboard / SummaryStrip`, `core-data-model / seed`, `e2e / workbench.spec.ts`)。
3. Each entry shall include an entry ID (monotonically increasing integer or ISO-8601 timestamp) assigned at creation time.
   - 和訳: 各エントリは作成時に割り当てられるエントリ ID (単調増加の整数または ISO-8601 タイムスタンプ) を持つ。
4. Each entry shall include a `created_at` timestamp in ISO 8601 format, recorded at the time of `/kiro-postmortem-add` finalization.
   - 和訳: 各エントリは ISO 8601 形式の `created_at` タイムスタンプを持ち、`/kiro-postmortem-add` の確定時点を記録する。
5. If any of the 10 mandatory fields is empty at the time of finalization, the `/kiro-postmortem-add` skill shall refuse to append the entry and shall report which field is missing.
   - 和訳: 確定時点で 10 項目の必須フィールドのいずれかが空である場合、`/kiro-postmortem-add` skill はエントリの追記を拒否し、欠落しているフィールドを報告する。
6. Each entry shall include a one-line `title` summarizing the defect (typically derived from `発生した不具合`) used as the heading on the ledger Markdown render.
   - 和訳: 各エントリは不具合を要約する 1 行の `title` (通常は `発生した不具合` から導出) を持ち、ledger Markdown レンダリングの見出しとして用いる。

### Requirement 3: 要因分類タクソノミー（成果物軸 / What）

**Objective**: 「欠陥が宿る成果物 (要件文書・設計・コード・環境・状態・ツール・外部依存)」を軸に同種の不具合をグルーピングしたい。検証層 (レビュー・テスト) のすり抜けは別軸 (R4) で表現するため、本軸からは除外する。

#### Acceptance Criteria

1. The defect-pdca system shall define a fixed taxonomy of 要因分類 labels representing the artifact where the defect resides, including at least: `requirements-error` / `design-error` / `impl-error` / `env-config` / `data-state-dep` / `tooling-fragility` / `external-dependency` / `other`. Verification-layer gaps (例: review missed, unit test missing) shall NOT be represented in this taxonomy; they are expressed via the gap between `検知した工程` and `検知すべき工程` defined in Requirement 4.
   - 和訳: defect-pdca システムは、欠陥が宿る成果物を表す要因分類ラベルの固定タクソノミーを定義し、少なくとも `requirements-error` / `design-error` / `impl-error` / `env-config` / `data-state-dep` / `tooling-fragility` / `external-dependency` / `other` を含める。検証層のすり抜け (例: レビュー漏れ・ユニットテスト不在) は本タクソノミーで表現せず、Requirement 4 で定義する `検知した工程` と `検知すべき工程` のギャップで表現する。
2. Each entry's `要因分類` field shall reference exactly one label from the defined taxonomy.
   - 和訳: 各エントリの `要因分類` フィールドは、定義されたタクソノミーから 1 ラベルを参照する。
3. The ledger header shall document the taxonomy and the meaning of each label.
   - 和訳: ledger ヘッダは要因分類タクソノミーと各ラベルの意味を文書化する。
4. When the user attempts to record a label outside the taxonomy, the `/kiro-postmortem-add` skill shall surface the existing taxonomy as suggestions and require the user to either pick an existing label or explicitly extend the taxonomy in the ledger header (in the same operation).
   - 和訳: ユーザーがタクソノミー外のラベルを記録しようとした場合、`/kiro-postmortem-add` skill は既存タクソノミーを候補として提示し、既存ラベルを選択するか同一操作の中で ledger ヘッダのタクソノミーを明示的に拡張するかをユーザーに求める。

#### Label Definitions

| Label | 定義 (判定基準) | 該当例 |
|---|---|---|
| `requirements-error` | 要件文書 (`requirements.md`) 自体に誤り・抜け・矛盾・実装詳細の混入があり、その質に起因する。仕様の表現を直さない限り再発する。 | 旧 dashboard Req 4.7 が `(n / 1_000_000)` を仕様レベルで埋め込んでいた |
| `design-error` | 設計判断 (`design.md`) が誤っていた / 抜けていた / 整合していない。要件は正しいが設計でブレた。 | コンポーネント境界が曖昧で複数 spec が同じ責務を持つ |
| `impl-error` | 要件・設計通りでなく、コード実装そのものが誤っている。仕様レビューでは捕まらず、コード本体の修正で解消する。 | `fmtMD` が仕様外に 1_000_000 で割算するコードになっていた / `±0.0 MD` ハードコード |
| `env-config` | 環境設定 / 構成 (DB パス / 環境変数 / ファイル配置 / Node バージョン) の不整合で発生。コードはどの環境でも妥当でも、構成のズレで壊れる。 | seed と server runtime で DB パスが分裂していた |
| `data-state-dep` | テスト間 / 環境間で状態 (DB レコード / キャッシュ / ファイル) が想定外に残存・変動して引き起こされる。 | 前テストの保存値が次テストで disabled ボタンを生む |
| `tooling-fragility` | ライブラリ / ツールの仕様や挙動 (Playwright `text=` の substring match、SQLite `AUTOINCREMENT` 等) に依存した脆さ。ツールの正常動作の中で発生する。 | `getByText('EV')` が "EVM STUDIO" にも合致してしまった |
| `external-dependency` | 外部サービス・パッケージの破壊的変更・バージョン非互換・障害に起因する。プロジェクト内のコードや構成は変えていないのに壊れる。 | better-sqlite3 が Node v21 で `util.styleText` 非互換を起こす |
| `other` | 上記いずれにも明確に分類できない。レビュー段階で分類可能であれば原則 `other` は避ける。 | (該当時に記録) |

### Requirement 4: 検知工程タクソノミー（検証層 / Where）

**Objective**: 「どの検証層で気付けたはず・気付いたか」を一意に表現し、両者のギャップで「すり抜けた検証層」を明示したい。検証層のみを対象とし、要件作成・設計・実装といった成果物作成工程は対象外とする (成果物軸は R3 で表現)。V モデルに従い、実装ミスは単体テスト・設計ミスは結合テスト・要件ミスは E2E (受入相当) で検知されるべきという原則を反映する。

#### Acceptance Criteria

1. The defect-pdca system shall define a fixed taxonomy of 検知工程 labels representing verification layers (NOT artifact creation phases): `code-review` / `unit-test` / `integration-test` / `e2e` / `manual-verification` / `production` / `user-report`.
   - 和訳: defect-pdca システムは、検証層を表す検知工程ラベルの固定タクソノミー (`code-review` / `unit-test` / `integration-test` / `e2e` / `manual-verification` / `production` / `user-report`) を定義する。成果物作成工程 (要件作成・設計・実装) は含めない。
2. Each entry's `検知した工程` and `検知すべき工程` fields shall each reference exactly one label from the taxonomy.
   - 和訳: 各エントリの `検知した工程` および `検知すべき工程` の各フィールドは、上記タクソノミーから 1 ラベルを参照する。
3. If `検知した工程 ≠ 検知すべき工程`, the entry's `検知すべき工程で検知できなかった理由` field shall be non-empty and explain the gap.
   - 和訳: `検知した工程 ≠ 検知すべき工程` の場合、エントリの `検知すべき工程で検知できなかった理由` フィールドは非空とし、ギャップの理由を説明する。
4. If `検知した工程 == 検知すべき工程`, the entry's `検知すべき工程で検知できなかった理由` field shall record either "該当なし (同工程で検知)" or a brief note explaining residual learning.
   - 和訳: `検知した工程 == 検知すべき工程` の場合、エントリの `検知すべき工程で検知できなかった理由` フィールドには「該当なし (同工程で検知)」または残存する学びの簡潔な注記を記録する。
5. The gap between `検知した工程` and `検知すべき工程` shall be interpreted as the verification-layer that failed (例: `検知した工程 = user-report` かつ `検知すべき工程 = code-review` は「コードレビュー層がすり抜けた」を意味する; `検知すべき工程 = unit-test` の場合はユニットテストの欠落 / 不十分なアサート). The 要因分類 taxonomy (R3) shall NOT carry verification-layer labels such as `review-miss` or `test-gap`; those concepts are expressed by this gap.
   - 和訳: `検知した工程` と `検知すべき工程` のギャップは「すり抜けた検証層」と解釈する (例: `検知した工程 = user-report` かつ `検知すべき工程 = code-review` は「コードレビュー層がすり抜けた」を意味する。`検知すべき工程 = unit-test` の場合はユニットテストの欠落または不十分なアサートを示す)。要因分類タクソノミー (R3) には `review-miss` や `test-gap` のような検証層ラベルを置かず、これらの概念は本ギャップで表現する。

#### Label Definitions

順序は V モデルの検証層を下流 (実装側) から上流 (利用側) へ。`検知した工程` と `検知すべき工程` の差が大きいほど (上流で気付けたのに下流まで漏れた)、再発防止の影響範囲が広い。原則として、**実装ミスは `unit-test`・設計ミスは `integration-test`・要件ミスは `e2e`** で検知すべき。

| Label | 定義 (検証層の責務) | 主に検知すべき成果物の誤り | 該当例 |
|---|---|---|---|
| `code-review` | PR コードレビュー (人間による静的検証)。コード差分の妥当性・命名・定数値・分岐網羅・暗黙の前提・hard-coded constants の検知層。 | 自動テストで意図を表現しにくい意匠的事項 (命名・hardcoded constant・コメント) | `value="±0.0 MD"` のハードコードは code-review で指摘可能 |
| `unit-test` | 関数・モジュール単体テスト (Vitest 等)。純粋関数の入出力契約・境界例・例外パスを保証する層。 | **実装ミス** (`impl-error`) | `fmtMD(70) === '70.0 MD'` のアサートで `fmtMD` の単位スケール混入を検知 |
| `integration-test` | 複数モジュール統合テスト。単体では通るが結合で壊れる挙動・コンポーネント境界の契約検証・サーバ + DB / クライアント + tRPC の連携検証。 | **設計ミス** (`design-error`) / 環境境界の不整合 (`env-config` の一部) | seed → server runtime の DB パス整合は integration-test で検知可能 |
| `e2e` | ブラウザ / アプリ全体を通したエンドツーエンドテスト (Playwright 等)。ユーザー操作経路を再現して初めて出る欠陥・要件レベルの不変則 (受入テスト相当)。 | **要件ミス** (`requirements-error`) / 表示と API の整合性 | 全体 EVM が "0.0 MD" と表示される要件違反は e2e で検知すべき |
| `manual-verification` | リリース前の手動回帰確認・スモークテスト・QA 目視・ステークホルダーデモ。自動化されていないがリリースゲートとして実施する検証層。 | 視覚的・体感的・ドメイン感性的な検証 | レイアウト崩れ・タイポ・色味 |
| `production` | 本番運用中の検知 (デプロイ後・実利用中)。ユーザー報告含まず、運用監視・ログ・アラート・メトリクスから検知。 | 性能劣化・想定外データパス・低頻度エッジケース | エラーレート急上昇でアラート発火 |
| `user-report` | ユーザーから報告されて初めて発覚。すべての内製検証ゲートを通過してしまった最後の砦。 | (検知層としてはすべての層をすり抜けた状態) | 今回の "プロジェクト全体 EVM が 0 と表示される" の最初の指摘 |

### Requirement 5: `/kiro-postmortem-add` の振る舞い

**Objective**: 不具合発生時に、漏れなく・素早く 10 項目を記録したい。

#### Acceptance Criteria

1. When the user invokes `/kiro-postmortem-add`, the skill shall propose draft values for all 10 mandatory fields based on the current conversation context, recent `git diff`, touched file paths, and any related spec / steering excerpts it can infer; the proposed `発生機能` value shall be inferred from the touched file paths against the 発生機能 taxonomy.
   - 和訳: ユーザーが `/kiro-postmortem-add` を起動したとき、本 skill は現在の会話文脈、最近の `git diff`、変更されたファイルパス、推測可能な関連 spec / steering 抜粋に基づいて、10 項目の必須フィールドのドラフト値を提案する。`発生機能` の提案値は、変更されたファイルパスを発生機能タクソノミーと照合して推論する。
2. The skill shall present each proposed field value to the user for confirmation or correction before appending to the ledger.
   - 和訳: 本 skill は、提案した各フィールド値を ledger 追記前にユーザーへ提示し、確認または修正を求める。
3. When the user confirms the final entry, the skill shall append the entry to the end of `.kiro/postmortem/defects.md` with the entry ID, `created_at` timestamp, title, and the 10 fields.
   - 和訳: ユーザーが最終エントリを確認したとき、本 skill はエントリ ID・`created_at` タイムスタンプ・title・10 項目を含む形で `.kiro/postmortem/defects.md` の末尾にエントリを追記する。
4. While appending, the skill shall preserve the existing ledger content byte-for-byte before the new entry (no reordering, no reformatting of past entries, no rewriting of the header except for taxonomy extensions made in the same operation).
   - 和訳: 追記中、本 skill は新規エントリより前の既存 ledger 内容をバイト単位で保存する (過去エントリの並び替え・再フォーマット禁止、ヘッダの書き換えは同一操作で行うタクソノミー拡張を除き禁止)。
5. If the user rejects the draft midway, the skill shall NOT write any partial entry to the ledger.
   - 和訳: ユーザーがドラフトを途中で却下した場合、本 skill は部分的なエントリを ledger に一切書き込まない。
6. If `/kiro-postmortem-add` is invoked while another in-progress entry draft exists (e.g., from a previous interrupted invocation), the skill shall surface the prior draft and ask the user whether to discard or finalize it before starting a new one.
   - 和訳: 別の作業中ドラフトが存在する状態で `/kiro-postmortem-add` が起動された場合 (例: 前回の中断起動由来)、本 skill は先のドラフトを提示し、新規ドラフト開始前に破棄または確定を選ぶようユーザーに求める。

### Requirement 6: `/kiro-postmortem-review` の振る舞い

**Objective**: 蓄積された ledger から横展開可能な学習を抽出し、Try を steering 化候補として提示したい。

#### Acceptance Criteria

1. When the user invokes `/kiro-postmortem-review`, the skill shall read all valid entries in `.kiro/postmortem/defects.md` and produce a structured report containing: (a) total entry count, (b) frequency table of `要因分類`, `根本要因分類`, and `発生機能`, (c) clusters of entries that share the same `根本要因分類`, (d) clusters of entries that share the same `発生機能`, (e) entries that cross-reference each other via `同件調査`.
   - 和訳: ユーザーが `/kiro-postmortem-review` を起動したとき、本 skill は `.kiro/postmortem/defects.md` の全有効エントリを読み込み、(a) 総エントリ数、(b) `要因分類`・`根本要因分類`・`発生機能` の頻度表、(c) 同一 `根本要因分類` を共有するエントリのクラスタ、(d) 同一 `発生機能` を共有するエントリのクラスタ、(e) `同件調査` で相互参照されるエントリ、を含む構造化レポートを生成する。
2. The skill shall extract Try 候補 by surfacing the `次回からの対応策` of the most frequent and most recent `根本要因分類` clusters.
   - 和訳: 本 skill は、最頻かつ最近の `根本要因分類` クラスタの `次回からの対応策` を抽出し、Try 候補として提示する。
3. Each Try 候補 presented to the user shall list the source entry IDs that motivate it, so the linkage is verifiable before steering 化.
   - 和訳: ユーザーへ提示する各 Try 候補には、その根拠となるソースエントリ ID を併記し、steering 化前に紐付けが検証可能であるようにする。
4. When the user approves one or more Try 候補, the skill shall hand them as input to `/kiro-steering-custom` (existing) and rely on that skill to perform the actual `.kiro/steering/*.md` write.
   - 和訳: ユーザーが 1 件以上の Try 候補を承認したとき、本 skill はそれらを既存 `/kiro-steering-custom` への入力として渡し、`.kiro/steering/*.md` への実際の書き込みは同 skill に委ねる。
5. The skill shall NOT delete or modify any ledger entry as a side-effect of review.
   - 和訳: 本 skill はレビューの副作用として ledger エントリを削除・変更してはならない。
6. The skill shall NOT write directly to any file under `.kiro/steering/`; only `/kiro-steering-custom` is allowed to perform that write.
   - 和訳: 本 skill は `.kiro/steering/` 配下のいかなるファイルへも直接書き込みを行わず、当該書き込みは `/kiro-steering-custom` のみに許される。

### Requirement 7: Try → steering 反映の経路と back-reference

**Objective**: 抽出された学習を恒常的な AI 振る舞いに変えるとともに、ledger からの来歴を辿れるようにしたい。

#### Acceptance Criteria

1. The defect-pdca system shall use `/kiro-steering-custom` as the sole pathway to write Try outcomes into `.kiro/steering/*.md`.
   - 和訳: defect-pdca システムは、Try の成果を `.kiro/steering/*.md` に書き込む唯一の経路として `/kiro-steering-custom` を使用する。
2. After `/kiro-steering-custom` successfully writes a Try, the `/kiro-postmortem-review` skill shall record a back-reference in `.kiro/postmortem/defects.md` under a dedicated `## Steering 反映ログ` section, listing (entry IDs that motivated the Try, target steering file path, Try summary, timestamp).
   - 和訳: `/kiro-steering-custom` が Try の書き込みに成功した後、`/kiro-postmortem-review` skill は `.kiro/postmortem/defects.md` 内の専用 `## Steering 反映ログ` セクションに、(Try の根拠となったエントリ ID、対象 steering ファイルパス、Try の要約、タイムスタンプ) を列挙する back-reference を記録する。
3. If `/kiro-steering-custom` fails or the user rejects the proposed steering write mid-flow, the ledger entries shall remain intact and the Try shall be re-presentable in a later `/kiro-postmortem-review` invocation.
   - 和訳: `/kiro-steering-custom` が失敗するか、ユーザーが steering 書き込みの提案を途中で却下した場合、ledger エントリは保持され、Try は後続の `/kiro-postmortem-review` 起動で再提示可能とする。
4. The back-reference section shall be append-only by `/kiro-postmortem-review`; entries in `## Steering 反映ログ` shall not be edited or deleted as a side-effect of the skill.
   - 和訳: back-reference セクションは `/kiro-postmortem-review` により append-only で扱われ、`## Steering 反映ログ` のエントリは本 skill の副作用として編集・削除されない。

### Requirement 8: 初期 seed entry

**Objective**: 運用開始時点で ledger を空ではなく実例から学べる状態にしたい。

#### Acceptance Criteria

1. The defect-pdca system shall include 3 initial seed entries derived from the current session's findings: (a) `fmtMD` 単位スケール混入 (`(n / 1_000_000)` を「自明な変換だからテスト省略」と判断したことに起因), (b) `seed.ts` と server runtime の DB パス分裂 + `sqlite_sequence` 累積による re-seed 失敗, (c) Playwright `text=` セレクター + `first()` の脆弱性による e2e の意図せぬ衝突.
   - 和訳: defect-pdca システムは、今セッションの発見事項に由来する初期 seed エントリを 3 件含む: (a) `fmtMD` 単位スケール混入 (`(n / 1_000_000)` を「自明な変換だからテスト省略」と判断したことに起因)、(b) `seed.ts` と server runtime の DB パス分裂 + `sqlite_sequence` 累積による re-seed 失敗、(c) Playwright `text=` セレクター + `first()` の脆弱性による e2e の意図せぬ衝突。
2. Each seed entry shall conform to the 10-item schema and reference labels from the taxonomies defined in Requirements 3, 4, 13, and 14. Minimum required mapping per seed entry: (a) `fmtMD` 単位スケール混入 — 要因分類 `impl-error`, 検知すべき工程 `unit-test`, 検知した工程 `user-report`, 根本要因分類 `assumption-error`, 発生機能 `dashboard / formatters`; (b) seed DB パス分裂 + sqlite_sequence 累積 — 要因分類 `env-config`, 検知すべき工程 `integration-test`, 検知した工程 `e2e`, 根本要因分類 `context-loss`, 発生機能 `core-data-model / seed`; (c) Playwright `text=` セレクター脆弱性 — 要因分類 `tooling-fragility`, 検知すべき工程 `e2e`, 検知した工程 `e2e`, 根本要因分類 `tooling-trap`, 発生機能 `e2e / workbench`.
   - 和訳: 各 seed エントリは 10 項目スキーマに準拠し、Requirements 3・4・13・14 で定義したタクソノミーのラベルを参照する。seed エントリごとの最小マッピング: (a) `fmtMD` 単位スケール混入 — 要因分類 `impl-error`、検知すべき工程 `unit-test`、検知した工程 `user-report`、根本要因分類 `assumption-error`、発生機能 `dashboard / formatters`。(b) seed DB パス分裂 + sqlite_sequence 累積 — 要因分類 `env-config`、検知すべき工程 `integration-test`、検知した工程 `e2e`、根本要因分類 `context-loss`、発生機能 `core-data-model / seed`。(c) Playwright `text=` セレクター脆弱性 — 要因分類 `tooling-fragility`、検知すべき工程 `e2e`、検知した工程 `e2e`、根本要因分類 `tooling-trap`、発生機能 `e2e / workbench`。
3. Seed entries shall be committed alongside the ledger initial creation, so that `/kiro-postmortem-review` produces meaningful frequency analysis from day 1.
   - 和訳: seed エントリは ledger の初回作成と同時にコミットし、`/kiro-postmortem-review` が運用初日から意味のある頻度分析を生成できるようにする。
4. Each seed entry shall be marked with a metadata flag `source: retrospective-seed` to distinguish them from organically-recorded entries in future review sessions.
   - 和訳: 各 seed エントリにはメタデータフラグ `source: retrospective-seed` を付与し、将来のレビューで通常記録されたエントリと区別できるようにする。

### Requirement 9: PDCA 運用ガイドラインの ledger 内文書化

**Objective**: 誰でも PDCA を回せるよう、起動タイミングと役割分担を ledger 自身に書き込んでおきたい。

#### Acceptance Criteria

1. The ledger header shall document the PDCA cycle as: **Plan** = `/kiro-postmortem-add` を不具合発覚直後に起動, **Do** = 10 項目を対話補完して ledger に append, **Check** = 任意タイミング (少なくとも feature spec 完了時) に `/kiro-postmortem-review`, **Act** = 提示された Try を `/kiro-steering-custom` 経由で steering 化.
   - 和訳: ledger ヘッダは PDCA サイクルを次の通り文書化する: **Plan** = `/kiro-postmortem-add` を不具合発覚直後に起動、**Do** = 10 項目を対話補完して ledger に append、**Check** = 任意タイミング (少なくとも feature spec 完了時) に `/kiro-postmortem-review`、**Act** = 提示された Try を `/kiro-steering-custom` 経由で steering 化。
2. The ledger header shall state that `/kiro-postmortem-add` is normally invoked by either the AI assistant (proactively when a defect is identified and its root cause clarified) or the user (on demand).
   - 和訳: ledger ヘッダは、`/kiro-postmortem-add` が通常、AI アシスタント (不具合を特定し根本原因が明確になった時点で能動的に起動) またはユーザー (オンデマンド) のいずれかによって起動されることを明記する。
3. The ledger header shall state that `/kiro-postmortem-review` is invoked **by the user as the primary actor**, with the AI assistant acting as the proposer that surfaces opportunities. The AI shall NOT invoke `/kiro-postmortem-review` without user confirmation.
   - 和訳: ledger ヘッダは、`/kiro-postmortem-review` の起動は**ユーザーが主体**で行い、AI アシスタントは起動機会を提示する提案者に徹することを明記する。AI はユーザー確認なしに `/kiro-postmortem-review` を起動しない。
4. The ledger header shall include a quick-reference example entry (one of the 3 seed entries) showing the 10-field structure in the agreed Markdown format.
   - 和訳: ledger ヘッダは、合意した Markdown 形式で 10 項目構造を示すクイックリファレンス例 (3 件の seed エントリのうち 1 件) を含める。
5. The ledger header shall enumerate the recommended trigger conditions for `/kiro-postmortem-review`, including at least the following four events: (a) `/kiro-impl <feature>` 完了直後 (該当 spec の tasks がすべて `[x]` になった時点), (b) 未レビューエントリ内で同じ `根本要因分類` ラベルまたは同じ `要因分類` ラベルが 2 件以上に達した時点, (c) `/kiro-spec-init <新 spec>` で新規 spec を開始する直前 (過去の Try を steering に反映してから新規 spec の要件作成に入るため), (d) ユーザーが明示的に振り返りを要求した時点.
   - 和訳: ledger ヘッダは `/kiro-postmortem-review` の推奨起動トリガー条件を、少なくとも以下 4 イベントを含めて列挙する: (a) `/kiro-impl <feature>` 完了直後 (該当 spec の tasks がすべて `[x]` になった時点)、(b) 未レビューエントリ内で同じ `根本要因分類` ラベルまたは同じ `要因分類` ラベルが 2 件以上に達した時点、(c) `/kiro-spec-init <新 spec>` で新規 spec を開始する直前 (過去の Try を steering に反映してから新規 spec の要件作成に入るため)、(d) ユーザーが明示的に振り返りを要求した時点。
6. When the AI assistant detects that any trigger condition in R9.5(a)-(c) is satisfied during a session, the AI shall surface a one-line proposal to the user (例: `/kiro-postmortem-review を起動しますか？ 未レビュー X 件・該当トリガー: spec 完了`). The user shall hold the final authority to run, defer, or skip the review.
   - 和訳: AI アシスタントがセッション中に R9.5(a)-(c) のトリガー条件のいずれかを検出したとき、AI はユーザーへ 1 行の提案を提示する (例: `/kiro-postmortem-review を起動しますか？ 未レビュー X 件・該当トリガー: spec 完了`)。実行・延期・スキップの最終判断はユーザーが持つ。
7. The ledger header shall explicitly state that R9.5(d) `ユーザー明示要求` is acceptable at any time without other trigger conditions being met, so that the user retains the freedom to review whenever they want.
   - 和訳: ledger ヘッダは、R9.5(d) の「ユーザー明示要求」が他のトリガー条件成立の有無に関わらず常に許容されることを明記し、ユーザーが任意のタイミングでレビューを実施できる自由を保つ。

### Requirement 10: データ整合性とエラー処理

**Objective**: ledger と PDCA フローが事故で壊れない / 矛盾しないことを保証したい。

#### Acceptance Criteria

1. If `.kiro/postmortem/defects.md` contains a malformed entry (例: 必須 10 項目のいずれかが欠落), `/kiro-postmortem-review` shall report the malformed entry ID and skip it from frequency analysis while continuing with other valid entries.
   - 和訳: `.kiro/postmortem/defects.md` に不正なエントリが含まれる場合 (例: 必須 10 項目のいずれかが欠落)、`/kiro-postmortem-review` は当該エントリ ID を報告し、頻度分析から除外しつつ他の有効なエントリの処理は継続する。
2. If concurrent invocations of `/kiro-postmortem-add` would result in conflicting writes to the ledger, the skill shall detect the conflict via file modification timestamp comparison and ask the user to resolve before re-appending.
   - 和訳: `/kiro-postmortem-add` の同時起動が ledger への競合書き込みを引き起こす場合、本 skill はファイル更新タイムスタンプの比較で競合を検知し、再追記前にユーザーへ解決を求める。
3. The defect-pdca system shall not depend on external services (DB / HTTP API) for ledger storage; the entire PDCA cycle shall operate on local files.
   - 和訳: defect-pdca システムは ledger の保存に外部サービス (DB / HTTP API) を依存させず、PDCA サイクル全体をローカルファイル上で動作させる。
4. All ledger reads and writes shall use UTF-8 encoding and shall preserve Japanese text (Hiragana / Katakana / Kanji) without normalization.
   - 和訳: ledger の読み書きはすべて UTF-8 エンコーディングを使用し、日本語テキスト (ひらがな / カタカナ / 漢字) を正規化せずに保持する。
5. If `/kiro-postmortem-add` or `/kiro-postmortem-review` cannot read `.kiro/postmortem/defects.md` due to filesystem errors, the skill shall surface the error and shall NOT proceed with a write that could corrupt the file.
   - 和訳: `/kiro-postmortem-add` または `/kiro-postmortem-review` がファイルシステムエラーで `.kiro/postmortem/defects.md` を読めない場合、本 skill はエラーを表面化し、ファイルを破損させ得る書き込みを実行しない。

### Requirement 11: 既存資産との独立性

**Objective**: 既存の機能 spec や skill を壊さずに新規プロセスを導入したい。

#### Acceptance Criteria

1. The defect-pdca system shall NOT modify any file under `.kiro/specs/` for the 4 existing feature specs (`core-data-model` / `evm-engine` / `progress-tracking` / `dashboard`).
   - 和訳: defect-pdca システムは、既存の 4 機能 spec (`core-data-model` / `evm-engine` / `progress-tracking` / `dashboard`) について `.kiro/specs/` 配下のいかなるファイルも変更しない。
2. The defect-pdca system shall NOT modify the signature or behavior of existing skills under `.claude/skills/` other than the 2 new skills it introduces (`kiro-postmortem-add`, `kiro-postmortem-review`).
   - 和訳: defect-pdca システムは、本スペックで導入する 2 つの新 skill (`kiro-postmortem-add`, `kiro-postmortem-review`) 以外の `.claude/skills/` 配下既存 skill の signature や振る舞いを変更しない。
3. The defect-pdca system shall NOT modify `.claude/settings.json` to add hooks; full automation via Stop / PostToolUse hook is explicitly Out of Boundary for this spec.
   - 和訳: defect-pdca システムは hook 追加のために `.claude/settings.json` を変更しない。Stop / PostToolUse hook による完全自動化は本スペックの Out of Boundary と明示する。
4. The defect-pdca system shall NOT synchronize the ledger with external issue trackers (GitHub Issues / Backlog / Linear); external integration is Out of Boundary.
   - 和訳: defect-pdca システムは外部 issue tracker (GitHub Issues / Backlog / Linear) と ledger を同期しない。外部連携は Out of Boundary とする。
5. The 2 new skills introduced by this spec shall follow the existing `.claude/skills/kiro-*/SKILL.md` convention (frontmatter + Role + Core Mission + Execution Steps + Critical Constraints + Output Description sections) to remain consistent with the existing kiro-* skill family.
   - 和訳: 本スペックで導入する 2 つの新 skill は既存 `.claude/skills/kiro-*/SKILL.md` 規約 (frontmatter + Role + Core Mission + Execution Steps + Critical Constraints + Output Description セクション) に従い、既存 kiro-* skill 群との一貫性を保つ。

### Requirement 12: ユーザー観測可能な PDCA 経過の可視性

**Objective**: 利用者として、どの entry がどの Try に昇格し、どの steering に反映されたかを ledger を見るだけで追えるようにしたい。

#### Acceptance Criteria

1. The ledger shall maintain three observable states for each entry: (a) `recorded` (記録済み・未レビュー), (b) `reviewed` (レビュー済み・Try 抽出済みまたは不要判定済み), (c) `steered` (Try が `/kiro-steering-custom` 経由で steering 反映済み).
   - 和訳: ledger は各エントリについて 3 つの観測可能な状態を保持する: (a) `recorded` (記録済み・未レビュー)、(b) `reviewed` (レビュー済み・Try 抽出済みまたは不要判定済み)、(c) `steered` (Try が `/kiro-steering-custom` 経由で steering 反映済み)。
2. The state of each entry shall be visible by reading the ledger (例: 各エントリの H3 タイトル直下に `status:` 行) and shall be updated by `/kiro-postmortem-review` when a Try is approved and successfully steered.
   - 和訳: 各エントリの状態は ledger を読むことで可視 (例: 各エントリの H3 タイトル直下に `status:` 行) であり、`/kiro-postmortem-review` は Try が承認され steering 反映に成功した時点でこれを更新する。
3. The `## Steering 反映ログ` section shall list every steering reflection event in chronological order with timestamps, so that PDCA の完了履歴が ledger 単独で追跡できる.
   - 和訳: `## Steering 反映ログ` セクションは、すべての steering 反映イベントを時系列順にタイムスタンプ付きで列挙し、PDCA の完了履歴を ledger 単独で追跡可能にする。
4. If a steering reflection later proves wrong (要件として誤りだった等) and is rolled back via separate manual steering 編集, the user may add a `## Steering 反映ログ` rollback note manually. The `/kiro-postmortem-*` skills shall not auto-detect such rollbacks (this is Out of Boundary).
   - 和訳: ある steering 反映が後に誤りと判明し (要件として誤りだった等)、別途の手動 steering 編集で巻き戻された場合、ユーザーは `## Steering 反映ログ` に手動で rollback note を追記してよい。`/kiro-postmortem-*` skill 群はそのような rollback を自動検知しない (これは Out of Boundary)。

### Requirement 13: 発生機能タクソノミー

**Objective**: 「どの機能で発生した不具合か」を機械可読に分類し、機能別の累積不具合を把握したい。

#### Acceptance Criteria

1. The defect-pdca system shall define a fixed taxonomy of 発生機能 labels covering the existing feature specs and cross-cutting layers, including at least: `core-data-model` / `evm-engine` / `progress-tracking` / `dashboard` / `defect-pdca` / `seed` / `e2e` / `formatters` / `tooling` / `other`.
   - 和訳: defect-pdca システムは、既存機能 spec と横断レイヤを網羅する発生機能ラベルの固定タクソノミーを定義し、少なくとも `core-data-model` / `evm-engine` / `progress-tracking` / `dashboard` / `defect-pdca` / `seed` / `e2e` / `formatters` / `tooling` / `other` を含める。
2. Each entry's `発生機能` field shall reference exactly one label from the defined taxonomy, optionally followed by a free-text sub-scope separator (例: `dashboard / SummaryStrip`, `core-data-model / seed`).
   - 和訳: 各エントリの `発生機能` フィールドは、定義されたタクソノミーから 1 ラベルを参照し、任意で自由テキストの sub-scope を区切って追記してよい (例: `dashboard / SummaryStrip`, `core-data-model / seed`)。
3. The ledger header shall document the 発生機能 taxonomy alongside 要因分類 / 検知工程 taxonomies, with each label's meaning briefly described.
   - 和訳: ledger ヘッダは、発生機能タクソノミーを要因分類・検知工程の各タクソノミーと並べて文書化し、各ラベルの意味を簡潔に記述する。
4. When the user attempts to record a 発生機能 label outside the taxonomy, the `/kiro-postmortem-add` skill shall surface the existing taxonomy as suggestions and require the user to either pick an existing label or explicitly extend the taxonomy in the ledger header (in the same operation).
   - 和訳: ユーザーがタクソノミー外の発生機能ラベルを記録しようとした場合、`/kiro-postmortem-add` skill は既存タクソノミーを候補として提示し、既存ラベルを選択するか同一操作の中で ledger ヘッダのタクソノミーを明示的に拡張するかをユーザーに求める。
5. When a new feature spec is added to `.kiro/specs/`, the 発生機能 taxonomy shall be extended (manually by the user or by the AI as a same-operation amendment under R13.4) to include the new spec's name as a label. This requirement is observed at the next `/kiro-postmortem-add` invocation that touches the new spec, not as a forced automatic update.
   - 和訳: 新機能 spec が `.kiro/specs/` に追加されたとき、発生機能タクソノミーは新 spec 名を含むように拡張される (ユーザー手動または R13.4 に基づく AI による同一操作内の追補)。本要件は新 spec に関連する次回の `/kiro-postmortem-add` 起動時に観測されるものであり、強制的な自動更新ではない。

#### Label Definitions

機能 spec 名と一致するラベルは spec の責務境界をそのまま継承する。横断レイヤ (`seed` / `e2e` / `formatters` / `tooling`) は単一 spec に閉じない共通基盤。

| Label | 定義 (どこで発生したか) | 該当例 |
|---|---|---|
| `core-data-model` | `.kiro/specs/core-data-model/` 配下が責務。SQLite スキーマ・WBS YAML インポート・seed の対象範囲。 | seed.ts の DB パス分裂 |
| `evm-engine` | `.kiro/specs/evm-engine/` 配下。EVM 計算純粋関数・tRPC `evm.calculate` ルーター・前日比差分計算。 | (今セッションでは該当なし) |
| `progress-tracking` | `.kiro/specs/progress-tracking/` 配下。日次進捗スナップショット・`progress.*` API・`ProgressInputPanel`。 | (今セッションでは該当なし) |
| `dashboard` | `.kiro/specs/dashboard/` 配下。`WorkbenchPage` 単一ページ・shell / summary / gantt / charts / inspector / atoms コンポーネント群・モーダル系・トークン。 | `fmtMD` 単位スケール混入、Inspector の `±0.0 MD` ハードコード |
| `defect-pdca` | `.kiro/specs/defect-pdca/` 配下。本スペック自身に起因する不具合。 | (該当時に記録) |
| `seed` | DB シード関連 (`server/seeds/`)。タクソノミーとして spec 縦割りでなく seed 自体を横断レイヤとして扱う。 | seed.ts の `sqlite_sequence` 累積 |
| `e2e` | エンドツーエンドテスト (`evm-studio/e2e/`)。Playwright のテストファイル・config・fixtures。 | Playwright `text=` セレクター脆弱性 |
| `formatters` | 表示フォーマッタ純関数 (`client/src/lib/formatters.ts` 等)。dashboard 内のサブモジュールだが、単位契約が独立に重要なので個別ラベル。 | `fmtMD` 単位スケール (細粒度) |
| `tooling` | 開発ツールチェーン (Vite / Vitest / Playwright / tsx / Node version / TypeScript config 等)。プロジェクトコード自体ではなくビルド・テスト基盤の不具合。 | Node v21 と Vitest 4.x の非互換 |
| `other` | 上記いずれにも該当しないか、未定義の新領域。 | (該当時に記録) |

サブスコープは `dashboard / SummaryStrip`, `core-data-model / seed`, `e2e / workbench.spec.ts` のように `/` 区切りで自由記述してよい (R13.2)。

### Requirement 14: 根本要因分類タクソノミー

**Objective**: 「なぜそのミスが起きたか」のメカニズムを Why 軸として独立にクラスタリングし、AI と人間の協働で繰り返されやすい失敗パターンを学習資産化したい。

#### Acceptance Criteria

1. The defect-pdca system shall define a fixed taxonomy of 根本要因分類 labels focusing on the Why dimension (mechanism of failure), including at least: `assumption-error` / `knowledge-gap` / `context-loss` / `verification-gap` / `pattern-misapplication` / `spec-impl-mismatch` / `tooling-trap` / `state-management-gap` / `boundary-violation` / `process-skip` / `other`.
   - 和訳: defect-pdca システムは、失敗メカニズム (Why 軸) に焦点を当てた根本要因分類ラベルの固定タクソノミーを定義し、少なくとも `assumption-error` / `knowledge-gap` / `context-loss` / `verification-gap` / `pattern-misapplication` / `spec-impl-mismatch` / `tooling-trap` / `state-management-gap` / `boundary-violation` / `process-skip` / `other` を含める。
2. Each entry's `根本要因分類` field shall reference exactly one label from the defined taxonomy.
   - 和訳: 各エントリの `根本要因分類` フィールドは、定義されたタクソノミーから 1 ラベルを参照する。
3. The ledger header shall document the 根本要因分類 taxonomy with each label's meaning briefly described, distinguishing it from 要因分類 (the What axis defined in Requirement 3).
   - 和訳: ledger ヘッダは、根本要因分類タクソノミーを各ラベルの意味とともに簡潔に文書化し、Requirement 3 で定義する要因分類 (What 軸) との違いを明示する。
4. The 要因分類 (R3) and 根本要因分類 (this requirement) shall be treated as orthogonal axes: each entry independently references one label from each taxonomy, and any combination of (要因分類 label × 根本要因分類 label) shall be considered valid.
   - 和訳: 要因分類 (R3) と根本要因分類 (本要件) は直交する軸として扱い、各エントリは双方のタクソノミーから独立に 1 ラベルずつ参照する。(要因分類ラベル × 根本要因分類ラベル) のいかなる組み合わせも有効とみなす。
5. When the user attempts to record a 根本要因分類 label outside the taxonomy, the `/kiro-postmortem-add` skill shall surface the existing taxonomy as suggestions and require the user to either pick an existing label or explicitly extend the taxonomy in the ledger header (in the same operation).
   - 和訳: ユーザーがタクソノミー外の根本要因分類ラベルを記録しようとした場合、`/kiro-postmortem-add` skill は既存タクソノミーを候補として提示し、既存ラベルを選択するか同一操作の中で ledger ヘッダのタクソノミーを明示的に拡張するかをユーザーに求める。
6. The ledger header shall include a quick mapping table showing example (要因分類 × 根本要因分類) pairs derived from the 3 seed entries, to clarify the orthogonal usage to future contributors.
   - 和訳: ledger ヘッダは、3 件の seed エントリから導出した (要因分類 × 根本要因分類) ペアの例示マッピング表を含め、両軸が直交的に使われることを将来の貢献者に示す。

#### Label Definitions

Why 軸 (なぜそのミスが起きたか) のメカニズム別カテゴリ。要因分類 (What) と組み合わせて記述する。

| Label | 定義 (発生メカニズム) | 該当例 |
|---|---|---|
| `assumption-error` | 「自明」「不要」「変わらない」などの前提誤認・暗黙仮定が外れた結果。検証せず判断を省略した。 | `fmtMD` のテストを「自明な変換」として省略した |
| `knowledge-gap` | 仕様 / ライブラリ / フレームワーク / ドメインへの理解不足が直接の原因。学べば防げる。 | better-sqlite3 transaction 内の `sqlite_sequence` の DML が反映されないという仕様を知らなかった |
| `context-loss` | 周辺情報・過去の決定・関連箇所を見落とした (知ろうとすれば知れたが、視野に入れなかった)。 | seed.ts の DB パスと server runtime のパスが別ファイルを見ている事実を見落としていた |
| `verification-gap` | そもそも検証手段 (テスト / 自動チェック / レビュー観点) を整備していなかった結果、ミスが通過した。 | UI 表示値が API 値と一致するかをアサートする e2e がなかった |
| `pattern-misapplication` | 別ドメイン / 別文脈で正しいパターンを、現文脈に誤って流用した。 | バイト→MB のような 1_000_000 スケール変換を Man-Day 単位に当てはめた |
| `spec-impl-mismatch` | 仕様文と実装意図がズレている (仕様も実装も独立には妥当だが、互いを参照したときに食い違う)。 | 要件文に実装詳細を埋め込んで仕様と実装が二重管理になった |
| `tooling-trap` | ツール / ライブラリの既知の落とし穴・直感に反する仕様にハマる。ドキュメントを読めば防げるが直感では避けにくい。 | Playwright `text=` セレクターが case-insensitive substring match である |
| `state-management-gap` | テスト間 / セッション間 / 環境間で状態が残存・変動するパターンを設計時に想定していなかった。 | e2e フルランで前テストの保存値が次テストの初期条件を変える |
| `boundary-violation` | spec / モジュール / レイヤの責務境界を越えた変更を行った結果、別領域に副作用が出る。 | (該当時に記録) |
| `process-skip` | 必要なレビュー / テスト / 検証 / 段階確認の工程を省略した判断 (時間制約 / 楽観バイアス)。 | 9.5 後の data-testid 変更で全 e2e を流さず PR を進めた |
| `other` | 上記いずれにも明確に分類できないメカニズム。 | (該当時に記録) |
