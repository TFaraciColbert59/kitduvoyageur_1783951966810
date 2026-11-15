# Carnet v2 — service_role, fuite des jours et RLS du participant

Date : 2026-11-12 · Worktree : `lkdv-p01-trace` · Base : `191d29e`

> **Mise à jour — revue de `eff7db1`.** Les constats F1 à F6 et F8 sont traités
> dans `RAPPORT-PRIVACY-CRITIQUE-EFF7DB1.md`. En particulier, `rawSessionIds`
> n'est plus optionnel avec un repli historique : il est fail-closed (absent =
> liste vide), et les migrations `121210`/`121220` ont été durcies.

Périmètre : les constats de sécurité de la revue
`work/lkdv-p01-trace-rls-review.jsonl` — fuite des coordonnées et métadonnées
privées dans `days`/`segments`/`elevationProfile`, droits RLS trop larges du
participant d'une sortie, tests réalistes du chemin `service_role`, et collision
locale de version de migration avec `a01-session`.

## État de production — à lire avant tout

- **Le registre de production n'a PAS été vérifié.** Aucun export de
  `supabase_migrations.schema_migrations`, aucune connexion à la production.
- **Aucune migration n'a été appliquée**, ni en production ni sur une base
  locale (aucun serveur PostgreSQL/`psql` disponible dans cet environnement).
- **Aucun commit n'a été créé.**
- Aucun build global, aucun appel réseau externe au modèle, aucune délégation.

## 1. Fuite `service_role` dans `days` / `segments` / `elevationProfile`

### Ce qui fuyait

`getCarnetDetail` lit toutes les sorties du carnet avec le client
`service_role` après avoir vérifié l'accès au carnet. `buildCarnetDetail`
construisait ensuite :

- `days[].points` et `days[].segments` depuis **toutes** les sorties ;
- `elevationProfile` depuis **toutes** les sorties pour un non-visiteur ;
- `stats`/`distanceKm` depuis `sessions[0]`, même si cette sortie appartenait à
  quelqu'un d'autre et était privée.

Un auteur ou collaborateur de carnet non participant à une sortie privée
d'autrui recevait donc les coordonnées brutes dans les jours et le profil, alors
que la trace principale était correctement masquée. Les métadonnées (date,
durée, distance) de la sortie privée fuyaient aussi dans `summary`/`stats`.

### Correction

- `BuildCarnetDetailInput.rawSessionIds` : liste explicite des sorties dont le
  lecteur est propriétaire ou participant inscrit.
- `getCarnetDetail` calcule cette liste avec
  `hike_sessions.user_id === viewerId` ou une ligne
  `hike_session_participants` lue sous RLS.
- `buildCarnetDetail` :
  - seules les sorties autorisées alimentent `points`, `segments`,
    `elevationProfile` et `stats` ;
  - une sortie privée non autorisée est **entièrement écartée** de `days` ;
  - une sortie explicitement partageable (`public`/`collective_anonymized`)
    mais non autorisée ne fournit que des métadonnées agrégées (date, durée),
    jamais ses coordonnées ;
  - `hikeSession` (statistiques) est la sortie autorisée la plus récente ; sans
    sortie autorisée, repli sur les colonnes du carnet ;
  - le masquage global `isVisitor` des jours est supprimé : il privait aussi le
    participant de sa propre trace. Le filtrage est désormais par sortie.
- `rawSessionIds` est désormais fail-closed : absent, il vaut liste vide. Aucun
  appelant ne peut rouvrir les points, statistiques ou le profil par omission.

### Effet produit assumé

Un auteur/collaborateur qui n'a pas participé à une sortie privée ne voit plus
ni ses points, ni sa date, ni sa durée, ni sa distance. Une sortie privée d'un
carnet public n'apparaît plus dans les jours d'un visiteur. C'est le prix de
l'étanchéité ; le carnet garde ses propres colonnes agrégées.

## 2. RLS du participant de sortie

### Ce qui était trop large

`is_carnet_participant` mélangeait éditeur et participant de sortie. Il était
utilisé par les policies d'écriture (`carnet_moments`, `carnet_kit_items`,
`carnet_nights`) et par la lecture des positions live exactes. Un invité d'une
seule sortie pouvait donc modifier tout le carnet et lire les positions des
autres.

### Correction — migration `20261112122000_carnet_v2_participant_scope.sql`

- nouvelle fonction `is_carnet_editor(uuid)` : auteur ou collaborateur
  `owner`/`contributor` ;
- `is_carnet_participant` reste le helper de **lecture** (éditeur ou participant
  d'une sortie liée) ;
- écritures `carnet_moments`, `carnet_kit_items`, `carnet_nights` réservées à
  `is_carnet_editor` ;
- positions live : l'éditeur lit tout ; un participant ne lit que sa propre
  ligne, et seulement s'il est encore participant du carnet ;
- un participant peut toujours publier/mettre à jour/supprimer sa propre
  position.

### Décision explicite : lecture du carnet

Un participant de sortie **garde la lecture** du carnet privé, car il a été
invité sur une sortie liée et la fiche le traite comme `visitor` (pas de
budget, pas de jours privés, trace masquée). Les droits d'écriture et de lecture
des positions exactes d'autrui sont, eux, fermés. Si le produit veut aussi
fermer la lecture du carnet privé à ce participant, il faudra modifier
`can_view_carnet` et l'UX d'invitation ; ce n'est pas fait ici.

## 3. Collision de version `20261112120000`

La migration carnet est renumérotée :

- `supabase/migrations/20261112121000_carnet_v2_trace_raw_guard.sql`
- `supabase/migrations_down/20261112121000_carnet_v2_trace_raw_guard.down.sql`

La version `20261112120000` reste disponible pour
`explorer_v2_activity_finish_hardening.sql` de la branche `a01-session`.
Références mises à jour dans `phase8_rls_trace_guard.test.sql` et les rapports
d'audit.

Le down de `20261112121000` porte désormais un avertissement explicite : il
réouvre la lecture brute et doit être exécuté avant le down de
`20261112090000`, avec revert applicatif et de préférence un forward-fix.

Garde-fous ajoutés :

- `tests/security/migration-versions.spec.ts` : aucune version dupliquée dans
  `supabase/migrations` ni `supabase/migrations_down`, et vérification de la
  version `20261112121000` du couple up/down ;
- `scripts/db/migrations-alignment.mjs` : refuse désormais un export ou un
  dépôt contenant deux fichiers de même version (la `Map` les écrasait
  silencieusement).

## 4. Tests réalistes du `service_role` et refus

### `getCarnetDetail`

Le mock ne retombe plus systématiquement sur le client utilisateur :

- le client `service_role` est simulé et renvoie les lignes ;
- le client utilisateur simule la RLS et renvoie `[]` par défaut ;
- sans clé service (`serviceEnabled = false`), la fiche se dégrade : pas de
  trace, pas de jours, pas de profil ;
- si le carnet est refusé, `createServiceClient` n'est pas appelé (0 appel).

Tests ajoutés :

- lecture par `service_role` alors que la RLS cache les sorties ;
- absence de clé service : repli fermé ;
- refus du carnet : aucun appel `service_role` ;
- participant : points et profil de sa sortie, sans les autres ;
- auteur non participant : ni points, ni profil, ni métadonnées privées ; stats
  sur les colonnes du carnet.

### `GET /api/hike-sessions/[id]`

- le client `service_role` est mocké ; la RLS utilisateur renvoie `null` ;
- sans clé service, une sortie collective renvoie 404 (fermeture) ;
- sans clé service, le propriétaire garde sa fiche via la RLS ;
- une valeur héritée `public` sans carnet visible renvoie 404 ;
- une valeur héritée `public` avec carnet visible reste servie (défensif) ;
- le refus ne recopie ni `weather`, ni `owner-1`, ni la ligne.

## 5. Vérifications exécutées

- `npx tsc --noEmit -p .` : passe.
- Tests ciblés (configuration Vitest locale, cache dans le worktree, setup
  `no-network`) : **47 fichiers, 499 tests passés**.
- ESLint ciblé : 0 erreur, 0 avertissement sur les fichiers modifiés.
- Aucun test pgTAP exécuté : `psql`, `postgres` et Docker ne sont pas installés
  dans cet environnement. Les tests SQL sont écrits mais non rejoués.

## 6. Régressions évaluées

1. **`/api/kits/discovery`** : les filtres région/saison lisent `hike_sessions`
   avec le client utilisateur. Avec la RLS durcie, un anonyme obtient 0 ligne ;
   le filtre n'est alors pas appliqué et toutes les lignées sont renvoyées.
   **Non corrigé ici** : il faudrait un RPC agrégé `security definer` ou une
   matview dédiée. À traiter avant d'exposer ce filtre à un anonyme.
2. **Dernière activité du réseau** (`src/features/compte/server/reseau.ts`) :
   la lecture des `hike_sessions` d'autrui renvoie 0 ligne ; `lastActivityAt`
   devient `null` et le filtre « actifs » peut vider la liste. **Non corrigé** ;
   un RPC `user_id, max(started_at)` est la voie propre.
3. **`loadOutingDetail`** : un visiteur d'une sortie publique ne peut plus
   ouvrir ce détail par la RLS. Le drawer du Compte reste un espace
   propriétaire/participant ; c'est cohérent, mais c'est un changement de
   contrat à valider produit.
4. **`GET /api/hike-sessions/[id]`** : le passage de 200 à 404 pour une sortie
   privée/`friends` non autorisée est intentionnel. Les branches `public` et
   `friends` sont défensives : la contrainte réelle n'autorise que `private` et
   `collective_anonymized`. Elles exigent désormais `can_view_carnet`.
5. **Jours d'un carnet public** : un visiteur ne reçoit plus les points GPS
   bruts des jours ; il garde la trace projetée et les moments. Les sorties
   explicitement partageables ne fournissent que leurs métadonnées agrégées.
   C'est une perte volontaire de détail au profit de l'étanchéité.
6. **Statistiques** : un auteur non participant ne voit plus les statistiques
   d'une sortie privée d'autrui ; repli sur les colonnes du carnet. Cela peut
   changer un chiffre affiché, jamais exposer une coordonnée.

## 7. Limites

- Aucune vérification du registre de production : la renumérotation
  `20261112121000` est correcte **localement**, mais il faut confirmer sur
  l'export du registre que `20261112120000` est bien la migration `explorer`
  et non une ancienne migration carnet.
- La nouvelle migration `20261112122000` n'existe sur aucune autre branche
  locale au moment de la revue ; son absence du registre de production reste à
  confirmer avant toute application.
- Aucune migration appliquée, aucun pgTAP exécuté, aucune base locale.
- Aucun build global ni rendu MapLibre réel.
- Le down de `20261112121000` réouvre la lecture brute ; il n'est pas neutre.
- La lecture du carnet privé par un participant de sortie reste volontairement
  ouverte (voir §2) ; c'est une décision produit à confirmer.
- Le profil altimétrique est choisi parmi les sorties **autorisées**, pas
  forcément celle qui porte la trace affichée. C'est une incohérence d'affichage
  possible, sans fuite de coordonnées ; la lier à `traceSession` demanderait un
  champ supplémentaire.
- Les régressions `kits/discovery` et `reseau` restent ouvertes.
