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

## D-0002 — Base Postgres locale de vérification (shim du schéma de production)

- **Date** : 2026-11-09 · **Par** : orchestrateur · **Tâche** : T-1.02 · **Exigences** : EX-SEC-05, 07_VERIFICATION couche 3
- **Contexte** : pas de Docker ni de PostgreSQL sur la machine ; la CI GitHub est la seule base éphémère officielle, mais son cycle est lent et l'application ne peut pas être exercée sans base.
- **Options étudiées** :
  1. Attendre uniquement la CI — correct mais lent, impossible de prouver le moteur de commandes localement.
  2. Monter un PostgreSQL embarqué (paquet `embedded-postgres`) avec une copie **assainie** de la baseline de production (PostGIS remplacé par du texte, vues recréées), plus des doublures pour les tables ajoutées après la baseline.
- **Choix** : option 2, base strictement locale (`127.0.0.1:55432`), aucune donnée réelle, aucun accès réseau.
- **Pourquoi** : permet de prouver M00→M15, les 144 commandes, l'audit et les refus sans toucher la production ; la CI reste la preuve officielle (couche 3).
- **Alternative écartée** : créer un projet Supabase de test (coût et hors bundle).
- **Comment défaire** : supprimer `/tmp/pgtest`.
- **À montrer à Tony** : non
