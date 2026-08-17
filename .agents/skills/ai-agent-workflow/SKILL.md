---
name: ai-agent-workflow
description: Efficient autonomous workflow for coding tasks in LKDV.
---

# AI Agent Workflow

For every task, follow this sequence:

1. Understand the requested outcome.
2. Inspect the relevant files before editing.
3. Search for existing implementations.
4. Inspect database schema when database behavior is involved.
5. Identify dependencies and possible regressions.
6. Create a concise implementation plan.
7. Make the smallest appropriate changes.
8. Run relevant validation.
9. Fix discovered problems.
10. Re-run validation.
11. Report exactly what changed.

Never claim success without verification.

Do not:
- rewrite unrelated files
- invent APIs or database structures
- create duplicate functionality
- modify infrastructure unnecessarily
- hide errors
- make speculative changes

If information is missing, inspect the repository first.

Prefer evidence from the actual codebase over assumptions.

When a task is large, divide it into small independently verifiable steps.
