---
created_at: 2026-06-29T00:00:00Z
title: 既存改修（エンハンスメント）の受け入れシナリオを起こす——superside 手前の launch＋見積 proposed を新規 spec と同型に固定し、§2.7 の正典未規定 nit は開示で延期
bindings:
  - { kind: scenario, id: "units/enhancement-spec-discovered" }
  - { kind: spec, id: "moira-core" }
  - { kind: spec, id: "moira-evm" }
  - { kind: spec, id: "moira-surface-spec-value" }
source: claude-code-session
---

## 要約

- 論点: 新規 spec のシナリオは構築済みだが「既存 spec の改修（エンハンスメント）」のシナリオが無い。discovery で既存改修と判定された時点で、どの spec に修正が入るかが洗い出され、各作業の見積が AI から提示され proposed になる——「spec の修正までのノードが作られ、実装はまだできない」という新規 spec と同じ動きをそろえたい。これを受け入れシナリオ単位に起こす。
- 選択肢（接地・supersede の扱い）:
  - A. supersede 辺を**この段階で張らない**（改修対象は brief に記録・構造的置換は後段）＝再フレーム（軽量）。MODEL は変えない。
  - B. MODEL §2.7(a)/(b) の関係（合成可否・新ノード配置・supersede 生成時期）を `moira-model-update` で裁定してから接地（高コスト・根本解決）。
  - C. §2.7(b) 兄弟型に寄せ、supersede を誕生時に張る（姉妹 requirements-spec-superseded と近接）。
- 決定:
  - **§3（人間のふるまい）を確定**: 既存完了フィーチャー G への改修を立ち上げ → 新エンハンスメント・フィーチャー E が新規 spec と同型に誕生（要件/設計/タスクが見積なしで並ぶ）→ AI が見積案を提示し proposed → 既存 G は一切触らない → 実装ノードは未生成 → 未承認（未確定）。当初 §3 にあった「修正タスク一覧の生成→人間レビュー」は、フェーズノードが新規 spec と同構造で生まれる以上、別建て不要としてユーザーが除外。
  - **対処は A（再フレーム・軽量）をユーザーが選択**。MODEL は編集しない。
  - **ユニット `units/enhancement-spec-discovered`（status: agreed）を新設**。surfaces=spec-value＋activity(新規)。トレース: moira-core 1.5/3.2/4.1/5.1/10.2/11.2・moira-evm 1.2/2.1/3.1/3.3/3.4/4.1・moira-surface-spec-value 1.1/3.1/4.1/4.2/4.3/7.1。
  - **独自価値の正直化**: 本ユニットはイベント上 `discovery-spec-initialized`＋`estimate-spec-proposed` のエンハンスメント版で新機構は導入しない。固有差分は (i)「既存改修」と判定する discovery トリガーの一点で、launch＋proposed 整合・既存不可侵・supersede 手前は**回帰・安全の確認**（回帰シナリオ）と位置づける。
  - **MODEL 未規定 nit は開示で延期**: supersede 生成時期/配置・§2.7(a)(b) 合成・R-D7 "completed" 射程は姉妹（requirements-spec-superseded §7 D2/D3・design-spec-reworked-after-req-redo D3）が既に提起済みの既知 nit。本ユニットは supersede コミット手前で停止するため解決を要さず開示のみ。
- 理由:
  - ユーザーが「MODEL は変えず軽量に」を選好。かつ本ユニットの主題（launch＋見積 proposed・実装まだ・既存不可侵）は supersede が起きる前の断面で、(a)/(b) の正典裁定が無くても描ける（コミット前停止）。
  - 「新規 spec と動きをそろえる」を falsifiable に固定する受け入れ基準としての価値は、固有機構の新規性ではなく回帰確認にあると正直化。

### 覆った判断
- 当初 §7 は「supersede 辺は**実装ノードから・タスク承認後**に張る」を MODEL の含意と断定 → R1 で 2 体の敵対者が独立に Critical 指摘（姉妹 requirements-spec-superseded は**フェーズノード**（要件定義やり直し）から**誕生時**に supersede を張る反例・正典は from ノードの種別/時期を限定しない）→ **断定を撤回**し「コミット前停止ゆえ supersede 辺はこの段階で無い・(a)/(b) 合成等は MODEL 未規定の既知 nit」へ正直化。
- 当初 §7 は独自価値を「(1) append-only で既存不可侵／(2) カバレッジ低下×EV%据え置きの対読み」と掲げた → R2/R3 で「(2) は姉妹 review-work-estimated が描く一般現象でエンハン固有でない／(1) も自明」と Critical 指摘 → **独自価値を (i) 既存改修トリガーの一点に格下げし、(ii)(iii)(iv) は回帰・安全確認として正直化**。
- 当初 §2 は G を「有効葉 4＝要件・設計・タスク・実装」と内訳明記 → R3 で「完了フィーチャーはレビュー作業葉（review-work-estimated・agreed）を持ち実装も複数葉になりうる＝姉妹と矛盾」と Critical 指摘 → **内訳明記を削除し「計 4 葉と置く例示・内訳は主題外」に抽象化**＋現実の G は 4 葉より多い旨を §2 注で開示（数値は簡約例示・質的結論のみ不変）。
- 新 EARS「カバレッジが低い間は EV% を必ずカバレッジ値と同一視野に併記**しなければならない**」→ R3 で「MODEL §2.1（顕著さ制御は提示の自由）を超過」と指摘 → **「EV% を単独で全体完了度として提示してはならない（併記様式は提示の自由）」へ緩和**。

## 生ログ（該当範囲）

- **あなた**: 新規 spec のシナリオは構築中だが、既存 spec の改修になるシナリオが作れていない。discovery で既存改修となったら、その時点でどの spec に修正が入るかが洗い出される。修正タスク一覧が生成され、spec への修正はレビュー必須なのでレビューノードも生成される。各作業の見積が AI から提示され proposed になる。ここまでをシナリオにしたい。新規 spec のときと動きをそろえ、いったん spec の修正までのノードが作られて実装はまだできない、としたほうがよい。
- **Claude**: §3（ふるまい）を転記し確認。接地調査の結果、(1) 既存改修＝MODEL §2.7 エンハンスメント、(2) cc-sdd 非依存で「修正タスク一覧」は Moira の decompose（フェーズノード）に乗る、と整理。
- **あなた**: 「どの spec に修正が入るかが洗い出される」は discovery の仕様だっけ？ cc-sdd 依存にしたくない。修正タスクが分解されていなければ tasks.md 的なものを生成し人間がレビューする流れにしたい。
- **Claude**: 現行 MODEL に「discovery が既存改修対象を特定する」明示規定は無い→シナリオで描くべきふるまい。フェーズノード（§2.6）に乗せ cc-sdd 非依存に。§3 を改訂提示。
- **あなた**: エンハンスメントの要件/設計/タスクのフェーズノードが生まれるなら、「修正タスク一覧の生成→人間レビュー」は考慮しなくていいかも（新規 spec と同構造ゆえ別建て不要）。
- **Claude**: §3 を確定（修正タスク一覧/レビューの別建てを除外）。接地の核心発見＝supersede 辺（新→旧）は改修を行う新ノードから張られ、その新ノード（実装）はタスク承認後の二段 decompose で生まれる→「実装まだ」段階では supersede 辺はまだ張られない、と判断。EV% 据え置き×カバレッジ低下の対読みが distinct と提示。一次資料セットをユーザー確定（SOURCE_SET）。
- **Claude**: ユニットを draft で描き起こし、doc-adversary×3 を並列起動。
- **Claude（R1 結果）**: 2 体が独立に収束 Critical＝「supersede は実装ノードから・タスク後」断定は MODEL 未接地（姉妹はフェーズノードから誕生時に張る反例）。かつ §2.7(a)/(b) 関係は正典未規定の既知 nit。ESCALATE 候補としてユーザーに判断を要求。
- **あなた**: 再フレーム（軽量・推奨）。MODEL は変えず §3 も変えない。
- **Claude**: §7 の supersede 根拠を「コミット前停止＋既知 nit 開示」に正直化（断定撤回）。他 Important（G 葉数の簡約開示・トレース追加・EARS 観測可能化）もパッチ。R2＝事実検証 NO_OBJECTION ＋再攻撃×2。再攻撃 B が独自価値の過剰主張を Critical 指摘。
- **Claude**: 独自価値を「回帰シナリオの位置づけ・(i) のみ固有・(ii)(iii)(iv) は回帰/安全確認」へ正直化。(a)/(b) 判定軸・R-D7 nit を追記。R3＝最終再攻撃で G 葉数内訳の矛盾（Critical）。
- **Claude**: G を内訳非明記の簡約に抽象化＋hedge 強化、EARS 緩和、独自価値の 3 断面を §3 忠実性で正当化。doc-gate-judge＝**PASS**（生存 Critical/Important = 0）。status を agreed に確定し本会話ログを保存。
