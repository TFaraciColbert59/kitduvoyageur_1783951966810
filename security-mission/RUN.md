# RUN.md — Programme de sécurisation LKDV

État au 2026-10-09 (session 1). Fichier maître de reprise — lire avec `checkpoints/NEXT_SESSION.md`.

## Mission

Exécution du programme de sécurisation LKDV (voir prompt maître) : découverte → menace → audit →
corrections ciblées en branche isolée → vérification indépendante → livrables reviewables.
Autorité : autonomie étendue pour améliorations réversibles en local ; aucun effet production,
aucune décision juridique, aucun engagement externe (voir `SCOPE.md`).

## Référence figée

- Dépôt : `TFaraciColbert59/kitduvoyageur_1783951966810` (local : `C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810`).
- Branche : `main` — commit `14d80de870930f454096390e1a7f6636fd105750` (= `origin/main`, vérifié 2026-10-09).
- Le commit `ba5166ee…` cité dans le dossier de recherche **n'existe pas** dans ce clone (`git log ba5166ee` → `fatal: Not a valid object name`). Toutes les observations du dossier sont donc à revalider sur `14d80de8` (voir écarts ci-dessous). Aucune preuve historique n'est reprise telle quelle.

## Écarts dossier ↔ référence actuelle (relevés le 2026-10-09)

| Point | Dossier (ref ba5166ee) | Réel sur 14d80de8 |
| --- | --- | --- |
| Routes API `src/app/api/**/route.ts` | 138 | **123** |
| Migrations `supabase/migrations/*.sql` | 279 | **251** |
| Fichiers `.spec/.test` (src+tests) | 721 | **659** |
| Workflow `db-backup.yml` | annoncé | **absent** ; workflows réels : `ci.yml`, `ios.yml`, `lighthouse-ci.yml`, `nextjs.yml`, `visual-regression.yml` |
| Ref observée | `ba5166ee…` | `14d80de8…` (objet absent du clone) |

## Environnement de travail

- Arbre de travail **contaminé** : 99 entrées non suivies (fichiers admin-os, messaging, tests… issus de `feat/explorer-mobile-osm`) + `stash@{0}: WIP avant passage sur main`. Ces fichiers ne font PAS partie de la référence.
  → Analyse statique : strictement basée sur `git` (HEAD) — `git ls-files`, `git show`, `git grep`.
  → Tests dynamiques : sur worktree propre de `14d80de8` ou avec includes restreints, jamais sur les fichiers non suivis.
- Outils vérifiés : Node v24.18.0, npm 12.0.2, Docker 29.7.2, supabase CLI (global), Playwright browsers présents, node_modules présent.
- Secrets locaux présents (`.env`, `.env.local`) : **jamais lus par les agents** (policy `SCOPE.md`).

## Mode d'exécution

- Sous-agents natifs (Task tool) : contextes séparés → mode « Native / orchestration équivalente ».
- Contrainte : pas d'isolation système par sous-agent (même machine, même arbre) → règle **un seul écrivain par lot**, vérificateur = contexte neuf + assertions exécutées.
- Budgets opérationnels : ≤ 4 sous-agents simultanés, 1 build/test lourd à la fois, 3 tentatives par approche.

## État par phase

| Phase | État | Note |
| --- | --- | --- |
| P0 Préflight | en cours | capabilities ci-dessous |
| P1 Inventaire | en cours | `ARCHITECTURE.md` v0.1 |
| P2 Menaces | à faire | |
| P3 Audit vagues | à faire | |
| P4/P5 Corrections | à faire | |
| P6/P7 Livraison | à faire | |
| P8 Maintien | à faire | |

## Propriétaires d'objets exclusifs (un seul écrivain)

- Migrations SQL / schema : à attribuer (agent `data`).
- Auth partagée (`src/middleware.ts`, `src/lib/supabase/*`) : orchestrateur seulement.
- CI/workflows/lockfile/dépendances : agent `platform` (après revue).
- Registres (`security-mission/*.json|md`) : orchestrateur uniquement.

## Blocages connus

1. Accès Supabase distant : aucun connecteur MCP/CLI authentifié pour ce run → lectures catalogue distantes impossibles sans credentials ; décision en attente (voir `SCOPE.md` §Décisions humaines). Travail en cours : statique + base locale Docker si nécessaire.
2. Sandbox système absent : toute exécution de code cible est limitée par la policy `SCOPE.md` §Exécution.
