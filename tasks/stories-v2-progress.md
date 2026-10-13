# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux d'exécution :** GitHub MCP (code, branche `feat/stories-v2`) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche : `feat/stories-v2` — commits : `f11130d6` (P0 base/route/docs), `16701e59` (client P0), `c3a0cc7b` (preuves), `26cf1cd2` (player), `0af66b1c` (audiences/vues/likes + migration), `9a16ca6d` (viewer like/vue), `docs` (parité).
- **PR ouverte** vers `main` : « phases 01/02/04/05 ».
- Prod : migrations phase 01 + 04/05 **appliquées et vérifiées** (16/16 — SECURITY_MATRIX). Flag `stories_v2=false`.

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
### Phase 01 — P0 Storage privé + ACL + compat [x]
- Preuves : migration vérifiée prod, matrice 16/16, pgTAP 16 assertions, route + lib + client.

### Phase 02 — Player photo/vidéo fiable [x]
- Arbitre unique anti-double-avancement ; progression rAF/timeupdate pausable au point exact ; pause onglet masqué/buffering/erreur ; média cassé → Ignorer ; vidéo playsinline muette + bouton son ; autoplay refusé → reprise ; préchargement image suivante.

### Phase 03 — Composer multimédia [ ]
- Reste : upload vidéo (MP4 H.264/AAC, poster), recadrage 9:16, multi-slide, retry avec reprise, aperçu destinataire (partiel : audience ✅).

### Phase 04 — Audiences + rail lu/non lu + pagination [x partiel]
- [x] 4 audiences à la publication (RLS serveur) ; anneaux vus/non vus ; états batchés.
- [ ] Pagination par curseur (limit 200 en attendant) ; reprise « première non vue » à l'ouverture ; rail sur le profil.

### Phase 05 — Vues + likes + réponses DM [x partiel]
- [x] Vues uniques (1 s d'affichage, upsert), lecture auteur (base), likes idempotents.
- [ ] UI liste des visiteurs (auteur) ; réponses DM via messagerie canonique ; partage/deep link.

### Phase 06 — Archive + Highlights + purge serveur [ ]
- Reste : archive privée (toggle/rétention), albums À la une, cron de purge (retirer l'auto-nettoyage client à terme), suppression RGPD complète.

### Phase 07 — Overlays + stickers + actions LKDV [ ]
### Phase 08 — Partage + modération + anti-spam [ ]
### Phase 09 — Perf/a11y/tests de charge [ ]
- Fait : requêtes batchées, préchargement 1 image, clavier/focus trap/aria sur le viewer, zoom textes.
- Reste : audit Lighthouse formel, tests de charge, iOS/Android réels.

### Phase 10 — Rollout + release/rollback + rapport [x partiel]
- [x] Flag désactivé par défaut, rollback documenté (RELEASE_ROLLBACK.md), PR + preuves.
- [ ] Activation par cohortes après smoke mobile, rapport final après merge.

## Journal

- 2026-10-13 — Phase 00/01 : migration P0 appliquée prod + vérifiée (16/16), flag, route, client, pgTAP.
- 2026-10-13 — Phase 02 : player fiable (rAF/timeupdate, arbitre unique, erreurs, vidéo).
- 2026-10-13 — Phases 04/05 : audiences UI, anneaux vus, vues 1 s, likes ; migration views/likes appliquée prod.
- 2026-10-13 — PR ouverte ; prochaines tranches : 03 (vidéo/recadrage), 06 (archive/Highlights/purge), 07/08/09/10.
