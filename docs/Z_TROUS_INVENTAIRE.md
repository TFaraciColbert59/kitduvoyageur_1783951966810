# Inventaire Exhaustif des Trous de Données (Chantier Z — Z2.5)
Date : 07/09/2026
Référence git : `chantier/z2-donnees-verite`
Auteur : LKDV Architecture & Quality Pod

---

## 1. Résolution de la Contradiction : Matrice de Faisabilité (5 Pays) vs 16 Blueprints

### Constat
Une contradiction majeure existait entre :
1. **La matrice de faisabilité** (`docs/analysis/FEASIBILITY_MATRIX.md`), qui évaluait la faisabilité des 12 couches sur **5 pays pilotes** (France, Islande, Maroc, Portugal/Madère, Népal) et concluait à des données partielles ou manquantes sur le transport local, les hébergements temps-réel et l'eau.
2. **Le catalogue de blueprints** (`src/features/trips/blueprints/blueprintRegistry.ts`), qui déclarait 16 blueprints couvrant le Japon, le Népal, Madère, La Réunion avec la mention mensongère `source: 'official'`, `sourceRef: 'LKDV-Official-Registry'`, `confidence: 'high'`.

### Arbitrage et Rectification (Règle Z-R1 & Z-R2)
- Les 16 blueprints ne sont **pas** des fiches officielles certifiées par des registres gouvernementaux. Ce sont des **modèles d'inspiration et d'estimation heuristique** (`source: 'estimated'`, `confidence: 'low'`).
- Le périmètre affirmé comme *techniquement vérifiable* est restreint au **seul corridor pilote** disposant d'un connecteur réel fonctionnel : **France / Massif du Mont-Blanc** (pour l'eau via OpenStreetMap Overpass ODbL).
- Pour tous les autres pays et toutes les autres couches, le produit n'affirme aucune certitude officielle : les propositions portent la mention visible **« Estimation »** accompagnée du lien direct de vérification.

---

## 2. Inventaire des Trous par Couche Fonctionnelle

| Couche | Statut Réel Actuel | Ce qui MANQUE réellement (Trous constatés) | Dégradation Honnête Imposée |
|---|---|---|---|
| **1. Squelette** | Calculé en local (`buildItinerary.ts`) | Modèle d'acclimatation physiologique pour altitude > 3 000 m non certifié médicalement. | `source: 'computed'`, `confidence: 'medium'` |
| **2. Itinéraire** | Calculé / Tracé GPX | Absence d'état des sentiers en temps réel (névés précoces, éboulements, travaux). Formule de Naismith calibrée à 4 km/h + 1h/600m D+, sans prise en compte du poids du sac. | Tracé indicatif, mention « vérifier les conditions météo et nivologiques locales » |
| **3. Grand Transport** | Estimé | Pas d'API ferroviaire ou aérienne branchée en direct. Pas de tarifs en temps réel. | `source: 'estimated'`, mention des transporteurs recommandés sans prix garanti |
| **4. Transport Local** | Estimé / Non numérisé | Horaires des navettes locales de montagne saisonniers non exposés en Open Data. Taxis collectifs (Maroc, Népal) informels sans grille d'horaires. | Horaires et fréquences indicatifs, alerte « à confirmer sur place » |
| **5. Nuits** | Estimé | **Trou critique** : Disponibilité des lits en refuges FFCAM / privés en temps réel introuvable sans intégration directe payante ou scraping interdit. | Mention « Réservation obligatoire requise auprès du gardien / refuge » |
| **6. Repas & Eau** | Mix Réel / Estimé | - Eau potable : branchée en direct sur Overpass OSM uniquement pour la zone pilote Mont-Blanc.<br>- Ravitaillement : heures d'ouverture des épiceries d'alpage saisonnières non garanties. | Boîte d'eau Overpass réelle là où disponible ; sinon alerte critique `WATER_AUTONOMY_CRITICAL` |
| **7. Kit Complet** | Règle déterministe locale | Tailles et disponibilités de stock réelles en boutique non synchronisées en direct. | Liste recommandée basée sur les besoins environnementaux (étanche, thermique) |
| **8. POIs & Insolite** | Versionné local (`placesSeed.ts`) | Heures d'affluence et fermetures exceptionnelles non connues. | Fiches descriptives indicatives |
| **9. Budget** | Estimé | Tarifs relevés en 2024, soumis à l'inflation et aux variations de devises (CHF, ISK, MAD, NPR). | Mention explicite « Tarifs indicatifs constatés 2024 — à reconfirmer pour 2026 » |
| **10. Administratif** | Textes réglementaires locaux | Alertes sanitaires / visas en temps réel non branchés sur une API consulaire. | Renvoi systématique vers France Diplomatie et les consulats officiels |
| **11. Sécurité** | Règles d'alerte déterministes | Couverture réseau mobile réelle (zones blanches) basée sur des moyennes, pas sur des relevés radio millimétrés. | Panneau de secours neutralisé dès que les coordonnées ne sont pas vérifiées |
| **12. Savoir-Faire** | Versionné local éthique | Coutumes et arrêtés municipaux spécifiques temporaires (arrêtés sécheresse, interdiction feux). | Règles de base (Leave No Trace) pérennes |

---

## 3. Bilan de l'Arrêt Z-B

L'audit Z2.1 et l'inventaire Z2.5 confirment que sur les 12 couches fonctionnelles :
- **1 couche** dispose d'un connecteur temps réel vérifié : *Eau (zone pilote OSM Overpass)*.
- **3 couches** reposent sur des calculs déterministes ou des jeux de données versionnés fiables : *Squelette temporel, Kit de matériel, Règles éthiques*.
- **8 couches** reposent sur des estimations ou des données indicatives nécessitant une vérification par l'utilisateur : *Grand transport, Transport local, Disponibilité des refuges, Budget actualisé, Administratif dynamique, Météo/Nivo*.

**Conclusion d'alignement produit :** Le produit n'est plus présenté comme un « générateur infaillible de voyages clé en main à données officielles certifiées », mais comme un **« configurateur et compilateur d'itinéraires et d'équipements outdoor »** qui automatise le dimensionnement, alerte sur les risques, et explicite honnêtement chaque estimation.
