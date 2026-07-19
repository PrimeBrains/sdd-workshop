---
status: working-ledger
issue: 39
---

# #39 構築フェーズ 確定ゲート ラウンド記録

> **最終判定（2026-07-20）**: **Loop A = PASS**（doc-gate-judge・Round 3 終了時点。上限 3R 到達・生存
> Critical/Important ゼロ・全件 disposition・R2-15 相反は「minor 範囲内」で裁定棄却・SOURCE_SET 確定済み・
> fork 全ルーティング済み）／**Loop B = PASS**（moira-gate-judge・Round 2 終了時点 PASS → R3-1 の
> PASS 後差分も再判定で PASS 維持）。deferred Important は両ループとも **0 件**。

対象 2 系統（新ゲート経済学: 各 Claude 敵対者 1＋codex 1・上限 3R・Important は disposition 制）:
- **Loop A（doc-refine 型）**: 新設一式 = `.claude/skills/moira-change/`（SKILL.md/SKILL.ja.md＋templates×5）・`moira/changes/README.md`・`.kiro/steering/moira-change-management.md`・moira-verification.md 差分
- **Loop B（moira-model-update 型・M 級）**: ゲート系契約改訂 = doc-refine／moira-model-update（SKILL×2＋review-gate×2）・kiro-scenario（SKILL×2）・kiro-scenario-flow（SKILL×2）・kiro-postmortem-add（SKILL×2）・**判定器 2 種**（doc-gate-judge.md／moira-gate-judge.md——R1 指摘で対象に追加）

一次資料（ユーザー AskUserQuestion 確定済み・2026-07-19）: ① `moira/plans/2026-07-19-change-management-dfd.md`（ratified v5・最上位の正）② issue #39 ③ `.kiro/steering/moira-verification.md` ④ 両スキルの review-gate.md・model-and-subagent-policy.md（改訂前 HEAD 断面）⑤ CLAUDE.md

## Round 1 指摘と決着（disposition）

### Loop A（doc-adversary＋codex＋doc-fact-checker）

| # | 出所 | 深刻度 | 指摘（要旨） | 決着 |
|---|---|---|---|---|
| A1 | codex | Critical | 実行計画の永続成果物と承認スキーマが無い | 修正済み——intent-ratification に「⑤実行計画承認＋一次資料セット確定」節を新設し、SKILL P3.4 で P4 拘束を明記 |
| A2 | codex | Critical | HA 成果物が 5 判断（①〜⑤）を記録できない | 修正済み——intent-ratification を ①②③④⑤ の全節構成に改訂 |
| A3 | codex | Critical | steering §5 が棄却済みの「裏面 ref 正規化」方向を残す | 修正済み——plan §8-6 裁定（裏面削除方向＋checker 意味突合化・別 issue）に置換 |
| A4 | codex | Critical | P3 再裁定・HB バッチの遷移が実行可能な粒度で未定義 | 修正済み——SKILL §4 に HB フラッシュ条件（下流ブロック時点・遅くとも P5 前）・AWAITING-HB（ラウンド非消費）・合流範囲（P4〜P5 開始時）・昇格 M のミニ HA・復帰先（P3 再裁定）を明文化。review-gate 連携節にも同項 |
| A5 | codex | Critical | H5 に FAIL が提示可能（PASS-only 遷移ガード欠如） | 修正済み——SKILL P5.7/P6.1・SKILL.md・closure テンプレ③に「H5 は閉包 PASS のみ・FAIL は差し戻し記録」を明記 |
| A6 | codex | Important | README が skill を steering と同格の正典に列挙 | 修正済み——唯一の正典＝steering・skill は非規範の振り付けに改訂 |
| A9 | codex | Important | steering §6 実装帰結が完了済み作業を残作業と誤記 | 修正済み——実施済み記録へ更新（判定器配線含む） |
| A11 | codex | Important | mapped paths 比較が非決定的 | 修正済み——SKILL P5.4 に操作的定義（`git diff --name-only -M`・正規化・前方一致・除外順序・コミット後判定） |
| A12 | codex | Important | deferred「生きている」の操作的定義欠如 | 修正済み——「参照解決可能かつ state=OPEN」を SKILL・テンプレに定義 |
| A13 | codex | Suggestion | 軽量 triage の台帳有無が不明 | 修正済み（非ブロッキングだが安価）——台帳を作らない・issue コメントのみと明記 |
| A14/A15/A16 | codex | Suggestion | 影響マップ行 ID・証跡列・閉包/H5 対応表のキー不備 | 修正済み——行 ID＋証跡列＋面（S/P/D/M-翻訳/S-flow）列を全テンプレに導入 |
| A17 | codex | Suggestion | モデル方針（Opus 4.8+/effort max）は DFD 外の付加 | 保持（非ブロッキング）——リポ全ゲート skill 共通の確定規約（一次資料④ model-and-subagent-policy.md）の踏襲であり発明ではない |
| A20 | doc-adversary | Critical | auto-agreed の両端未配線（判定器 2 種に意図整合検査の職務なし・steering 作業項目列からも欠落） | 修正済み——doc-gate-judge.md／moira-gate-judge.md に「変更管理フロー起動時の追加職務」（意図整合検査・fork 被覆監査・AWAITING-HB）＋出力欄を追加。steering 実装帰結に配線済みを記録。※同指摘中の「moira-model-update/SKILL.md に contract 0 件」は英語 shell の英文表現を日本語 grep で見落としたもの（英文 bullet に存在）——記録として訂正 |
| A21 | doc-adversary | Important | skill が steering §5 の規範を逐語複製（自己矛盾・ドリフト源） | 修正済み——「P5 の限界」「verdict 写像」「deferred 要件」を steering 参照へ置換 |
| A22 | doc-adversary | Important | steering §6 の陳腐化（＝A9） | 修正済み（A9 と同一決着） |
| A23 | doc-adversary | Important | §0「波及先が黙って落ちない」と §5 正直枠の緊張（DFD 継承） | **FORK（AWAITING-HB）**——ratified 文言の変更は人間裁定事項。バッチでユーザーへ |
| A24 | doc-adversary | Important | F 級行の人間断面ビューに居場所が無い | 修正済み——「文書ゲート内で批准（HA 対象外）」バケットをテンプレ・SKILL P2.3 に新設（steering §3 F 行「文書により批准」に忠実） |
| A25 | doc-adversary | Suggestion | P5 発火再入・昇格 M の批准点未定義 | 修正済み——HB 合流範囲拡張＋昇格 M ミニ HA（A4 と同時決着） |
| A26 | doc-adversary | Suggestion | S 意図批准の所在不整合 | 修正済み——「When/Then 確定が S 行の意図批准を兼ねる」を SKILL・テンプレに明記 |
| A27 | doc-adversary | Suggestion | 「V は独立」は規範に無い付加 | 修正済み——削除し steering §4 参照に置換 |
| A28 | fact-check | CORRECTED | `e2e/coverage-check.test.ts` はルート相対で実在しない | 修正済み——新規成果物側をフルパス `moira/frontend/e2e/coverage-check.test.ts` に統一（plan は来歴のため不変更） |

doc-adversary の CLAIMS_FOR_FACT_CHECK 決着（著者検証・出典付き）: kiro-issue の milestone 必須＝skill description に明記（CONFIRMED）／計器①②③④・⑥の番号体系＝moira-verification.md「計器構成」「Decisions の検証割付」と一致（CONFIRMED）／moira-model-update の bound プロパティ同一 run 再批准＝moira-verification.md「プロパティ目録」規律に明記（CONFIRMED）。

### Loop B（moira-adversary＋codex＋moira-fact-checker）

| # | 出所 | 深刻度 | 指摘（要旨） | 決着 |
|---|---|---|---|---|
| B1 | moira-adversary（codex 同旨） | Critical | 「批准記録が実質的に決めている」の被覆判定が著者の自己裁定（fork 握り潰し経路） | 修正済み——両 review-gate 連携節に「著者は fork ごとに該当行引用＋被覆理由を記録・採点者が被覆を独立再検証・沈黙/曖昧/部分被覆は未被覆＝HB」を明文化。判定器 2 種に fork 被覆監査を職務化（FORK_COVERAGE_AUDIT 出力欄） |
| B2 | moira-adversary | Important | doc-refine 基準4（SOURCE_SET）連携の前提「HA で一次資料確定」が HA 議題に存在しない | 修正済み——HA ⑤に一次資料セット確定を統合（steering 軽微追随①・SKILL P3・intent-ratification ⑤節・kiro-scenario/flow の step 2 条件化）。DFD の総称要求からの操作的具体化である旨も連携節に正直開示（fact-check hedge 反映） |
| B3 | moira-adversary | Important | 発案ロンダリング（P1 の AI 書き起こし文を発案根拠にできる読み）＋「既存 unit」未定義 | 修正済み——kiro-scenario 両言語で「verbatim 原文のみ・AI 書き起こし文は根拠外・既存 unit＝§3 記入済み（seed は新規扱い）」を明文化 |
| B4 | moira-adversary | Important | `[intent-drift]` の consumer 未割当（孤児トリガ） | 修正済み——両 review-gate 撤回条件に `[deferred-important]` と同型の運用段落（2 件で auto-agreed 経路停止・文面批准復帰の再審査・起動点＝次回ゲート起動時＋kiro-postmortem-review）を新設 |
| B5 | moira-adversary | Important | flow の DRAFT_RATIFIED 代替は「未生成物への事前批准」＝最薄の保証 | 修正済み（正直開示）——kiro-scenario-flow に「リスク集中点」開示＋閉包対応表で S-flow 行を明示区別（closure テンプレ 面列） |
| B6 | codex | Important | HA 被覆判定の独立裁定なし（B1 と同旨） | B1 と同一決着 |
| B7 | codex | Important | kiro-scenario 緩和が手順上到達不能（§3 記入済み＝不可侵で改稿分岐なし） | 修正済み——step 1 に既存 unit 改稿分岐を新設し「§3 不可侵＝人間発案の範囲外で改変しない」と意味を明確化 |
| B8 | codex | Important | 手順前半の無条件 AskUserQuestion（ratify・SOURCE_SET）が HA 代替と矛盾 | 修正済み——kiro-scenario step 1/2・kiro-scenario-flow step 2 にフロー起動時の条件分岐を追加 |
| B9 | codex | Important | flow 逸脱の二重経路（§4 即時再批准 vs HB バッチ） | 修正済み——フロー起動時は §4 差し戻しでなく HB 一本化（5e 例外） |
| B10 | codex | Important | HB 待ちがラウンド上限を空費（保留意味論なし） | 修正済み——AWAITING-HB（保留のみ未決のラウンドは上限非消費・P5 前フラッシュ）を両 review-gate＋判定器 2 種に導入 |
| B11 | codex | Suggestion | 緩和の冒頭文「新規のみ人間発案」が単独引用で危険 | 修正済み——「発案が人間であることは変わらない——緩和は受け取り方だけ」に両言語で書き換え |
| B12 | moira-adversary | Suggestion | 平易文規約が設計物その他で空虚 | 修正済み——「MODEL 系対象のとき」に限定・その他対象は適用外を明記 |
| B13 | moira-adversary | FYI | 批准記録は著者組成プロンプト経由（判定器の粒度限界） | 開示済み——連携節に「記録の出所照合＋最終確認は H5 の人間」（openness 同型の正直枠）を明記 |
| B14 | fact-check | hedge | 基準4適用は DFD 総称要求の解釈的具体化 | 修正済み——連携節に正直開示文を追加（B2 と同時） |

moira-adversary の FORK 決着: 「緩和のスコープ（フロー限定 vs issue 発案一般）」→ DFD §12 追加裁定①の文言（「issue に人間が書いた記述を発案として扱う」——フロー限定の限定句なし）が決めているため、issue の人間 verbatim 記述がある場合に適用（フロー外でも同条件）と実装。「[intent-drift] の owner」→ 既存 `[deferred-important]` と同型の確立済みパターン（review-gate 撤回条件段落）に配置——確定規約の踏襲であり人間裁定不要と判断（採点者の監査対象）。

## Round 2（修正検証）指摘と決着

4 体（doc-adversary＋moira-adversary＋codex×2）による現物照合。**R1 の Critical/Important 決着は全件 VERIFIED-FIXED**（codex A: 17/19・残 2 は下記で修正／codex B: 12/14・残 2 は下記で修正／Claude 両敵対者: 全件確認）。R2 の残存・新規と決着:

| # | 出所 | 深刻度 | 指摘（要旨） | 決着 |
|---|---|---|---|---|
| R2-1 | codex B（B8 残存） | Important | 新規シナリオ経路の読み返し確定（step 1）が無条件のまま | 修正済み——kiro-scenario step 1 転記 bullet に HA ③記録による省略条件を追加 |
| R2-2 | codex B（B10 残存）＋moira-adversary #N1 | Critical | AWAITING-HB のラウンド非消費が skill 制御フロー（4f/5f・doc-refine step7・moira-model-update §2.5）に未実装 | 修正済み——4 ループ全てに「保留のみ未決なら敵対再派遣せず HB 裁定後に同一ラウンドで採点再実行（ラウンド番号を進めない）」を明文化。両 review-gate に遷移の定義を追記 |
| R2-3 | codex A（A11 残存） | Important | diff 定義の事実誤り（`-M` は rename 新パスのみ）・前方一致の接頭辞衝突 | 修正済み——rename 検出なしの `git diff --name-only`（旧新両パスが現れる）・末尾 `/` 付きパス区切り前方一致に修正 |
| R2-4 | codex A（A21 残存） | Suggestion 相当 | 英語 SKILL.md guardrail 5 に deferred 要件の逐語複製が残存 | 修正済み——steering §5 参照化 |
| R2-5 | codex A | Important | テンプレ 5 種＋README が来歴 plan を「準拠先」として参照（正典＝steering と矛盾） | 修正済み——全テンプレ・README の規範参照を steering へ付け替え（plan は来歴と明記。steering に無い §8 参照は「裁定来歴は plan §8-N」形式に） |
| R2-6 | codex A | Important | fork-batch に影響マップ行 ID との構造的リンクなし | 修正済み——「対象行（影響マップ行 ID／intent-ratification 行）」必須列を追加 |
| R2-7 | codex A | Suggestion | closure ② deferred「なし」と固定書式の不整合 | 修正済み——条件書式（{{DEFERRED_DIFF_OR_NONE}}）に変更 |
| R2-8 | doc-adversary #20 | Important | HA ⑤「各ゲートの SOURCE_SET_CONFIRMED」は M 経路で偽（moira 側に消費者なし） | 修正済み——「SOURCE_SET_CONFIRMED を要求するゲート（doc-refine・kiro-scenario・kiro-scenario-flow）に対する根拠。moira-model-update は対象外」に限定（steering・SKILL・テンプレ） |
| R2-9 | doc-adversary #21 | Important | plan §5 と §8-6 の文書内矛盾（正規化 vs 削除方向） | 修正済み——plan §5 該当行に「§8-6 が本行を上書き（裁定済み）」の注記を追加（plan ヘッダの軽微追随条項の範囲） |
| R2-10 | doc-adversary #22 | Suggestion | 「旧 H4 型」が steering に未定義の術語 | 修正済み——「文面批准（逐語レビュー）」に置換 |
| R2-11 | doc-adversary #25/#26 | FYI | intent テンプレ節順 ①②④③⑤／moira-verification 旧行の短縮パス | 修正済み——③④を正順に再配置・moira-verification の 2 箇所をフルパス化 |
| R2-12 | moira-adversary #N2 | Important | 判定器 base 基準（FORK＝AskUserQuestion 必須）と追加職務の矛盾（review-gate 未貼付時に auto-agreed fork が FAIL） | 修正済み——両判定器に「基準4/基準3 の読み替え」（健全な被覆・HB 裁定記録でも充足）を追加 |
| R2-13 | moira-adversary #N3 | Important | moira-gate-judge に判定器自発 Critical の同一ラウンド再反論の歯止めが欠落（doc 側と非対称） | 修正済み——doc-gate-judge と同文の歯止めを追加 |
| R2-14 | moira-adversary #N4 | Important | kiro-scenario step 1 決定木の優先順位未定義＋機械起票既存 unit の分岐欠落＋step 3「改変禁止」の無限定 | 修正済み——bullet 優先順位（変更要時は改稿分岐が優先）・機械起票分岐（人間に発案を求める・bullet4 に落とさない）・step 3 を「手順1で正当に確定・改稿された版」に限定 |
| R2-15 | codex A（FYI 監査） | FYI | 軽微追随 5 点は「minor」範囲内（①が最境界だが超過せず） | 記録のみ。doc-adversary の同件 FORK は選択肢 A の前提（R2-8 の是正）が充足済み＋codex 独立監査が minor と判定——相反は採点者の裁定対象として提出 |

新規指摘のうち codex A の「テンプレ plan 参照」「fork-batch 行リンク」等は敵対者の読取り時点がパッチ適用と並行していたため、一部は本記録執筆時点で既に適用済みの修正と同内容だった（決着はいずれも現物に反映済み）。

## Round 3（Loop A 静穏確認——採点者指示による。敵対 2 体: doc-adversary＋codex）

| # | 出所 | 深刻度 | 指摘（要旨） | 決着 |
|---|---|---|---|---|
| R3-1 | codex | Critical | AWAITING-HB の同一ラウンド再採点に停止則がなく、保留の連鎖で 3R 上限を迂回可能 | 修正済み——両 review-gate「遷移の定義」に「**同一ラウンドの再採点は 1 回まで**——再び保留のみなら次ラウンド扱い（消費）」を追加。**同ラウンド内で独立検証済み**: doc-adversary（修正後の現物を読んだ別主体）がエッジケース③として攻撃し「封鎖・破れず」を確認 |
| R3-2 | codex | Critical | P4 の各ゲート完了時検査に `moira/changes/` 自己除外がなく、台帳コミットで P2 差し戻しが空回りする自己言及 | 修正済み——SKILL P4.4 に「比較の操作的定義と自己除外は P5.4 と同一」、steering §4 再調査契機に「§5 の定義・自己除外を P4 検査にも同一適用」を明記（§5 で批准済みの除外原理の適用点拡張＝軽微追随） |
| R3-3 | doc-adversary | — | 新規指摘ゼロ。R2-2 は 4 ループ＋両 review-gate に対称実装・エッジ①（混在判定）②（P5 前フラッシュ 3 層防御）③（再採点 cap）全て閉鎖＝**ROBUST**。試行 3 攻撃（confirm 列挙の保留欠落・判定器の cap 非記載・早期終了節）は「confirm は判定器 PASS 後のみ＋判定器は保留で PASS 不可」の独立ブロックにより**自ら反証・非生存**。G1–G4・判定器 D 角で生存 Critical/Important ゼロ | 記録のみ |

R3 の敵対順序の正直開示: codex は R3-1/R3-2 修正**前**の断面を読んで検出、doc-adversary は修正**後**の断面を読んで R3-1 の封鎖を独立確認した（R3-2 は敵対者の再確認を経ていない——2 行のスコープ明確化であり、除外原理自体は ratified §5 で決着済み）。

## fork 裁定（2026-07-19・ユーザー AskUserQuestion で決着——AWAITING-HB 解消）

- **A23**: **ratified のまま保つ**とユーザー裁定。§0 文言は不変更（§5 正直枠が保証範囲の限定を既に明示しており二重に弱めない）。「裁定により決着」。
- **B-FORK-1**: **フロー外でも適用**とユーザー裁定（DFD §12① の文言どおり・一貫した規律。フロー外は読み返し確定が従来どおり必須）。現実装（kiro-scenario bullet にフロー限定句なし）が正となる。相反（moira-adversary vs codex）は本裁定により決着——moira-adversary 側の限定案は「裁定により棄却」。
