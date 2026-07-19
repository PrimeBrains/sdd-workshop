<!--
  fork バッチ（P4 ゲート実行中・HB fork バッチ）テンプレート。**発生時のみ作成する**。
  規範: .kiro/steering/moira-change-management.md（plan moira/plans/2026-07-19-change-management-dfd.md は来歴文書——規範は steering） §1（FQ/FR）・§2 P4 行・§6（HB 行）に準拠。
  moira/changes/issue-N/fork-batch.md として保存。
-->
---
status: working-ledger
issue: {{ISSUE}}
---

# fork バッチ — issue #{{ISSUE}}

<!--
  各行の種別は次のいずれか（steering §6 HB）:
    - genuine-fork（検証ループ内の敵対者が出す・事実だけでは決められない分岐）
    - deviation（意図整合検査で検出された、批准済み意図〔intent-ratification.md〕からの逸脱）
    - re-entry-mini-HA（再入＝未マップ差分 → P2 で影響マップに新行が生えた場合の、新行分だけの
      ミニ HA）

  **即時割込みにしない**: genuine-fork／deviation が出た時点で人間に割り込まず、下流をブロックする
  時点まで溜めてまとめて諮る（バッチ化で認知負荷を緩和する設計。steering §6）。
-->

| ID | 種別 | 対象行（影響マップ行 ID／intent-ratification 行） | 平易文の争点 | 選択肢 | 裁定結果 | 日付 |
|---|---|---|---|---|---|---|
| {{FORK_ID}} | {{KIND}} | {{TARGET_ROWS}} | {{PLAIN_ISSUE}} | {{OPTIONS}} | {{RULING}} | {{DATE}} |

<!-- KIND: genuine-fork | deviation | re-entry-mini-HA -->
<!-- 対象行は必須——どの影響マップ行／どの批准行にこの裁定が適用されるかを ID で示す
     （re-entry-mini-HA は新行の ID、昇格 M はその M 行と元 D 行の ID）。後の意図整合検査・
     閉包対応表がこの列で裁定を行へ決定的に紐づける。 -->

<!-- 裁定結果は、反映して続行する対象（実行計画・影響マップ・意図批准記録のどれに反映するか）を
     明記する。fork の経緯は本ファイルに監査可能な形で残す（H5 で読む義務はない）。 -->
