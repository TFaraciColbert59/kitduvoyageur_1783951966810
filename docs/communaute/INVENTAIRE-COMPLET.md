# Inventaire complet — page Communauté (LKDV)

**Date :** 2026-10-23
**Branche :** `chantier/communaute-v2` (dernier commit `1d0f4f81`)
**Objet :** lister **tout** ce qui compose la Communauté — écrans, éléments, boutons, fonctions,
moteurs, données — pour décider ce qu'on garde, ce qu'on corrige et ce qu'on arrête.
**Méthode :** lecture du code réel, des migrations Supabase et des captures
`docs/communaute/v2-after/`. Aucune supposition : chaque ligne a un fichier et une ligne.

---

## 0. Résumé exécutif

| Indicateur | Valeur |
|---|---|
| Routes Communauté | **6** (`/communaute`, `decouvrir`, `post/[id]`, `reels`, `publier`, `pro`) |
| Écrans / feuilles distincts | **8** (hub, découverte, post, reels, publier, drawers de contenu, stories, contexte) |
| Types de contenus affichés | **5** (publication, carnet, club, expédition, sortie) |
| Filtres de la capsule | **6** (Tout, Carnets, Clubs, Expéditions, Sorties, Entraide) |
| Tuiles « Tout » | **30** (plafond), les filtres montrent l'intégralité |
| Tables Supabase lues/écrites | **~35** |
| RPC directs | **2** (`toggle_community_post_like`, `join_event`) |
| APIs dédiées | **3** (`/api/stories/[id]/media`, `/api/rewards/claim`, `/api/materiel/fork`) |
| Triggers sociaux | **~12** (compteurs, notifications, mentions, audience, snapshot, média) |
| Tests Communauté | **8 fichiers**, 41 tests ciblés + 5 tests visuels |
| Boutons/actions recensés | **~70** (détail §3-7) |

**Le modèle actuel :** une **grille de tuiles** (style Compte) + une **capsule de 6 filtres** +
des **drawers de contenu**. La page ne navigue plus vers `/carnets`, `/clubs`, `/groupes` ;
les routes existent encore pour les liens externes. Le hub est un client component qui charge
lui-même ses données via Supabase (RLS).

---

## 1. Carte des écrans et des routes

### 1.1 Routes principales

| Route | Fichier | Type | Rôle | Données lues | État |
|---|---|---|---|---|---|
| `/communaute` | `src/app/communaute/page.tsx` | client | hub + grille + drawers | posts, carnets, clubs, groups, events, profils, totaux | actif |
| `/communaute/decouvrir` | `src/app/communaute/decouvrir/page.tsx` | client | grille de médias, recherche, filtres | `community_posts` | actif |
| `/communaute/post/[id]` | `src/app/communaute/post/[id]/page.tsx` | client | permalien d'une publication + commentaires | `community_posts`, `post_likes`, `post_saves`, profils | actif |
| `/communaute/reels` | `src/app/communaute/reels/page.tsx` | client | vidéos plein écran | `community_posts`, likes/saves | actif |
| `/communaute/publier` | `src/app/communaute/publier/page.tsx` | client | composeur | drafts, carnets, clubs, kits, events | actif |
| `/communaute/pro` | `src/app/communaute/pro/page.tsx` | ré-export | alias `/communaute-pro` | — | actif |
| `/communaute-pro` | `src/app/communaute-pro/page.tsx` | page | offre pro | — | hors hub |

### 1.2 Routes liées (accessibles depuis la grille ou les drawers)

| Route | Fichier | Rôle | Lien depuis |
|---|---|---|---|
| `/carnets` | `src/app/carnets/page.tsx` | annuaire carnets | filtre Carnets → tuile/drawer |
| `/carnets/[id]` | `src/app/carnets/[id]/page.tsx` | carnet complet | drawer carnet |
| `/carnets/nouveau` | `src/app/carnets/nouveau/page.tsx` | création | menu + |
| `/clubs` | `src/app/clubs/page.tsx` | annuaire clubs | filtre Clubs |
| `/clubs/[id]` | `src/app/clubs/[id]/page.tsx` | club | drawer club |
| `/clubs/nouveau` | `src/app/clubs/nouveau/page.tsx` | création | ailleurs |
| `/groupes/[id]` | `src/app/groupes/[id]/page.tsx` | cockpit expédition | drawer expédition |
| `/evenements` | `src/app/evenements/page.tsx` | annuaire sorties | filtre Sorties |
| `/entraide` | `src/app/entraide/page.tsx` | questions terrain | filtre Entraide |
| `/profil/[id]` | `src/app/profil/[id]/page.tsx` | profil public | auteur d'un post |
| `/messagerie` | `src/app/messagerie/page.tsx` | DM | bouton messages |

### 1.3 Feuilles / overlays

| Overlay | Fichier | Ouvert par | Contenu |
|---|---|---|---|
| Drawer de contenu | `CommunityContentDrawer.tsx` | tuile de la grille | publication / carnet / club / expédition / sortie |
| Contexte | `shell/CommunityContextDrawer.tsx` | bouton calques du héro | 2 lentilles : Destinations, Clubs |
| Visionneuse stories | `StoriesViewer.tsx` | anneau de story | média, likes, réponses, vues, signalement, blocage, suppression |
| Archives stories | `StoriesArchiveSheet.tsx` | anneau « Tout voir » / bouton archives | archives, albums, suppression, épinglage |
| Vues story | `StoryViewsSheet.tsx` | bouton « vues » de sa story | liste des viewers, masquage |
| Signalement | `src/components/social/ReportSheet.tsx` | menu d'un post / commentaire | motifs, détails, envoi |
| Visionneuse image | `src/components/ui/ImageViewer.tsx` | tap sur un média | plein écran, pinch/zoom/swipe |
| Recherche globale | `src/components/search/SearchOverlay.tsx` | loupe du header | recherche produits/pays/guides → `/boutique?q=` |
| Menu création | `MobileCommunityHeader.tsx` | bouton + | Nouvelle publication, Créer un carnet |
| Cookie | `CookieConsentBanner` | global | accepter/refuser |

---

## 2. Le hub `/communaute` — élément par élément

### 2.1 Structure

```
CommunityHub (page.tsx)
├─ <h1 class="sr-only">Communauté — Le Kit du Voyageur</h1>
├─ AppShell (safeTop=false, background transparent)
│  └─ CommunityShell
│     ├─ header  → MobileCommunityHeader
│     ├─ hero    → CommunityHeroCard
│     └─ children→ MobileCommunityHub
│        ├─ capsule 6 filtres
│        ├─ carte « La communauté » + CommunityGrid (30 tuiles)
│        └─ CommunityContentDrawer
└─ CommunityContextDrawer
```

### 2.2 Header — `MobileCommunityHeader.tsx`

| Élément | Ligne | Action | Effet | Permission |
|---|---|---|---|---|
| Capsule « Communauté » | `:46-48` | lien | `/communaute?tab=fil` | public |
| Bouton `+` | `:52-61` | ouvre le menu | `createOpen` | public |
| Menu « Nouvelle publication » | `:78-81` | lien | `/communaute/publier` | auth pour publier |
| Menu « Créer un carnet » | `:82-85` | lien | `/carnets/nouveau` | auth |
| Bouton loupe | `:89-96` | `openSearch()` | `SearchOverlay` global → `/boutique?q=` | public |
| Lien messages | `:97-99` | lien | `/messagerie` | auth |

> **Incohérence :** l'`aria-label` dit « Rechercher dans la communauté » alors que l'overlay
> cherche des **produits, pays et guides** et route vers `/boutique?q=`. Ce n'est pas une
> recherche communautaire.

### 2.3 Héro — `CommunityHeroCard.tsx`

| Élément | Ligne | Action | Donnée | État |
|---|---|---|---|---|
| Avatar 66 px | `:88-96` | aucune (décoratif) | `user.user_metadata.avatar_url` / initiale | invité = icône montagne |
| 3 compteurs | `:99-107` | aucun (pas de bouton) | `totals.posts/clubs/events` | `—` si count échoue |
| Ligne de contexte | `:110` | aucune | prochaine sortie ou 3 destinations | texte réel |
| Bouton contexte (calques) | `:111-117` | ouvre le drawer contexte | destinations + clubs | public |
| Bouton Publier | `:121-132` | `/communaute/publier` | — | auth |
| Bouton Découvrir | `:133-142` | `/communaute/decouvrir` | — | public |
| Stories à la une | `:143` | `CommunityStoriesBar variant="highlights"` | 5 anneaux + « Tout voir » | auth (RLS stories) |

**Totaux** : `useCommunityTotals.ts` fait 3 `count` (`community_posts`, `clubs`, `events` à venir).
Valeurs observées : 196 / 18 / 18. Aucun `posts.length` n'est affiché comme total.

### 2.4 Capsule des six filtres — `MobileCommunityHub.tsx`

| Filtre | id | Effet | Donnée affichée |
|---|---|---|---|
| Tout | `fil` | grille mixte | 30 tuiles visuelles (posts, carnets, clubs, expéditions) |
| Carnets | `carnets` | filtre | tous les carnets chargés (20) |
| Clubs | `clubs` | filtre | tous les clubs chargés (50) |
| Expéditions | `groupes` | filtre | `travel_groups` (20) |
| Sorties | `evenements` | filtre | `events` à venir (20) |
| Entraide | `entraide` | carte d'entrée | lien `/entraide` |

- `CapsuleTabs` 48 px, `showLabels`, lentille 420 ms (`:104-120`).
- `onTabChange` → `handleTabSelect` (`page.tsx:52-60`) : met à jour l'état + `router.replace('/communaute?tab=…', {scroll:false})`.
- **Aucune navigation de route** : les six espaces sont des filtres.
- `?tab=` est lu au montage (`page.tsx:38-46`).

### 2.5 Carte « La communauté » + grille — `CommunityGrid.tsx`

| Élément | Ligne | Action | Effet |
|---|---|---|---|
| En-tête « La communauté » | `:204-207` | aucune | titre + sous-titre |
| Tuile image | `:202-236` | tap | ouvre `CommunityContentDrawer` |
| Tuile fallback (sans image) | `:210-219` | tap | drawer avec titre + sous-titre |
| Badge de type | `:221-224` | aucune | icône post/carnet/club/expédition/sortie |
| Badge vidéo | `:226-229` | aucune | ▶ |
| « Charger plus de contenus » | `:239-246` | `onLoadMorePosts` | voir §12 : **plafonné à 30, donc sans effet visible** |

**Règles de la grille** :
- `fil` : contenus **avec image** d'abord (posts, carnets, clubs, expéditions), puis 6 contenus
  textuels ; **les sorties sont exclues** (elles ont leur filtre) ; plafond 30 (`:85-100`).
- `carnets` / `clubs` / `groupes` : tous les éléments du type.
- `evenements` : tous les événements, triés par date.
- `entraide` : `EmptyState` avec CTA `/entraide` (`:112-126`).
- 3 colonnes mobile, 4 à 768 px, 5 à 1280 px (CSS `community-social.css:1506`).

### 2.6 Drawer de contenu — `CommunityContentDrawer.tsx`

| Type | Élément | Ligne | Action | Donnée |
|---|---|---|---|---|
| Tous | Kicker de type | `:69-86` | aucune | label + icône |
| Publication | `CommunityPostCard` complet | `:88-89` | like, commentaire, partage, favori, signalement | `community_posts` |
| Publication | « Ouvrir la publication » | `:161-166` | `/communaute/post/[id]` | — |
| Carnet | Couverture, titre, destination, description, auteur | `:90-103` | lecture | `carnets` |
| Carnet | « Ouvrir le carnet » | `:100-103` | `/carnets/[id]` | — |
| Club | Couverture, nom, description, membres, catégorie | `:104-118` | lecture | `clubs`, `club_members` |
| Club | « Ouvrir le club » | `:115-118` | `/clubs/[id]` | — |
| Expédition | Couverture, nom, destination, description, places | `:119-132` | lecture | `travel_groups` |
| Expédition | « Ouvrir l'expédition » | `:129-132` | `/groupes/[id]` | — |
| Sortie | Couverture, titre, date, lieu, guide, inscrits | `:133-160` | lecture | `events` |
| Sortie | « S'inscrire » | `:151` | `onJoinEvent` → RPC `join_event` | `event_participants` |
| Sortie | « Voir toutes les sorties » | `:154` | `/communaute?tab=evenements` | — |

### 2.7 États du hub

| État | Déclencheur | Rendu | Ligne |
|---|---|---|---|
| Chargement | `loading && posts.length===0` | 9 squelettes de tuiles | `MobileCommunityHub:209-214` |
| Vide | grille sans item | `EmptyState` + Découvrir | `CommunityGrid:180-195` |
| Erreur section | `sectionError` | bandeau + Réessayer | `MobileCommunityHub:209-214` |
| Hors-ligne | `navigator.onLine` | `OfflineBanner` | `MobileCommunityHub:160` |
| Invité | pas de session | bandeau « Connectez-vous » + CTA | `MobileCommunityHub:162-170` |
| Entraide | filtre | carte CTA | `CommunityGrid:165-178` |

---

## 3. La carte de publication — `CommunityPostCard.tsx` (1 498 lignes)

C'est le composant le plus dense : il porte **toutes** les actions sociales et les commentaires.

### 3.1 Actions principales

| Élément | Ligne | Handler | Effet | Table |
|---|---|---|---|---|
| Auteur (avatar/nom) | `:928-957` | lien | `/profil/[id]` | `public_profiles` |
| Média | `:965-1030` | double-tap | like | `post_likes` |
| Flèches média | `:984-988` | tap | média suivant/précédent | — |
| Kit public | `:996-1006` | tap | menu « Importer dans mon matériel » | `materiel_kits` + `/api/materiel/fork` |
| Like | `:790` | `handleLike` | RPC toggle + compteur | `toggle_community_post_like` |
| Commentaire | `:802` | `handleToggleComments` | ouvre le fil inline | `post_comments` |
| Partager | `:820` | `handleShare` | `navigator.share` ou copie du permalien | — |
| Menu `…` | `:836` | `openPostActions` | menu natif ou HTML | — |
| Enregistrer | `:731-742` | `handleToggleSave` | upsert/delete favori | `post_saves` |
| Copier le lien | `:743-753` | `handleShare` | presse-papier | — |
| Masquer | `:755-767` | `handleHidePost` | localStorage `lkdv:hidden_posts` | aucune table |
| Signaler le post | `:769-780` | `handleReport` | `ReportSheet` → `comment_reports` (`table_name='community_posts'`) | `comment_reports` |
| Afficher plus/moins | `:1063-1076` | state | tronque la légende | — |
| Enregistrer (bookmark) | `:1045` | `handleToggleSave` | idem | `post_saves` |

### 3.2 Commentaires (inline)

| Élément | Ligne | Handler | Effet | Table |
|---|---|---|---|---|
| Charger | `:206-290` | `loadComments` | racines + réponses + profils | `post_comments`, `public_profiles` |
| Like commentaire | `:402-450` | `handleLikeComment` | upsert/delete | `post_comment_likes` |
| Répondre | `:529-536` | `handleReplyTo` | pré-remplit `@nom` + parent | — |
| Éditer | `:451-484` | `handleSaveEditComment` | update `content` | `post_comments` |
| Supprimer | `:485-509` | `handleDeleteComment` | delete | `post_comments` |
| Signaler | `:510-528` | `handleReportComment` | insert | `comment_reports` |
| Voir plus | `:1371` | state | +30 racines | `post_comments` |
| Envoyer | `:625-678` | `handleSendComment` | insert | `post_comments` |
| Joindre une photo | `:680-688` | `handleFileUpload` | **nom de fichier ajouté au texte** (pas d'upload) | — |
| Partager un GPX | `:689-695` | `handleGpxUpload` | **nom de fichier ajouté au texte** | — |
| Partager ma position | `:696-712` | `handleShareLocation` | géoloc → texte `📍 lat, lon` | — |
| Annuler réponse | `:1404` | state | reset | — |

> **Dette :** `post_comments` ne stocke ni média, ni GPX, ni coordonnées. Les trois boutons
> d'attachement ne promettent donc rien de durable ; le commentaire contient seulement le nom
> du fichier ou les coordonnées en texte. Le like de commentaire n'a **aucun trigger** sur
> `post_comments.likes_count` : le compteur DB ne bouge pas (seul l'état local est optimiste).

### 3.3 Modales internes

| Modale | Ligne | Contenu |
|---|---|---|
| `ReportSheet` | `:1481-1497` | motifs + détails → `comment_reports` |
| `ImageViewer` | `:1474-1480` | plein écran |
| Composer story | `CommunityStoriesBar:874-970` | audience, légende, texte, publication |
| Toast | `:862-869` | message 3 s |

---

## 4. Stories — `CommunityStoriesBar.tsx` (977 lignes), `StoriesViewer.tsx` (724), archives/vues

### 4.1 Barre / héro

| Élément | Ligne | Action | Effet | Table |
|---|---|---|---|---|
| Chargement | `:134-230` | `loadStories` | stories non expirées + vues + likes + follows | `post_stories`, `story_views`, `story_likes`, `user_follows` |
| Nettoyage auto | `:145-183` | au chargement | supprime ses stories expirées non archivées + objets Storage | `post_stories`, buckets |
| Anneau (mode héro) | `:610-663` | tap | ouvre le viewer | — |
| « Tout voir » | `:664-682` | tap | ouvre les archives | `story_highlights` |
| Anneau (mode rail) | `:717-760` | tap | ouvre le viewer | — |
| « Ajouter » / « Votre story » | `:763-800` | file picker | sélection média | — |
| Archives | `:802-818` | tap | `StoriesArchiveSheet` | `post_stories`, `story_highlights` |
| Compositeur | `:820-970` | submit | upload `stories-private` + insert | `post_stories` |

### 4.2 Viewer — `StoriesViewer.tsx`

| Élément | Ligne | Action | Effet |
|---|---|---|---|
| Zones gauche/droite | `:301-330` | tap/swipe | story précédente/suivante |
| Lecture/pause | `:617-625` | tap | pause |
| Muet | `:655-660` | tap | son |
| Like | `:514-527` | tap | `story_likes` |
| Vues (auteur) | `:530-540` | tap | `StoryViewsSheet` |
| Supprimer (auteur) | `:546-555` | tap | `post_stories` + Storage |
| Signaler | `:561-570` | tap | `story_reports` |
| Bloquer | `:576-585` | tap | `user_blocks` |
| Fermer | `:590-600` | tap | ferme |
| Répondre | `:685-700` | submit | `replyToStory` → messagerie |
| Navigation clavier | `:281-299` | flèches/Escape | tab trap |

### 4.3 Archives et vues

| Élément | Fichier:ligne | Action | Table |
|---|---|---|---|
| Fermer archives | `StoriesArchiveSheet:220-221` | close | — |
| Supprimer un album | `:244-246` | delete | `story_highlights` |
| Ouvrir une story | `:295` | viewer | — |
| Supprimer une story | `:305-307` | delete | `post_stories` + Storage |
| Épingler à un album | `:323` | insert | `story_highlight_items` |
| Créer un album | `:336-345` | insert | `story_highlights` |
| Fermer vues | `StoryViewsSheet:135-136` | close | — |
| Masquer un viewer | `:191-193` | insert | `story_hidden_users` |

---

## 5. Découvrir — `decouvrir/page.tsx` (149 lignes)

| Élément | Ligne | Action | Effet | Donnée |
|---|---|---|---|---|
| Retour | `:91-95` | `HeaderBackButton` | `/communaute` | — |
| Titre « Découvrir » | `:96` | — | — | — |
| Publier | `:97-99` | lien | `/communaute/publier` | — |
| Recherche | `:104-107` | input | filtre local (contenu, titre, destination, tags) | `community_posts` |
| Reels | `:110-112` | lien | `/communaute/reels` | — |
| Filtres | `:113-121` | Chip | Tout / Photos / Vidéos / Carnets | — |
| Tuile | `:124-139` | lien | `/communaute/post/[id]` | `community_posts` |
| Voir plus | `:142-148` | `load(page+1)` | pagination 24 | — |
| Erreur | `:116-119` | retry | recharge | — |

**Limites :** pagination 24, pas d'auteurs chargés (les tuiles n'ont pas de nom), filtre local
sur les 24/48 chargés, pas de tri, pas de recherche plein texte serveur.

---

## 6. Post — `post/[id]/page.tsx` (84 lignes)

| Élément | Ligne | Action | Donnée |
|---|---|---|---|
| Retour | `:64-69` | `/communaute/decouvrir` | — |
| Titre « Publication » | `:70` | — | — |
| Chargement | `:78` | — | `community_posts` + profils + likes/saves |
| Erreur | `:79` | — | — |
| Carte | `:80` | `CommunityPostCard` | toutes les actions §3 |
| Deep link commentaire | `CommunityPostCard:302-319` | `?comment=` | scroll + ring |

---

## 7. Reels — `reels/page.tsx` (218 lignes)

| Élément | Ligne | Action | Effet | Donnée |
|---|---|---|---|---|
| Retour | `:163-169` | — | `/communaute/decouvrir` | — |
| Titre « Reels » | `:170` | — | — | — |
| Publier | `:171-173` | lien | `/communaute/publier` | — |
| Vidéo | `:177` | `CommunityVideo` | lecture | `community_posts.media_urls` |
| Like | `:181-184` | `toggleLike` | RPC | `toggle_community_post_like` |
| Commentaires | `:185-187` | lien | `/communaute/post/[id]` | — |
| Partager | `:188-190` | `share` | `navigator.share`/copie | — |
| Enregistrer | `:191-194` | `toggleSave` | upsert/delete | `post_saves` |
| Auteur | `:200-204` | lien | `/profil/[id]` | `public_profiles` |
| Ouvrir le post | `:206-208` | lien | `/communaute/post/[id]` | — |
| Charger plus | `:211-217` | `fetchPage` | 30 suivants | — |
| Erreur | `:209-211` | retry | — | — |

**Limites :** pas de commentaires inline, pas de son persistant, pas de recherche, pas de
modération directe (il faut ouvrir le post).

---

## 8. Publier — `publier/page.tsx` (1 362 lignes)

### 8.1 Sections et champs

| Section | Élément | Ligne | Type | Effet |
|---|---|---|---|---|
| Header | Retour | `:657-663` | bouton | `/communaute` |
| Header | « Publier » desktop | `:685-693` | bouton | `handlePublish(false)` |
| 01 Format | Photo/vidéo | `:728-757` | carte | `postType='photo'` |
| 01 | Billet | idem | carte | `postType='billet'` |
| 01 | Question | idem | carte | `postType='question'` + tag |
| 01 | Événement | idem | carte | `postType='evenement'` |
| 02 Contenu | Titre | `:768-791` | input | `title` |
| 02 | Date événement | `:796-805` | date | `eventDate` |
| 02 | Capacité | `:806-817` | number | `eventMaxParticipants` |
| 02 | Texte | `:819-880` | textarea | `content` |
| 02 | Gras / Italique | `:831-851` | boutons | state visuel (pas de markdown réel) |
| 02 | Compteur mots | `:887` | texte | `wordCount` |
| 03 Médias | Ajouter | `:908-965` | boutons | file picker / natif |
| 03 | Retirer un média | `:953` | bouton | `handleRemovePhoto` |
| 03 | Kit public | `:988-999` | select | `sharedKitId` |
| 04 Carnet | Carnet lié | `:1002-1030` | select | `linkedCarnet` |
| 04 | Consentement | `:1035-1044` | checkbox | `publicationConsent` |
| 04 | Retirer les coordonnées | `:1046-1056` | checkbox | `stripCoordinates` |
| 04 | Localisation | `:1061-1074` | input | `location` |
| 04 | Détecter ma position | `:1078` | bouton | géoloc |
| 04 | Tags | `:1088-1109` | input + chips | `tags` |
| 04 | Mentions | `:1113-1130` | input + chips | `mentions` (résolution `public_profiles`) |
| 05 Audience | Public | `:1151-1168` | carte | `audience='public'` |
| 05 | Club | idem | carte | `audience='club'` |
| 05 | Abonnés | idem | carte | `audience='abonnies'` |
| 05 | Choix du club | `:1174-1198` | chips | `selectedClub` |
| Footer | Qualité | `:1293-1301` | jauge | `qualityScore` |
| Footer | « Publier maintenant » | `:1325-1335` | bouton | `handlePublish(false)` |

### 8.2 Ce que fait `handlePublish` (`:447-648`)

1. Refuse le mode brouillon explicite (`:448-451`) — **les brouillons ne sont pas publiables**.
2. Refuse les médias/carnets/kits/événements si l'audience n'est pas `public` (`:459-466`).
3. Upload des photos vers **`carnet-media`** (public) après nettoyage EXIF (`:325-405`).
4. Résout les mentions vers `public_profiles` (`:511-535`).
5. Crée une **vraie sortie** dans `events` si `postType='evenement'` (`:556-576`).
6. Insère `community_posts` avec `post_type` :
   - `question` → `question`
   - `evenement` → **`event`**
   - sinon → `share` (`:597`).
7. Réclame les points via `/api/rewards/claim` (`:615-630`).
8. Supprime le brouillon (`:544`) et redirige (`:637-641`).

### 8.3 Brouillon

- Restauration au montage (`:180-204`), auto-save débouncée 900 ms (`:209-232`).
- Table `community_post_drafts` (une ligne par user, RLS own).
- **Pas de bouton « enregistrer le brouillon »** : le mode `draft` affiche une alerte.

> **Bug P0 :** la contrainte `post_type` n'autorise que `post|tip|question|share`
> (`20260713120000_community_features.sql:226`). Publier un **événement** crée la ligne `events`
> puis échoue à l'insertion du post (`post_type='event'`). L'événement reste, le post non.

---

## 9. Recherche, signalement, navigation

### 9.1 Recherche globale

- `SearchOverlay` monté par `MobileNavWrapper` sur `/communaute` (pas une route sans nav).
- Cherche des **produits, pays, guides** ; route vers `/boutique?q=`.
- Historique local (`useRecentSearches`), suppression, effacement.
- **Pas de recherche de posts, carnets, clubs, membres.**

### 9.2 Signalement / modération

- Post → `comment_reports` avec `table_name='community_posts'` (`CommunityPostCard:1486-1497`).
- Commentaire → `comment_reports` (`:510-528`).
- Story → `story_reports`.
- Profil → `group_reports` (hors page).
- `community_moderation_queue` (vue) agrège les trois sources ; **aucun écran communauté ne
  l'expose** : la modération se fait ailleurs.

### 9.3 Navigation

- Barre globale 5 destinations (`destinationRegistry`), inchangée.
- `/communaute` n'a plus de plateau secondaire (`EXTENDED_NAV_PREFIXES` sans `/communaute`).
- Bottom nav masquée sur `/communaute/reels` et `/communaute/publier` (`MobileNavWrapper:23-48`).

---

## 10. Fonctions et handlers (index)

| Fonction | Fichier:ligne | Rôle | Dépendances |
|---|---|---|---|
| `handleTabSelect` | `page.tsx:52-60` | filtre + URL | `router.replace` |
| `fetchData` | `page.tsx:112-300` | 5 requêtes + profils + états perso | Supabase |
| `loadMorePosts` | `page.tsx:330-340` | recharge une fenêtre plus grande | `fetchData` |
| `handleJoinEvent` | `page.tsx:76-104` | RPC `join_event` | Supabase |
| `useCommunityTotals` | `features/community/useCommunityTotals.ts` | 3 counts | Supabase |
| `useOffline` | `MobileCommunityHub.tsx:59-73` | online/offline | navigateur |
| `usePullToRefresh` | `hooks/usePullToRefresh` | geste de refresh | tactile |
| `onOpen` tuile | `MobileCommunityHub.tsx` | set `activeItem` | `CommunityGrid` |
| `handleLike` | `CommunityPostCard:340-394` | RPC like + optimistic | RPC |
| `handleToggleSave` | `:553-580` | favori | `post_saves` |
| `handleSendComment` | `:625-678` | insert commentaire | `post_comments` |
| `handleLikeComment` | `:402-450` | like commentaire | `post_comment_likes` |
| `handleShare` | `:537-552` | partage/copie | Web Share API |
| `handleHidePost` | `:581-596` | masquage local | localStorage |
| `handleReport` | `:597-600` | ouvre ReportSheet | `comment_reports` |
| `forkVisibleKit` | `:176-196` | import kit | `/api/materiel/fork` |
| `loadComments` | `:206-290` | commentaires + profils | `post_comments` |
| `loadStories` | `CommunityStoriesBar:134-230` | stories + vues/likes/follows | 4 tables |
| `publishPendingStory` | `:376-444` | upload + insert | `stories-private` |
| `handleView` | `:446-461` | upsert vue | `story_views` |
| `handleToggleLike` | `:463-493` | like story | `story_likes` |
| `handleReply` | `:495-503` | réponse DM | `replyToStory` |
| `handleReport` (story) | `:505-524` | signalement | `story_reports` |
| `handleBlock` | `:525-541` | blocage | `user_blocks` |
| `handleDelete` (story) | `:543-580` | delete + storage | `post_stories` |
| `handlePublish` | `publier:447-648` | création | 4 tables + API |
| `uploadPublicationPhoto` | `:325-405` | upload public | `carnet-media` |
| `load` (découvrir) | `decouvrir:42-69` | pagination | `community_posts` |
| `fetchPage` (reels) | `reels:42-80` | pagination vidéos | `community_posts` |
| `toggleLike` (reels) | `reels:85-107` | RPC | RPC |
| `toggleSave` (reels) | `reels:109-133` | favori | `post_saves` |
| `share` (reels) | `reels:134-142` | partage | Web Share API |

---

## 11. Moteurs et services

| Moteur | Fichiers | Rôle | Entrées / sorties | Limites |
|---|---|---|---|---|
| Auth / session | `AuthContext`, `lib/supabase/client` | identité, invité | `user`, JWT | anonyme = lecture + restrictions |
| RLS audience | `20261015220000_community_post_audience_rls.sql` | public / abonnés / club + blocages | policies | non réimplémentée côté UI |
| Profils publics | vue `public_profiles` | identité publique, profils privés | `id, full_name, avatar_url, loyalty_level` | vue `security_invoker` |
| Compteurs | `useCommunityTotals` | 3 counts | posts/clubs/events | pas de cache, 3 requêtes |
| Social state | `post_likes`, `post_saves`, `post_comment_likes` | likes/favoris durables | par utilisateur | masquage local seulement |
| Commentaires | `post_comments`, `comment_reports` | fil, réponses, signalements | contenu texte | pas de média/GPX stocké |
| Stories V2 | `post_stories`, `story_*`, bucket `stories-private`, `/api/stories/[id]/media` | stories privées, 24 h, audience, archives | média signé | flag `stories_v2=false` non appliqué |
| Purge stories | `/api/cron/purge-stories` | supprime expirées non archivées | batches 200 | cron externe, secret |
| Notifications | `notifications` + triggers | like, commentaire, mention, carnet | in-app/email/push | pas de UI communauté |
| Récompenses | `/api/rewards/claim` → `claim_reward_points` | points de publication | action `post` | best-effort |
| Kit reproductible | `/api/materiel/fork` | copie un kit public | `linked_kit_id` | kit public uniquement |
| Snapshot carnet | trigger `snapshot_community_post_carnet` | fige le carnet dans le post | `snapshot_payload` | immuable |
| RSVP sortie | RPC `join_event`, triggers participants | inscription atomique | capacité/statut | membre ? non |
| Média | `stripImageMetadata`, `hasNativePhotos`, `pickNativePhotos`, `SmartImage`, `ImageViewer` | upload, EXIF, affichage | fichiers | médias privés refusés |
| Gestes | `useDoubleTap`, `useLongPress`, `framer-motion` | like double-tap, menu long-press | tactile | reduced motion partiel |
| Haptique | `useHapticFeedback` | retours | sélection/like | — |
| Hors-ligne | `OfflineBanner` | bandeau | `navigator.onLine` | pas de cache de fil |
| Recherche | `SearchOverlay`, `SearchContext` | produits/pays/guides | requête | pas de recherche sociale |
| Modération | `community_moderation_queue`, `is_moderateur` | file unifiée | 3 sources | pas d'écran communauté |
| Observabilité | `WebVitalsReporter`, console | perf/erreurs | global | pas d'analytics produit |

---

## 12. Base de données — tables, colonnes, RLS, triggers, index

### 12.1 `community_posts` — table centrale

| Colonne | Type | Rôle | Source |
|---|---|---|---|
| `id` | uuid PK | identifiant | `20260713120000:220` |
| `author_id` | uuid FK `user_profiles` | auteur | idem |
| `content` | text | texte (1–20 000) | `20261013210000:31` |
| `image_url` | text | première image (legacy) | base |
| `image_alt` | text | alt | base |
| `media_urls` | jsonb array (≤10) | médias | `20261014221000:2` |
| `post_type` | text CHECK `post|tip|question|share` | type | base — **`event` interdit** |
| `linked_carnet_id` | uuid FK | carnet lié | base |
| `linked_kit_id` | uuid FK | kit public | `20261014221000:4` |
| `snapshot_payload` | jsonb | carnet figé | `20260911530000:58` |
| `snapshot_at` | timestamptz | date du snapshot | idem |
| `snapshot_exclude_location` | boolean | retire les coordonnées | idem |
| `mentions` | uuid[] | mentions | `20261013150000:17` |
| `audience` | text CHECK `public|abonnies|club` | audience | `20261015220000:4` |
| `club_id` | uuid FK | club cible | idem |
| `client_request_id` | uuid | idempotence | `20261013210000:17` |
| `correlation_id` | uuid | chaîne aventure | `20260911500000:65` |
| `likes_count`, `comments_count`, `shares_count` | int | compteurs | base |
| `is_trending` | bool | mise en avant | base |
| `created_at`, `updated_at` | timestamptz | dates | base |

**RLS** : `community_posts_select_audience` (public / auteur / abonnés / club + blocages),
`auth_insert_community_posts`, `auth_update_own_community_posts`, `auth_delete_own_community_posts`.
**Index** : `idx_community_posts_created`, `_author`, `_linked_carnet`, `_correlation`,
`_linked_kit`, `community_posts_request_uniq` (auteur + clé), `_audience_club_index`.
**Triggers** : audience (`trg_community_post_audience`), média restreint
(`trg_community_post_restricted_media`), kit partagé (`trg_validate_community_post_shared_kit`),
snapshot carnet (`trg_snapshot_community_post_carnet`), partages (`trg_community_post_shares_count`),
mentions (`notify_post_mentions`).

### 12.2 Interactions

| Table | Colonnes clés | RLS | Triggers / notes |
|---|---|---|---|
| `post_likes` | `id, post_id, user_id, created_at` | lecture publique (garde parent), écriture own | `sync_community_post_likes_count`, notification like |
| `post_saves` | `id, user_id, post_id, created_at` | **lecture privée own**, insert/delete own | index user/created |
| `post_comments` | `id, post_id, author_id, content, parent_id, likes_count, created_at` | lecture publique (garde parent), insert/delete own | `guard_post_comment_parent_same_post` ; **pas de trigger likes_count** |
| `post_comment_likes` | `id, user_id, comment_id, created_at` | lecture publique (garde parent), own | compteur DB non maintenu |
| `post_shares` | `id, post_id, user_id, conversation_id, message_id, created_at` | own | trigger `shares_count` ; **non utilisé par l'UI** |
| `comment_reports` | `id, comment_id, reporter_id, reason, table_name, status, resolved_at/by` | insert own, modérateur read/update | `stamp_report_resolution` |
| `community_moderation_queue` | vue | modérateur | agrège comment/profil/story |

### 12.3 Stories

| Table | Colonnes clés | RLS | Notes |
|---|---|---|---|
| `post_stories` | `id, author_id, image_url, storage_bucket/path, media_type, mime_type, duration_ms, composition, visibility, club_id, expires_at, status, moderation_state, reply_policy, allow_reshare, archived_at` | public/own/club via `can_view_story` | 24 h, `stories-private`, purge |
| `story_views` | `story_id, viewer_id, last_viewed_at` | own/author | upsert au view |
| `story_likes` | `story_id, user_id` | own/author | — |
| `story_reports` | `story_id, story_author_id, reporter_id, reason, status, resolved_at/by` | own/modérateur | story peut expirer |
| `story_close_friends` | `owner_id, friend_id` | owner | audience close friends |
| `story_hidden_users` | `owner_id, hidden_user_id` | owner | masquer un viewer |
| `story_highlights` | `id, owner_id, title, cover_story_id, position` | lecture auth, écriture owner | albums |
| `story_highlight_items` | `highlight_id, story_id, position` | lecture auth, écriture owner | — |

### 12.4 Social / profils

| Table / vue | Colonnes clés | RLS | Notes |
|---|---|---|---|
| `user_follows` | `follower_id, following_id, created_at` | lecture publique, insert/delete own + policy follow_request | — |
| `follow_requests` | `requester_id, target_id, status, responded_at` | own/target | comptes privés |
| `user_blocks` | `blocker_id, blocked_id` | own (select/insert/delete) | filtre audience |
| `public_profiles` | vue `security_invoker` : `id, full_name, avatar_url, bio, location, website, trust_score, loyalty_*, xp, level, created_at, handle, cover_url, links` | filtre `profile_visibility` + invitations | auteurs |
| `user_profiles` | table source | RLS | — |

### 12.5 Carnets / clubs / groupes / sorties

| Table | Colonnes clés | RLS | Utilisée par |
|---|---|---|---|
| `carnets` | `id, author_id, title, destination, description, cover_image, visibility, tags, map_points, counters, created_at` | public / own / friends | grille + drawer carnet |
| `carnet_likes/comments/favorites/collaborators/gear_links` | cible + auteur + contenu | public/own | pages carnets |
| `carnet_media` | `carnet_id, url, type, caption, position` | page carnets | pas la grille |
| `clubs` | `id, slug, name, type, emoji, description, cover_image, category, privacy, members_count, created_by` | lecture public, manage owner | grille + drawer club |
| `club_members` | `club_id, user_id, role, status` | lecture public, manage own | membership + publication club |
| `club_join_requests` | `club_id, user_id, message, status, reviewed_by` | own | page club |
| `club_topics/replies/reports/challenges/events/kits` | voir `20260713120000_community_features.sql:131-220` | public/own | pages club |
| `travel_groups` | `id, name, description, destination, theme, cover_url, visibility, max_members, owner_id, created_at` | public/own | grille + drawer expédition |
| `group_members` | `group_id, user_id, role, status` | page groupe | non lu par le hub |
| `events` | `id, title, type, organizer_id, event_date, duration, location, max_participants, current_participants, description, cover_image, status` | lecture public, manage organizer | grille + drawer sortie |
| `event_participants` | `event_id, user_id, registered_at` | lecture/own | RPC `join_event` |

### 12.6 Brouillons, notifications, kits

| Table | Colonnes clés | RLS | Notes |
|---|---|---|---|
| `community_post_drafts` | `user_id PK, title, content, post_type, tags, location, audience, club_id, updated_at` | own | restauration + auto-save |
| `notifications` | `id, user_id, type, title, message, actor_id, related_type/id, link, read, read_at, channels_sent, "group"` | own | triggers like/comment/mention/carnet |
| `notification_preferences` | `user_id, notification_type, in_app/email/push` | own | pas de UI communauté |
| `notification_deliveries` | `notification_id, channel, status` | service | email/push |
| `materiel_kits` | `id, user_id, name, is_public` | RLS | kit lié + fork |
| `qa_questions/answers/votes`, `ama_*` | question, réponse, vote, session | public/own | **non utilisés par le hub** |

### 12.7 Storage

| Bucket | Public | Usage | Politique |
|---|---|---|---|
| `carnet-media` | oui | médias de publication (public) | upload auth, lecture publique |
| `stories-private` | non | stories V2 | chemins `{uid}/{storyId}/…`, lecture/upload/delete owner |
| `gear-photos` | oui | matériel | upload auth |
| `user-documents` | non | documents | own |
| `outing-media` | non | photos de sortie | owner |

### 12.8 RPC / fonctions

| Fonction | Rôle | Sécurité |
|---|---|---|
| `toggle_community_post_like(p_post_id)` | like/délike atomique | `SECURITY DEFINER`, authenticated |
| `join_event(p_event_id)` | inscription atomique (capacité, statut, compteur) | `SECURITY DEFINER`, authenticated |
| `can_view_story(story, viewer)` | contrôle central stories | `SECURITY DEFINER` |
| `notify(...)` | crée une notification + deliveries | `SECURITY DEFINER` |
| `sync_community_post_likes_count()` | recount likes | trigger |
| `sync_event_participants_count()` | recount participants | trigger |
| `claim_reward_points(...)` | points de publication | service role via API |
| `is_club_member`, `is_moderateur`, `is_admin`, `is_anonymous_session` | gardes | — |

### 12.9 APIs

| Route | Méthode | Rôle | Auth |
|---|---|---|---|
| `/api/stories/[id]/media` | GET | URL signée 120 s ou redirection legacy | session + RLS |
| `/api/rewards/claim` | POST | récompense de publication | session |
| `/api/materiel/fork` | POST | copie un kit public | session |
| `/api/cron/purge-stories` | GET | purge stories expirées | Bearer `CRON_SECRET` |

---

## 13. Matrice fonctionnalité × écran × donnée × test

| Fonctionnalité | Où | Table(s) | Trigger/RPC | Test | État |
|---|---|---|---|---|---|
| Fil / grille | hub | `community_posts` | RLS audience | visuel | OK |
| Filtres 6 espaces | hub | — | — | visuel | OK |
| Tuile → drawer | hub | 5 tables | — | visuel | OK |
| Totaux | héro | counts | — | manuel | OK |
| Like post | drawer/post | `post_likes` | RPC + trigger | contrat | OK |
| Favori | drawer/post | `post_saves` | — | contrat | OK |
| Commentaire | drawer/post | `post_comments` | garde parent | contrat | OK |
| Réponse | drawer/post | `post_comments.parent_id` | — | — | OK |
| Like commentaire | drawer/post | `post_comment_likes` | **aucun compteur** | — | partiel |
| Partager | drawer/post/reels | **aucune** (`post_shares` vide) | — | — | incomplet |
| Masquer | drawer/post/découvrir | localStorage | — | — | local |
| Signaler post/comment | drawer/post | `comment_reports` | modération | — | OK |
| Stories | héro | `post_stories` + 4 | `can_view_story` | contrat | OK |
| Story privée | stories | `stories-private` | API signée | — | OK |
| Archives / albums | stories | `story_highlights` | — | — | OK |
| Vues / masquer viewer | stories | `story_views`, `story_hidden_users` | — | — | OK |
| RSVP sortie | drawer | `events`, `event_participants` | `join_event` | — | OK |
| Carnet drawer | grille | `carnets` | RLS | — | OK |
| Club drawer | grille | `clubs` | RLS | — | OK |
| Expédition drawer | grille | `travel_groups` | RLS | — | OK |
| Publication | publier | `community_posts`, `events`, `community_post_drafts` | rewards | — | **bug event** |
| Brouillon | publier | `community_post_drafts` | — | — | OK auto |
| Découverte | découvrir | `community_posts` | — | visuel | OK |
| Reels | reels | `community_posts` | RPC like | visuel | OK |
| Recherche | header | `products/pays/guides` | — | — | **hors sujet** |
| Entraide | filtre | `qa_*` | — | — | **non branché** |
| Modération queue | — | `community_moderation_queue` | — | — | **pas d'UI** |

---

## 14. Tests existants

| Fichier | Portée | Tests |
|---|---|---|
| `tests/design/community-social-contract.spec.ts` | ordre média/actions/légende/commentaires, stories, header, CSS | 6 |
| `tests/design/community-audience-security.spec.ts` | audience, média privé, RLS club | 4 |
| `tests/design/community-reels-security.spec.ts` | reels | 5 |
| `tests/design/community-profile-messaging-link.spec.ts` | lien profil/messagerie | ? |
| `tests/community/discovery-media.spec.ts` | médias découverte | 5 |
| `tests/community/phase7-private-defaults.spec.ts` | défauts privés | 5 |
| `tests/community/social-media-reproduction.spec.ts` | reproduction média | 6 |
| `tests/visual/community-social.spec.ts` | matrice 393/430/768/1024/1440, grid/drawer | 5 |
| `tests/design/lot2-shell.spec.ts` | nav | 10 |
| `src/components/compte/drawer/__tests__` | drawers partagés | 211 |

**Manquent** : tests unitaires `CommunityGrid`, `CommunityContentDrawer`, `useCommunityTotals`,
`useCommunityHubData` (inexistant), e2e communauté, a11y axe, test du bug `post_type='event'`.

---

## 15. Ce qui est mort, faux ou incohérent (à trancher)

### P0 — correctness

1. **Publication d'un événement impossible** : `post_type='event'` viole le CHECK
   (`publier:597` vs `20260713120000:226`). La sortie est créée, le post échoue. Pas de transaction.
2. **« Charger plus » de la grille** : la grille plafonne à 30 (`CommunityGrid:150-160`) ; le
   bouton appelle `onLoadMorePosts` mais les tuiles restent 30. Bouton menteur.
3. **Masquage** : `CommunityPostCard` se cache, mais la **tuile de la grille reste** ; le drawer
   s'ouvre sur une carte qui renvoie `null`. Le masquage n'est pas appliqué à la grille.
4. **Like de commentaire** : `post_comment_likes` est écrit, mais `post_comments.likes_count`
   n'a **aucun trigger**. Le compteur DB ne bouge jamais.
5. **Partage** : le bouton ne crée aucune ligne `post_shares` ; `shares_count` reste à 0. Le
   trigger existe mais n'est jamais alimenté par l'UI.
6. **Commentaires média/GPX/position** : les boutons n'enregistrent que le **nom** du fichier ou
   les coordonnées dans le texte ; pas de colonne, pas d'upload. Promesse visuelle non tenue.
7. **Recherche** : bouton « Rechercher dans la communauté » → overlay produits/pays/guides →
   `/boutique?q=`. Aucune recherche sociale.

### P1 — UX / produit

8. **Le drawer de publication** réutilise la carte de fil, pas le modal Instagram du Compte.
9. **Entraide** : filtre → carte CTA ; aucune `qa_questions`, aucun contenu.
10. **`?post=`** n'ouvre le drawer que si le post est dans les 20 premiers chargés.
11. **Grille « Tout »** : les tuiles sans image (clubs/groupes) sont des aplats verts ; les
    sorties sont exclues (choix assumé) ; les images lazy laissent des tuiles vides.
12. **Commentaires** : ouverts inline dans la carte, pas dans une feuille dédiée ; le composer
    est visible pour les invités mais échoue à l'insertion.
13. **Stories V2** : flag `stories_v2=false` **non appliqué** ; les fonctionnalités V2 sont
    actives quand même.
14. **Découvrir** : pas d'auteurs, pas de tri, filtre local sur 24, pas de recherche serveur.
15. **Reels** : pas de commentaires inline, pas de son persistant, pas de modération.

### P2 — potentiel

16. **Carte vivante** (Compte) non transposée : la Communauté n'a pas de carte des massifs.
17. **Modération** : la file `community_moderation_queue` n'a pas d'écran.
18. **Notifications** : les triggers créent des notifications, mais le hub n'a pas de centre.
19. **Groupes/clubs** : la grille ouvre un drawer de lecture, pas un cockpit d'action.
20. **Recherche sociale** : posts, carnets, clubs, membres.

---

## 15 bis. Potentiel déjà en base mais non exploité

| Gisement | Table(s) / moteur | Ce qu'on pourrait en faire | Effort | Valeur |
|---|---|---|---|---|
| Entraide réelle | `qa_questions`, `qa_answers`, `qa_votes` | fil de questions terrain, réponses validées, votes | M | haute |
| Défis de clubs | `club_challenges`, `club_challenge_entries` | défis mensuels, classement interne | M | moyenne |
| Discussions de club | `club_topics`, `club_topic_replies` | espace de discussion dans le drawer club | M | moyenne |
| Albums À la une | `story_highlights`, `story_highlight_items` | vraies stories à la une sur le profil/hub | S | haute |
| Partage DM | `post_shares` (+ `post_shares` trigger) | partager un post dans une conversation, compteur réel | S/M | moyenne |
| Centre de notifications | `notifications`, `notification_preferences`, `notification_deliveries` | cloche, non-lus, préférences | M | haute |
| Modération | `community_moderation_queue`, `is_moderateur` | file unique, statut, résolution | M | haute (sécurité) |
| Géographie | `geo_massifs`, `hiking_routes.region`, `hike_sessions` | carte des massifs / sorties | L | haute (signature) |
| Kit reproductible | `materiel_kits`, `materiel_kit_items`, `/api/materiel/fork` | « Reproduire ce kit » déjà là, à exposer dans le drawer | S | moyenne |
| Récompenses | `claim_reward_points`, `reward_accounts` | points par publication, badges | M | moyenne |
| Événements réels | `events`, `event_participants`, `join_event` | sorties avec capacité, annulation, participants | S | haute |
| Feature flags | `feature_flags` (`stories_v2=false`) | rollout progressif réel | S | gouvernance |
| Carte | MapLibre + `geo_massifs` | « où la communauté marche » | L | différenciant |
| Profils publics | `public_profiles`, `follow_requests` | suivre/demander à suivre depuis un post | M | haute |

---

## 15 ter. Trois scénarios possibles

| Scénario | Contenu | Effort | Résultat |
|---|---|---|---|
| **A — Fiabiliser** | P0 : event, charger plus, masquage, compteurs, partage, recherche | 2–3 j | la page ne ment plus |
| **B — Social complet** | A + feuille commentaires, drawer post style Compte, entraide `qa_*`, recherche sociale, centre notifications | 6–10 j | la Communauté devient un vrai produit social |
| **C — Vitrine** | B + carte des massifs, albums à la une, modération, profils suivables | 15–20 j | la Communauté devient la pièce maîtresse |

---

## 16. Décisions à prendre (ce qu'on fait exactement)

| Priorité | Décision | Effort | Impact |
|---|---|---|---|
| P0 | Corriger `post_type='event'` (migration additive ou `share` + lien event) | S | publier un événement |
| P0 | Rendre « Charger plus » réel ou le supprimer | S | honnêteté |
| P0 | Filtrer les posts masqués dans la grille | S | cohérence |
| P0 | Trigger `post_comments.likes_count` | S | vérité des compteurs |
| P0 | Décider du partage : créer `post_shares` ou retirer `shares_count` | S/M | vérité |
| P0 | Recherche : la brancher sur la communauté ou renommer le bouton | M | attente |
| P1 | Feuille de commentaires dédiée (drawer) | M | UX |
| P1 | Drawer publication au style du modal Compte | M | design |
| P1 | Entraide : brancher `qa_questions` ou retirer le filtre | M | produit |
| P1 | Stories : appliquer le flag ou le retirer | S | gouvernance |
| P2 | Carte des massifs | L | signature visuelle |
| P2 | Centre de notifications | M | rétention |
| P2 | Écran de modération | M | sécurité |

---

## 17. Questions pour arbitrer

1. **Le partage doit-il compter ?** (créer `post_shares` à chaque partage) ou le compteur
   `shares_count` est-il décoratif ?
2. **Les commentaires doivent-ils être une feuille** (drawer) plutôt qu'inline ?
3. **L'entraide** doit-elle devenir un vrai fil `qa_questions` ou rester un lien ?
4. **La recherche** doit-elle chercher les contenus communautaires ou rester la boutique ?
5. **Le flag `stories_v2`** doit-il être respecté (feature flag) ou supprimé ?
6. **Le drawer publication** doit-il être le modal Instagram du Compte ?
7. **La carte** (massifs) doit-elle entrer dans le hub ?
