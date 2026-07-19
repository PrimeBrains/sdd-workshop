<!--
  変更要求票（P1 受付・正規化 の出力）テンプレート。
  規範: .kiro/steering/moira-change-management.md §2 P1 行・§0（入口3種）に準拠
  （triage 裁定の来歴は plan §8-3。plan moira/plans/2026-07-19-change-management-dfd.md は来歴文書——規範は steering）。
  {{...}} を実値に置換する。moira/changes/issue-N/request.md として保存。
-->
---
status: working-ledger
issue: {{ISSUE}}
---

# 変更要求票 — issue #{{ISSUE}}

## 入口種別

<!-- steering §0: (a) GitHub issue／(b) 検出結果起票（decision-conformance の DRIFTED・kiro-scenario-e2e の
     discrepancy 等 → issue 起票して入る）／(c) 会話ベースの変更依頼（→ issue 起票して入る）
     のいずれか一つを選ぶ。 -->

{{ENTRY_KIND}} <!-- issue直 | 検出結果起票 | 会話依頼起票 -->

<!-- (b)/(c) の場合、起票した issue へのリンクをここに添える -->
{{ENTRY_SOURCE_NOTE}}

## 明確化した変更要求文

<!-- 人間の言葉（曖昧さ・省略を含む）を、後段の LLM 処理が迷わない明確な変更要求文に書き起こす。
     原文は書き換えない——ここに書くのは書き起こし後の文であり、原文は issue にそのまま残るため
     情報は失われない。 -->

{{CLARIFIED_REQUEST}}

原文: {{ORIGINAL_ISSUE_LINK}}

## 候補クラス（仮判定）

<!-- steering §3 のクラス（M/D/P/S/C/V/F）。複数クラスに跨る issue は全クラスを影響マップ（P2）に載せる。
     境界不明瞭な issue の既定ルートは D 級（Decision は MODEL 沈黙下の中間状態として有効）。
     既存 MODEL 条項と積極的に矛盾することが最初から明白な場合のみ直接 M。それでも迷うなら HA の
     境界裁定へ送る（§3「境界不明瞭な issue の既定ルート」）。 -->

| クラス | 該当 | 根拠 |
|---|---|---|
| M（MODEL・正典設計物級） | {{Y_N}} | {{RATIONALE_M}} |
| D（設計判断級） | {{Y_N}} | {{RATIONALE_D}} |
| P（プロパティ級） | {{Y_N}} | {{RATIONALE_P}} |
| S（シナリオ級） | {{Y_N}} | {{RATIONALE_S}} |
| C（コード級） | {{Y_N}} | {{RATIONALE_C}} |
| V（検証基盤級） | {{Y_N}} | {{RATIONALE_V}} |
| F（一般確定文書級） | {{Y_N}} | {{RATIONALE_F}} |

## triage 判定

<!-- steering §2 P1（裁定来歴は plan §8-3）: フル工程を回すか、軽量ゆえ本フローを起動せず通常作業に送り出すかを判定し、
     判定理由を一言記録する（kiro-discovery の action-path 方式と同型）。誤判定の網は既存検知器
     （DRIFTED・CI・E2E）が引き受けるため、ここでの判定は最終決定ではない。 -->

判定: {{TRIAGE_DECISION}} <!-- フル工程 | 軽量（本フロー不起動→通常作業） -->
理由: {{TRIAGE_REASON}} <!-- 一言 -->

<!-- 注: 軽量判定の issue には本票を作成しない（台帳ディレクトリ自体を作らない——記録は issue への
     一言コメントのみ）。本票が存在する＝フル工程で受け付けた、を意味する。 -->

## base commit

<!-- 受付時点の commit。以後の全差分検査（P4 各ゲート完了時・P5 開始時）は `diff(base..HEAD)` に
     統一する（steering §2 P1・P5、codex 指摘 R#13 反映）。 -->

{{BASE_COMMIT}}
