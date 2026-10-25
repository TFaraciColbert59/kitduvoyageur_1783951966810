# Stories V2 — Rapport QA

## Verdict CI — PR #96 (heads finaux, 2026-10-14)

**CI 100 % verte** (run `38524467177`, head `1029ce8a`) : quality-gates (TypeScript, ESLint, design, **vitest 10 227 tests**, build, invariants, icônes) ✅ · database-gates **Files=94, Tests=1539** ✅ · e2e-compas ✅ · lighthouse ✅ · bundle-analysis ✅ · build-ios ✅ · Vercel ✅.

Head final `9118b2ae` (albums À la une) : **TypeScript ✅, ESLint ✅, vitest ✅** (build en cours au moment du merge ; la CI de `main` re-vérifie le merge commit `0eaa5170`).

Échecs intermédiaires corrigés et documentés : Gate 0.1 (icônes `volume-x`/`volume-2` → bouton son textuel, `85ba9a29`) ; Gate 3 (route `purge-stories` non classée dans `dailyRegistry` → tir quotidien, `1029ce8a`).

## Matrice d'accès PROD — 16/16 conforme

Transactions annulées ; comptes démo réels ; détail dans SECURITY_MATRIX.md. Vérifications MCP : colonnes, `can_view_story`, policies unifiées, bucket privé + 3 policies storage, tables close_friends/hidden/views/likes/highlights.

## Post-merge (opérateur)

- [ ] Smoke mobile : photo + vidéo + multi-slide, rail, anneaux vus, viewer (maintien/son), like, archives, albums, signed URL après rechargement.
- [ ] Activation du flag `stories_v2` par cohortes (RELEASE_ROLLBACK.md).
- [ ] Appareils réels iOS/Android — non exécutable depuis la CI.
