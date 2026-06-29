---
created_at: 2026-06-29T00:00:00Z
title: タスク分解後に誕生済み実装ノードを見積もり・合意して kiro-impl に進む受け入れシナリオを確定（estimate-impl-agreed）
bindings:
  - { kind: scenario, id: "units/estimate-impl-agreed" }
  - { kind: scenario, id: "units/estimate-spec-proposed" }
  - { kind: scenario, id: "units/review-work-estimated" }
  - { kind: spec, id: "moira-core" }
  - { kind: spec, id: "moira-evm" }
  - { kind: spec, id: "moira-surface-spec-value" }
source: claude-code-session
---

## 要約

- **タスク:** 既存ドラフト・ユニット `estimate-impl-agreed`（status: draft）を、kiro-scenario の falsifiable 確定ゲートを通して `agreed` まで昇格。背骨スパイン（計画 `clever-percolating-blanket.md`）における要：EV% の弧「**見かけ 100% → 実装ノードを発見して分母拡大 → 達成率が正直に 44% へ低下**」を体現するユニット（#10）。
- **§3 の人間由来:** §3 When/Then は前段セッションで人間が発案・転記・確定済み（本セッションは描き起こし済みドラフトの**確定ゲート**であり、AI による §3 origination はしていない）。本セッションの AI 役割は接地検証・敵対検証・パッチ・確定に限定。
- **結論:** doc-fact-checker＝**NO_OBJECTION**（全16主張 CONFIRMED）、doc-adversary の Critical 3・Important 5 をパッチで解消、2 FORK をユーザー裁定で解決、doc-gate-judge＝**PASS**。status を draft→agreed に確定。

### 接地検証（kiro-scenario Step 2）
- MODEL.md・3 spec（moira-core/evm/surface-spec-value）requirements・参照実装（types.ts・tiny-project.ts）で全引用を現物照合。
- 主要接地点：二段 decompose（§2.6 L132／§2.3 L104）・実装は未見積で誕生し別段で見積（R-E1b L289）・レビュー工数のノード化判断（R-E2b L295／§7#18(b)）・依存辺の既定 policy（R-D2 L368：spec=accepted／実装=implemented）・未見積/未合意は EV% 分母から除外（R-U8 L263）・I1 総和除外（L159）・EV% 非単調の正直化（P5(c) L191-192）・「EV は必ずカバレッジと対で読む」（P2 L183-185）。
- 数値チェーン検算：Before P2=75%(6/8)・EV%=100%(12.5/12.5) → During P2=67%(6/9)・EV%=100% → After P2=100%(9/9)・EV%=**44%**(12.5/28.5)。畳む分岐 After P2=100%(8/8)・EV%≈47%(12.5/26.5)。

### ユーザーに回した FORK（AskUserQuestion・全て推奨案で確定）
1. **一次資料セット:** MODEL.md・moira-core/evm/surface-spec-value requirements・types.ts・tiny-project.ts → 「このセットで確定」（SOURCE_SET_CONFIRMED）。
2. **§7(d) 実装ノード誕生（100%→75%）の切り出し要否:** → **切り出さない（起点注記のまま確定）**。本ユニットは誕生後（75% 起点）を扱い、誕生イベント e050 は precondition を生む起点として §5 に注記。誕生イベントの flow 上の最終帰属は後続 `kiro-scenario-flow` で裁定。
3. **§7(c) 「成果物が無ければ AI が分解を提案する」パスの扱い:** → **境界宣言として確定**。§3 が宣言する本ユニット対象外（分解はタスク分解フェーズの責務・深さの確定は人間 P0）であり未決論点ではない。別ユニット起票は将来判断。

### 検証ループ（kiro-scenario Step 4）の結果
- **doc-fact-checker:** VERDICT=**NO_OBJECTION**。全16主張 CONFIRMED——トレース全 ID（moira-core 9・moira-evm 5・moira-surface-spec-value 6）実在・適合、MODEL 引用（§2.6/§2.3/R-E1b/R-E2b/R-D2/R-U5/R-U7/R-U8/I1/I6/P2/P5(c)/§7#18(b)(iv)）正確、型一致（DecomposeEvent/RelateEvent/TransitionEvent と e050-e059）、fixture（impl-1=8/impl-2=6・design→impl=implemented）、skill 名・surface 契約（moira-estimate-agree／moira-estimate-propose 仮称／spec-value 深リンクのみ＝Req7 AC3）すべて一次資料整合。
- **doc-adversary（3体並列・G1-G4＋SC1-SC7）:** Critical 3・Important 5 を指摘。MODEL 矛盾（ESCALATE）はゼロ。
- **doc-gate-judge:** SURVIVING Critical/Important=**NONE**、FORKS_ROUTED=ALL_ROUTED、SOURCE_SET_CONFIRMED=YES、CONTRADICTION=NONE → **PASS**（R1）。

### 覆った／解消した判断（パッチ履歴）
- **Critical（draft 足場の残存）3件:**
  - line 23「注（draft）：本ユニットは検証ループ中の稿」→ **除去**。
  - §7(d) の明示「未決」論点 → ユーザー裁定を承け「切り出さず起点注記」の確定決定へ**書換え**。
  - §7 末尾「【draft 論点／検証ループ結果】」見出し → **廃し**、(a)(b) を「検証ループの確定記録」へ、(c)(d) を確定決定（境界宣言／切り出さない）へ**再構成**。
- **Important 5件:**
  - During 断面の P2 二状態圧縮 → 画面セルに「75%→67%（葉 8→9）」を**明示**。
  - 「畳む」分岐の §4 数値未描写 → §4 末尾に畳む分岐データ表（8葉・P2 100%・凍結 26.5・EV%≈47%・cost は実装フェーズ以降・被レビューノード帰属＝§7#18(b)(iv)）を**追記**。
  - §4「前段ユニット §7 決定を継承」の継承元不明 → `estimate-spec-proposed` §7 のガント不採用決定と**明示**。
  - est(impl) 見積活動自体の R-E2b ノード化判断が §7 未記録 → 「est(impl) 見積活動自体は畳む（活動ノード化しない）」確定決定を**追記**。
  - 「見積なし」が EstimateState 列挙に対応値なし → §5 e050 注に「`latestEstimate=null`（ProjectedNode）・estimateState とは独立軸」と**接地**。

## 生ログ(該当範囲)

- **あなた**: 既存ドラフト `estimate-impl-agreed`（draft）を kiro-scenario の確定ゲートで agreed まで昇格。役割は背骨での要（見かけ 100%→実装ノード発見で分母拡大→達成率 44% へ正直に低下）。攻撃で必ず検証させる接地点：二段 decompose・EV% 非単調正直化・実装ノード未実装・P2/EV% 対読み。本セッションは estimate-impl-agreed.md のみ触る（他ユニットは別セッション並行）。
- **Claude**: 計画・README・対象ユニットを読み、§3 が前段セッションの人間由来であることを確認。MODEL/specs/参照実装で 23 引用を現物照合（全支持）、数値チェーンを検算。一次資料セットを AskUserQuestion で確認。
- **あなた**: （AskUserQuestion）この資料セットで確定。
- **Claude**: doc-adversary 3体（G1-G4＋SC1-SC7）を並列派遣。Critical 3（draft 足場残存）・Important 5・FORK 2件（§7(d)/§7(c)）を抽出。MODEL 矛盾なし。
- **Claude**: doc-fact-checker を派遣（トレース ID・MODEL 引用・型/fixture・skill 名）＝NO_OBJECTION、並行して 2 FORK を AskUserQuestion でユーザーへ。
- **あなた**: （AskUserQuestion）§7(d)=切り出さない（起点注記のまま確定）／§7(c)=境界宣言として確定。
- **Claude**: 著者コンテキストで Critical 3・Important 5 をパッチ（draft 注記除去・§7 再構成・畳む分岐数値・During 因果明示・前段明示・est(impl) 畳み決定・型接地）。
- **Claude**: doc-gate-judge を派遣＝**PASS**（生存 0・FORK 全解決・ソース確定・数値整合）。status を agreed に確定、本会話ログを記録。
