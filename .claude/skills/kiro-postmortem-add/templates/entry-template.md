### {{ENTRY_ID}}: {{TITLE}}

Status: recorded
Entry ID: {{ENTRY_ID}}
Created: {{ISO_TIMESTAMP}}
Source: {{SOURCE_FLAG}}

#### 1. 発生機能
{{FEATURE_LABEL}}

#### 2. 発生した不具合
{{DEFECT_DESCRIPTION}}

#### 3. 検知した工程
{{DETECTED_AT_LABEL}}

#### 4. 検知すべき工程
{{SHOULD_DETECT_AT_LABEL}}

#### 5. 検知すべき工程で検知できなかった理由
{{GAP_REASON}}

#### 6. 要因分類
{{CAUSE_CATEGORY_LABEL}}

#### 7. 根本要因分類
{{ROOT_CAUSE_CATEGORY_LABEL}}

#### 8. 根本要因詳細
{{ROOT_CAUSE_DETAIL}}

#### 9. 同件調査
{{RELATED_ENTRIES}}

#### 10. 次回からの対応策
{{TRY_PROPOSAL}}

<!--
Placeholder reference (for kiro-postmortem-add):
- ENTRY_ID: zero-padded 4-digit int, e.g. "0004" (next ID from ledger max + 1)
- TITLE: 1-line summary of 発生した不具合
- ISO_TIMESTAMP: e.g. "2026-05-19T13:45:00Z" (UTC at finalization)
- SOURCE_FLAG: "organic" (通常追記) or "retrospective-seed" (初期 seed)
- FEATURE_LABEL: R13 taxonomy + optional "/" sub-scope. e.g. "dashboard / SummaryStrip"
- DEFECT_DESCRIPTION: 1-3 段落の具体的な記述
- DETECTED_AT_LABEL: R4 taxonomy 1 label
- SHOULD_DETECT_AT_LABEL: R4 taxonomy 1 label
- GAP_REASON: (3) ≠ (4) の場合は非空 / (3) == (4) は "該当なし (同工程で検知)" 可
- CAUSE_CATEGORY_LABEL: R3 taxonomy 1 label
- ROOT_CAUSE_CATEGORY_LABEL: R14 taxonomy 1 label
- ROOT_CAUSE_DETAIL: "なぜそのメカニズムが発動したか" の具体的記述
- RELATED_ENTRIES: 過去 entry ID を "#0003, #0007" 形式で列挙、または "該当なし"
- TRY_PROPOSAL: 次回への対応策 (Try 候補)
-->
