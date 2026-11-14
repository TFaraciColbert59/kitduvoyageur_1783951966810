# Dispatch: Sub-Orchestrator Milestone M1 — Apple Tokens & Native/CSS Components Bank (LKDV Greens)

- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m1
- Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md (Milestone M1)
- ORIGINAL_REQUEST.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md

## Scope & Objective
Deliver Milestone M1 per `PROJECT.md`:
1. Centraliser les spécifications, tokens et composants officiels Apple dans `src/design/bank.ts` et `scripts/generate-design-bank.mjs`.
2. Implémenter les primitives WebKit/CSS Apple (`-apple-system-*`, rayons continus squircle, flous `backdrop-filter`, grabber de sheet 36×5pt, métriques `UISegmentedControl`, listes `insetGrouped`).
3. Mapper avec la palette verte LKDV en éliminant tout noir pur `#000000` et les fonds sombres non désirés (`#0d1117`, styles résiduels `.dark`, clavier sombre dans `capacitor.config.ts`).
4. Assurer la synchronisation automatique vers `ios/App/App/DesignTokens.generated.swift`.
5. Intégrer les compétences externes requises (`wondelai/skills@ios-hig-design`, etc.).

## Iteration Procedure (Iteration Loop 2B)
As sub-orchestrator, run the iteration loop:
- Spawn 3 Explorers (`teamwork_explorer`) with PROJECT.md and M1 description.
- Spawn 1 Worker (`teamwork_worker`) with the mandatory integrity warning to implement.
- Spawn 2 Reviewers (`teamwork_reviewer`) to review correctness and run tests.
- Spawn 2 Challengers (`teamwork_challenger`) to stress-test.
- Spawn 1 Forensic Auditor (`teamwork_auditor`) for integrity verification.
- Gate check: evaluate auditor FIRST (binary veto), all reviewers APPROVE, all challengers APPROVE.
- On PASS, update GATE_STATUS.md and write handoff.md.


## 2026-11-14T10:41:04Z
You are the Sub-Orchestrator for Milestone M1: Apple Design Tokens & Components Bank (LKDV Greens).
Your state folder is /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m1.
Working directory is /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference.
Read your task assignment in DISPATCH.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m1/DISPATCH.md, PROJECT.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md, and ORIGINAL_REQUEST.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md.
Create SCOPE.md in your state folder detailing M1 scope.
Run the Iteration Loop (2B):
1. Spawn 3 Explorers (`teamwork_explorer`) with PROJECT.md/SCOPE.md paths.
2. Spawn 1 Worker (`teamwork_worker`) with the mandatory integrity warning to implement tokens/primitives/swift generation/skills.
3. Spawn 2 Reviewers (`teamwork_reviewer`) to review and run build/tests.
4. Spawn 2 Challengers (`teamwork_challenger`) to stress-test.
5. Spawn 1 Forensic Auditor (`teamwork_auditor`) for integrity audit (hard veto).
6. Gate check: record verdicts in GATE_STATUS.md.
When the gate passes, write your handoff.md and send a message back to parent.
