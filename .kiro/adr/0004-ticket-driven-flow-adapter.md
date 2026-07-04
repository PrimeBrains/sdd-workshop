---
id: 4
title: アダプタをチケット駆動フローに対応させる（UserPromptSubmit 検知＋ticket 入口）
status: accepted
date: 2026-07-05
app: moira
specs: []
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0004: アダプタをチケット駆動フローに対応させる（UserPromptSubmit 検知＋ticket 入口）

## Context

issue #20: 人間が任意のチケット管理（GitHub / GitLab / Backlog / Jira …）に issue を上げ、
その番号や URL を Claude Code に渡すところから作業が始まる「チケット駆動フロー」に
アダプタを対応させたい。プロジェクトに承認ゲート・パイプラインが規定されていればそれに従い、
無ければ plan→実行、場合によっては plan なしで直接実行する — **実行パターンが何であれ、
必要なタイミングで適切にイベントログを出して進捗を可視化する**ことが核心要求。

正典側の裏取り: MODEL（v20）は表題からして「仕様駆動・チケット駆動・EVM 統合モデル」であり、
**A1**（唯一の実体は spec とノード・チケットはその読み出し専用射影）と A1 射程注釈
（運用タスク・バグ修正・ad-hoc 作業も同じログ上の feature ノード。フェーズ子展開の省略は
分解の深さ＝人間判断④であり構造制約ではない）、**D-19**（外部チケットは読み取り専用の写し・
逆書き込みしない）が既にチケット駆動を正典化している。**エンジン（4 イベント・lifecycle・
EVM 導出）と MODEL は変更不要**。

ギャップは検知層と振り付け層の 2 点に限られていた:

1. **検知の穴**: `moira-fire.mjs` は PostToolUse（成果物ファイルへの書き込み）と
   SessionStart（drift 注入）しか持たず、「チケットを渡された」という節目 — ファイル書き込みを
   伴わない、プロンプト上の出来事 — を決定的に検知できない。
2. **振り付けの不在**: チケット起点の 3 実行パターン（既存パイプライン合流 / plan→実行 /
   直接実行）で「どの節目にどの CLI 動詞を打つか」の振り付け（§P2 相当）が未著。

ユーザー決定（issue #20 対応時）: フル実装（hook 検知＋振り付け＋ADR＋テスト）。
プロセスは ADR-0002/0003 の前例に倣い「直接実装＋ADR」（kiro spec は切らない）。

## Decision

### 1. 検知 = UserPromptSubmit hook（`moira-fire.mjs` に追加）

Claude Code の **UserPromptSubmit** イベント（matcher を持たない）で、プロンプト中の
チケット参照を決定的な正規表現で検知し、`/moira-track ticket <ref>` の発火を
additionalContext で**助言**する。ADR-0002 の原則は不変 — hook は検知と助言のみ・emit は
moira-track スキルの責務・5 判断の人間ゲート不変・fail-open（常に exit 0）・ネットワークなし・
**ファイル IO ゼロ**（プロンプト検査だけの最安ホットパス）。

検知は 2 段:

- **Tier 1（無条件発火）— フル URL**。チケットシステムはパス形状で同定し、self-hosted が
  一般的なものはホスト非依存にする:
  GitHub `github.com/<o>/<r>/issues/<N>`・GitLab `…/-/issues/<N>`・
  Jira `…/browse/<KEY>-<N>`・Backlog `…/view/<KEY>-<N>`。
- **Tier 2（キーワードゲート付き）— 裸参照**。プロンプトに意図キーワード
  （`issue|イシュー|チケット|ticket|バグ|不具合|障害|incident`）が同伴するときだけ
  `#N` / `KEY-N` を拾う。`UTF-8`/`SHA-256` 型の頻出誤検知トークンはブロックリストで除外。

**裸の `#N` 単独では発火しない（明示決定）**: PR 参照・markdown 見出し・hex 色と衝突して
ノイズ過多になる。「issue #20 やって」のような自然な依頼はキーワード同伴で Tier 2 が拾う。
キーワードゲートの残余誤検知（例: 「バグ」+ 全数字 hex 色）は受容する — 助言は非ブロッキングで、
無視してもフローを壊さない。既発火の抑止はしない（同じチケットに言及するたび助言が再掲される —
ステートレス維持のための受容。助言文に「既にノード化済みなら再発火不要」を含めて緩和）。

### 2. 検知はエンジン汎用 — provider 設定は無変更

チケット駆動の入口は方法論に直交する（MODEL A1: どの provider の作業単位も同じログ・同じ
lifecycle に載る）ため、検知パターンは **hook に内蔵**し、`.claude/moira-provider.json`
（schema v1）・`EMBEDDED_DEFAULT`・validator・render は**一切変更しない**。schema v1 の
`triggers` は「ファイルパス正規表現＋必須 `(?<feature>)` 捕獲」の DSL であり、プロンプト検知は
型が合わない（拡張すると 6 箇所に波及するが、得られるのは URL パターンのカスタムだけで
現時点の要求にない）。validator は未知フィールドを拒否しない実装のため、将来必要になれば
`ticketPatterns` 等を後方互換で追加できる（将来拡張として記録）。

### 3. `ticket` は provider phase にしない — 振り付けは配布 SKILL.md に置く

`/moira-track ticket <ref>` はエンジン水準の**入口**であり、provider の `phases` 語彙に
加えない。振り付けは moira-track **SKILL.md の新節「チケット駆動の入口」**に置く —
SKILL.md は provider を問わず逐語配布されるため、custom provider も自動で継承する
（render の §P2「⚠ 未著」の扱いは不変）。内容:

- **前処理**: チケットを read-only で取得 → ノード ID 提案 → 進め方を `[人間確認]`
  （A/B/C の 3 択・1 回）。どのパターンでも誕生は一度だけ（`moira log` で既存確認）。
- **A. 既存パイプライン合流**: チケットは provider 最初のフェーズ（cc-sdd なら discovery）への
  入力。§P2 の通常振り付けをそのまま実行し、feature の `--label` にチケット URL を含める。
  ticket 入口で先回り emit しない（二重誕生禁止）。
- **B. plan→実行**: 単一ノード lifecycle（フェーズ子省略は人間判断④）—
  `add --parent <root> --estimate <n> --label "<要約> (<url>)"`（proposed）→ `[人間確認]` →
  `agree`（human）＋ `assign --slot` → 着手ゲート充足で `start` → `done` → **`cost`（実測）** →
  人間レビューで `accept`。
- **C. 直接実行（最小儀式）**: **イベント列は B と同一**。`[人間確認]` を 1 回に束ねるだけ。
  **省略されるのは儀式でありゲートではない** — 着手ゲート・AC 記録・5 判断は B と同一。

### 4. チケット由来ノードの ID 規約と URL の記録

- ID 規約（multi-repo・ADR-0003 での番号衝突を避けるため repo 名を含める）:
  GitHub → `gh-<repo>-<N>`、GitLab → `gl-<repo>-<N>`、Jira/Backlog → キー小文字化 `<key>-<N>`。
  裸 `#N` は git remote から repo 名を補完（取れなければ `[人間確認]`）。
- チケット URL は **`--label` に含めて `.moira/labels.json`（表示専用・MODEL 外）に記録**する。
  イベント 4 種は無傷 — 射影の対応はラベルという実装層で持つ（射影機構は MODEL の責務外・
  実装の責務という 0b 裁定と整合）。
- **書き戻しはしない**（D-19）: チケットの状態同期・コメント投稿はアダプタの射程外。
  チケットのクローズ等は人間の指示によるプロセス側の操作であり、moira の記録と独立。

### 5. 設置系: matcher optional 化と升级経路

- `HOOK_INJECTIONS` に `{ event: 'UserPromptSubmit', command: FIRE_CMD }` を追加（matcher なし）。
- `settings-merge.ts` の `HookInjection.matcher` を optional 化。matcher なしの injection は
  **matcher キーを持たないグループ**を生成する（Claude Code の UserPromptSubmit 設定形）。
  dedup（command 完全一致）・remove・status probe は matcher 非依存のため無改修で動作。
- 既存 install の升级は **`moira adapter install` の再実行一発**（hash 一致ファイルは update
  上書き・settings に 1 エントリ追加・manifest 再スタンプ）。`moira/cli` を 0.5.0 → **0.6.0** に
  bump し、旧 install の `adapter status` が「→ 再 install で更新可」を表示する。
- steering 発火表（テンプレート＋ render 生成の両方）にチケット行を追加。

### 6. drift は無改修

チケット由来ノードは cc-sdd builtin drift で `unknown-node`（**報告のみ**）に分類される —
provider-reference §P4 に既記載のとおり A1 射程では正当。恒常運用は `.moira/adapter.json` の
`ignoreFeatures`/`ignoreNodes` を案内する。チケットトラッカーとの突き合わせは提供しない
（**drift は捏造しない** — ADR-0003 の原則。ローカルに成果物が無い以上、正直な答えは「非対応」）。

## Consequences

- （+）**全 provider が無設定でチケット駆動に対応**する（検知は hook 内蔵・振り付けは配布
  SKILL.md）。issue #20 の 3 実行パターンすべてで、節目のイベントが同じ 4 イベント・同じ
  ゲートで残り、`moira show`/`moira ui` にそのまま可視化される。
- （+）既存 install は再 install 一発で升级（manifest の decision matrix が担保・テストで固定）。
- （−・受容）裸 `#N` 単独は検知しない（キーワード同伴で拾う）。キーワードゲートにも残余誤検知は
  ある（非ブロッキング助言ゆえ受容）。同一チケットへの再言及で助言が再掲される（ステートレス）。
- （−・受容）GitHub Enterprise 等の独自ドメイン GitHub は Tier 1 の `github.com` 固定に
  乗らない — フル URL でも Tier 2（キーワード同伴）頼みになる。GitLab/Jira/Backlog は
  パス形状で同定するためホスト非依存。
- （−・受容）チケット由来ノードは drift の突き合わせ対象外（`unknown-node` 報告のみ）。
  発火規約（steering）と UserPromptSubmit 検知が防衛線。
- （将来拡張）検知パターンの provider 宣言（例: schema への `ticketPatterns` 追加）は、
  validator が未知フィールドを拒否しないため後方互換で追加可能。必要になるまで足さない。

## Alternatives

- **provider-config schema v1 に `ticketTriggers` を追加** — プロンプト検知は「ファイルパス＋
  `(?<feature>)` 捕獲」の既存 DSL と型が合わず、EMBEDDED_DEFAULT・テンプレ JSON・ロックステップ
  テスト・validator・render・adapter-gen インタビューの 6 点に波及する。得られるのは URL
  パターンのカスタムだけで、チケット駆動が方法論に直交する以上 provider ごとに変える動機が薄い。棄却。
- **`ticket` を provider の phase として宣言させる** — 全 provider に同じ行を書かせる重複を生み、
  宣言し忘れた provider だけチケット駆動が使えなくなる。エンジン汎用の入口として一箇所
  （配布 SKILL.md）に置く方が正しい。棄却。
- **裸 `#N` の無条件検知** — PR 参照・markdown 見出し・hex 色との衝突でノイズ過多。
  キーワードゲート付き Tier 2 で十分拾える。棄却。
- **チケットシステム API 連携（状態の書き戻し・自動同期）** — D-19（チケットは読み取り専用の写し・
  逆書き込みしない）に正面衝突。射程外を明示する。棄却。
- **SessionStart でチケットトラッカーを照会して drift 相当を出す** — ネットワーク・認証依存を
  ホットパスに持ち込み fail-open 原則を弱める。ローカルに証拠が無いものは突き合わせない
  （drift は捏造しない）。棄却。
