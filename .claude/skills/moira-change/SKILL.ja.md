---
name: moira-change
description: >
  moira の変更管理フロー（issue 受付 → 影響調査 → ルーティング → 既存ゲート起動 → 同期閉包確認 →
  クローズ）を 1 本の issue について回すオーケストレーション skill。「変更管理フローを回す」
  「issue #N を変更管理で流す」「この変更を moira-change で」「影響調査から閉包まで通す」などで起動。
  規範は `.kiro/steering/moira-change-management.md`（ratified DFD の確定版）——本スキルは振り付けのみを
  所有し、規則の本文を複製しない。既存ゲート（moira-model-update / doc-refine / kiro-scenario /
  kiro-scenario-flow / kiro-scenario-e2e / decision-conformance / kiro-impl）を呼び出す層であり、
  新造ゲートは作らない。Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
argument-hint: <issue 番号 | 変更依頼の要約>
model: opus
metadata:
  origin: "custom"
  shared-rules: "templates/"
---

# moira-change — 変更を issue に正規化し、影響マップを台帳に既存ゲートを配線して閉じる

変更要求を GitHub issue に正規化して受け付け、**影響マップ**（波及先成果物の明示的列挙＋各行の期待
postcondition と検証器）を作業台帳として、**既存ゲート群を依存順に起動**し、「影響マップの全行が
証跡付きで resolved または追跡先の生きた deferred」になったことをもって閉じる（P1〜P6）。

**規範（正）は `.kiro/steering/moira-change-management.md`。** ルーティング規則（変更クラス M/D/P/S/C/V/F）・
ゲート実行の順序規則・同期閉包の 3 値判定・人間タッチポイント（HA/HB/H5）と提示規約の本文はすべて
steering 側が所有する。本スキルはその**操作手順（振り付け）だけ**を所有し、規則を複製しない——
食い違えば steering が勝つ。

> **ガードレール（最重要）:**
> 1. **新造ゲート禁止。** 検証はすべて既存の skill／checker／CI の再利用で行う。本スキルが独自の
>    合否判定器を発明した時点で設計違反。
> 2. **既存の委譲辺を変更しない。** `kiro-scenario` → `moira-model-update` の上申、
>    `kiro-scenario-flow` → `kiro-scenario` の差し戻し等はそのまま尊重する。
> 3. **本フローは強制機構ではない**（紳士協定・steering §0）。保証するのは「このフローを通った変更に
>    ついては波及先が黙って落ちない」ことだけ。フロー外の直接変更の漏れは検知器（DRIFTED・CI・E2E）が
>    拾って issue 再入する。
> 4. **台帳（`moira/changes/issue-N/`）は非正典。** 根拠にしない・クローズ後も残す・同期しない
>    （`moira/changes/README.md`）。
> 5. **「見送り」は解消ではない。** deferred の成立要件は steering §5 が正——acknowledge では消えない。

## 引数

- `<対象>`: GitHub issue 番号（例 `42`）、または issue 未起票の変更依頼の要約（→ P1 で起票して正規化）。

## 手順（規範）

### 0. 起動前提（best-effort）

Opus 4.8+ / Fable / effort max を推奨表示（機械強制はしない——`../doc-refine/model-and-subagent-policy.md`
と同じ正直枠）。規範 steering と `moira/changes/README.md` を読む。調査・照合など機械的作業は
sonnet worker（subagent）へ派遣してよいが、**クラス判定・ルーティング・閉包判定の責任は主コンテキストが
負う**。

### 1. P1 受付・正規化・triage

1. 入口 3 種を issue に正規化する: (a) 既存 issue はそのまま、(b) 検出結果（`decision-conformance` の
   DRIFTED／`kiro-scenario-e2e` の discrepancy 等）と (c) 会話ベースの依頼は `gh issue create` で起票
   してから流す。
2. **人間の言葉（曖昧さ・省略を含む）を、後段の LLM 処理が迷わない明確な変更要求文に書き起こす**
   （原文は issue に残る——情報は失わない）。候補クラス（M/D/P/S/C/V/F。steering §3）を仮判定する。
3. **triage**: フル工程を回すか、軽量ゆえフローを起動せず通常作業へ送り出すかを判定し、**判定理由を
   issue に一言コメント**する（誤判定の網は既存検知器が引き受ける）。**軽量判定なら台帳ディレクトリは
   作らず（request.md も作らない）、issue コメントの一言だけを記録としてここで終了**。
4. **base commit を記録する**（`git rev-parse HEAD`。以後の全差分検査は `base..HEAD`）。
5. `templates/request.template.md` から `moira/changes/issue-N/request.md` を起こす。

### 2. P2 影響調査

1. トレース機構（**既存・新造なし**）を機械的に辿って波及先成果物を列挙する: MODEL の安定 clause ID
   （A/I/P/R——行番号禁止）／DECISIONS-CATALOG 裏面 ref と計器被覆マップ（**変更 path → 裏面 ref の
   逆引き＝①パス片・ファイル名で目録全文 grep ②ヒット近傍を AI が意味的に突合**）／PROPERTIES の
   clause→property 被覆／E2E spec の SPEC_META／`moira/frontend/e2e/coverage-check.test.ts` の被覆定義。調査は
   sonnet worker へ並列派遣してよい。
2. `templates/impact-map.template.md` から `moira/changes/issue-N/impact-map.md` を起こす。**各行に
   「クラス・根拠・担当ゲート・期待 postcondition・検証器」を必須記載**。**append-only**（行の削除禁止。
   deferred 化は閉包規則の要件で）。
3. **人間断面ビュー**を同ファイル内に組む: 前面＝**3面（シナリオ・プロパティ・設計判断）の行のみ**を
   平易文で（M 行は D/P/S 粒度の平易文へ翻訳して載せる）。ソースコード・テストコード（C 級）・検証
   基盤（V 級）等の機械決着行は「**人間はレビューしない**（codex＋CI に委譲）」と見出しで明示した
   別節に畳む。**F 級（一般確定文書）の行はどちらにも入れず**、「文書ゲート内で批准（HA 対象外・
   doc-refine 内で決着）」の小節に列挙する（steering §3 F 行「文書により批准」）。
4. 再入時（P4/P5 からの差し戻し）は未マップ差分を新行として**追記**する。

### 3. P3 ルーティング裁定＋HA 前半集約セッション（原則 issue につき 1 回）

1. steering §3 の規則で各行の経路を、steering §4 の順序規則で依存順を確定し、実行計画（経路列・
   依存順）を組む。境界不明瞭は既定ルート＝ D 級起票（迷いが残る場合のみ HA の裁定項目へ）。
2. **HA で一括で諮る**（細切れ批准の禁止）: ①影響マップ人間断面の確認（「はねる先はこれで全部か」）
   ②境界裁定 ③**When/Then の発案**（**新規シナリオのみ**。既存 unit の変更は issue に人間が書いた
   記述を発案として扱う——issue に無いときだけここで聞く。S 行の意図批准はこの When/Then 確定が兼ねる）
   ④**M/D/P 各行の意図批准**（何を決めるか・**受け入れ基準**・却下したい方向を実質で yes/no。D は
   (a)責任・帰結・ドメイン意味＋混合のみ・P は一文のみ。**M 行は MODEL 条項文でなく D/P/S 粒度の
   平易文〔判定文・一文・ふるまい例〕に翻訳して諮る**）⑤実行計画の承認（あわせて **P4 各ゲートが
   依拠する一次資料セットの確定**を含む——SOURCE_SET_CONFIRMED を要求するゲート〔doc-refine・
   kiro-scenario・kiro-scenario-flow〕に対する根拠になる）。
3. **提示規約（厳守）**: ①詳細は `moira/changes/issue-N/` の md（人間断面＋
   `intent-ratification.md` 準備稿）に**人間可読最優先**で吐き出す ②コンソールには**確認点のサマリと
   詳細ファイルのパス**を出す ③**AskUserQuestion は md を読んだうえでの最終裁定（yes/no・選択）だけ**に
   使う。狭い選択肢欄に術語を詰め込まない。
4. 裁定結果（HA ①〜⑤ の全て——マップ確認・境界裁定・When/Then・意図批准・**実行計画〔経路列・
   依存順〕と一次資料セット**）を `intent-ratification.md` に確定記録し、**要約を issue コメントに残す**
   （モバイルで読むのは issue・機械が読む台帳は repo）。この記録が P4 各ゲートの**意図整合検査の基準**
   になり、P4 はこの実行計画に従って実行される。

### 4. P4 ゲート実行（既存ゲートの振り付け）

1. 実行計画の依存順に、各行の担当ゲートを起動する（クラス→ゲート対応は steering §3 の表が正）:
   - **M** → `Skill: moira-model-update`／**D** → DECISIONS-CATALOG へ `proposed` 起票 →
     `Skill: doc-refine`（仕分け弁: (a)/混合は HA 批准済み意図で・(b) 純工学は技術ゲートのみ）／
     **P** → PROPERTIES.md＋PBT 資産（3 サブルートの義務は steering §3）／**S** → `Skill: kiro-scenario`
     （unit）・`Skill: kiro-scenario-flow`（flow）→ agreed unit のみ `Skill: kiro-scenario-e2e`／
     **C** → `/kiro-impl`（worker=sonnet）＋codex レビュー＋CI／**V** → 自己検証禁止プロトコル
     （gate inventory 前後比較＋陰性対照＋codex 独立レビュー）／**F** → `Skill: doc-refine`。
2. **事前批准記録の引き渡し**: 各ゲート起動時に `intent-ratification.md` の該当行を渡す。ゲート系
   スキルは「**変更管理フローの事前批准記録を人間承認の証跡として受け入れる**」契約（各ゲート
   `review-gate.md`「変更管理フロー連携」）で動き、ループ内の AskUserQuestion を批准済み範囲について
   省略する。**著者は「記録が覆う」とした fork ごとに、批准記録の該当行の引用＋被覆理由を記録する**
   ——各ゲートの独立採点者が**意図整合検査＋fork 被覆監査**（批准記録 ↔ 最終ドラフトの突合と被覆の
   再検証。著者≠検査者）を行い、整合すれば auto-agreed で下流へ。記録が沈黙・曖昧な論点は未被覆
   ＝ HB 行き。
3. **fork バッチ（HB）**: ①検証ループ内の genuine fork（批准済み意図で覆えない・事実で決められない
   分岐）②意図整合検査で検出された**批准済み意図からの逸脱**——いずれも**即時割込みにせず**
   `fork-batch.md` に溜め、**下流をブロックする時点、遅くとも P5 開始前に**まとめて諮る（提示規約は
   HA と同じ。M 級の fork も平易文で）。HB 待ちのゲートは AWAITING-HB 保留（ラウンド非消費——各
   `review-gate.md`「変更管理フロー連携」）。HB の合流範囲は **P4 実行中〜P5 開始時の再入分**を含む。
   裁定を反映して続行。
4. **各ゲート完了時**: `git diff --name-only <base>..HEAD` の changed paths − 影響マップの mapped paths
   を計算し、**非空なら P2 へ差し戻して追記**（新行分の追加判断は新行分だけのミニ HA として HB に合流）。
   **比較の操作的定義と `moira/changes/` の自己除外は P5（手順 5.4）と同一**——台帳のコミットが
   未マップ差分として検出されて P2 差し戻しが空回りする自己言及を、P4 の各検査でも起こさない。
5. 昇格・上申ループ: D で agreed になった Decision が MODEL の制約・語彙・既定に触れるなら M へ昇格し、
   M 完了後は**ゲート間を直接遷移せず P3 へ戻って再裁定**（再実行対象＝影響マップのうち M が触れた
   clause/成果物を参照する下流行。D 自体は再実行しない）。**昇格で新たに生じた M 行の意図批准**（原 HA
   では D しか批准していない）は、P3 再裁定時のミニ HA として **HB で平易文で諮る**。S 処理中の MODEL
   矛盾は `kiro-scenario` の既存辺で上申し、M 処理後に S を再開。

### 5. P5 同期閉包確認

1. **差分の両端を固定**: base＝P1 記録の commit、対象＝P5 開始時の HEAD。**照合中に HEAD が動いたら
   判定無効・再実行**。
2. 影響マップの各行（**行 ID 単位**——同一パスに複数義務があれば別行）を **3 値判定**する。判定規則・
   verdict→3値写像は **steering §5 が正**（本スキルは複製しない）。要点のみ: resolved には行指定の
   検証器の証跡が要る——コミットの存在だけでは resolved にできない。照合は sonnet worker へ派遣して
   よい。
3. **検査は関係分のみ**: `decision-conformance`／`doc-fact-checker` は「影響マップ範囲＋逆引きヒット分」
   に限定（全量掃射しない）。
4. **未マップ差分の非存在**を確認する（比較の操作的定義）: **changed** ＝ `git diff --name-only
   <base>..HEAD` のリポジトリルート相対パス集合（**rename 検出は使わない**——rename は削除＋追加として
   旧新両パスが現れる。削除ファイルも含む）、**mapped** ＝ 影響マップ「波及先成果物」列のパス集合
   （ルート相対に正規化。ディレクトリ指定行は**末尾 `/` を付けたパス区切りの前方一致**で配下を被覆——
   `foo/` は `foo/bar` を被覆し `foobar` は被覆しない）。changed − mapped = ∅ を要求。
   **`moira/changes/` 配下は台帳自身のため正規化後に除外**。未コミットの作業ツリー差分が残る状態では
   判定しない（P5 は全ゲート成果物のコミット後に走る）。
5. **deferred 行の後続 issue openness は `gh issue view <N> --json state` で機械照合し証跡化**する
   （人間の確認義務にしない）。「open で生きている」＝**参照が解決可能かつ state=OPEN**。解決不能・
   アクセス不能・別リポへの transfer で追えない場合は要件不充足（＝未了）。
6. `templates/closure-report.template.md` から `closure-report.md` を生成: **先頭＝人間が読む 3 点**
   （①3面最終文↔批准済み意図の対応表〔全行・原文は気になった行だけ読めばよい〕②「できないことに
   なったこと」の平易な差分〔deferred のシナリオ語翻訳＋追跡 #NN〕③閉包 PASS/FAIL 一行）、機械決着の
   詳細は折り畳む。
7. 未了が 1 行でもあれば閉包不成立 → P4（原因が調査漏れなら P2）へ戻る。**P6 に進めるのは閉包判定が
   PASS のときのみ**——FAIL の閉包レポートは差し戻し記録として台帳に残し、H5 には諮らない。

### 6. P6 クローズ＋H5（薄い承認）

1. （ここに至るのは閉包 PASS のみ）提示規約どおり: `closure-report.md` のパスとサマリをコンソールに
   出し、**AskUserQuestion は最終承認のみ**。人間が読む義務は 3 点だけ（fork の経緯は issue コメントに
   残るが読む義務なし）。
2. 突合で「違う」と気づかれたら**その場で直さず** fork／新 issue として再入する（クローズは下りない）。
3. 承認されたら: issue に閉包サマリ（できないこと差分含む）をコメントしてクローズ。ジャーナル来歴は
   **該当する確定分岐がある場合のみ**（記録条件は `moira-model-update`／目録の既存規律に従う——本フローは
   条件を新設しない）。
4. **撤回条件の運用**: 「事前批准した意図と agreed 文面の乖離が実害化」した欠陥は `/kiro-postmortem-add`
   で literal タグ **`[intent-drift]`** を含めて記録する。未レビュー 2 件で文面批准（逐語レビュー）への
   復帰を再審査する（steering §6 撤回条件・両 review-gate の同型トリガ段落が正）。

## P5 の限界（正直枠・過大主張の禁止）

P5 の保証範囲と未整備義務の本文は **steering §5「P5 の限界」が正**（本スキルは複製しない）。本スキルを
実行する者への拘束はひとつ: 報告・issue コメント・閉包レポートで、steering が未整備義務に挙げるものを
「担保」「保証」と言わないこと。後日発覚した漏れは新 issue として再入させる。

## 既存スキルとの境界

- `moira-model-update`／`doc-refine`／`kiro-scenario`／`kiro-scenario-flow`／`kiro-scenario-e2e`／
  `decision-conformance`／`kiro-impl`: 本スキルが**起動する側**の工程単位ゲート。各ゲートの内部規律は
  各スキルが所有し、本スキルは配線（順序・引き渡し・差し戻し）だけを担う。
- `kiro-issue`: discovery 結果の起票専用（milestone 必須）。本スキルの P1 起票は素の `gh issue create`
  でよい（変更管理の入口正規化であって企画起票ではない）。
- `kiro-postmortem-add`: `[intent-drift]` タグの記録先（撤回条件の計器）。

## 出力フォーマット（Change Verdict）

```md
## Change Verdict — issue #N
- TRIAGE: full-flow | lightweight-exit（理由一言）
- BASE: <base commit sha>
- IMPACT_MAP: <行数と内訳（M/D/P/S/C/V/F 各何行）＋ moira/changes/issue-N/impact-map.md>
- HA: <批准された意図の件数と intent-ratification.md のパス・issue コメント URL>
- GATES: <起動した既存ゲートと各 verdict（PASS/確定 or 差し戻し）>
- HB: <fork バッチの回数と裁定件数（無ければ none）>
- CLOSURE: <resolved X / deferred Y（全件列挙・追跡 issue）／未マップ差分 ∅ の確認・closure-report.md のパス>
- H5: <クローズ承認の記録・issue クローズ URL／または「クローズせず: 理由」>
```
