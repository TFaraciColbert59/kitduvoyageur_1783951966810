# Import de traces TCX et FIT

Brique locale de lecture des activités TCX et FIT, partagée par le futur
parcours d'import. Elle ne fait aucun réseau, n'écrit rien et ne dépend d'aucun
décodeur externe.

Références de suivi : `A03`, `K6.02`, `S1.15`.

## Périmètre réellement livré

- **TCX v2** : une activité par fichier, plusieurs `Lap`, plusieurs `Track` par
  `Lap` (`trackIndex` et `tracks` conservés), `Trackpoint` avec position,
  altitude, distance, vitesse (`TPX`), FC, cadence course (`RunCadence`),
  puissance et température. `Courses`, `Workouts` et `Folders` sont ignorés
  mais **signalés** (`provenance.ignoredSections` + issue `ignored-section`).
- **FIT** : décodage binaire local des messages `file_id` (0), `session` (18),
  `lap` (19), `record` (20), `device_info` (23) et `activity` (34). Échelles,
  décalages, semicircles, little/big endian, en-tête 12 ou 14 octets, CRC
  d'en-tête et de fichier, horodatage compressé. Les autres messages et les
  champs non interprétés sont **signalés** dans `ignoredSections` et par une
  issue, jamais abandonnés en silence. Les champs développeur sont sautés et
  signalés. La cadence n'est rangée dans `cadenceRpm` que pour le vélo et dans
  `runCadenceSpm` que pour la course/marche ; les autres sports produisent une
  issue `unsupported-feature` au lieu d'une unité fausse.
- **Provenance** : format, nom de fichier, taille, schéma, créateur/produit,
  sport, début/fin, base temporelle, sections ignorées, empreinte SHA-256.
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
  `maxDepth` 64, `maxIssues` 100. `maxIssues` réserve la dernière entrée à
  `issue-limit` : la liste ne dépasse jamais la borne.
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
- FIT de parcours (`file_id.type = 6`), FIT multisport, plusieurs messages
  `activity`, TCX v1 et `MultiSportSession` sont refusés explicitement, pas
  convertis.
- Les autres types de fichier FIT (sport, workout, monitoring…) ne sont pas
  filtrés : s'ils contiennent des messages `record`/`lap`/`session`, ils
  peuvent être lus comme une activité.
- Les extensions TCX autres que `TPX` (par exemple `LX` d'un `Lap` ou d'une
  `Activity`) ne sont ni interprétées ni signalées.
- Pas de streaming/worker : `parseTcx` prend la chaîne complète.
- Pas de fixture Garmin réelle : les tests utilisent des fixtures synthétiques.
- Les chaînes de provenance (`creator`, `productId`, `sport`, etc.) restent
  contrôlées par le fichier ; un consommateur doit les rendre comme du texte,
  jamais comme du HTML.

## Limites connues

- Les chaînes de provenance (`creator`, `productId`, `sport`, `intensity`,
  `triggerMethod`) sont bornées par `maxBytes`, pas par une longueur dédiée :
  un consommateur doit les tronquer pour l'affichage.
- Pas de diagnostic ligne/colonne : les erreurs indiquent un chemin XML ou un
  message FIT, pas une position dans le fichier.
- Le lecteur XML est volontairement strict sur les entités et les namespaces,
  mais ne couvre pas tous les détails XSD (noms Unicode, commentaires `--`,
  `<` en valeur d'attribut). Ce sont des tolérances de robustesse, pas des
  garanties de conformité au schéma.
- Pas de streaming : le fichier complet est en mémoire.
- FIT : un fichier sans CRC de fin, même complet, est marqué `truncated`.
- FIT : un `record` sans horodatage est rattaché au lap 0 quand plusieurs laps
  existent ; aucun lap n'est inventé pour le point.
- FIT : les valeurs 64 bits au-delà de 2^53 perdent leur précision en `number`.
  Aucun champ normalisé courant ne les utilise.

## Contrat de consommation

- `NormalizedTraceImport.points` est ordonné par le document. `recordedAt` et
  `recordedAtLocal` sont exclusifs : l'un des deux est `null`.
- `lapIndex` et `trackIndex` permettent de ne pas relier deux segments séparés
  par un trou.
- `status: 'truncated'` signifie que des enregistrements complets ont été
  conservés mais que la fin annoncée manque.
- `availableMetrics` ne liste que les métriques réellement présentes.

## Vérification

```bash
node_modules/.bin/vitest run src/features/hiking/import
node_modules/.bin/tsc -p <tsconfig ciblé sur src/features/hiking/import>
node_modules/.bin/eslint src/features/hiking/import
```
