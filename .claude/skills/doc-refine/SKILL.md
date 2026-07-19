---
name: doc-refine
description: >
  このリポジトリの確定文書（`.claude/agents/` の専門家エージェント定義や、`moira/`・`.kiro/` 配下の
  確定ナレッジ等）を、独立した敵対者レビューループ＝falsifiable 確定ゲートで磨き上げてから確定する
  スキル。「エージェント定義をブラッシュアップ」「doc を敵対的レビューで固める」「確定文書を凍結前に
  壊す」などで起動する。Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch
argument-hint: <対象パス or エージェント名> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "adversarial-vectors.md, review-gate.md, model-and-subagent-policy.md"
---

# doc-refine

Refine and freeze a canonical document (default: an expert agent definition under
`.claude/agents/`; also any frozen knowledge doc) only after it survives an **independent
adversary behind a falsifiable gate**.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of truth, the
procedure is NOT duplicated here — follow `SKILL.ja.md`. The discipline is split across the
three shared-rules:
- `model-and-subagent-policy.md` — recommended model/effort (best-effort, not a hard stop),
  subagent dispatch, per-round cost caps.
- `adversarial-vectors.md` — attack-angle catalog: general-doc angles G1–G4 / agent-definition
  angles D1–D6.
- `review-gate.md` — falsifiable gate, three-party separation, same-round rebuttal
  re-challenge, contradiction adjudication, user-confirmed primary sources, termination, and
  change-management-flow integration (a pre-ratified intent record from `moira-change` HA is
  accepted as human-approval evidence; deviations and uncovered forks still go to the user via
  the flow's fork batch).

In one line: classify the target (general doc vs agent definition), confirm the primary-source
set with the user, run the adversarial loop (`doc-adversary` in parallel → route human-intent
FORKs to the user → `doc-fact-checker` for factual claims → patch in the author context only →
`doc-gate-judge` per round), and commit only on **zero surviving Critical (all Important dispositioned — fixed / soundly
refuted / tracked-deferred)**, all forks routed, primary sources confirmed, nothing unresolved
at the round cap.

## Boundary with existing skills

- `code-review` / `simplify`: review/clean up a code **diff**.
- `verify`: confirm a code change by real behavior.
- `moira-model-update`: hardens the Moira **canonical model (`moira/MODEL.md`)** specifically.
- **this skill**: hardens any **document / agent definition itself** before it is frozen (general).
