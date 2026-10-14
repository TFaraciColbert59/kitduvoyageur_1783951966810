# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories (spec `CHANTIER_LKDV_STORIES_PARITE_INSTAGRAM_2026.md`).
> **Canaux :** GitHub MCP + Supabase MCP (cloud `icxyvwzfjbflcbqukpfz`).

## État général — 2026-10-14

- **PR #96 MERGÉE dans `main`** (merge commit `0eaa5170`, 19 commits, +1977/−155).
- CI pré-merge 100 % verte sur `1029ce8a` ; head final `9118b2ae` : TypeScript/ESLint/vitest ✅ (build en cours au moment du merge — la CI de `main` re-vérifie tout sur le merge commit).
- Prod : migrations phases 01 / 04-05 / 06 **appliquées et vérifiées** (matrice 16/16, transactions annulées). Flag `stories_v2=false`.
- Vercel : déploiement production déclenché par le merge.

## Suites (opérateur)

1. **Smoke mobile** (`demo.a.stories@lkdv.dev` / `demo.b.stories@lkdv.dev`, `Lkdv-Demo-2026!`) : publier photo + vidéo + multi-slide (audience, texte), rail (anneaux vus/non-vus), viewer (maintien = pause, Espace, son), like, archives + albums « À la une », rechargement (signed URL).
2. **Activation du flag `stories_v2` par cohortes** après smoke (rollout contrôlé, cf. RELEASE_ROLLBACK.md).
3. Passe appareils réels iOS/Android (phase 09 formelle).
4. Backlog P2 : stickers interactifs (sondage/quiz/questions/curseur/décompte), mentions/liens, actions kit/parcours, réponses DM, partage/deep link, masquage UI, UI liste visiteurs, recadrage 9:16, pagination curseur.

## Phases

- **00** Baseline/ADR ✅ · **01** P0 média privé ✅ 🧪 · **02** Player fiable ✅ · **03** Composer ✅* (vidéo, multi-slide ; recadrage ⬜) · **04** Audiences/rail ✅* · **05** Vues/likes ✅* (UI visiteurs ⬜) · **06** Archive/Highlights/purge ✅ (albums À la une inclus) · **07** Overlays ✅* (texte ; stickers ⬜) · **08** Partage/modération ◐ · **09** Perf/a11y ◐ (CI ✅ ; devices ⬜) · **10** Rollout ◐ (mergé ; activation ⬜).

## Journal

- 2026-10-13/14 — 19 commits : phases 00→07 lean, 08/09/10 partiels, 2 échecs CI corrigés (icônes, registre cron), matrice prod 16/16, CI finale verte.
- 2026-10-14 — **PR #96 mergée** (`0eaa5170`) ; déploiement production en cours ; suites opérateur ci-dessus.
