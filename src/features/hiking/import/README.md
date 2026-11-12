# Import de traces TCX et FIT

Brique locale de lecture des activités TCX et FIT, partagée par le futur
parcours d'import. Elle ne fait aucun réseau, n'écrit rien et ne dépend d'aucun
décodeur externe.

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
  Les champs développeur sont sautés et signalés. La cadence n'est rangée
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
- **Encodage TCX** : l'entrée `parseTraceFile({ bytes })` détecte les BOM
  UTF-8, UTF-16LE et UTF-16BE. Un TCX UTF-16 valide n'est plus refusé comme
  XML invalide.
- **Sécurité XML** : pas de DOM, DTD/`ENTITY`/entités externes refusées,
  résolution de namespaces par élément, attributs sans prototype.

## Non couvert, volontairement

- Le branchement UI `Compte → Sorties → ⋯ → Importer → FIT/TCX` et le drawer
  ne sont pas dans cette brique.
- La persistance Supabase, le stockage privé des originaux, l'unicité en base,
  la reprise et l'export ne sont pas livrés ici. Le critère « deux imports
  identiques donnent un seul objet » n'est donc **pas** satisfait par ce seul
  module : il exige une contrainte de persistance sur
  `(propriétaire, source, empreinte)`.
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
- FIT : les valeurs 64 bits au-delà de 2^53 perdent leur précision en `number`.
  Aucun champ normalisé courant ne les utilise.
- Les tests couvrent les variantes construites dans le dépôt, pas un panel de
  fichiers Garmin/Suunto réels ; il n'y a pas de mesure de couverture de
  lignes ni de banc de performance dans cette brique.

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
| **S1.15** — importer FIT et TCX valides/tronqués, contrôler tours, unités, provenance, erreurs, déduplication | **Partielle, mais les constats bloquants sont fermés** : `file_id.type = 4` exigé, dates de fin TCX calculées depuis les laps, messages FIT bornés, laps rattachés en `O((points + laps) log laps)`, résumé de session et champs FIT conservés ou signalés, cadence TCX sport-aware, `Notes`/`Training`/`Extensions` signalés, UTF-16 accepté. | L'unicité « deux imports identiques donnent un seul objet » n'est pas en base : `traceImportDedupeKey` reste une clé, sans contrainte de persistance. |
| **K6.02** — fixtures et parcours mobile | **Non satisfaite** : les tests sont synthétiques et aucun parcours mobile n'est branché. | Fixtures Garmin/Suunto réelles anonymisées, sélecteur binaire natif, écran d'aperçu et recette mobile. |
| **A03** — import FIT/TCX | **Brique locale seulement** : parseurs, modèle normalisé, limites, SHA-256 et 117 tests. | UI `Compte → Sorties → Importer`, persistance Supabase, stockage privé des originaux, export. |

## Vérification

```bash
node_modules/.bin/vitest run src/features/hiking/import
node_modules/.bin/tsc -p <tsconfig ciblé sur src/features/hiking/import>
node_modules/.bin/eslint src/features/hiking/import
```
