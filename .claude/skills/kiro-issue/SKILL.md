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
- **Subagent**: take the finalized, already-approved issue specs and execute every gh /
  GraphQL call, then return a compact summary (numbers, URLs, per-field results).

Never let the subagent make product decisions or invent missing fields — it executes an
approved plan. Anything ambiguous is resolved with the user in the main context *before*
dispatch.

## Constants (this repo only — do not parameterize)

```
REPO              = PrimeBrains/sdd-workshop
PROJECT           = pj-sdd-workshop  (number 13)
PROJECT_ID        = PVT_kwDOAPzWfc4BaWSa
STATUS_FIELD_ID   = PVTSSF_lADOAPzWfc4BaWSazhVOjC0
STATUS_TODO_OPT   = f75ad846        # "Todo" single-select option
DEFAULT_ASSIGNEE  = pbnakao
```

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

Once the set is approved, hand the finalized specs to one subagent via the `Agent` tool.
Pass the specs as structured data plus the exact procedure. Template:

```
You are creating already-approved GitHub issues. Do NOT change any field, add fields, or
make product decisions. Execute exactly as specified and report back compact results.

Constants:
- REPO = PrimeBrains/sdd-workshop
- PROJECT_ID = PVT_kwDOAPzWfc4BaWSa
- STATUS_FIELD_ID = PVTSSF_lADOAPzWfc4BaWSazhVOjC0
- STATUS_TODO_OPT = f75ad846

Issues to create (JSON):
[
  {"title": "...", "body": "...", "milestone": "evm-studio",
   "labels": ["enhancement"], "assignee": "pbnakao", "status": "Todo"}
]

For EACH issue, in order:
1. Create it (milestone is REQUIRED — if a spec is missing it, skip that issue and record a
   warning, do NOT create it):
     gh issue create --repo PrimeBrains/sdd-workshop \
       --title "<title>" --body "<body>" \
       --milestone "<milestone>" \
       --label "<comma-joined labels>"   # omit --label if empty
       --assignee "<assignee>"           # omit if empty
   Capture the issue number from the returned URL.
2. Get the node id:
     gh issue view <number> --repo PrimeBrains/sdd-workshop --json id --jq .id
3. Add to the project, capture the returned item id:
     gh api graphql -f query='mutation {
       addProjectV2ItemById(input: {
         projectId: "PVT_kwDOAPzWfc4BaWSa"
         contentId: "<node_id>"
       }) { item { id } }
     }'
4. Set Status = Todo:
     gh api graphql -f query='mutation {
       updateProjectV2ItemFieldValue(input: {
         projectId: "PVT_kwDOAPzWfc4BaWSa"
         itemId: "<item_id>"
         fieldId: "PVTSSF_lADOAPzWfc4BaWSazhVOjC0"
         value: { singleSelectOptionId: "f75ad846" }
       }) { projectV2Item { id } }
     }'

Failure handling: the issue body itself is the success criterion. If step 1 succeeds but a
later step fails, still count the issue as created and record the failure as a warning —
do not retry destructively or delete the issue. You cannot ask the user anything; if a spec
is ambiguous or missing a required field, skip it and report a warning instead of guessing.

Return ONLY this JSON (no prose):
{
  "created": [
    {"number": 0, "url": "...", "title": "...", "milestone": "...",
     "labels": [...], "assignee": "...", "added_to_project": true, "status_set": true}
  ],
  "warnings": ["..."]
}
```

Use one subagent for the whole approved batch (it loops internally). If a body contains
characters awkward for inline shell quoting, instruct the subagent to write the body to a
temp file and use `--body-file`.

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
