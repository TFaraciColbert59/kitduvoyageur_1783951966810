# Import de traces TCX et FIT

Brique locale de lecture des activités TCX et FIT, branchée sur le parcours
`Compte → Sorties → Importer FIT/TCX`. Le parseur ne fait aucun réseau et ne
dépend d'aucun décodeur externe ; le drawer React ne téléverse jamais le
fichier original. La seule écriture possible est la projection de la trace
dérivée vers le mécanisme existant `hike_sessions`, sous les gardes décrites
plus bas.

Références de suivi : `A03`, `K6.02`, `S1.15`.

## Périmètre réellement livré

- **TCX v2** : une activité par fichier, plusieurs `Lap`, plusieurs `Track` par
  `Lap` (`trackIndex` et `tracks` conservés), `Trackpoint` avec position,
  altitude, distance, vitesse (`TPX`), FC, cadence, puissance et température.
  `<Cadence>` est rangée selon `Activity@Sport` : `runCadenceSpm` pour la
  course/marche, `cadenceRpm` pour le vélo ; un sport non couvert produit une
  issue `unsupported-feature` au lieu d'une unité fausse. `Courses`,
  `Workouts`, `Folders`, `Notes`, `Training` et les `Extensions` hors `TPX`
  sont ignorés mais **signalés** (`provenance.ignoredSections` + issue
  `ignored-section`). Les `Extensions` hors `TPX` sont en outre agrégées par
  nom avec leur `elementCount` global, pour que la provenance reste bornée.
  La fin d'un lap (`StartTime + TotalTimeSeconds`) entre dans `endedAt` /
  `endedAtLocal`, même sans trackpoint ou quand le dernier point précède la
  fin réelle.
- **FIT** : décodage binaire local des messages `file_id` (0), `session` (18),
  `lap` (19), `record` (20), `device_info` (23) et `activity` (34). Échelles,
  décalages, semicircles, little/big endian, en-tête 12 ou 14 octets, CRC
  d'en-tête et de fichier, horodatage compressé. Seul `file_id.type = 4`
  (activité) est accepté : parcours, sport, workout, monitoring et `file_id`
  absent sont refusés avec `not-activity`. Un FIT complet sans message
  `session` ni `activity` est également refusé ; un FIT tronqué peut conserver
  ses `record`/`lap` complets. Les autres messages et les champs
  non interprétés sont **signalés** dans `ignoredSections` et par une issue,
  jamais abandonnés en silence ; `file_id.timeCreated` / `serialNumber` et
  `activity.totalTimerTime` sont normalisés. Un `lap` expose `maxPowerW`
  (champ 20) et `intensity` (champ 23), sans confondre puissance et intensité.
  Quand aucun message `lap` n'existe, le lap synthétique reprend
  `session.max_power` (champ 20) : la puissance maximale de session n'est pas
  perdue. Les champs développeur sont sautés et signalés. La cadence n'est rangée
  dans `cadenceRpm` que pour le vélo et dans `runCadenceSpm` que pour la
  course/marche ; les autres sports produisent une issue
  `unsupported-feature` au lieu d'une unité fausse.
- **Résumé FIT** : `NormalizedTraceImport.summary` conserve les totaux de la
  session (durée, distance, calories, vitesses, FC, cadence, sport,
  `activity.totalTimerTime`) même quand des laps existent.
- **Provenance** : format, nom de fichier, taille source (octets pour FIT et
  pour un TCX fourni en octets ; longueur UTF-8 du texte sinon), schéma,
  créateur/produit, numéro de série et date de création FIT, sport, début/fin,
  base temporelle, sections ignorées, empreinte SHA-256.
- **Temps** : un `xsd:dateTime` avec fuseau devient un instant UTC ; un
  `xsd:dateTime` sans fuseau reste une heure civile locale dans
  `recordedAtLocal` / `startedAtLocal`. `timeBasis` vaut `utc`, `local`,
  `mixed` ou `none`. Un mélange est signalé et aucune durée n'est calculée
  entre un instant et une heure locale. Aucun instant UTC n'est inventé. Une
  durée déduite de deux heures civiles est nominale : aucune transition
  d'heure d'été n'est connaissable sans fuseau.
- **Déduplication** : `provenance.fingerprint` (SHA-256 du contenu original) et
  `traceImportDedupeKey(trace, ownerId)`, qui ajoute le propriétaire et la
  source. La clé est un outil : elle ne crée pas l'unicité à elle seule.
- **Limites** : `maxBytes` 16 Mio, `maxPoints` 100 000, `maxLaps` 10 000,
  `maxMessages` 250 000, `maxDepth` 64, `maxIssues` 100. `maxMessages` est
  vérifié pendant la lecture FIT, avant matérialisation ; seuls les messages
  interprétés sont conservés. `maxIssues` réserve la dernière entrée à
  `issue-limit` : la liste ne dépasse jamais la borne.
- **Rattachement FIT** : les débuts de laps sont triés une fois et chaque point
  fait une recherche binaire (`O((points + laps) log laps)`), au lieu d'un
  parcours de tous les laps par point puis d'un nouveau parcours des points par
  lap. Si des débuts de laps ne sont pas croissants, chaque point suit le
  dernier début réel et une issue `time-out-of-order` est ajoutée. Un point
  antérieur à tous les laps, ou sans horodatage, reçoit `lapIndex = -1` : aucun
  début de lap ne lui est inventé.
- **Bornes FIT** : `session.startTime` et `session.timestamp` restent les
  bornes officielles quand elles existent. En leur absence, `startedAt` et
  `endedAt` sont les min/max réels des points horodatés, puis des débuts/fins
  de laps quand aucun point n'est horodaté. Si des points ou des débuts de laps
  ne sont pas croissants, les bornes portent sur l'ensemble des points et des
  fins de laps, jamais sur le premier ou le dernier élément du document.
- **Encodage TCX** : l'entrée `parseTraceFile({ bytes })` détecte les BOM
  UTF-8, UTF-16LE et UTF-16BE. Un TCX UTF-16 valide n'est plus refusé comme
  XML invalide.
- **Sécurité XML** : pas de DOM, DTD/`ENTITY`/entités externes refusées,
  résolution de namespaces par élément, attributs sans prototype.
- **Parcours Compte** : entrée `Compte → Sorties → Importer FIT/TCX` (et
  `Créer → Importer une trace`). Sélection par bouton ou glisser-déposer,
  lecture `ArrayBuffer` locale, aperçu des métriques réellement présentes,
  provenance, empreinte, alertes et sections ignorées. Les erreurs du parseur
  sont rendues avec leur code, jamais comme un fichier accepté.
- **Enregistrement** : possible seulement pour une trace complète, avec des
  bornes UTC et une durée/distance réelles. Le drawer appelle
  `POST /api/hike-sessions` avec `createCarnet: false` : la sortie dérivée est
  privée, aucun carnet public n'est créé, l'original reste sur l'appareil.

## Non couvert, volontairement

- Le stockage privé des originaux, l'unicité en base par empreinte, la reprise
  et l'export ne sont pas livrés ici. Le critère « deux imports identiques
  donnent un seul objet » n'est satisfait que par le contrôle historique de
  `POST /api/hike-sessions` sur `(user_id, started_at)`, qui n'est **pas** une
  unicité d'empreinte : il ne distingue pas deux fichiers différents démarrant
  à la même seconde. La vraie contrainte reste à créer.
- L'écriture actuelle ne conserve ni le format source, ni l'empreinte, ni le
  nom du fichier d'origine. Une sortie importée est donc indiscernable d'une
  sortie GPS après rechargement ; `notes` n'est pas détourné pour stocker la
  provenance.
- Aucun aperçu de l'original n'est conservé : seule la trace dérivée peut
  rejoindre `hike_sessions`.
- GPX reste lu par `GPXEngine` ; `parseTraceFile` ne reconnaît que TCX et FIT.
- FIT multisport, plusieurs messages `activity`, plusieurs `file_id`, TCX v1 et
  `MultiSportSession` sont refusés explicitement, pas convertis. Les types de
  fichier FIT autres que `4` (parcours, sport, workout, monitoring…) sont
  refusés avec `not-activity`.
- Les `Extensions` TCX sont lues pour `TPX` ; les autres sous-arbres sont
  comptés et signalés, mais pas interprétés (par exemple `LX`).
- Pas de streaming/worker : `parseTcx` prend la chaîne complète.
- Pas de fixture Garmin réelle : les tests utilisent des fixtures synthétiques
  (TCX et FIT construits localement), ce qui ne couvre pas toutes les variantes
  du profil FIT ni les tolérances des producteurs.
- Les chaînes de provenance (`creator`, `productId`, `sport`, etc.) restent
  contrôlées par le fichier ; un consommateur doit les rendre comme du texte,
  jamais comme du HTML.

## Limites connues

- Les chaînes de provenance (`creator`, `productId`, `sport`, `intensity`,
  `triggerMethod`) sont bornées par `maxBytes`, pas par une longueur dédiée :
  un consommateur doit les tronquer pour l'affichage.
- TCX : `<Cadence>` d'une course est reprise telle quelle en pas/min ; aucune
  conversion foulées → pas n'est tentée quand la source est ambiguë.
- Pas de diagnostic ligne/colonne : les erreurs indiquent un chemin XML ou un
  message FIT, pas une position dans le fichier.
- Le lecteur XML est volontairement strict sur les entités et les namespaces,
  mais ne couvre pas tous les détails XSD (noms Unicode, commentaires `--`,
  `<` en valeur d'attribut). Ce sont des tolérances de robustesse, pas des
  garanties de conformité au schéma.
- Pas de streaming : le fichier complet est en mémoire.
- FIT : un fichier sans CRC de fin, même complet, est marqué `truncated`. La
  politique reste conservatrice : distinguer `missing-crc` de `truncated`
  demanderait de confirmer le profil auprès de fixtures réelles. Les octets
  situés après le CRC déclaré ne sont pas interprétés ni signalés.
- FIT : un `record` sans horodatage, comme un point antérieur au premier lap,
  reçoit `lapIndex = -1` ; aucun lap n'est inventé pour le point.
- FIT : quand des points horodatés existent, les bornes de repli privilégient
  leurs min/max. Une fin de lap postérieure au dernier point n'est reprise que
  si les points ou les débuts de laps sont désordonnés ; sinon les bornes
  gardent la priorité historique « points, puis laps ».
- FIT : `tracks` reste un segment contigu synthétique (`firstPointIndex`,
  `pointCount`). Quand des points sont désordonnés, les points d'un même lap
  peuvent être non contigus : un consommateur doit filtrer par `lapIndex`, pas
  découper `tracks`.
- FIT : `session.avg_power` (champ 19) n'est pas normalisé ; seul
  `session.max_power` (champ 20) est repris dans le lap synthétique.
- FIT : les valeurs 64 bits au-delà de 2^53 perdent leur précision en `number`.
  Aucun champ normalisé courant ne les utilise.
- Les tests couvrent les variantes construites dans le dépôt, pas un panel de
  fichiers Garmin/Suunto réels ; il n'y a pas de mesure de couverture de
  lignes ni de banc de performance dans cette brique.

## Parcours et persistance actuelle

1. Le fichier est choisi dans `TraceImportDrawer` (`accept=".fit,.tcx"`), lu en
   `ArrayBuffer`, puis passé à `parseTraceFile({ bytes, fileName })`.
2. `buildTraceImportPreview` calcule les métriques d'aperçu sans inventer de
   valeur : résumé FIT, puis somme des tours, puis points ; durée et distance
   restent `null` si la source ne les porte pas.
3. L'enregistrement est refusé dans l'interface tant que la trace est tronquée,
   sans fuseau UTC, sans bornes ou sans durée/distance réelles. Le refus est
   affiché avec sa raison, et `buildHikeSessionImportPayload` retourne `null`.
4. Si la trace est enregistrable, le drawer envoie uniquement :
   `title`, `startedAt`, `endedAt`, `distanceKm`, `durationSeconds`,
   `elevationGainM`, `maxAltitudeM`, `positions`, `positionsTimed`,
   `poiEvents: []`, `createCarnet: false`. La projection est échantillonnée à
   **15 000 points géolocalisés maximum** (extrémités conservées) pour rester
   sous la limite de charge de la plateforme ; les métriques de l'aperçu, elles,
   portent sur la trace complète.
5. La route existante écrit dans `hike_sessions` (`private`, titre, altitude max,
   `positions_geojson`, `positions_timed`) et répond `existing: true` quand une
   sortie du même propriétaire commence déjà au même instant. Aucun carnet
   automatique n'est créé pour un import.
6. L'aperçu reste local : aucune requête réseau n'est faite avant le geste
   explicite « Enregistrer dans mes sorties ».

### Besoins de base pour l'intégration ultérieure (aucune migration créée ici)

Pour satisfaire S1.15 sans ambiguïté, une migration unique et relue devra
ajouter, sur `public.hike_sessions` (ou une table `trace_imports` dédiée) :

| Besoin | Proposition | Raison |
|---|---|---|
| Source | `source text not null default 'gps'` avec `check (source in ('gps','fit','tcx','gpx'))` | Distinguer un import d'un enregistrement GPS sans toucher aux lignes existantes. |
| Empreinte | `source_fingerprint text` (SHA-256 du fichier original) | Déduplication fondée sur le contenu, pas sur l'heure de départ. |
| Nom d'origine | `source_file_name text` | Retrouver le fichier sans exposer son contenu. |
| Unicité | index unique partiel `(user_id, source_fingerprint)` `where source_fingerprint is not null` | « Deux imports identiques donnent un seul objet », par propriétaire. |
| Import | `imported_at timestamptz` et éventuellement `import_metadata jsonb` | Tracer l'import sans polluer `notes`, et permettre une reprise. |
| RPC | upsert transactionnel `import_trace_session(...)` avec `ON CONFLICT` | Éviter la course entre deux onglets et rendre la déduplication atomique. |

Le contrôle actuel `started_at` de la route reste un garde-fou historique : il
ne doit pas être présenté comme l'unicité d'empreinte. Tant que la migration
n'existe pas, l'interface dit « déjà présente » quand ce contrôle répond, et
documente la limite.

### Dépendances de confidentialité

- Le fichier original contient des coordonnées précises, parfois FC, cadence,
  puissance et numéro de série : il relève de données personnelles sensibles.
  S'il est conservé, ce doit être dans un bucket **privé**, avec RLS
  propriétaire, URL signée courte, aucune URL publique et suppression/export
  RGPD. Le parcours actuel ne le téléverse pas, ce qui évite d'ouvrir ce stockage
  avant la migration.
- `hike_sessions` est privé par défaut (`visibility = 'private'`). La policy de
  lecture autorise aussi les sessions liées à un carnet public : un import ne
  crée donc **aucun carnet** et ne doit jamais être rattaché à un carnet public
  sans geste explicite.
- Les chaînes de provenance (`creator`, `productId`, `sport`, `intensity`,
  `triggerMethod`, nom de fichier) restent contrôlées par le fichier. Elles sont
  rendues comme du texte React, tronquées, jamais injectées en HTML.
- Aucun appel réseau tiers n'est fait par le parseur ni par le drawer en dehors
  de l'API interne d'enregistrement.

## Contrat de consommation

- `NormalizedTraceImport.points` est ordonné par le document. `recordedAt` et
  `recordedAtLocal` sont exclusifs : l'un des deux est `null`.
- `lapIndex` et `trackIndex` permettent de ne pas relier deux segments séparés
  par un trou. `lapIndex = -1` signifie « aucun lap connu » (point sans
  horodatage ou antérieur au premier lap), jamais « lap 0 ».
- `summary` est le résumé `session` FIT ; il vaut `null` pour TCX ou quand le
  message `session` manque. Il ne remplace pas les laps : il conserve les
  totaux de session que les laps ne répètent pas.
- `provenance.serialNumber` et `provenance.fileCreatedAt` viennent de
  `file_id` (FIT) ; ils valent `null` pour TCX.
- `status: 'truncated'` signifie que des enregistrements complets ont été
  conservés mais que la fin annoncée manque.
- `availableMetrics` ne liste que les métriques réellement présentes dans les
  points, les laps ou le résumé `session` FIT.

## Confrontation aux fiches

| Fiche | État après cette passe | Ce qui reste hors de la brique |
|---|---|---|
| **S1.15** — importer FIT et TCX valides/tronqués, contrôler tours, unités, provenance, erreurs, déduplication | **Partielle, constats bloquants fermés côté lecture ; parcours et écriture ajoutés** : `file_id.type = 4` exigé, dates de fin TCX calculées depuis les laps, messages FIT bornés, laps rattachés en `O((points + laps) log laps)`, résumé de session et champs FIT conservés ou signalés, cadence TCX sport-aware, `Notes`/`Training`/`Extensions` signalés, UTF-16 accepté, aperçu UI et refus explicites. | L'unicité par empreinte n'est pas en base : le contrôle actuel porte sur `(user_id, started_at)`, pas sur `(user_id, source, fingerprint)`. Le stockage des originaux et la reprise restent ouverts. |
| **K6.02** — fixtures et parcours mobile | **Parcours mobile branché** : `Compte → Sorties → Importer FIT/TCX`, sélecteur, glisser-déposer, aperçu et erreurs. | Fixtures Garmin/Suunto réelles anonymisées et recette mobile sur appareil ; aucune suite n'a été exécutée dans cette passe. |
| **A03** — import FIT/TCX | **Parcours utilisable** : parseurs, modèle normalisé, limites, SHA-256, aperçu et enregistrement privé via le mécanisme existant. | Migration `source`/`fingerprint`/unicité, bucket privé des originaux, export, fixtures producteurs et validation en recette. |

## Vérification

```bash
node_modules/.bin/vitest run src/features/hiking/import
node_modules/.bin/tsc -p <tsconfig ciblé sur src/features/hiking/import>
node_modules/.bin/eslint src/features/hiking/import
```

Passe A03 « interface » : ces commandes n'ont **pas** été exécutées, à la
demande de Tony (tests et revues reportés). Seuls des contrôles de syntaxe
locaux ont été faits ; le rapport de fin liste les points à vérifier.
