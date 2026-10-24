# Compte — actions des posts, drawers et notifications

**Date :** 2026-10-23
**Statut :** design validé par l’utilisateur — spec à relire avant plan d’implémentation
**Périmètre :** `/compte` et les composants partagés avec le feed `/communaute` :
actions des publications, navigation par gestes, sous-drawers du profil,
création de contenu, notifications, formatage des nombres et design system
des drawers. Aucun code n’est écrit dans ce document.

---

## 1. Problème constaté

### 1.1 Les actions du post `/compte` sont une maquette

Le post ouvert depuis la grille de `/compte` est rendu par le runtime vanilla
`compte-liquid-glass-v8-runtime.js` (`post_modal_instagram`). Il n’utilise pas
`CommunityPostCard`, qui est pourtant la surface réelle du feed.

| Action | Constat |
|---|---|
| Like | État local `X.postLikes`, valeur par défaut `likes_count`, aucun appel réseau. |
| Enregistrer | État local `X.postSaves`, jamais initialisé depuis `post_saves`. |
| Signaler le post | Toast + `notifyHostAction('reportPost')`, aucune branche hôte, aucune écriture. |
| Copier le lien | URL `${origin}/carnets/${realId}` alors que `realId` est un UUID de `community_posts` → « Carnet introuvable ». |
| Republier | Ouvre le partage interne ; `/api/compte/repost` existe mais n’est appelé nulle part. |
| Commentaires | L’ouverture charge l’API mais ferme le post et remet `activePostId` à `null` ; like, réponse et signalement de commentaire sortent silencieusement. |
| Média | `mapPosts` calcule `mediaCount` mais ne transmet jamais `image_url`/`media_urls` ; la grille affiche des visuels générés. |
| Auteur / lieu | L’auteur affiché est le profil courant ; la localisation est codée en dur. |
| Suppression | Aucun bouton, aucune route. |
| Gestes | Aucun swipe horizontal entre post, commentaires et partage. |

La base contient pourtant de vraies données pour le compte démo : 16 posts,
361 likes reçus, 54 commentaires, 72 saves reçus.

### 1.2 Les sous-drawers ne sont pas homogènes

- `BadgeTile` est un `div` sans handler : cliquer un trophée ne fait rien.
- `GearRow` est un `li` sans handler : cliquer un produit ne fait rien.
- `KitCard` ouvre un panneau inline, pas un sous-drawer.
- Le drawer « Empreinte » est une feuille vanilla `seal` sans header, sans flow,
  avec un faux radar à branches constantes et une matrice `.vm` détournée.
- Le drawer de confiance est une lentille `TrustCard` : titre 16 px, valeurs
  22 px, « Pas encore noté » sur trois lignes.
- Le drawer de création ouvre un menu mais **aucune option ne reste sur
  `/compte`** : carnet, voyage, kit et club font `router.push`.
- Le drawer Compte force une hauteur de 684 px ; les autres feuilles restent à
  la taille de la carte (541 px), avec 150–220 px de verre vide.

### 1.3 Les notifications sont noyées et mal classées

- 4 913 des 4 966 notifications (98,9 %) sont `group='system'`, valeur par défaut
  jamais écrite par les triggers.
- 47 des 80 lignes chargées par le drawer sont des messages privés.
- 13 des 18 non-lues du compte démo sont des messages.
- Les messages ont déjà leur propre compteur (`conversation_members.unread_count`)
  et leur propre lecture ; le drawer d’activité crée un second badge incohérent.
- Aucun émetteur pour follow, commande, prêt, badge, défi ou système : ces types
  n’existent que dans le seed.
- Aucune policy `INSERT` sur `notifications` : les inserts client de demandes de
  groupe et de signalements échouent silencieusement.
- Le badge non lu est calculé sur les 80 lignes chargées, pas sur la table.
- Plusieurs liens stockés sont morts : `/groupes/*`, `/compte?tab=prets`,
  `/alertes`.

### 1.4 Le design system des drawers est éclaté

- Six échelles de hauteur (48, 44, 36, 34, 30, 25).
- Trois grammaires de shell : feuille verre sans titre, drawer React avec
  capsule 48, dialog natif opaque avec titres 20–22.
- Trois échelles de switch (46×28, 42×25, 48×44).
- Cinq échelles de titres, quatre échelles de KPI.
- Les nombres sont formatés différemment : `64.5 km`, `64,5 km`, `3 860 m`,
  `3,9 k m D+`, `${dplus}` brut.
- Les tuiles trophée/produit ont un `cursor:pointer` hérité mais sont inertes.

---

## 2. Décisions de conception

### 2.1 Architecture retenue : pile d’overlays React

Un seul `CompteOverlayHost` est monté dans `CompteLiquidGlassV8`, **hors de
`#sheet`**, dans un nœud `#lkdv-compte-overlay-root` ajouté à `#phone`.

Il gère une pile d’écrans :

```ts
type CreateType = 'post' | 'story' | 'carnet' | 'kit' | 'club' | 'trip';

type CompteOverlay =
  | { kind: 'post'; postId: string; pane?: 'post' | 'comments' | 'share'; commentId?: string }
  | { kind: 'saved' }
  | { kind: 'badge'; badgeId: string }
  | { kind: 'gear'; gearId: string }
  | { kind: 'seal' }
  | { kind: 'trust' }
  | { kind: 'profile'; userId: string }
  | { kind: 'create'; type?: CreateType };
```

Le runtime ne dessine plus ces écrans : il émet des événements
(`openPost`, `openSeal`, `openCreate`, `openBadge`, `openSaved`, `openGear`).
L’hôte React ouvre l’overlay, empile, dépile et restaure le focus.

Pourquoi hors de `#sheet` : `renderSheet` réécrit `#sheet.innerHTML` à chaque
rendu ; tout état React placé dedans est détruit. Le nœud d’overlay n’est jamais
touché par le runtime.

### 2.2 Navigation et gestes

- Un seul overlay visible à la fois ; les sous-drawers s’empilent.
- `Escape`, bouton retour et swipe-down ferment l’écran courant.
- Fermer un sous-drawer rend le focus à son déclencheur.
- Aucun `router.push` pour ouvrir un sous-drawer, un trophée, un produit, un
  enregistrement ou un formulaire de création.
- Les liens de notification ouvrent l’overlay correspondant quand il existe ;
  sinon ils utilisent une route interne valide.

### 2.3 Design system unique et compact

Un fichier `src/components/compte/overlay/compte-overlay.css` définit :

| Token | Valeur |
|---|---|
| `--lkdv-overlay-z` | 1200 |
| `--lkdv-overlay-z-nested` | 1300 |
| `--lkdv-sheet-max-h` | `min(92dvh, 820px)` |
| `--lkdv-control-h` | 36 px (principal) |
| `--lkdv-control-h-sm` | 34 px (secondaire) |
| `--lkdv-control-h-xs` | 30 px (lentille / icône) |
| `--lkdv-touch-target` | 44 px (pseudo-élément) |
| `--lkdv-toggle-w` | 42 px |
| `--lkdv-toggle-h` | 25 px |
| `--lkdv-title-size` | 15 px |
| `--lkdv-body-size` | 12,5 px |
| `--lkdv-caption-size` | 10,5 px |
| `--lkdv-glass-bg` | gradient blanc 0.486 / 0.325 / 0.404 |
| `--lkdv-glass-blur` | `blur(4px) saturate(1.9) brightness(1.07)` |

Règles :
- Une seule échelle visuelle : 36 px pour les actions principales, 34 px pour
  les secondaires, 30 px pour les lentilles. La cible tactile de 44 px est
  obtenue par pseudo-élément, pas par la hauteur visuelle.
- Les boutons 44 px existants (`.lkdv-vitrine-vis`, `.lkdv-badge-toggle`,
  `.lkdv-vitrine-cta`, `.lkdv-repost-original`, `.lkdv-loan-action`,
  `.lkdv-loan-star`, `.lkdv-kit-act`, `.lkdv-comm-toggle`, `.lkdv-comm-link`,
  `.lkdv-club-btn`) passent à 34–36 px visuels.
- Les switches passent à 42×25 px, avec un knob de 19 px.
- Les capsules et tabs passent à 36 px, sauf la bottom bar qui reste à 48 px.
- Les feuilles ont un header visible de 44 px, un flow de 36 px et un footer
  optionnel. La hauteur est intrinsèque, plafonnée à `min(92dvh, 820px)`.

### 2.4 Formatage des nombres

Un module partagé `src/lib/format/metrics.ts` expose :

```ts
formatNumber(value: number): string;          // 1 234
formatKm(value: number): string;              // 339 km / 12,2 km
formatElevation(value: number): string;       // 950 m / 2,2 k m / 12,9 k m
formatElevationCompact(value: number): string; // 950 m / 2,2 k / 12,9 k
formatCount(value: number): string;           // 2 / 12,9 k
```

Règles :
- locale `fr-FR`, virgule décimale ;
- `1 000 ≤ valeur < 10 000` → une décimale (`2,2 k`, `3,9 k`) ;
- `valeur ≥ 10 000` → une décimale maximum (`12,9 k`) ;
- jamais de `k` collé à `m` sans espace : `12,9 k m` ;
- les valeurs exactes restent disponibles dans les fiches détaillées.

Application : bio du profil, mini-carte, KPI, Vitrine, OutingCard, OutingSummary,
callout carte, partage de sortie, sceau, trust, badges.

---

## 3. Actions des publications

### 3.1 Surface et source de vérité

Deux surfaces partagent la même couche de domaine, mais gardent leur rendu :

| Surface | Rendu | Source |
|---|---|---|
| `/compte` | `PostDrawer` React (overlay) | Supabase direct + APIs |
| `/communaute` | `CommunityPostCard` existante | Supabase direct + APIs |

Les hooks et mutations vivent dans
`src/features/community/posts/` :

- `queries.ts` : `fetchPostDetail`, `fetchPostComments`, `fetchSavedPosts`,
  `fetchShareTargets` ;
- `mutations.ts` : `toggleLike`, `toggleSave`, `createComment`, `updateComment`,
  `deleteComment`, `toggleCommentLike`, `reportPost`, `reportComment`,
  `repost`, `deletePost`, `shareToConversation`, `copyPostLink` ;
- `types.ts` : `PostDetail`, `PostComment`, `PostSummary`, `PostReportReason`,
  `ShareTarget`.

Toute mutation est optimiste avec rollback sur erreur, et invalide les compteurs
réels. Aucune valeur `64` par défaut.

### 3.2 Matrice des actions

| Action | Comportement cible | Persistance |
|---|---|---|
| Like / unlike | Cœur animé, compteur immédiat, rollback si refus | RPC `toggle_community_post_like` ; `post_likes` |
| Double-tap média | Like si non aimé, cœur animé, jamais d’unlike | Même RPC |
| Enregistrer / retirer | Signet, toast, état chargé au démarrage | `post_saves` |
| Ouvrir commentaires | Swipe vers la droite + focus composer | `post_comments` |
| Publier commentaire | Optimiste + réconciliation d’ID | `post_comments` |
| Répondre | `parent_id`, affichage imbriqué | `post_comments` |
| Modifier son commentaire | Édition inline, `edited_at` si disponible | `post_comments` |
| Supprimer son commentaire | Suppression + cascade des réponses | `post_comments` |
| Aimer un commentaire | Cœur + compteur | `post_comment_likes` |
| Signaler un commentaire | Sheet de motifs, anti-doublon | `comment_reports` |
| Signaler le post | Sheet de motifs, ligne traitable | `post_reports` |
| Partager en interne | Conversation réelle, message `message_type='post'` | `/api/compte/share-post` |
| Partager en externe | Web Share API, fallback copie | aucune |
| Copier le lien | Toujours `clipboard`, URL `/communaute/post/<id>` | aucune |
| Republier | Crée un post avec `reposted_from_id` | `/api/compte/repost` |
| Supprimer le post | Confirmation, suppression du post et des médias | `community_posts` |
| Voir le profil de l’auteur | Ouvre un aperçu ou `/profil/<id>` | lecture |
| Ouvrir le média | Visionneuse plein écran, swipe entre médias | lecture |

### 3.3 PostDrawer à trois panneaux

Ordre : **[Partage] ← [Publication] → [Commentaires]**.

- Index initial : 1 (Publication).
- Tap commentaire ou swipe gauche : index 2.
- Tap partager ou swipe droite : index 0.
- Transition 280 ms, easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- Le panneau central garde le contexte quand on revient.
- Le header affiche : fermer, « Publication », options.
- Le panneau Partage a deux onglets : « Envoyer » et « Partage externe ».

**Panneau Publication**
- auteur : avatar, nom, handle, date, audience ;
- média : carrousel `image_url` + `media_urls`, ratio 4:5, visionneuse ;
- légende, mentions, lieu si réel ;
- compteurs réels ;
- barre d’actions : like, commentaire, partage, enregistrer ;
- aperçu des 2 derniers commentaires ;
- timestamp et lien permalien.

**Panneau Commentaires**
- header « Commentaires » + compteur ;
- liste paginée, réponses, likes, édition/suppression, signalement ;
- composer sticky avec avatar ;
- réponse ciblée, annulation, limite 5 000 caractères ;
- état vide « Sois le premier à commenter » ;
- focus automatique sur le commentaire ciblé par une notification.

**Panneau Partage**
- onglet « Envoyer » : recherche, conversations privées/groupes, envoi réel ;
- onglet « Partage externe » : partage natif, copier le lien, republier,
  enregistrer ;
- confirmation, gestion d’erreur, aucune page quittée.

### 3.4 Corrections du feed

Le feed garde `CommunityPostCard`, mais bénéficie de la couche commune :

- signalement de post vers `post_reports`, plus `comment_reports` ;
- « Copier le lien » réellement séparé de « Partager » ;
- écran « Enregistrements » ;
- suppression de ses propres posts ;
- republication réelle ;
- médias multiples dans la visionneuse ;
- rendu des messages `message_type='post'` dans la messagerie.

---

## 4. Sous-drawers du profil

### 4.1 Enregistrements

- Nouveau bouton signet dans la barre d’actions du profil, aria-label
  « Enregistrements ».
- `SavedPostsDrawer` : liste des posts sauvegardés, média, auteur, date,
  compteurs.
- Tap → `PostDrawer` sur le post.
- État vide avec CTA « Explorer la communauté ».
- Données : `post_saves` + `community_posts` + `public_profiles`.

### 4.2 Profil d’un acteur

- `UserPreviewDrawer` : avatar, nom, handle, bio courte, bouton suivre/ne plus
  suivre, lien « Voir le profil complet ».
- Ouvert par une notification de follow ou un tap sur l’auteur d’un post.
- Retour vers le post/la notification, sans perdre la pile.

### 4.3 Trophée

- `BadgeTile` devient un bouton.
- `BadgeDetailSheet` : médaille, nom, rareté, statut obtenu/à débloquer, date,
  description, condition, points.
- Les données `description`, `requirement`, `requirementValue`, `points` sont
  ajoutées au payload du bootstrap.
- Aucune navigation.

### 4.4 Produit

- `GearRow` devient un bouton.
- `GearDetailSheet` : photo, nom, marque, catégorie, poids, état, prix,
  coût/sortie, prêt en cours.
- Actions disponibles dans la fiche : prêter, ajouter à un kit, modifier.
- Les actions absentes restent absentes ; aucune promesse morte.
- Aucune navigation.

### 4.5 Empreinte

- Remplace la feuille vanilla `seal`.
- Header standard, titre « Empreinte », sous-titre « 100 % dérivé de tes
  sorties GPS vérifiées ».
- Radar compact 120 px, branches réellement proportionnelles aux valeurs.
- Stats en grille 2 colonnes : Sorties, Kilomètres, Dénivelé, Matériel, Kits,
  Espèces, Tribu.
- Note 11 px, gris, 2 lignes maximum.
- Boutons « Passeport » et « Partager » dans le drawer.
- Hauteur intrinsèque, pas de vide de 200 px.

### 4.6 Confiance

- `TrustCard` devient cliquable.
- `TrustDetailSheet` : indice 0–100, jauge, vérification, prêts actifs, taux de
  retour, note moyenne.
- Titre 14 px, valeurs 18–20 px, libellés 10,5 px.
- « Pas encore noté » devient un état vide court, pas une valeur 22 px.
- Alignement avec les autres cartes (padding 11–12 px).

### 4.7 Drawer de création

`CreateDrawerHost` remplace la feuille `create_menu`. Il contient :

1. un catalogue de 6 types : Publication, Story, Carnet, Kit, Club, Voyage ;
2. le formulaire du type choisi, dans le même overlay ;
3. un retour vers le catalogue sans fermer l’overlay.

Catalogue :
- cartes 2 colonnes, icône, titre, sous-titre, 34–36 px de haut ;
- aucun `navtab` ;
- ajout de « Publication », absent aujourd’hui ;
- « Voyage » ne redirige plus vers `/voyages` (route inexistante) ;
- état invité : CTA connexion, pas de formulaire.

Formulaires :
- **Publication** : extraction de `PublierPostContent` en `CreatePostForm` ;
  médias, audience, lieu, kit/carnet liés, brouillon.
- **Story** : extraction du composer `CommunityStoriesBar` en
  `CreateStoryForm` ; 5 slides, buckets privés, audience.
- **Carnet** : extraction du corps de `CreateCarnetView` en
  `CreateCarnetForm` ; champs perdus corrigés (sous-titre, voyageurs,
  difficulté, température, kitIntro) ; couverture uploadée ou URL.
- **Kit** : extraction du formulaire contrôlé de `KitManager` ;
  `POST /api/materiel/kits`.
- **Club** : formulaire unique, champs réellement persistés, création du
  `club_members` admin du créateur.
- **Voyage** : formulaire court (titre, destination, dates, visibilité) qui
  crée un `trips` et propose « Continuer dans le Compas » sans quitter la page
  avant validation.

Après succès : fermeture de l’overlay, toast, rafraîchissement du bootstrap et
de la grille. Aucun `router.push`.

---

## 5. Notifications

### 5.1 Principe

Une seule surface « Activité » : l’onglet Notifications du drawer Compte.
Les messages privés sortent de cette surface.

- Exclus à la lecture : `new_message`, `group_message`, `digest`.
- Les lignes restent en base pour la messagerie, les tests et les push.
- Le badge de notifications compte uniquement l’activité non lue.
- Les messages gardent leur badge dans Messagerie.

### 5.2 Groupes et types

| Groupe | Types |
|---|---|
| social | `post_liked`, `post_commented`, `carnet_liked`, `carnet_commented`, `mention`, `new_follower`, `follow_request`, `follow_accepted`, `post_repost`, `group_invite`, `group_task_assigned`, `group_expense_added`, `group_join_*`, `trip_invitation` |
| loans | `loan_request`, `loan_due`, `loan_returned`, `loan_accepted` |
| orders | `order_confirmed`, `order_shipped`, `order_delivered`, `order_cancelled` |
| system | `badge_earned`, `challenge_completed`, `points_earned`, `system_update`, `sos_alert` |
| messages (exclu) | `new_message`, `group_message`, `digest` |

Règles de mapping :
- `stored` est utilisé s’il vaut `social`, `loans`, `orders` ou `system` ;
- si `stored` vaut `system` (valeur par défaut), le type décide ;
- `mention` → social ;
- `trip_invitation` → social ;
- `group_report_received` → system ;
- `points_earned` → system.

### 5.3 Écriture et triggers

- `notify()` écrit `group` explicitement (paramètre ou dérivation).
- Backfill des 4 966 lignes existantes.
- Nouveaux triggers :
  - `user_follows` → `new_follower` ;
  - `follow_requests` → `follow_request` / `follow_accepted` ;
  - `orders` update status → `order_*` ;
  - `materiel_loans` insert/update → `loan_*` ;
  - `user_badges` insert → `badge_earned` ;
  - `user_challenges` completed → `challenge_completed` ;
  - `community_posts` repost → `post_repost`.
- Les triggers existants pour likes/commentaires/carnets conservent leur
  comportement mais écrivent le bon groupe.
- Pas d’auto-notification.
- Pas de notification pour un save (collection privée).
- Pas de doublon si l’action est répétée dans une courte fenêtre.
- Les inserts client de notifications passent par une RPC `SECURITY DEFINER`
  atomique ; aucune policy `INSERT` client n’est ouverte.

### 5.4 Lecture

- `loadActivity` remplace la lecture brute :
  - exclut les messages ;
  - filtre les blocages ;
  - pagination cursor `(created_at, id)` ;
  - compteur exact des non-lues ;
  - compteurs par groupe ;
  - agrégation `(type_family, related_id)` pour like/comment/follow ;
  - acteurs empilés (max 3), cible, miniature, `following` du viewer.
- `NotificationItem` est étendu de façon rétrocompatible :
  `actor.id`, `actor.handle`, `actor.following`, `count`, `target`,
  `unread`, `action`.
- `action` est un objet `{ kind, id }` : `post`, `carnet`, `profile`, `orders`,
  `loans`, `badge`, `challenge`, `settings`, `message`.
- L’UI utilise `action` pour ouvrir le drawer correspondant :
  - `post` → `PostDrawer` ;
  - `carnet` → page `/carnets/[id]` (aucun drawer carnet n’existe) ;
  - `profile` → `UserPreviewDrawer` ;
  - `orders` → drawer Compte, onglet Commandes ;
  - `loans` → drawer Profil, slot Prêts ;
  - `badge` → `BadgeDetailSheet` ;
  - `challenge` → drawer Profil, slot Communauté, lentille Défis ;
  - `settings` → drawer Compte, onglet Paramètres.
- `link` reste un fallback de route interne, jamais utilisé si `action` existe.

### 5.5 UI

Chaque ligne :
- avatar 36 px + badge de type ;
- texte : acteur(s) en gras + action + cible ;
- extrait court ;
- miniature 40×40 à droite ;
- bouton « Suivre » pour les follows ;
- temps court ;
- point non-lu et fond plus opaque ;
- chevron si action.

Groupes temporels : Aujourd’hui / Hier / Cette semaine / Plus tôt.
Filtres : Tout / Social / Prêts / Commandes / Système.
États : skeleton, erreur, vide par filtre, pagination.

### 5.6 Entrées et liens

- Cloche du Header → activité, pas `/hub/alertes`.
- `?tab=notifications` ouvre l’onglet.
- `/groupes/*` → `/hub/groupe`.
- `/compte?tab=prets` → slot Prêts.
- `/alertes` → activité ou `/hub/alertes` selon le type.
- Toute route de notification doit résoudre un `page.tsx` ou un overlay.

---

## 6. Données, API et migrations

### 6.1 Post

- `mapPosts` expose : `id`, `author`, `title`, `content`, `image_url`,
  `media_urls`, `audience`, `club_id`, `reposted_from_id`, `likes_count`,
  `comments_count`, `shares_count`, `created_at`, `user_liked`, `user_saved`.
- `accountBootstrap` charge `post_likes` et `post_saves` du viewer pour les
  posts affichés.
- Les posts `club`/`abonnies` ne deviennent plus des brouillons.
- `post_reports` : nouvelle table
  `id, post_id FK, reporter_id FK, reason, details, status, created_at,
  resolved_at, resolved_by`.
- RLS : insert own, select own/modérateur, update modérateur.
- Index : `(post_id)`, `(status, created_at)`.
- La vue `community_moderation_queue` inclut les signalements de posts.
- Suppression d’un post : `DELETE` RLS owner, cascade des commentaires/likes/
  saves/shares ; médias storage supprimés côté API.

### 6.2 API

| Route | Rôle |
|---|---|
| `GET /api/compte/posts/[id]` | détail du post + état like/save + médias + auteur |
| `GET /api/compte/posts/[id]/comments` | liste + likes + réponses |
| `POST /api/compte/posts/[id]/comments` | création / like / signalement |
| `PATCH /api/compte/posts/[id]/comments/[commentId]` | édition |
| `DELETE /api/compte/posts/[id]/comments/[commentId]` | suppression |
| `POST /api/compte/posts/[id]/reports` | signalement de post |
| `GET /api/compte/posts/saved` | liste des enregistrements |
| `POST /api/compte/share-post` | envoi interne |
| `POST /api/compte/repost` | republication |
| `DELETE /api/compte/posts/[id]` | suppression du post |

Les likes passent par la RPC existante ; les saves par Supabase direct avec RLS.

### 6.3 Notifications

- Backfill `group` depuis `type`.
- `notify()` écrit `group`, `group_count`, `actor_id`, `related_*`, `link`.
- Trigger BEFORE INSERT de sécurité pour dériver le groupe si absent.
- Index `(user_id, created_at DESC)` et
  `(user_id, type, related_id, created_at DESC)`.
- Compteur exact non lu via `COUNT(*)` filtré.
- Pas de policy `INSERT` client ; RPC dédiée pour les demandes de groupe.
- Les préférences restent dans `notification_preferences` ; l’UI lit et écrit
  cette table, plus `user_profiles.notification_prefs` pour compatibilité.
- Les livraisons email/push ne sont pas réparées dans ce chantier ; elles sont
  documentées comme hors périmètre.

### 6.4 Ménage

- `ProfileSettingsSheet`, `InvitationsSheet`, `edit_profile_full` sont du code
  mort : ne pas les rebrancher dans ce chantier ; les tests statiques sont
  conservés ou adaptés.
- Le seed `scripts/seed/seed_compte_demo_complet.mjs` contient une erreur de
  syntaxe (`iso-0.364)`) ; il est réparé dans le lot de fondation.
- Les tests `compte-refonte-v14` qui verrouillent `/carnets/<post>` sont
  remplacés par le contrat `/communaute/post/<id>`.

---

## 7. Critères d’acceptation

### 7.1 Post

- Like → rechargement → toujours aimé, compteur identique.
- Unlike → compteur décrémenté, aucune ligne `post_likes`.
- Save → rechargement → toujours enregistré ; visible dans Enregistrements.
- Commentaire → rechargement → présent ; réponse → `parent_id` correct.
- Like/réponse/signalement d’un commentaire → persistant.
- Signalement de post → ligne `post_reports` avec `target_user_id` résolu.
- Copier le lien → URL `/communaute/post/<id>` valide, testée dans un onglet.
- Partage interne → message avec `message_type='post'`.
- Partage externe → Web Share ou copie.
- Republier → post avec `reposted_from_id`, visible dans la grille.
- Supprimer → post absent, compteurs et médias nettoyés.
- Média réel affiché, carrousel fonctionnel.
- Aucun `router.push` depuis le PostDrawer.

### 7.2 Gestes

- Tap commentaire → panneau Commentaires à droite.
- Swipe gauche depuis le post → Commentaires.
- Tap partager → panneau Partage à gauche.
- Swipe droite depuis le post → Partage.
- Retour → panneau Publication, focus conservé.

### 7.3 Sous-drawers

- Trophée → fiche avec description/condition, retour, aucun changement d’URL.
- Produit → fiche avec photo/poids/état/prêt, retour.
- Empreinte → header, radar proportionnel, 7 stats compactes, pas de vide.
- Confiance → indice 0–100, jauge, textes 10,5–14 px.
- Enregistrements → liste réelle, ouverture du post, état vide.
- Création → 6 types, formulaire inline, aucun changement de page, succès
  visible dans le profil.

### 7.4 Notifications

- Aucun message privé dans l’activité.
- Badge = activité non lue exacte.
- Follow, like, commentaire, commande, prêt, badge, défi déclenchent une ligne.
- Ligne Instagram : avatar, texte, cible, miniature, action.
- Tap → drawer/écran correspondant, sans lien mort.
- « Tout lire » ne touche pas la messagerie.
- Filtres et groupes temporels corrects.

### 7.5 Design

- Tous les boutons visibles des drawers utilisent 30/34/36 px, pas 44/48.
- Toggles 42×25 px.
- Titres 14–15 px, corps 12,5 px, légendes 10,5 px.
- Même recette de verre que la bottom bar.
- Aucun texte 22 px dans un KPI de drawer.
- Tests visuels sur 430×932.

---

## 8. Tests

### 8.1 Unitaires

- `formatElevation`, `formatElevationCompact`, `formatKm`, `formatCount`.
- `notificationGroup` : stocké prioritaire, fallback type, messages exclus.
- `createCatalog` : 6 types, cibles valides.
- `mapPosts` : médias, audience, `user_liked`, `user_saved`.
- `mapBadges` : description, condition, points.

### 8.2 Composants

- `PostDrawer` : 3 panneaux, like/save/comment/report/share/copy.
- `SavedPostsDrawer`, `BadgeDetailSheet`, `GearDetailSheet`, `SealDrawer`,
  `TrustDetailSheet`.
- `CreateDrawerHost` : catalogue, formulaire, retour, focus, Escape.
- `NotificationsPane` : lignes, filtres, empty, unread, pas de message.

### 8.3 SQL

- `post_reports` + RLS + vue modération.
- Triggers follow/order/loan/badge/challenge/repost.
- Backfill `group`.
- Compteur non lu exact.
- Pas de notification de message dans l’activité.
- Pas d’auto-notification, pas de doublon.

### 8.4 E2E

Sur le compte démo :

1. ouvrir un post depuis la grille ;
2. like, commentaire, save, signalement ;
3. swipe commentaires, swipe partage ;
4. copier le lien et l’ouvrir ;
5. partager dans une conversation ;
6. ouvrir Enregistrements, badge, produit, Empreinte, Confiance ;
7. créer un post, une story, un carnet, un kit, un club, un voyage ;
8. vérifier les notifications sans messages ;
9. vérifier que l’URL reste `/compte`.

---

## 9. Découpage de livraison

### Lot 0 — Fondations

- corriger le seed ;
- créer `compte-overlay.css` et les primitives ;
- créer le formateur de métriques ;
- créer `CompteOverlayHost` et le pont runtime ;
- tests de base.

### Lot 1 — Post

- couche `features/community/posts` ;
- `PostDrawer` 3 panneaux ;
- actions réelles ;
- corrections feed ;
- `post_reports` ;
- médias réels ;
- tests.

### Lot 2 — Sous-drawers

- Enregistrements ;
- Trophée ;
- Produit ;
- Empreinte ;
- Confiance ;
- refonte des tailles et du verre ;
- tests.

### Lot 3 — Création

- catalogue ;
- formulaires extraits ;
- admin club ;
- voyage ;
- tests.

### Lot 4 — Notifications

- backfill et triggers ;
- lecture activité ;
- UI Instagram ;
- entrées et liens ;
- tests.

### Lot 5 — Finition

- tests visuels ;
- vérification production ;
- nettoyage des tests statiques obsolètes ;
- documentation.

---

## 10. Hors périmètre

- Interface de modération admin.
- Refonte visuelle complète du feed `/communaute`.
- Refonte du profil public `/profil/[id]` au-delà des composants partagés.
- Pipeline email/push (les livraisons en attente ne sont pas traitées).
- Suppression des composants morts `ProfileSettingsSheet`/`InvitationsSheet`.
- Réécriture totale du runtime vanilla : il reste le moteur de la page, mais
  les overlays interactifs passent en React.

---

## 11. Risques et parades

| Risque | Parade |
|---|---|
| `renderSheet` détruit l’état React | overlays hors `#sheet`, jamais dans `#lkdv-slot-root` |
| CSS legacy `!important` | CSS scopé `.lkdv-compte-overlay`, overrides ciblés, tests visuels |
| Formulaires extraits trop gros | extraction par type, wrapper de page conservé, tests de non-régression |
| Triggers de notifications en double | contrainte d’unicité courte fenêtre, tests SQL |
| Signalements intraçables | table dédiée + vue modération mise à jour |
| Liens morts | contrat de routes testé pour chaque `action` |
| Compteur non lu faux | `COUNT(*)` exact, pas la fenêtre |
| Perte de données | migrations additives, aucun `DROP`, sauvegarde des champs actuels |
| Régression design | captures 430×932 avant/après, tests de tokens |
