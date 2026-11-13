# S6.19 — Sourdine de contenu : RGPD et limites

Date : 13 novembre 2026.
Complément de `RAPPORT.md` (même dossier), appliqué depuis `2aaf533`.
Migration : `supabase/migrations/20261113125000_user_content_mutes.sql`.
Down : `supabase/migrations_down/20261113125000_user_content_mutes.down.sql`.

## Ce qui est stocké

`public.user_content_mutes` contient exactement trois colonnes :

| Colonne | Nature | Finalité |
| --- | --- | --- |
| `muter_id` | identifiant du lecteur | savoir à qui appartient la préférence |
| `muted_id` | identifiant du compte masqué | savoir quels contenus masquer |
| `created_at` | horodatage | dater la préférence, sans historique |

Aucun texte, aucune image, aucune raison, aucune origine, aucune donnée de
navigation, aucune adresse IP et aucun identifiant d'appareil ne sont ajoutés.
La table ne contient pas de contenu et ne permet pas de profiler les goûts :
elle répond uniquement à « ce lecteur a-t-il masqué cet auteur ? ».

La sourdine n'est **posable que sur un compte réellement suivi** : la policy
d'insertion exige une ligne `user_follows (follower_id = auth.uid(),
following_id = muted_id)`. C'est la définition produit : rester abonné tout en
masquant les publications et stories. La révocation reste possible même après
un désabonnement, pour ne pas laisser une ligne impossible à supprimer.

## Base légale et transparence

La sourdine est une **préférence de lecture** demandée par la personne
elle-même, au même titre que le blocage ou la coupure des notifications. Elle
s'appuie sur l'exécution de la relation contractuelle / l'intérêt légitime à
maîtriser son fil, sans décision automatisée et sans profilage publicitaire.

- La personne qui l'active la voit dans l'onglet **Sourdine** de la feuille de
  sécurité.
- La personne masquée **n'est pas notifiée** et ne peut pas lire la ligne :
  aucune policy de lecture ne la concerne, aucun compteur, aucun badge, aucun
  événement ne lui est exposé.
- Aucun état « masqué » n'est renvoyé dans le fil ou les stories : le contenu
  est simplement absent, comme un contenu expiré ou non visible. L'absence est
  indistinguable d'une absence ordinaire.
- La fonction `viewer_mutes_author` ne prend que l'auteur et utilise
  `auth.uid()` : un appelant ne peut pas sonder la sourdine d'un autre lecteur.
  `can_view_story` ne consulte le mute que si `p_viewer = auth.uid()` ; un appel
  direct avec l'identifiant d'un tiers ne révèle pas ses préférences.

## Rétention, accès et effacement

- **Conservation** : jusqu'à la révocation explicite (suppression de la ligne)
  ou la suppression du compte, via `ON DELETE CASCADE` sur `auth.users`.
  Aucune durée d'expiration arbitraire n'est ajoutée, car la préférence reste
  utile tant que le compte existe.
- **Révocation** : `DELETE /api/compte/reseau/content-mute` supprime la ligne
  immédiatement ; la policy de fil et `can_view_story` redeviennent vraies au
  prochain chargement. Le cache utilisateur est invalidé.
- **Droit d'accès** : l'état est visible dans la feuille de sécurité (et
  l'API `GET /api/compte/reseau/moderation` pour le compte connecté).
- **Droit à l'effacement** : la suppression du compte emporte les lignes dont
  la personne est `muter_id` ou `muted_id`. Aucun journal de sourdine n'est
  conservé séparément.
- **Portabilité** : la table n'est pas encore incluse dans un export RGPD
  exhaustif. C'est une limite connue, pas une prétention de conformité
  complète ; l'ajout à l'export devra être fait avec les autres préférences
  sociales.

## Limites fonctionnelles assumées

1. **Périmètre** : publications de `community_posts` et stories de
   `post_stories` (avec leurs médias, vues, likes et albums À la une). Les
   carnets, clubs, événements, sorties, messages et commentaires de carnet ne
   sont pas masqués par cette table ; ils ont leurs propres policies. La
   sourdine n'est posable que sur un compte **suivi** (RLS `user_follows`) : un
   compte public non suivi ne peut pas être masqué par cette table.
2. **Pas d'expiration** : la sourdine ne s'éteint pas toute seule. Une durée
   (7 jours, 30 jours…) serait une évolution produit distincte.
3. **Pas de liste centralisée** : la révocation se fait depuis la fiche du
   compte concerné. Un écran « comptes masqués » n'est pas ajouté.
4. **Pas de blocage déguisé** : la sourdine ne retire pas le suivi, ne modifie
   pas `user_follows`, ne coupe pas la conversation et n'empêche pas le
   signalement. Un blocage reste nécessaire pour empêcher le contact.
5. **Blocage prioritaire** : si un blocage existe dans un sens ou l'autre, les
   contenus sont déjà masqués. La sourdine de contenu peut rester en base ; elle
   ne rouvre aucun accès. L'UI empêche de la poser tant que le blocage est
   actif, mais autorise sa révocation.
6. **Feed et pagination** : le filtre est appliqué par la RLS avant `limit`, donc
   une page peut contenir moins de dix publications sans que `hasMore` soit
   faux à tort. En revanche, si tous les auteurs visibles sont masqués, le fil
   affiche son état vide ordinaire (« Le fil est calme ») ; aucun message ne
   révèle la cause.
7. **Stories** : une story masquée n'apparaît ni dans le rail, ni dans le
   lecteur, ni dans les albums À la une. Un accès direct au média renvoie le
   même 404 que pour une story invisible. L'auteur continue de voir ses propres
   stories et ses archives.
8. **Introspection serveur** : `can_view_story` reste appelable avec un
   `p_viewer` arbitraire pour les usages historiques (RLS, tests pgTAP), mais
   la branche mute est neutralisée si `p_viewer` n'est pas le porteur du JWT.
   Un outil d'administration qui voudrait connaître l'effet d'une sourdine pour
   un autre compte devrait passer par une requête dédiée, pas par cette
   fonction.
9. **Commentaires et interactions** : la sourdine masque les publications et
   stories de l'auteur, pas ses commentaires sous les publications d'autres
   personnes ni ses likes. Un masquage des commentaires serait un réglage
   distinct.
10. **Vérification** : `tsc` à 0 erreur, 45 tests ciblés et 173 tests
   `src/features/compte` + `src/app/profil` passés, lint sans erreur. Aucun
   build global ni aucune application de la migration à une base réelle ; la
   validation pgTAP reste à faire en préproduction. Le détail et les deux
   échecs instables préexistants sont consignés dans `RAPPORT.md`.

## Surface technique

- Table privée : `public.user_content_mutes` (RLS own-only, aucun `anon`).
  L'insertion exige une ligne `user_follows` réelle (`follower_id = auth.uid()`,
  `following_id = muted_id`) : la sourdine ne se pose que sur un compte suivi.
- Helper : `public.viewer_mutes_author(uuid)` (`security definer`,
  `search_path = public, pg_temp`, `EXECUTE` réservé à `authenticated`).
- Helper albums : `public.viewer_mutes_highlight(uuid)`, même contrat, pour
  éviter que la RLS de `story_highlights` ne rende la sous-requête vide.
- Policy restrictive : `community_posts_not_content_muted` sur
  `public.community_posts` (`AS RESTRICTIVE`, rôle `authenticated`), plus
  `story_highlights_not_content_muted` et
  `story_highlight_items_not_content_muted` sur les albums À la une.
- Autorisation stories : `public.can_view_story(uuid, uuid)` remplacée à
  signature identique, avec la branche auteur prioritaire.
- Service : `muteContentUser` / `unmuteContentUser` dans
  `src/features/compte/server/reseau.ts`.
- Route : `POST/DELETE /api/compte/reseau/content-mute`.
- Client : `muteContentUser` / `unmuteContentUser` dans
  `src/features/compte/client/moderationClient.ts`.
- Écran : `ReportBlockModal`, onglet Sourdine, deux réglages séparés.
