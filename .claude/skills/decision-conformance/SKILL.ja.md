---
name: decision-conformance
description: >-
  moira/DECISIONS-CATALOG.md の設計判断のうち自動テストに落とせないもの（計器⑥AI整合性チェック）を、
  独立 checker で「Decision↔実装」整合（conformance）を検証する設計。本機構は**定義済・実走は後続**。
  「設計判断と実装の整合をチェック」「Decisions の conformance を回す」「目録と実装がズレていないか確認」で起動。
  validity（判断の妥当性）は人間レビュー/doc 敵対ゲートの役割で本スキルは扱わない。Opus 4.8+ / effort max を推奨。
allowed-tools: Read, Grep, Glob, Bash, Agent, AskUserQuestion
model: opus
metadata:
  origin: "custom"
---

# decision-conformance — 設計判断↔実装の整合を独立 checker で検証する（規範。定義のみ・実走は後続）

`moira/DECISIONS-CATALOG.md` の設計判断が、確定後も**実装で守られ続けているか（held か破れているか＝conformance）**を、独立した
`decision-conformance-checker` で検証する。**validity（その判断が妥当か）は扱わない**——validity は人間レビューと `doc-refine` 敵対ゲートの役割。
本スキルは「決めたことが実装に降りて生きているか」だけを falsifiable に示す。

**現状は定義のみ。実走は後続ステージ。** 採点ゲートの主体は未確定の設計点（手順5）。
検証アーキテクチャ上の位置づけは計器⑥（`.kiro/steering/moira-verification.md` の節「Decisions の検証割付」内の⑥）。計器割付の現物は
`moira/DECISIONS-CATALOG.md` の**被覆マップ**が正典。

## 引数

- `<対象>`（任意）: 検証する Decision ID（例 `D-15`）またはグループ。無指定なら被覆マップの**計器⑥全件**を対象にする。
- `--include-untested`（任意）: 基盤未整備で①②③④のテストがまだ無い判断も**暫定照合**の対象に含める（下記の射程制限に従う）。
- `--scope <paths>`（任意）: 照合対象の実装サーフェスを明示（無指定ならステップ2で確定）。

## 手順（規範）

### 0. 起動前提（best-effort）
`doc-refine` の `model-and-subagent-policy.md` に準じ、Opus 4.8+ / effort max を推奨表示する（機械強制はしない＝強制できないものを強制すると偽らない）。

### 1. 対象判断の選定
- `moira/DECISIONS-CATALOG.md` の被覆マップから、**計器⑥（AI整合性チェック）**の判断を対象に取る。`--include-untested` 指定時は、計器①②③④だが**テスト資産が「未実装」**の判断も加える（基盤が整うまでの暫定。**射程制限**は下記）。
- **計器⑦（人間のみ・footprint 無し）単独の判断は対象外**——照合対象が定義上存在しないため。ただし**1判断が⑥と⑦に正当に跨る**ことはある（footprint のある部分は⑥、footprint の無い部分は⑦。被覆マップで D-23/35/39/49 等が⑥⑦両所属なのはこの正当な跨り）。その場合 checker は footprint 部分のみ照合し、footprint 無し部分は `UNVERIFIABLE（人間のみ・footprint 無し）` として切り分ける（これは割付誤りではない）。**⑥単独割付なのに footprint が全く無い**場合のみ、割付誤りの兆候として報告に残す。
- 各対象について、目録から「**決めたこと**」一文と〔**裏面**〕ref（根拠 clause・spec・実装ファイル）を抽出する。

### 2. 照合対象（実装サーフェス）の確定 — 既定ゲート
checker の**照合の土台＝実装サーフェスが誤っていれば照合ごと崩れる**（fact-checker の一次資料確定と同型）。
- `--scope` で実装断面が**明示されていればそれを土台**とする（この場合ステップの AskUserQuestion は省略してよい）。
- `--scope` 未指定かつ曖昧なら `AskUserQuestion` で**どの実装断面を土台にするか**確定する（既定は `origin/main`。作業ツリーは `git show`/`git grep` で読む）。**未コミットの作業ツリーのみに footprint がある**場合は `origin/main` 断面では見えないため、断面に作業ツリーを含めるかを明示する。
- 裏面 ref が指す実装が**実在しない**判断は、推測で進めず「照合不能（要 ref 更新）」として記録する。

### 3. checker 派遣（並列・独立）
- `decision-conformance-checker` を**並列・独立**に起動（`model: opus`、Write/Edit を与えない）。コスト上限は `model-and-subagent-policy.md` に準ずる（1回の並列は概ね最大3体、対象が多ければバッチで回す）。
- 各体に「対象 Decision（ID・決めたこと・裏面 ref）・確定した実装サーフェス・**正の照合/負の照合の別**・最大徹底で・不確実なら ALIGNED にせず UNVERIFIABLE に倒せ」を渡す。互いの結論は見せない。
- 出力は各判断に `ALIGNED / DRIFTED / UNVERIFIABLE` ＋証拠（`file:line` / `origin/main:path`）。

### 4. DRIFTED の集約と是正ルーティング（著者＝主コンテキスト）
- DRIFTED を集約する。**drift の原因は二択**——(i)**実装が判断から外れた**（実装修正へ）/ (ii)**目録の裏面 ref が陳腐化**（目録訂正へ）。checker は原因を断定しないので、主コンテキストが現物を見て切り分ける。
- (i) は実装修正。**対応する spec タスクがあれば** `kiro-impl`/`kiro-review`（task ID・Boundary を入力に要する）へ渡す。**spec タスク化されていない backend drift（例 D-1 の fold.ts 完了ガード欠落）は、まず実装修正タスクとして起票してから** `kiro-review`、または通常実装＋手動レビューで是正する。(ii) は目録の裏面 ref を更新（必要なら `doc-refine`）。
- いずれも**勝手に黙って直さない**——drift は可視化し、是正先を明示してルーティングする。

### 5. ゲート判定（未確定の設計点）
- **採点ゲートの主体は未確定。** `doc-refine` の `doc-gate-judge` は **doc-refine 専用基準**（doc-adversary 指摘の決着・doc-fact-checker の SOURCE_SET・FORK ルーティング）で PASS/FAIL を下すため、それらを生成しない conformance には**そのままは流用できない**。選択肢は (A) conformance 専用の薄い採点者（「**agreed 判断のうち未ルーティングの DRIFTED = 0**」のみ判定）を新設、(B) 当面は採点者を置かず checker の証拠付き出力＋著者集約で代える（三者分離の採点脚は持たない）。**本ステージは定義のみ——どちらを採るかは実装時に決定**。
- `proposed` 判断の drift はブロッカーにしない（確定前ゆえ）。**agreed 判断の drift** は是正ルーティング済みであることを要件とする。

### 6. 被覆マップの更新
- `moira/DECISIONS-CATALOG.md` の被覆マップ「状態」列を照合結果で更新する。**重要**: 計器⑥の状態欄「AIチェック」は**割付済・未実走**を意味し、「カバー済」ではない（実走したら `AIチェック: ALIGNED` / `DRIFTED→是正中` 等へ更新）。「割付＝検証済」と誤読させない（`moira-verification.md`「green が穴を塞いだという誤った安心を禁ずる」）。drift と是正先を残し、次回照合の起点にする。

## 三者分離（自己照合禁止）

| 役割 | 主体 | 権限 |
|---|---|---|
| 著者 | decision-conformance の主コンテキスト | 対象選定・是正ルーティング・被覆マップ更新 |
| 照合者 | `decision-conformance-checker`（並列・独立） | ALIGNED/DRIFTED/UNVERIFIABLE を返す。書き換え不可 |
| 採点者 | **未確定（専用採点者の新設候補・手順5）** | 「agreed の未ルーティング DRIFTED = 0」の PASS/FAIL。doc-gate-judge は基準不一致ゆえ流用不可 |

現時点で**実機能している分離は「著者 ≠ 照合者」**（checker は独立エージェントで Write/Edit 非保有）。採点脚は未確定ゆえ、現状を「doc-refine 同型の三者分離が稼働」と過大に謳わない。

## 実行契機

- Decision の新規/改訂時（目録更新後）。
- 実装の変更時（裏面 ref が指すファイルが動いたとき）。
- （将来）`kiro-validate-impl` への組込みは検討課題——**現状 kiro-validate-impl 側に受け口は無く片方向**で、SUT 粒度も feature vs Decision で要写像。組み込むなら受け側の改修が前提。

## 注意・境界

- **validity を判定しない。** 「その判断が正しいか」は人間レビュー＋`doc-refine`。本スキルは「決めたことが実装で生きているか」だけ。
- **二重化を避ける。** ①②③④で自動テスト化済みの判断は、そのテスト（CI）が一次の担保。本スキルの主担当は⑥と、テスト未整備領域の**暫定照合**。`--include-untested` は**基盤未整備の暫定**であり、(1) CI・型テスト整備が進んだ領域から失効させる（恒久的に①②③④を AI 照合へ吸い上げない）、(2) 暫定照合の ALIGNED を「テスト不要」と読まない（本担保はあくまで自動テスト）。
- **コードを書かない。** drift の是正（実装修正・テスト追加）は実装ゲートの責務。本スキルは検出と是正ルーティングまで。
