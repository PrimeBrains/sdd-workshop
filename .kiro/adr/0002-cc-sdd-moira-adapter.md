---
id: 2
title: cc-sdd → Moira アダプタを moira CLI に統合配布し、決定的発火検知＋read-only 突き合わせで固める
status: accepted
date: 2026-07-02
app: moira
specs: [moira-ingestion-adapter]
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0002: cc-sdd → Moira アダプタを moira CLI に統合配布し、決定的発火検知＋read-only 突き合わせで固める

## Context

playground（`moira/examples/todo-playground`）の `moira-track` スキル＋`moira-guard.mjs` hook＋
CLAUDE.md 発火トリガー表は、cc-sdd → Moira ブリッジ（`moira-progress` 継ぎ目）が成立することを実証した
（[ADR-0001](0001-moira-cli-write-path.md)）。しかし任意の cc-sdd プロジェクトへ適用するには 3 つの弱点があった:

1. **配布手段がない** — アダプタ実体が playground への手置きコピーで、設置・更新・検査の仕組みがない。
2. **発火が LLM の規律頼み** — 「節目で `/moira-track <phase>` を打つ」はトリガー表の規約のみで、
   demo-log.take1 が示す通り発火ミスが再発した。柵（hook）もヒューリスティックなテキスト照合。
3. **リコンシリエーション不在** — 発火をミスすると `.kiro/specs`（spec.json の phase/approvals・tasks.md）と
   `.moira/events.json` が乖離したまま、検知も追いつきもできない。

隣接 spec `moira-ingestion-adapter`（spec 文書 → ノード候補/見積提案の read-only 正規化）とは責務が異なる
（本 ADR はライフサイクル節目のトラッキング）が、その確定原則 **方法論非依存 = cc-sdd 語彙は内部マッピング
（provider）に閉じる** を共有する。

## Decision

**`moira` CLI に `adapter` サブコマンド群を統合し、テンプレート同梱・決定的発火検知・read-only 突き合わせの
3 点でアダプタを製品化する**（ユーザー確認済み: 配布=CLI 統合／発火=決定的検知＋勧告／sync=CLI+skill 両輪／
プロセス=直接実装＋本 ADR）。

1. **配布**: `moira adapter install|status|uninstall`。設置物（`moira-track` SKILL.md/reference.md・
   `moira-guard.mjs`・`moira-fire.mjs`・`.kiro/steering/moira-track.md` 発火表）は CLI パッケージの
   `moira/cli/templates/` に同梱（npm link で配布・正本は単一）。インストールは冪等で、
   `.claude/.moira-adapter.json` manifest（バージョン＋LF 正規化 sha256）により改変検出・更新・外科的
   uninstall が可能。`.claude/settings.json` は**非破壊マージ**（コマンド文字列完全一致で重複採用・
   parse 失敗時は何も書かず中断・変更前に .bak）。発火表の置き場は CLAUDE.md ではなく **steering**
   （ユーザーの CLAUDE.md を変異させない。希望者のみ `--claude-md` でマーカー区切りポインタを追記）。
2. **発火 = 決定的検知＋勧告**: 新設 hook `moira-fire.mjs` が (a) PostToolUse（Edit|MultiEdit|Write|NotebookEdit）で
   `.kiro/specs/<f>/(spec.json|tasks.md)` への書き込みを検知し、内容から含意フェーズを算出して
   `/moira-track <phase>` の発火を additionalContext で勧告（ホットパスは fs 読みのみ・プロセス起動なし）、
   (b) SessionStart で `moira adapter drift --json` を 1 回実行（timeout・fail-open）し drift サマリを注入する。
   **emit は従来どおり skill が人間ゲート付きで振り付け**（5 人間判断は不変・hook は一切 write しない）。
   `moira-guard.mjs` の deny（`--parent` 無し add）と 3 助言は実質不変のまま一般化
   （root 動的化・`decide()` export でテスト可能化）。
3. **突き合わせ**: 新設 `moira adapter drift`（read-only・emit ゼロ = ADR-0001 の「CLI は emit プリミティブ」
   と両立）。**generic な drift core（Moira 語彙のみ・純関数）＋ cc-sdd provider** の構成で、
   spec.json の phase/approvals と tasks.md を期待ノード状態へ正規化し、`fold` した実状態と照合して
   behind/missing（hard）・ahead/checkbox（advisory）・**needs-human**（追いつきに人間判断①②が挟まる）を
   構造化 JSON で報告、追いつきコマンド列を提案する（見積・担当・slot・実測 AC は**プレースホルダのまま**
   ＝捏造しない。implementing 以上への assign は提案しない＝EV% 後退地雷の回避）。moira-track に `sync`
   フェーズを追加し、このレポートを入力に人間ゲート付きで追いつき emit を振り付ける。契約は
   reference.md §J に TS 実装と共有の単一表として固定。誤検知の逃し弁は `.moira/adapter.json` の
   `ignoreFeatures`/`ignoreNodes`。

playground は本アダプタの**最初のインストール先**となり、手置きコピーは `moira adapter install` の
adopt（backup→置換）で管理下の設置産物に移行した（テンプレートとバイト同一・出所は manifest が記録）。

## Consequences

- （+）アダプタ実体の**正本が 1 箇所**（`moira/cli/templates/`）になり、任意 cc-sdd リポジトリへ
  1 コマンドで設置・更新・検査・除去できる。playground との複製ドリフトが構造的に消える。
- （+）発火ミスが**二重に**塞がる: 編集検知（リアルタイム勧告）＋ drift（事後検知・セッション開始時注入）。
  最悪ミスしても sync で追いつける＝規約が唯一の防衛線ではなくなる。
- （+）突き合わせロジックが TypeScript の純関数（provider/core 分離）になり、vitest で網羅検証できる
  （スキル prose 頼みの検証不能ロジックを排除）。cc-sdd 語彙の閉じ込めにより第 2 の方法論は provider
  追加のみで対応可能。
- （+）5 人間判断・着手ゲート・AC 実測・`--parent` 必須・append-only は全経路（通常フェーズ/sync/hook）で不変。
- （−・受容）CLI パッケージが CLI 本体以外のペイロード（templates）を持つ。hooks が毎 Edit/Write に
  1 プロセス起動（node）を追加する（検知処理自体は fs 読みのみ・SessionStart のみ drift spawn）。
- （−・受容）guard はテキスト照合のヒューリスティックのまま（sandbox ではない）。drift はノード ID 規約
  （`<f>/req|design|tasks|impl-N|review-impl`）を契約とみなす — 規約外の運用は advisory ノイズになる
  （ignore リストで抑制）。
- （−・受容）hooks は POSIX 互換シェル前提の `node "$CLAUDE_PROJECT_DIR/…"` 形式（Windows は Git Bash 実行で
  実証済み）。SessionStart の drift 実行は `moira` がグローバルに link されていることが前提（無ければ fail-open）。
- （フォローアップ）SKILL.md/reference.md は doc-refine 確定済み正典の一般化改訂（root 動的化・
  `feature_name` 訂正・sync 節・§J 追加・GitHub 絶対リンク化）を含む — 変更行は playground の git diff で
  一覧でき、後続の doc-refine ゲートで再凍結する。

## Alternatives

- **独立インストーラパッケージ（moira/adapter/）** — 配布チャネルとバージョンが 2 本に割れ、npm link も
  2 回になる。CLI が既に per-repo 接点（`moira init`）を持つため統合が最小。棄却。
- **hook からの完全自動 emit** — 発火ミスはゼロになるが、実工数・見積・feature 特定などのコンテキストが
  hook に無く、5 人間判断（とくに `agree` の human 限定）と整合しない。二重 emit のリスクも高い。棄却。
- **skill プロンプトのみの sync（TS コアなし）** — 突き合わせの正確性が LLM 頼みでテスト不能。棄却。
- **発火表を CLAUDE.md へ直書き** — ユーザー文書の変異・マージ衝突・アンインストール不能。steering を
  既定とし、CLAUDE.md はオプトイン（`--claude-md`）のポインタのみ。採用済みの折衷。
- **moira 本体（fold/CLI）に段階順序の強制を実装** — MODEL 変更を伴い ADR-0001 の射程外。既知制約は
  reference §G の回避策で吸収（本体無改修）を維持。棄却（将来の `moira-model-update` 課題）。
