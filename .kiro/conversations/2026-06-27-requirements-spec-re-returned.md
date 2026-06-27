---
created_at: 2026-06-27T00:00:00Z
title: requirements-spec-re-returned（二度目のレビュー差し戻し）を作成。レビュー作業行のEVは据え置き・新行なし・ACだけ増えてCPI悪化、をMODEL §7#18(b)/R-S3へ接地し敵対ゲートでagreedへ
bindings:
  - { kind: scenario, id: "units/requirements-spec-re-returned" }
  - { kind: scenario, id: "units/requirements-spec-returned" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: design-decision, id: "second-review-folded-no-new-node-no-ev" }
  - { kind: design-decision, id: "folded-review-cost-attributes-to-reviewed-node-§7#18(b)(iv)" }
  - { kind: design-decision, id: "rs3-carveout-by-itself-not-invisibility-of-repeated-returns" }
  - { kind: spec-gap, id: "moira-evm Req11.2 未反映: 畳んだレビュー作業 carve-out" }
  - { kind: requirement, id: "moira-core: Req3 AC4-5, Req5, Req6" }
  - { kind: requirement, id: "moira-evm: Req1, Req2, Req9, Req11" }
  - { kind: requirement, id: "moira-surface-spec-value: Req1, Req3, Req5, Req10, Req11" }
  - { kind: requirement, id: "moira-schedule: Req3, Req4, Req13, Req14" }
  - { kind: requirement, id: "moira-surface-schedule: Req2, Req8, Req3, Req13, Req14, Req15" }
source: claude-code-session
---

## 要約

- 論点（ユーザー発案・§3 の種）:
  `requirements-spec-returned`（太郎の初回差し戻し）の後、Claude が指摘対応で要件定義を再作成し再びレビュー待ちにした状態で、**太郎が二度目のレビューを行い再び差し戻す**ふるまいを確かめたい。ユーザーの想定：(a) 人間のレビューの行はもう EV 100% なのでそれ以上増えない、(b) 二次レビューの行も増えない、(c) 単純に AC だけが増えて CPI が悪くなる、(d) Claude 担当の要件定義の行の EV がまた 0 に戻り、差し戻しログが出る。「この動きで合っているか」＋シナリオ化の依頼。

- 確認結果（接地）: ユーザーの想定 (a)–(d) はすべて MODEL v19 と整合。正典上の根拠：
  - (a)(b) **二度目以降のレビューは畳む（fold）**——MODEL §7#18(b) の「軽微なら畳む」P0 判断。新作業ノードも EV も増えず、レビュー作業ノードの lifecycle も動かない。
  - (c) AC だけ増え CPI 悪化——CPI = EV_abs/AC（MODEL §3・moira-evm Req 9.2）。出来高を伴わない AC 増は CPI を悪化させる。
  - (d) 要件定義 EV 3→0——初回と同じ `implemented→implementing` の P5 後退（二値）。
  - EV% は 32%→8%（初回差し戻し後と同値だが AC が大きい＝CPI が悪い）。これが「同じ達成率でも繰り返し差し戻しを CPI で区別できる」中核。

- 決定（§7 へ記録）:
  - **二度目以降のレビュー＝畳む**（新ノード/EV なし）。MODEL §7#18(b)。
  - **畳んだレビュー cost は被レビューノード（要件定義/F/req）に帰属**（§7#18(b)(iv)）。§3 の「AC だけが増えて」は、レビュー作業行でなく要件定義ノードへ AC が積み上がる形で実現（観測される結論は §3 のとおり）。
  - **`cost` イベントは `reason` を持たない**（types.ts `CostEvent` = kind/node/amount）。
  - **人間レビュー待ちキューは actor 非依存・導出 2 件**（要件定義＋レビュー作業の implemented 2 葉）、提示層は二次を畳んで 1 件に底打ち可（§7#18(b)(viii)）。
  - **R-S3 carve-out は各回の畳み cost を「単独で」免責するだけ**で繰り返し差し戻しを不可視化しない。差し戻しが続けば要件定義ノードは EV 非増のまま AC が sustained window で積み上がり正当に thrashing/at-risk になりうる（§3 が狙う正直な信号）。
  - **【残課題】moira-evm Req 11.2 は畳んだ見積活動（R-E2b）の carve-out のみ明記、畳んだレビュー作業（§7#18(b)(v)）が未反映**——spec 改訂が別タスク（MODEL 正典側の欠陥ではないため `moira-model-update` 委譲は不要）。

- 理由: §3 の人間意図を不可侵に保ちつつ、AC の帰属先・キュー件数・carve-out の射程という「正典に従うと §3 の素朴な像と細部が違う」3点を §4–§6 でグラウンディングし、§7 と §5 注で開示した。これにより「観測される結論は §3 のまま・内部表現は正典のまま」を両立。

## 覆った判断（敵対ループで是正）

3体の `doc-adversary`（G1–G4＋SC1–SC7）が出し、著者がパッチで塞いだもの（`doc-gate-judge` 現物照合で PASS）:

- **C1（全3体・Critical）**: §6 EARS「出来高（EV）を動かさ**なければならない**」が意図と逆転 → 「動かし**てはならない**」へ訂正。
- **C2（Critical）**: frontmatter `moira-evm: 11.2` が folded review carve-out を指すが Req 11.2 は folded estimation のみ → 正典根拠を MODEL R-S3＋§7#18(b)(v) に付け替え、spec-MODEL gap を §5/§7 に開示。
- **I1（Important）**: §5 cost イベントに `CostEvent` に無い `reason` → 削除、根拠を注へ。
- **I2（Important）**: レビュー作業ノードの lifecycle 不変を課す EARS 欠落 → §6 に追加。
- **I3（全3体・Important）**: §2「人間レビュー待ちキュー 1 件」が actor 非依存導出と矛盾 → 「導出 2 件・提示層は畳んで隠してよい」へ訂正（§2/§4-2 Before）。
- **I4（Important・FORK）**: R-S3「一度きり」と §3「三度目以降も同じパターン」の緊張 → MODEL R-S3 本文（"by itself"＋"sustained window"）から一意に決まりグラウンディングで決着（carve-out は単独免責のみ・繰り返しは不可視化しない）。
- **I5（Important）**: 未実装スキル標識欠落 → §3 注に書き込み側 `moira-progress`（仮称・⚠）明記。
- **追加是正**: §4-1/§4-3 が二度目レビュー工数を「レビュー作業行の AC」に加算していた内部不整合を、§7#18(b)(iv)「被レビューノードに帰属」へ訂正。

検証ループ: doc-adversary×3（並列・独立）→ 一次資料は MODEL/specs/types.ts を著者が現物照合（全主張 CONFIRMED）→ 著者パッチ → doc-gate-judge 現物照合 **PASS**（生存 Critical/Important = 0、SOURCE_SET_CONFIRMED、未ルーティング FORK なし）。status を draft → **agreed**。
