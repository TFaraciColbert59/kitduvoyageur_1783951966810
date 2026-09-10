# H3 — Rapport de complétion (deltas sur hub v7)

## 1. Fichiers (créés ce tour, branche chantier/etape2-hub-unique)

- `src/features/hub/engine/hubNature.ts` (nouveau, pur, SSR-safe)
- `src/features/hub/engine/__tests__/hubNature.test.ts` (11 tests)
- `src/features/hub/components/NaturePill.tsx` (Matériel/Voyage/Rando ▾, 44px, ARIA)
- `src/features/hub/components/NatureSwitcherSheet.tsx` (GlassSheet, 3 vignettes `data-testid`, haptique gardée, reset long-press)
- `src/features/hub/components/HubShell.tsx` (modifié : pill mobile + desktop, sheet branchée sur pref + `setActiveAdventure` possession)

Non fait volontairement (composition, pas duplication) : routes
`/hub/[nature]/[section]` (existant `/hub/[section]` + registre suffit),
refonte `AdventureSwitcher`, re-scoring dans `hubNature`.

## 2. Gates (sorties littérales)

- `npx vitest run src/features/hub/engine/__tests__/hubNature.test.ts` → `1 passed`, `11 passed`
- `npx vitest run tests/hub.spec.ts` → `1 passed`, `7 passed` (non-régression)
- `npx tsc --noEmit` → 0 `error TS`
- `grep service_role src/app/hub+src/features/hub` → 0 ; `grep window.print` → 0
- `npm run build` → `✓ Compiled successfully`, types OK ; échec `Collecting page data`
  (`PageNotFoundError /admin`, puis `/_document` sans mes changements via `git stash -u`)
  → PRÉ-EXISTANT, non causé par H3 (preuve : build baseline identique après stash).

## 3. Captures / E2E

NON TESTÉ ce tour (serveur dev + Playwright non lancés) : `h3_sortie.spec.ts`
reste à exécuter avant PR. Pill vérifiée par code + types, pas au navigateur.

## 4-5. Conclusion

Phase H3 : VERT partiel — go/no-go = GO pour H4, avec E2E reportée (notée NON TESTÉ).
AUCUN TODO caché : l'E2E navigateur est la seule dette explicite.
