---
created_at: 2026-06-29T00:00:00Z
title: 背骨 E2E フロー new-feature-happy-path を11ユニット合成で起こし、敵対ループ（R1 FAIL→R2 PASS）を経て agreed に確定
bindings:
  - { kind: flow, id: "flows/new-feature-happy-path" }
  - { kind: unit, id: "units/tasks-spec-completed" }
source: claude-code-session
---

## 要約

- **論点**: 確定済みの受け入れシナリオ・ユニット群を合成し、新規フィーチャーを「発見から真の完了（feature accepted）」まで運ぶ背骨 E2E フローを起こして確定できるか。AI が生成する「通しの価値」が捏造でなく実在の創発性質か、合成（順序・継ぎ目・トレース）が健全か。
- **選択肢（スコープ）**:
  - A. 背骨11ユニット（discovery→impl-completed）をハッピーパス＋現実的な差し戻し2往復で1本に。支援（割当・レビュー見積）・スケジュール・手戻り・enhancement・直接実装・キャンセル/管理は**スコープ外**（別フロー）。
  - B. 支援ユニット（review-work-estimated / assign-spec-provisional）も composes に含める。
- **決定**:
  - **スコープ A を人間が明示承認**（SCOPE_APPROVED・2026-06-29）。支援2本は composes に入れず §5 継ぎ目の前提として開示。
  - AI が §1/§3 の通しの E2E 価値（「各継ぎ目で**達成率の弧が正直であり続ける**ことを通しで確かめる」）を生成 →**人間がドラフト批准**（DRAFT_RATIFIED・2026-06-29）。
  - 一次資料セット（README v0.2／11メンバー／trace-notation／requirements-style）を**ユーザー確定**（SOURCE_SET_CONFIRMED）。
  - 検証ループ（doc-adversary×2＋doc-fact-checker→パッチ→doc-gate-judge）で **R1 FAIL → 是正 → R2 PASS**。
  - 起票時 draft だった合成メンバー `tasks-spec-completed` がセッション中に **agreed へ昇格**（現物確認・内的整合）→「全11メンバー agreed」充足→**ユーザー確認のうえ flow を `draft→agreed` へ確定**。
- **理由**: フローの外的妥当性は「AI が選び・AI が価値を作り・AI が通す」自己採点を避けるため、(1) 人間のスコープ承認、(2) 人間のドラフト批准、(3) 独立敵対者ゲートの三点で担保する。通しの弧 `0→24→32→8→32→8→32→72→80→96→100(見かけ)→44(正直化)→72→93→100(本物)` は単独ユニットの postcondition の和では言えない創発性質（差し戻しの CPI 悪化／見かけ100%の正直化／非単調低下／本物の100%）であり、事実検証で全 CONFIRMED。

### 覆った判断（履歴）

- **トレース合併に混入 → 是正**: フロー frontmatter の `moira-schedule` に、どのメンバーにも無い `14.3` を当初記載（`moira-surface-schedule` の 14.3 からの取り違え）。fact-checker と敵対者2体が指摘→**削除**。
- **§2 の無条件全称 → 正直化**: 当初「各メンバーの postcondition が次の precondition を満たす」と全称で書いたが、§5 が開示する2継ぎ目（#4→#5 はレビュー作業見積、#10→#11 は担当割当の前提）と矛盾。敵対者#1の ONE_LINE 指摘→「大半は直接連続・2箇所は支援ユニット前提」に修正。
- **§3「出来高ゼロ」→ 訂正**: 差し戻し時に「出来高ゼロ」と書いたが、レビュー作業自体は EV を獲得済み。「差し戻された要件定義の出来高が失われ実コストは残る／レビュー作業の出来高は別に残る」に訂正。
- **§7 空 → 全記載**: スコープ承認・批准・ソース確定・継承決定（ノード化経路＝子9葉・分母28.5）・例示値（実装2ノード/9葉）・「見かけ/本物」語彙・トレース是正・要追跡項目を記載。
- **§7 の偽の事実主張 → 除去（R1 FAIL の核心）**: R1 採点時、`tasks-spec-completed` の「frontmatter=agreed だが本文 §7=draft の不整合」をフロー §7 に事実主張として記載していたが、gate-judge が現物照合で「本文 §7 も agreed（draft→agreed 遷移を記述）＝不整合は実在しない」と FAIL。現物再確認のうえ当該主張を除去し「メンバーはセッション中に agreed 昇格・内的整合・全11 agreed」へ書換え→R2 PASS。
- **flow status: draft 据え置き → agreed 昇格**: §1 ではメンバー draft を理由に draft 据え置きを選んだが、メンバー昇格で前提が解消→ユーザー確認のうえ agreed へ。

## 生ログ（該当範囲）

- **あなた**: `/kiro-scenario-flow` を起動（背骨 E2E フローの合成・確定）。
- **Claude**: 11ユニットを同定し、スコープ提案（discovery→impl-completed・支援/スケジュール/手戻り等はスコープ外）を提示。AskUserQuestion でスコープ承認と、draft メンバー tasks-spec-completed の扱いを質問。
- **あなた**: スコープ「承認する」／tasks-spec-completed は「draft のままフローを draft 据え置きで進める」。
- **Claude**: 11メンバーの frontmatter を接地、連鎖検算（暗黙継ぎ目2箇所を同定）、トレース合併を算出。一次資料セットを確認。
- **あなた**: 一次資料「OK」。
- **Claude**: フロー draft を描画（AI 生成の §1/§3 通し価値＋ EV%/カバレッジ弧）。ドラフト批准を質問。
- **あなた**: §1/§3 を「批准する」。
- **Claude**: 検証ループ R1—doc-adversary×2＋doc-fact-checker を並列起動。fact-checker が `moira-schedule:14.3` 混入を CORRECTED、他は CONFIRMED。敵対者2体が §2 全称矛盾（Critical）・§3「出来高ゼロ」誤り・§4 MODEL記号混入・§7空（Critical）等を指摘。全件パッチ→ §7 記載。
- **Claude**: doc-gate-judge（R1）が **FAIL**——フロー §7 がメンバー tasks-spec-completed の「現存しない不整合」を事実主張していると現物照合で指摘。
- **Claude**: 現物 `tasks-spec-completed.md`（line4 / line601）を再確認。メンバーがセッション中に agreed へ昇格し内的整合と判明（gate-judge の指摘が正しい）。§7 の偽主張を除去・現状へ書換え。
- **Claude**: 全11メンバー agreed＝§1 の draft 据え置き前提が解消。AskUserQuestion で flow を agreed 昇格するか確認。
- **あなた**: 「agreed に昇格する」。
- **Claude**: §7 status バレットと frontmatter を agreed へ。doc-gate-judge（R2）で再採点→ **PASS**（R1 Critical 解消・新規 Critical なし・昇格根拠整合）。flow を `agreed` に確定し本会話ログを保存。
