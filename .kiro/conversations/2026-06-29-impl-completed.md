---
created_at: 2026-06-29T00:00:00Z
title: 受け入れシナリオ単位 impl-completed（背骨終端・唯一 feature が accepted に到達）を人間発案の §3 から起こし敵対者ループで agreed 化
bindings:
  - { kind: scenario, id: "units/impl-completed" }
  - { kind: scenario, id: "units/estimate-impl-agreed" }
  - { kind: design-decision, id: "feature-completion-explicit-human-signoff" }
  - { kind: design-decision, id: "impl-node-assignment-after-agree-before-exec" }
source: claude-code-session
---

## 要約

- **論点**: 背骨フロー（discovery〜実装完了）の**終端ユニット** `impl-completed` を作る。これは鏡像元のない新規ユニットで、§3（ふるまい）の発案（0→1）は人間が行う必要がある（AI が originate すると外的妥当性が崩壊する＝kiro-scenario ガードレール）。precondition は `estimate-impl-agreed` の postcondition（実装・実装レビューが見積合意済み・pending、全フェーズ accepted、EV% 44%）を継承し、postcondition は「実装＋実装レビューが implementing→implemented→accepted、達成率 44→100%（本物）、feature（F）が accepted＝背骨で唯一 F が accepted に到達」。
- **進め方（重要）**: seed-and-stop（種テンプレ＋論点①〜④の引き継ぎメモを出力して停止）→ ユーザーが §3 発案 → 接地→描画→敵対ループ→ゲートで agreed。
- **§3 の人間発案（忠実転記・ユーザー批准済み）**:
  - kiro-impl 打鍵 → AI が作業分解リストに沿って実装 → 完了で implemented → ここで玉が人間へ → 人間がレビューして承認 → 承認時点でレビューも完了 → 子が全完了したら F も完了。
- **織り込んだ論点①〜④**:
  - ① 実装ノードの担当割当（接続ギャップ）= **ユーザー裁定「見積を agree した後・実行を指示する前に、開発とレビューの担当を割り当てる」**。§3 は kiro-impl から始まるので、割当は §3 に足さず「前提を生む起点イベント e060–e062」として §2/§5 に置き、`assign-spec-provisional` が実装ノードを扱わない接続ギャップを §7 で正直に開示。
  - ② 複数実装ノードの並行完了 → §4 During で実装-1・実装-2 を並行 implementing として描く。
  - ③ 実装レビューは両実装の完了後に着手（依存辺2本）→ review-impl は実装-1・実装-2 がともに implemented で ready。
  - ④ kiro-validate-impl 連携は射程外。
- **決定（接地）**:
  - **達成率の弧 44→72→93→100**: EV_abs は `implemented`∨`accepted` かつ合意済みで獲得（ev.ts `COMPLETED`）。実装-1 implemented で +8（72%）、実装-2 で +6（93%）、実装レビュー作業 implemented で +2（100%＝本物）。承認（accepted）・F 完了は EV を足さない。
  - **F（フィーチャー）完了 = 人間の最終承認イベント（ユーザー裁定）**: 参照実装 `fold.ts` は `n.lifecycle = ev.to` で親の lifecycle を子から自動導出しない。よって F の完了は明示の人間 `transition`（pending→accepted の最終サインオフ）。完了判定の中核は「子9葉が全 accepted」で、達成率100%・実行カバレッジ0% は随伴信号。MODEL §2.5（全ノード一様適用）＋Req5 AC6（合法性非 enforce・skip 記録）＋§2.7（feature の accepted を前提）＋A2（イベント駆動・自動ロールアップなし）が併せて「許容された明示の人間遷移」として支持＝MODEL 変更不要・**ESCALATE 不要**。
  - **一次資料セット**: ユーザーが AskUserQuestion で確定（SOURCE_SET_CONFIRMED）。サーフェスは spec-value＋schedule-time。
- **理由**: ①は前段が実装ノードを割り当てていない接続ギャップを、見積合意後・実行前に正直に埋めるのが妥当（ユーザー裁定）。F 完了の明示イベント接地は、event-sourcing（A2）と fold の非ロールアップ設計に忠実で、MODEL を変えずに正典の許容範囲内で1経路を選択できるため。

### 覆った判断（履歴）

- **当初描画の「F 完了の可視化条件＝達成率100%・実行カバレッジ0%・未完了なし」を是正**: 敵対者B が「達成率100% は accepted/implemented を区別せず完了判定の定義にならない」と指摘 → 完了判定の中核を「子9葉が全 accepted」に置き、達成率100%・実行0% は**随伴信号**へ格下げ（§1(C)/§6(C)/§7）。
- **§7「正典が F 完了を一意に決める」を「許容する（一意化しない）」へ hedge**: 再反論ラウンドで「AC6 が支えるのは"許容"止まりで、著者自身が複数許容経路から pending→accepted を選んでいる」と指摘 → 「許容するが一意化しない・pending→accepted を著者裁定で選ぶ」へ訂正。
- **玉の導出述語 `implementing`∧agent → `{ready, implementing}`∧agent へ是正**: 敵対者C が queues.ts（`ready` を含む）との不一致を指摘 → 述語を是正（§4-2/§7）。
- **review-impl の reviewer 欄を Before/During で「—（fold ゆえ不要）」→「—（未指名）」へ**: 敵対者C が「fold は承認段（e071）で初めて正当化される機構の先取り」と指摘 → 未指名（P0 可視ギャップ）に統一し、fold 説明は承認段/§7 のみに局所化。
- **依存辺「充足＝設計 accepted」→「設計が implemented 到達済み（accepted はその先）ゆえ閾値充足」**: policy=implemented の閾値を accepted にすり替える誤誘導を是正。
- **「背骨で唯一 feature accepted」のスコープを「線形 happy-path フロー」に明示限定**: 分岐ユニット（supersede 等）を反例に取られないようスコープを閉じた。
- **敵対者の3反証（R1 ESCALATE 不要／R2 Before=pending 正しい／R3 EARS は README 準拠）は再反論ラウンドで全て SOUND（覆らず）**。

## 生ログ（該当範囲）

- **あなた**: 新ユニット impl-completed.md の作成を開始。鏡像元が無く §3 は人間が 0→1 発案。まず seed-and-stop して §3 発案を待て。precondition は estimate-impl-agreed の postcondition を継承。論点①〜④を seed に織り込め。
- **Claude**: 計画・README・estimate-impl-agreed・SKILL.ja を読み、HUMAN SEED ガードレールを判定。会話に人間のふるまい発案が無いため、種テンプレ＋①〜④引き継ぎメモを書き出して停止（seed-and-stop）。
- **あなた**: §3 を発案——「kiro-impl を打鍵すると AI がタスク分解リストに沿って実装。完了で implemented。ここで人間玉もち。レビューして問題なければ承認、このときレビューも完了。子が全部完了したら F も完了」。
- **Claude**: §3 に忠実転記し ratify を要請。①担当割当だけ語りに無いので確認。
- **あなた**: §3 は忠実・このまま確定。①は「見積を agree した後・実行を指示する前に、開発とレビューの担当を割り当てるべき」。
- **Claude**: 割当を前提を生む起点イベント（e060–e062）として §2/§5 に置き接続ギャップを §7 で開示する方針を確定。MODEL/types.ts/fold.ts/ev.ts/specs/姉妹ユニットへ接地。fold.ts が親 lifecycle を自動導出しないことを確認し、F 完了の接地を確認すべきと判断。一次資料セットと F 完了の接地（人間の最終承認イベント）を AskUserQuestion で確認。
- **あなた**: 一次資料セットはこのセットで確定。F 完了は「人間の最終承認イベント」。
- **Claude**: 全ユニットを描画（§1〜§7・トレース全列挙）。敵対者ループ：doc-adversary×3＋doc-fact-checker を並列起動。fact-checker は NO_OBJECTION（トレース35件・event 形・数値・fold 非自動導出・precondition 継承すべて CONFIRMED）。敵対者は F 経路（Critical）・EV%100 等値化・玉述語・reviewer 欄先取り・スコープ未閉・依存辺表現等を指摘し、B が「フィーチャー完了規則は MODEL 未規定→ESCALATE」とタグ。
- **Claude**: 修正（F 経路の明示接地・EV%100 を随伴信号へ・玉述語・reviewer 欄・スコープ・依存辺・境界宣言マーキング）＋反証（ESCALATE 不要＝MODEL は沈黙せず Req5 AC1/AC6＋§2.5/§2.7＋A2／Before=pending は ready 状態 vs ready-eligible 述語の別概念／EARS は README 準拠の最小注釈）。反証を再反論ラウンドへ差し戻し → R1/R2/R3 すべて SOUND。再反論者の新規指摘「一意に決める」過剰主張を hedge 修正。
- **Claude**: doc-gate-judge を起動 → **GATE PASS**（生存 Critical/Important = 0・SOURCE_SET_CONFIRMED・FORK 全ルーティング・停止性 ok）。status を draft→agreed に確定。
