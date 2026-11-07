# Bundle — Kit Studio : finir, consolider, brancher la 3D

Version du 7 novembre 2026, commit de départ `21a4b11`. Remplace le bundle du 5 novembre, dont le constat principal est devenu faux.

## Démarrer

1. Décompresser ce bundle à la racine du dépôt `kitduvoyageur_1783951966810` (dossier `kit-studio-bundle/`).
2. Coller le contenu de **`PROMPT-DEMARRAGE.md`** dans l'agent.

C'est tout. Le prompt renvoie vers le reste dans le bon ordre.

## À savoir avant toute chose

Le Kit Studio **existe déjà** dans le dépôt : 133 fichiers, 27 438 lignes, 31 suites de tests, livré par la PR #142 et vérifié en production. Le bundle du 5 novembre a été exécuté.

Ce bundle-ci ne sert donc pas à porter une maquette. Il sert à **finir ce qui a été laissé ouvert** — la couche de données, surtout — à **supprimer le Kit Studio en double**, et à **brancher le moteur 3D et de matières** livré le 7 novembre.

## Contenu

| Chemin | Rôle |
| --- | --- |
| `PROMPT-DEMARRAGE.md` | **La consigne à coller dans l'agent.** Point d'entrée unique |
| `AUDIT-2026-11-07.md` | État réel du dépôt, ce qui manque vraiment, les trois chemins chiffrés |
| `CHANTIER-AUTONOME.md` | Les 7 phases, leurs portes vérifiables, l'architecture cible, la définition de « terminé » |
| `spec/moteur-3d-matieres.md` | Le contrat 3D : UV en mètres, les 10 cartes de matière, les bancs de textures, le pipeline d'import, les budgets, la dégradation |
| `spec/dom-contract.md` | 52 identifiants et 16 attributs à garder |
| `spec/data-model.md` | Types du moteur et correspondance avec Supabase |
| `db/` | Les deux migrations **jamais appliquées**, et le rollback de la seconde |
| `reference/kit-studio.html` | La maquette d'origine (`?debug=1` : hasard reproductible, moteur exposé) |
| `reference/section-map.txt` | Où trouver chaque fonction dans la maquette |
| `reference/screenshots/` | 19 captures de référence (390 × 844, DPR 2) |
| `tests/kit-studio/` | Scénario, valeurs du moteur, textes attendus, banc `parity.spec.ts` |
| `playwright.kit-studio.config.ts` | Configuration du banc de parité |
| `historique/` | L'audit, le plan et le prompt du 5 novembre. **Périmés sur trois points, voir ci-dessous** |

## Le dossier `historique/`

Il est conservé parce qu'il contient deux choses toujours utiles : les **14 constats C1–C14** (décisions de portage que le code livré respecte, à ne pas rejouer) et la **Phase 5 — Vraies données** du plan, qui est la spec de la première phase du chantier.

Mais trois de ses instructions sont devenues dangereuses, et le prompt de démarrage les neutralise explicitement :

| Instruction du 5 novembre | Réalité |
| --- | --- |
| « Le dépôt ne contient aucun Kit Studio : tout est à porter » | 27 438 lignes existent, vérifiées en production |
| « Ajouter `three@0.149.0` exactement » | Le dépôt est en `0.186.0`, tout est écrit pour cette version |
| « Route retenue : `/materiel/studio` » | La route livrée est `/kit-studio` |

Sa section « Architecture cible » ne décrit pas non plus le code livré : l'agent qui a exécuté le bundle a dévié (`domain/` au lieu de `engine/`, `three` 186 au lieu de 149). **Le code livré fait foi.**

## Ce que l'agent doit obtenir

Un seul Kit Studio, branché sur la vraie donnée, capable de recevoir un élément modélisé en 3D et de lui appliquer le système de matières complet, sans retouche manuelle.

Les six critères à prouver sont à la fin de `CHANTIER-AUTONOME.md`.

## Lancer le banc de parité (phase P5, facultative)

```bash
KS_APP_URL=reference npx playwright test -c playwright.kit-studio.config.ts            # référence contre elle-même
KS_APP_URL=http://localhost:4000 npx playwright test -c playwright.kit-studio.config.ts # application contre référence
```

Les écarts d'image par étape sont écrits dans `test-results/kit-studio/ecarts.tsv`. La validation de la référence contre elle-même, faite le 5 novembre, est dans `historique/VALIDATION.txt`.

Attention : la parité au pixel et les phases P1 à P3 tirent en sens inverse — la vraie donnée et l'unification changeront des valeurs que les goldens figent. Voir la mise en garde de la phase P5.
