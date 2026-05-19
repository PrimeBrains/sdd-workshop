# Postmortem Review Report ({{TIMESTAMP}})

> `/kiro-postmortem-review` が出力する集約レポートのテンプレ。
> プレースホルダ `{{FIELD}}` を実値で置換して提示。

---

## Summary

- Total entries: {{TOTAL_COUNT}}
- Valid entries: {{VALID_COUNT}}
- Malformed entries (skipped): {{MALFORMED_LIST}}
- Status breakdown:
  - `recorded`: {{COUNT_RECORDED}}
  - `reviewed`: {{COUNT_REVIEWED}}
  - `steered`: {{COUNT_STEERED}}
- Scope filter applied: {{SCOPE_FILTER_OR_NONE}}

---

## Frequency (4 軸集計)

### R3 — 要因分類 (What 軸)

| Label | Count | % |
|---|---|---|
{{R3_TABLE_ROWS}}

### R4 — 検知工程ギャップ (Where 軸)

「すり抜けた検証層」ヒートマップ。`検知すべき工程` × `検知した工程` の差を可視化。

| 検知すべき工程 | 検知した工程 | Count | すり抜け解釈 |
|---|---|---|---|
{{R4_GAP_MATRIX_ROWS}}

### R13 — 発生機能 (Spec 軸)

| Label | Count | % |
|---|---|---|
{{R13_TABLE_ROWS}}

### R14 — 根本要因分類 (Why 軸)

| Label | Count | % |
|---|---|---|
{{R14_TABLE_ROWS}}

---

## Clusters

### Cluster by 根本要因分類 (Why)

「同じメカニズムで繰り返された」群。Try の最有力候補源。

{{R14_CLUSTERS}}

各クラスタは:
- ラベル: 該当 entry IDs (count 件)

例:
```
- `assumption-error`: #0001, #0004, #0007 (3 件)
- `tooling-trap`: #0003, #0006 (2 件)
```

### Cluster by 発生機能 (Spec)

「どの機能で不具合が累積しているか」群。機能リファクタリングの優先度判断に使う。

{{R13_CLUSTERS}}

### Cross-reference via 同件調査

`同件調査` フィールドで相互参照されたエントリ群 (entry IDs のグラフ表現)。

{{CROSS_REF_GRAPH}}

---

## Try Candidates

抽出された Try 候補。各 Try は **steering 化候補** として `/kiro-steering-custom` 経由で `.kiro/steering/*.md` に反映可能。

{{TRY_LIST}}

各 Try は以下構造:

```
### Try N: {{TRY_TITLE}}
- **Summary**: {{TRY_SUMMARY}}
- **Source Entries**: {{SOURCE_ENTRY_IDS}} ({{N}} 件)
- **Root cause cluster**: {{ROOT_CAUSE_LABEL}}
- **Proposed Steering Target**: {{TARGET_STEERING_PATH}}
- **Try Content (steering に書き込む内容)**:
  {{TRY_BODY}}
- **User verdict**: pending | approved | rejected
```

---

## Hand-off Plan

ユーザーが各 Try を承認 / 却下した結果に応じて、本 skill が以下を実行:

1. **Approved Try**: `templates/steering-handoff.md` で構造化 → `/kiro-steering-custom` に渡す
2. **Rejected Try**: 該当 entries の `Status:` を `recorded` → `reviewed` に Edit
3. **Approved Try が `/kiro-steering-custom` で成功**: 該当 entries の `Status:` を `recorded` → `steered` に Edit + `## Steering 反映ログ` に back-reference を append
4. **Approved Try が `/kiro-steering-custom` で失敗**: 該当 entries の `Status:` を `recorded` のまま保持 (再評価可能)

---

## Notes for User

- 本レポートは `.kiro/postmortem/defects.md` の `Status: recorded` のエントリを優先的に拾う (`reviewed` / `steered` は履歴として頻度集計には含めるが Try 抽出対象外)
- Scope filter (`since:YYYY-MM-DD` / `feature:<label>`) で部分集計可能
- Try が空でも報告は出力する (蓄積が少ない初期段階での「まだ trying するパターンが無い」状態の可視化)
