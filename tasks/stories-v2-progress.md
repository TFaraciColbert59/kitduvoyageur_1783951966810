# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux :** GitHub MCP (code, branche `feat/stories-v2`) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche : `feat/stories-v2` — PR **#96** ouverte vers `main`.
- Prod : migrations phases 01 + 04/05 **appliquées et vérifiées** (matrice 16/16).
- CI : `database-gates` ✅ (1539 tests pgTAP, base éphémère) ; `quality-gates` (type-check/lint/vitest/build) en cours sur le head final — visible dans les checks de la PR.

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
### Phase 01 — P0 Storage privé + ACL + compat [x]
### Phase 02 — Player photo/vidéo fiable [x]
- Arbitre unique ; progression rAF/timeupdate pausable au point exact ; pause onglet/buffering/erreur ; média cassé → Ignorer ; vidéo muette + son ; autoplay refusé → reprise ; préchargement.

### Phase 03 — Composer multimédia [x partiel]
- [x] Vidéo : validation 25 Mo / 60 s mesurées, aperçu muet, publication media_type/duration_ms (commit `8979b494`).
- [ ] Recadrage 9:16, multi-slide, textes — PR suivante.

### Phase 04 — Audiences + rail lu/non lu + pagination [x partiel]
- [x] 4 audiences UI + RLS ; anneaux vus/non vus ; états batchés.
- [ ] Pagination curseur (>200) ; reprise « première non vue » ; rail profil — PR suivante.

### Phase 05 — Vues + likes + réponses DM [x partiel]
- [x] Vues uniques 1 s (upsert), likes idempotents, RLS auteur/viewer.
- [ ] UI liste visiteurs (auteur) ; réponses DM canoniques — PR suivante.

### Phase 06 — Archive + Highlights + purge serveur [ ]
### Phase 07 — Overlays + stickers + actions LKDV [ ]
### Phase 08 — Partage + modération + anti-spam [ ]
### Phase 09 — Perf/a11y/tests de charge [ ] (préchargement 1 image, batch, clavier/aria déjà en place)
### Phase 10 — Rollout + release/rollback + rapport [x partiel]
- [x] Flag désactivé, rollback documenté, PR + preuves CI.
- [ ] Activation cohortes après smoke mobile.

## Journal

- 2026-10-13 — Phases 00/01 : migration P0 appliquée prod + vérifiée 16/16 ; route + client + pgTAP.
- 2026-10-13 — Phase 02 : player fiable.
- 2026-10-13 — Phases 04/05 : audiences, anneaux, vues 1 s, likes.
- 2026-10-13 — Phase 03a : upload vidéo.
- 2026-10-13 — CI database-gates ✅ 1539 tests dont matrice stories_v2_access (16) ; quality-gates en cours.
