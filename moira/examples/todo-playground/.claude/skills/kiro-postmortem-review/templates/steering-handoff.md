# Steering Handoff: {{TRY_SUMMARY}}

> `/kiro-postmortem-review` が承認された Try を `/kiro-steering-custom` に渡す際の構造化フォーマット。
> プレースホルダ `{{FIELD}}` を実値で置換。本ファイルが `/kiro-steering-custom` の入力 (args または対話初期メッセージ) として渡される。

---

## Source

- **Source entries**: {{SOURCE_ENTRY_IDS}}
- **Root cause cluster**: {{ROOT_CAUSE_LABEL}}
- **Frequency**: {{N}} occurrences (出現回数)
- **Spec spread**: {{AFFECTED_FEATURES}} (発生機能ラベルの一覧)

---

## Proposed Steering Target

- **File**: {{TARGET_STEERING_PATH}}
- **Action**: {{ACTION_TYPE}}
  - `create-new`: 新規 steering ファイルを作成
  - `append-to-existing`: 既存 steering ファイルに section 追加
  - `update-existing-section`: 既存 section を更新 (preservation rules を尊重)
- **Target Section** (`append-to-existing` または `update-existing-section` の場合): {{TARGET_SECTION_HEADING}}

### Filename Naming Convention

| Pattern | Use case |
|---|---|
| `defect-patterns-{{root-cause-label}}.md` | 単一 Why クラスタの汎用 Try (例: `defect-patterns-assumption-error.md`) |
| `{{feature-label}}-{{topic}}.md` | 単一機能領域での特殊ガイド (例: `dashboard-formatter-conventions.md`) |
| `{{cross-cutting-topic}}.md` | 横断的な開発プラクティス (例: `unit-test-policy.md`) |

---

## Try Content

`/kiro-steering-custom` が `.kiro/steering/*.md` に書き込む本文 (steering-style 規約に従う日本語、`.kiro/steering/requirements-style.md` に該当する場合は二言語併記):

```markdown
{{TRY_BODY}}
```

### Try Content の構成要素 (推奨)

- **原則 / ルール**: 1-3 行で簡潔に
- **理由 (Why)**: なぜこのルールが必要か (該当 entry 由来)
- **適用例**: 該当した不具合と、その対策コード例
- **アンチパターン**: やってはいけない判断
- **チェックリスト**: 該当時に確認すべき項目 (任意)

---

## Rationale (Motivating Evidence)

該当 entry からの抜粋。本 Try が「思いつき」ではなく実際の不具合履歴に基づくことを示す。

{{RATIONALE_FROM_ENTRIES}}

各 entry は以下形式:

```
### Entry #{{ID}}: {{TITLE}}
- 発生機能: {{FEATURE}}
- 検知工程ギャップ: {{SHOULD_AT}} → {{WAS_AT}}
- 根本要因詳細: {{DETAIL_EXCERPT}}
- 次回からの対応策 (本 Try の元): {{TRY_EXCERPT}}
```

---

## After Handoff (本 skill が steering 化成功後に実施)

1. `.kiro/postmortem/defects.md` の `## Steering 反映ログ` セクション末尾に back-reference を append:

```markdown
### {{TIMESTAMP}}

- Source entries: {{SOURCE_ENTRY_IDS}}
- Target steering: {{TARGET_STEERING_PATH}}
- Try summary: {{TRY_SUMMARY}}
- Handoff result: success
```

2. 該当 entries の `Status:` を `recorded` (または `reviewed`) → `steered` に Edit

3. ユーザーに完了通知

---

## Failure Handling

`/kiro-steering-custom` が失敗 (skill エラー / ユーザー却下 / preservation rules 違反等) した場合:

- ledger entries の `Status:` は変更しない (recorded のまま保持)
- `## Steering 反映ログ` に back-reference を **書き込まない** (success のみ記録、R7.3)
- 次回 `/kiro-postmortem-review` 起動時に同 Try が再提示される (再評価可能)
- ユーザーに失敗理由を表示
