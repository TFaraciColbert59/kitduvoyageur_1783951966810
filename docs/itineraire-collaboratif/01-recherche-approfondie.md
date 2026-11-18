# LKDV — Créateur d’itinéraires collaboratif « 20/10 » : cahier des charges produit et technique

## Cadre, état constaté et décision structurante

Le bon objectif pour LKDV n’est pas de fabriquer « un Komoot de plus avec collaboration ». Le créateur doit devenir **le moteur de préparation partagé de LKDV** : une route n’est pas seulement une ligne sur une carte, mais un objet vivant qui relie **terrain → étapes → contraintes → météo → eau/refuges → groupe → matériel → kit → version de départ → activité réelle → carnet**.

Cette orientation est cohérente avec le socle technique disponible dans les sources LKDV accessibles. Le dossier technique maître décrit un projet Next.js 15 / React 19 / TypeScript avec Supabase/PostgreSQL, PostGIS, Zustand, TanStack Query, Dexie, MapLibre, Vitest et Playwright ; il insiste aussi sur une stratégie locale-first progressive plutôt que sur une réécriture de l’application. Il précise toutefois que certaines vérifications Supabase de production n’avaient pas pu être finalisées lors de cet audit : les propositions de schéma ci-dessous ne doivent donc **pas être présentées comme des tables déjà déployées**.

Une autre source LKDV décrit déjà `src/features/adventure-prep/routeRevision.ts`, avec des `RouteRevision`, `RouteSection` et des sections `routed/manual`, ainsi qu’un `routingService.ts`, des invitations et des contrats GPX à examiner avant toute implémentation. Elle recommande également un journal d’opérations, des révisions immuables et une version publiée distincte du brouillon. Là encore, il s’agit d’un **constat documentaire du dépôt audité**, pas d’une preuve que la totalité de ce modèle est actuellement fonctionnelle en production.

Je séparerais donc systématiquement quatre niveaux de vérité dans les tickets et dans l’interface d’administration :

| Niveau | Signification dans ce rapport | Exemple |
|---|---|---|
| **Constaté code / documentation LKDV** | Présent dans les sources accessibles | `routeRevision.ts`, sections `routed/manual`, stack Next/Supabase |
| **Constaté production** | Mesuré directement sur la base ou une app déployée pendant un audit récent | À ne pas extrapoler ici faute d’un nouvel accès Supabase direct |
| **Hypothèse à valider** | Semble probable mais doit être confirmé par le dépôt ou la DB | Structure exacte de `trip_collaborators`, relations avec clubs |
| **Proposition** | Nouvelle architecture ou fonction recommandée | journal `route_operations`, snapshots publiés, approbations |

### Le choix architectural principal

Je **ne mettrais pas un CRDT intégral au cœur de la géométrie d’itinéraire**.

Les CRDT comme Yjs ou Automerge excellent pour fusionner automatiquement des changements concurrents et fonctionner local-first ; Yjs peut persister localement ses mises à jour via IndexedDB, et Automerge est explicitement conçu pour fusionner des modifications concurrentes et supporter des workflows local-first. Mais une route est différente d’un document texte. Déplacer deux nœuds concurrents peut produire une géométrie « fusionnable » techniquement tout en étant **absurde fonctionnellement** : détour involontaire, rupture de journée, route par une voie incompatible, changement du point de ravitaillement, recalcul obsolète ou invalidation de toutes les estimations aval.

**Architecture recommandée :**

`event log métier + optimistic concurrency + versions d’entités + snapshots immuables + Realtime pour présence/notifications + CRDT optionnel uniquement pour notes riches`.

C’est moins « magique » qu’un CRDT intégral, mais beaucoup plus explicable et vérifiable. PostgreSQL fournit les mécanismes nécessaires pour protéger les mises à jour concurrentes et gérer des verrous courts ; sa documentation rappelle aussi qu’une transaction peut devoir être rejouée après conflit de sérialisation. La règle produit devient alors :

> **On fusionne automatiquement ce qui est clairement indépendant. On demande une décision humaine dès que deux intentions concurrentes peuvent changer le sens de la sortie.**

C’est cette règle, beaucoup plus que les curseurs colorés, qui peut faire de LKDV un excellent outil collaboratif.

## Benchmark approfondi : ce qu’il faut reprendre, dépasser ou éviter

### Matrice des références

| Produit | Ce qu’il fait particulièrement bien | Collaboration pertinente | Limite observée pour LKDV | Ce que LKDV doit reprendre |
|---|---|---|---|---|
| **Komoot** | Routage, waypoints, sections hors réseau, multi-jours, navigation | Les participants d’une sortie de groupe reçoivent les mises à jour de route ; le propriétaire reste l’éditeur | Les participants ne coéditent pas la route ; le planificateur multi-jours n’est pas directement compatible avec les group routes | Diffusion simple d’une version et séparation nette organisateur/participant |
| **Outdooractive** | Cartes topo, 3D, routage, types de chemins, GPX/offline | Sorties partagées/invitations | La collaboration éditoriale temps réel n’est pas établie par les sources consultées | Qualité de carte, topographie, contexte de terrain |
| **AllTrails Peak** | Multi-jours, frontières de jours, route originale visible, waypoints eau/camp/bail-out | Pas de véritable coédition établie dans la documentation consultée | Très bon planificateur, mais pas un modèle complet de gouvernance collaborative | Découpage intelligent de journées et comparaison à l’original |
| **Ride with GPS** | Édition de routes, POI/cues, partage | Rôles Viewer/Editor, historique de versions, notes de sauvegarde | Le modèle reste essentiellement édition + historique, pas propagation jusqu’au kit | Version history et rôle d’éditeur |
| **Strava** | Routage sportif, heatmap, surfaces et préférences | Partage de route, mais pas coédition avancée documentée ici | Collaboration faible pour la préparation d’expédition | Signal de popularité et préférences sportives |
| **Wikiloc** | Routage nourri par routes communautaires, provenance des segments | Collaboration éditoriale non établie dans la source consultée | Pas de workflow complet de préparation d’équipe | Expliquer pourquoi un segment est proposé |
| **Visorando** | IGN/OSM, tracé automatique ou manuel, GPX, split/fusion/inversion | Publication communautaire modérée, pas coédition temps réel établie | Édition collaborative limitée | Robustesse du mode manuel, outils de manipulation |
| **Google My Maps** | Carte partagée simple, calques, annotations | Collaborateurs peuvent éditer la même carte | Pas de routage outdoor ni modèle de sortie/version terrain | Simplicité mentale « une carte partagée » |
| **Google Docs** | Suggestion, commentaires, historique, rôles | Référence de collaboration documentaire | Modèle texte, pas topologique | Suggestions et acceptation/rejet |
| **Figma** | Présence, historique, branches, merge/review | Collaboration temps réel très mature | Branches complexes pour usage grand public | Présence légère, branche isolée, review ciblée |

Komoot documente explicitement que les participants d’une group route voient les mises à jour mais ne peuvent pas modifier la route ; son planificateur multi-jours est par ailleurs séparé de cette fonctionnalité de groupe. Komoot documente également des waypoints personnalisés et des sections « off-grid » utiles pour les environnements mal cartographiés. AllTrails Peak permet aujourd’hui de construire ou modifier une route, la séparer en journées, déplacer les limites de jours, garder l’original visible, utiliser des waypoints tels que camps, eau et issues de repli, et exploiter la pente et certains calques terrain. Ride with GPS est la référence la plus intéressante pour le **workflow d’édition partagé** : le propriétaire peut inviter Viewer ou Editor, les éditeurs peuvent modifier la route, et les sauvegardes alimentent un historique de versions avec des notes. Strava permet de choisir activité, popularité ou trajet direct, minimisation/maximisation du dénivelé et préférence surface ; il propose aussi undo/redo et s’appuie sur OpenStreetMap pour les données de carte/routage. Wikiloc est intéressant pour une autre raison : son planificateur peut expliquer qu’un segment proposé s’appuie sur des itinéraires publics de membres et affiche les contributeurs associés au segment. Visorando possède les opérations qu’un éditeur sérieux doit considérer comme basiques : routage automatique, dessin manuel, undo/redo, split, fusion, inversion, GPX et cartes IGN/OSM. Google My Maps montre qu’un modèle de collaboration cartographique peut rester mentalement très simple : carte, couches, partage, collaborateurs, KML/KMZ. Figma apporte les notions de checkpoint, version nommée, restauration, branche indépendante et revue avant merge. Google Docs apporte le modèle « je propose sans modifier directement l’original », particulièrement pertinent pour un contributeur qui n’a pas le droit de changer le plan publié. ### La vraie opportunité LKDV

Aucun de ces produits, dans les fonctions officielles examinées, ne démontre le flux complet suivant comme objet produit central :

**modification du tracé → conséquences sur les journées → conséquences météo/eau/nuit → conséquences sur le kit → personnes concernées → approbations → pack hors ligne → version réellement suivie → retour carnet.**

C’est là que doit être le « 20/10 ». Pas dans un énième moteur qui trouve un chemin entre A et B.

## Produit cible : l’espace de préparation partagé

### Modèle mental

Un itinéraire LKDV comporte cinq niveaux visibles :

| Niveau | Objet utilisateur | Question |
|---|---|---|
| **Plan** | Le voyage ou la sortie | « Que faisons-nous ? » |
| **Route** | La géométrie générale | « Par où passons-nous ? » |
| **Étapes** | Journées / sections / nuits | « Comment se déroule la sortie ? » |
| **Préparation** | Eau, météo, abris, kit, responsables | « Qu’est-ce que cela implique ? » |
| **Départ** | Version figée et téléchargée | « Quelle version emporte-t-on réellement ? » |

Une modification ne doit jamais se résumer à « la polyline a changé ». LKDV doit afficher :

**+2,8 km · +210 m D+ · arrivée estimée +42 min · eau suivante 9,6 km au lieu de 4,1 km · météo concernée déplacée de 14h à 15h · deux objets du kit à revalider · Mina et Paul concernés.**

Ces valeurs ne doivent apparaître que si leurs données sources permettent le calcul. Sinon : **« non déterminé »**, avec provenance et date.

### Personas et scénarios

**Solo préparateur.** Léa prépare un week-end. Elle importe un GPX, conserve sa trace, découpe en deux jours et demande une alternative uniquement au km 17. Elle peut utiliser toute la puissance du moteur sans voir les fonctions de collaboration tant qu’elle n’invite personne.

**Organisateur de club.** Marc prépare une sortie pour douze membres. Il autorise Clara à modifier J1, Hugo à travailler sur J2 et laisse les autres commenter. Une personne inscrite au club n’acquiert pas automatiquement le droit d’éditer la route.

**Groupe d’amis.** Quatre personnes préparent trois jours. Une proposition de détour est discutée, comparée puis acceptée. La nouvelle version impacte la nuit et le matériel commun ; le responsable tente est averti.

**Participant terrain.** Sarah n’a aucun rôle d’édition. Elle a téléchargé la version 7. La version 8 est publiée le matin du départ. LKDV affiche clairement **« version téléchargée 7 / départ recommandé 8 »**, le diff et la possibilité de mettre à jour.

**Contributeur expert.** Un membre connaît un point de passage problématique. Il n’édite pas directement le plan ; il crée une proposition ancrée au segment avec une justification et éventuellement une variante.

### UX mobile

L’écran principal doit être une **carte plein écran + bottom sheet à trois hauteurs**.

En haut : nom de sortie, statut `Brouillon / À revoir / Publiée`, avatar des personnes présentes, indicateur hors ligne et menu version.

En bas : onglets contextuels **Tracer · Étapes · Analyser · Équipe · Départ**. Pas cinq modules différents : un seul workspace, cinq vues du même objet.

Lorsqu’un utilisateur déplace un point, LKDV affiche immédiatement une **prévisualisation locale**, puis un statut « recalcul en cours ». La nouvelle route ne remplace la section précédente qu’après réponse valide du moteur et vérification que les entrées n’ont pas changé entre-temps.

Un appui long sur un segment ouvre :

`Modifier ici · Créer variante · Passer en manuel · Ajouter repère · Commenter · Affecter à une étape · Voir provenance`.

Un mode **Liste sans carte** est obligatoire. Il doit permettre de déplacer/supprimer des points, consulter les étapes, commentaires, alternatives et checklists même si WebGL ou le fond cartographique échoue. Cette exigence est importante pour une application terrain et cohérente avec l’orientation local-first déjà documentée dans LKDV.

### UX desktop

Desktop n’est pas une simple version élargie du mobile.

Structure :

`gauche 320 px = arbre de route / centre = carte / droite 380 px = inspecteur`.

L’arbre contient :

`Route > J1 > sections > repères > J2 > sections > ...`

Chaque entité possède un identifiant stable. L’inspecteur change selon l’objet sélectionné : waypoint, section, journée, nuit, commentaire, variante.

Le profil altimétrique reste synchronisé avec la carte : hover profil → position carte ; hover segment → intervalle profil.

### Les vingt fonctions réellement différenciantes

| # | Fonction | Pourquoi elle compte |
|---:|---|---|
| 1 | **Impact Graph** | Toute modification indique ses conséquences aval |
| 2 | **Version de départ figée** | Le groupe sait exactement quelle route il emporte |
| 3 | **Kit lié à la révision** | Le kit n’est plus dissocié du parcours |
| 4 | **Responsables par objet** | Eau, tente, étape, transport peuvent avoir un responsable |
| 5 | **Propositions plutôt qu’édition forcée** | Contribution sans perte de contrôle |
| 6 | **Comparateur de variantes par segment** | Comparer localement sans dupliquer toute la sortie |
| 7 | **Commentaires ancrés sur géométrie versionnée** | Les discussions restent liées au bon passage |
| 8 | **Détection d’ancre orpheline** | Un commentaire n’est pas silencieusement déplacé après reroutage |
| 9 | **Fusion automatique uniquement des changements indépendants** | Collaboration fiable plutôt que merge aveugle |
| 10 | **Conflit expliqué en termes métier** | « Deux personnes ont modifié le refuge de J2 », pas erreur 409 brute |
| 11 | **Recalcul asynchrone avec empreinte d’entrée** | Une réponse routage périmée ne peut écraser le nouveau plan |
| 12 | **Mode “garder ma trace”** | GPX importé préservé sans snap obligatoire |
| 13 | **Confiance par donnée** | Source, date et incertitude visibles |
| 14 | **Préparation eau/nuit/météo horodatée** | Les données sont liées au moment où le groupe y passe |
| 15 | **Pack hors ligne vérifié** | “Téléchargé” signifie réellement utilisable |
| 16 | **État de préparation par participant** | Le responsable voit qui possède quelle version |
| 17 | **Diff de sortie compréhensible** | Changements de distance, horaires, étapes, matériel |
| 18 | **Planifié vs réellement suivi** | Le carnet apprend de la sortie |
| 19 | **Duplicateur de sortie avec provenance** | Réutilisation sans altérer l’historique |
| 20 | **Mode dégradé sans carte** | Fonctionnement critique conservé lorsque la couche carto tombe |

Le critère de réussite n’est donc pas « vingt fonctionnalités présentes ». C’est : **à chaque moment critique, l’utilisateur sait quelle version est vraie, d’où vient l’information, qui peut agir et ce qui sera affecté.**

## Moteur d’itinéraire : géométrie, topologie et intelligence de décision

### Modèle topologique

Une route ne doit pas être stockée comme une énorme polyline éditable indistinctement.

Je recommande :

```text
RouteWorkspace
  └─ Route
      ├─ RoutePoint[]
      ├─ RouteSection[]
      ├─ Stage[]
      ├─ Waypoint[]
      ├─ Variant[]
      └─ Dependency[]
```

`RoutePoint` = intention utilisateur : départ, arrivée, via, stop, frontière de journée.

`RouteSection` = lien entre deux points.

```ts
type RouteSectionMode =
  | 'routed'
  | 'manual'
  | 'imported_preserved';
```

`routed` reçoit une géométrie calculée par un fournisseur ; `manual` conserve exactement le dessin utilisateur ; `imported_preserved` permet de conserver une portion GPX sans la réinterpréter.

La distinction déjà documentée dans LKDV entre sections routées et manuelles doit donc être **étendue**, pas remplacée.

### Identité stable

Ne jamais utiliser l’index d’un point comme identité.

```ts
type RoutePoint = {
  id: string;
  routeId: string;
  kind: 'start' | 'via' | 'stop' | 'stage_boundary' | 'finish';
  lat: number;
  lon: number;
  entityVersion: number;
  orderKey: string;
};
```

`orderKey` devrait permettre l’insertion entre deux points sans renuméroter toute la liste. Un ordre fractionnaire ou un identifiant positionnel déterministe suffit tant que les rebalance sont gérés côté serveur.

### PostGIS

PostGIS est adapté au stockage et à l’interrogation géospatiale, avec des types indexables dédiés aux géométries. Pour les annotations ancrées sur une route, `ST_LineLocatePoint` permet de transformer une position en fraction le long de la ligne ; cette représentation est utile pour repositionner approximativement un commentaire après un petit changement de géométrie. Mais il ne faut pas « relocaliser » silencieusement une annotation après un gros reroutage. L’ancre devrait contenir :

```ts
type GeometryAnchor = {
  sectionId: string;
  sectionVersion: number;
  fraction: number;        // 0..1 sur la géométrie d'origine
  originalLat: number;
  originalLon: number;
  maxRelocateMeters: number;
};
```

Si le nouveau segment passe à plus de `maxRelocateMeters`, l’annotation devient `needs_relocation`.

### Routage

Le moteur LKDV doit être un **orchestrateur**, pas un fournisseur unique.

```ts
interface RoutingProvider {
  route(input: RouteRequest): Promise<RouteResult>;
  capabilities(): RoutingCapabilities;
}
```

Chaque résultat porte :

```ts
type RouteResult = {
  geometry: GeoJSON.LineString;
  distanceM: number;
  ascentM?: number;
  descentM?: number;
  estimatedDurationS?: number;
  surfaceSegments?: SurfaceSegment[];
  provenance: {
    provider: string;
    providerVersion?: string;
    calculatedAt: string;
    profile: string;
  };
  warnings: RouteWarning[];
};
```

Cela protège LKDV contre un changement de fournisseur et permet de comparer les résultats.

### Recalcul

Le recalcul doit être **sectionnel**.

Déplacer un point entre B et C ne doit pas recalculer arbitrairement A→Z. On invalide les sections entrantes/sortantes dépendantes puis les agrégats :

```text
point C déplacé
→ section B-C stale
→ section C-D stale
→ journée J2 stale
→ métriques J2 stale
→ horaire repères J2 stale
→ météo J2 stale
→ besoins eau J2 stale
→ kit dépendant éventuellement stale
```

C’est l’**Impact Graph**.

### Empreinte d’un calcul

```ts
const fingerprint = hash({
  from,
  to,
  vias,
  activityProfile,
  routingOptions,
  avoidances,
  provider,
});
```

Quand la réponse arrive :

```text
si fingerprint !== currentSection.pendingFingerprint
→ ignorer le résultat
```

Ce détail élimine une classe entière de bugs où une réponse réseau lente écrase une édition plus récente.

### Altimétrie

L’altitude doit être attachée à une **source**, jamais considérée comme intrinsèquement vraie.

```ts
type ElevationProfile = {
  samples: Array<{ distanceM: number; elevationM: number | null }>;
  source: string;
  computedAt: string;
  resolutionM?: number;
  missingRatio: number;
};
```

Les métriques dérivées doivent conserver la version du profil ayant servi au calcul.

### Surface et difficulté

Ne jamais afficher :

`Sentier 82 %`

si l’origine des données ne le permet pas clairement.

Afficher plutôt :

`Surface connue : 74 % · inconnue : 26 %`

et permettre d’ouvrir la provenance.

Strava expose déjà des préférences pavé/terre et activité, ce qui confirme que ces paramètres sont utiles dans un planificateur, mais LKDV doit aller plus loin dans l’explication de la qualité des données. ### Alternatives

Trois niveaux :

| Alternative | Portée | Usage |
|---|---|---|
| **Micro-variante** | Un segment | Éviter une route ou passer par un refuge |
| **Variante journée** | Une étape | Comparer deux J2 |
| **Variante complète** | Toute la sortie | Plan A / plan B |

Une variante est une **branche logique**, pas nécessairement une branche technique permanente au sens Figma.

```ts
type RouteVariant = {
  id: string;
  baseRevisionId: string;
  scope: 'section' | 'stage' | 'route';
  replacements: VariantReplacement[];
  status: 'draft' | 'proposed' | 'accepted' | 'rejected';
};
```

L’interface compare :

`distance / D+ / D- / durée / surfaces / eau / refuges / heure d’arrivée / données inconnues / changements kit`.

### Multi-étapes

Le découpage automatique ne doit pas prétendre « décider le bon camp ».

Il peut **proposer** des frontières en fonction de :

`durée cible + D+ cible + nuits connues + points d’eau + accès + contraintes du groupe`.

AllTrails montre déjà l’utilité d’un découpage en jours tenant compte de distance, dénivelé et points d’intérêt. LKDV doit ensuite expliquer :

> « Coupure proposée ici : 6 h 10 estimées depuis le départ, refuge à 450 m de la trace, prochain point de nuit renseigné 12,8 km plus loin. »

### Eau

Trois concepts séparés :

`water_point` = point cartographié.

`water_claim` = information affirmant disponibilité/potabilité.

`water_observation` = observation datée.

```ts
type WaterObservation = {
  pointId: string;
  observedAt: string;
  status: 'flowing' | 'dry' | 'unknown';
  potableClaim?: 'yes' | 'no' | 'unknown';
  source: 'user' | 'official' | 'external';
};
```

LKDV ne doit jamais convertir « fontaine sur la carte » en « eau potable garantie ».

### Refuges et services

Chaque lieu reçoit :

`provenance`, `lastVerifiedAt`, `openingInfo`, `bookingInfo`, `confidence`.

Une information non datée ne doit pas produire un faux sentiment de sécurité.

### Météo horodatée

La météo n’est pas « la météo du trajet ».

C’est :

`prévision au lieu X pour la fenêtre T ± Δ`.

Déplacer la vitesse ou l’heure de départ modifie le créneau météo et rend donc les cartes météo précédentes potentiellement périmées.

```ts
type WeatherSlice = {
  pointId: string;
  forecastFor: string;
  fetchedAt: string;
  provider: string;
  temperatureC?: number;
  precipitationProbability?: number;
  windKph?: number;
  status: 'fresh' | 'stale' | 'unavailable';
};
```

### Dangers

Pas de score « sûr / dangereux ».

Créer un registre :

`route_hazards`

avec :

`type`, `geometry`, `severitySource`, `observedAt`, `expiresAt`, `confidence`, `source`.

Le danger est une donnée de décision, pas un certificat.

## Collaboration temps réel, branches, conflits et offline-first

### Permissions

Je recommande ces permissions atomiques :

```ts
type RoutePermission =
  | 'route.read'
  | 'route.edit_geometry'
  | 'route.edit_stages'
  | 'route.edit_waypoints'
  | 'route.comment'
  | 'route.propose'
  | 'route.review'
  | 'route.publish'
  | 'route.manage_members'
  | 'route.manage_privacy'
  | 'route.download_pack';
```

Les rôles ne sont que des presets.

| Rôle | Droits typiques |
|---|---|
| Responsable | tout + publication + membres |
| Coorganisateur | édition + revue + publication selon délégation |
| Éditeur | géométrie/étapes/repères |
| Contributeur | commentaires + propositions |
| Participant | lecture + pack |
| Lecteur externe | lecture version explicitement partagée |

**Une inscription club ou RSVP ne doit jamais impliquer `route.edit_geometry`.**

### Invitations

Réutiliser `trip_collaborators` si son modèle le permet après audit.

Ne pas créer `route_collaborators` automatiquement si `trip_collaborators` exprime déjà :

`trip_id / user_id / role / invite_status`.

Ajouter éventuellement une portée :

```text
scope = trip | route | stage
scope_id
```

ou une table d’overrides de permission.

### Présence

Supabase Presence convient pour :

`user_id`, `display_name`, `active_stage_id`, `selected_entity_id`, `mode`.

Jamais :

`position GPS permanente`, `texte du commentaire`, `géométrie complète`.

Supabase autorise Broadcast et Presence avec des politiques RLS dédiées. Sa documentation précise aussi que les autorisations Realtime sont mises en cache pendant la connexion et qu’un changement de droit n’est pas nécessairement instantanément appliqué tant qu’un nouveau JWT n’a pas été envoyé ou que la connexion n’a pas expiré. Conséquence : **on ne fait jamais confiance au canal Realtime pour autoriser une mutation**. Toute écriture est revalidée côté transaction.

### Curseurs

Sur desktop : curseur des collaborateurs uniquement sur la zone carte et seulement s’ils ont activé « montrer mon pointeur ».

Sur mobile : pas de curseur. Afficher plutôt :

`Mina modifie J2`

et une bordure légère autour de l’étape.

### Verrouillage léger

Pas de « fichier verrouillé ».

Quand quelqu’un commence à déplacer un waypoint :

```text
softLock {
  entityId
  userId
  expiresAt: now + 15s
}
```

Le second utilisateur peut toujours forcer une modification mais voit :

`Éloi est en train de modifier ce point`.

Le soft lock est UX, pas sécurité.

### Journal d’opérations

```ts
type RouteOperation =
  | MovePointOp
  | InsertPointOp
  | DeletePointOp
  | ChangeSectionModeOp
  | UpdateStageBoundaryOp
  | UpdateWaypointOp
  | AcceptProposalOp
  | RevertOperationOp;
```

Base commune :

```ts
type RouteOperationBase = {
  opId: string;            // idempotence client
  routeId: string;
  baseSeq: number;
  actorId: string;         // déterminé serveur
  createdAtClient: string;
  entityVersions: Record<string, number>;
};
```

### Politique de fusion

| A | B concurrent | Traitement |
|---|---|---|
| commentaire J1 | déplacer waypoint J2 | merge auto |
| déplacer waypoint J1 | modifier note J3 | merge auto |
| modifier nuit J1 | déplacer waypoint J3 | merge auto si pas de dépendance |
| déplacer point P | déplacer même P | conflit |
| supprimer P | modifier P | conflit |
| recalcul section B-C | déplacement B | résultat de calcul rejeté |
| déplacer frontière J1/J2 | modifier même frontière | conflit |
| ajouter deux repères différents entre B/C | merge + ordre stable |
| modifier même attribut d’un refuge | proposition de résolution |

### Conflit métier

L’écran ne montre pas un diff JSON.

> **Vous et Mina avez déplacé “Refuge des Aigles”.**  
> Votre position ajoute 1,4 km à J2.  
> Celle de Mina ajoute 0,6 km et conserve le point d’eau actuel.  
>  
> `Voir ensemble` `Garder votre version` `Garder Mina` `Créer une variante`

### Undo/redo

**Undo n’efface jamais l’historique.**

Il génère une nouvelle opération inverse.

```text
op 431 move_point
op 437 revert(op431)
```

Ainsi un autre utilisateur qui a déjà construit sur l’opération 431 ne reçoit pas une réécriture silencieuse du passé.

### Suggestions

Inspiré du modèle Google Docs, le contributeur crée une proposition sans modifier directement le brouillon principal. Google Docs sépare effectivement suggestion et modification du document original. ```ts
type Proposal = {
  id: string;
  baseRevisionId: string;
  createdBy: string;
  scopeEntityIds: string[];
  operations: ProposedOperation[];
  rationale: string;
  status: 'open' | 'accepted' | 'rejected' | 'superseded';
};
```

### Branches

Ne proposer une branche visible à l’utilisateur que dans trois cas :

`grosse alternative`, `expédition complexe`, `préparation parallèle`.

Pour 90 % des usages, les variantes et propositions suffisent.

Figma montre l’intérêt des branches pour explorer sans toucher au principal, mais aussi leur coût mental et la nécessité d’une étape de merge/review. ### Offline-first

Le client conserve :

```text
lastSnapshot
lastAppliedSeq
pendingOperations[]
downloadedDeparturePack
mapResources
```

Flux de reconnexion :

```text
1. auth valide ?
2. permission route.read encore valide ?
3. GET changes after lastAppliedSeq
4. appliquer opérations serveur
5. rejouer pendingOperations dans ordre causal
6. chaque op reçoit accepted | merged | conflict | forbidden
7. résoudre conflits
8. reconstruire projection locale
```

Cas critique : Alice travaille hors ligne, mais son accès a été retiré.

Au retour :

`lecture éventuellement interdite selon politique + mutations refusées`.

Ne jamais restaurer ses opérations sur le document partagé simplement parce qu’elles existaient localement.

### Pourquoi pas Yjs partout

Yjs et Automerge savent fusionner des données concurrentes et gérer le hors-ligne. Je les utiliserais éventuellement pour :

`note collaborative d’étape`, `description`, `checklist textuelle riche`.

Je ne les utiliserais pas comme arbitre unique de :

`topologie route`, `publication`, `permissions`, `kit`, `approbations`, `frontières de journée`.

Ces objets ont besoin de validation métier et de causalité explicite.

## Architecture LKDV exploitable : Next.js, Supabase, PostGIS et sécurité

### Architecture logique

```text
                   ┌────────────────────────────┐
                   │       LKDV CLIENT          │
                   │ Next.js / React / MapLibre │
                   ├────────────────────────────┤
                   │ Projection locale          │
                   │ IndexedDB / Dexie          │
                   │ Pending operation queue    │
                   └────────────┬───────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             │                                     │
      Realtime Presence                      Commands / Reads
       + notifications                             │
             │                                     ▼
             │                         ┌────────────────────────┐
             └────────────────────────▶│ Next.js Route Handlers │
                                       │ validation Zod         │
                                       │ auth + rate limits     │
                                       └───────────┬────────────┘
                                                   │
                                                   ▼
                              ┌─────────────────────────────────┐
                              │ PostgreSQL / Supabase           │
                              │ route heads                     │
                              │ route entities                  │
                              │ operations                      │
                              │ snapshots/revisions             │
                              │ proposals/comments              │
                              │ RLS                             │
                              └──────────┬───────────┬──────────┘
                                         │           │
                                    PostGIS      Queue/jobs
                                         │           │
                                         ▼           ▼
                                  spatial ops    routing/weather
                                                pack generation
```

Next.js App Router fournit les Route Handlers sous `app/.../route.ts`; ils conviennent à une API BFF contrôlée. ### Voie d’écriture unique

Pour les mutations structurelles :

`Client → POST command → Zod → session → transaction SQL/RPC → opération → projection → commit → Broadcast notification`.

Éviter que le client fasse :

`supabase.from('route_points').update(...)`

directement pour une opération métier importante.

Cela simplifie l’idempotence, le contrôle des versions et l’audit.

### Schéma SQL cible

**Noms proposés : ils ne doivent pas être créés avant audit de collisions.**

```sql
create table route_workspaces (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  created_by uuid not null,
  title text not null,
  status text not null
    check (status in ('draft','review','published','archived')),
  head_seq bigint not null default 0,
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table route_points (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  kind text not null,
  order_key text not null,
  geom geography(point,4326) not null,
  entity_version bigint not null default 1,
  deleted_at timestamptz
);

create index route_points_workspace_idx
on route_points(workspace_id);

create index route_points_geom_gix
on route_points using gist(geom);

create table route_sections (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  from_point_id uuid not null references route_points(id),
  to_point_id uuid not null references route_points(id),
  mode text not null check (mode in ('routed','manual','imported_preserved')),
  geom geography(linestring,4326),
  routing_input_hash text,
  routing_provider text,
  routing_profile text,
  metrics jsonb not null default '{}',
  provenance jsonb not null default '{}',
  entity_version bigint not null default 1,
  deleted_at timestamptz
);

create index route_sections_geom_gix
on route_sections using gist(geom);

create table route_stages (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  order_key text not null,
  title text,
  starts_at timestamptz,
  start_point_id uuid references route_points(id),
  end_point_id uuid references route_points(id),
  overnight_place_id uuid,
  constraints jsonb not null default '{}',
  entity_version bigint not null default 1
);

create table route_operations (
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  seq bigint not null,
  op_id uuid not null,
  actor_id uuid not null,
  operation_type text not null,
  payload jsonb not null,
  entity_versions jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, seq),
  unique (workspace_id, op_id)
);

create table route_revisions (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  revision_no bigint not null,
  based_on_seq bigint not null,
  created_by uuid not null,
  kind text not null check (kind in ('checkpoint','candidate','published')),
  snapshot jsonb not null,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(workspace_id, revision_no)
);

create table route_proposals (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  base_revision_id uuid references route_revisions(id),
  created_by uuid not null,
  rationale text,
  proposed_ops jsonb not null,
  status text not null
    check(status in ('open','accepted','rejected','superseded')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table route_comments (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id) on delete cascade,
  created_by uuid not null,
  body text not null,
  anchor_type text not null,
  anchor_entity_id uuid,
  anchor_revision_id uuid references route_revisions(id),
  anchor_data jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table departure_packs (
  id uuid primary key,
  workspace_id uuid not null references route_workspaces(id),
  revision_id uuid not null references route_revisions(id),
  kit_snapshot_id uuid,
  manifest jsonb not null,
  checksum text not null,
  generated_at timestamptz not null default now()
);

create table participant_pack_state (
  pack_id uuid not null references departure_packs(id),
  user_id uuid not null,
  status text not null,
  verified_at timestamptz,
  primary key(pack_id,user_id)
);
```

### Transaction d’opération

Pseudo-SQL :

```sql
begin;

select head_seq
from route_workspaces
where id = :workspace_id
for update;

-- auth métier
-- idempotence workspace_id/op_id
-- validation versions des entités touchées
-- application mutation
-- incrément head_seq
-- insert route_operations

commit;
```

Le `FOR UPDATE` ne doit couvrir que la petite tête de route et la transaction doit rester courte. Les appels routage/météo ne doivent jamais se produire sous ce verrou. PostgreSQL documente précisément les mécanismes de verrouillage explicite ; les verrous applicatifs transactionnels peuvent aussi être utiles lorsqu’un verrou de ligne ne représente pas correctement la ressource logique. ### API

```text
GET  /api/routes/:id/workspace
GET  /api/routes/:id/changes?after=123
POST /api/routes/:id/operations
POST /api/routes/:id/proposals
POST /api/routes/:id/proposals/:proposalId/accept
POST /api/routes/:id/publish
POST /api/routes/:id/routing-jobs
POST /api/routes/:id/packs
GET  /api/routes/:id/revisions
GET  /api/routes/:id/revisions/:revisionId/diff
```

Exemple :

```ts
const ApplyRouteOperationSchema = z.object({
  opId: z.string().uuid(),
  baseSeq: z.number().int().nonnegative(),
  operation: z.discriminatedUnion('type', [
    MovePointSchema,
    InsertPointSchema,
    DeletePointSchema,
    UpdateStageBoundarySchema,
  ]),
});
```

Réponse :

```ts
type ApplyOperationResult =
  | {
      status: 'accepted';
      seq: number;
      changedEntities: EntityVersion[];
    }
  | {
      status: 'conflict';
      currentSeq: number;
      conflicts: DomainConflict[];
    }
  | {
      status: 'forbidden';
    };
```

### Événements Realtime

**Ne pas diffuser les énormes géométries en Presence.**

```ts
type RouteRealtimeEvent =
  | { type: 'route.seq.available'; seq: number }
  | { type: 'route.revision.published'; revisionId: string }
  | { type: 'proposal.updated'; proposalId: string }
  | { type: 'presence.editing'; entityId?: string }
  | { type: 'pack.available'; packId: string };
```

À réception de `route.seq.available`, le client relit les opérations depuis son dernier curseur.

Supabase recommande Broadcast plutôt que Postgres Changes pour les scénarios où scalabilité et sécurité comptent davantage. Les limites Realtime dépendent du plan et incluent connexions, messages, joins et tailles de payload ; il faut donc mesurer et ne pas diffuser des événements de mouvement de souris à haute fréquence. ### Jobs

Routage, profil d’altitude, calcul météo, pack hors ligne et analyses d’impact longues partent en queue.

Supabase propose une queue Postgres-native basée sur `pgmq`, conçue pour la livraison durable ; cela peut suffire à LKDV sans ajouter immédiatement Kafka ou Redis Streams. ### RLS

Toutes les tables exposées doivent avoir RLS activé et les politiques doivent utiliser l’identité authentifiée plutôt que des `user_id` reçus du client. Supabase recommande explicitement RLS sur les tables exposées et fournit `auth.uid()` pour les politiques. Concept :

```sql
create policy route_read
on route_workspaces
for select
to authenticated
using (
  exists (
    select 1
    from trip_collaborators tc
    where tc.trip_id = route_workspaces.trip_id
      and tc.user_id = (select auth.uid())
      and tc.status = 'accepted'
  )
);
```

Les droits d’édition doivent être testés dans les commandes métier même si la table est protégée par RLS.

### Confidentialité

Une trace GPS et une localisation live peuvent révéler domicile, habitudes, travail ou fréquentations. La CNIL rappelle que la localisation précise et continue est particulièrement sensible, recommande la minimisation, le traitement local lorsque possible et une collecte en arrière-plan limitée à ce qui est nécessaire. Donc :

`planification collaborative ≠ live tracking`.

Le créateur n’active jamais le suivi live implicitement.

Position exacte d’un participant :

`opt-in distinct + durée visible + destinataires visibles + stop immédiat`.

Point de départ domestique :

`masquage spatial possible avant partage public`.

### Cartes et droits

Ne jamais implémenter le pack offline en téléchargeant massivement `tile.openstreetmap.org`. La politique officielle des tuiles OSM interdit le bulk/prefetch et l’usage offline de ce service ; il faut un fournisseur autorisant explicitement l’offline ou une infrastructure de tuiles adaptée. Les contenus IGN ne sont pas tous juridiquement équivalents ; les CGU Ma Carte IGN indiquent notamment que certaines couches, comme Carte IGN, relèvent de conditions de licence spécifiques. Google Maps est également peu adapté comme stockage cartographique principal d’un système offline : les politiques Routes limitent fortement le cache, le stockage, le préchargement et la redistribution de contenus Google. Conclusion : **abstraction cartographique impérative** et registre de licences par couche.

### Performance

Objectifs réalistes, à valider par métriques :

| Interaction | Budget cible |
|---|---:|
| sélectionner un point | < 50 ms visuel |
| drag local | 60 fps sur appareil cible |
| mise à jour présence | < 300 ms p95 en ligne |
| commit simple | < 700 ms p95 |
| affichage changement distant | < 1,5 s p95 |
| ouverture depuis cache local | < 1 s |
| diff entre deux révisions | < 1 s pour route habituelle |
| pack déjà téléchargé hors ligne | disponible immédiatement |

Ces nombres sont des **SLO proposés**, pas des performances constatées.

### Accessibilité

La carte ne peut pas être l’unique interface. WCAG 2.2 prévoit notamment des exigences sur focus visible, contraste et interaction au clavier. Chaque action critique doit donc avoir un équivalent liste/clavier :

`ajouter point`, `déplacer dans ordre`, `supprimer`, `choisir variante`, `publier`, `résoudre conflit`.

## Intégration LKDV, validation et trajectoire de réalisation

### Continuité avec les modules existants

| Module LKDV | Responsabilité cible | Ce qu’il ne faut pas dupliquer |
|---|---|---|
| **Explorer** | Trouver ou prévisualiser une route source | Ne pas devenir un second éditeur complet |
| **Compas** | Workspace principal de création/préparation | C’est ici que vit le créateur |
| **Hub** | Résumé préparation, responsables, version de départ | Ne pas recalculer une route |
| **Inventaire** | Objets possédés | Pas de copie locale spécifique à une route |
| **Kit** | Sélection pour une sortie/révision | Snapshot lié à la version de départ |
| **Clubs** | Participants, événements, communication | RSVP ≠ permission d’édition |
| **Carnets** | Réel après sortie | Garder référence au plan et au kit du départ |
| **GPX** | Import/export interopérable | Ne pas perdre l’original lors d’un reroutage |

### Flux idéal de bout en bout

```text
Explorer
  ↓ "Préparer cette route"
Compas crée un workspace
  ↓
édition solo / collaborative
  ↓
route + étapes + contraintes
  ↓
Impact Graph
  ↓
Compas/Kit réévalue les éléments dépendants
  ↓
revue
  ↓
publication révision N
  ↓
pack de départ
  ↓
confirmation par participants
  ↓
activité GPS réelle
  ↓
Carnet
  ↓
planifié vs réalisé
  ↓
"Dupliquer et améliorer"
```

### Publication

Publier doit être une vraie opération métier.

Avant publication :

| Check | Bloquant ? |
|---|---|
| géométrie discontinue | Oui |
| section en calcul | Oui |
| conflit non résolu | Oui |
| GPX invalide | Oui |
| commentaire ouvert | Non |
| météo indisponible | Non, mais avertissement |
| eau inconnue | Non, mais avertissement explicite |
| kit non confirmé | Selon politique de sortie |
| responsable manquant | Selon objet |

Publication produit :

`RouteRevision immutable + DependencySnapshot + optional KitSnapshot + DepartureManifest`.

### Diff publié

Exemple :

```text
Version 12 → 13

J2
+ 3,4 km
+ 180 m D+
+ 38 min estimées

Nuit
Refuge du Lac → Refuge des Pins

Eau
intervalle maximal renseigné :
5,1 km → 10,8 km

Préparation
2 vérifications rouvertes
• eau J2
• protection pluie

Participants
7 doivent télécharger la nouvelle version
```

### Tests de concurrence

La recette ne peut pas se limiter à « deux navigateurs ouverts ».

| Test | A | B | Résultat attendu |
|---|---|---|---|
| C1 | déplace point J1 | modifie J3 | fusion automatique |
| C2 | déplace P | déplace P | conflit métier |
| C3 | supprime P | édite P | conflit |
| C4 | lance routage B-C | déplace B | résultat routage rejeté |
| C5 | publie seq 40 | écrit seq 41 juste avant | publication refusée/revue |
| C6 | offline modifie J2 | droit retiré | mutation refusée au retour |
| C7 | commentaire section v3 | section supprimée v4 | commentaire « à relocaliser » |
| C8 | A undo opération | B travaille dessus | nouvelle opération inverse, pas suppression historique |
| C9 | trois éditeurs jours différents | aucun conflit | toutes opérations conservées |
| C10 | perte WebSocket | écritures HTTP disponibles | collaboration continue, Realtime reprend |

### Tests offline

```text
ouvrir pack
→ couper réseau
→ tuer l'app
→ relancer
→ consulter route
→ consulter étapes
→ consulter kit
→ consulter repères essentiels
→ effectuer une note locale
→ reconnecter
→ vérifier resynchronisation
```

Le test important n’est pas « un service worker répond ». C’est **le voyageur peut réellement repartir de son téléphone sans réseau**.

### Tests RLS

Tester au minimum :

| Sujet | Attendu |
|---|---|
| étranger au trip | aucune lecture |
| participant | published oui, draft selon règle |
| contributeur | proposal/comment oui, move point non |
| éditeur | move point oui, publish non |
| responsable | publish oui |
| ancien éditeur révoqué | mutations refusées |
| lien expiré | lecture refusée |
| utilisateur A modifie ID de route dans requête | refus |

### Instrumentation

Événements produit proposés :

```text
route_workspace_opened
route_point_moved
route_routing_requested
route_routing_stale_discarded
route_conflict_detected
route_conflict_resolved
route_proposal_created
route_proposal_accepted
route_revision_published
route_pack_generated
route_pack_verified_local
route_pack_version_mismatch
route_offline_queue_replayed
route_dependency_invalidated
route_kit_revalidation_opened
```

Ne pas envoyer les coordonnées exactes dans la télémétrie générale.

### Métriques produit les plus intéressantes

| Mesure | Pourquoi |
|---|---|
| conflits / 100 opérations | qualité de l’architecture collaborative |
| % conflits résolus sans abandon | clarté UX |
| résultats routage obsolètes rejetés | vérifie la sécurité asynchrone |
| délai publication → participants à jour | vraie efficacité collective |
| taux de packs vérifiés avant départ | robustesse terrain |
| changements route provoquant revalidation kit | mesure continuité LKDV |
| divergences planifié/réel | base d’amélioration |
| fréquence du mode sans carte | robustesse / problèmes carto |
| erreurs offline replay | fiabilité locale-first |

### Roadmap recommandée

| Phase | Livrable | Complexité | Dépendances |
|---|---|---:|---|
| **Fondations** | audit réel `routeRevision`, `routingService`, GPX, `trip_collaborators`, RLS | M | aucune |
| **Éditeur canonique** | points stables, sections routed/manual/imported, undo/redo | L | audit |
| **Révisions** | journal opérations, seq, snapshots, publication | L | éditeur |
| **Collaboration** | rôles, invitations, Presence, commentaires | M/L | révisions |
| **Conflits** | version entités, résolution métier | L | collaboration |
| **Offline** | snapshots locaux, queue, replay | XL | opérations |
| **Impact Graph** | dépendances étapes/eau/météo/kit | XL | modèle stable |
| **Variantes** | comparaison section/jour/route | L | impact |
| **Départ** | pack signé/checksum/version | L | offline |
| **Carnet** | planifié vs réalisé | M/L | départ |
| **Polissage** | accessibilité, budgets perf, tests appareils | L | toutes |

### Ce que je ne construirais pas au début

Je n’ajouterais **ni serveur CRDT spécialisé, ni microservice géospatial autonome, ni moteur de branches type Git complet, ni Kafka, ni graphe Neo4j, ni réplication multi-région**.

Pour l’échelle locale réaliste de LKDV aujourd’hui, PostgreSQL + PostGIS + Supabase Realtime + queue durable + cache local est une architecture suffisamment puissante. L’actuelle documentation Supabase recommande Broadcast pour les changements temps réel plus exigeants et fournit des queues durables natives ; cela réduit fortement la justification d’une infrastructure supplémentaire avant mesure. ### Dépendances et coûts à surveiller

| Dépendance | Coût principal | Réduction du risque |
|---|---|---|
| fournisseur routage | appels + dépendance métier | abstraction provider + cache par fingerprint |
| cartes topo | licence / tuiles / offline | registre des droits par couche |
| météo | requêtes + fraîcheur | cache spatial/temporel avec date visible |
| Realtime | connexions/messages | payload minimal + présence throttled |
| Storage | packs/cartes | manifestes + quotas |
| Postgres | opérations/historique | snapshots + compaction contrôlée |
| GPX | interopérabilité | fixtures et tests lecteurs externes |
| position live | vie privée | opt-in séparé et durée courte |

### Risques majeurs et réponse

| Risque | Gravité | Solution |
|---|---:|---|
| fusion géométrique incorrecte | Critique | optimistic concurrency + conflit métier |
| réponse routage ancienne écrase nouvelle | Critique | fingerprint |
| plusieurs participants suivent des versions différentes | Critique | version de départ + état par participant |
| accès révoqué mais WebSocket encore actif | Élevée | mutation serveur revalidée systématiquement |
| pack offline incomplet | Élevée | checksum + manifeste + vérification locale |
| fausse confiance eau/météo | Élevée | provenance + date + inconnue explicite |
| mutation kit invisible après changement route | Élevée | Impact Graph |
| historique gigantesque | Moyenne | snapshot périodique + retention opérations |
| dépendance fournisseur carto | Élevée | abstraction + contrats de licence |
| WebGL indisponible | Moyenne/Élevée | mode liste complet |
| coédition trop complexe | Élevée | solo identique, fonctions multi uniquement quand nécessaires |
| branchement trop technique | Moyenne | variantes/propositions avant branches |
| vie privée GPS | Critique | séparer planification et suivi |
| RLS incohérente | Critique | matrice automatisée pgTAP/E2E |
| données GPX malveillantes/énormes | Élevée | validation taille/nombre points/parser borné |
| boucle notification | Moyenne | agrégation des impacts |
| carte offline illégalement téléchargée | Élevée | fournisseur explicitement autorisé |
| métrique de durée trompeuse | Élevée | méthode/profil et incertitude visibles |
| changement de route après départ | Critique | changement explicite pendant session |
| duplication des modèles LKDV | Élevée | audit avant toute nouvelle table |

### Critères d’acceptation « 20/10 »

Le créateur est prêt lorsque **trois utilisateurs peuvent ouvrir une même sortie sur deux téléphones et un ordinateur, modifier deux étapes indépendantes sans perdre de travail, créer volontairement un conflit sur le même waypoint et le résoudre intelligiblement, publier une nouvelle version, voir les conséquences sur les jours et le kit, télécharger cette version, fermer l’application, passer en mode avion, la rouvrir, consulter la route/étapes/kit, enregistrer la sortie réelle puis retrouver dans le carnet la révision et le snapshot de préparation utilisés**.

Et il doit réussir le même scénario avec un problème volontaire :

**le fournisseur de routage répond en retard, la carte WebGL échoue, un participant perd ses droits et le réseau disparaît pendant la génération du pack.**

Si LKDV reste cohérent dans ces conditions, alors le « 20/10 » n’est plus une accumulation de fonctions. Il devient une propriété du produit : **le plan est collaboratif sans devenir ambigu, le terrain reste exploitable sans réseau, et chaque décision cartographique reste reliée à ce que le voyageur doit réellement préparer.**
