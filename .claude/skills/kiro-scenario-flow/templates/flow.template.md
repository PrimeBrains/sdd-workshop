<!--
  E2E フロー（完成形）テンプレート — kiro-scenario-flow が接地後に描き起こす雛形。
  {{...}} を実値で置換する。
  §1/§3 の通しの価値・観点（E2E 価値）は AI が生成する＝合成で初めて見える創発性質を言語化する
  （kiro-scenario と違い人間の発案ではない）。生成後は §4 で人間のドラフト批准（ratify）に回し、
  批准された通し価値はループ中に実質改変するなら再批准を取る。スコープ（どのユニット・順序・起点/終点・
  スコープ外）は本テンプレを描く前に人間が明示承認していること。
  様式は .kiro/scenarios/README.md v0.2 に一致させ、フロー固有の通し節（§2 合成・§5 継ぎ目）を足す。
  composes: は承認順で全列挙。touches_* は全メンバーの重複排除した全列挙の和（trace-notation.md）。
  メンバーは全て agreed であること（未確定の上に通しを建てない）。
-->
---
id: flows/{{SLUG}}
title: {{TITLE}}
status: draft
language: ja
actor: {{ACTOR}}
surfaces: [{{SURFACES}}]            # 全メンバーの関与画面の和（新規予定は 名前(新規)）
precondition: {{FLOW_PRECONDITION}} # 先頭メンバーの precondition（通しの起点）
postcondition: {{FLOW_POSTCONDITION}} # 末尾メンバーの postcondition（通しの終点）
composes:                           # 順序付き・全列挙。本文 §2 と双方向一致
  - units/{{MEMBER_1}}
  - units/{{MEMBER_2}}
touches_specs:                      # 全メンバーの touches_specs の重複排除した和・全列挙
  - {{SPEC}}
touches_requirements:               # 全メンバーの touches_requirements の重複排除した和・全列挙
  - "{{REQ}}"
---

# {{TITLE}}

> 読み方：開発者は §1〜§4 を見れば、この通しを作るべきかを判断できます。各ユニット単体の正しさは既に
> 確定済み（agreed）で、ここで確かめるのは**ユニットを跨ぐ継ぎ目と、AI が生成し人間が批准した通しの主張**です。

## 1. このフローで確かめること

{{ONE_LINE_E2E_VALUE}}

<!-- AI が生成する：単独ユニットの postcondition の和では言えない、通しでのみ観測できる創発性質を 1〜2 行・平易に。
     §4 で人間の批准に回す。捏造・過大主張は不可（members の postcondition から実際に観測できる性質に限る）。 -->

## 2. 合成するユニット（composes）

このフローは次のユニットを**この順**で合成します。各メンバーの postcondition が次メンバーの precondition を満たします。

| # | ユニット | このフローでの役割（一行） | 入口（precondition）→ 出口（postcondition） |
|---|---|---|---|
| 1 | `units/{{MEMBER_1}}` | {{MEMBER_1_ROLE}} | {{MEMBER_1_PRE}} → {{MEMBER_1_POST}} |
| 2 | `units/{{MEMBER_2}}` | {{MEMBER_2_ROLE}} | {{MEMBER_2_PRE}} → {{MEMBER_2_POST}} |

通しの起点：{{FLOW_PRECONDITION}}／通しの終点：{{FLOW_POSTCONDITION}}

## 3. E2E のふるまい（通しの When / Then）

{{AI_FLOW_WHEN_THEN}}

<!-- AI が生成する通しの When/Then。単独ユニットの和では言えない創発性質を平易に述べる。
     §4 で人間が批准（ratify）する。批准後にループで実質改変するなら再批准を取る。 -->

<small>注：{{TERM_ANNOTATION}}</small>

## 4. 通しの変化（Before → After）

採用表現は **{{SURFACE_CHOICE}}**（{{SURFACE_CHOICE_NOTE}}）。通しの弧（{{ARC_DESC}}）を一望できる形で描く。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">{{SURFACE_TITLE}}（通しの弧）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">段（メンバー）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{COL_A}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{COL_B}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{COL_C}}</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{STAGE_1}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{STAGE_1_A}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{STAGE_1_B}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{STAGE_1_C}}</td>
  </tr>
</table>

<!-- 新規サーフェスがあれば 同形で追記。新規は必ず「(新規)」と明記。 -->

**データ（通しの弧・素の値）**

| 段（メンバー） | lifecycle | {{D_COL_B}} | {{D_COL_C}} |
|---|---|---|---|
| {{D_STAGE_1}} | {{D_LIFECYCLE_1}} | {{D_B_1}} | {{D_C_1}} |

{{ARC_METRIC_LINE}}

## 5. 継ぎ目と境界接続（メンバー間）

単体ユニットのレビューでは見えない、**メンバー間の継ぎ目**を通しで行使する。

| 継ぎ目（⟿ / ⚠） | 前段の出口 | 次段の入口 | 連続（状態・数値が連続するか） |
|---|---|---|---|
| {{SEAM_1}} | {{SEAM_1_OUT}} | {{SEAM_1_IN}} | {{SEAM_1_CONT}} |

<small>注：`⟿` = spec/skill を跨ぐ継ぎ目（前段の出力が次段の入力になる接続点）／`⚠` = 未実装 skill を跨ぐ箇所。{{SEAM_CAVEAT}}</small>

## 6. 受け入れ条件（EARS・通し）

- **WHEN** {{TRIGGER}}（通しの操作）、**システムは** {{RESPONSE}}**しなければならない**。
- **WHILE** {{STATE_COND}}（通しの途中状態）、**システムは** {{STATE_RESPONSE}}**してはならない**。
- **WHEN** {{TRIGGER_2}}（通しの完了）、**システムは** {{RESPONSE_2}}**しなければならない**。

<!-- 非専門家がチェック可能な falsifiable 条件にする。moira 用語・skill 名・MODEL 記号を入れない。
     単メンバーの受け入れ条件の再掲でなく、通しでのみ falsify できる条件を書く。 -->

## 7. 決定事項

<!-- 対話で確定した決定のみ。未決の FORK は本文に残さない。
     メンバー側へ委譲（kiro-scenario）/ MODEL へ委譲（moira-model-update）して裁定された結果は、
     出所（メンバー slug / MODEL §/DECISIONS/会話ログ）を添えて記す。 -->

- {{CONFIRMED_DECISION}}
