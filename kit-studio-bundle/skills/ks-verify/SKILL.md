---
name: ks-verify
description: Use before declaring any Kit Studio task or the whole chantier done — gates, evidence format and honest reporting.
---
# Vérifier avant d'annoncer

1. `scripts/verify-kit-studio.sh` (typage, lint, tests du module, garde-fou `/compas`, couleurs littérales, bordures colorées).
2. Playwright WebKit mobile : `npx playwright test tests/e2e-kit-studio --project=mobile-webkit`.
3. Captures 402×874 : tiroir fermé, cartes, Bilan, fiche, commande, deck ; une seule image par vérification, recadrée 800 px.
4. Recette de `spec/SPEC-DRAWER.md` : 6 points, chacun avec sa preuve.
5. Écrire la preuve : commande + résultat résumé (≤ 5 lignes) dans `docs/kit-studio/JOURNAL.md`.
6. Contrôle impossible (geste physique, appareil) : écrire « non testé » et la raison. Ne jamais cocher sans preuve.
