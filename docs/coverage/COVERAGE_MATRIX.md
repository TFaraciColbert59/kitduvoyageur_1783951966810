# Matrice de couverture — Phase 4

> Généré le 2026-09-12T07:00:46.410Z par `scripts/coverage/generate_matrix.ts`.
> Cibles issues de `docs/analysis/SYNTHESIS_DECISIONS.md` (décision D-B) :
> 5 pays pilotes + 3 extensions régionales. Décision documentaire, pas une couverture.

> **Statut global : INSUFFICIENT_DATA** — aucune donnée géographique sous licence n'est importée à ce stade.
> **Feature flag `coverage_publication_enabled` : désactivé** — l'activation est une décision humaine.
> **Régions `covered` dans les données : 0.** Aucune région ne peut être déclarée couverte sans dataset licencié, seuils atteints et 20 parcours échantillonnés humainement.

| Cible | Type | Pays | Région | Statut | Dataset | Version | Géométries valides | POI sourcés | Échantillons | Licence | Importé le | Publié le |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| France | Pays | FR | — | not_covered | — | — | — | — | — | — | — | — |
| Islande | Pays | IS | — | not_covered | — | — | — | — | — | — | — | — |
| Maroc | Pays | MA | — | not_covered | — | — | — | — | — | — | — | — |
| Italie | Pays | IT | — | not_covered | — | — | — | — | — | — | — | — |
| Népal | Pays | NP | — | not_covered | — | — | — | — | — | — | — | — |
| Madère | Région | PT | PT-30 | not_covered | — | — | — | — | — | — | — | — |
| Jura | Région | FR | FR-JURA | not_covered | — | — | — | — | — | — | — | — |
| Kumano Kodo | Région | JP | JP-KUMANO | not_covered | — | — | — | — | — | — | — | — |

## Lecture

- `not_covered` : aucune donnée importée, aucune promesse de navigation.
- `experimental` : données présentes mais gates incomplets (jamais exposé publiquement comme couvert).
- `covered` : dataset licencié, seuils atteints, échantillonnage humain ≥ 20, requêtes sous SLO, rollback possible.

**Ce document ne déclare AUCUNE couverture réelle.** Il est régénéré par un script, jamais édité à la main.
