# DECISIONS.md — décisions opérationnelles du chantier (ADR-lite)

## D-001 — Analyse statique strictement sur git HEAD
Date : 2026-10-09. Contexte : arbre de travail contaminé par 99 entrées non suivies d'une autre branche.
Décision : toute lecture d'analyse passe par `git ls-files` / `git show` / `git grep` (HEAD `14d80de8`).
Conséquence : fiabilité des inventaires ; les fichiers non suivis ne participent pas à la référence.

## D-002 — Aucun accès au Supabase distant dans ce run
Contexte : pas de connecteur authentifié ; politique « pas de secrets dans un process agent ».
Décision : les faits de production/catalogue distant restent `needs_validation` (D1 dans SCOPE.md).
Conséquence : les vérifications RLS/policies réelles se font sur base locale (Docker) quand le daemon
est disponible ; sinon statique uniquement.

## D-003 — Espace de mission dans `security-mission/`
Contexte : besoin de durabilité + reviewable ; pas de convention préexistante dédiée.
Décision : fichiers de registres à la racine du dépôt, non suivis par git (pas de commit par défaut).
Aucun secret n'y est écrit.

## D-004 — Dynamique = worktree propre + env hermétique
Contexte : exécuter un test dans l'arbre contaminé fausserait la baseline ; `.env.local` présent contient
des clés réelles que Vitest chargerait (la config ne neutralise que NVIDIA/OPENROUTER).
Décision : baseline et tests de patch s'exécutent avec `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` explicitement vides + worktree propre de `14d80de8`. Aucun script
`seed*`/`ops:*` lancé sans inspection préalable.

## D-005 — Rôles → types de sous-agents
Contexte : 12 rôles du programme, types de sous-agents réels limités.
Mapping : architecture/data/app-auth/money/ai/mobile/platform → `explore` (lecture) puis `general`
(écriture en lot attribué) ; qa-verifier → `general` contexte neuf ou `security-reviewer` ;
coverage-critic → `code-reviewer`/`silent-failure-hunter` selon angle. Un seul écrivain par lot.

## D-006 — Les miroirs TS de RLS ne comptent pas comme couverture RLS
Contexte : `tests/security/rlsMatrix.spec.ts` teste `lkvCan` (TS), pas les policies PostgreSQL.
Décision : les unités `U-RLS-*` ne peuvent pas être `checked` sur la base de ces suites ;
exiger des tests SQL/Data API avec rôles réels (base locale).

## D-007 — « Admin OS » hors périmètre de la référence
Contexte : le gros admin API (audit/mfa/csrf/moderation…) vit sur la branche
`feat/explorer-mobile-osm` (stash + untracked), absent de main.
Décision : non audité ici ; consigné comme travail concurrent à ne pas écraser. Si cette branche
doit être auditée, ouvrir une mission dédiée sur sa référence.
