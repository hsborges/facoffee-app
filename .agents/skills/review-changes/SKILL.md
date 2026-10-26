---
name: review-changes
description: >-
  Review the changes in a pull request, a branch, or the current worktree
  against the base branch and the project's own conventions. Fixes blocking
  findings automatically, proposes the rest for approval, never commits. On a PR,
  comments the findings and, once the fixes are pushed, the changes applied. Use
  for "review my changes", "review this PR", "review PR #42", "review this
  branch", "review the worktree".
---

# Review changes

Blocking findings are fixed automatically; Important findings and Suggestions are only applied after the user approves them. Never commit, push or stash: all fixes stay as uncommitted changes in the worktree. On a PR, the only writes to GitHub are the two comments in steps 7 and 11.

## 1. Find the target

Base branch: `git symbolic-ref --short refs/remotes/origin/HEAD` (fallback `origin/main`). Run `git fetch origin` first.

- Nothing given: the current worktree against the base. Read `git log --oneline <base>..HEAD`, `git diff <base>...HEAD` and the uncommitted changes (`git status`, `git diff HEAD`, including untracked files).
- PR number or URL: `gh pr view <pr> --json title,body,headRefName,baseRefName,commits,files`, `gh pr diff <pr>` and `gh pr checks <pr>`. Read the linked issue with `gh issue view`.
- Branch or ref: `git diff <base>...<ref>` and `git log --oneline <base>..<ref>`.

Fixes are applied to the checked-out worktree. If the target is not checked out, ask before switching to it (`gh pr checkout <pr>` or `git switch <ref>`), and only switch when the worktree has no uncommitted changes. If the user declines, review without fixing and report Blocking findings like the others.

## 2. Load the project's rules

Read what the project says about how changes must look, and review against it. Look for, and read when present:

- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, the PR template (`.github/pull_request_template.md`).
- Decision records (`docs/adr/` or similar), requirements or specs, domain glossary, API specs (OpenAPI, AsyncAPI, event contracts).
- The README of each folder the change touches.

Project rules win over the generic checklist below.

## 3. Understand the change

1. Intent: title, description, linked issue, and any requirement IDs cited. Read the specs or rules for the touched feature.
2. Read the connected code, not just the diff: callers, tests, contracts and their consumers, routes and the clients that call them.

## 4. Run the checks

If the code is in the local worktree, find the lint, test and build commands (`package.json`, `Makefile`, CI workflows) and run them, scoped to the affected packages when the project supports it. For a PR not checked out locally, use `gh pr checks`. Name slow or environment-heavy suites (end-to-end, integration) that the change calls for but that were not run.

Do not report what the linter already catches when it passes, or personal style preferences.

## 5. What to check, most severe first

- **Correctness:** logic, edge cases, money (rounding, units), dates and time zones, concurrency, error paths.
- **Security:** authorization, one user's data exposed to another, input validation at boundaries, secrets in code or logs, injection.
- **Data:** destructive or irreversible migrations, or ones incompatible with existing data.
- **Contracts:** public APIs, events or schemas changed incompatibly without versioning; consumers that break; API specs not updated.
- **Specs and rules:** behavior that contradicts a documented requirement or scenario without the doc changing too; new rules without docs or tests.
- **Tests:** new behavior and bug fixes have tests; a fix has a test that reproduces the bug; tests check behavior, not implementation; would the test fail without the change?
- **Architecture:** layer and module boundaries the project defines, domain language, no I/O in code meant to be pure.
- **Docs:** required doc comments, decision records for important decisions, READMEs and specs updated with the change.
- **Process:** branch naming, commit message format, PR description fields the template requires.
- **Excess:** dead code, abstractions or options nobody asked for, a new dependency for a few lines.

## 6. Classify

Report only what the code gives evidence for; when unsure, phrase it as a question.

- **Blocking:** a bug, security hole, data loss, broken contract or consumer, failing check, or a violation of a mandatory project rule.
- **Important:** a real problem that does not break anything yet (missing edge-case test, unclear boundary, outdated doc).
- **Suggestion:** an improvement the change does not need.

## 7. Comment the findings on the PR

Only when the target is a PR. Before fixing anything, post one comment with all findings: `gh pr comment <pr> --body-file <file>`. Content: the verdict before fixes, then the findings grouped as Blocking, Important and Suggestion, one line each with `file:line`, the problem, why it matters, and the suggested fix. Write it in the language the PR uses. With no findings, say so in one line.

## 8. Fix Blocking findings

Fix every Blocking finding without asking, following the project's rules (test first when the project uses TDD, docs and specs updated alongside). Keep each fix to the smallest change that removes the problem.

Do not guess: a Blocking fix that needs a product or design decision, or has more than one reasonable answer, goes to the approval step with the options instead.

Rerun the checks from step 4 after fixing. If a fix cannot be made to pass, revert that fix and report it as unfixed.

## 9. Ask approval for the rest

Present the Important findings and Suggestions (and any Blocking ones moved here) to the user with the question tool, one multi-select option per finding: `file:line`, the problem, and the proposed change. Apply only the ones approved, then rerun the checks.

## 10. Respond

**Verdict:** Approve, Approve with reservations, or Request changes, after the fixes.

**Fixed:** one line per Blocking finding fixed: `file:line`, the problem, what changed.

**Applied after approval** and **Not applied:** one line each, same format.

**Unfixed:** Blocking findings that could not be fixed, and why.

**Checks:** what was run and its result, and what was not run.

Leave every change uncommitted. With no findings, say so in one line.

## 11. Comment the changes applied on the PR

Only when the target is a PR and something was fixed or applied. End the response by telling the user to commit and push the changes, and to say when they are pushed. Do not post this comment before that.

When the user confirms, check that the pushed PR head contains the changes: `git fetch origin`, take `headRefOid` from `gh pr view <pr> --json headRefOid`, and run `git diff <headRefOid> -- <changed files>`. If the diff is not empty, tell the user which files are missing and wait.

Then post one comment with `gh pr comment <pr> --body-file <file>`: the fixed and approved changes (`file:line`, the problem, what changed), the findings not applied, the unfixed ones, and the checks run. Write it in the language the PR uses.
