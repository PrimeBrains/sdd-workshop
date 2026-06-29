---
name: kiro-scenario-flow
description: >
  確定済みの受け入れシナリオ・ユニット（kiro-scenario が作る `.kiro/scenarios/units/{slug}.md`）を
  順に合成した E2E フロー文書（`.kiro/scenarios/flows/{slug}.md`）を生成・確定するスキル。
  どのユニットを・どの順で・どこからどこまで一つのフローにするか／何をスコープ外にするかは人間が明示承認し、
  通しのフロー固有の価値・観点（合成で初めて見える創発的性質）は AI が生成する。AI がドラフトを描いたら人間が
  レビューして批准（ratify）し、その AI 生成の通し価値・合成の健全性を独立敵対者の falsifiable 検証ループで
  固めてから draft→agreed に確定する。「E2E フローを書く」「ユニットを合成して通しを作る」で起動。
  メンバー側の欠陥は kiro-scenario へ、MODEL レベルの矛盾は moira-model-update へ委譲する。
  Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch, Skill
argument-hint: <slug or 既存フローパス> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "flow-vectors.md"
---

# kiro-scenario-flow

Compose **already-agreed** acceptance-scenario units (produced by `kiro-scenario` at
`.kiro/scenarios/units/{slug}.md`) into an **E2E flow** document
(`.kiro/scenarios/flows/{slug}.md`) — ground it in the README convention, each member unit, and the
postcondition→precondition chain; render the through-line graphically with the EV%/coverage arc and
lifecycle transitions; and freeze it `draft → agreed` only after it survives an **independent
adversary behind a falsifiable gate**.

**Hard guardrail — human ownership is "scope approval + draft ratification", NOT origination.**
Unlike `kiro-scenario`, the human does **not** originate (0→1) the §3 through-line claim here. The
flow-specific value/perspective is an **emergent property that only appears once the units are
composed** (e.g. carrying the work from zero to true completion while every seam keeps its honest
signal — coverage drop, apparent-100% honesty correction, rework CPI), and the **AI MAY generate
it**. External validity is instead anchored by two human acts:
1. **Scope approval (before composition):** the human explicitly approves which units compose the
   flow, in what order, from-which-precondition to-which-postcondition, and what is out of scope
   (side-trips → separate flows). This is a *selection/composition* approval, not origination.
2. **Draft ratification (after render, before the loop):** the human reviews the AI-generated
   through-line value (§1/§3) and ratifies it — "yes, this is the through-line I want verified."

Freezing an AI-generated through-line without scope approval and draft ratification collapses the
flow into "the AI picks the units, the AI writes the value, the AI passes it" — self-grading that
destroys external validity. **The verification loop exists precisely to adversarially check this
AI-generated through-line value and the soundness of the composition** — the units' own behaviors
are already agreed by their own loops and are NOT re-litigated here.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of truth, the
procedure is NOT duplicated here — follow `SKILL.ja.md`. The discipline is split as:
- `flow-vectors.md` (owned) — flow attack angles FC1–FC7 + the ESCALATE rule.
- `../doc-refine/review-gate.md` (referenced) — falsifiable gate, three-party separation,
  same-round rebuttal re-challenge, contradiction adjudication, user-confirmed primary sources,
  termination.
- `../doc-refine/model-and-subagent-policy.md` (referenced) — recommended model/effort
  (best-effort), subagent dispatch, per-round cost caps.
- `../doc-refine/adversarial-vectors.md` (referenced) — general-doc angles G1–G4, applied as the
  base before the FC angles.

> Only `flow-vectors.md` is owned here; the gate/policy/general-angles are reused from `doc-refine`
> by path so no third copy is created. The single-unit angles SC1–SC7
> (`../kiro-scenario/scenario-vectors.md`) were applied when each member was agreed — this skill
> attacks the **AI-generated flow-specific content (the seams and the through-line value)**, not the
> members themselves.

In one line: get the human to approve the scope (which units / from→to / out-of-scope) → ground it
in the README flows convention / every member unit / the postcondition→precondition chain / the
merged trace, and confirm the source set with the user → render the draft, where the **AI generates
the flow-specific through-line value** → **have the human review and ratify that draft before the
loop** → run the loop (`doc-adversary` in parallel with G1–G4 + FC1–FC7 → route human-intent FORKs →
`doc-fact-checker` on chain/trace/numeric claims → escalate member-unit defects to `kiro-scenario`
and MODEL-canon gaps to `moira-model-update` after a user checkpoint → patch in the author context
only → `doc-gate-judge` per round) → confirm `agreed` only on zero surviving Critical/Important,
scope approved, draft ratified, sources confirmed, all escalations resolved, **every member in
`composes:` is `agreed`**, nothing unresolved at the round cap.

## Boundary with existing skills

- `kiro-scenario`: builds **individual** acceptance-scenario units from the human's seed (the human
  originates the behavior). This skill **composes agreed units** into an E2E flow (the through-line
  value is AI-generated and human-ratified) — and is this skill's **member-fix escalation target**
  (member defects / un-agreed members go back to `kiro-scenario`).
- `kiro-spec-*`: generate the spec (requirements/design/tasks).
- `doc-refine`: the general document-review machinery this skill reuses (the `doc-*` trio + the
  gate/policy/general-angles it owns).
- `moira-model-update`: hardens the Moira **canonical model** specifically — this skill's
  **escalation target** for MODEL-canon gaps (this skill never edits `moira/MODEL.md`).
- `kiro-scenario-e2e`: turns scenario units into Playwright regressions (currently per-unit).
  **Flow-level E2E automation is a follow-up after this skill exists.**
- `kiro-review` / `kiro-verify-completion`: review **implementation**; this skill's target is the
  E2E flow document, not code.
