# S6.19 — Sécurité du réseau : blocage, signalement, sourdine

Date : 13 novembre 2026.
Branche : `codex/lkdv-p01-social`, tête `a296517`.

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
- `loadModerationState` : lecture réelle des deux orientations de blocage, de
  la sourdine et du suivi, puis application de la politique pure ;
- `loadReseau`, `loadFollowRequests` et `loadCordee` filtrent désormais les
  relations bloquées ; `toggleCordee` refuse l'ajout d'un contact bloqué.

### 3. Routes et client

- `POST/DELETE /api/compte/reseau/block`
- `POST /api/compte/reseau/report`
- `POST/DELETE /api/compte/reseau/mute`
- `GET /api/compte/reseau/moderation?targetId=…`

Toutes passent par `requireUser`, valident l'entrée avec `zod`, ne transmettent
jamais l'acteur et invalident le cache utilisateur après mutation.
`src/features/compte/client/moderationClient.ts` est l'appel commun des écrans ;
aucun composant n'écrit plus directement dans les tables de sécurité.

### 4. Écran

`src/components/ui/ReportBlockModal.tsx` propose trois onglets : **Signaler**,
**Bloquer/Débloquer**, **Sourdine/Réactiver**. Il lit l'état réel à l'ouverture,
affiche un état d'incertitude si la lecture échoue, et ne fabrique plus de
suspension. Les libellés d'action du profil public ont été élargis à la
sécurité complète. Les écrans qui utilisaient déjà cette feuille (profil public,
messagerie, bouteille à la mer) en bénéficient sans nouveau chemin parallèle.

## Dépendances et limites

### Tables et RLS existantes, aucune migration modifiée

| Table | Usage | Contrat existant |
| --- | --- | --- |
| `user_blocks` | blocage/déblocage | `20260830000000_messaging_security_helpers.sql`, policies `*_own` |
| `group_reports` | signalement de profil | table historique, `reported_user_id`, RLS insert/select own |
| `story_hidden_users` | **non utilisée** pour la sourdine du lecteur | direction `owner_id = auteur`, `hidden_user_id = visiteur` ; RLS `owner_id = auth.uid()`. Un lecteur ne peut pas masquer un auteur avec cette table |
| `conversation_members` | sourdine de conversation | `is_muted` (`20260810213000…`), `mute_until` (`20261013110000…`), RLS own |
| `conversations.direct_pair_key` | retrouver la conversation directe | clé `LEAST:GREATEST` posée par la RPC de DM |
| `user_follows`, `follow_requests` | nettoyage du suivi au blocage | RLS own pour le lecteur |
| `group_members` | retrait du membre du groupe au blocage lorsque `groupId` est fourni | policy de gestion existante ; un refus n'annule pas le blocage |

Aucune migration existante n'a été modifiée et aucune migration n'a été créée.

### Limites assumées

1. **Sourdine de contenu non implémentée** : la sourdine livrée est celle de la
   conversation directe existante. Les stories et les publications du fil ne
   sont pas masquées : `story_hidden_users` fonctionne dans l'autre sens
   (l'auteur masque un visiteur) et sa policy interdit au lecteur d'écrire une
   ligne pour un auteur ; aucune table de sourdine par utilisateur n'existe.
   L'écran l'annonce explicitement. Une couverture du fil ou des stories
   exigerait une migration dédiée (`user_mutes` ou équivalent) et son
   application dans les requêtes de feed et `can_view_story`.
2. **Signalement polymorphe** : `group_reports` est la seule table avec
   `reported_user_id`. Les signalements de posts, commentaires et stories
   restent dans leurs tables dédiées. Un modèle unifié demanderait une migration.
3. **Nettoyage du blocage** : le lecteur ne peut supprimer que son propre suivi
   (RLS `follower_id = auth.uid()`). Le suivi inverse reste en base mais est
   filtré des listes ; il ne peut pas être supprimé par le lecteur.
4. **Auto-suspension retirée** : la décision de suspension doit être prise par
   la modération, pas par le navigateur du signalant. Aucun traitement
   automatique n'est revendiqué ici.
5. **Écran Réseau** : les lignes du runtime Compte ouvrent toujours la fiche
   profil (`/profil/[handle]`), où la feuille de sécurité est disponible. Le
   menu direct de chaque ligne n'a pas été ajouté dans cette tranche pour ne pas
   toucher au runtime généré ; la fonction est accessible en deux gestes.
6. **Vérification** : conformément à la consigne, aucun test, suite, build,
   lint ni `tsc` n'a été lancé. Aucune preuve d'exécution n'est donc fournie.

## Fichiers touchés

- `src/features/compte/domain/relationshipPolicy.ts` (nouveau)
- `src/features/compte/domain/reportCategories.ts` (nouveau)
- `src/features/compte/server/reseau.ts`
- `src/features/compte/client/moderationClient.ts` (nouveau)
- `src/app/api/compte/reseau/block/route.ts` (nouveau)
- `src/app/api/compte/reseau/report/route.ts` (nouveau)
- `src/app/api/compte/reseau/mute/route.ts` (nouveau)
- `src/app/api/compte/reseau/moderation/route.ts` (nouveau)
- `src/app/api/compte/reseau/cordee/route.ts`
- `src/components/ui/ReportBlockModal.tsx`
- `src/app/profil/[id]/page.tsx`
- `src/components/profile/PublicProfileV2.tsx`
- `src/components/profile/PublicMobileProfileView.tsx`
