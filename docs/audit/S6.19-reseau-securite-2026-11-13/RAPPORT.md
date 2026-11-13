# S6.19 — Sécurité du réseau : blocage, signalement, sourdine

Date : 13 novembre 2026.
Branche : `codex/lkdv-p01-social`, tête de la première tranche `a296517`,
complément appliqué depuis `2aaf533`.

## Fiche source et constat

La fiche S6.19 du lot P01 (audit du 11 novembre, ligne `S6.19`) classait la
tranche **partielle** :

- blocage et signalement existaient dans `ReportBlockModal`, mais par écriture
  directe du navigateur dans `group_reports` et `user_blocks` ;
- un `user_profiles.update({ is_suspended_groups: true })` était tenté depuis
  le client pour les motifs graves, sans preuve de droit ni transaction ;
- la sourdine n'existait que par conversation (`conversation_members.is_muted`,
  `mute_until`) ;
- aucune sourdine de contenu par utilisateur, aucun service réseau commun,
  aucun filtre de blocage dans les listes d'abonnés/demandes/cordée.

## Comportements livrés

### 1. Politique pure de relation

`src/features/compte/domain/relationshipPolicy.ts` décide les actions
autorisées à partir de faits observés : blocage dans un sens ou l'autre,
sourdine de conversation, état de suivi, date et statut de la dernière
demande. Précédence : blocage > sourdine ; le signalement reste possible hors
de son propre profil. Une retenue de 24 h après un refus de demande de suivi
est calculée (`readFollowCooldown`) sans écriture.

`src/features/compte/domain/reportCategories.ts` ferme le catalogue des motifs :
le client n'envoie qu'un identifiant, le serveur choisit le libellé et la
sévérité.

### 2. Service réseau

`src/features/compte/server/reseau.ts` reçoit :

- `blockUser` : insertion idempotente dans `user_blocks`, retrait du suivi
  initié par le lecteur et de sa demande pending/accepted ;
- `unblockUser` : suppression du blocage du lecteur ;
- `reportUser` : insertion dans `group_reports`, anti-doublon sur un
  signalement pending du même lecteur vers la même cible, motif résolu côté
  serveur, aucune auto-suspension ;
- `muteUser` / `unmuteUser` : coupure des notifications de la conversation
  directe existante (`conversation_members.is_muted`, `mute_until`). Sans
  conversation directe, la route répond « aucune conversation à mettre en
  sourdine » plutôt que de simuler un état ;
- `muteContentUser` / `unmuteContentUser` : sourdine de contenu privée dans
  `user_content_mutes`. Elle masque les publications de fil et les stories,
  sans blocage, sans retrait du suivi et sans toucher à la conversation ;
- `loadModerationState` : lecture réelle des deux orientations de blocage, des
  **deux** sourdines (contenu et conversation), de la présence d'une
  conversation directe et du suivi, puis application de la politique pure ;
- `loadReseau`, `loadFollowRequests` et `loadCordee` filtrent désormais les
  relations bloquées ; `toggleCordee` refuse l'ajout d'un contact bloqué.

### 3. Routes et client

- `POST/DELETE /api/compte/reseau/block`
- `POST /api/compte/reseau/report`
- `POST/DELETE /api/compte/reseau/mute` (conversation)
- `POST/DELETE /api/compte/reseau/content-mute` (contenus)
- `GET /api/compte/reseau/moderation?targetId=…`

Toutes passent par `requireUser`, valident l'entrée avec `zod`, ne transmettent
jamais l'acteur et invalident le cache utilisateur après mutation.
`src/features/compte/client/moderationClient.ts` est l'appel commun des écrans ;
aucun composant n'écrit plus directement dans les tables de sécurité.

### 4. Écran

`src/components/ui/ReportBlockModal.tsx` propose trois onglets : **Signaler**,
**Bloquer/Débloquer**, **Sourdine/Réactiver**. L'onglet Sourdine expose deux
réglages distincts : **Sourdine de contenu** (publications de fil et stories) et
**Sourdine de conversation** (notifications de la conversation directe). Il lit
l'état réel à l'ouverture, affiche un état d'incertitude si la lecture échoue,
et ne fabrique plus de suspension. Les libellés d'action du profil public ont
été élargis à la sécurité complète. Les écrans qui utilisaient déjà cette
feuille (profil public, messagerie, bouteille à la mer) en bénéficient sans
nouveau chemin parallèle.

### 5. Sourdine de contenu des comptes suivis

La sourdine de contenu est volontairement séparée des deux mécanismes voisins :

| Mécanisme | Table / source | Effet | Révocation |
| --- | --- | --- | --- |
| Blocage | `user_blocks` | retire le suivi, masque le profil et les contenus, empêche le contact | `unblockUser` |
| Sourdine de conversation | `conversation_members.is_muted` | coupe les notifications d'une conversation directe existante | `unmuteUser` |
| Sourdine de contenu | `user_content_mutes` | masque les publications de fil et les stories, **conserve le suivi et la conversation** | `unmuteContentUser` |

La sourdine de contenu est posable sur un **compte suivi** : l'insertion RLS
vérifie `user_follows`, et l'écran ne propose l'action que dans ce cas. Elle ne
remplace donc pas le blocage pour un compte non suivi ; elle sert précisément à
rester abonné tout en masquant les contenus.

La migration `20261113125000_user_content_mutes.sql` est additive et privée :

- table `public.user_content_mutes (muter_id, muted_id, created_at)`, clé
  primaire `(muter_id, muted_id)`, contrainte anti-auto-sourdine, clés
  étrangères vers `auth.users` en `ON DELETE CASCADE` ;
- RLS `select`/`insert`/`delete` limitée à `muter_id = auth.uid()` ; l'insertion
  exige en plus une ligne `user_follows` réelle (la sourdine sert à rester
  abonné), aucune policy `update`, aucune lecture pour la cible, aucun grant
  `anon` ;
- fonction `viewer_mutes_author(uuid)` en `security definer`, `search_path`
  verrouillé, qui ne lit que le mute du porteur du JWT ; helper
  `viewer_mutes_highlight(uuid)` pour les albums, avec le même contrat ;
- policies **RESTRICTIVES** `community_posts_not_content_muted`,
  `story_highlights_not_content_muted` et
  `story_highlight_items_not_content_muted` : elles s'ajoutent en ET aux
  policies existantes, sans les supprimer ni élargir un droit ;
- `can_view_story` remplacé à signature identique pour appliquer la même règle
  aux stories, à leurs médias et aux vues/likes qui dépendent de cette fonction.
  La branche auteur reste prioritaire : chacun voit toujours ses propres
  stories. La vérification du mute n'est faite que si `p_viewer = auth.uid()`,
  afin qu'un appel direct avec l'identifiant d'un autre lecteur ne divulgue pas
  ses préférences.

Les surfaces réelles sont branchées par l'autorisation, pas par un filtre
client : `useCommunityFeed`, la grille de profil, la recherche, les reels et les
panneaux de club lisent `community_posts` sous la policy restrictive ;
`CommunityStoriesBar`, les albums À la une, le lecteur de stories et
`/api/stories/[id]/media` lisent `post_stories` sous `can_view_story`. Les
commentaires et likes d'une publication masquée disparaissent avec elle, car
leurs policies dépendent de la visibilité du post.

La révocation est immédiate : `DELETE /api/compte/reseau/content-mute` supprime
la ligne, invalide le cache utilisateur, et la policy redevient vraie sans
attente. Un blocage reste prioritaire et masque déjà les contenus ; la sourdine
de contenu n'est pas nécessaire pour bloquer.

## Dépendances et limites

### Tables et RLS

| Table | Usage | Contrat |
| --- | --- | --- |
| `user_blocks` | blocage/déblocage | `20260830000000_messaging_security_helpers.sql`, policies `*_own` |
| `group_reports` | signalement de profil | table historique, `reported_user_id`, RLS insert/select own |
| `story_hidden_users` | **non utilisée** pour la sourdine du lecteur | direction `owner_id = auteur`, `hidden_user_id = visiteur` ; RLS `owner_id = auth.uid()`. Un lecteur ne peut pas masquer un auteur avec cette table |
| `conversation_members` | sourdine de conversation | `is_muted` (`20260810213000…`), `mute_until` (`20261013110000…`), RLS own |
| `user_content_mutes` | **sourdine de contenu** | `20261113125000_user_content_mutes.sql`, clé `(muter_id, muted_id)`, RLS own-only, aucune lecture par la cible |
| `conversations.direct_pair_key` | retrouver la conversation directe | clé `LEAST:GREATEST` posée par la RPC de DM |
| `user_follows`, `follow_requests` | nettoyage du suivi au blocage | RLS own pour le lecteur |
| `group_members` | retrait du membre du groupe au blocage lorsque `groupId` est fourni | policy de gestion existante ; un refus n'annule pas le blocage |

Aucune migration existante n'a été modifiée. La seule migration nouvelle est
`20261113125000_user_content_mutes.sql` (additive, privée, avec son down dans
`supabase/migrations_down/`).

### Limites assumées

1. **Périmètre de la sourdine de contenu** : elle couvre les publications de
   `community_posts` et les stories de `post_stories` (donc aussi les vues,
   likes, albums À la une et médias qui en dépendent). Elle ne masque pas les
   carnets, clubs, événements, sorties, commentaires de carnet ni messages, ni
   les commentaires que l'auteur masqué écrit sous les publications d'autres
   personnes. Ces surfaces ont leurs propres policies et demanderaient une
   décision produit distincte ; la sourdine ne prétend pas les couvrir.
2. **Pas d'expiration ni de liste de gestion en masse** : la sourdine reste
   active jusqu'à sa révocation explicite ou la suppression du compte. Aucun
   écran « comptes masqués » n'est ajouté ; la révocation se fait depuis la
   fiche du compte concerné. Une expiration ou une liste centralisée serait une
   évolution additive séparée.
3. **Signalement polymorphe** : `group_reports` est la seule table avec
   `reported_user_id`. Les signalements de posts, commentaires et stories
   restent dans leurs tables dédiées. Un modèle unifié demanderait une migration.
4. **Nettoyage du blocage** : le lecteur ne peut supprimer que son propre suivi
   (RLS `follower_id = auth.uid()`). Le suivi inverse reste en base mais est
   filtré des listes ; il ne peut pas être supprimé par le lecteur.
5. **Auto-suspension retirée** : la décision de suspension doit être prise par
   la modération, pas par le navigateur du signalant. Aucun traitement
   automatique n'est revendiqué ici.
6. **Écran Réseau** : les lignes du runtime Compte ouvrent toujours la fiche
   profil (`/profil/[handle]`), où la feuille de sécurité est disponible. Le
   menu direct de chaque ligne n'a pas été ajouté dans cette tranche pour ne pas
   toucher au runtime généré ; la fonction est accessible en deux gestes.
7. **Vérification** : conformément à la consigne, aucun test, suite, build,
   lint ni `tsc` n'a été lancé avant la fin de la tranche. Les commandes
   exécutées à la clôture sont consignées en fin de document.

## Fichiers touchés

- `src/features/compte/domain/relationshipPolicy.ts` (nouveau)
- `src/features/compte/domain/reportCategories.ts` (nouveau)
- `src/features/compte/server/reseau.ts`
- `src/features/compte/client/moderationClient.ts` (nouveau)
- `src/app/api/compte/reseau/block/route.ts` (nouveau)
- `src/app/api/compte/reseau/report/route.ts` (nouveau)
- `src/app/api/compte/reseau/mute/route.ts` (nouveau)
- `src/app/api/compte/reseau/content-mute/route.ts` (nouveau, sourdine de contenu)
- `src/app/api/compte/reseau/moderation/route.ts` (nouveau)
- `src/app/api/compte/reseau/cordee/route.ts`
- `src/components/ui/ReportBlockModal.tsx`
- `src/app/profil/[id]/page.tsx`
- `src/components/profile/PublicProfileV2.tsx`
- `src/components/profile/PublicMobileProfileView.tsx`
- `src/features/community/feed/useCommunityFeed.ts` (commentaire d'autorisation)
- `src/components/communaute/CommunityStoriesBar.tsx` (commentaire d'autorisation)
- `supabase/migrations/20261113125000_user_content_mutes.sql` (nouveau)
- `supabase/migrations_down/20261113125000_user_content_mutes.down.sql` (nouveau)
- `docs/audit/S6.19-reseau-securite-2026-11-13/SOURDINE-CONTENU.md` (nouveau)

## RGPD et limites détaillées

La fiche `SOURDINE-CONTENU.md`, dans ce même dossier, détaille les données
stockées, la base légale, la rétention, l'accès, l'effacement, la portabilité
et les limites fonctionnelles. En résumé : deux identifiants et un horodatage,
RLS own-only, aucune notification à la personne masquée, révocation immédiate,
suppression en cascade avec le compte.

## Vérification

Conformément à la consigne, aucun test, suite, build, lint ni `tsc` n'a été
lancé avant la clôture de la tranche. Les commandes exécutées à la fin sont
consignées ci-dessous.

```bash
./node_modules/.bin/tsc --noEmit -p .
# exit 0

./node_modules/.bin/vitest run \
  src/features/compte/domain/__tests__/relationshipPolicy.test.ts \
  src/features/compte/server/__tests__/reseauContentMute.test.ts \
  src/features/compte/server/__tests__/reseauContentMuteMigration.test.ts \
  src/features/compte/server/__tests__/reseau.test.ts \
  src/features/compte/server/__tests__/reseauMigration.test.ts --reporter=dot
# 5 fichiers, 45 tests passés

./node_modules/.bin/vitest run src/features/compte src/app/profil --reporter=dot
# 18 fichiers, 173 tests passés

./node_modules/.bin/eslint <fichiers modifiés>
# 0 erreur, 3 avertissements préexistants (deps de hooks, directive inutilisée)
```

Le passage plus large `src/features/compte src/components/compte src/app/profil`
a laissé deux échecs déjà documentés comme instables dans
`docs/cleanup/CI_FAILURES.md` (`ProfileDrawerBootstrap`, `CompteOverlayHost`) ;
`CompteOverlayHost` passe seul, `ProfileDrawerBootstrap` échoue aussi seul sur
une attente de coquille sans lien avec cette tranche. Aucun fichier de ce
périmètre n'a été modifié ici. La migration n'a pas été appliquée à une base
(consigne : pas de production) ; sa validation réelle reste à faire en
préproduction avec les tests pgTAP.
