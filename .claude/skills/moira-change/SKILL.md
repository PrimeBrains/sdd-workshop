---
name: moira-change
description: >
  moira の変更管理フロー（issue 受付 → 影響調査 → ルーティング → 既存ゲート起動 → 同期閉包確認 →
  クローズ）を 1 本の issue について回すオーケストレーション skill。「変更管理フローを回す」
  「issue #N を変更管理で流す」「この変更を moira-change で」「影響調査から閉包まで通す」などで起動。
  規範は `.kiro/steering/moira-change-management.md`（ratified DFD の確定版）——本スキルは振り付けのみを
  所有し、規則の本文を複製しない。既存ゲート（moira-model-update / doc-refine / kiro-scenario /
  kiro-scenario-flow / kiro-scenario-e2e / decision-conformance / kiro-impl）を呼び出す層であり、
  新造ゲートは作らない。Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
argument-hint: <issue 番号 | 変更依頼の要約>
model: opus
metadata:
  origin: "custom"
  shared-rules: "templates/"
---

# moira-change

Run a single GitHub issue through moira's change-management flow: **P1** intake/normalization/
triage → **P2** impact survey (enumerate downstream artifacts into an impact map) → **P3**
routing adjudication combined with the **first-half consolidated human session (HA)** → **P4**
choreography of the **existing** gates in dependency order (no new gate is invented here) → **P5**
sync-closure check (three-valued verdict per impact-map row, plus a check that no un-mapped diff
survives) → **P6** close, gated by a **thin final approval (H5)**.

The skill's own artifact is the **impact map** — an explicit, append-only ledger of downstream
artifacts with, per row, the expected postcondition and the verifier that will confirm it. Closure
is declared only once every row is either resolved-with-evidence or a properly tracked, still-open
deferred; existing gates (`moira-model-update`, `doc-refine`, `kiro-scenario`,
`kiro-scenario-flow`, `kiro-scenario-e2e`, `decision-conformance`, `kiro-impl`) do the actual
verification work — this skill only wires them together, hands them the pre-ratified intent
record, and adjudicates class/routing/closure itself.

> **Hard guardrails (highest priority):**
> 1. **No new gates.** All verification reuses existing skills/checkers/CI. The moment this skill
>    invents its own pass/fail judge, that is a design violation.
> 2. **Existing delegation edges are not altered.** `kiro-scenario`'s escalation to
>    `moira-model-update`, `kiro-scenario-flow`'s remand to `kiro-scenario`, etc. are respected
>    as-is.
> 3. **This flow is not an enforcement mechanism** (gentleman's agreement, steering §0). All it
>    guarantees is that changes that go *through* this flow don't let downstream artifacts silently
>    rot. Leakage from direct changes outside the flow is caught by detectors (DRIFTED / CI / E2E)
>    and re-enters as a new issue.
> 4. **The ledger (`moira/changes/issue-N/`) is non-canonical.** It is never cited as authority, it
>    is kept after closure, and it is not kept in sync (`moira/changes/README.md`).
> 5. **"Deferral" is not resolution.** The requirements for a valid deferred row are owned by
>    steering §5 (not restated here) — a mere acknowledgment never clears a row.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language), which in turn defers to
[`.kiro/steering/moira-change-management.md`](../../../.kiro/steering/moira-change-management.md)
as the ratified DFD / canonical rule text. To avoid a second source of truth, the procedure is NOT
duplicated here — follow `SKILL.ja.md` and, above it, the steering document. This skill owns only
the choreography (order, hand-off, remand); routing rules (change classes M/D/P/S/C/V/F), gate
execution order, the three-valued closure verdict, and the human touchpoints (HA/HB/H5) and their
presentation convention all belong to the steering document — if they ever disagree, steering wins.

In one line: normalize the change into an issue and triage it → survey impact into an
append-only impact map with a human-facing view limited to the three human-reviewed classes
(scenario / property / design-decision) → adjudicate routing and hold **one** consolidated human
session (HA) that ratifies scope, boundary calls, any new When/Then origination, and per-row
acceptance criteria → choreograph the existing gates in dependency order, handing each the
pre-ratified intent record so its own independent scorer can auto-agree on intent-conformance,
batching any genuine forks or intent deviations into a single follow-up human check (HB) → confirm
sync-closure only when every impact-map row is resolved-with-evidence or validly deferred and no
un-mapped diff remains → close with a thin final approval (H5) that reads only a three-point
summary (final text vs. ratified intent, what became newly impossible, and the one-line closure
PASS). **H5 is reached only on closure PASS — a FAIL never goes to H5; it returns to P4/P2 and the
report stays in the ledger as a remand record.**

## Boundary with existing skills

- `moira-model-update` / `doc-refine` / `kiro-scenario` / `kiro-scenario-flow` /
  `kiro-scenario-e2e` / `decision-conformance` / `kiro-impl`: the per-artifact gates this skill
  **invokes**. Each gate owns its own internal discipline; this skill owns only the wiring (order,
  hand-off, remand).
- `kiro-issue`: dedicated to filing discovery output as issues (milestone required). This skill's
  P1 filing can use plain `gh issue create` — it is change-management intake normalization, not
  discovery filing.
- `kiro-postmortem-add`: the recording target for the `[intent-drift]` tag (the withdrawal-clause
  instrument).
