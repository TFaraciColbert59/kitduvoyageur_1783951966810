# S6.15-bis — correction des limites de confidentialité

**Date** : 2026-11-13.
**Point de départ** : `a67845d` et le rapport `work/lkdv-p01-metrics-config-build.jsonl`.
**Périmètre** : agrégats de carnet, profil altimétrique, listes API, exports partageables et surfaces tierces.
**Interdit et respecté** : aucun test, suite, build, lint, `tsc`, commit, production, réseau externe au modèle ni délégation.

## 1. Règle appliquée

Une métrique n'est publiable à un tiers que si **toutes** les sources qui peuvent la
composer l'autorisent. Cette règle est appliquée à trois niveaux :

1. **par sortie** : `metricVisibility` résolue par `resolveOutingMetricVisibility`
   (propriétaire/participant : toutes ; politique persistée pour un tiers) ;
2. **par carnet** : `intersectMetricVisibility` sur toutes les sorties lues ;
3. **par agrégat** : aucune colonne de stock (`carnets.distance_km`, `denivele_m`)
   ne sert de repli dès qu'une sortie existe. L'agrégat est reconstruit depuis les
   seules sorties autorisées.

Le propriétaire conserve ses valeurs de sortie brutes. Un total de carnet qui
mélange une sortie masquée d'autrui est retiré ; il n'est jamais deviné.

## 2. Carnet

### 2.1 Agrégats

- `BuildCarnetDetailInput.metricVisibilities` est **fail-closed** : une sortie
  absente de la map ne reçoit aucune métrique. Une map absente et un lecteur
  propriétaire conservent l'ancien comportement (`ALL`) pour ne pas casser un
  appel direct ; une map partielle ferme la sortie manquante, même au propriétaire.
- `sessionsComplete = false` (plus de 10 sorties) ferme les agrégats tiers.
- `distanceKm` et `elevationM` sont calculés par `aggregateMetric`, qui ne somme
  que les sorties dont la politique autorise la clé. Sans sortie, les colonnes du
  carnet restent la source (carnet manuel).
- `summary`, `stats` et `etapes` utilisent la même visibilité. `duree_texte` est
  retirée si `distance`, `elevationGain` ou `duration` est fermé : c'est du texte
  libre qui peut porter n'importe laquelle des trois valeurs.
- `CarnetDetail.metricVisibility` et `metricsMasked` exposent la politique
  appliquée, jamais une valeur.

### 2.2 Profil altimétrique

- `canExposeElevationProfile` exige `distance`, `elevation`, `elevationGain` et
  `maxAltitude`. Un profil porte ces quatre informations.
- `elevationWithheld = true` quand le profil est fermé.
- `enrichCarnetElevation` retourne la fiche inchangée si `elevationWithheld` ou si
  `metricVisibility` ne satisfait pas `canExposeElevationProfile`. La trace
  partagée ne suffit donc plus à reconstruire une altitude masquée.
- L'UI de la lentille altitude distingue « masqué » de « aucune mesure ».

## 3. Matrice des surfaces

| Surface | Lecteur | Donnée | Traitement | Statut |
| --- | --- | --- | --- | --- |
| `GET /api/compte/sorties/[id]` | propriétaire, participant, tiers autorisé | agrégats, trace, météo | `loadOutingDetail` projette scalaires et métadonnées | fermé |
| `GET /api/compte/sorties/[id]/gpx` | idem | coordonnées, `<ele>`, `<time>` | DTO projeté + `buildGpx` re-projette | fermé |
| `PUT/DELETE /api/compte/sorties/[id]/metrics` | propriétaire | politique | zod strict, propriété vérifiée | propriétaire |
| `GET /api/hike-sessions/[id]` | propriétaire, participant, tiers autorisé | distance, durée, D+, altitude max, météo | projection, horodatages retirés avec la durée | fermé |
| `GET /api/hike-sessions` | propriétaire uniquement | liste de ses sorties | `user_id = auth.uid()` | propriétaire |
| `GET /api/account/export` | propriétaire | export RGPD | auth + service après session | propriétaire |
| `GET /api/user/export` | propriétaire | export RGPD | auth + service après session | propriétaire |
| `GET /api/explorer/v2/content` | public | agrégats de carnet | champs retirés, réponse à `null` | fermé |
| Flux communautaire | public/authentifié | `route_distance_km`, `elevation_gain_m` | mapper public à `null` | fermé côté app |
| `GET /api/kits/[id]/sheet` | public/authentifié | `total_km`, `total_elevation_gain_m` | retirés si lecteur ≠ propriétaire | fermé côté app |
| `GET /api/carnets/[id]` | public | titre, description, moments | aucune métrique sélectionnée | fermé par construction |
| Page `/carnets/[id]` | public | fiche complète | `buildCarnetDetail` + `enrichCarnetElevation` | fermé |
| `community_carnets_feed` (RPC directe) | anon/authentifié | totaux de carnet | non modifiée | dépendance SQL |
| `get_kit_journal` (RPC directe) | authentifié | totaux de kit | non modifiée | dépendance SQL |
| `get_user_signature` (RPC directe) | public selon consentement | empreinte agrégée | non modifiée | dépendance produit |

## 4. Ce qui n'est pas une garantie

1. **Inférence distance + durée** : une allure moyenne reste calculable si les deux
   sont visibles, même avec `pace = false`.
2. **Géométrie de la trace** : les coordonnées partagées permettent de recalculer
   une distance et un dénivelé. `tracePrivacy` masque début/fin ou tout, mais ne
   remplace pas la politique par métrique. Le profil est fermé, la trace ne l'est
   pas au-delà de ses propres masques.
3. **RPC SQL directes** : `community_carnets_feed` et `get_kit_journal` restent
   appelables sans passer par le mapper ou la route qui masquent. Une migration
   dédiée devra les brancher sur `outing_share_metrics`.
4. **Empreinte** : `get_user_signature` est un agrégat consenti, distinct d'une
   sortie. Il n'est pas filtré par la politique par métrique.
5. **Plafond de lecture** : au-delà de 10 sorties détaillées, les agrégats tiers
   sont fermés, pas partiels.
6. **Texte libre** : `duree_texte` est retiré par précaution dès qu'une des trois
   métriques qu'il peut contenir est fermée.

## 5. Dépendances

- `outing_share_metrics` (migration `20261113121000`) doit être appliquée pour que
  les politiques des tiers soient lisibles. Sans elle, `getCarnetDetail` ne trouve
  aucune politique : les sorties des tiers restent fermées, le partage se dégrade.
- `service_role` est nécessaire à la projection d'un tiers dans `getCarnetDetail`,
  `GET /api/hike-sessions/[id]` et `loadOutingDetail`. Sans clé, la RLS ferme.
- `community_carnets_feed` et `get_kit_journal` devront être migrées pour fermer
  les appels directs.
- Les exports RGPD restent propriétaires : aucune donnée d'autrui n'y entre.

## 6. Fichiers

- `src/features/compte/domain/metricVisibility.ts`
- `src/features/carnet/detail/buildCarnetDetail.ts`
- `src/features/carnet/detail/getCarnetDetail.ts`
- `src/features/carnet/detail/types.ts`
- `src/features/carnet/detail/enrichElevation.ts`
- `src/components/carnet/v2/CarnetDrawerV2.tsx`
- `src/app/api/explorer/v2/content/route.ts`
- `src/app/api/kits/[id]/sheet/route.ts`
- `src/app/api/hike-sessions/route.ts`
- `src/features/community/v2/data/communityFeedMappers.ts`
- `docs/audit/S6.15-metriques-2026-11-13/RAPPORT.md`
- `docs/audit/S6.15-metriques-2026-11-13/MIGRATION-20261113121000.md`
- ce fichier

**Aucun test, build, lint, `tsc`, commit, production, réseau externe au modèle ou délégation n'a été exécuté.**
