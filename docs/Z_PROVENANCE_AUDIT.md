# Audit Exhaustif des Provenances de Données (Chantier Z — Z2.1)
Date : 07/09/2026
Référence git : `chantier/z2-donnees-verite`
Auteur : LKDV Quality & Integrity Pod

> **Règle Z-R1 :** Aucune valeur fabriquée ne porte une provenance officielle. Toute valeur qui n'est pas issue d'un appel réseau, d'une table, d'un calcul ou d'un fichier de données versionné et attribué prend obligatoirement `source: 'estimated'` et `confidence: 'low'`, et l'UI l'affiche comme telle.

---

## 1. Inventaire Exhaustif des Provenances

| # | Fichier & Ligne | Symbole / Entité | Valeur Déclarée (`source` / `sourceRef`) | Nature Réelle | Verdict Honnête | Action Requise |
|---|---|---|---|---|---|---|
| **P01** | `src/features/trips/blueprints/blueprintRegistry.ts:18-22` | `makeProposal()` (utilisé pour TOUTES les couches de tous les blueprints) | `source: 'official'`, `sourceRef: 'LKDV-Official-Registry'`, `confidence: 'high'` | Fabrications heuristiques codées en dur | **FABRIQUÉE** | Rétrograder en `source: 'estimated'`, `confidence: 'low'`, supprimer le faux registre |
| **P02** | `src/features/trips/connectors/realDataConnectors.ts:43-47` | `BIVOUAC_REGISTRY['FR:Vanoise']` | `source: 'official'`, `sourceRef: 'Parc National de la Vanoise — Arrêté Réglementaire'` | Règle réelle mais texte local sans lien vérifiable | **NON RÉSOLUBLE** | Ajouter URL officielle Légifrance / Arrêté Parc ou rétrograder en `source: 'estimated'` |
| **P03** | `src/features/trips/connectors/realDataConnectors.ts:55-59` | `BIVOUAC_REGISTRY['FR:Ecrins']` | `source: 'official'`, `sourceRef: 'Parc National des Écrins — Charte du Parc'` | Règle réelle mais texte local sans lien vérifiable | **NON RÉSOLUBLE** | Ajouter URL officielle Parc des Écrins ou rétrograder en `source: 'estimated'` |
| **P04** | `src/features/trips/connectors/realDataConnectors.ts:66-70` | `BIVOUAC_REGISTRY['FR:Default']` | `source: 'official'`, `sourceRef: 'Code de l’Environnement Art. R331-48'` | Article erroné (R331-48 concerne les parcs, pas le droit commun du camping/bivouac qui relève du Code de l'urbanisme R111-32 à R111-35) | **INEXACTE / DANGEREUSE** | Corriger la référence juridique (Code de l'urbanisme Art. R111-32 s.) et ajouter date/vérification |
| **P05** | `src/features/trips/connectors/realDataConnectors.ts:77-81` | `BIVOUAC_REGISTRY['IS:Default']` | `source: 'official'`, `sourceRef: 'Umhverfisstofnun'` | Résumé approximatif sans référence d'article | **NON RÉSOLUBLE** | Rétrograder en `source: 'estimated'`, mentionner « à vérifier localement » |
| **P06** | `src/features/trips/connectors/realDataConnectors.ts:88-92` | `BIVOUAC_REGISTRY['MA:Default']` | `source: 'official'`, `sourceRef: 'Fédération Royale Marocaine de Ski et Montagne'` | Usage coutumier sans source légale écrite | **NON RÉSOLUBLE** | Rétrograder en `source: 'estimated'`, mentionner « à vérifier localement » |
| **P07** | `src/features/trips/connectors/realDataConnectors.ts:115-119` | `lookupBivouacRegulation()` (fallback pays inconnus) | `source: 'official'`, `sourceRef: 'LKDV Global GeoRegistry'` | Registre fictif | **FABRIQUÉE** | Rétrograder impérativement en `source: 'estimated'`, `confidence: 'low'` |
| **P08** | `src/features/trips/connectors/realDataConnectors.ts:128-139` | `VERIFIED_WATER_SOURCES[0]` (`water-osm-102938`) | `source: 'community'`, `sourceRef: 'OpenStreetMap ODbL · amenity=drinking_water'` | ID OSM fictif (102938), point fabriqué | **FABRIQUÉE** | Supprimer les faux points en dur. Remplacer par vrai appel Overpass live (Z2.3) |
| **P09** | `src/features/trips/connectors/realDataConnectors.ts:140-151` | `VERIFIED_WATER_SOURCES[1]` (`water-osm-102939`) | `source: 'community'`, `sourceRef: 'OpenStreetMap ODbL · amenity=fountain'` | ID OSM fictif (102939), point fabriqué | **FABRIQUÉE** | Supprimer les faux points en dur. Remplacer par vrai appel Overpass live (Z2.3) |
| **P10** | `src/features/trips/connectors/realDataConnectors.ts:155-167` | `VERIFIED_MOUNTAIN_SHELTERS[0]` (`shelter-ffcam-001`) | `source: 'official'`, `sourceRef: 'FFCAM Club Alpin Français'` | ID FFCAM fictif, fiche codée en dur | **FABRIQUÉE** | Rétrograder en `source: 'estimated'`, `confidence: 'low'` |
| **P11** | `src/features/trips/connectors/realDataConnectors.ts:168-182` | `VERIFIED_MOUNTAIN_SHELTERS[1]` (`shelter-ffcam-002`) | `source: 'official'`, `sourceRef: 'FFCAM Club Alpin Français'` | ID FFCAM fictif, fiche codée en dur | **FABRIQUÉE** | Rétrograder en `source: 'estimated'`, `confidence: 'low'` |
| **P12** | `src/features/trips/lib/elevation.ts:104-106` | `getTripElevationProfile()` (source `stages`) | `source: 'stages'`, `confidence: 'high'` | Dépend de la source des étapes (si étapes `template` ou `computed`, prétendre `high` est faux) | **SURÉVALUÉE** | `confidence: 'high'` seulement si étapes issues d'une trace GPX importée ou nœuds mesurés ; sinon `medium` ou `low` |
| **P13** | `src/features/places/data/placesSeed.ts` | POIs Curatés | `source: 'curated'` | Fichier JSON/TS versionné | **VERSIONNÉ LOCAL** | Valide tant que l'attribution `curated` ne prétend pas être `official` |

---

## 2. Bilan Quantitatif Pré-Z2

- Total des occurrences auditées portant `official` ou `community` : **11 occurrences**.
- Provenances vérifiables et résolubles en direct : **0**.
- Provenances fondées sur un registre fictif ou identifiant inventé : **6 (55%)**.
- Provenances fondées sur des règles légales réelles mais références erronées ou non résolubles : **5 (45%)**.

## 3. Plan d'Action Immédiat (Z2.2 → Z2.5)

1. **Règle Z-R1 & Test `Z-PROV`** : Écrire un test interdisant toute valeur `source: 'official'` ou `source: 'community'` dont le `sourceRef` n'est pas une URL HTTP(S) joignable ou un identifiant d'un dataset versionné contrôlé.
2. **Rétrogradation immédiate** de tous les blueprints (`blueprintRegistry.ts`) et fallbacks en `source: 'estimated'`, `confidence: 'low'`.
3. **Correction juridique du bivouac** (`realDataConnectors.ts`) : rattacher la règle France au Code de l'urbanisme (Articles R. 111-32, R. 111-33 et R. 111-34) avec date de dernière vérification.
4. **Vrai connecteur Overpass (Z2.3)** : Remplacement des faux points d'eau en dur par une requête Overpass Turbo réelle ciblant les nœuds `amenity=drinking_water` réels avec attribution ODbL obligatoire et cache mémoire/statique.
