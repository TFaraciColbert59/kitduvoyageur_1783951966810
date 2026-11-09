# Décisions prises seul (ordinateur de bord)

Format : `templates/DECISION.md`. Les décisions « à montrer à Tony » sont reprises dans le rapport final.

## D-0001 — Worktree séparé pour le chantier CRM

- **Date** : 2026-11-09 · **Par** : orchestrateur · **Tâche** : T-0.01 · **Exigences** : EX-GEN-01
- **Contexte** : la copie de travail principale est sur `fix/carnet-404` avec 4 fichiers modifiés non commités (travail de Tony sur le carnet). Le chantier CRM ne doit pas les toucher ni les embarquer.
- **Options étudiées** :
  1. Travailler dans la copie existante — risque d'embarquer des changements non liés, branches mélangées.
  2. Créer un `git worktree` sur une nouvelle branche depuis `origin/main` — isolation totale, même dépôt, même remote.
- **Choix** : option 2 — worktree `/Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-control-work`, branche `crm/phase-0-preparation`.
- **Pourquoi** : n'altère pas l'état de Tony ; permet des commits propres par phase ; le bundle est copié dans `crm/bundle/`.
- **Alternative écartée** : travailler sur `main` directement (interdit : PR par phase).
- **Comment défaire** : `git worktree remove lkdv-control-work` et suppression de la branche.
- **À montrer à Tony** : non
