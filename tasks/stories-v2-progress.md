# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux d'exécution :** GitHub MCP (code, branche `feat/stories-v2`) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche : `feat/stories-v2` — commits `f11130d6` (P0 base/route/docs), `16701e59` (client), `docs` (preuves).
- Prod : migration phase 01 **appliquée et vérifiée** (16/16 — SECURITY_MATRIX).
- Local : WIP concurrent hors périmètre ; fichiers stories = `CommunityStoriesBar`, `StoriesViewer`, `src/lib/stories/*`, `src/app/api/stories/*`.

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
- Preuve : `docs/adr/ADR-017`, `docs/stories-v2/*`, baseline QA_REPORT.

### Phase 01 — P0 Storage privé + ACL + compat [x]
- [x] Migration `20261013280000` — **appliquée prod + vérifiée** + fichier repo.
- [x] Flag `stories_v2` (`20261013281000`) — inséré prod.
- [x] Route `/api/stories/:id/media` + `src/lib/stories/media.ts` — poussés.
- [x] Intégration client (upload privé, normalisation, purge multi-bucket, idempotence) — commit `16701e59`.
- [x] Matrice d'accès prod 16/16 (SECURITY_MATRIX.md).
- [x] Test pgTAP 16 assertions — poussé (exécution locale = opérateur).

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
- 2026-10-13 — Phase 01 : migration appliquée prod (vérifiée 16/16), flag inséré, commits `f11130d6` + `16701e59`, preuves consignées.
- 2026-10-13 — Phase 02 en cours : player photo/vidéo (machine d'état, pause fiable, erreurs).
