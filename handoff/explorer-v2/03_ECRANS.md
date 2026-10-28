# 03 · Spécification des écrans

Source de vérité visuelle : `maquette/captures/<Fichier>.png` et `maquette/index.html` (exécutable). Les textes ci-dessous sont extraits automatiquement de la maquette : ils fixent le contenu, l’ordre et les libellés. **Tout chiffre de la maquette est un exemple : en production il vient de la source indiquée, sinon l’élément est masqué.**

Règles communes à tous les écrans : onglet actif = icône + libellé, autres = icône seule ; boutons d’en-tête en icône seule (exceptions : SOS et autorisation de position) ; aucun doublon d’information entre titre, sous-titre et tuiles ; état vide et état chargement prévus pour chaque bloc de données.

## Main · Prototype navigable

![Main](maquette/captures/Main.png)

- **Scène** : `bienvenue`
- **Comportement** : Prototype navigable : tous les parcours
- **Données** : Toutes
- **Boutons visibles** : Laugavegur · Annapurnas · Canaries · Jordanie · Mont-Blanc · Calanques · Côte d’Opale · Chaîne des Puys · Vanoise · Vercors · Écrins · Explorer Chamonix-Mont-Blanc · Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat

<details><summary>Contenu de référence</summary>

```
Bienvenue dans Explorer
Le monde à ta hauteur, du globe au sentier
POUR QUI EXPLORES-TU ?
Solo
En famille
Avec enfants
Senior
Mobilité réduite
Sportif
Explorer s’ouvre là où tu es. Le globe tourne vers toi puis descend jusqu’à ton quartier. Langue, unités et numéros d’urgence suivent le pays affiché.
Autoriser ma position
Plus tard
```
</details>

## Monde · Monde · globe

![Monde](maquette/captures/Monde.png)

- **Scène** : `monde`
- **Comportement** : Globe centré sur la position ; toucher un pays = plongée niveau 1 ; repères de saison
- **Données** : countries_geo, trips (départs ouverts), carnets
- **Onglets** : Pour toi · Carnets du monde · Ton empreinte
- **Boutons visibles** : Laugavegur · Annapurnas · Canaries · Jordanie · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Pour toi · Carnets du monde · Ton empreinte · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Le monde
Le globe s’ouvre sur toi
Népal
Ciel clair après la mousson
Jordanie
Wadi Rum, douceur
Canaries
Volcans, sentiers côtiers
Côte d’Opale
1 h 20 de toi
Pour toi
Carnets
Empreinte
EXPLORER AILLEURS
Japon
Alpes du Nord, Kumano Kodō
États-Unis
Parcs nationaux, unités impériales
Chili
Hémisphère sud, Patagonie
Mongolie
Pays peu documenté
DÉPARTS OUVERTS, TA SAISON
Tour des Annapurnas
Népal · avril 2027 · 17 j · Yanis organise
2 places
Laugavegur
Islande · juillet 2027 · 4 j
Complet
Haute Route Pyrénéenne
France, Espagne · juillet 2027 · 40 j
1 place
Lac Blanc
Néouvielle
Vercors
GR20
Dolomites
Écrins
2
pays
10
sorties
351
km
20,2 km
D+
Italie et France, ta trace s’allume sur le globe. Chaque sortie enregistrée ajoute son tracé.
```
</details>

## Pays · Pays · France

![Pays](maquette/captures/Pays.png)

- **Scène** : `pays`
- **Comportement** : Régions cliquables ; « Près de toi » ; bon moment
- **Données** : countries_geo, admin_regions_geo, hiking_routes, carnets
- **Onglets** : Aperçu · Carnets · Départs · Pratique
- **Boutons visibles** : Mont-Blanc · Calanques · Côte d’Opale · Chaîne des Puys · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Carnets · Départs · Pratique · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
France
Bonne saison : Calanques, Côte d’Opale
Aperçu
Carnets
Départs
Pratique
PRÈS DE TOI · BONDUES
Côte d’Opale · Cap Blanc-Nez
GR® littoral · ≈ 1 h 20 en voiture
Monts de Flandre
Mont Cassel, Mont Noir · ≈ 40 min
BON MOMENT POUR
Calanques
Douceur d’automne
Mont-Blanc
Premières neiges
Chaîne des Puys
Lumières rasantes
Lac Blanc
Calanques
Vercors
Néouvielle
Puys
Écrins
Haute Route Pyrénéenne
juillet 2027 · 40 j · Yanis
1 place
Lac Blanc au lever du jour
sam. 25 oct. · Chamonix
Complet
Urgences
112 · secours en montagne via le 112
Langue, monnaie
Français · euro (€)
```
</details>

## Region · Région · Auvergne-Rhône-Alpes

![Region](maquette/captures/Region.png)

- **Scène** : `region`
- **Comportement** : Massifs, GR, villes ; mini été/hiver ; toucher Chamonix = niveau 3
- **Données** : admin_regions_geo, hiking_routes, geo_pois
- **Onglets** : Aperçu · Randonnées · Carnets · Départs
- **Boutons visibles** : Vanoise · Vercors · Chaîne des Puys · Écrins · Explorer Chamonix-Mont-Blanc · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Randonnées · Carnets · Départs · Été · Hiver · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Auvergne-Rhône-Alpes
12 départements · Alpes, Massif central
Neige dès 1 800 m
2 parcs nationaux
GR® 5 · TMB
Préfecture : Lyon
Aperçu
Randos
Carnets
Départs
MASSIFS
Mont-Blanc
Haute-Savoie · glaciers, TMB
4 805 m
Vanoise
Grande Casse · parc national depuis 1963
3 855 m
Vercors
Grand Veymont · hauts plateaux
2 341 m
Chaîne des Puys
Puy de Dôme · UNESCO 2018
1 465 m
Tour du Mont-Blanc
France, Italie, Suisse · boucle
Populaire
GR® 5 · Léman → Modane
Traversée des Alpes
Mer de Glace
Lac Blanc
Vanoise
Vercors
Aravis
Puys
Lac Blanc au lever du jour
sam. 25 oct. · la Flégère
1 place
```
</details>

## Lieu · Lieu · Chamonix

![Lieu](maquette/captures/Lieu.png)

- **Scène** : `lieu`
- **Comportement** : Relief 3D, repères hiérarchisés ; mini 2D/3D ; appui long = lancer
- **Données** : geo_pois, hiking_routes, terrain_reports, group_live_positions
- **Onglets** : Autour · Randonnées · Carnets · Amis
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Autour · Randonnées · Carnets · Amis · Hub

<details><summary>Contenu de référence</summary>

```
Chamonix-Mont-Blanc
Haute-Savoie · 1 035 m · vallée de l’Arve
Autour
Randos
Carnets
Amis
Lac Blanc par les Chéserys
≈ 9 km · ≈ 900 m D+ · moyen
Populaire
Le Brévent
Sommet · 2 525 m · face au Mont Blanc
Lacs des Chéserys
Point d’eau · signalé il y a 2 j
En eau
Lac des Gaillands
À plat · idéal en famille
Grand Balcon Sud
La Flégère → Planpraz · facile
Grand Balcon Nord
Plan de l’Aiguille → Montenvers
Lac Blanc
Brévent
Mer de Glace
Midi
Flégère
Chéserys
L
Léa
Au Lac Blanc · il y a 12 min · position partagée
Y
Yanis
À la Flégère · il y a 40 min
```
</details>

## Sommet · Sommet · Le Brévent

![Sommet](maquette/captures/Sommet.png)

- **Scène** : `sommet`
- **Comportement** : Orbite 40 s, arrêt au toucher ; onglets Aperçu/Accès/Carnets/Météo
- **Données** : OSM natural=peak (import), MET Norway, carnets
- **Onglets** : Aperçu · Accès · Carnets · Météo
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Y aller · Aperçu · Accès · Carnets · Météo · Hub

<details><summary>Contenu de référence</summary>

```
Le Brévent
Sommet · 2 525 m · Aiguilles Rouges
Aperçu
Accès
Carnets
Météo
D+ PLANPRAZ
≈ 525 m
DURÉE
≈ 1 h 30
ACCÈS
Câble, pied
VUE
Mont Blanc
L
Y
I
S
128 membres sont passés par là · 41 carnets
Lever de soleil au Brévent
Léa · « La chaîne s’allume d’un coup, de l’Aiguille Verte au Goûter. »
Depuis Planpraz
≈ 1 h 30 · ≈ 525 m D+ · par le col du Brévent
Conseillé
Depuis Chamonix par Bellachat
Long et raide · pour randonneurs entraînés
Téléphérique Planpraz – Brévent
Ouverture selon la saison
Horaires exploitant
L
Lever de soleil au Brévent
Léa · 3 jours · 12 photos
Y
Du Brévent à Bellachat
Yanis · 1 jour
Prévisions au sommet
Météo-France
Sam.
[T°]
Dim.
[T°]
Lun.
[T°]
```
</details>

## Eau · Point d’eau · Chéserys

![Eau](maquette/captures/Eau.png)

- **Scène** : `eau`
- **Comportement** : Statut communautaire ; « Toujours là / Plus là » ; révélation caméra
- **Données** : geo_pois + terrain_reports(category=water)
- **Onglets** : État · Accès
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Signaler l’état de l’eau · État · Accès · Hub · Communauté · Explorer

<details><summary>Contenu de référence</summary>

```
Lacs des Chéserys
Point d’eau · ≈ 2 200 m · Aiguilles Rouges
État
Accès
En eau · à filtrer
3 signalements cette semaine · fiabilité forte
2 j
DERNIERS SIGNALEMENTS
L
Léa · il y a 2 j
Eau claire, berge facile
Y
Yanis · il y a 5 j
Bord gelé le matin
I
Inès · il y a 6 j
Eau claire
SIGNALER MAINTENANT
En eau
Faible
À sec
Gelé
Ta gourde Katadyn BeFree filtre cette eau · elle est dans ton kit
Depuis le col des Montets
≈ 1 h 45 · par la Réserve
Réserve naturelle des Aiguilles Rouges
Règles spécifiques : bivouac, chiens
Réglementation
```
</details>

## Rando · Randonnée · survol 3D

![Rando](maquette/captures/Rando.png)

- **Scène** : `rando`
- **Comportement** : Profil altimétrique ; mini carte/survol 3D ; créer un départ ; démarrer
- **Données** : hiking_routes, get_route_pois, DEM
- **Onglets** : Trace · Points d’eau · Carnets · Conditions
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Créer un départ · Démarrer · Trace · Points d’eau · Carnets · Conditions

<details><summary>Contenu de référence</summary>

```
Lac Blanc par les Chéserys
Aller-retour · depuis le col des Montets
DISTANCE
≈ 9 km
DÉNIVELÉ
≈ 900 m
DURÉE
≈ 5 h
NIVEAU
Moyen
1 461 m
Chéserys
2 352 m
Trace
Eau
Carnets
Conditions
Col des Montets
Départ · parking
1 461 m
Lacs des Chéserys
Point d’eau · à filtrer
≈ 2 200 m
Lac Blanc
Arrivée · refuge
2 352 m
Lacs des Chéserys
En eau · signalé il y a 2 j
Fiable
L
Lac Blanc au lever du jour
Léa · 2 jours
Neige possible au-dessus de 2 000 m
Météo-France
```
</details>

## Depart · Créer un départ

![Depart](maquette/captures/Depart.png)

- **Scène** : `depart`
- **Comportement** : Formulaire départ (date, places, visibilité) → publie
- **Données** : trips, depart_participants
- **Onglets** : Quand · Équipage · Kit · Partage
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Publier le départ · Quand · Équipage · Kit · Partage · Inviter

<details><summary>Contenu de référence</summary>

```
Nouveau départ
Lac Blanc par les Chéserys · ≈ 5 h
Quand
Équipage
Kit
Partage
DATE
sam. 1 nov.
dim. 2 nov.
sam. 8 nov.
Départ conseillé 7 h 15
Lever du soleil vers 7 h 40 · retour estimé 13 h
Conditions annoncées
Mises à jour jusqu’au départ
Météo-France
ÉQUIPAGE
T
L
Y
Toi, Léa, Yanis · groupe géré dans le Hub
Ouvrir 2 places
Bouteille à la mer · visible dans la Communauté
L
Léa
A accepté · prête
Y
Yanis
En attente
Invité
Kit prêt à 86 %
calculé par le préparateur
Frontale Swift RL 900 lm
Prêtée à Léa · pense à la récupérer
À récupérer
Gourde BeFree 1 L filtre
Utile aux Chéserys
Veste Beta AR Gore-Tex Pro
Vent et neige possibles
Crampons légers
Neige possible au-dessus de 2 000 m
Suggestion
Position en direct
Proches et équipage · coupure auto au retour
Carnet automatique
Photos et trace ajoutées au fil du départ
```
</details>

## Recherche · Recherche IA

![Recherche](maquette/captures/Recherche.png)

- **Scène** : `ia`
- **Comportement** : Texte + langage naturel ; résultats réels uniquement
- **Données** : /api/explorer/v2/search
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Effacer la recherche · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
3 lacs pour toi
Trié pour une sortie en famille
1
Lac des Gaillands
À plat · 15 min à pied du centre · pique-nique
Idéal
2
Lac des Chavants
Les Houches · balade courte
Facile
3
Lac Cornu
≈ 1 h 30 depuis Planpraz · au-delà de ta limite
Presque
Zone verte : ce que tu atteins en 1 h à pied depuis Chamonix, dénivelé compris. Tes préférences « famille » trient les résultats.
Avec poussette
Ombragé
Moins de monde
```
</details>

## Demarrer · Démarrer une activité

![Demarrer](maquette/captures/Demarrer.png)

- **Scène** : `lancer`
- **Comportement** : Grille 9 sports, compte à rebours 3·2·1
- **Données** : activity_catalog
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Démarrer
Depuis ta position
Reprendre : course
Dernière : boucle des Gaillands · 6,4 km
3 · 2 · 1
Course
Rando
Vélo
Kayak
Trail
Ski de rando
Escalade
Balade
Bivouac
Objectif : libre
Guidage vocal
Bouteille à la mer
```
</details>

## Course · Course en direct · Island

![Course](maquette/captures/Course.png)

- **Scène** : `course`
- **Comportement** : Mode suivi, métriques, pastille barre basse
- **Données** : activity_sessions
- **Onglets** : Direct · Tours · Cœur · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Tours · Cœur · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Course
En direct
Chamonix · boucle des Gaillands
Direct
Tours
Cœur
Sécurité
32:15
DISTANCE
6,43 km
ALLURE
5'01"/km
CARDIO
158 bpm
D+
84 m
Kilomètres
km 6 en cours
Coach vocal · « Allure stable, garde 5'00. »
km 1
Le long de l’Arve
5'04
km 2
Lac des Gaillands
4'58
km 3
Les Pècles
5'02
km 4
Retour rive droite
5'00
km 5
Centre
4'59
Z1 récup
Z2 fond
Z3 tempo
Z4 seuil
Bouteille à la mer
Position partagée avec 2 proches
Détection de chute
Alerte si immobile 2 min
SOS : maintiens le bouton SOS de la carte 1,5 seconde pour appeler le 112 et envoyer ta position.
```
</details>

## Kayak · Kayak en direct

![Kayak](maquette/captures/Kayak.png)

- **Scène** : `kayak`
- **Comportement** : Caméra rivière, métriques eau
- **Données** : activity_sessions
- **Onglets** : Navigation · Rivière · Passages · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Navigation · Rivière · Passages · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Kayak · eaux vives
En direct
L’Arve · Chamonix → Les Houches
Navigation
Rivière
Passages
Sécurité
26:41
DISTANCE
4,36 km
VITESSE
10,0 km/h
CADENCE
51/min
CAP
SO
Passage signalé dans 600 m · seuil, débarquement rive droite conseillé · signalé par 2 membres
L’Arve · station la plus proche
Hub’Eau
DÉBIT
[débit] m³/s
TENDANCE
[tendance]
Données hydrométriques officielles, rafraîchies pendant la sortie.
Seuil · 600 m
Portage rive droite · 2 membres
Récent
Sortie conseillée
Les Houches · base nautique
Bouteille à la mer
Position partagée avec 2 proches
Détection de dessalage
Alerte si chute dans l’eau
```
</details>

## RandoLive · Randonnée en direct

![RandoLive](maquette/captures/RandoLive.png)

- **Scène** : `randolive`
- **Comportement** : Carte prochain repère, trace faite/restante, SOS
- **Données** : activity_sessions, get_route_deviation
- **Onglets** : Direct · Profil · Eau · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Profil · Eau · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Randonnée
En direct
Lac Blanc par les Chéserys
Direct
Profil
Eau
Sécurité
1:13:01
DISTANCE
3,77 km
D+
560 m
ALTITUDE
2021 m
PENTE
12 %
Prochain point d’eau : Chéserys
Dans ≈ 1,2 km · en eau, signalé il y a 2 j
Fiable
Demi-tour conseillé avant 14 h 30
Pour redescendre avec la lumière du jour
Lacs des Chéserys
≈ 1,2 km
En eau
Lac Blanc
≈ 2,4 km · refuge
Bouteille à la mer
Équipage et 2 proches voient ta position
Alerte retard
Prévenir si pas de retour à 16 h
```
</details>

## MondeAsie · Globe · un pays touché

![MondeAsie](maquette/captures/MondeAsie.png)

- **Scène** : `monde_jp`
- **Comportement** : Globe tourné vers l’Asie ; aperçu Japon
- **Données** : countries_geo
- **Onglets** : Aperçu · Pratique
- **Boutons visibles** : Japon · Népal · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Explorer le Japon · Aperçu · Pratique · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Japon 日本
47 préfectures · Alpes de juillet à octobre
Alpes : juil. → oct.
Yen ¥
Urgences 110 · 119
Conduite à gauche
Aperçu
Pratique
Alpes japonaises
Refuges gardés (yamagoya) en saison
Kumano Kodō
Chemins de pèlerinage, printemps et automne
Urgences
110 police · 119 secours
```
</details>

## Japon · Pays · Japon

![Japon](maquette/captures/Japon.png)

- **Scène** : `japon`
- **Comportement** : Préfectures cliquables
- **Données** : admin_regions_geo
- **Onglets** : Aperçu · Carnets · Départs · Pratique
- **Boutons visibles** : Mont Fuji · Kumano Kodō · Yakushima · Daisetsuzan · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Carnets · Départs · Pratique · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Japon 日本
Bonne saison : Alpes du Nord, juillet → octobre
Aperçu
Carnets
Départs
Pratique
BONNE SAISON
Alpes du Nord · Nagano
Juillet → octobre · refuges gardés
Maintenant
Kumano Kodō
Printemps et automne · pèlerinage UNESCO
Daisetsuzan · Hokkaidō
Couleurs d’automne dès septembre
PRÈS DE TOKYO
Mont Takao
≈ 1 h de train depuis Tokyo · famille
Hakone
Sources chaudes, vues sur le Fuji
Aucun départ ouvert pour l’instant. Crée le premier : il apparaîtra dans la Communauté.
Langue
Japonais · grands sentiers souvent bilingues
Monnaie
Yen (¥) · espèces courantes en refuge
Urgences
110 police · 119 secours et pompiers
Conduite
À gauche
Fuseau
UTC+9 · pas d’heure d’été
Prises
A et B · 100 V
```
</details>

## Nagano · Région · Nagano

![Nagano](maquette/captures/Nagano.png)

- **Scène** : `nagano`
- **Comportement** : Région Japon, pas de niveau lieu
- **Données** : admin_regions_geo, geo_pois
- **Onglets** : Aperçu · Randonnées · Carnets · Départs · Pratique
- **Boutons visibles** : Yarigatake · Okuhotaka · Ontake · Hakuba · Kamikōchi 上高地 · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Randonnées · Carnets · Départs · Pratique · Été · Hiver · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Nagano 長野県
Préfecture · Alpes japonaises du Nord
Kamikōchi : mi-avril → mi-nov.
Voitures privées interdites
Refuges gardés
Aperçu
Randos
Carnets
Départs
Pratique
MASSIFS
Okuhotaka 奥穂高岳
Troisième sommet du Japon
3 190 m
Yarigatake 槍ヶ岳
La « lance » des Alpes du Nord
3 180 m
Ontake 御嶽山
Volcan actif · vérifier les restrictions
3 067 m
Kiso-Komagatake
Alpes centrales
2 956 m
Kamikōchi → Yarigatake
≈ 2 jours · nuit en refuge
Cirque de Karesawa
Couleurs d’automne
Aucun départ ouvert. Crée le premier.
Urgences
110 · 119
Refuges
Réservation conseillée en été
```
</details>

## USA · Pays · États-Unis, unités

![USA](maquette/captures/USA.png)

- **Scène** : `usa`
- **Comportement** : Unités impériales par défaut
- **Données** : countries_geo
- **Onglets** : Aperçu · Carnets · Départs · Pratique
- **Boutons visibles** : Yosemite · Yellowstone · Grand Canyon · Appalachian Trail · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Carnets · Départs · Pratique · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
États-Unis
Bonne saison : Utah et Arizona au printemps
Aperçu
Carnets
Départs
Pratique
Appalachian Trail
≈ 2 190 mi · 14 États
Rocky Mountain
Colorado · sentiers au-dessus de 12 000 ft
Grand Canyon
Rive sud ouverte toute l’année
Aucun départ ouvert pour l’instant. Crée le premier : il apparaîtra dans la Communauté.
UNITÉS AFFICHÉES
mi · ft · °F
km · m · °C
Urgences
911 · police, secours, pompiers
Parcs nationaux
Pass annuel « America the Beautiful »
Permis
Requis sur certains sentiers : Half Dome, Mount Whitney
Conduite
À droite
Prises
A et B · 120 V
```
</details>

## Chili · Pays · Chili, hémisphère sud

![Chili](maquette/captures/Chili.png)

- **Scène** : `chili`
- **Comportement** : Hémisphère sud, saisons inversées
- **Données** : countries_geo
- **Onglets** : Aperçu · Carnets · Départs · Pratique
- **Boutons visibles** : Torres del Paine · Atacama · Volcan Osorno · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Carnets · Départs · Pratique · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Chili
Été austral : décembre → mars
Aperçu
Carnets
Départs
Pratique
Saisons inversées · ici l’été va de décembre à mars. Bonne saison en Patagonie de novembre à mars.
Torres del Paine
Circuit W · réservation des campings et refuges obligatoire
Nov. → mars
Désert d’Atacama
Toute l’année · altitude, nuits froides
Volcan Osorno
2 652 m · région des Lacs
Aucun départ ouvert pour l’instant. Crée le premier : il apparaîtra dans la Communauté.
Urgences
131 ambulance · 132 pompiers · 133 police
Langue
Espagnol
Monnaie
Peso chilien (CLP)
Fuseau
UTC−4 · Magallanes UTC−3
Prises
C et L · 220 V
```
</details>

## Mongolie · Pays peu documenté

![Mongolie](maquette/captures/Mongolie.png)

- **Scène** : `mongolie`
- **Comportement** : Pays peu documenté : invitation à contribuer
- **Données** : countries_geo
- **Onglets** : Aperçu · Carnets · Départs · Pratique
- **Boutons visibles** : Oulan-Bator · Altaï · Lac Khövsgöl · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Aperçu · Carnets · Départs · Pratique · Importer une trace GPX · Créer un carnet · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Mongolie
Peu documentée · sois pionnier
Aperçu
Carnets
Départs
Pratique
Peu de traces ici, pour l’instant
Le fond de carte et les points OpenStreetMap couvrent tout le pays. Tes traces et carnets ouvrent la voie aux suivants.
Lac Khövsgöl
3 carnets · à documenter
Pionnier
Aucun départ ouvert pour l’instant. Crée le premier : il apparaîtra dans la Communauté.
Urgences
101 pompiers · 102 police · 103 ambulance
Monnaie
Tugrik (₮)
Conduite
À droite
Prises
C et E · 230 V
```
</details>

## Refuge · Refuge

![Refuge](maquette/captures/Refuge.png)

- **Scène** : `refuge`
- **Comportement** : Infos, accès, carnets ; révélation caméra
- **Données** : geo_pois(alpine_hut|wilderness_hut)
- **Onglets** : Infos · Accès · Carnets
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Réserver une nuit · Infos · Accès · Carnets · Hub · Communauté

<details><summary>Contenu de référence</summary>

```
Refuge du Lac Blanc
Refuge · 2 352 m · Aiguilles Rouges
Infos
Accès
Carnets
STATUT
Gardé
PLACES
[places]
NUITÉE
[tarif]
REPAS
[tarif]
Point d’eau proche
Lac Blanc · à filtrer
2 j
Léa y est passée
Il y a 12 min · position partagée
Ouverture
[dates de gardiennage]
Refuge
Depuis le col des Montets
≈ 2 h 30 par les Chéserys
Depuis la Flégère
≈ 1 h 15
Carnets de ceux qui y ont dormi.
```
</details>

## Bivouac · Bivouac signalé

![Bivouac](maquette/captures/Bivouac.png)

- **Scène** : `bivouac`
- **Comportement** : Règles locales si connues, sinon masqué
- **Données** : geo_pois(camp_site|shelter)
- **Onglets** : Règles · Spot · Nuit · Avis
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Démarrer le bivouac · Règles · Spot · Nuit · Avis · Hub

<details><summary>Contenu de référence</summary>

```
Bivouac signalé
Plan de l’Aiguille · ≈ 2 300 m
Règles
Spot
Nuit
Avis
Règles locales · réserves, sites classés et parcs ont chacun leur règle. LKDV affiche la règle officielle du lieu quand elle existe.
Spot signalé
Sol plat, abrité du vent · 4 membres
À vérifier
Eau
Torrent à ≈ 200 m · à filtrer
Nuit
Coucher [h] · lever [h] · mini [T°]
Météo-France
Ne laisser aucune trace
Liste rappelée au réveil
Prévisions de nuit
[T°] · vent [km/h]
Météo-France
Inès
« Super spot, partez tôt pour le lever »
```
</details>

## Belvedere · Point de vue

![Belvedere](maquette/captures/Belvedere.png)

- **Scène** : `vue`
- **Comportement** : Lumière (suncalc), accès
- **Données** : OSM tourism=viewpoint, suncalc
- **Onglets** : Vue · Lumière · Accès
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Viseur de sommets · Vue · Lumière · Accès · Hub · Communauté

<details><summary>Contenu de référence</summary>

```
Belvédère de la Flégère
Point de vue · 1 877 m · face au Mont Blanc
Vue
Lumière
Accès
Aiguille Verte
Grandes Jorasses
Mont Blanc
Meilleure lumière
Fin de journée, le massif s’embrase
Viseur de sommets
Pointe ton téléphone, les noms s’affichent
Lever du soleil
[h] · derrière l’Aiguille Verte
Coucher du soleil
[h]
Téléphérique de la Flégère
Selon la saison
Horaires exploitant
```
</details>

## Danger · Danger signalé

![Danger](maquette/captures/Danger.png)

- **Scène** : `danger`
- **Comportement** : Sévérité, confirmations, expiration
- **Données** : terrain_reports(category=danger…)
- **Onglets** : Détails · Contourner · Avis
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Détails · Contourner · Avis · Oui, toujours là · Non, plus là · Hub

<details><summary>Contenu de référence</summary>

```
Névé glissant
Signalé il y a 3 h · sur ton itinéraire
Détails
Contourner
Avis
Pente raide · entre les Chéserys et le Lac Blanc. Crampons légers ou demi-tour conseillé.
Y
I
Confirmé par 2 membres · disparaît dans 21 h sans nouvelle confirmation
Toujours là ?
Les 3 membres qui ont prévu cette randonnée demain ont été prévenus.
Variante par la Flégère
+25 min · sans névé
Yanis
« Glace le matin, ça ramollit vers 11 h »
```
</details>

## Acces · Accès et transports

![Acces](maquette/captures/Acces.png)

- **Scène** : `acces`
- **Comportement** : Parking/arrêt, horaires si source
- **Données** : OSM parking/public_transport
- **Onglets** : Y aller · Parking · Covoiturage
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Itinéraire jusqu’au départ · Y aller · Parking · Covoiturage · Hub · Communauté

<details><summary>Contenu de référence</summary>

```
Col des Montets
Départ · 1 461 m · accès sans voiture
Y aller
Parking
Covoiturage
Train Mont-Blanc Express
Gares de Montroc-le-Planet ou Vallorcine
Horaires SNCF
Bus de la vallée
Arrêt Col des Montets · en saison
Horaires
Parking du col
Se remplit tôt l’été · signalé par la communauté
Covoiturage
3 membres partent de Chamonix samedi
Rejoindre
Parking du col
Gratuit ou payant selon la saison
Commune
Samedi 7 h
Chamonix → col · 2 places
```
</details>

## Ami · Ami sur la carte

![Ami](maquette/captures/Ami.png)

- **Scène** : `ami`
- **Comportement** : Position partagée, ancienneté, coupure auto
- **Données** : group_live_positions, user_follows
- **Onglets** : Position · Carnets · Sorties · Matériel
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Message · La rejoindre · Position · Carnets · Sorties · Matériel

<details><summary>Contenu de référence</summary>

```
Léa
Position partagée · il y a 12 min
Position
Carnets
Sorties
Matériel
L
≈ 2,1 km de toi
≈ 1 h 10 à pied · elle avance vers le refuge
Elle a ta frontale Swift RL 900 lm
Prêtée · pense à la récupérer
À récupérer
Trek des 3 Vallées
Pyrénées · avec toi
Elle a ta frontale Swift RL 900 lm
Prêtée · pense à la récupérer
À récupérer
```
</details>

## Velo · Vélo en direct

![Velo](maquette/captures/Velo.png)

- **Scène** : `velo`
- **Comportement** : Suivi vélo
- **Données** : activity_sessions
- **Onglets** : Direct · Segment · Cœur · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Segment · Cœur · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Vélo · route
En direct
Chamonix → col des Montets
Direct
Segment
Cœur
Sécurité
31:01
DISTANCE
11,1 km
VITESSE
21,5 km/h
D+
200 m
CADENCE
86 tr/min
Prochaine difficulté · montée vers le col des Montets
M
S
2 cyclistes LKDV devant toi sur la route
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## SkiRando · Ski de rando en direct

![SkiRando](maquette/captures/SkiRando.png)

- **Scène** : `ski`
- **Comportement** : Sommets gardés visibles
- **Données** : activity_sessions
- **Onglets** : Direct · Neige · Itinéraire · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Neige · Itinéraire · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Ski de rando
En direct
Aiguilles Rouges · hiver
Direct
Neige
Itinéraire
Sécurité
1:30:01
D+
+630 m
ALTITUDE
2080 m
PENTE
28°
DVA
Émission
Bulletin avalanche · risque [x]/5 au-dessus de 2 000 m · source Météo-France
DVA en émission · vérifié au départ pour les 3 membres du groupe
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## Escalade · Escalade en direct

![Escalade](maquette/captures/Escalade.png)

- **Scène** : `escalade`
- **Comportement** : Voie, longueurs (si source)
- **Données** : activity_sessions
- **Onglets** : Voie · Topo · Cordée · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Voie · Topo · Cordée · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Escalade
En direct
Rochers des Gaillands · couenne
Voie
Topo
Cordée
Sécurité
40:01
LONGUEUR
3/6
COTATION
5c
ASSURE
Léa
HAUTEUR
42 m
Vérification croisée faite · nœud, baudrier, système d’assurage
Topo communautaire · [nom de la voie] · dernière mise à jour il y a 2 semaines.
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## Trail · Trail en direct

![Trail](maquette/captures/Trail.png)

- **Scène** : `trail`
- **Comportement** : Suivi trail
- **Données** : activity_sessions
- **Onglets** : Direct · Profil · Eau · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Profil · Eau · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Trail
En direct
Grand Balcon Sud · la Flégère → Planpraz
Direct
Profil
Eau
Sécurité
44:11
DISTANCE
6,8 km
ALLURE
6'32"/km
D+
325 m
D−
203 m
Segment du Balcon · ton meilleur temps [temps]
Point d’eau · aucun signalé sur ce segment · pense à ta réserve
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## Famille · Balade en famille

![Famille](maquette/captures/Famille.png)

- **Scène** : `famille`
- **Comportement** : Repères adaptés, pauses
- **Données** : activity_sessions
- **Onglets** : Balade · Défis · Pauses · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Balade · Défis · Pauses · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Balade en famille
En direct
Lac des Gaillands · chemin plat
Balade
Défis
Pauses
Sécurité
25:01
DISTANCE
1,1 km
PAUSES
2
DÉFIS
3/5
ENFANTS
2
Défi des petits explorateurs
3/5
Lac
Sommet
Fleur
Oiseau
Cabane
Rythme adapté aux enfants · alerte douce toutes les 45 min pour boire.
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## BivouacNuit · Bivouac de nuit

![BivouacNuit](maquette/captures/BivouacNuit.png)

- **Scène** : `bivlive`
- **Comportement** : Thème nuit, spots
- **Données** : activity_sessions
- **Onglets** : Nuit · Ciel · Réveil · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Nuit · Ciel · Réveil · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Bivouac · nuit
En direct
Plan de l’Aiguille
Nuit
Ciel
Réveil
Sécurité
2:00:01
COUCHER
[h]
LEVER
[h]
MINI
[T°]
BATTERIE
78 %
Écran rouge de nuit · préserve ta vision nocturne
Réveil au lever du soleil
Vibration douce 20 min avant
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
Bouteille à la mer
Position partagée avec 2 proches
Détection d’incident
Alerte si immobile 2 min
```
</details>

## Bienvenue · Bienvenue · profil

![Bienvenue](maquette/captures/Bienvenue.png)

- **Scène** : `bienvenue`
- **Comportement** : Profil + autorisation position
- **Données** : user_profiles (préférence)
- **Boutons visibles** : Laugavegur · Annapurnas · Canaries · Jordanie · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Bienvenue dans Explorer
Le monde à ta hauteur, du globe au sentier
POUR QUI EXPLORES-TU ?
Solo
En famille
Avec enfants
Senior
Mobilité réduite
Sportif
Explorer s’ouvre là où tu es. Le globe tourne vers toi puis descend jusqu’à ton quartier. Langue, unités et numéros d’urgence suivent le pays affiché.
Autoriser ma position
Plus tard
```
</details>

## SansPosition · Position refusée

![SansPosition](maquette/captures/SansPosition.png)

- **Scène** : `noloc`
- **Comportement** : Choisir un lieu, réglages
- **Données** : —
- **Boutons visibles** : Laugavegur · Annapurnas · Canaries · Jordanie · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Position désactivée
Explorer reste complet, sans toi au centre
Choisir un point de départ
Ville, massif, sentier
Mes lieux
Bondues · Chamonix (dernier)
Sans position
Ni suivi d’activité, ni Bouteille à la mer
Ouvrir les réglages
Plus tard
```
</details>

## HorsLigne · Hors ligne

![HorsLigne](maquette/captures/HorsLigne.png)

- **Scène** : `offline`
- **Comportement** : Zones téléchargées, état
- **Données** : Cache Storage / IndexedDB
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Hors ligne
Sans réseau
Zone Chamonix téléchargée · [taille]
CARTE
Prête
SENTIERS
Prêts
EAU
Hier
MÉTÉO
Absente
Dernière synchronisation
Il y a 2 h
2 signalements en attente
Ils partiront au retour du réseau
Gérer les zones
Chamonix, Néouvielle, Vercors
```
</details>

## Nuit · Mode sombre

![Nuit](maquette/captures/Nuit.png)

- **Scène** : `nuit`
- **Comportement** : Thème sombre (exception approuvée)
- **Données** : —
- **Onglets** : Autour · Randonnées · Carnets · Amis
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ma position · Ajuster la hauteur du tiroir · Démarrer une activité · appui long : reprendre la dernière · Autour · Randonnées · Carnets · Amis · Hub

<details><summary>Contenu de référence</summary>

```
Chamonix-Mont-Blanc
Haute-Savoie · 1 035 m · vallée de l’Arve
Autour
Randos
Carnets
Amis
Lac Blanc par les Chéserys
≈ 9 km · ≈ 900 m D+ · moyen
Populaire
Le Brévent
Sommet · 2 525 m · face au Mont Blanc
Lacs des Chéserys
Point d’eau · signalé il y a 2 j
En eau
Lac des Gaillands
À plat · idéal en famille
Grand Balcon Sud
La Flégère → Planpraz · facile
Grand Balcon Nord
Plan de l’Aiguille → Montenvers
Lac Blanc
Brévent
Mer de Glace
Midi
Flégère
Chéserys
L
Léa
Au Lac Blanc · il y a 12 min · position partagée
Y
Yanis
À la Flégère · il y a 40 min
```
</details>

## Facile · Mode facile

![Facile](maquette/captures/Facile.png)

- **Scène** : `facile`
- **Comportement** : Grandes cibles, textes simples, profil senior
- **Données** : —
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Hub · Communauté · Explorer · Messages · Compte

<details><summary>Contenu de référence</summary>

```
Mode facile
Gros boutons, mots simples
Marcher près de moi
Une boucle de 30 minutes
Un endroit calme
Banc, ombre, vue
Rentrer
Le chemin le plus simple
Appeler un proche
Léa · Yanis
```
</details>

## SOS · SOS

![SOS](maquette/captures/SOS.png)

- **Scène** : `sos`
- **Comportement** : Maintien 1,5 s, compte à rebours annulable, appel pays
- **Données** : sos_alerts, countries_geo.phone/urgences
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Navigation, réduite pendant l’activité · Pause · Tour · Maintenir pour terminer

<details><summary>Contenu de référence</summary>

```
SOS
Maintien de l’Island détecté
3
Appel du 112 dans 3 s
Ta position part avec l’appel et vers tes proches
Annuler
Appeler maintenant
45,9797° N · 6,8902° E
Altitude ≈ 2 350 m · Lac Blanc
Prévenus
Léa, Yanis, contact d’urgence
Téléphone
Batterie 64 % · réseau faible, SMS de secours prêt
```
</details>

## Bilan · Fin de sortie

![Bilan](maquette/captures/Bilan.png)

- **Scène** : `resume`
- **Comportement** : Vue d’ensemble caméra, stats, partage signalements
- **Données** : activity_sessions → hike_sessions
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Partager

<details><summary>Contenu de référence</summary>

```
Sortie enregistrée
Lac Blanc par les Chéserys · sam. 1 nov.
Trace vérifiée
Carnet créé
DISTANCE
9,2 km
D+
912 m
TEMPS
4 h 52
PAUSES
3
Carnet automatique
14 photos · trace · 3 notes vocales
Ton empreinte
+1 sortie · +9,2 km sur ton globe
Signalement partagé
Chéserys « En eau » · merci
```
</details>

## HorsTrace · Hors itinéraire

![HorsTrace](maquette/captures/HorsTrace.png)

- **Scène** : `horstrace`
- **Comportement** : Carte ambre, direction de retour
- **Données** : get_route_deviation
- **Onglets** : Direct · Profil · Eau · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Profil · Eau · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Randonnée
En direct
Lac Blanc par les Chéserys
Direct
Profil
Eau
Sécurité
1:26:41
DISTANCE
4,48 km
D+
665 m
ALTITUDE
2126 m
PENTE
12 %
Prochain point d’eau : Chéserys
Dans ≈ 1,2 km · en eau, signalé il y a 2 j
Fiable
Demi-tour conseillé avant 14 h 30
Pour redescendre avec la lumière du jour
Lacs des Chéserys
≈ 1,2 km
En eau
Lac Blanc
≈ 2,4 km · refuge
Bouteille à la mer
Équipage et 2 proches voient ta position
Alerte retard
Prévenir si pas de retour à 16 h
```
</details>

## Calques · Calques de la carte

![Calques](maquette/captures/Calques.png)

- **Scène** : `calques`
- **Comportement** : Fond 3D/satellite/plan, toggles, télécharger zone
- **Données** : style MapLibre, offline
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Revenir au niveau supérieur ou rechercher · Calques de la carte · Ajuster la hauteur du tiroir · Retour · Relief 3D · Satellite · Plan · Télécharger la zone · Hub · Communauté

<details><summary>Contenu de référence</summary>

```
Calques
Ce que la carte affiche
FOND DE CARTE
Relief 3D
Satellite
Plan
DONNÉES
Sentiers et traces
GR®, PR, tes itinéraires
Points d’eau
État signalé par la communauté
Refuges et bivouac
Gardiennage, règles
Dangers signalés
Expirent sans confirmation
Amis
Positions partagées
Neige et avalanche
Enneigement, bulletin
Radar météo
Pluie dans l’heure
Télécharger cette zone
Carte, sentiers et points pour le hors-ligne
```
</details>

## Arriere · Arrière-plan · Live Activity

![Arriere](maquette/captures/Arriere.png)

- **Scène** : `arriere`
- **Comportement** : Live Activity hors app uniquement
- **Données** : plugin natif
- **Onglets** : Direct · Tours · Cœur · Sécurité
- **Boutons visibles** : Le Brévent · Aiguille du Midi · Mont Blanc · Lac Blanc · Lacs des Chéserys · Lac des Gaillands · Refuge du Lac Blanc · Bivouac signalé · Névé glissant · Départ · Belvédère · Bellachat · Léa, position partagée · Yanis, position partagée · Orientation : cap en haut, toucher pour nord en haut · SOS, maintenir 1,5 seconde · Ajuster la hauteur du tiroir · Direct · Tours · Cœur · Sécurité · Navigation, réduite pendant l’activité · Pause · Tour

<details><summary>Contenu de référence</summary>

```
Course
En direct
Chamonix · boucle des Gaillands
Direct
Tours
Cœur
Sécurité
32:15
DISTANCE
6,43 km
ALLURE
5'01"/km
CARDIO
158 bpm
D+
84 m
Kilomètres
km 6 en cours
Coach vocal · « Allure stable, garde 5'00. »
km 1
Le long de l’Arve
5'04
km 2
Lac des Gaillands
4'58
km 3
Les Pècles
5'02
km 4
Retour rive droite
5'00
km 5
Centre
4'59
Z1 récup
Z2 fond
Z3 tempo
Z4 seuil
Bouteille à la mer
Position partagée avec 2 proches
Détection de chute
Alerte si immobile 2 min
SOS : maintiens le bouton SOS de la carte 1,5 seconde pour appeler le 112 et envoyer ta position.
```
</details>

## Planches de spécification

![Tracés](maquette/captures/Traces.png)
![Caméra](maquette/captures/Camera.png)
![Hiérarchie](maquette/captures/Hierarchie.png)
