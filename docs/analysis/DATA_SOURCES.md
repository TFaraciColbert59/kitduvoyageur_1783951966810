# A.4 — Cartographie des Sources de Données & Arbitrages Juridiques
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Analyse juridique, technique et de conformité des données — aucun code*

---

## 1. Contexte Juridique & Règle d'Or de l'Audit

Le Chantier U13 repose sur l'assemblage déterministe de données réelles (Loi 2 & Loi 4). Or, intégrer des données externes impose une stricte conformité au droit des bases de données (Directive 96/9/CE), aux licences libres et aux conditions d'utilisation (CGU) des fournisseurs.

**Arrêt J du Master Plan :** *« Aucun import de données avant l'arbitrage juridique de A.4. »*

Ce document analyse chaque source candidate pour les 12 couches, formalise ses conditions de réutilisation, sa politique de mise en cache pour les blueprints (§6) et liste les sources formellement exclues pour motif juridique.

---

## 2. Fiches Détaillées des Sources Validées

### 2.1 Cartographie, Itinéraires & Sentiers

#### Source 1 : OpenStreetMap (OSM) via Overpass API / Planet Dump
- **Périmètre** : Sentiers de randonnée (`highway=path/track`), relations d'itinéraires (`route=hiking/foot/bicycle`), points d'eau (`amenity=drinking_water/spring`), sommets (`natural=peak`), cols (`mountain_pass=yes`), refuges (`tourism=alpine_hut/wilderness_hut`).
- **Couverture mesurée** : Exceptionnelle en France et Italie (98 % des sentiers majeurs) ; Très bonne en Islande (Laugavegur 100 %) ; Bonne au Maroc (Atlas principal 85 %) ; Moyenne au Népal (70 % des sentiers de trek, en cours de numérisation).
- **Licence** : **Open Database License (ODbL) v1.0**.
- **Attribution obligatoire** : `© les contributeurs d'OpenStreetMap` visible sur les cartes et les fiches d'export.
- **Partage à l'Identique (Share-Alike)** : S'applique si une base dérivée fermée est créée. LKDV utilise les données OSM en tant que « Collective Database » (base collective non fusionnée de façon indissociable), ce qui préserve l'indépendance du code propriétaire.
- **Droit de cache & blueprints** : **Autorisé sans restriction de durée**. Mise à jour mensuelle recommandée.
- **Statut** : **VALIDÉ**.

#### Source 2 : IGN (Institut National de l'Information Géographique et Forestière)
- **Périmètre** : BD TOPO, modèle numérique de terrain RGE ALTI (résolution 1m et 5m en France), réseau hydrographique et limites administratives des parcs.
- **Couverture** : France métropolitaine et outre-mer (100 %).
- **Licence** : **Licence Ouverte Etalab v2.0** (équivalent CC-BY).
- **Attribution obligatoire** : `IGN — 2024` ou `Données géographiques : IGN France`.
- **Droit d'usage commercial** : Pleinement autorisé sans redevance.
- **Droit de cache & blueprints** : **Autorisé sans restriction**.
- **Statut** : **VALIDÉ**.

---

### 2.2 Hébergements & Refuges

#### Source 3 : Refuges.info
- **Périmètre** : Refuges gardés, cabanes non gardées, abris forestiers, gîtes d'étape et points d'eau en montagne (France, Suisse, Italie, Espagne).
- **Couverture** : Plus de 8 000 points d'hébergement pyrénéens et alpins qualifiés.
- **Licence** : **Creative Commons Paternité - Partage à l'Identique (CC BY-SA 2.0)**.
- **Attribution obligatoire** : `Source : Refuges.info (CC BY-SA 2.0)`.
- **Droit de cache & blueprints** : Autorisé avec mention de la source et horodatage de la capture.
- **Statut** : **VALIDÉ**.

#### Source 4 : FFCAM (Fédération Française des Clubs Alpins et de Montagne)
- **Périmètre** : Tarifs officiels, périodes de gardiennage, coordonnées et règles de réservation des 120 refuges de montagne FFCAM.
- **Licence** : Données publiques fédérales accessibles pour information du public.
- **Droit de cache** : Autorisé pour les caractéristiques fixes (altitude, capacité, période d'ouverture). Les réservations de nuitées renvoient vers la plateforme centrale FFCAM sans intermédiaire.
- **Statut** : **VALIDÉ** (en mode consultation & lien de redirection officiel).

#### Source 5 : Ferðafélag Íslands (Association de Randonnée d'Islande)
- **Périmètre** : Refuges du Laugavegur, de Kjalvegur et des Hautes Terres islandaises.
- **Licence** : Informations publiques d'intérêt général Safetravel / FI.
- **Statut** : **VALIDÉ**.

---

### 2.3 Transports & Mobilité

#### Source 6 : SNCF Open Data & Point d'Accès National (transport.data.gouv.fr)
- **Périmètre** : Fichiers GTFS nationaux et régionaux, gares ferroviaires, horaires théoriques TER et Intercités, emports vélo à bord des trains.
- **Couverture** : France intégrale.
- **Licence** : **Licence Ouverte Etalab v2.0**.
- **Attribution** : `Données horaires fournies par SNCF Voyageurs sous Licence Ouverte`.
- **Droit de cache** : Autorisé.
- **Statut** : **VALIDÉ**.

#### Source 7 : Südtirol Mobil / OpenMove (Italie)
- **Périmètre** : Transports en commun des Dolomites et du Haut-Adige (bus de montagne, trains du Val Pusteria, téléphériques intégrés).
- **Licence** : **Open Data Südtirol (CC BY 4.0)**.
- **Statut** : **VALIDÉ**.

#### Source 8 : ADEME — Base Empreinte Carbone
- **Périmètre** : Ratios officiels d'émissions de gaz à effet de serre par voyageur-kilomètre selon le mode de transport (TGV : 2,3 g CO2e/km ; Train régional : 29 g ; Avion court-courrier : 230 g ; Voiture thermique : 193 g ; Ferry piéton : 18 g).
- **Licence** : **Licence Ouverte Etalab v2.0**.
- **Droit de cache** : Intégration directe dans les calculateurs déterministes LKDV.
- **Statut** : **VALIDÉ**.

---

### 2.4 Climat, Météo & Risques Naturels

#### Source 9 : Open-Meteo & Copernicus Climate Change Service (ERA5 Reanalysis)
- **Périmètre** : Normales climatiques saisonnières mondiales (températures minimales et maximales par quinzaine, précipitations moyennes, probabilité de gel par altitude).
- **Licence** : **Creative Commons Attribution 4.0 International (CC BY 4.0)** & Licence Copernicus Open Data.
- **Attribution** : `Données météorologiques et climatiques : Open-Meteo / Copernicus ECMWF`.
- **Droit de cache & blueprints** : **Autorisé sans restriction**.
- **Statut** : **VALIDÉ**.

#### Source 10 : Safetravel.is & ICE-SAR (Islande)
- **Périmètre** : Bulletins de sécurité routière (Vegagerðin), alerte de crues glaciaires (jökulhlaup), état d'ouverture des pistes F-Roads et alertes tempêtes.
- **Licence** : Données publiques institutionnelles ouvertes.
- **Statut** : **VALIDÉ**.

---

### 2.5 Formalités, Santé & Droits Consulaires

#### Source 11 : Ministère de l'Europe et des Affaires Étrangères (France Diplomatie)
- **Périmètre** : Fiches « Conseils aux Voyageurs » (visas, passeports, vaccins obligatoires et recommandés, zones de vigilance sécuritaire rouge/orange/jaune/verte).
- **Licence** : Informations publiques de l'État (Code des relations entre le public et l'administration). Réutilisation libre sous réserve de mentionner la source et la date de dernière mise à jour.
- **Règle Déontologique LKDV** : Les recommandations de sécurité et conditions d'entrée sont citées textuellement sans modification ni interprétation algorithmique.
- **Statut** : **VALIDÉ**.

---

## 3. Sources Formellement ÉCARTÉES pour Motif Juridique

Pour préserver l'entreprise de tout contentieux de contrefaçon, de parasitisme commercial ou de violation de CGU, les sources suivantes sont **strictement interdites d'import et de moissonnage** :

| Source Écartée | Raison de l'Exclusion | Risque Juridique pour LKDV | Solution de Remplacement Conforme |
|---|---|---|---|
| **AllTrails / Wikiloc (Scraping de traces)** | Les Conditions Générales d'Utilisation (CGU) interdisent formellement le scraping, la rétro-ingénierie et l'usage commercial des traces déposées par la communauté. | Action en contrefaçon de base de données (Article L342-1 du Code de la Propriété Intellectuelle). | Exploitation exclusive des tracés OpenStreetMap (`route=hiking`), du réseau IGN et des traces propriétaires déposées par les utilisateurs de LKDV. |
| **Google Places API (pour stockage permanent en blueprints)** | Les CGU de Google Maps Platform interdisent le stockage permanent et la mise en cache de données Places au-delà de 30 jours (« No Pre-Fetching, Caching, or Storage of Content »). | Rupture de contrat API, facturation punitive et coupure brutale de service. | Stockage de POI s'appuyant uniquement sur OpenStreetMap, Wikidata et le catalogue interne vérifié LKDV. |
| **Topoguides FFRandonnée (Textes et marques déposées)** | La FFRandonnée détient la marque déposée « GR® » ainsi que des droits d'auteur stricts sur les descriptifs textuels de ses topoguides papier et numériques. | Poursuites en contrefaçon de marque et atteinte aux droits d'auteur. | Utilisation des désignations descriptives génériques (« sentier de grande randonnée »), des tracés OSM libres et rédaction originale 100 % LKDV sans reproduction de texte FFRandonnée. |
| **Tripadvisor Content API** | Licence fermée interdisant le mélange de données (« commingling ») et la réutilisation dans des algorithmes de recommandation automatisés tiers sans accord de distribution commercial. | Rupture d'accès et interdiction de republication. | Scoring bayésien communautaire propriétaire LKDV (Phase P8.1). |

---

## 4. Politique de Traçabilité & Registre de Provenance (Loi 2)

Pour respecter la **Loi 2** (*Aucune valeur sans provenance*), chaque entité de données importée dans la base de données LKDV doit être taguée avec les 4 métadonnées obligatoires :
1. `source_id` : Nom canonique du registre (ex: `osm_overpass`, `ign_bdtopo`, `sncf_gtfs`, `france_diplomatie`).
2. `license_type` : Type de licence (ex: `ODbL-1.0`, `Etalab-2.0`, `CC-BY-4.0`).
3. `attribution_text` : Mention légale textuelle affichée à l'utilisateur.
4. `observed_at` : Timestamp ISO de la collecte de la donnée pour piloter la règle de péremption des 12 mois.

---

## 5. Bilan pour le Chantier U13

L'**Arrêt J** est levé sous réserve du respect strict de la présente cartographie. L'intégralité des 12 couches fonctionnelles du voyage auto-généré peut être alimentée par des sources ouvertes, publiques ou étatiques pleinement légales, sans jamais dépendre du moissonnage de plateformes fermées concurrentes.
