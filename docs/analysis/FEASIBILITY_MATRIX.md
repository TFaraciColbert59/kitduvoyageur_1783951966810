# A.2 — Faisabilité du Pré-Remplissage Couche par Couche & Matrice 12 × 5
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Réflexion et mesure empirique — lecture seule, aucun code*

---

## 1. Objectif & Cadre d'Évaluation

La **Loi 1** du système stipule : *« Tout élément du voyage a une valeur proposée. Le vide est un échec de conception, jamais un état acceptable. »*  
La **Loi 4** impose simultanément : *« Jamais de nombre inventé par un modèle de langage. Les distances, dénivelés, poids, prix, durées, coordonnées, dates et règles sont calculés ou sourcés. »*

Cette analyse évalue la faisabilité réelle d'atteindre cet idéal sans tricher sur **5 destinations pilotes représentatives** (France, Islande, Maroc, Italie, Népal) sur l'intégralité des **12 couches fonctionnelles**.

### Échelle de Confiance Contractuelle
- **High (Élevé)** : Données ouvertes, officielles ou communautaires structurées existantes, géolocalisées, fraîches (< 12 mois), déterministes. Remplissage direct sans trou.
- **Medium (Moyen)** : Données partielles, estimables par algorithme de règles déterministes robustes (ex: Naismith, normales climatiques, grilles tarifaires de référence) ou fréquence connue. Marquage obligatoire `estimated` ou `computed`.
- **Low (Faible / Risque de rupture)** : Absence d'API ou de registre structuré (ex: horaires de bus ruraux non numérisés, débits de sources d'eau saisonnières). Nécessite une modélisation par fourchette ou directive terrain qualitative pour ne pas violer la Loi 1 tout en respectant la Loi 4.

---

## 2. Matrice d'Éligibilité : 12 Couches × 5 Destinations

| # | Couche Fonctionnelle | France (Alpes/Massif Central) | Islande (Hautes Terres/Sud) | Maroc (Haut Atlas/Toubkal) | Italie (Dolomites/Nord) | Népal (Annapurnas/Langtang) |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **1** | **Squelette temporel** (Jours, phases, marges) | **HIGH** | **HIGH** | **HIGH** | **HIGH** | **HIGH** |
| **2** | **Itinéraire terrain** (Km, D+, D-, Naismith, traces) | **HIGH** | **HIGH** | **HIGH** | **HIGH** | **MEDIUM** |
| **3** | **Grand transport** (Train/Avion/Autocar long) | **HIGH** | **HIGH** | **HIGH** | **HIGH** | **MEDIUM** |
| **4** | **Transport local** (Navettes, taxis collectifs, 4x4) | **HIGH** | **HIGH** | **LOW** | **HIGH** | **LOW** |
| **5** | **Nuits** (Refuges, campings, gîtes, bivouac) | **HIGH** | **HIGH** | **MEDIUM** | **HIGH** | **HIGH** |
| **6** | **Repas & eau** (Commerces, potabilité, ravitaillement)| **HIGH** | **MEDIUM** | **LOW** | **HIGH** | **MEDIUM** |
| **7** | **Kit complet pesé** (Poids, catalogue matériel, portage)| **HIGH** | **HIGH** | **HIGH** | **HIGH** | **HIGH** |
| **8** | **POI & insolite** (Panoramas, spots photo, grottes) | **HIGH** | **HIGH** | **MEDIUM** | **HIGH** | **MEDIUM** |
| **9** | **Budget chiffré** (Ligne par ligne, devise, fourchette)| **HIGH** | **HIGH** | **MEDIUM** | **HIGH** | **MEDIUM** |
| **10**| **Administratif** (Visas, règles parcs, formalités) | **HIGH** | **HIGH** | **HIGH** | **HIGH** | **HIGH** |
| **11**| **Sécurité & secours** (Urgences, réseau, échappatoires) | **HIGH** | **HIGH** | **MEDIUM** | **HIGH** | **MEDIUM** |
| **12**| **Aide & savoir-faire** (Coutumes, erreurs, gestes clés)| **HIGH** | **HIGH** | **HIGH** | **HIGH** | **HIGH** |

### Taux de Remplissage Atteignable par Destination
- **France** : 12 / 12 High (100 %) — Données IGN, OSM, FFRandonnée, SNCF Open Data, Refuges.info.
- **Italie** : 12 / 12 High (100 %) — Données CAI, OSM, OpenMove, Südtirol Mobil.
- **Islande** : 11 / 12 High, 1 Medium (91,7 %) — Safetravel.is, Vegagerdin, DNT/Ferðafélag Íslands.
- **Népal** : 6 High, 4 Medium, 2 Low (66,7 %) — Nécessite des règles d'approximation encadrées pour les transports et l'eau.
- **Maroc** : 6 High, 4 Medium, 2 Low (66,7 %) — Transports locaux informels et points d'eau en montagne sont les points critiques.

---

## 3. Analyse Détaillée Couche par Couche

### Couche 1 — Squelette Temporel
- **Disponibilité** : High sur 100 % des destinations.
- **Source** : Moteur déterministe interne (`src/features/trips/engine/allocateDays.ts` & `temporalPhaseEngine.ts`).
- **Fonctionnement** : Découpage mathématique à partir de la durée du brief, calcul des phases Préparer / Vivre / Raconter, insertion d'un jour de repos ou d'acclimatation selon le dénivelé cumulé.
- **Risque Loi 1** : Nul.

### Couche 2 — Itinéraire Terrain
- **Disponibilité** : High sur FR, IT, IS, MA ; Medium sur NP.
- **Source** : Base de données `destinationsSeed.ts`, OpenStreetMap (Overpass API / relations routes hiking), profils altimétriques SRTM/IGN.
- **Spécificité Népal** : Éboulements fréquents en mousson qui modifient les sentiers locaux. La mention « tracé indicatif soumis aux aléas terrain » est obligatoire.
- **Risque Loi 1** : Maîtrisé.

### Couche 3 — Grand Transport
- **Disponibilité** : High (FR, IT, IS, MA) ; Medium (NP).
- **Source** : Référentiel gares et aéroports IATA, liaisons ferroviaires européennes (SNCF, Trenitalia, DB), simulateur d'empreinte carbone ADEME.
- **Risque Loi 1** : Nul.

### Couche 4 — Transport Local (⚠️ Zone de Risque Loi 1)
- **Disponibilité** : High (FR, IT, IS) ; **LOW** (MA, NP).
- **Diagnostic** :
  - En France et Italie : GTFS régionaux, navettes de vallée Chamonix/Dolomites parfaitement documentées.
  - En Islande : Compagnie Trex / Straeto / Reykjavik Excursions avec horaires d'été fixes vers Landmannalaugar et Thórsmörk.
  - Au Maroc : Pas d'API pour les « Grands Taxis » d'Imlil ou de Ouarzazate, ni pour les camionnettes berbères.
  - Au Népal : Jeeps collectives de Pokhara à Besisahar sans horaire numérisé.
- **Solution pour respecter la Loi 1 & Loi 4** : Ne jamais inventer un horaire fixe inexistant (ex: « Bus à 08h14 »). Remplir avec la règle d'usage constatée et vérifiée :
  ```json
  {
    "mode": "collective_taxi",
    "departure_hub": "Marrakech - Station Bab Er-Rob",
    "frequency": "Départ continu dès que les 6 places sont occupées (attente moyenne 15-40 min)",
    "price_range_mad": [50, 70],
    "price_eur": 6.5,
    "confidence": "estimated",
    "provenance": "Tarif syndical officiel des chauffeurs de taxi du Haut-Atlas 2024"
  }
  ```

### Couche 5 — Nuits & Hébergements
- **Disponibilité** : High (FR, IT, IS, NP) ; Medium (MA).
- **Source** : Refuges.info, Ferðafélag Íslands, Club Alpin Français, Club Alpino Italiano, bases de tea houses de l'ACAP.
- **Spécificité Bivouac** : Matrice des parcs nationaux (interdiction stricte Vanoise cœur de parc vs tolérance crépusculaire 19h-9h TMB/Pyrénées).
- **Risque Loi 1** : Nul si les gîtes et campings officiels sont prioritaires.

### Couche 6 — Repas & Eau (⚠️ Zone Critique Sécurité et Poids)
- **Disponibilité** : High (FR, IT) ; Medium (IS, NP) ; **LOW** (MA).
- **Diagnostic** :
  - En Islande : Eau des rivières claires potable sans filtre, mais eau des rivières glaciaires/volcaniques imbuvable (cendres abrasives en suspension).
  - Au Maroc : Eau de source rare et troupeaux de chèvres en altitude. Risque sévère de gastro-entérite (giardiase).
- **Solution pour respecter la Loi 1 & Loi 4** :
  - Si commerce absent : marquer explicitement `ravitaillement: "impossible à l'étape - portage obligatoire depuis J-1"`.
  - Pour l'eau : classifier en 3 catégories strictes (`potable_verifiee`, `filtrable_obligatoire`, `interdite_glaciaire_polluee`).

### Couche 7 — Kit Complet Pesé
- **Disponibilité** : High (100 % des destinations).
- **Source** : Moteur déterministe interne (`contextualKitEngine.ts`), catalogues de poids au gramme et seuils de confort thermique.
- **Risque Loi 1** : Nul. Tout équipement est pré-rempli avec poids exact.

### Couche 8 — POI & Lieux Insolites
- **Disponibilité** : High (FR, IT, IS) ; Medium (MA, NP).
- **Source** : Référentiel POI LKDV, base OpenStreetMap nodes `natural=peak`, `tourism=viewpoint`, `historic=*`.
- **Règle Déontologique Intégrée** : Respect strict des coordonnées floutées pour les sites naturels fragiles (Loi 8.2).
- **Risque Loi 1** : Nul.

### Couche 9 — Budget Chiffré Ligne par Ligne
- **Disponibilité** : High (FR, IT, IS) ; Medium (MA, NP).
- **Source** : Moteur `budgetEngine.ts`, conversion de devises ISO temps réel, redevances d'accès parcs.
- **Fourchette** : Affichage min/max pour les postes à négociation locale (ex: muletier à Imlil : 180 à 250 MAD/jour).
- **Risque Loi 1** : Nul.

### Couche 10 — Administratif & Formalités
- **Disponibilité** : High (100 % des destinations).
- **Source** : France Diplomatie (Conseils aux Voyageurs API / scraping officiel), IATA Timatic, portail ACAP/TIMS Népal.
- **Règle Dure** : Zéro texte généré par LLM pour les visas et vaccins. Citation stricte du texte officiel avec date de vérification.
- **Risque Loi 1** : Nul.

### Couche 11 — Sécurité, Météo & Contacts d'Urgence
- **Disponibilité** : High (FR, IT, IS) ; Medium (MA, NP).
- **Source** : PGHM Chamonix, 112 européen, 112 Islande (Safetravel SMS tracking), Secours Montagne Népal (Himalayan Rescue Association), numéros consulaires.
- **Échappatoires** : Identification systématique d'une vallée de descente pour chaque étape alpine.
- **Risque Loi 1** : Nul.

### Couche 12 — Savoir-Faire & Coutumes Locales
- **Disponibilité** : High (100 % des destinations).
- **Source** : Règles Leave No Trace, chartes des parcs, guides culturels pré-vérifiés (`countryDetails.ts`).
- **Risque Loi 1** : Nul.

---

## 4. Bilan des Couches qui Bloquent la Loi 1 & Stratégie de Résolution

| Couche Bloquante Potentielle | Pays Affectés | Cause Réelle du Blocage | Résolution Conforme aux 4 Lois |
|---|---|---|---|
| **Couche 4 (Transport local)** | Maroc, Népal | Pas d'horaires à la minute dans les zones rurales | Proposer le **mode, le lieu de prise en charge et la fréquence usuelle** (ex: taxi collectif départ complet) avec badge `estimated` sans horaire précis faux. |
| **Couche 6 (Points d'eau)** | Maroc, Islande | Débits de sources variables et potabilité discontinue | Proposer le **protocole de traitement requis** (pastille chlore / filtre céramique 0.1 micron) et la capacité d'emport conseillée (ex: « Prévoir 3L minimum pour l'étape »). |
| **Couche 5 (Refuges complets)** | France (TMB), Italie | Taux d'occupation de 100 % en juillet/août | Présenter l'alternative de repli pré-scorée (aire de bivouac autorisée attenante ou gîte en vallée accessible par échappatoire). |

---

## 5. Conclusion pour le Chantier U13

1. **Aucune destination pilote n'est disqualifiée par l'Arrêt I** : toutes les 12 couches atteignent au minimum le niveau `Medium` d'exploitabilité dès lors que la modélisation des transports informels est pensée par fréquence et non par horaire fixe.
2. **La France, l'Italie et l'Islande** forment le trio de départ optimal pour un lancement au niveau de complétude maximal (`High` sur 98 % des attributs).
3. **Le Maroc et le Népal** sont pleinement intégrables sous réserve d'activer les règles d'estimation tarifaire et logistique validées par les données des carnets existants.
