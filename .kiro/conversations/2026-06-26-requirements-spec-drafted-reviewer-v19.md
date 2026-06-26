---
created_at: 2026-06-26T19:40:00Z
title: requirements-spec-drafted の ⚠ 解消と reviewer（指名レビュー担当＝太郎）概念の正典化（MODEL v19）、シナリオを agreed へ確定
bindings:
  - { kind: scenario, id: "units/requirements-spec-drafted" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: requirement, id: "moira-core: Req6 AC4-6" }
  - { kind: requirement, id: "moira-schedule: Req13, Req14" }
  - { kind: requirement, id: "moira-surface-spec-value: Req10, Req11" }
  - { kind: requirement, id: "moira-surface-schedule: Req3, Req13, Req14, Req15" }
  - { kind: design-decision, id: "reviewer-as-attribute-not-ball-holder" }
source: claude-code-session
---

## 要約

- 論点:
  1. requirements-spec-drafted シナリオに残る ⚠（赤字 TBD）を、設計の宿題ではなく「定義済み要件への参照」へ昇格して解消したい。
  2. 「誰がレビューするか（レビュー担当＝太郎）」を、作業者（assignee＝Claude）とは別に per-node で画面表示したい。玉が AI→人間へ移ったとき、作業者は Claude のまま「次にレビューするのは太郎」と全員に見える表現が要る。

- 選択肢（レビュー担当の表現）:
  - A. assignee を「ball-holder＝現在の手番」に再定義し、implemented で太郎へ張り替える。
  - B. reviewer を assignee とは別軸の付帯属性として新設する（単一・latest-wins・人間限定・平準化/EV/PV/coverage 非消費）。

- 決定:
  - 選択肢 **B** を採用。reviewer を transition の付帯属性として MODEL に追加し、独立敵対ゲート（moira-model-update）を PASS して **MODEL v18→v19** に正典化。
  - シナリオ側は全 ⚠ 赤字を「(要件: …Req N)」参照＋中立な「(スライス未描画)」へ置換。§3（When/Then）は一字も変更せず（不可侵）。§4-1/§7 で「人間の見立て 50% → 正典 30%（葉基底 3/(3+5+2)）」のズレを接地。
  - 4 spec に要件追記（core Req6 AC4-6／schedule Req13・14／surface-spec-value Req10・11／surface-schedule Req3 AC4・13・14・15）。reviewer? を types.ts に追加、fold.ts に latest-wins 畳み込み（additive・全 46 backend テスト緑）。
  - doc-gate-judge（独立採点者・opus）が「反論されない Critical/Important = 0」で **PASS**。一次資料セット（MODEL v19・4 spec・参照実装 types/fold/leveler/queues/ev/coverage）をユーザーが確定（SOURCE_SET_CONFIRMED）。シナリオ status を in-review → **agreed**。

- 理由:
  - reviewer は lifecycle と無関係な「次にレビューする人」の指名であり、assignee（leveler が平準化消費する作業者）とは消費プロファイルが異なる。別軸にすることで、玉（手番）は lifecycle から導出（actor 非依存・queues.ts）したまま、レビュー担当だけを per-node 指名で重ねられる。
  - ⚠ を消すのではなく「定義済み要件への目標」と「スライス未描画」に二分することで、シナリオが現スライスの未実装に縛られず「要件としてどうあるべきか」を述べられる。

### 覆った判断

- **選択肢 A（assignee=ball-holder）を却下**。moira-adversary の独立敵対ゲートで以下が露見したため:
  - leveler.ts は assignee を lifecycle と無関係に平準化消費する。implemented で assignee を太郎へ張り替えると、完了作業分の容量を太郎へ誤消費し P7／会計を汚染する。
  - humanReviewQueue は actor 非依存の導出のため、assignee を張り替えても「太郎」は出てこない（キュー導出には効かない）。
  - §2.1#2 の自動割当禁止に抵触する（implemented を引き金に自動で担当を張り替えることになる）。
  - 姉妹ユニット agreed の「担当≠玉」とも矛盾する。
- **「§3 の『50% くらい』を削除すべき」という Critical を却下**。§3 は人間が発案した不可侵の種であり、当該文は「（※開発者の見立てでは『50% くらい』。実際は §4/§7 で接地）」と明示ラベル付き。§4-1/§7 が「50% でなく 30%」と正典接地済みで、本ユニットの主眼が「見立て 50%→正典 30% のズレを炙る」外的妥当性検証ゆえ、50% 削除は §3 不可侵違反かつ検証主旨の消失になる。doc-gate-judge がこの反証の健全性を裁定し PASS。

## 生ログ（該当範囲）

- **あなた（前セッションからの引き継ぎ）**: requirements-spec-drafted を「⚠ ゼロ＋レビュー担当（太郎）を per-node 表示」まで仕上げたい。レビュー担当の表現は Option B（reviewer を assignee と別の付帯属性で持つ）で。
- **Claude**: Option A（assignee=ball-holder）は leveler.ts の平準化消費・humanReviewQueue の actor 非依存・§2.1#2 自動割当禁止・agreed の「担当≠玉」と矛盾するため敵対ゲートで却下。Option B で reviewer を transition 付帯属性（単一・latest-wins・人間限定・leveler/EV/PV/coverage 非消費）として MODEL に追加し、moira-model-update の独立敵対ゲートを PASS して v18→v19 に正典化。types.ts に reviewer? 追加、fold.ts に latest-wins、4 spec に要件追記、シナリオの全 ⚠ を要件参照＋「(スライス未描画)」へ置換。§3 は不変。
- **Claude**: 最終ゲートとして doc-gate-judge（opus・独立採点者）を起動。唯一の Critical「§3 に 50% 残存」は §3 不可侵＋§4/§7 接地で反証 → 健全性を裁定させ **PASS**。backend 46 テスト緑を再確認（reviewer は additive）。
- **あなた**: 一次資料セット（MODEL v19・4 spec・参照実装）を確定する（agreed へ）。
- **Claude**: SOURCE_SET_CONFIRMED。シナリオ status を in-review → agreed に更新し、本会話ログを記録。
