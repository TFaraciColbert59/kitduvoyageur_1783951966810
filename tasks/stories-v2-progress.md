# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> **Canaux :** GitHub MCP + Supabase MCP (cloud `icxyvwzfjbflcbqukpfz`).

## État général — 2026-10-14

- **PR #96 mergée** (`0eaa5170`) ; **PR suite ouverte** (`feat/stories-v2-suite`) : Vues auteur + masquage UI + docs de clôture.
- CI pré-merge 100 % verte (quality-gates 10 227 tests, database-gates 1539 pgTAP, e2e-compas, lighthouse, bundle, build-ios).
- Prod : migrations 01 / 04-05 / 06 appliquées et vérifiées (matrice 16/16).

## Suites

1. **Opérateur** : smoke mobile (comptes démo) sur la preview/production ; passe appareils réels (phase 09 formelle).
2. **Backlog P2** : stickers interactifs (sondage/quiz/questions/curseur/décompte), mentions/liens, actions kit/parcours, réponses DM, partage/deep link, recadrage 9:16, pagination curseur, reprise « première non vue », commentaires publics.

## Phases

- **00** ✅ · **01** ✅ 🧪 · **02** ✅ · **03** ✅* (recadrage ⬜) · **04** ✅* (pagination curseur ⬜) · **05** ✅ (vues + **UI visiteurs** + likes ; réponses DM ⬜) · **06** ✅ (archives, **albums À la une**, purge client+cron) · **07** ✅* (texte ; stickers ⬜) · **08** ✅* (report/block/delete/masquage UI ; partage DM ⬜) · **09** ◐ (CI ✅ ; devices ⬜) · **10** ◐ (mergé ; smoke + devices opérateur).

## Journal

- 2026-10-13/14 — 19 commits (PR #96) : phases 00→07 lean, CI verte, matrice prod 16/16, mergée.
- 2026-10-14 — Suite : `StoryViewsSheet` (vues auteur + masquage idempotent), viewer « Vues », barre branchée ; parité/rollback/pilotage à jour.
