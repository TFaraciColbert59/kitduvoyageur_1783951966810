# LKDV — Mission Antigravity : Explorer mobile, randonnées et POI à la demande

Recherche et cadrage du 3 octobre 2026. Document autonome à remettre intégralement à Antigravity.

## 1. Instruction de mission

Tu interviens sur LKDV pour rendre les randonnées et points d’intérêt OpenStreetMap consultables à la demande dans **la version mobile de `/explorer` uniquement**. Le produit doit rester fluide pendant les chargements, les gestes cartographiques et les ouvertures de drawers. Aucun téléchargement du catalogue mondial dans la base. Aucun changement au Compas ou au travail de Claude Opus en cours.

Implémente des données réelles, avec provenance, qualité et erreurs explicites. N’annonce ni « toutes les randonnées du monde », ni une disponibilité instantanée garantie. L’objectif est une couverture internationale des objets présents dans OSM, consultés par petite zone.

Ce document est une spécification de chantier, pas une preuve d’implémentation. Les exemples Overpass ci-dessous sont des modèles documentés à vérifier sur de petits échantillons avant livraison ; ils n’ont pas été exécutés dans cette recherche. Les plafonds techniques proposés sont des budgets LKDV initiaux, pas des quotas contractuels des fournisseurs.

### Périmètre ferme

- Lecture et affichage mobile : recherche par zone, résultats, filtres, sélection d’un circuit, tracé, fiches POI et états réseau.
- Conserver le fonctionnement actuel des parcours LKDV et distinguer clairement les données OSM.
- Aucun nouveau parcours calculé, aucune navigation guidée, aucune génération IA de randonnée dans ce lot.
- Aucun import massif, migration SQL, modification de voyages, kits, invitations, favoris persistants ou préparateur.
- Ne pas supprimer les données géographiques déjà présentes pour « libérer de la place ».
- Pas de refonte desktop : les nouvelles requêtes et interfaces sont activées uniquement dans le chemin mobile ; vérifier seulement l’absence de régression desktop.
- Pas de paiement, création de compte fournisseur, abonnement, changement global de fournisseur de carte ou déploiement automatique.
- Livraison sur branche dédiée et PR révisable. Aucun message envoyé à d’autres personnes.

## 2. Ce que fournit réellement OSM

Il faut distinguer quatre objets :

| Objet | Signification | Traitement dans ce lot |
|---|---|---|
| Chemin OSM | Segment cartographié, par exemple `highway=path` | Fond cartographique ; ce n’est pas automatiquement une randonnée |
| Relation de randonnée | Circuit ou itinéraire assemblant des membres, notamment `type=route`, `route=hiking` ou `foot` | Catalogue externe consultable |
| POI | Point, bâtiment ou surface représentant un lieu | Marqueur et fiche sourcée |
| Parcours calculé | Assemblage produit par un moteur de routage | Hors périmètre |

Une zone sans relation de randonnée peut contenir beaucoup de chemins. Un itinéraire OSM peut être une longue traversée, une branche ou un réseau, pas forcément une boucle faisable dans la journée. OSM ne fournit pas systématiquement durée, dénivelé, photos, état actuel, avis ou difficulté globale. Ne jamais inventer ces données pour remplir les cartes. [S4–S6]

Komoot combine OSM, son moteur et sa communauté ; AllTrails et Visorando enrichissent leurs catalogues par des contributions. Leurs circuits, textes et photos ne deviennent pas accessibles via Overpass. Aucun scraping de ces catalogues dans ce chantier. [S20–S22]

## 3. Fournisseurs et limites : décision explicite

| Besoin | Source retenue ou règle | Ce qu’il ne faut pas supposer |
|---|---|---|
| Relations et POI OSM | Overpass via un adaptateur serveur | Pas d’engagement de service ni de quota réservé |
| Endpoint initial | `https://overpass-api.de/api/interpreter` | Ne pas tourner entre instances pour contourner les limites |
| Fond de carte | Conserver le fournisseur existant après identification | La licence des données ne finance pas l’hébergement des tuiles |
| Recherche de lieu | Réutiliser le service existant après audit de sa politique | Ne pas ajouter Nominatim public comme autocomplete |
| Conversion | Adaptateur OSM → modèle LKDV → GeoJSON | JSON Overpass n’est pas du GeoJSON |
| Source alternative | Interface permettant un fournisseur futur | Une interface interchangeable n’autorise aucun usage de service tiers |

**Correction importante :** la documentation Overpass cite explicitement comme usage problématique une application grand public dépendant des instances publiques comme backend. Ses repères d’environ 10 000 requêtes/jour et 1 Go/jour ne sont ni un abonnement gratuit, ni une autorisation à viser ces volumes. Le pilote doit rester limité, désactivable et instrumenté ; une diffusion importante nécessite une solution d’hébergement ou un fournisseur adapté. Aucun cache ne supprime cette limite. [S1]

Les données OSM sont sous ODbL : attribution et obligations de partage applicables aux bases dérivées. Ne pas traduire cela par « toute l’application doit être open source », ni par « une attribution suffit dans tous les cas ». Garder origine et licence ; examiner les obligations avant distribution d’une base dérivée. [S2]

Les tuiles standard `tile.openstreetmap.org` ont leur propre politique : attribution visible, cache HTTP respecté, identification appropriée et pas de téléchargement massif/offline. Ne pas appliquer cette politique à un autre fournisseur sans lire ses conditions. Les tuiles vectorielles OSMF ont encore une politique distincte. [S3, S23]

Nominatim public impose notamment une limite globale par application de 1 requête/seconde et interdit l’autocomplete. Sa politique comporte aussi des restrictions explicites pour les intégrations générées par des plateformes IA. **Ne pas ajouter ce service par défaut** : conserver la recherche existante ou laisser ce sous-chantier hors lot. [S7]

Waymarked Trails est une référence utile pour comprendre la présentation des itinéraires OSM. Son code public n’est pas la preuve que son API hébergée est un backend gratuit et illimité autorisé pour LKDV. Aucune dépendance automatique sans conditions d’usage vérifiées. [S19]

## 4. État du dépôt observé et pièges d’intégration

Dépôt : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810

Référence observée pendant la recherche : `668121b91e493ed004dcc0d9c3cd142b20b76ced` (PR #63, 2 octobre). Refaire un état des lieux au démarrage : Opus continue à travailler et ses changements non poussés ne sont pas visibles.

| Fichier observé | Constat | Conséquence |
|---|---|---|
| `src/app/explorer/page.tsx` | Charge des parcours initiaux autour de Chamonix et choisit le moteur avec un flag | Ne pas ajouter Overpass au rendu serveur bloquant |
| `src/components/explorer/ExplorerClient.tsx` | Deux moteurs, TanStack Query, état viewport et sélection | Ajouter un orchestration mobile isolée |
| Même fichier | Le bouton de recherche de zone est conditionné à `!unifiedMap` | Il n’est pas déjà disponible de façon uniforme dans les deux moteurs |
| Même fichier | Le détail va à `/api/hikes/${selectedTrailId}` | Un identifiant OSM doit être dispatché vers son adaptateur, jamais vers la route d’ID local |
| Même fichier | Une erreur POI peut devenir `[]` | Le nouveau chemin doit distinguer erreur et résultat vide |
| `src/components/map/UnifiedExplorerMap.tsx` | Appelle `useViewportData(viewport, true)` et remonte ses résultats | Risque de double chargement et d’écrasement des résultats externes |
| Même fichier | `onMapReady` ne transmet pas l’instance de carte | Ne pas supposer qu’un wrapper peut injecter des couches via cette callback |
| `src/components/explorer/types.ts` | `MapTrail` contient lat/lng, géométrie et champs optionnels ; images génériques par ID | Ne pas faire passer un centre pour un départ ni une image générique pour la photo du lieu |
| `src/lib/overpass.ts` | Module désactivé : `export {}` | Ce n’est pas un client prêt à l’emploi |
| `scripts/coverage/pipeline.ts` | Validation en dry-run sans réseau ni écriture | Réutiliser des règles pertinentes, pas déclencher un pipeline d’import |

Le `package.json` lu déclare Next 15.5.25, React 19.0.3, MapLibre `^6.4.1`, Leaflet 1.9.4, TanStack Query et Virtual, Dexie et Zod. Ce sont des déclarations, pas une vérification des versions résolues : lire le lockfile. Ne pas suivre aveuglément un README ancien ni mettre à jour les dépendances pour ce chantier.

### Isolation du travail d’Opus

1. Lire les instructions applicables du dépôt, relever `git status`, HEAD et les consommateurs des composants.
2. Créer un worktree propre sur une branche telle que `feat/explorer-mobile-osm`, depuis une base poussée explicitement enregistrée.
3. Ne pas toucher au checkout d’Opus, ne pas stasher ses modifications, ne pas nettoyer ses fichiers, ne pas réinitialiser sa branche.
4. Préférer de nouveaux modules `src/features/explorer-osm/**` et des endpoints dédiés `src/app/api/explorer/osm/**` ; noms proposés à adapter aux conventions.
5. Interdire les edits dans Compas, Hub, préparation, services partagés et migrations. Préserver les positions privées du groupe dans des circuits séparés.
6. Examiner si les interfaces existantes suffisent. Si la carte partagée impose un changement : produire le patch d’intégration proposé sans l’appliquer ; continuer le backend, les normalisateurs et la vue isolée. Une copie massive du moteur ou une mutation globale ne sont pas des solutions par défaut.
7. Ne pas monter deux cartes superposées pour éviter la difficulté d’intégration. Un seul contexte cartographique actif.
8. Ne pas activer globalement `explorer_unified_map_enabled` ; le choix du moteur est une décision existante à respecter.

## 5. Architecture minimale

Flux : geste mobile → contrôleur Explorer → API LKDV dédiée → cache public borné → adaptateur Overpass → validation/normalisation → résultat borné → carte et drawer.

Trois opérations suffisent :

- `searchRoutes(bbox, signal)` : résumés de relations, sans géométrie mondiale.
- `searchPois(bbox, categories, signal)` : uniquement les catégories activées.
- `getRouteDetail(osmRelationId, signal)` : tracé du seul itinéraire sélectionné, avec limites et qualité.

Le navigateur ne reçoit ni URL fournisseur configurable, ni possibilité de soumettre du QL arbitraire. Construire les requêtes à partir de coordonnées et catégories validées côté serveur. L’adaptateur est spécifique à OSM mais le modèle d’affichage doit distinguer les sources.

Ne pas détourner les endpoints génériques `/api/hikes` ou `/api/pois`, qui peuvent avoir des consommateurs hors Explorer. Le backend nouveau est en lecture seule et ne requiert pas de clé Supabase service-role.

### Contrat conceptuel

```ts
type SourceId = `osm:${'node' | 'way' | 'relation'}:${string}`;
type GeometryStatus = 'not-loaded' | 'complete' | 'partial' | 'unavailable';

interface SourceInfo {
  provider: 'openstreetmap';
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
  sourceUrl: string;
  fetchedAt: string;
  dataTimestamp: string | null; // fraîcheur de la base fournisseur, si fournie
  license: 'ODbL-1.0';
}

interface ExternalRouteSummary {
  id: SourceId;
  source: SourceInfo;
  name: string;
  ref: string | null;
  network: string | null;
  representativePoint: [number, number] | null; // lng, lat ; PAS un départ
  representativePointKind: 'bbox-center' | 'geometry-point' | null;
  declaredDistanceKm: number | null;
  declaredDurationMinutes: number | null;
  geometryStatus: GeometryStatus;
}

interface SearchEnvelope<T> {
  status: 'ok' | 'empty' | 'partial' | 'unavailable';
  items: T[];
  fetchedAt: string;
  stale: boolean;
  limited: boolean;
  warnings: string[]; // codes contrôlés, pas erreurs brutes fournisseur
}
```

Ajouter au détail : géométrie, bornes, raisons d’incomplétude, mesures avec méthode/provenance, éventuelles restrictions. Utiliser une union discriminée pour les items LKDV/OSM, au lieu de transformer un ID OSM en ID de la base.

## 6. Requêtes Overpass et maîtrise du volume

Documentation du langage : [S4]. Endpoint en POST, corps encodé avec `URLSearchParams({ data: query })`, pas de concaténation de texte utilisateur. L’ordre bbox Overpass est **sud, ouest, nord, est**. GeoJSON emploie **longitude, latitude**. [S8, S17]

### A. Résumés de randonnées

Exemple sur une petite zone de Chamonix, à valider :

```overpass
[out:json][timeout:12][maxsize:33554432];
relation["type"="route"]["route"~"^(hiking|foot)$"]
  (45.90,6.84,45.95,6.90);
out tags center 101;
```

Le plafond 101 sert à détecter une liste limitée à 100 ; ce n’est pas une pagination ni un classement de proximité. Trier côté LKDV après normalisation et déclarer la limite. Le timeout et `maxsize` contraignent le calcul fournisseur ; ils ne remplacent pas une limite d’octets de réponse côté LKDV.

Le centre est celui de l’emprise de l’objet, pas un départ ni forcément un point du tracé. Une longue relation qui traverse la zone peut avoir son centre loin de celle-ci. La conserver dans la liste comme « traverse la zone » ; ne pas forcer son marqueur dans l’écran. Pour l’aperçu local, charger sur sélection une géométrie bornée et choisir un point réellement présent sur un segment. Ne pas récupérer tous les tracés détaillés pour corriger tous les marqueurs.

### B. POI par catégories choisies

```overpass
[out:json][timeout:12][maxsize:33554432];
(
  nwr["amenity"="drinking_water"](45.90,6.84,45.95,6.90);
  nwr["natural"="spring"](45.90,6.84,45.95,6.90);
  nwr["tourism"~"^(alpine_hut|wilderness_hut|camp_site|viewpoint)$"]
    (45.90,6.84,45.95,6.90);
);
out center 301;
```

Ne générer que les sous-requêtes des catégories activées. Une requête `nwr` inclut nodes, ways et relations ; limiter les tags retenus après réception. Pas de collecte mondiale, ni grille systématique de régions, ni requête sur tous les chemins mondiaux.

### C. Détail d’une relation sélectionnée

Modèle avec ID entier validé, à substituer uniquement côté serveur :

```overpass
[out:json][timeout:12][maxsize:33554432];
relation(id:RELATION_ID)["type"="route"]["route"~"^(hiking|foot)$"];
out body geom;
```

`RELATION_ID` est un placeholder, pas une requête directement exécutable. Une relation très longue peut dépasser le budget malgré sa sélection unique. Ne pas augmenter les plafonds en boucle. Conserver la fiche et proposer un aperçu de zone : `out body geom(sud,ouest,nord,est);`, explicitement marqué partiel. Ne pas présenter la longueur d’un extrait comme la longueur totale. [S8]

Les sous-relations demandent une stratégie bornée : détecter les membres relation ; soit résolution limitée avec profondeur, nombre de membres et cycle detection, soit état partiel explicite dans ce premier lot. Aucune récursion mondiale implicite. L’absence de géométrie ne doit pas empêcher l’ouverture de la fiche.

## 7. Qualité géographique : règles indispensables

- Une relation contient des segments, parfois inversés, disjoints, des alternatives ou des sous-relations. Préserver cette structure. Ne pas concaténer les coordonnées en une seule ligne. [S5]
- Garder les ruptures en `MultiLineString`. Si un point est invalide, couper le segment ; retirer le point puis relier ses voisins créerait un faux passage.
- Un GeoJSON parsé sans erreur ne prouve pas la continuité ni la praticabilité du circuit.
- Une géométrie tronquée ou un membre absent déclenche `partial`. Le marqueur `tainted` d’osmtogeojson est utile, mais ne suffit pas à valider une randonnée entière. Tester les relations récréatives réelles ; ne pas supposer que le convertisseur fournit automatiquement un tracé ordonné complet. [S9]
- Valider strictement les coordonnées avant coercition : `null`, chaîne vide, NaN, infini sont refusés. Zéro est une coordonnée valide et ne doit pas être rejeté par un test de vérité.
- Ne jamais fermer automatiquement une boucle, relier des morceaux par une droite ou calculer un trajet de remplacement.
- Une distance déclarée OSM est conservée avec son origine. Une somme de segments peut compter des variantes ou répétitions : l’identifier comme mesure des géométries disponibles, pas comme distance certifiée d’un circuit.
- Ne pas calculer D+ depuis le seul `ele` d’un refuge ou sommet. Pas de durée par vitesse arbitraire ni badge « famille » par défaut.
- `sac_scale` décrit une difficulté technique, pas la totalité du risque. Garder la valeur et une explication ; ne pas mapper automatiquement toute absence à « facile ». Les valeurs extrêmes et les segments non renseignés doivent rester visibles. [S10]
- La date de récupération API n’est ni une date de contrôle terrain ni la date de dernière modification d’un objet. Séparer ces informations.

### Taxonomie POI de départ

| Catégorie | Tags indicatifs | Règle d’affichage |
|---|---|---|
| Eau | `amenity=drinking_water`, `natural=spring`, `amenity=water_point` | Conserver `drinking_water`, contradictions, saisonnalité ; source naturelle ≠ eau potable |
| Refuge | `tourism=alpine_hut` | Ouverture, accueil et réservation inconnus si absents |
| Abri | `amenity=shelter`, `tourism=wilderness_hut` | Ne pas promettre présence de personnel ou hébergement disponible |
| Camping | `tourism=camp_site` | Ne pas le renommer automatiquement « bivouac autorisé » |
| Vue | `tourism=viewpoint` | Pas de photo générée présentée comme réelle |
| Sommet | `natural=peak` | Altitude uniquement si donnée exploitable |
| Parking | `amenity=parking` | Conserver restrictions et accès |

Pour l’eau : « indiquée potable dans OSM », « non potable », « potabilité inconnue » ou « conditionnelle », selon les tags ; un conflit reste un conflit. Aucune garantie sanitaire. [S11]

Conserver `access`, `foot`, conditions et restrictions ; un `foot` spécifique peut préciser un `access` général. Si le modèle conditionnel n’est pas interprété, afficher son texte comme information non évaluée. Un objet privé n’est pas une destination librement accessible. [S12]

Dédupliquer par `(source, type, id)`. Entre un POI OSM node et un way proche, ou entre OSM et LKDV, la seule proximité ou le même nom ne prouvent pas l’identité. Fusion seulement avec correspondance explicite vérifiée ; sinon accepter une ambiguïté maîtrisée.

## 8. UX mobile : légère, lisible, honnête

Réutiliser la charte et les composants mobiles de LKDV. Une carte, les contrôles existants et un drawer ; aucune nouvelle page racine ni nouvelle bottom bar.

### Parcours utilisateur

1. La carte existante s’affiche sans attendre Overpass. GPS uniquement après un geste explicite ; le refus ne bloque pas l’exploration.
2. Après déplacement, proposer « Rechercher dans cette zone ». Aucun appel externe pendant le pan/pinch. Un résultat valide en cache peut être réaffiché immédiatement.
3. Si la zone est trop vaste : « Zoome pour chercher des randonnées ». Ne pas envoyer la requête avant de découvrir qu’elle est excessive.
4. Pendant la recherche : indicateur discret, carte toujours interactive, possibilité d’annuler. Garder les anciens résultats uniquement en indiquant qu’ils concernent la recherche précédente.
5. Résultats : source OSM, nom/référence, métriques connues seulement. Le compteur signifie « affichés », pas « total existant dans la région ».
6. Appui sur un résultat : drawer immédiat avec résumé déjà chargé ; récupération du détail ensuite. Le réseau ne doit pas retarder l’ouverture.
7. Sélection synchronisée entre liste et carte. Ajuster la caméra une fois au geste utilisateur, avec marges tenant compte du drawer et de la barre inférieure.
8. Fiche POI : catégorie, tags utiles, provenance, fraîcheur, restrictions et lien OSM. Ne pas activer de réservation ou de préparation.

### États à distinguer

| État | Message/action |
|---|---|
| Vide après succès complet | « Aucun itinéraire OSM trouvé dans cette zone » |
| Requête refusée ou serveur indisponible | « La recherche est temporairement indisponible » + réessayer |
| Limite atteinte | « Une partie des résultats est affichée. Zoome pour affiner. » |
| Données anciennes en cache | « Résultats enregistrés le… » |
| Géométrie incomplète | « Tracé partiel » ; aucune métrique totale trompeuse |
| Sans réseau et sans cache | État hors connexion, pas « aucun parcours » |
| Information manquante | « Non renseigné » ou champ omis |

Filtres : type/source/catégorie ; durée/difficulté uniquement si renseignées. Prévoir « inclure les données non renseignées » pour ne pas faire disparaître presque tout OSM. Une recherche textuelle locale ne doit pas être présentée comme une recherche mondiale.

Drawer : cibles tactiles d’au moins 44 CSS px, fermeture accessible, focus et libellés VoiceOver, gestes qui ne volent pas le déplacement de carte, safe areas et clavier iOS. Préserver le zoom manuel. Ne jamais cacher l’attribution sous le drawer ou la bottom bar. Réduire flou, transparence et animations lorsque nécessaire à la lisibilité ou aux performances.

## 9. Performance : budgets initiaux à mesurer

Ces valeurs sont proposées pour cadrer le pilote et doivent être ajustées à partir des mesures, sans prétendre avoir été atteintes.

| Mesure | Budget initial |
|---|---|
| Recherche externe | Explicite ; une recherche de zone active par client |
| Étendue | Zoom indicatif ≥ 12 ET aire géodésique ≤ 400 km² ; les deux contrôles |
| Résultats | 100 itinéraires et 300 POI maximum ; état limité au-delà |
| Réponse upstream | 4 MiB décodés maximum par opération ; arrêt de lecture au dépassement |
| Résumé vers mobile | Cible ≤ 300 Ko transférés compressés, à mesurer |
| Tracé sélectionné | 1 actif ; affichage simplifié avec cible ≤ 10 000 sommets |
| Chargement | 12 s fournisseur ; deadline LKDV compatible avec la plateforme, initialement 15 s |
| Interface | Retour visuel au toucher visé < 100 ms ; INP terrain p75 ≤ 200 ms |
| Animation | Viser le budget de frame de 16,7 ms à 60 Hz sur les appareils retenus |
| Cache navigateur | 10 MiB maximum pour ce module, avec éviction |

Le seuil INP vient de web.dev ; les autres plafonds sont des décisions de conception LKDV. Le temps Overpass à froid ne peut pas être garanti. Mesurer séparément réactivité UI, résultat cache chaud et résultat réseau froid. [S15]

- Ne monter qu’un moteur de carte pour le chemin actif ; imports dynamiques, pas de chargement simultané Leaflet + MapLibre « au cas où ».
- Pour MapLibre : couches WebGL et clustering de points ; pas de centaines de composants React/markers DOM. Éviter de réinjecter toutes les sources pendant chaque frame. [S13]
- Simplifier la géométrie pour l’affichage seulement ; préserver une représentation de mesure distincte si nécessaire. Déplacer la conversion lourde côté serveur ou worker.
- Réutiliser TanStack Query et Virtual déjà présents : annulation avec `signal`, liste virtualisée, clés stables et caches bornés. L’AbortSignal doit être passé au `fetch` pour annuler réellement sa consommation. [S14]
- Ignorer toute réponse devenue obsolète après changement de zone/filtre ; l’annulation navigateur seule n’assure pas que le calcul fournisseur soit arrêté.
- Sur sélection A puis B, la réponse tardive A ne doit ni remplacer B ni déplacer sa caméra.
- Pas de photo réseau par POI ; pictogrammes/sprite et placeholder neutre.
- Pendant pan/pinch : pas de setState React à chaque frame, pas de recomputation globale, pas de flou animé plein écran. Relancer les calculs après stabilisation.
- Suspendre les tâches non essentielles lorsque l’onglet est masqué. Libérer listeners, timers, workers, buffers et ressources cartographiques au démontage.
- Ne pas promettre 60 FPS sur tous appareils ; joindre les profils mesurés et les limites connues.

## 10. Cache, débit et résilience

Ne pas confondre cache et import. Les caches ont une taille maximale, une durée de vie et peuvent disparaître.

### Stratégie proposée

- Résumés publics : frais 30 min ; repli périmé au plus 24 h, signalé.
- Détails : frais 24 h ; repli au plus 7 jours, signalé ; aucune affirmation de conditions actuelles.
- Réponse vide réussie : cache court 5 min. Échec : ne jamais le mettre en cache comme succès vide.
- Clé : version du schéma, fournisseur, zone normalisée, opération, catégories triées et paramètres influençant le résultat. Si une bbox est arrondie, requêter réellement la bbox normalisée correspondante et filtrer côté affichage.
- Antiméridien : normaliser puis scinder en deux petites fenêtres si nécessaire ; garder le budget global et séquencer. Pas de requête couvrant artificiellement presque 360°.
- Une LRU par processus, bornée en octets et en nombre d’entrées, peut servir au prototype ; elle n’est ni durable ni globale en serverless.
- Réutiliser le cache partagé et le rate limiter existants s’ils sont adaptés. Ne pas provisionner un nouveau service payant sans décision explicite.
- Pour un pilote déployé, les plafonds fournisseur doivent être coordonnés entre instances. Sans mécanisme global fiable, garder le flag désactivé pour le grand public et documenter ce blocage ; ne pas présenter une Map en mémoire comme une protection globale.
- Regrouper les demandes simultanées identiques (single-flight). L’annulation d’un client ne doit pas tuer une requête partagée encore utile à d’autres.
- Limiteur par session/IP, limite globale, file courte, budget d’octets et coupe-circuit. Exemple conservateur initial : 6 recherches/minute/client, une opération upstream active globalement, à adapter au pilote ; aucun de ces chiffres n’est une permission fournisseur.
- Sur 429 : respecter `Retry-After` si disponible, sinon cooldown configuré. Pas de retry automatique en rafale. Sur panne : cache connu ou état indisponible ; essai ultérieur explicite.
- Ne pas répartir artificiellement les appels sur des miroirs/IP pour esquiver les quotas.

IndexedDB peut accélérer le retour sur une zone ; gérer quota dépassé, stockage indisponible et éviction. Pas de gros JSON synchrones dans localStorage. Le cache local n’est pas une promesse de fonctionnement offline : fond de carte et données ont des contraintes séparées. [S16]

## 11. Sécurité et confidentialité

### Entrées et requêtes

- Zod ou validation équivalente stricte : nombres finis, plages géographiques, zoom, aire, listes d’enums, taille du corps, longueur des chaînes et nombre d’items.
- IDs OSM en chaîne décimale validée, pas de flottants ; ne pas permettre `relation`/`node` arbitraires sur un endpoint de détail randonnée.
- Aucun QL, regex fournisseur, URL, hostname, timeout ou maxsize contrôlé par le client.
- Destination HTTPS fixe issue d’une configuration serveur contrôlée ; pas de redirections suivies automatiquement. Aucun fetch d’URL trouvée dans les tags OSM. Cela évite de créer un proxy SSRF. [S18]
- Limiter le flux de réponse après décompression ; ne pas se fier uniquement à Content-Length. Valider statut, format, schéma et éventuel `remark` d’erreur Overpass même en HTTP 200.
- Un résultat partiel avec erreur ne devient pas `ok`. Limites de profondeur et de membres avant assemblage des relations ; arrêt sur cycle.

### Rendu

- Tout tag OSM est non fiable. Texte React échappé, jamais `dangerouslySetInnerHTML` ou popup HTML interpolée.
- URLs externes : autoriser seulement HTTP(S), refuser schémas actifs, credentials embarqués et valeurs malformées. Préférer HTTPS lorsque fourni ; ne pas forcer une URL à changer de schéma au risque de la casser.
- Liens externes nouveaux onglets avec `noopener noreferrer` ; les liens de source OSM sont construits à partir du type/ID validés.
- Pas d’images distantes arbitraires ou SVG provenant des tags ; pas de serveur proxy d’images libre.
- Ne pas assouplir la CSP globale pour faire passer le chantier. Respecter le worker MapLibre déjà géré par le dépôt.

### Vie privée et cache

- Le proxy transmet seulement la zone nécessaire et les catégories ; aucun ID de compte LKDV, jeton, nom de voyage ou position live d’un membre.
- Séparer absolument les résultats publics OSM des positions privées déjà affichables dans Explorer. Aucun cache public d’une réponse fusionnée avec des données personnelles.
- Éviter de journaliser les coordonnées GPS exactes, l’historique individuel et les textes bruts. Mesures agrégées : durée, octets, succès, catégorie d’erreur, cache hit/miss.
- Cookies/jetons jamais transmis au fournisseur. Ne pas faire confiance à un header IP fourni directement par le navigateur pour le rate limiting.
- Same-origin/CORS contrôlé selon les conventions web/Capacitor existantes ; CORS ne remplace pas un rate limiter.
- Le frontend peut toujours être automatisé par un tiers : protéger le budget fournisseur côté serveur, même sans clé API à voler.

## 12. Vérification ciblée et critères de livraison

Ne pas lancer une boucle d’audit globale de plusieurs heures. Tests centrés sur les risques de ce lot ; fixtures locales pour la majorité des scénarios. Quelques appels réels sur de petites zones, sans tests de charge sur Overpass public.

### Tests de données et sécurité

1. Bbox invalide, infinie, trop grande, longitude inversée et antiméridien.
2. Coordonnées `(0,0)` valides ; valeurs null/vides rejetées sans fausse géométrie.
3. Relation simple, directions inversées, discontinuité, boucle, variantes, membre absent, sous-relation et cycle.
4. Centre hors viewport sans faux départ ; tracé local coupé affiché comme tel.
5. ID local et OSM identiques numériquement sans collision ni mauvaise route API.
6. Eau sans potabilité, eau non potable, restrictions privées/conditionnelles, difficulté inconnue.
7. Tag contenant du HTML/script et URL `javascript:` : aucun code exécuté.
8. Réponse HTML, JSON malformé, HTTP 200 avec `remark`, 429, 504, dépassement d’octets et timeout.
9. A→B et filtres rapides : aucune réponse A tardive ne remplace B ; pas de double requête identique.
10. Cache expiré, saturé, indisponible ; erreur ≠ vide ; aucun contenu privé en cache public.

### Scénarios mobile

- Chamonix : zone familière et routes longues ; Lille : coexistence avec les parcours LKDV ; Dolomites et une petite zone au Japon : localisation internationale ; zone sans relation : message honnête. Les comptes attendus doivent être observés au test, pas inventés.
- Largeurs 360/390/430 CSS px, portrait/paysage, safe areas, clavier, zoom texte, VoiceOver et mouvement réduit.
- iPhone Safari réel et Android Chrome intermédiaire si disponibles. WebKit émulé ne remplace pas un iPhone réel ; déclarer explicitement les appareils non testés.
- Réseau lent, panne, arrière-plan/reprise, GPS refusé, vingt changements de zone et plusieurs ouvertures/fermetures de drawer.
- Vérifier une seule carte, mémoire qui se stabilise, budget de payload, absence de requêtes pendant les gestes et attribution toujours accessible/visible selon la politique applicable.
- Vérification desktop minimale : aucune requête OSM nouvelle et comportement existant préservé. Compas : aucun fichier modifié ni comportement partagé changé.

### Preuves à rendre

- SHA de base et de livraison, liste des fichiers modifiés, rôle de chacun.
- Capture/vidéo mobile des scénarios principaux.
- Tableau des mesures : appareil, navigateur, build production, réseau, cache froid/chaud, octets, latence UI et réseau, frames, mémoire observable et limites de mesure.
- Tests exécutés et résultats ; distinguer défaut préexistant, régression, fonctionnalité non testée.
- Limites de couverture, données partielles et conditions fournisseur.
- Instructions d’activation du flag, retour arrière et nettoyage du cache du module.
- Aucun « prêt pour des milliers d’utilisateurs » déduit d’un seul test local.

## 13. Séquence de travail

1. **Reconnaissance courte** : état git, instructions, version résolue, moteur mobile réellement actif, contrats partagés, fournisseur de tuiles, cache/limiteur existants. Écrire les décisions utiles seulement.
2. **Adaptateur indépendant** : validation, requêtes bornées, normalisation et fixtures ; pas de BDD.
3. **Premier parcours complet mobile** : petite zone → liste OSM → drawer → tracé réel ; aucun branchement Compas.
4. **POI** : catégories à la demande, potabilité et accès explicites, sources distinctes.
5. **Performance et résilience** : annulation, cache borné, clustering, limites, états d’erreur, mesures réelles.
6. **Vérification et PR** : tests ciblés, diff de périmètre, preuves mobiles, limites et rollback. Arrêter les vérifications supplémentaires dès que les risques identifiés sont résolus.

La mission est terminée quand Explorer mobile permet de consulter réellement des itinéraires/POI OSM d’une petite zone internationale, sans import massif, sans bloquer les gestes et sans toucher au préparateur. Si le seul blocage final est une interface de carte partagée, livrer tout le module prêt et le raccordement proposé séparément : ne pas franchir la frontière imposée par Tony.

## 14. Documentation vérifiée et ordre de lecture

Sources officielles ou dépôts des projets consultés le 3 octobre 2026. Les politiques peuvent évoluer : relire avant activation. Les recommandations de structure, budgets et UX de ce document sont des choix proposés pour LKDV, pas des exigences de ces sources.

| Réf. | Source | À utiliser pour |
|---|---|---|
| S1 | https://dev.overpass-api.de/overpass-doc/en/preface/commons.html | Limites, charge, 429/504 et backend grand public |
| S2 | https://www.openstreetmap.org/copyright | Licence des données et attribution |
| S3 | https://operations.osmfoundation.org/policies/tiles/ | Conditions tuiles raster OSMF, cache et interdiction de préchargement offline |
| S4 | https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL | Syntaxe, sorties, timeout et maxsize |
| S5 | https://wiki.openstreetmap.org/wiki/Relation:route | Membres, rôles et structure des itinéraires |
| S6 | https://wiki.openstreetmap.org/wiki/Tag:route=hiking | Sémantique d’une randonnée balisée |
| S7 | https://operations.osmfoundation.org/policies/nominatim/ | Restrictions du géocodage public |
| S8 | https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html | Fenêtres, géométries coupées et relations longues |
| S9 | https://github.com/tyrasd/osmtogeojson | Conversion, options et géométries incomplètes |
| S10 | https://wiki.openstreetmap.org/wiki/Key:sac_scale | Difficulté technique et limites d’interprétation |
| S11 | https://wiki.openstreetmap.org/wiki/Key:drinking_water | Potabilité et états inconnus/conditionnels |
| S12 | https://wiki.openstreetmap.org/wiki/Key:access | Accès et restrictions |
| S13 | https://maplibre.org/maplibre-gl-js/docs/guides/large-data/ | Réduction de données, clustering, styles et zoom |
| S14 | https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation | Annulation effective des fetchs |
| S15 | https://web.dev/articles/inp | Mesure de réactivité ; seuil de 200 ms |
| S16 | https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria | Quotas navigateur et éviction |
| S17 | https://www.rfc-editor.org/rfc/rfc7946 | GeoJSON et ordre des coordonnées |
| S18 | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html | Allowlist, redirections et SSRF |
| S19 | https://github.com/waymarkedtrails/waymarkedtrails-api | Référence de projet, pas engagement de service |
| S20 | https://support.komoot.com/hc/en-us/articles/10194701438234-Get-started-with-komoot | OSM et calcul d’itinéraires Komoot |
| S21 | https://support.alltrails.com/hc/en-us/articles/360019244351-How-to-contribute-a-new-trail-to-AllTrails | Origine communautaire des ajouts AllTrails |
| S22 | https://support.visorando.com/contribuer/publier-un-circuit-sur-visorando | Auteurs, traces et modération Visorando |
| S23 | https://operations.osmfoundation.org/policies/vector/ | Politique séparée des tuiles vectorielles OSMF |
| S24 | https://wiki.openstreetmap.org/wiki/Tag:tourism=camp_site | Camping cartographié et attributs |
| S25 | https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/ | Mise à jour des sources et identifiants stables |
| S26 | https://dev.overpass-api.de/overpass-doc/en/targets/formats.html | Formats de sortie et `out tags center` |

Ordre conseillé : S1/S2/S3 → fichiers réels du dépôt → S4/S5/S8 → S10/S11/S12 → S13/S14/S18. Ne pas confondre les exemples issus de la dernière documentation avec les API de la version installée.

### Liens du dépôt à relire avant de coder

- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/app/explorer/page.tsx
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/components/explorer/ExplorerClient.tsx
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/components/map/UnifiedExplorerMap.tsx
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/components/explorer/types.ts
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/lib/overpass.ts
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/scripts/coverage/pipeline.ts
- https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/package.json

## 15. Message de lancement à copier avec ce dossier

> Lis intégralement ce dossier puis vérifie l’état réel du dépôt. Implémente le premier lot de consultation OSM exclusivement dans `/explorer` mobile, sur un worktree et une branche isolés. Priorités : données réelles à la demande, fluidité mesurée, requêtes/cache strictement bornés, sécurité et états de qualité honnêtes. Aucun import mondial, aucune migration, aucun changement au Compas ou au travail d’Opus, aucun changement desktop fonctionnel. Réutilise les dépendances et composants existants quand leurs contrats le permettent, sans modifier les composants partagés protégés. Si le raccordement exige une modification partagée, livre le module et propose ce patch séparément. Procède par petits lots vérifiables, sans audit global ni boucle de tests interminable. Termine par une PR, des preuves mobiles et les limites réelles du service gratuit ; ne déploie pas automatiquement.
