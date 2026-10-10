## 2026-10-04T19:43:02Z
You are challenger_m4_1, specialized in Adversarial Stress Testing of Terra Context Isolation & Citation Integrity.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\challenger_m4_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
And worker handoff:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m4_implementation_1\handoff.md

Adversarially challenge Terra AI Context Isolation & Draft Action Safety:
1. Test context bleed attacks:
   - Querying messages from conversation B within context of conversation A. Ensure `validateTerraContextBoundary` throws or rejects.
   - Adversarial text containing room IDs in user prompt. Ensure no data leak.
2. Test citation integrity:
   - Summaries with fabricated sequence numbers not present in unread batch.
   - Summaries with incorrect author citations (seq #3 attributed to @bob when authored by @alice).
   - Summaries with zero citations or malformed brackets. Ensure all are rejected.
3. Test draft actions:
   - Unilateral execution attempt without human confirmation: must be blocked.
   - Mutation attempts on terminal states (approved/rejected): must be rejected.
4. Run test executions and report findings.
5. Deliver your verdict (`APPROVE` or `REQUEST_CHANGES`) in `handoff.md` and message orchestrator.
