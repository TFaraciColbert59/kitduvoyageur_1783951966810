# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux :** GitHub MCP (code, branche `feat/stories-v2`) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche : `feat/stories-v2` — PR **#96** vers `main`.
- Prod : migrations phases 01 / 04-05 / 06 **appliquées et vérifiées** (matrice 16/16).
- CI : `database-gates` ✅ (1539 tests pgTAP dont la matrice stories_v2_access) ; `quality-gates` en cours sur la PR (checks visibles).

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
### Phase 01 — P0 Storage privé + ACL + compat [x]
### Phase 02 — Player photo/vidéo fiable [x]
### Phase 03 — Composer multimédia [x partiel]
- [x] Vidéo (validation 25 Mo / 60 s mesurées, aperçu, media_type/duration_ms).
- [ ] Recadrage 9:16, multi-slide, textes — tranche suivante.

### Phase 04 — Audiences + rail lu/non lu + pagination [x partiel]
- [x] 4 audiences UI + RLS ; anneaux vus/non vus ; états batchés.
- [ ] Pagination curseur ; reprise « première non vue » ; rail profil.

### Phase 05 — Vues + likes + réponses DM [x partiel]
- [x] Vues uniques 1 s ; likes idempotents ; RLS.
- [ ] UI liste visiteurs (auteur) ; réponses DM canoniques.

### Phase 06 — Archive + Highlights + purge serveur [x partiel]
- [x] Tables `story_highlights` + `story_highlight_items` (RLS) appliquées prod (migration `20261013283000`).
- [x] Route `/api/cron/purge-stories` : lots de 200, archives préservées (`archived_at IS NULL`), objets Storage d'abord puis lignes, idempotente, `CRON_SECRET`.
- [x] Index partiel de purge `(expires_at) WHERE archived_at IS NULL`.
- [ ] UI archive (« Mes archives ») + gestion Highlights (créer/ordonner) ; retirer l'auto-nettoyage client ; planifier le cron (Vercel/ops).

### Phase 07 — Overlays + stickers + actions LKDV [ ]
### Phase 08 — Partage + modération + anti-spam [ ]
### Phase 09 — Perf/a11y/tests de charge [ ] (batch + préchargement + clavier/aria déjà en place ; audit formel restant)
### Phase 10 — Rollout + release/rollback + rapport [x partiel]
- [x] Flag `stories_v2=false`, rollback documenté, PR + preuves CI.
- [ ] Activation par cohortes après smoke mobile + planification cron.

## Journal

- 2026-10-13 — Phases 00→05 livrées (P0 vérifié prod 16/16 ; player ; audiences/vues/likes ; upload vidéo).
- 2026-10-13 — Phase 06 noyau : highlights + index purge appliqués prod ; route cron de purge poussée.
- 2026-10-13 — CI : database-gates ✅ 1539 tests ; quality-gates en cours (PR #96).
