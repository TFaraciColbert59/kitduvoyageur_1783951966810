# Audit des données du Compte — fin des mocks

Date : 21 octobre 2026.

## Principe

- **Compte connecté** : toutes les listes et tous les compteurs viennent de Supabase ou sont vides. Aucun repli vers une donnée de démonstration.
- **Compte visiteur** : l’aperçu de démonstration reste volontairement alimenté par les constantes `DEMO_*` du composant et les `_MOCK_*` du runtime.
- Un tableau vide côté serveur remplace désormais le tableau de démonstration, au lieu de le conserver.

## Sources réelles branchées

| Surface | Source réelle |
| --- | --- |
| Profil, bio, avatar, crédit | `user_profiles`, `reward_accounts` |
| Publications / grille | `community_posts` (`author_id = utilisateur`) |
| Sorties, kilomètres, dénivelé | `hike_sessions` + `hiking_routes` |
| Matériel / inventaire | `product_ownership` |
| Kits et lignées | `materiel_kits` + `materiel_kit_items` |
| Commandes | `orders` |
| Notifications | `notifications` |
| Abonnés | `user_follows` (`following_id = utilisateur`) + `public_profiles` |
| Abonnements / tribu | `user_follows` (`follower_id = utilisateur`) + `public_profiles` |
| Clubs | `club_members` + `clubs` |
| Stories à la une | `post_stories` (URL média contrôlée `/api/stories/:id/media`) |
| Espèces / herbier | aucune table réelle : liste vide explicite |
| Massifs personnels | aucune coordonnée réelle dans les sessions actuelles : liste vide explicite |

## Mocks supprimés du chemin connecté

- Repli `OUTINGS.length ? OUTINGS : _MOCK_OUTINGS` dans l’onglet Sorties, le drawer de sortie et les actions `openOutingDrawer` / `focusOuting`.
- Fausses photos Unsplash du drawer de sortie : seules les photos réelles de la sortie sont affichées, sinon état vide.
- Fausses listes d’abonnés / abonnements (`Léa Morel`, etc.) : listes `FOLLOWERS` / `FOLLOWING` réelles, état vide sinon.
- Faux profils de `user_profile_preview` : profil réel s’il est connu, sinon fiche neutre sans statistiques inventées.
- Faux totaux « 194 reprises », « 91 % », « 42,50 € » des kits : valeurs calculées depuis les kits réels ou zéro.
- Fausses séries `END12`, `TEMP12`, `TRIBU_MASS` : supprimées. La chronologie 12 mois est recalculée depuis `hike_sessions.started_at`.
- Faux événements `EVENTS` : recalculés depuis les sorties réelles.
- Repli `S.massifs` de démonstration : remplacé par la liste réelle (actuellement vide, faute de coordonnées dans les sessions).
- Herbier de démonstration : remplacé par la liste réelle (actuellement vide, faute de table d’observations).

## Actions reliées

- `toggleFollowUser` écrit/supprime désormais la ligne `user_follows` correspondante, au lieu d’un simple toast local.

## Limites connues

- Aucune table d’espèces ni d’observations naturalistes : l’herbier ne peut pas être alimenté pour l’instant.
- Les sessions `hike_sessions` actuelles n’ont ni `positions_timed` ni `positions_geojson` exploitables : la carte ne peut pas déduire de massifs personnels.
- Les photos de sortie (`hike_session_photos`) sont vides aujourd’hui ; le drawer affiche un état vide et non des photos d’illustration.
- Les colonnes d’endurance et de part créateur des kits ne sont pas stockées dans `materiel_kits` : l’interface affiche 0 au lieu d’une valeur inventée.
