---
name: moira-model-update
description: >
  Moira 正典モデル（moira/MODEL.md）への変更を、独立した敵対者による多重レビューループ
  （falsifiable な確定ゲート）を通してからのみ確定するスキル。「Moira モデルを更新」「MODEL に反映」
  「正典に取り込む」「思考実験の結論を正典化」「Moira の敵対的レビューを回して確定」などで起動する。
  Opus 4.8+ / effort max を強く推奨する高コスト操作。Moira の命名文書・本スキル自身・エージェント
  定義など Moira の確定設計物の改訂にも使う。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch
argument-hint: <変更内容 or 思考実験パス> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "adversarial-vectors.md, review-gate.md, model-and-subagent-policy.md"
---

# moira-model-update

Commit a change to Moira's canonical design artifacts (default `moira/MODEL.md`) only after it
survives an **independent adversary behind a falsifiable gate**.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of truth, the
procedure is NOT duplicated here — follow `SKILL.ja.md`. The discipline is split across the
three shared-rules:
- `model-and-subagent-policy.md` — recommended model/effort (best-effort, not a hard stop),
  subagent dispatch, per-round cost caps.
- `adversarial-vectors.md` — attack-angle catalog: model angles V1–V6 / skill angles S1–S8.
- `review-gate.md` — falsifiable gate, three-party separation, same-round rebuttal
  re-challenge, contradiction adjudication, termination, handling of existing §6 provenance, and
  change-management-flow integration (a pre-ratified intent record from `moira-change` HA is
  accepted as human-approval evidence; deviations and uncovered forks go to the user via the
  flow's fork batch; forks/ratifications are presented in plain D/P/S-granularity language,
  never raw MODEL clause text).

In one line: classify the target (MODEL-class vs other design artifact), run the adversarial
loop (`moira-adversary` in parallel → route human-intent FORKs to the user → `moira-fact-checker`
for factual claims → patch in the author context only → `moira-gate-judge` per round), and
commit only on **zero surviving Critical (all Important dispositioned — fixed / soundly refuted /
tracked-deferred)**, all forks routed, nothing unresolved at the round cap — branching the commit
step by target kind.

## Boundary with existing skills

- `kiro-review`: reviews task **implementation** against a frozen spec.
- `kiro-verify-completion`: fresh-evidence gate for completion claims.
- **this skill**: hardens the **canonical design document itself** before it is frozen.
