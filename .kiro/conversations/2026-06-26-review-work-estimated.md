---
created_at: 2026-06-26T00:00:00Z
title: レビュー作業ノードの見積もりは計画段階で提案・合意する受け入れシナリオを確定（review-work-estimated）
bindings:
  - { kind: scenario, id: "units/review-work-estimated" }
  - { kind: scenario, id: "units/estimate-spec-proposed" }
  - { kind: scenario, id: "units/estimate-spec-agreed" }
  - { kind: scenario, id: "units/requirements-spec-returned" }
  - { kind: spec, id: "moira-core" }
  - { kind: spec, id: "moira-evm" }
  - { kind: spec, id: "moira-surface-spec-value" }
source: claude-code-session
---

## 要約

- **論点:** レビュー作業ノード（MODEL §7#18(b) の A1 通常作業ノード）の見積もりを、**いつ・誰が**行うか。当初は「AI が requirements.md を作成した後（レビュー依頼時）に提示」と想定したが、ユーザーが「もっと早い段階、要件に入る前のタイミングで、レビューまで含めて見積もっておくべき」と是正。
- **選択肢:**
  - A. レビュー時にレビュー作業ノードを立てて見積もる（requirements-spec-returned の e070–e072 の経路）
  - B. **計画段階（フェーズ見積と同じタイミング・着手前）に、レビューまで含めて一括で見積案を提示し、人間が議論・合意する**
- **決定:** **B**。本ユニット `review-work-estimated` を新設。計画段階で各フェーズ（要件定義・設計・タスク）に対応するレビュー作業ノードを feature の子として一括追加し、見積案を proposed で提示 → 人間が議論 → 一括合意（agreed）。P2（見積カバレッジ・葉基底）は追加時に 100%→50% へ低下（§2.3 発見信号）、合意で 100% に回復。
- **理由:** レビュー工数も「実際に手を動かす成果物の見積もり」と同様、計画段階で人間がコミット判断すべき対象。実レビュー開始時に「想定より重い」と感じた際の再見積もり（R-E3）経路は存在するが、すでに計画段階で一度合意が取られているのが正しい——という人間意図に整合。

### スキル化の方針（ユーザー提起）
- ユーザーは「会話で都度直すのでなく、スキルにしないと正しく動かない可能性」を提起。
- 合意した進め方：**まずシナリオで「何が正しいか」を定義 →（agreed 後に）kiro-spec-* スキルのステップとして組み込む**。スキル化は本シナリオ確定後の別タスク。

### 検証ループ（kiro-scenario Step 4）の結果
- **doc-fact-checker:** VERDICT=NO_OBJECTION（全34主張裏取り。イベント型・MODEL 条項・P2 数値・frozenBudget 算術・トレース全 ID・前段ユニット接続・パス実在すべて CONFIRMED）。
- **doc-adversary:** Critical/Important 級を指摘。#5/#14 は敵対者自身が理由付きで取り下げ。実体 Important 9 件をパッチで解消（下記「覆った判断」参照）。
- **doc-gate-judge:** 内容面 SURVIVING Critical/Important = **NONE**（2 ラウンド確認）。手続き要件（SOURCE_SET_CONFIRMED・FORKS_ROUTED）は、サブエージェントが主会話のツール結果を witness できない構造的制約から採点者側では NO 判定。これらは主コンテキストが AskUserQuestion でユーザーに直接確認した記録（本会話）で充足し、CONFIRM 条件を満たすと判断して確定。

### ユーザーに回した FORK（AskUserQuestion・全て推奨案で確定）
1. **一次資料セット:** MODEL.md 諸条項・types.ts・moira-core/evm/surface-spec-value requirements・前段ユニット 3 件 → 「このセットで確定」。
2. **スコープ境界:** 「happy path に限定」（見積拒否・部分合意・実レビュー開始時の再見積は別ユニットへ）。
3. **reviewer 扱い:** 「別物として明示・未指名前提」（moira-core Req6 6.4/6.6 をトレース追加、§2 前提で reviewer 未指名）。

### 覆った判断（履歴）
- **当初の §3 転記「AI が requirements.md 作成後（レビュー依頼時）に見積提示」→ 覆し**：ユーザー是正により「計画段階（着手前）に一括見積」へ。タイミングを前倒し。
- **§3「合意済みになった時点で…カバレッジの**分母**に入る」→ 訂正**：敵対者 #7 が MODEL P2（葉基底）と矛盾を指摘。分母には proposed 時点で入り、合意で入るのは分子。人間意図（合意でカバレッジが回復する）を保ったまま「見積もり済みとして数えられ…カバレッジが回復する」へ精緻化。
- **reviewer の前提状態を未記載 → 補完**：敵対者 #17 を承け、前提で「reviewer 未指名（指名有無で振る舞い不変）」を明示。
- **policy=implemented の逸脱が §5 注のみ → §7 決定へ格上げ**：敵対者 #6。
- **見積拒否 boundary 未宣言・write skill 継ぎ目が §5 注のみ → §7 決定へ明示**：敵対者 #9/#13。

## 生ログ(該当範囲)

- **あなた**: （requirements-spec-returned を参照しつつ）レビュー中のところでレビュー作業が新規ノードとして追加されている。このノードの見積もりをいつ誰がやるのかを明確にするシナリオを作りたい。おそらく AI が requirements.md 作成後に「レビューお願いします」となるので、そのタイミングで新規ノードを追加し見積もりを提示する（proposed）。人間が議論して合意した段階で agreed になる。これをシナリオにしたい。ここはスキルにした方がいいかもしれないが、どう思うか。
- **Claude**: スキル化は妥当だが順序として、まずシナリオで「何が正しいか」を定義し、その後 kiro-spec-* のステップに組み込むのが安全。シナリオ先行を提案。
- **あなた**: （estimate-spec-proposed を参照し）思ったが、要件定義や設計タスクに先立ってまず見積もりを行う。その見積もりは2つあり、AI が成果物を作る工数と、レビューの工数。レビュー工数こそこのタイミングで人間が決めたい。もっと早い段階、要件に入る前にレビューまで含めて見積もっておくべき。実レビュー時に「重い」と感じて修正するシナリオも考えられるが、すでにこの段階で一度合意が取られているのが正しい。
- **Claude**: 了解。§3 を「計画段階で AI がフェーズ見積案と並べてレビュー作業ノードを子ノードに立て、レビュー工数の見積案を proposed で提示 → 人間が議論し合意で agreed → 合意でカバレッジ回復。実レビュー時の再見積は別ユニット（boundary）。レビュー見積と reviewer 指名は別物」へ転記。読み返しを依頼。
- **あなた**: この転記で確定。
- **Claude**: 一次資料に接地しユニットを描き起こし、doc-adversary / doc-fact-checker を並列派遣。fact-checker は NO_OBJECTION、adversary の実体 Important 9 件をパッチ。doc-gate-judge は内容 SURVIVING=NONE だが手続き記録（一次資料確定・FORK ルーティング）の現物を要求し FAIL。
- **Claude**: 手続き要件を満たすため AskUserQuestion で一次資料セット・スコープ境界・reviewer 扱いを確認。
- **あなた**: （AskUserQuestion）一次資料=このセットで確定／スコープ=happy path に限定／reviewer=別物として明示・未指名前提。
- **Claude**: 3 条件（生存 0・SOURCE_SET_CONFIRMED・FORKS_ROUTED）充足。status を agreed に確定、本会話ログを記録。
- **あなた**: requirements-spec-returned の同期。
- **Claude**: 同期パッチ適用（下記「## 追補」）。focused 検証（事実検証 6/7 CONFIRMED・敵対 Critical はいずれも派遣時点の旧版読みで修正済み）、新規 FYI（review-work-estimated の e071 相互参照の陳腐）も是正。

## 追補：requirements-spec-returned 同期（2026-06-26）

- **論点:** review-work-estimated の agreed（計画段階で前倒し見積・合意が正規経路）を承け、既存 agreed ユニット requirements-spec-returned をどう同期するか。旧版はレビュー作業ノードの誕生・依存辺・見積合意（旧 e070–e072）を「太郎がレビューに入る時点」に置いていた。
- **決定（requirements-spec-returned への変更・agreed 後の改訂）:**
  - レビュー作業ノードの誕生・依存辺・見積合意（旧 e070–e072）を**前提（計画段階で実施済み＝review-work-estimated の e040–e046）**へ移し、§5 JSON は実行の e073–e075（着手→完了→差し戻し）のみに。
  - §2 前提表にレビュー作業ノード行（agreed・1人日・ready・未着手）を追加。
  - **Before 出来高 EV% を 30%→27% に是正**（EV_abs 3 / 見積総和 3+5+2+1=11。レビュー工数が計画段階で既に分母算入）。During の旧「30→27 希釈」説明を削除し During は 27% で変化なし。**After 9% は旧版が既にレビューノードを木に含めて算出済みゆえ不変**——同期前は Before(30%・ノード不在) と After(9%・denom 11) が不整合だった点が、本同期で Before(27%・denom 11) に揃って解消。
  - §7 に同期の決定バレットを追記、波及（drafted・assign-spec-provisional 等の同期）を follow-up として明示。
- **理由:** review-work-estimated §7 が「requirements-spec-returned の同期は agreed 後に別タスク」と予告した、その実行。計画段階前倒しを正規経路とした以上、レビューノードの誕生は前提に属し、本ユニットは実行のみを描くのが正しい。
- **覆った判断:** （旧 requirements-spec-returned）Before 30%・「太郎がレビューに入る時点でノードを立てる」→ Before 27%・「ノードは計画段階で既存」へ。
- **review-work-estimated 側の付随修正:** §7 の「先例＝requirements-spec-returned.md e071」（除去された ID への参照）を是正、「同期済み」へ更新。
- **検証:** doc-fact-checker＝6/7 CONFIRMED（残 1 は派遣時点の旧版読みで既修正）、doc-adversary＝Critical 2・Important 1 はいずれも派遣時点の旧版（30%/希釈）読みで修正済み、新規 FYI（e071 相互参照）を是正。grep で 27%→27%→9% の一貫と旧記述ゼロを確認。

