# H0 — Baseline verrouillée (chantier/etape2-hub-unique@370fc9c5)

Date : 2026-09-10. Référence commits : `H0_baseline_commits.txt`.
Contexte : hub v7 déjà en place (coquille, sidebars, budget, sections).
Travail H3-H8 du plan adapté en DELTAS (jamais de recréation).

- `src/features/hub/` : 81 fichiers.
- `src/app/hub/` : 8 fichiers (`page`, `layout`, `[section]`, `nouveau` + états).
- `src/features/trips/components/widgets/` : 2 fichiers restants (widgets migrés).
- `src/components/mobile-nav/BottomTabBar.tsx` : 1026 lignes.
- Migrations `feature_flags` / `telemetry` : aucune.
- `deriveHubNature` / `NaturePill` / `hub_nature_pref` : inexistants (à créer H3).
- Déjà fait sur la branche (composition, ne pas refaire) : redirects 307
  `/materiel/*` → `/hub` (commit f319ccb8), suppressions à preuves (3e46a13e),
  `selectHubWidgets` + spec 4 tests (67b9a86c).

## Écarts honnêtes vs plan d'origine (main@8e3b7ffa)

- BottomTabBar : plan 1071 → 1039 sur main → 1026 ici.
- 13e widget trip : introuvable (12 sur main, 2 restants ici après migration).
- Routing existant `/hub/[section]` (URL-driven + registre) : les routes
  `/hub/[nature]/[section]` du plan NE seront PAS créées (duplication).
- Spec engine : `src/features/hub/engine/__tests__/hubNature.test.ts`
  (le chemin `hubProfileEngine.spec.ts` du plan ne matche pas `vitest.config.ts`).

## Conclusion H0.1

Baseline reproductible : VERT. GO pour H3 (deltas).
