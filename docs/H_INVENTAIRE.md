# H_INVENTAIRE — Références skills, portes et tests de départ

**Base** : `8e3b7ffa` (`chantier/h-hub-voyageur`) · **Mesuré** : H0, 08/09/2026. Toute valeur ci-dessous est remesurée ; ne jamais la recopier dans `H_REPORT.md` sans remesure.

## 1. Compteurs de référence (planchers — jamais décroissants)

| Indicateur | Valeur H0 | Commande |
|---|---|---|
| Tests | **1051 passed / 141 suites / 0 failed** | `npm test` (`vitest run` v4.1.11, 8,74 s) |
| Type-check | **0 erreur** (`tsc --noEmit` EXIT 0) | `npm run type-check` |
| Garde-fou Y-D80 | **12/12 vert** | `npx vitest run tests/design/y-d80-guard.spec.ts` |
| Invariants CI | succès (1a,1b,2,3,4a,4b,4c,5a,5b) | `node scripts/verify/ci_invariants.mjs` |
| Violations Y | 0 (régénéré 2026-09-08) | `docs/Y_VIOLATIONS.md` |

## 2. Skills par phase (chargeables via skill_view)

| Phase | Skills | Absentes → substitut (cf. H_DECISIONS H-AUTO-1/2) |
|---|---|---|
| H0 | verification-before-completion, lkdv-development, using-superpowers, finishing-a-development-branch, github-workflow | — |
| H1 | test-driven-development, testing-qa (⊃ anti-patterns), code-quality, writing-plans | testing-anti-patterns → testing-qa |
| H2 | apple-ui-designer, interaction-design, ux-mobile, code-quality | — |
| H3 | nextjs-performance, executing-plans, lkdv-development, apple-ui-designer | — |
| H4 | dispatching-parallel-agents, subagent-driven-development, apple-ui-designer, interaction-design, ux-mobile | — |
| H5 | apple-ui-designer, interaction-design, ux-mobile, ai-engineering-toolkit | — |
| H6 | claude-android-skill, ux-mobile, interaction-design, apple-ui-designer | — |
| H7 | nextjs-performance, code-quality, security-audit, requesting-code-review, receiving-code-review | — |
| H8 | verification-before-completion, finishing-a-development-branch, github-workflow | — |
| Transverses | verification-before-completion, systematic-debugging (⊃ root-cause-tracing), using-git-worktrees, executing-plans, lkdv-development | root-cause-tracing → systematic-debugging |

## 3. Portes G1–G6 (définitions figées)

| Porte | Commande | Seuil |
|---|---|---|
| G1 type-check | `npm run type-check` | 0 erreur |
| G2 tests | `npm test` | 0 échec, total ≥ 1051 |
| G3 garde-fous | `npx vitest run tests/design/y-d80-guard.spec.ts` + `node scripts/verify/ci_invariants.mjs` + garde-fou H-D85 (H1) | 12/12 + succès + 0 violation |
| G4 build | `npm run build` | EXIT 0 |
| G5 captures | planche de contact inspectée (avant/après) | 0 régression hors masques nommés |
| G6 a11y | `axe` sur `/hub` × 3 viewports × 3 natures | 0 critical/serious |

## 4. Socles réutilisables (ne pas reconstruire)

| Actif | Emplacement | Usage H |
|---|---|---|
| `deriveTripProfile` + tripProfileEngine | `src/` + `tests/features/trips/` (Y6/Y7) | Composition nature sortie (R2 — jamais dupliqué) |
| `ActiveTripContext` + `ActiveTripSwitcher` (cmdk/GlassSheet) | `src/` (Y) | Généralisation ActiveAdventureContext + AdventureSwitcher |
| `TripSectionPicker` | livré Y, testé | Généralisation HubSectionPicker |
| `useHubStore` (GPS/batterie/ultra-save, 6 787 o) | `src/features/hub/stores/` | Migré HubShell (D1) |
| `BaseCampView` / `ActionModeView` + widgets | `src/features/hub/components/` | Vues possession / mode live (D1) |
| `shakedownEngine` canonique (Z2) | `src/` + `tests/trips/chantier-z2.spec.ts` | Moteur possession (jamais dupliqué) |
| `HikingCockpitPage` | `src/features/hiking/` | Mode live canonique (D2) |
| Seed 8 voyages déterministes | `scripts/seed/seed_y_profiles.mjs` | Recette H8 |
| Viewports | `playwright.visual.config.ts` (1440×900, 430×932, 834×1194) | Captures H3–H8 |

## 5. Fichiers cibles par phase (lecture obligatoire avant code)

- H1 : `src/features/hub/**` (existant), `tests/design/y-d80-guard.spec.ts`, `scripts/design/y-d80-count.mjs`
- H2 : ActiveTripContext/Switcher (localiser par grep), `src/components/mobile-nav/BottomTabBar.tsx` (42 072 o)
- H3 : `src/app/hub/**` (à créer), `src/app/voyages/[slug]/**`, `src/app/terrain/**`
- H4 : `src/app/materiel/**`, `src/app/groupes/page.tsx` (monolithe), `src/app/equipages/**`
- H5 : `src/components/mobile-nav/**`, `src/middleware.ts`, `src/app/copilote/**`
- H6 : `useAndroidTripBackNav` (localiser), offline `dexie` (localiser), safe-areas existantes
