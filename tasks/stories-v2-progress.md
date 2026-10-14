# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> **Canaux :** GitHub MCP (branche `feat/stories-v2`, PR #96) + Supabase MCP (cloud `icxyvwzfjbflcbqukpfz`).

## État général — 2026-10-14

- **CI 100 % verte sur le head final `1029ce8a`** (quality-gates, database-gates 1539 tests, e2e-compas, lighthouse, bundle, build-ios, Vercel).
- Prod : migrations phases 01 / 04-05 / 06 **appliquées et vérifiées** (matrice 16/16, transactions annulées).
- PR #96 prête au merge (gate opérateur).

## Phases

### 00 Baseline/ADR [x] · 01 P0 média privé [x] 🧪 · 02 Player fiable [x]
### 03 Composer [x partiel] — vidéo 60 s/25 Mo, multi-slide ≤5, idempotence ; recadrage/dessins ⬜
### 04 Audiences/rail [x partiel] — 4 audiences, anneaux vus/non-vus, batch ; pagination curseur ⬜
### 05 Vues/likes [x partiel] — vues 1 s, likes idempotents ; UI visiteurs + réponses DM ⬜
### 06 Archive/Highlights/purge [x partiel] — highlights (prod), Mes archives, purge client archived_at, cron purge (tir quotidien) ; UI Highlights ⬜
### 07 Overlays [x lean] — texte (composition v1) ; stickers interactifs ⬜
### 08 Partage/modération [partiel] — report/block/delete + masquage SQL ; partage DM/deep link + masquage UI ⬜
### 09 Perf/a11y [partiel] — batch, préchargement, aria/clavier, Lighthouse CI ✅ ; appareils réels ⬜
### 10 Rollout [partiel] — flag off, rollback, PR verte ; merge + smoke + activation cohortes = opérateur

## Journal

- 2026-10-13/14 — 16 commits : phases 00→07 lean, 08/09/10 partiels, 2 échecs CI corrigés (icônes, registre cron), matrice prod 16/16, CI finale 100 % verte.
- Backlog P2 restant : stickers interactifs (sondage/quiz/questions/curseur/décompte), mentions/liens, actions kit/parcours, réponses DM, partage/deep link, UI Highlights/visiteurs, recadrage 9:16, pagination curseur.
