---
name: github-workflow
description: Safe Git and GitHub workflow for LKDV development.
---

# Git and GitHub

Before significant changes:
- inspect git status
- inspect current branch
- understand existing local modifications

Never overwrite unrelated user work.

Before committing:
- review diff
- identify unintended files
- verify tests
- verify build/type checks where appropriate

Use focused commits.

Commit messages should describe the actual change.

Never:
- reset user changes without permission
- force push unless explicitly requested
- commit secrets
- commit .env files containing credentials
- remove unrelated work

When debugging:
1. inspect git diff
2. identify changed files
3. isolate the regression
4. fix the smallest cause
5. verify

When working with GitHub:
- inspect repository state before modifying
- reference actual issues/PRs
- avoid speculative changes
