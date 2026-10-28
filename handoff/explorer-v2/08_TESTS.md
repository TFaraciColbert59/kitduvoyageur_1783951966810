# 08 · Tests et preuves

## 1. Outils (déjà dans le dépôt, gratuits)
Playwright 1.63 (projets `mobile-chromium`, `mobile-webkit`, `desktop-chromium`), Vitest 4, `@axe-core/playwright` (ajouter si absent), Lighthouse CI (workflow existant), MCP Playwright si disponible (sinon `npx playwright` en terminal : suffisant).

## 2. Organisation
```
tests/explorer-v2/
  fixtures/scenes.ts          // ouvre ?scene=<nom> (dev uniquement)
  fixtures/gps.ts             // rejoue un GPX via context.setGeolocation à cadence réelle ou accélérée
  fixtures/tracks/*.gpx       // une trace par sport (générées depuis hiking_routes réels, pas inventées)
  <Ecran>.spec.ts             // un fichier par écran (42)
  map-camera.spec.ts, map-hierarchy.spec.ts, sheet.spec.ts, activity-*.spec.ts, offline.spec.ts, a11y.spec.ts, perf.spec.ts, security.spec.ts
```
Tag `@explorer-v2` sur chaque test. Exécution : `npx playwright test --grep @explorer-v2 --project=mobile-chromium --project=mobile-webkit`.

## 3. Inventaire de clics (obligatoire, 100 %)
`scripts/explorer-v2/click-inventory.mjs` parcourt chaque scène, liste tout élément interactif (`button`, `[role=tab]`, `[role=button]`, repères de carte, crans), et vérifie qu’un test l’a exercé (journal d’événements `window.__explorerEvents` activé en test). Sortie : `docs/explorer-v2/COUVERTURE_CLICS.md`, échec si < 100 %.

## 4. Parité visuelle
Pour chaque écran : capture réelle 390×844 (`mobile-webkit`, iPhone 15) à la même scène que la maquette, assemblée côte à côte avec `maquette/captures/<Ecran>.png` (script `sharp`, déjà installé) dans `docs/explorer-v2/parite/<Ecran>.png`. Critères vérifiés par l’agent et notés dans `PARITE.md` : même structure, mêmes onglets et boutons, même hiérarchie, mêmes couleurs de jetons, aucun élément en plus ni en moins (sauf données absentes masquées, justifiées). Ensuite, les captures réelles deviennent les références `toHaveScreenshot` (seuil 2 %).

## 5. Performance, a11y, sécurité
- Perf : `next build` (First Load JS), Lighthouse CI mobile, trace Playwright (`page.tracing` + `requestAnimationFrame` sampler) pendant chaque mouvement de caméra, mémoire via CDP.
- A11y : axe sur les 42 scènes (zéro « serious »/« critical »), navigation clavier sur desktop, `prefers-reduced-motion`, texte 200 %.
- Sécurité : intrusion RLS (lecture croisée refusée), routes API (Zod refuse les entrées invalides, rate limit renvoie 429), CSP, `rg` des secrets.

## 6. Contrôles grep bloquants
```bash
! rg -n "E4501C" src
! rg -n "TODO|FIXME|lorem|EXAMPLE_TRAIL|mock" src/features/explorer-v2 src/app/explorer
! rg -n "lwrmuggefbmboikjgudc" -g '!handoff/**' .
! rg -n "SERVICE_ROLE" src/features/explorer-v2 src/components
! rg -n "src/(app|features)/compas" <(git diff --name-only origin/main...)
```

## 7. `scripts/explorer-v2/verify-all.mjs`
Exécute dans l’ordre et s’arrête au premier échec (code ≠ 0) : type-check · lint · Vitest `explorer-v2` · `next build` + lecture du First Load JS `/explorer` (≤ 170 Ko) · Playwright `@explorer-v2` sur mobile-chromium et mobile-webkit · inventaire de clics 100 % · axe · contrôles grep §6 · intrusion RLS · nombre de cases non cochées dans `07_CHECKLIST.md` = 0 (en phase 10 seulement ; avant, l’affiche sans échouer). Écrit un résumé horodaté dans `docs/explorer-v2/VERIFY_LAST.md`.
