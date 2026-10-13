# Stories V2 — Rapport QA

## Baseline (2026-10-13, avant modifications)

- `npm run type-check` : ✅ (0 erreur) — dernière exécution complète de session.
- `npm test` (vitest) : 10174/10186 (12 échecs attribués au WIP concurrent, hors périmètre stories).
- `supabase/tests/database/stories.test.sql` : 9/9 (campagne locale précédente).
- Environnements : local Supabase `127.0.0.1:54321` (données démo stories seedées), cloud `icxyvwzfjbflcbqukpfz` (3 stories réelles + 3 comptes démo).

## Phase 01 (2026-10-13)

### Appliqué en production (MCP, SQL idempotent, sans entrée d'historique)

- Colonnes additives + contraintes + index d'idempotence : vérifiés (`storage_path` = 1).
- `can_view_story` + `stories_read_visible` : vérifiés (policy list = `stories_read_visible`, insert, delete, restrictive).
- Bucket `stories-private` privé + 3 policies : vérifiés.
- Tables `story_close_friends`, `story_hidden_users` : vérifiées.
- Flag `stories_v2=false` : inséré.

### Matrice d'accès PROD — 16/16 conforme (détail : SECURITY_MATRIX.md)

Transactions annulées ; comptes démo réels ; suivis/amis proches/masquage/blocage testés par mutation temporaire puis rollback. RLS impersonnée (`set local role authenticated` + `request.jwt.claim.sub`) : 2 stories publiques lues avant blocage, 0 après.

### CI GitHub — database-gates ✅ (run 38470928214)

`All tests successful. Files=94, Tests=1539` dont `stories_v2_access.test.sql` (16 assertions) et `stories.test.sql` (F-027) — base PostgreSQL éphémère au schéma du dépôt + migrations, transactions annulées. Preuve : logs du job 115549499503.

## En cours / à confirmer

- [ ] quality-gates du head final (`8979b494`) : type-check, lint, vitest, build — en cours sur la PR #96 (les résultats s'affichent dans les checks de la PR).
- [ ] Smoke mobile après merge : rail, viewer, publication privée photo/vidéo, like, signed URL.

## Limites connues

- L'agent n'exécute pas les tests locaux dans cette session (sandbox d'outils) : la CI de la PR est la boucle de vérification réelle.
- Les échecs vitest de baseline attribués au WIP concurrent (worktree local) ne concernent pas la branche (partie de `main` propre).
