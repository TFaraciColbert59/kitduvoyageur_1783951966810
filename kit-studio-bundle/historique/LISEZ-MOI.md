# Dossier historique — documents du 5 novembre 2026

Ces fichiers ont servi au premier chantier, **déjà livré et mis en production**
(PR #142, squash `0d6021b4d`). Ils sont conservés pour deux raisons :

- `AUDIT-2026-11-05.md` § 3 — les **14 constats C1–C14** sont des décisions de
  portage que le code livré respecte. Ne pas les rejouer.
- `PLAN-2026-11-05.md` § « Phase 5 — Vraies données » — c'est la spec de la
  phase P1 du chantier en cours, la seule phase du plan jamais exécutée.

## Ce qui est périmé dans ces fichiers

| Affirmation | Réalité au 7 novembre 2026 |
| --- | --- |
| « Le dépôt ne contient aucun Kit Studio : tout est à porter » | 133 fichiers, 27 438 lignes, 31 suites de tests, vérifiés en production |
| « Ajouter `three@0.149.0` exactement » | Le dépôt est en `0.186.0` ; rétrograder casse le studio livré et la scène du hub |
| « Route retenue : `/materiel/studio` » | La route livrée est `/kit-studio` |
| Section « Architecture cible » de `PLAN-2026-11-05.md` | Ne décrit pas le code livré (`domain/` et non `engine/`, `src/app/kit-studio/` et non `src/app/materiel/studio/`) |

**Le code livré fait foi.** Pour l'état réel, lire `AUDIT-2026-11-07.md` à la
racine du bundle.
