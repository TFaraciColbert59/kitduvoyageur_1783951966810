# Carnet v2 — corrections des constats de la revue `2f304b3`

Date : 2026-11-12 · Worktree : `lkdv-p01-trace` · Base de revue : `2f304b38e73afd6093f26bc2e9772e7814b4398a`

Périmètre : les quatre constats nommés dans la demande — droits de partage des
personnes autorisées, surface V2 et accessibilité, profil altimétrique
multi-segments, cohérence météo API. Aucune reproduction offensive, aucun appel
réseau, aucun build global, aucune délégation.

## 1. Partage des personnes autorisées (`friends` / `followers`)

### Modèle retenu

La visibilité seule ne prouve jamais l'autorisation. Le rôle `follower` n'est
accordé qu'après lecture réelle de `user_follows` :

- `visitor` : aucun suivi vérifié → trace entièrement masquée pour
  `friends`/`followers`, météo absente ;
- `follower` : relation `follower_id = lecteur`, `following_id = auteur`
  confirmée → masques début/fin de 500 m, météo sans coordonnées ;
- `participant` / `owner` : trace complète et météo exacte ;
- `public` / `collective_anonymized` : masques début/fin pour tout le monde.

`mostRestrictiveTraceVisibility()` conserve désormais l'état intermédiaire
`friends` au lieu de l'écraser en `private`, et échoue fermé sans argument
(`private`). `resolveTraceMasks()` refuse `friends`/`followers` à un simple
visiteur.

### Fichiers

- `src/features/compte/server/tracePrivacy.ts`
- `src/features/compte/server/sorties.ts` (`viewerFollowsOwner`, rôle de lecture)
- `src/features/carnet/detail/getCarnetDetail.ts` (vérification `user_follows`)
- `src/features/carnet/detail/buildCarnetDetail.ts` (`traceViewer`)
- `src/features/carnet/detail/types.ts`
- `supabase/migrations/20261112090000_carnet_v2_friends_read.sql`
- `supabase/migrations_down/20261112090000_carnet_v2_friends_read.down.sql`

### Migration

La fonction canonique `public.can_view_carnet(uuid)` autorisait déjà les abonnés
réels, mais les policies historiques de `carnets` ne l'appliquaient pas. La
migration ajoute une policy permissive `carnets_select_can_view` et une policy
`hike_sessions_select_shared_carnet` limitée aux sorties explicitement
partageables (`public`, `collective_anonymized`). Le rollback est fourni.

**La migration n'a pas été appliquée** : aucun accès base dans cette session.
Tant qu'elle ne l'est pas, un carnet `friends` reste illisible par la RLS du
dépôt, même si le code de la fiche est prêt et testé.

## 2. Surface V2 et accessibilité

- `CarnetScreenV2` transmet désormais `emptyTitle` / `emptyHint` à `CompteMap`.
  Un visiteur d'une trace masquée ne lit plus « Aucun tracé enregistré ».
- `CompteMap` utilise ces textes dans l'état vide **et** dans le texte
  `sr-only` ; le libellé de région devient « Carte du carnet » au lieu de
  « Carte de tes sorties ».
- `authState` de la carte V2 vient de `detail.isOwner` calculé serveur, plus de
  `user ? 'owner' : 'guest'`.
- Le jour actif est rendu en `MultiLineString` à partir des `segments` du jour :
  deux relevés ne sont plus recollés, même pour le propriétaire.
- Les textes d'état vide sont centralisés dans
  `src/features/carnet/detail/traceEmptyState.ts` et partagés par la V2, la
  carte historique et le panneau Parcours.

Fichiers : `src/components/carnet/v2/CarnetScreenV2.tsx`,
`src/components/compte/map/CompteMap.tsx`,
`src/features/compte/map/a11y.ts`,
`src/components/carnet/profile/CarnetMapCard.tsx`,
`src/components/carnet/profile/panes/CarnetParcoursPane.tsx`,
`src/features/carnet/detail/days.ts`, `types.ts`.

## 3. Profil altimétrique multi-segments

- `enrichCarnetElevation` calcule une distance **cumulée monotone** : chaque
  morceau repart de la distance acquise, sans compter le saut qui le sépare du
  précédent.
- Chaque point porte `segmentIndex`. `CarnetAltitude` dessine **un chemin par
  morceau** (`data-altitude-line`), sans relier deux index différents.
- Le total affiché est la somme des longueurs visibles : le dernier point
  porte la distance cumulée de tous les morceaux, sans le vide qui les sépare.

Fichiers : `src/features/carnet/detail/enrichElevation.ts`,
`src/features/carnet/detail/elevationProfile.ts`,
`src/components/carnet/v2/CarnetAltitude.tsx`, `types.ts`.

## 4. Cohérence météo API / drawer

Politique unique `weatherForViewer()` dans
`src/features/compte/server/weather.ts` :

| Lecteur | Visibilité | Météo |
|---|---|---|
| propriétaire / participant | quelle qu'elle soit | exacte, coordonnées comprises |
| visiteur | `public`, `collective_anonymized` | jours + alertes, coordonnées nulles |
| follower vérifié | `friends`, `followers` | jours + alertes, coordonnées nulles |
| visiteur non abonné | `friends`, `followers` | `null` |
| visiteur ou follower non autorisé | `private`, `null`, inconnue | `null` |

`/api/hike-sessions/[id]` ne teste plus `visibility === 'private'` : elle
détermine le rôle réel (propriétaire, participant inscrit, follower vérifié,
visiteur) puis applique `weatherForViewer`. `parseStoredWeather` refuse une
météo malformée. Le drawer utilise la même politique.

Fichiers : `src/features/compte/server/weather.ts`,
`src/features/compte/server/sorties.ts`,
`src/app/api/hike-sessions/[id]/route.ts`.

## Tests représentatifs

Exécutés sans réseau (le setup Vitest `tests/setup/no-network.ts` est actif) :

```bash
npx vitest run \
  src/features/carnet/detail/__tests__ \
  src/components/carnet/v2/__tests__ \
  src/components/carnet/profile/__tests__ \
  src/features/compte/server/__tests__ \
  "src/app/api/hike-sessions/[id]/__tests__" \
  src/features/compte/map/__tests__
```

Le `node_modules` de ce worktree est un lien vers un autre worktree : Vite ne
peut pas y écrire son cache de configuration. La commande a donc été exécutée
avec une configuration locale équivalente à `vitest.config.ts` (mêmes alias,
mêmes exclusions, même setup `no-network`), sans modifier le dépôt.

Résultat : **46 fichiers, 479 tests passés**. `npx tsc --noEmit -p .` passe.
ESLint ciblé : 0 erreur, 5 avertissements préexistants (hooks/imports non
utilisés) sans rapport avec les corrections.

Couverture ajoutée :

- `friends`/`followers` : visiteur non abonné → tout masqué ; follower vérifié →
  extrémités masquées ; participant → trace/météo/notes exactes ; absence de
  suivi → météo `null` ; `mostRestrictiveTraceVisibility()` sans argument →
  `private` ;
- V2 : `emptyTitle`/`emptyHint` transmis, `authState` serveur, jour actif en
  `MultiLineString` ;
- accessibilité : texte `sr-only` réel via `carnetMapSummary` ;
- altitude : distance non décroissante, total sans saut, `segmentIndex`
  conservé, deux chemins SVG ;
- météo API : `null`, `undefined`, `friends`, `followers`, `public`,
  `private`, participant, propriétaire, follower vérifié et non vérifié ;
- jours : `segments` conserve deux relevés distincts.

## Limites et points non couverts

1. **Aucune base, aucune RLS exécutée.** La migration amis est écrite mais non
   appliquée. Les policies de production peuvent différer du dépôt ; la
   vérification devra se faire sur une copie puis en production, avec le
   rollback fourni.
2. **Pas de test Offline/PostgREST direct.** Le masquage est appliqué par
   l'application. La policy historique
   `hike_sessions_select_owner_or_public_carnet` permet encore à un client
   anonyme de lire les lignes de sorties **privées** rattachées à un carnet
   public via PostgREST. Ce point est antérieur, n'était pas l'un des quatre
   constats, et n'est pas corrigé ici : le corriger changerait la fiche
   (perte des métadonnées de la sortie privée) et demande une décision
   produit/RLS. Il reste à traiter séparément si l'on veut une étanchéité au
   niveau ligne.
3. **Pas de build global ni de vérification visuelle.** Les chemins SVG et les
   textes sont testés en jsdom ; le rendu MapLibre réel (WebGL) n'a pas été
   ouvert.
4. **Notes `collective_anonymized`.** Le visiteur d'une sortie explicitement
   collective reçoit encore les notes ; c'est le comportement existant, testé,
   mais il mérite une validation produit. Un follower `friends` ne les reçoit
   pas.
5. **Contrainte `hike_sessions.visibility`.** Le dépôt ne permet que `private`
   et `collective_anonymized`, alors que `can_view_hike_session` gère aussi
   `public`/`followers`. Le code est défensif sur ces valeurs, mais la
   contrainte et la policy ne racontent pas encore la même histoire.

---

## Mise à jour — 2026-11-12

Les deux points restés ouverts (lecture directe des lignes brutes de
`hike_sessions` et frontières des segments dans les jours) sont traités dans
`RAPPORT-RLS-SEGMENTS.md` : migration `20261112121000_carnet_v2_trace_raw_guard`,
lecture service-role de la fiche après contrôle du carnet, autorisation
explicite de `GET /api/hike-sessions/[id]`, et `parseTraceSegments` dans
`buildDays`.

Les constats de sécurité restants (fuite `days`/`segments`/`elevationProfile`,
RLS d'écriture/live du participant de sortie, tests `service_role`, collision
`20261112120000`) sont traités dans `RAPPORT-SERVICE-ROLE-ET-RLS.md`. **Aucune
migration n'a été appliquée ; le registre de production n'a pas été vérifié.**
