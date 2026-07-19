---
status: working-ledger
issue: 43
---

# 変更要求票 — issue #43

## 入口種別

会話依頼起票 <!-- issue直 | 検出結果起票 | 会話依頼起票 -->

起票した issue: https://github.com/PrimeBrains/sdd-workshop/issues/43

## 明確化した変更要求文

`moira/README.md` の「このワークスペースの磨き方(方法論)」節の末尾に、「moira への変更の出し方
（変更管理フローの入口）」を案内する短い小節（見出し 1 つ＋箇条書き程度）を追記する。内容は
(1) 変更要求は GitHub issue に正規化し `moira-change` フロー（影響調査→ルーティング→既存ゲート→
同期閉包確認→クローズ）で流すこと、(2) 軽量な変更は triage でフロー不起動と判定され通常作業で
よいこと、(3) 規範は `.kiro/steering/moira-change-management.md` であること、の 3 点。既存の節の
記述（moira-model-update ループ・シナリオループ・計器群）は変更しない。

原文: https://github.com/PrimeBrains/sdd-workshop/issues/43

## 候補クラス（仮判定）

| クラス | 該当 | 根拠 |
|---|---|---|
| M（MODEL・正典設計物級） | N | MODEL の公理・制約・語彙・既定・イベント意味論に触れない。moira-model-update 所有物（NAMING・同 skill・moira 系 agent 定義）でもない |
| D（設計判断級） | N | 0→1 の構造判断を含まない（既定の入口案内の転記） |
| P（プロパティ級） | N | 不変条件に触れない |
| S（シナリオ級） | N | 観測ふるまいに触れない |
| C（コード級） | N | 実装に触れない |
| V（検証基盤級） | N | 検知器に触れない |
| F（一般確定文書級） | **Y** | M 級所有物以外の一般確定文書（moira/README.md）への追記 → doc-refine |

## triage 判定

判定: フル工程 <!-- フル工程 | 軽量（本フロー不起動→通常作業） -->
理由: 確定文書（moira/README.md）の節追記であり F 級ゲート（doc-refine）を要する——誤字修正級ではない。（あわせて #39 受け入れテストのフル実走を兼ねる）

## base commit

0f90cab0d5956f5347fb46a6e9becaba085a7ead
