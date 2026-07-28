---
name: testing-qa
description: Testing and regression prevention for LKDV.
---

# Testing and QA

Before declaring a task complete:

1. Check TypeScript.
2. Check lint when available.
3. Run relevant tests.
4. Verify affected routes.
5. Verify affected UI states.
6. Check error and loading states.
7. Check mobile behavior when UI is affected.

For database changes:
- verify queries
- verify authentication
- verify authorization
- verify RLS
- verify expected data

For API changes:
- test valid input
- test invalid input
- test unauthorized access
- test empty results
- test error handling

For UI changes:
- loading
- success
- empty
- error
- mobile
- desktop
- keyboard accessibility

Do not weaken tests or compiler settings simply to make them pass.

Always distinguish:
- tested
- not tested
- assumed
