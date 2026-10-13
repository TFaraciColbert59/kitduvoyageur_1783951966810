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

### Preuves à compléter (opérateur / prochaines étapes agent)

- [ ] Matrice prod via utilisateurs démo (`demo.a.stories@lkdv.dev` = `24e75be2-450f-4420-9b2e-c9e3104a9136`, `demo.b.stories@lkdv.dev` = `516cc9a1-91d2-44ee-a904-f3ede40d3847`).
- [ ] `supabase/tests/database/stories_v2_access.test.sql` (16 assertions) sur la base locale.
- [ ] `npm run type-check` + `npm test -- stories` sur la branche `feat/stories-v2`.
- [ ] Playwright mobile WebKit : rail, viewer, publication privée, route média (dev local).

## Limites connues

- L'agent n'exécute pas les tests locaux dans cette session (sandbox d'outils) : les commandes exactes sont listées ci-dessus ; CI GitHub à activer sur la branche.
- Les échecs vitest de baseline attribués au WIP concurrent ne sont pas du ressort de ce chantier.
