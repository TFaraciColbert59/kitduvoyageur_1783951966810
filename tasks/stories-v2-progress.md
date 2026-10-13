# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux d'exécution :** GitHub MCP (code, branche `feat/stories-v2`) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche : `feat/stories-v2` (depuis `main` @ `23ca4830`).
- Prod : migration phase 01 **appliquée** (2026-10-13) — additive, idempotente, compatible avec l'app déployée.
- Local : worktree/agent parallèle hors périmètre ; fichiers stories = `CommunityStoriesBar`, `StoriesViewer`, `src/lib/stories/*`, `src/app/api/stories/*`.

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
- [x] Inventaire code/migrations/tests/flags ; ADR-017 ; docs de mission ; baseline QA_REPORT.
- Preuve : `docs/adr/ADR-017`, `docs/stories-v2/*`.

### Phase 01 — P0 Storage privé + ACL + compat [x]
- [x] Migration `20261013280000` (colonnes, can_view_story, RLS unifiée, close_friends/hidden, bucket privé, idempotence) — **appliquée prod** + fichier repo.
- [x] Flag `stories_v2` (migration `20261013281000`) — inséré prod.
- [x] Route `/api/stories/:id/media` + `src/lib/stories/media.ts` — poussés.
- [x] Test pgTAP `stories_v2_access.test.sql` (16 assertions) — poussé (exécution locale = opérateur).
- [x] Intégration client (upload privé, normalisation, suppression multi-bucket) — commit 2.
- Preuves : vérifications MCP (SECURITY_MATRIX), matrice prod (à exécuter), commit 1+2.

### Phase 02 — Player photo/vidéo fiable [ ]
### Phase 03 — Composer multimédia [ ]
### Phase 04 — Audiences + rail lu/non lu + pagination [ ]
### Phase 05 — Vues + likes + réponses DM [ ]
### Phase 06 — Archive + Highlights + purge serveur [ ]
### Phase 07 — Overlays + stickers + actions LKDV [ ]
### Phase 08 — Partage + modération + anti-spam [ ]
### Phase 09 — Perf/a11y/tests de charge [ ]
### Phase 10 — Rollout + release/rollback + rapport [ ]

## Journal

- 2026-10-13 — Phase 00 : inventaire complet ; ADR-017 + docs de mission.
- 2026-10-13 — Phase 01 : migration appliquée prod (vérifiée), flag inséré, commit 1 (migrations/route/lib/tests/docs) sur `feat/stories-v2` ; commit 2 = intégration client.
