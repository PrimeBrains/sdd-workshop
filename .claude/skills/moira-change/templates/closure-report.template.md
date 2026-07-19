<!--
  閉包レポート（P5 同期閉包確認 の出力）テンプレート。
  規範: .kiro/steering/moira-change-management.md（plan moira/plans/2026-07-19-change-management-dfd.md は来歴文書——規範は steering） §2 P5 行・§5（3値判定・未マップ差分・
  検証器一覧）・§6 H5（薄いクローズ承認・読む義務は3点のみ）に準拠。
  先頭 = 人間が読む3点。以降は折り畳み（機械決着詳細）——H5 で人間がここを読む義務はない。
  moira/changes/issue-N/closure-report.md として保存。
-->
---
status: working-ledger
issue: {{ISSUE}}
---

# 閉包レポート — issue #{{ISSUE}}

## 人間が読む3点（H5）

### ① 3面最終文 ↔ 批准済み意図の対応表

<!-- 全行を記載する（抜き取りで確定してよいのは対応表の閲覧側であって、対応表自体は全行掲載——
     steering §6 H5「対応表は全行・原文は気になった行だけ」）。agreed 最終文へのリンクは行ごとに添える。 -->

<!-- 面: S（シナリオ）/ P（プロパティ）/ D（設計判断）/ M-翻訳（M 行の平易文）。flow（通し）由来の
     S 行は「S-flow」と区別する——通し価値は AI 生成度が最も高く、この対応表が生成後本文を人間が
     読む唯一の点（kiro-scenario-flow の正直開示）。 -->

| 行 ID | 面 | 対象 | 批准済み意図（intent-ratification.md ④/③ の行） | agreed 最終文 | 整合 |
|---|---|---|---|---|---|
| {{ROW_ID}} | {{FACE}} | {{TARGET}} | {{INTENT_ROW_REF}} | {{FINAL_TEXT_LINK}} | {{ALIGNED_Y_N}} |

### ② できないことになったこと（平易な差分）

<!-- deferred 行のシナリオ語翻訳（steering §2 P5・§6 H5②）。deferred 行がなければ「なし」とだけ
     書く。ある場合は 1 行 1 deferred で次の形式:
       - 今の機能では〜のシナリオに対応できない〔追跡 #NN〕 -->

{{DEFERRED_DIFF_OR_NONE}}

### ③ 閉包判定

<!-- 影響マップの全行が resolved または deferred（要件充足）で、かつ未マップ差分が空のときのみ PASS。
     1行でも未了があれば FAIL（P4 または P2 へ戻る）。
     **H5（クローズ承認）に諮れるのは PASS のみ**——FAIL の本レポートは差し戻し記録として台帳に残し、
     人間の承認対象にしない（steering §6 H5③）。 -->

**{{PASS_OR_FAIL}}**

---

## 機械決着詳細（折り畳み・H5 で読む義務なし）

<details>
<summary>影響マップ各行の3値判定と証跡</summary>

<!-- steering §5 の検証器一覧（decision-conformance・moira/frontend/e2e/coverage-check.test.ts＋e2e-scenario-checker・
     PROPERTIES.md 被覆表・codex レビュー＋CI・gate inventory 比較 等）に基づく verdict→3値写像の
     結果を行ごとに記す。ALIGNED→resolved 可／UNVERIFIABLE→未了／DRIFTED→未了
     （是正 issue を起票しただけでは状態は変わらない。deferred 要件充足か再照合 ALIGNED のみ resolved）。 -->

<!-- 判定は影響マップの**行 ID 単位**（同一パスの複数義務を混同しない）。 -->

| 行 ID | 波及先 | 状態 | 証跡 |
|---|---|---|---|
| {{ROW_ID}} | {{PATH}} | {{STATE}} | {{EVIDENCE_LINK}} |

</details>

<details>
<summary>未マップ差分検査結果</summary>

<!-- diff(base..HEAD) の changed − mapped。`moira/changes/**` は台帳自身のため自己除外（steering §5・
     moira/changes/README.md）。照合中に HEAD が動いた場合は判定無効・再実行（steering §2 P5）。 -->

- base commit: {{BASE_COMMIT}}（request.md 記載の受付時点 commit）
- HEAD（P5 開始時点で固定）: {{HEAD_COMMIT}}
- 未マップ差分: {{UNMAPPED_DIFF_RESULT}} <!-- 空（PASS 要件を満たす） | 非空（一覧して P2 へ差し戻し） -->
- 判定有効性: {{VALIDITY_NOTE}} <!-- 照合開始から終了まで HEAD が動いていないことの確認 -->

</details>

<details>
<summary>deferred 行の後続 issue openness（機械照合証跡）</summary>

<!-- `gh issue view` による機械照合。人間の確認義務にしない（steering §5・§6 H5——「issue#・owner・
     再評価条件・openness の帳簿は読まない」）。 -->

<!-- 「open で生きている」＝ gh issue view <N> --json state の参照が解決可能かつ state=OPEN。 -->

| 行 ID | deferred 行 | 後続 issue | owner | 再評価条件 | openness 照合 |
|---|---|---|---|---|---|
| {{ROW_ID}} | {{PATH}} | #{{FOLLOWUP_ISSUE}} | {{OWNER}} | {{REEVAL_CONDITION}} | {{GH_ISSUE_VIEW_RESULT}} |

</details>
