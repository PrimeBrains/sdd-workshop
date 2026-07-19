<!--
  意図批准記録（P3 ルーティング裁定・HA 前半集約セッション の出力）テンプレート。
  規範: .kiro/steering/moira-change-management.md（plan moira/plans/2026-07-19-change-management-dfd.md は来歴文書——規範は steering） §2 P3 行・§3（クラス別 HA/HB 規律）・
  §6（HA の内容④・意図整合検査の主体）に準拠。
  この記録が P4 各ゲートの「意図整合検査」（批准記録 ↔ 最終ドラフトの突合。著者≠検査者）の
  基準になる。要約は issue コメントにも残すこと（steering §6・§7）。
  moira/changes/issue-N/intent-ratification.md として保存。
-->
---
status: working-ledger
issue: {{ISSUE}}
---

# 意図批准記録 — issue #{{ISSUE}}（HA 前半集約セッション）

<!-- HA の 5 判断（①影響マップ確認・②境界裁定・③When/Then 発案・④M/D/P 意図批准・⑤実行計画承認
     ＋一次資料セット確定）をすべてこのファイルに確定記録する（steering §6 HA①〜⑤）。
     この記録の全体が P4 各ゲートの意図整合検査・fork 被覆監査の基準になる。 -->

## ① 影響マップ確認

<!-- 人間断面ビュー（impact-map.md）を提示し、「はねる先はこれで全部か」の確認を得る。 -->

- 確認: {{YES_NO}}（{{DATE}}）
- 指摘・追加された波及先: {{MAP_FEEDBACK}} <!-- なし | 追記行の ID -->

## ② 境界裁定

<!-- 境界不明瞭行（既定ルート D でも迷いが残ったもの）の裁定。無ければ「なし」。 -->

| 行 ID | 争点（平易文） | 裁定 | 日付 |
|---|---|---|---|
| {{ROW_ID}} | {{BOUNDARY_ISSUE}} | {{RULING}} | {{DATE}} |

## ③ S 級 When/Then の発案（該当する場合のみ記入）

<!--
  steering §3 S 行・§6 HA ③: When/Then の人間発案は**新規シナリオのみ**。既存 unit の変更は issue に
  人間が verbatim で書いた記述を発案として扱い、AI が転記・改稿する（issue が機械起票等で人間の
  ふるまい記述を含まない場合のみ、ここで新規に聞く）。S 行の意図批准はこの When/Then 確定が兼ねる。
-->

{{WHEN_THEN_NOTE}}

## ④ 意図批准（M/D/P 対象行）

<!--
  M/D/P 各行ごとに記入する。仕分け規律は steering §3・§6 のとおり:
    - D は (a) 責任・帰結・ドメイン意味の判断＋(a)/(b) 混合 のみ HA 対象。(b) 純工学判断は
      doc-refine 技術ゲートで確定し、プロダクトオーナーのレビュー対象にしない。
    - P は プロパティ「一文」の意図批准のみ。PBT 実装（②）・生成器/shrinker（③）は HA 対象外
      （敵対的構成レビュー等、正典側のゲートが担う）。
    - M は MODEL 条項文の直接レビューを求めない——D/P/S 粒度の平易文（判定文・一文・ふるまい例）
      へ翻訳して諮る。正典文面への忠実反映は敵対ゲート（moira-model-update の doc-fact-checker 等）
      ＋意図整合検査が担う。
-->

| 行 ID | 対象クラス | 何を決めるか | 受け入れ基準 | 却下したい方向 | 批准 | 日付 |
|---|---|---|---|---|---|---|
| {{ROW_ID}} | {{M_D_P}} | {{WHAT}} | {{ACCEPTANCE_CRITERIA}} | {{REJECT_DIRECTION}} | {{YES_NO}} | {{DATE}} |

<!-- M 行の注記: 「何を決めるか」「受け入れ基準」の欄は MODEL 条項文をそのまま貼らない。
     D/P/S 粒度の平易文（判定文・一文・ふるまい例）へ翻訳して記す。 -->

## ⑤ 実行計画承認＋一次資料セット確定

<!-- P4 はこの実行計画に従って実行される（HA ⑤ の証跡）。あわせて P4 各ゲートが依拠する一次資料
     セットを確定する——SOURCE_SET_CONFIRMED を要求するゲート（doc-refine・kiro-scenario・
     kiro-scenario-flow）に対する根拠（moira-model-update は一次資料基準を持たないため対象外）。 -->

- 実行計画（経路列・依存順）:
  1. {{STEP_1}} <!-- 例: 行 R1（M）→ moira-model-update -->
  2. {{STEP_2}}
- 一次資料セット: {{SOURCE_SET}} <!-- P4 各ゲートが「正」として引く文書の列挙 -->
- 承認: {{YES_NO}}（{{DATE}}）

## issue コメントへの要約

<!-- この記録の要約（何を批准したか）を GitHub issue コメントに残したことを確認する（steering §7）。 -->

- issue コメント: {{ISSUE_COMMENT_LINK}}
