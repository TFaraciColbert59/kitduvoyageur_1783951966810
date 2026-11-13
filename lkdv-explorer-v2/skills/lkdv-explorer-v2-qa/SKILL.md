---
name: lkdv-explorer-v2-qa
description: Use when writing or running Explorer v2 tests, parity captures, click inventory, accessibility, performance measurements, or verify-all before any gate.
---
# QA Explorer v2

- Spécification complète : `handoff/explorer-v2/08_TESTS.md`.
- Chaque écran : `tests/explorer-v2/<Ecran>.spec.ts`, tag `@explorer-v2`, projets `mobile-webkit` et `mobile-chromium`.
- Scènes : `?scene=<nom>` (dev/test seulement) pour arriver directement à un état.
- Parité : capture réelle + `maquette/captures/<Ecran>.png` côte à côte (`sharp`), jugement écrit dans `PARITE.md`.
- Inventaire de clics : tout élément interactif doit avoir été exercé ; rapport `COUVERTURE_CLICS.md`.
- Perf : trace des frames pendant chaque mouvement de caméra ; budgets `02_ARCHITECTURE.md §9`.
- A11y : axe sans violation sérieuse sur 42 scènes, cibles ≥ 44 px, réduire les animations, texte 200 %.
- Un test rouge préexistant n’est pas ignoré : il est listé avec sa preuve d’antériorité (`git stash` + exécution sur `origin/main`).
- Jamais de `test.skip` ou `fixme` ajouté pour faire passer une gate.
