# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> Convention : `[ ] / [x] / blocked` + preuve. Ne jamais écraser `tasks/plan.md` ni `tasks/todo.md`.
> **Canaux :** GitHub MCP (code, branche `feat/stories-v2`, PR #96) + Supabase MCP (base cloud `icxyvwzfjbflcbqukpfz`). Git local/supabase CLI = opérateur.

## État général

- Branche `feat/stories-v2` — PR **#96** vers `main` (dernier commit `ff519f64`).
- Prod : migrations phases 01 / 04-05 / 06 **appliquées et vérifiées** (matrice 16/16, transactions annulées).
- CI : `database-gates` ✅ (1539 tests, base éphémère, matrice incluse) ; `quality-gates` : type-check/lint/vitest/build ✅ sur head phase-03a (échec unique = icônes volume corrigées depuis) — run final en cours sur la PR.

## Phases

### Phase 00 — Baseline, ADR, inventaire [x]
### Phase 01 — P0 Storage privé + ACL + compat [x] 🧪
### Phase 02 — Player photo/vidéo fiable [x]
### Phase 03 — Composer multimédia [x partiel]
- [x] Vidéo (validation 25 Mo/60 s), **multi-slide ≤5**, légende, idempotence.
- [ ] Recadrage 9:16, dessins (backlog).

### Phase 04 — Audiences + rail lu/non lu + pagination [x partiel]
- [x] 4 audiences UI+RLS, anneaux vus/non vus, états batchés.
- [ ] Pagination curseur, reprise première non vue, rail profil (backlog).

### Phase 05 — Vues + likes + réponses DM [x partiel]
- [x] Vues 1 s upsert, likes idempotents, RLS.
- [ ] UI liste visiteurs, réponses DM (P2).

### Phase 06 — Archive + Highlights + purge serveur [x partiel]
- [x] Tables highlights+items (prod), index purge, **panneau Mes archives**, **purge client respecte archived_at**, **cron /api/cron/purge-stories**.
- [ ] UI gestion Highlights, planification cron (opérateur).

### Phase 07 — Overlays + stickers + actions LKDV [x lean]
- [x] **Texte overlay** (composition v1, composer + viewer).
- [ ] Sondages/quiz/questions/curseur/décompte, mentions/liens, actions kit/parcours (P2).

### Phase 08 — Partage + modération + anti-spam [partiel]
- [x] Signaler/bloquer/supprimer (F-027 + viewer), masquage serveur (story_hidden_users, SQL).
- [ ] Partage DM/deep link, masquage UI, commentaires publics (P2).

### Phase 09 — Perf/a11y/tests de charge [partiel]
- [x] Requêtes batchées (2 pour le rail), préchargement 1 image, clavier/focus trap/aria, zoom textes, Lighthouse CI sur la PR.
- [ ] Audit appareils réels (iOS/Android), tests de charge (opérateur).

### Phase 10 — Rollout + release/rollback + rapport [partiel]
- [x] Flag `stories_v2=false`, rollback documenté, PR + preuves CI, rapport QA.
- [ ] Merge + smoke mobile + activation cohortes (opérateur).

## Journal

- 2026-10-13 — Phases 00→05 livrées (P0 vérifié prod 16/16 ; player ; audiences/vues/likes ; upload vidéo).
- 2026-10-13 — Phase 06 noyau (highlights, index, cron purge).
- 2026-10-14 — Corrections Gate 0 (icônes, token CSS).
- 2026-10-14 — 03b multi-slide + 06 UI archives + 07 lean texte + purge respectueuse des archives (`ff519f64`).
- Restant P2 : stickers interactifs, partage DM, UI visiteurs/highlights, recadrage. Opérateur : smoke mobile, merge, planif cron, activation.
