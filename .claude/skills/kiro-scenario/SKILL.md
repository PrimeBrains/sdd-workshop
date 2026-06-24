---
name: kiro-scenario
description: >
  人間が自分で書いた「ふるまい（When / Then）」を起点に、AI が現実（.kiro/specs・moira/MODEL.md・
  参照実装）へ接地し、受け入れシナリオ単位（.kiro/scenarios/units/{slug}.md）として描き起こして、
  独立敵対者による falsifiable な検証ループを通してから draft→agreed に確定するスキル。
  「受け入れシナリオを書く」「シナリオを検証ループにかける」「ふるまいを単位に起こして固める」で起動。
  シナリオの種（When/Then）は AI が生成しない——人間が渡す。MODEL レベルの矛盾は確認のうえ
  moira-model-update へ委譲する。Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch, Skill
argument-hint: <slug or 既存ユニットパス> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "scenario-vectors.md"
---

# kiro-scenario

Turn a **human-authored** behavior seed (When / Then) into an acceptance-scenario unit
(`.kiro/scenarios/units/{slug}.md`) — ground it in reality, render it graphically with concrete
logs and EARS, and freeze it `draft → agreed` only after it survives an **independent adversary
behind a falsifiable gate**.

**Hard guardrail: the §3 When/Then seed is written by the human; the AI never generates it.**
The AI's role is grounding, rendering, and adversarial verification — not seeding. Violating this
collapses the scenario into AI grading its own homework, destroying its external-validity purpose.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of truth, the
procedure is NOT duplicated here — follow `SKILL.ja.md`. The discipline is split as:
- `scenario-vectors.md` (owned) — scenario attack angles SC1–SC7 + the ESCALATE rule.
- `../doc-refine/review-gate.md` (referenced) — falsifiable gate, three-party separation,
  same-round rebuttal re-challenge, contradiction adjudication, user-confirmed primary sources,
  termination.
- `../doc-refine/model-and-subagent-policy.md` (referenced) — recommended model/effort
  (best-effort), subagent dispatch, per-round cost caps.
- `../doc-refine/adversarial-vectors.md` (referenced) — general-doc angles G1–G4, applied as the
  base before the SC angles.

> Only `scenario-vectors.md` is owned here; the gate/policy/general-angles are reused from
> `doc-refine` by path so no third copy is created.

In one line: get the human's When/Then seed (else emit the seed template and stop) → ground it in
`.kiro/specs` / `moira/MODEL.md` / the reference impl and confirm the source set with the user →
render the unit per `.kiro/scenarios/README.md` → run the loop (`doc-adversary` in parallel →
route human-intent FORKs → `doc-fact-checker` → **escalate MODEL-canon gaps to `moira-model-update`
after a user checkpoint** → patch in the author context only → `doc-gate-judge` per round) →
confirm `agreed` only on zero surviving Critical/Important, all forks routed, sources confirmed,
all MODEL escalations resolved, nothing unresolved at the round cap.

## Boundary with existing skills

- `kiro-spec-*`: generate the spec (requirements/design/tasks). This skill builds its acceptance
  scenarios from the human's seed.
- `doc-refine`: the general document-review machinery this skill reuses (the `doc-*` trio + the
  gate/policy/general-angles it owns).
- `moira-model-update`: hardens the Moira **canonical model** specifically — this skill's
  **escalation target** for MODEL-canon gaps (this skill never edits `moira/MODEL.md`).
- `kiro-review` / `kiro-verify-completion`: review **implementation**; this skill's target is the
  acceptance-scenario document, not code.
- **Flows (composing units into an E2E)** are out of scope for v1 → future `kiro-scenario-flow`.
