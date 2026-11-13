# Import de traces TCX et FIT

Brique locale de lecture des activités TCX et FIT, branchée sur le parcours
`Compte → Sorties → Importer FIT/TCX`. Le parseur ne fait aucun réseau et ne
dépend d'aucun décodeur externe ; le drawer React ne téléverse jamais le
fichier original. La seule écriture possible est la projection de la trace
dérivée vers `hike_sessions`, sous les gardes décrites plus bas.

La persistance et la déduplication sont documentées en détail dans
[`docs/import/A03-S1.15-persistance.md`](../../../../docs/import/A03-S1.15-persistance.md) :
registre privé `trace_imports`, clé `(propriétaire, empreinte SHA-256)`, RPC
transactionnelle `record_trace_import`, points de synchronisation avec les
branches Explorer/Carnet et limites de sécurité.

Les tours FIT/TCX sont persistés dans `public.trace_import_laps` et relus pour
le propriétaire ; le contrat, les bornes, la compatibilité et le volet RGPD
sont documentés dans
[`docs/import/A03-S2.05-persistance.md`](../../../../docs/import/A03-S2.05-persistance.md).
L’audit initial des contrats et des conflits reste dans
[`docs/import/A03-S2.05-tours.md`](../../../../docs/import/A03-S2.05-tours.md).

Références de suivi : `A03`, `K6.02`, `S1.15`, `S2.05`.

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
  `traceImportDedupeKey(trace, ownerId)`, qui ajoute le propriétaire. Le format
  source n'entre pas dans la clé : la base déduplique sur
  `(owner_id, source_fingerprint)` dans `public.trace_imports`. La clé client est
  un outil de lecture ; l'unicité réelle est portée par la contrainte SQL et la
  RPC `record_trace_import`.
- **Limites** : `maxBytes` 16 Mio, `maxPoints` 100 000, `maxLaps` 10 000,
  `maxMessages` 250 000, `maxDepth` 64, `maxIssues` 100. `maxMessages` est
  vérifié pendant la lecture FIT, avant matérialisation ; seuls les messages
  interprétés sont conservés. `maxIssues` réserve la dernière entrée à
  `issue-limit` : la liste ne dépasse jamais la borne. La projection réseau est
  plafonnée à 15 000 points géolocalisés (`TRACE_IMPORT_MAX_PAYLOAD_POINTS`),
  vérifiée par la route et la RPC, en plus de la taille source.
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
- **Restitution** : après rechargement, le drawer Sortie relit
  `public.trace_imports` pour le propriétaire et affiche format, nom, taille,
  empreinte et date d'import. « Voir la sortie » ouvre directement ce drawer
  depuis l'écran d'import ; aucun nouveau drawer n'est créé.
- **Tours** : les tours FIT/TCX déjà extraits sont affichés dans l'aperçu
  local (50 au plus, métriques réellement présentes, libellés d'intensité, de
  déclenchement et d'origine). Ils sont envoyés à l'API dans `laps[]` et
  écrits dans `public.trace_import_laps` avec la sortie et sa provenance, puis
  relus après rechargement pour le propriétaire. Un FIT sans message `lap`
  reste marqué `synthetic` (« Tour reconstruit ») ; un TCX ou un FIT avec
  `lap` reste `device`. Voir `docs/import/A03-S2.05-persistance.md`.

## Non couvert, volontairement

- Le stockage privé des originaux, la reprise et l'export dédié ne sont pas
  livrés ici. L'unicité par empreinte, elle, est livrée : voir
  `docs/import/A03-S1.15-persistance.md` et la migration
  `20261112123000_trace_import_dedupe.sql`.
- La provenance (format, empreinte, nom, taille, date d'import) est persistée
  dans `public.trace_imports` et **relue après rechargement** dans le drawer
  Sortie existant, pour le propriétaire uniquement. Les champs d'aperçu non
  persistés (sport, créateur, produit, série, fuseaux, sections ignorées) ne
  sont pas inventés. `notes` n'est pas détourné pour stocker la provenance.
- Les tours sont persistés, mais **aucun backfill** n'est possible pour les
  imports antérieurs : leurs tours n'ont jamais été stockés. Un réimport du
  même contenu retourne la sortie existante sans compléter ses tours. Les
  splits km/mile calculés et les tours manuels Explorer ne sont ni stockés dans
  `trace_import_laps` ni fusionnés avec les tours source : voir
  `docs/import/A03-S2.05-persistance.md`.
- Aucun aperçu de l'original n'est conservé : seule la trace dérivée peut
  rejoindre `hike_sessions`. Le fichier original ne quitte jamais l'appareil.
- GPX reste lu par `GPXEngine` ; `parseTraceFile` ne reconnaît que TCX et FIT.
  Le registre `trace_imports` accepte déjà `gpx` pour un branchement ultérieur.
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
- Déduplication : l'empreinte est déclarée par le client, car le fichier original
  ne quitte pas l'appareil. La portée propriétaire empêche tout impact sur un
  autre compte ; un utilisateur peut au pire se bloquer lui-même en associant une
  fausse empreinte à une sortie. Voir la section « Limite assumée » du document
  de persistance.
- Provenance : le nom de fichier peut contenir des données personnelles. Il est
  stocké dans `trace_imports`, lisible par le seul propriétaire, nettoyé et borné
  à 255 caractères ; il n'est jamais journalisé ni renvoyé par une réponse
  publique.
- Suppression : supprimer la sortie ou le compte supprime la provenance par
  cascade. Il n'existe pas de reprise ni d'export dédié de `trace_imports` dans
  l'interface.
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
4. Si la trace est enregistrable, le drawer envoie :
   `title`, `startedAt`, `endedAt`, `distanceKm`, `durationSeconds`,
   `elevationGainM`, `maxAltitudeM`, `positions`, `positionsTimed`,
   `poiEvents: []`, `createCarnet: false`, `source`, `sourceFingerprint`,
   `sourceFileName`, `sourceByteLength`. La projection est échantillonnée à
   **15 000 points géolocalisés maximum** (extrémités conservées) pour rester
   sous la limite de charge de la plateforme ; les métriques de l'aperçu, elles,
   portent sur la trace complète.
5. La route reconnaît le contrat d'import à la présence conjointe de `source` et
   `sourceFingerprint`. Elle appelle alors la RPC `record_trace_import`, qui
   réserve `(propriétaire, empreinte)`, écrit la sortie `hike_sessions`
   (`private`, titre, altitude max, `positions_geojson`, `positions_timed`,
   `carnet_id NULL`) et la provenance `trace_imports` dans une seule transaction.
   Elle répond `existing: true` uniquement quand **la même empreinte** a déjà été
   importée par ce propriétaire. Aucun carnet automatique, aucun moment, aucun
   voyage ne sont créés pour un import.
6. Le contrôle historique `(user_id, started_at)` reste actif pour les appels GPS
   qui ne portent pas le contrat d'import. Il n'est jamais appliqué à un import :
   deux fichiers différents démarrant à la même seconde restent deux sorties.
7. L'aperçu reste local : aucune requête réseau n'est faite avant le geste
   explicite « Enregistrer dans mes sorties ».
8. Après l'enregistrement, **« Voir la sortie »** ouvre le drawer Sortie
   existant (`outing_drawer`) avec le `session_id` retourné. Pour un import déjà
   présent (`existing: true`) et absent de la liste chargée par le runtime,
   l'action retombe sur « Mes sorties » : elle ne fabrique pas d'entrée de liste
   avec un titre ou des métriques supposés.
9. Après rechargement, `GET /api/compte/sorties/[id]` relit
   `public.trace_imports` **uniquement pour le propriétaire**
   (`isProvenanceOwner` + `owner_id = auth.uid()` sous RLS) et restitue format,
   nom, taille, empreinte et date d'import. Un participant reçoit
   `provenance: null`. Si la table n'est pas encore déployée ou si la lecture
   échoue, la sortie reste lisible sans provenance : aucune erreur 500.

### Persistance et déduplication livrées

Migration additive `20261112123000_trace_import_dedupe.sql` (rollback
`supabase/migrations_down/20261112123000_trace_import_dedupe.down.sql`).

| Objet | Rôle |
|---|---|
| `public.trace_imports` | Registre privé de provenance : `owner_id`, `session_id`, `source`, `source_fingerprint`, `source_file_name`, `source_byte_length`, `correlation_id`, `imported_at`. |
| `unique (owner_id, source_fingerprint)` | Clé de déduplication : un contenu identique ne crée qu'une sortie par propriétaire. Le format n'entre pas dans la clé. |
| `unique (session_id)` | Une sortie ne peut être reliée qu'à une provenance. |
| `record_trace_import(...)` | RPC `SECURITY DEFINER`, propriétaire = `auth.uid()`, transaction unique : lecture de la provenance, insertion de la sortie et de la provenance, ou retour de l'existante. |
| RLS `trace_imports` | Lecture propriétaire seule ; aucune policy d'écriture ; `authenticated` n'a que `SELECT` ; `anon` aucun accès. |

Le détail de l'algorithme, du modèle de menace et des points de synchronisation
avec les branches Explorer/Carnet est dans
[`docs/import/A03-S1.15-persistance.md`](../../../../docs/import/A03-S1.15-persistance.md).

### Dépendances de confidentialité

- Le fichier original contient des coordonnées précises, parfois FC, cadence,
  puissance et numéro de série : il relève de données personnelles sensibles.
  **Il n'est pas conservé** : seuls la trace dérivée, l'empreinte, le nom et la
  taille rejoignent la base. Si un stockage d'originaux est ouvert un jour, ce
  devra être un bucket **privé**, avec RLS propriétaire, URL signée courte,
  aucune URL publique et suppression/export RGPD.
- `trace_imports` est propriétaire seul : RLS `owner_id = auth.uid()`, aucune
  policy d'écriture, `authenticated` n'a que `SELECT`, `anon` aucun accès. Le
  nom de fichier, l'empreinte et la taille ne sont donc jamais exposés par un
  carnet public ou une policy de session partagée.
- `hike_sessions` est privé par défaut (`visibility = 'private'`). Un import crée
  `carnet_id = NULL` et ne crée **aucun** carnet, moment ou voyage. La policy de
  lecture historique peut exposer les lignes liées à un carnet public ; la
  branche `codex/lkdv-p01-trace` (`20261112121000`) resserre ce point. Quelle que
  soit son application, la provenance d'import reste dans `trace_imports`, hors
  de cette lecture.
- Les chaînes de provenance (`creator`, `productId`, `sport`, `intensity`,
  `triggerMethod`, nom de fichier) restent contrôlées par le fichier. Elles sont
  rendues comme du texte React, tronquées, jamais injectées en HTML. Le titre,
  les notes et le nom de fichier sont en plus nettoyés et bornés à l'écriture.
- Aucun appel réseau tiers n'est fait par le parseur ni par le drawer en dehors
  de l'API interne d'enregistrement.

## Contrat de consommation

- `NormalizedTraceImport.points` est ordonné par le document. `recordedAt` et
  `recordedAtLocal` sont exclusifs : l'un des deux est `null`.
- `lapIndex` et `trackIndex` permettent de ne pas relier deux segments séparés
  par un trou. `lapIndex = -1` signifie « aucun lap connu » (point sans
  horodatage ou antérieur au premier lap), jamais « lap 0 ».
- `TraceImportPreview.laps` est un résumé **local** borné à 50 tours, destiné
  à l'aperçu. `HikeSessionImportPayload.laps` est le tableau **complet** des
  tours source, borné à 10 000 et validé par `lapContract.ts` ; c'est lui qui
  part à l'API. Le détail rechargé relit la table `trace_import_laps`, jamais
  l'aperçu local.
- `summary` est le résumé `session` FIT ; il vaut `null` pour TCX ou quand le
  message `session` manque. Il ne remplace pas les laps : il conserve les
  totaux de session que les laps ne répètent pas.
- `provenance.serialNumber` et `provenance.fileCreatedAt` viennent de
  `file_id` (FIT) ; ils valent `null` pour TCX.
- `status: 'truncated'` signifie que des enregistrements complets ont été
  conservés mais que la fin annoncée manque.
- `availableMetrics` ne liste que les métriques réellement présentes dans les
  points, les laps ou le résumé `session` FIT.
- `importContract.ts` expose le contrat d'entrée de la route :
  `resolveTraceImportIdentity`, `validateTraceImportPayload` et
  `boundedImportFileName`. Il est pur, sans Next ni Supabase, et ne remplace pas
  la validation finale de la RPC.
- `lapContract.ts` expose `TraceImportLapPayload`,
  `buildTraceImportLapPayloads`, `normalizeTraceImportLaps` et les bornes des
  tours. Il refuse `computed` / `manual` : les splits calculés ne passent jamais
  par le contrat des tours source.

## Confrontation aux fiches

| Fiche | État après cette passe | Ce qui reste hors de la brique |
|---|---|---|
| **S1.15** — importer FIT et TCX valides/tronqués, contrôler tours, unités, provenance, erreurs, déduplication | **Déduplication par empreinte livrée** : `file_id.type = 4` exigé, dates de fin TCX calculées depuis les laps, messages FIT bornés, laps rattachés en `O((points + laps) log laps)`, résumé de session et champs FIT conservés ou signalés, cadence TCX sport-aware, `Notes`/`Training`/`Extensions` signalés, UTF-16 accepté, aperçu UI, refus explicites, registre `trace_imports` et RPC atomique `(owner_id, source_fingerprint)`. | Le stockage des originaux, l'export dédié et la reprise restent ouverts. La vérification serveur de l'empreinte est impossible sans téléverser l'original (limite assumée). |
| **K6.02** — fixtures et parcours mobile | **Parcours mobile branché** : `Compte → Sorties → Importer FIT/TCX`, sélecteur, glisser-déposer, aperçu, erreurs et message de déduplication par fichier. | Fixtures Garmin/Suunto réelles anonymisées et recette mobile sur appareil ; aucune suite n'a été exécutée dans cette passe. |
| **A03** — import FIT/TCX | **Flux complété côté persistance et restitution** : parseurs, modèle normalisé, limites, SHA-256, aperçu, enregistrement privé, registre de provenance owner-only, déduplication atomique, provenance et tours relus après rechargement dans le drawer Sortie, raccordement « Voir la sortie ». | Bucket privé des originaux, export dédié, fixtures producteurs et validation en recette. Aucun backfill des imports antérieurs. |
| **S2.05** — tours de montre | **Persistance et restitution livrées localement** : `origin` device/synthetic, `trace_import_laps`, RPC versionnée, RLS propriétaire, lecture paginée et rendu borné. Les splits calculés restent séparés. | Aucun backfill, aucune conversion `ActivitySplit`, aucun stockage de points par tour. Recette et vérifications reportées ; voir `docs/import/A03-S2.05-persistance.md`. |

## Vérification

Commandes prévues, **non exécutées dans cette passe** :

```bash
node_modules/.bin/vitest run src/features/hiking/import tests/security/a14-gdpr-account.spec.ts
node_modules/.bin/tsc -p <tsconfig ciblé sur src/features/hiking/import>
node_modules/.bin/eslint src/features/hiking/import src/app/api/hike-sessions
# migration locale, sur une copie :
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261112123000_trace_import_dedupe.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations_down/20261112123000_trace_import_dedupe.down.sql
```

Contrôles manuels à faire en fin de chantier :

- deux fichiers différents avec le même `started_at` créent deux `hike_sessions` ;
- deux imports du même fichier retournent le même `session_id` et une seule ligne
  `trace_imports` ;
- le même fichier importé par deux comptes crée deux lignes ;
- un import ne crée ni carnet ni moment et reste `visibility = 'private'` ;
- `anon` ne peut pas lire `trace_imports` ; un autre utilisateur authentifié ne
  voit pas la ligne du propriétaire ;
- après rechargement, le propriétaire voit format, nom, taille, empreinte et
  date d'import dans le détail de la sortie ; un participant ne reçoit pas
  `provenance` et aucun nom de fichier dans la réponse réseau ;
- sans la migration, le détail d'une sortie reste lisible et `provenance` vaut
  `null` ;
- l'export et la suppression RGPD comptent `trace_imports` sans erreur.

Passe A03 « persistance et restitution » : ces commandes n'ont **pas** été
exécutées, à la demande de Tony (tests, suites, build et revue reportés). Seuls
des contrôles de lecture du diff ont été faits ; le rapport de fin liste les
points à vérifier.
