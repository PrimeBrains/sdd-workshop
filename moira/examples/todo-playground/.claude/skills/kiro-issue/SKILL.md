---
name: kiro-issue
description: >
  Turn kiro-discovery output (brief.md / roadmap.md) or the current conversation into
  GitHub Issues on the PrimeBrains/sdd-workshop repository and link them to the
  pj-sdd-workshop Project (Projects V2). A milestone (evm-studio / sdd-dashboard) is
  REQUIRED because it identifies which app the issue belongs to. Trigger aggressively on
  "issue にして", "起票して", "チケット化", "discovery の結果を issue 化",
  "sdd-workshop に issue 追加", or whenever the user finished brainstorming with
  kiro-discovery and wants to file the result. This is the natural follow-up to
  kiro-discovery.
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion, Agent
argument-hint: <feature-or-brief>
metadata:
  origin: "custom"
---

# kiro-issue — file sdd-workshop issues from discovery output

Translate the result of a `kiro-discovery` session (or a free-form request) into one or
more GitHub Issues on `PrimeBrains/sdd-workshop`, link each to the `pj-sdd-workshop`
Project, and stamp the mandatory milestone that says which app the work targets.

## Design: who does what

The verbose part of issue creation — `gh issue create`, fetching the node id, the
`addProjectV2ItemById` mutation, the field-update mutation, retries on transient errors —
produces a lot of low-value output. Keep all of that **out of the main conversation** by
running it inside a dispatched subagent. The main context only does the parts that need
the codebase and the user's judgment:

- **Main context**: read briefs, assemble issue drafts, decide the milestone, infer
  labels, and run the confirmation gate with the user.
- **Subagent** (`sdd-issue-creator`): take the finalized, already-approved issue specs and
  execute every gh / GraphQL call, then return a compact summary (numbers, URLs, per-field
  results).

Never let the subagent make product decisions or invent missing fields — it executes an
approved plan. Anything ambiguous is resolved with the user in the main context *before*
dispatch.

## Constants (this repo only — do not parameterize)

```
REPO              = PrimeBrains/sdd-workshop
PROJECT           = pj-sdd-workshop  (number 13)
DEFAULT_ASSIGNEE  = pbnakao
```

The Projects V2 ids (PROJECT_ID / STATUS_FIELD_ID / Status option) live in the
`sdd-issue-creator` agent definition, since only it makes the GraphQL calls — keep them in
one place to avoid drift.

Milestones are NOT hardcoded — fetch them live so new apps work without editing this skill.

All user-facing text (AskUserQuestion options, progress, final report) must be in
**Japanese**, per the project language rule. The instructions below are in English; the
output you produce is Japanese.

---

## Main context — step by step

### 1. Resolve the input source

Figure out what the user wants to file:

- An argument naming a feature → read `.kiro/specs/<feature>/brief.md`.
- "全部" / a roadmap reference → read `.kiro/steering/roadmap.md`, take the features under
  `## Specs (dependency order)`, and read each existing `.kiro/specs/<feature>/brief.md`.
- No brief on disk (Path B work, or an idea that never became a spec) → assemble the issue
  from the conversation context instead. Briefs are preferred when they exist because they
  already hold Problem / Desired Outcome / Scope.

Use `Glob`/`Read` to find briefs; don't assume a path exists — check.

### 2. Draft each issue

For every source, build a draft:

- **title**: a concise imperative line. Prefer the brief's feature name / Problem heading.
- **body** (Markdown): synthesize from the brief's Problem, Current State, Desired Outcome,
  Approach, and Scope (In/Out) sections. When the source is a brief on disk, add a trailing
  reference line, e.g. `> 出典: .kiro/specs/<feature>/brief.md`. Keep it readable — this is a
  ticket, not a spec dump.

### 3. Decide the milestone (REQUIRED — blocking)

The milestone tells reviewers which app the issue is about, so it is mandatory. Fetch the
live list:

```bash
gh api repos/PrimeBrains/sdd-workshop/milestones --jq '.[].title'
```

Infer a candidate per issue from signal in the brief path / roadmap / keywords (e.g. an
EVM-related brief → `evm-studio`; a dashboard brief → `sdd-dashboard`), but **always have
the user confirm the milestone** in the gate below. If you cannot determine a milestone and
the user does not supply one, **do not dispatch** — stop and ask. An issue without a
milestone must never be created.

### 4. Infer labels

Match the issue content against the repo's existing labels:

```bash
gh label list --repo PrimeBrains/sdd-workshop
```

Suggest from the existing set (typically `enhancement` for new features, `bug` for defects,
`documentation` for docs). Only suggest labels that already exist; if nothing fits, suggest
none rather than inventing a label.

### 5. Confirmation gate (per issue)

Present each draft and confirm with `AskUserQuestion` before anything is created. Show:

- title
- body summary (a few lines)
- **milestone** (the required field — make it prominent)
- labels (inferred)
- Status = Todo (default project status)
- assignee (default `pbnakao`)

Offer "はい、この内容で" / "修正する" (free input for edits). For **multiple issues**,
follow the batch-review style: present and confirm each issue individually, gather all the
verdicts, then dispatch the approved set together at the end. Drop any issue the user
rejects; never dispatch an unconfirmed or milestone-less issue.

### 6. Dispatch the creation subagent

Once the set is approved, hand the finalized specs to the dedicated **`sdd-issue-creator`**
subagent (defined in `.claude/agents/sdd-issue-creator.md`). It holds the full procedure,
constants, guardrails, and output format, so the only thing you pass is the approved issue
specs as JSON. Dispatch via the `Agent` tool with `subagent_type: "sdd-issue-creator"`:

```
Create these already-approved issues and report results as your JSON contract:

[
  {"title": "...", "body": "...", "milestone": "evm-studio",
   "labels": ["enhancement"], "assignee": "pbnakao", "status": "Todo"}
]
```

Send the whole approved batch in one dispatch (the agent loops internally). Do not restate
the gh / GraphQL steps here — they live in the agent definition; keeping them in one place
avoids drift.

### 7. Report (Japanese)

Format the subagent's returned JSON into a Japanese summary: each created issue's number +
URL, the milestone, labels, assignee, project link (`pj-sdd-workshop`), Status, and any
warnings. If a warning indicates an issue was skipped for a missing milestone, say so
plainly and offer to retry once the milestone is decided.

---

## Guardrails

- **Milestone is mandatory.** No issue is ever created without one. If undecided, stop and
  ask — do not default it.
- **No creation without confirmation.** The `gh issue create` call only happens after the
  user approves via the gate, and it happens inside the dispatched subagent, not the main
  context.
- **Subagent executes, it does not decide.** All product judgment (wording, milestone,
  labels) is settled in the main context first.
- **Constants are repo-specific.** This skill is intentionally hardcoded to
  `PrimeBrains/sdd-workshop` / `pj-sdd-workshop`; do not generalize it to other repos.
