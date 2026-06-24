<!--
  受け入れシナリオ単位（種）テンプレート — kiro-scenario が「種が無い」ときに出力する。
  ★このファイルでやること: 下の「## 3. ふるまい（When / Then）」を、あなた自身が平易な言葉で書く。
  ★AI は §3 を生成しません（人間所有のガードレール）。書いたら kiro-scenario を再実行してください。
  §1・§2・§4〜§7（前提・画面・ログ・受け入れ条件・決定事項）と frontmatter の残りは、
  再実行時に AI が現実（.kiro/specs・moira/MODEL.md・参照実装）へ接地して描き起こします。
  {{SLUG}} / {{TITLE}} はファイル生成時に置換されます。
-->
---
id: units/{{SLUG}}
title: {{TITLE}}
status: draft
language: ja
# ↓ 以下は再実行時に AI が接地して埋める（今は触らなくてよい）
# actor: 開発者
# surfaces: []            # 関与する画面（新規予定は 名前(新規) と明記）
# precondition:           # このユニットが適用できる前提状態
# postcondition:          # 適用後に成り立つ状態
# touches_specs: []       # 全列挙・範囲/ワイルドカード禁止（trace-notation.md）
# touches_requirements: []
---

# {{TITLE}}

## 3. ふるまい（When / Then）

<!-- ここをあなたが書く。平易な言葉で。moira 専門用語や skill 名は不要。 -->

```
When  （あなたが行う操作を一言で）
Then  （その結果、何が起きてほしいか）
And   （続けて起きてほしいこと）
And   （ユーザーが何に気づけたら「正しい」と言えるか）
```

<!--
  §1 このユニットで確かめること / §2 前提（Given）/ §4 画面の変化 / §5 出力されるログ /
  §6 受け入れ条件（EARS）/ §7 決定事項 は、再実行時に AI が埋めます。ここには書かないでください。
-->
