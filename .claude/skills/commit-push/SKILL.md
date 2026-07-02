---
name: commit-push
description: 変更をコミットして GitHub（PrimeBrains/sdd-workshop）へプッシュする。git status/diff で内容確認→Conventional Commits 形式の日本語メッセージ作成→add→commit→push。引数にコミットメッセージや関連 issue 番号(#N)を取れる（例 /commit-push #1 初期化スキャフォールド一式）。
allowed-tools: Bash, Read
argument-hint: "[コミットメッセージ] [#N]"
metadata:
  origin: "custom"
---

# commit-push

Commit the working changes and push them to GitHub (`PrimeBrains/sdd-workshop`,
HTTPS + gh credentials as **pbnakao** — the nakawodayo SSH key/PAT is read-only).
**Push reaches the network, so always confirm the diff first.**

**This English file is the convention shell only. The full, normative procedure lives
in [`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of
truth, the procedure is NOT duplicated here — follow `SKILL.ja.md`.

In one line: confirm the diff (`git status` / `git diff --stat` / branch; scan for
secrets; separate changes made in THIS session from unidentified ones — parallel
sessions may share the worktree, so unknown changes are excluded by default) →
decide the message (argument, or compose a Japanese Conventional Commits subject and
confirm with the user; include `#N`) → `git add` explicit paths for the agreed scope
(`-A` only when every change is confirmed to be this session's work) → `git commit`
with the current model's `Co-Authored-By` trailer → verify `gh auth status` shows
pbnakao active, then `git push` (`-u origin HEAD` if upstream is unset; `workflow`
scope needed when `.github/workflows/**` is in the commit) → report branch, commit
id, and any changes left unstaged.

## Boundary with existing skills

- `code-review` / `simplify`: review/clean up a code **diff** (not committing).
- `verify`: confirm a code change by real behavior.
- **this skill**: stage, commit, and push the working changes to GitHub.
