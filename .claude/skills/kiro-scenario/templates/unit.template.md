<!--
  受け入れシナリオ単位（完成形）テンプレート — kiro-scenario が接地後に描き起こす雛形。
  {{...}} を実値で置換する。§3 は人間が書いた When/Then をそのまま差し込む（改変しない）。
  様式は .kiro/scenarios/README.md v0.2 と gold 単位 .kiro/scenarios/units/estimate-spec-proposed.md に一致させる。
  touches_* は全列挙（範囲/ワイルドカード/注釈/自由文 禁止；trace-notation.md）。
-->
---
id: units/{{SLUG}}
title: {{TITLE}}
status: draft
language: ja
actor: {{ACTOR}}
surfaces: [{{SURFACES}}]            # 新規予定は 名前(新規) と明記
precondition: {{PRECONDITION}}
postcondition: {{POSTCONDITION}}
touches_specs:
  - {{SPEC}}                        # 全列挙
touches_requirements:
  - "{{REQ}}"                       # 全列挙・詳細トレースはここに集約し本文に書かない
---

# {{TITLE}}

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。

## 1. このユニットで確かめること

{{ONE_LINE_PURPOSE}}

## 2. 前提（Given）

{{PRECONDITION_PROSE}}

| ノード | {{COL_A}} | 状態 |
|---|---|---|
| {{NODE}} | {{VAL}} | {{STATE}} |

{{BEFORE_METRIC_LINE}}

## 3. ふるまい（When / Then）

{{HUMAN_WHEN_THEN}}

<small>注：{{TERM_ANNOTATION}}</small>

## 4. 画面の変化（Before → After）

採用表現は **{{SURFACE_CHOICE}}**（{{SURFACE_CHOICE_NOTE}}）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="3" style="padding:6px 10px">{{SURFACE_TITLE}}（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{ROW_NODE}}</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">{{BADGE}}</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">{{ROW_NOTE}}</td>
  </tr>
</table>

<!-- 新規サーフェスがあれば 履歴画面（新規）等を同形で追記。新規は必ず「(新規)」と明記。 -->

**データ（After・素の値）**

| ノード | {{D_COL_A}} | {{D_COL_B}} | {{D_COL_C}} |
|---|---|---|---|
| {{D_NODE}} | {{D_A}} | {{D_B}} | {{D_C}} |

{{AFTER_METRIC_LINE}}

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | {{EVENT_LOG_WHAT}} |
| **会話ログ**（`.kiro/conversations/{日付}-{{SLUG}}.md` 等） | {{CONV_LOG_WHAT}} |
| **{{SCREEN_LOG_HOME}}** | {{SCREEN_LOG_WHAT}} |

```json
{
  "id": "{{EVENT_ID}}", "ts": {{TS}}, "actor": "{{EVENT_ACTOR}}",
  "kind": "{{EVENT_KIND}}", "{{EVENT_TARGET_KEY}}": "{{EVENT_TARGET}}",
  "reason": "{{EVENT_REASON}}",
  "children": [ {{EVENT_CHILDREN}} ]
}
```

<small>注：{{LOG_CAVEAT}}（event 型は `moira/backend/src/types.ts` に一致）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** {{TRIGGER}}、**システムは** {{RESPONSE}}**しなければならない**。
- **WHILE** {{STATE_COND}}、**システムは** {{STATE_RESPONSE}}**してはならない**。
- **WHEN** {{TRIGGER_2}}、**システムは** {{RESPONSE_2}}**しなければならない**。

<!-- 非専門家がチェック可能な falsifiable 条件にする。moira 用語・skill 名・MODEL 記号を入れない。 -->

## 7. 決定事項

<!-- 対話で確定した決定のみ。未決の FORK は本文に残さない。
     MODEL に委譲して裁定された結果は、出所（MODEL §/DECISIONS/会話ログ）を添えて記す。 -->

- {{CONFIRMED_DECISION}}
