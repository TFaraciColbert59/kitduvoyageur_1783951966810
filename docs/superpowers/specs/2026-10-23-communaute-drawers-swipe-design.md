# Communauté v3 — « Pour toi », tiroirs et gestes

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun code écrit pour ce chantier
**Périmètre :** `/communaute` (fil, pillule, tiroirs de sections, stories, création, commentaires et partage sur la carte), plus la carte de post dans la messagerie.
**Références :** page `/compte` (pillule `#rpvis` + menu `vismenu`, drawer Compte, rings `.ig-hl`,
post modal `.pmi-*`), `/api/compte/share-post`, `MessageBubble`.
**Base :** le fil v2 déjà livré (`RAPPORT-FEED.md`). On conserve les posts carrés, la barre Compte,
le menu `···`, les gates invités et les actions vérifiées.

---

## 1. La décision

On transforme le fil en **page principale « Pour toi »** avec une navigation de communauté
compacte, et on remplace les feuilles basses de commentaires/partage par des **panneaux posés
exactement sur la carte du post**, ouverts au geste.

1. **Pillule en haut à gauche** : pastille **texte « Pour toi » + chevron**, sans avatar ni nom
   (comme la maquette screen 1). Clic → **menu déroulant en verre** (comme `vismenu` du Compte)
   avec **Carnets, Clubs, Sorties** ; le choix ouvre le demi-tiroir **sur l'élément cliqué**.
   À droite : `+` (création), **loupe** et **cloche**. La loupe ouvre **le même demi-tiroir** en
   mode recherche (champ en haut, résultats posts/carnets/clubs/sorties). La cloche ouvre le
   **drawer Notifications de la page Compte** via `/compte?tab=notifications`.
   La **pillule auteur sur chaque post** (screen 2) garde le verre actuel mais devient riche :
   avatar, nom, badge de confiance et ligne `lieu · spot · temps`.
2. **Tiroir de section** : sélectionner un item ouvre un **demi-tiroir bas** (50 % de l'écran,
   jamais plus) avec le **même sélecteur que la barre basse** : Pour toi, Carnets, Clubs, Sorties.
   Le tiroir permet d'ouvrir, rejoindre/quitter et créer sans changer de page.
3. **Commentaires** : clic sur le bouton commentaire (ou **swipe vers la droite** sur la carte) →
   panneau qui se **superpose exactement sur la carte complète du post**, glisse depuis la gauche,
   même rayon, même taille. Les commentaires, réponses, likes, mentions et signalements vivent là.
4. **Partage** : clic sur partager (ou **swipe vers la gauche**) → panneau qui se superpose
   exactement sur la carte, glisse depuis la droite, avec les **mêmes icônes que le Compte**
   (envoyer, copier, republier, partager) et l'envoi du **post complet** dans une conversation.
5. **Stories** : la première story est **toujours la nôtre**. Si on n'a rien publié : anneau vide
   avec `+`. Le contour coloré disparaît au profit du **ring sage du Compte**.
6. **Drawer de création** : refonte complète, même surface/forme que le tiroir de sections,
   grille de tuiles lisible — plus la liste serrée actuelle.
7. **Tous les drawers de la page** partagent la même forme : demi-tiroir 50 %, rayon 28, verre,
   poignée, en-tête, sélecteur 48 px, ombre et encre du Compte.
8. **Tous les boutons fonctionnent** : rejoindre un club, s'inscrire à une sortie, créer, ouvrir,
   commenter, répondre, aimer, mentionner, éditer, supprimer, signaler, copier, envoyer en message.

---

## 2. Anatomie cible

```
┌──────────────────────────────────────────────┐
│ Pour toi ⌄                        (+) (🔍) (🔔) │  pastille texte, création, recherche, cloche
│  ┌──────────────┐                            │
│  │ Carnets      │  ← menu déroulant verre    │
│  │ Clubs        │     (comme Compte)         │
│  │ Sorties      │                            │
│  └──────────────┘                            │
│  ◯ ◯ ◯ ◯ ◯   stories : la nôtre en premier   │
│  ┌────────────────────────────────────────┐  │
│  │ (av) Léa Martin  🛡88          (···)   │  │  carte post
│  │ Chamonix · Lac Blanc · 2 h             │  │  pillule auteur riche
│  │              PHOTO                     │  │
│  │                                        │  │
│  │                    (♥)(◻)(➤)           │  │
│  └────────────────────────────────────────┘  │
│  …                                            │
│  ╭────────────────────────────────────────╮  │
│  │ Explorer  Compas  Matériel  Hub  Compte│  │  barre Compte inchangée
│  ╰────────────────────────────────────────╯  │
└──────────────────────────────────────────────┘

Demi-tiroir (50 % max) :
┌──────────────────────────────────────────────┐
│                  ─────                       │
│  Explorer                            Fermer  │
│  ╭────────────────────────────────────────╮  │
│  │ Pour toi │ Carnets │ Clubs │ Sorties   │  │  sélecteur 48 px + lentille
│  ╰────────────────────────────────────────╯  │
│  listes scrollables, actions, CTA créer      │
└──────────────────────────────────────────────┘
```

**Panneau commentaires (sur la carte)** : glisse de gauche à droite, couvre `inset:0` de la carte,
même `border-radius:28`, fond verre `rgba(255,255,255,.88)` + blur 30, en-tête 44 px, liste scroll,
composer 40 px. **Panneau partage** : même cadre, glisse de droite à gauche, 4 actions + conversations.

---

## 3. Valeurs exactes reprises du Compte

| Brique | Valeur |
|---|---|
| Pillule page | verre `.pmi-author` sans avatar, texte « Pour toi » 600 13 px, chevron 14 px, padding 0 14, hauteur 40, radius 999, `--bar-glass-bg`, blur, `--bar-thumb-shadow` |
| Cloche | bouton rond 38 `.gbtn`, icône 18, badge non-lus 16 rouge `#B3261E` en haut à droite, lien `/compte?tab=notifications` |
| Pillule auteur post | verre, avatar 32 (anneau blanc), nom 13/700, badge `bouclier + score` 10.5, méta `lieu · spot · temps` 10.5, padding 4 10 4 4, min-height 44 |
| Menu déroulant | 240 px, radius 20, `rgba(255,255,255,.72)`, blur 30, inset blanc, 3 lignes 48 px, icône 18, titre 13/600 |
| Demi-tiroir | hauteur `50dvh` max, largeur colonne (520 desktop), rayon 28 en haut, fond `rgba(250,249,245,.96)`, blur 28, poignée 48×6, ombre `--bar-glass-shadow` |
| Sélecteur | 48 px, 4 cellules, lentille 40 px, labels `600 10px`, icônes 18, fond `--bar-glass-bg`, blur, ombre de la barre basse |
| Carte de section | ligne 64 px, icône/cover 40, radius 16, verre blanc 55 %, titre 13/600, sous-titre 11, action 44 px |
| Panneau post | `inset:0`, radius 28, fond verre blanc 88 % + blur 30, ombre inset 1 px, en-tête 44, composer 40 |
| Ring story | 64 px, padding 2, `linear-gradient(145deg, rgba(23,64,44,.55), rgba(91,127,85,.35), rgba(255,255,255,.85))`, inner 1.5 px blanc, ombre inset — **pas de conic-gradient** |
| Boutons | 44 px de cible ; icônes 18 ; like `#E0245E` ; encre `#17402C` ; secondaire `#56665D` |

Aucune couleur nouvelle. Aucun nouveau token.

---

## 4. La pillule « Pour toi » et le menu

### 4.1 Pillule de page

- Remplace `AccountAuthorPill` dans `CommunityFeedTopBar`.
- **Texte seul** : `Pour toi` + chevron ; **pas d'avatar** (la maquette screen 1 montre une pastille
  texte, et l'identité est déjà portée par la pillule auteur de chaque post).
- `aria-haspopup="menu"`, `aria-expanded`.
- Clic : ouvre le **menu déroulant** ancré dessous (pas le tiroir directement).
- Le libellé reste « Pour toi » ; c'est le nom de la page principale.

### 4.2 Pillule auteur du post (screen 2)

- Remplace la pastille `avatar + nom + @handle` actuelle, posée en haut à gauche de la carte.
- Contenu :
  - avatar 32 dans un anneau blanc ;
  - nom 13/700 ;
  - badge de confiance `bouclier + score` (ex. 88) dans une capsule translucide ;
  - deuxième ligne `lieu · spot · temps` (ex. `Chamonix · Lac Blanc · 2 h`).
- Données : `author.trust_score`, `author.location`, `post.title` (ou `image_alt`) et `timeAgo`.
  Si le lieu manque : `@handle · temps`. Si le spot manque : `lieu · temps`.
- Même verre que le reste : `--bar-glass-bg`, blur, `--bar-thumb-shadow`, encre `#17402C`.
- La pillule garde le lien vers `/profil/[author_id]` et ne doit pas déclencher le like de l'image.

### 4.2 bis Toutes les cartes au même format

- **Toutes** les cartes du fil — photo, vidéo, texte — ont exactement le même format :
  `aspect-ratio: 1/1`, même largeur, même hauteur, radius 28. La carte photo est la référence.
- Un post **texte** ne s'étire plus : fond de la carte Compte (`rgba(255,255,255,.62)` + blur 25),
  texte 15/1.42, padding `58px 18px 64px`, `overflow:hidden`, dégradé de fin. Le texte long est
  tronqué visuellement ; le texte complet reste lisible dans l'en-tête du panneau commentaires.
- Plus de `height:auto`, plus de `max-height:100cqw`, plus de `min-height:120px` : le carré est
  la seule taille.
- Les panneaux commentaires/partage couvrent donc toujours un carré identique, avec les mêmes
  dimensions au pixel.

### 4.3 Menu déroulant

- `role="menu"`, largeur 240, verre, ombre, 3 items : **Carnets, Clubs, Sorties**.
- Chaque item : icône 18, titre 13, sous-titre 10.5 (`Parcourir`, `Rejoindre`, `Participer`), chevron.
- Fermeture : clic extérieur, `Échap`, sélection.
- Sélection → ferme le menu et ouvre le **demi-tiroir** sur l'onglet choisi.

### 4.4 Demi-tiroir de sections

- Ouvre du bas, **hauteur 50dvh max** (`height:50dvh; max-height:50dvh`), jamais extensible.
- Poignée, en-tête « Explorer » + fermeture, **sélecteur 4 onglets** (Pour toi, Carnets, Clubs, Sorties).
- « Pour toi » ferme le tiroir et rend le fil (c'est la page principale) ; les autres onglets
  affichent leur liste.
- Le sélecteur est le **même composant** que la barre basse : 48 px, 4 cellules, lentille 40,
  icônes 18, labels 10. Une seule différence : 4 cellules au lieu de 5.
- Le tiroir ne bloque pas la barre basse : il se superpose au-dessus, la barre reste derrière.
- Contenu scrollable, `overscroll-behavior: contain`, padding bas safe-area.
- **Recherche dans le même tiroir** : champ autofocus sous le sélecteur ; requête ≥ 2 caractères ;
  résultats groupés posts / carnets / clubs / sorties ; clic → ressource. Le bouton loupe du top bar
  ouvre ce tiroir avec le champ focalisé ; le sélecteur reste visible.

### 4.5 Sections

#### Carnets
- `carnets` publics (`visibility='public'`) + les miens, 6 max, tri `created_at desc`.
- Ligne : cover 40, titre, auteur + date, badge `Public`/`Mien`, chevron.
- Actions : ouvrir `/carnets/[id]`, `Créer un carnet` → `/carnets/nouveau`, `Tout voir` → `/carnets`.
- Pas de like dans le tiroir : la page carnet le gère.

#### Clubs
- `clubs` triés `members_count desc` + appartenance `club_members` de l'utilisateur.
- Ligne : logo/cover 40, nom, `N membres` + catégorie, badge `Membre`.
- Actions : ouvrir `/clubs/[id]` ; **Rejoindre** (insert `club_members`, `members_count + 1`) ;
  **Quitter** (delete, `members_count - 1`) ; `Créer un club` → `/clubs/nouveau` ; `Tout voir` → `/clubs`.
- Invité : rejoindre → connexion. Erreur RLS → toast et rollback.

#### Sorties
- `events` à venir (`event_date >= today`, statut non annulé), 6 max, tri date.
- Ligne : bloc date (jour/mois), titre, lieu + participants, badge `Inscrit`.
- Actions : ouvrir `/evenements` ; **Rejoindre** / **Quitter** via RPC `join_event` / `leave_event` ;
  `Créer une sortie` → `/voyages` ; `Tout voir` → `/evenements`.
- Invité : rejoindre → connexion.

#### Pour toi
- Ferme le tiroir (retour au fil). Le sélecteur le indique comme destination, pas comme contenu.

#### Filtres et détail (inspiré screen 3)
- Chaque section a une **rangée de filtres 30 px** sous le sélecteur :
  Carnets `Découvrir / Mes carnets`, Clubs `Découvrir / Mes clubs`, Sorties `À venir / Mes sorties`.
- Un tap sur une ligne ouvre un **détail dans le même demi-tiroir** (pile liste → détail) :
  couverture 84 px, titre, méta, 2–3 stats, description 3 lignes, action primaire
  (Rejoindre / S'inscrire / Lire), lien secondaire « Voir la page ».
- Bouton retour dans l'en-tête du détail ; le sélecteur reste visible ; changer d'onglet
  réinitialise le détail.
- La maquette screen 3 sert d'inspiration (hiérarchie cover/titre/stats/action), pas de copie :
  on garde le demi-tiroir 50 %, pas les écrans pleine page ni les sections Expéditions/Entraide.

---

## 5. Stories

- Ordre : **notre story en premier**, puis les autres.
- Si aucune story : première tuile = anneau **vide** + `+`, libellé « Votre story » ; clic → sélecteur.
- Si story : première tuile = notre anneau + avatar ; clic → viewer ; le `+` séparé en fin de rail
  est supprimé (la création reste dans le drawer `+` et la tuile vide).
- Ring : sage/verre du Compte, **plus de conic-gradient** ; vu = verre blanc, non vu = sage.
- Taille : 64 px dans le rail, labels 10.5 ; le viewer, les archives et les vues existants restent.
- La story « Votre story » ne doit plus être un doublon en fin de rail.

---

## 6. Drawer de création

- Même `CommunityDrawer` 50dvh, même poignée/en-tête/verre que les sections.
- En-tête : « Créer » + « Choisis un format » + fermeture.
- Grille **2 colonnes** :
  - Carnet, Sortie GPS, Kit, Club (4 tuiles 108 px) ;
  - Story en **tuile pleine largeur** (fond forêt, icône caméra, texte blanc).
- Tuile : icône 44 dans un carré verre, titre 14/700, sous-titre 10.5/1.3, badge ou chevron.
- Destinations inchangées : `/carnets/nouveau`, `/voyages`, `/materiel`, `/clubs/nouveau` ;
  story → sélecteur de story.
- Plus de liste serrée de 5 lignes : hiérarchie, respiration, icônes lisibles.

---

## 7. Panneaux sur la carte (commentaires / partage)

### 7.1 Cadre commun

- `position:absolute; inset:0; border-radius:28px; overflow:hidden; z-index:12`.
- Largeur/hauteur **exactement** celles de la carte (mesurées au pixel).
- Fond `rgba(255,255,255,.88)` + `backdrop-filter: blur(30px) saturate(1.8)`.
- `role="dialog"`, `aria-modal="true"`, focus trap, `Échap` ferme.
- Entrée : commentaires `translateX(-100%) → 0` (glisse vers la droite) ;
  partage `translateX(100%) → 0` (glisse vers la gauche).
- Sortie : geste inverse ou bouton fermer.
- Le geste est capté sur la carte : `pointerdown/move/up`, seuil 64 px, axe horizontal
  prioritaire ; un mouvement < 8 px reste un tap (like image).
- Pendant l'ouverture : le menu `···` et la capsule d'actions sont masqués/sous le panneau.

### 7.2 Commentaires

- En-tête 44 : titre « Commentaires » + nombre + fermer.
- Liste scrollable : avatar 28, nom 12, texte 12.5, temps 10, actions like/répondre/éditer/supprimer/
  signaler ; réponses indentées.
- Composer 40 : input, bouton envoyer, **mention** `@` (voir §8).
- Gates invité/essai : composer remplacé par « Se connecter / Créer un compte ».
- Le panneau lit les mêmes données `post_comments` / `post_comment_likes` que le fil v2.
- Like de commentaire : optimistic corrigé (calcul hors setter), rollback sur erreur.

### 7.3 Partage

- En-tête 44 : « Partager » + fermer.
- Rangée de 4 actions avec **les icônes du Compte** :
  1. Envoyer en message (`send`)
  2. Copier le lien (`link`)
  3. Republier (`share`)
  4. Partager… (`share` natif / copie)
- Sous la rangée : **conversations** (`GET /api/compte/share-post`) — avatar, titre, type, bouton
  « Envoyer » ; envoi `POST` avec `postId` + `conversationId` ; toast ; fermeture.
- Aucune conversation : « Aucune conversation » + lien `/messagerie`.
- Invité : actions → connexion.
- Le message envoyé est un **post complet** dans la messagerie (§9), pas un simple texte.

---

## 8. Mentions « identifier quelqu’un »

Décision : **mention inline dans les commentaires**, sans nouvelle table.

- Le composer propose un picker `@` : recherche `public_profiles` (handle/nom, 5 max), avatar + nom.
- La sélection insère un token `@[Nom](uuid)` dans le contenu.
- Le rendu transforme le token en lien `@Nom` → `/profil/[uuid]`.
- Les commentaires existants en texte simple restent lisibles ; pas de migration.
- Taper l’avatar/nom d’un commentaire ouvre aussi le profil.
- Les notifications de mention ne sont **pas** incluses dans ce chantier (décision à confirmer).

---

## 9. Envoi du post complet dans la messagerie

- `MessageType` ajoute `'post'` ; `PostMessageMeta` = `{ post_id, post_url, title, image_url,
  author_name, author_avatar }`.
- `/api/compte/share-post` (réutilisée) :
  - `GET` : conversations de l’utilisateur.
  - `POST` : **vérifie l’appartenance** à la conversation, lit le post (RLS), insère
    `messages.message_type='post'` + metadata, puis `post_shares`.
  - `post_url` devient `/communaute?post=<id>`.
- `MessageBubble` rend `PostMessageCard` : image 160×100, auteur, titre/extrait, lien
  « Voir la publication » ; même verre que le fil.
- Le panneau partage utilise cette API ; le destinataire voit la carte complète.
- Pas de migration : `messages.message_type` est un TEXT sans CHECK ; le type TS est étendu.

---

## 10. Architecture des fichiers

```
src/features/community/sections/
  CommunitySectionsDrawer.tsx      (demi-tiroir + nav)
  CommunityTabSelector.tsx         (4 cellules, lentille, style barre)
  PourToiMenu.tsx                  (menu déroulant de la pillule)
  useCommunitySections.ts          (carnets, clubs, sorties)
  sections/CarnetsSection.tsx
  sections/ClubsSection.tsx
  sections/SortiesSection.tsx
  SectionRow.tsx
  SectionDetail.tsx
src/features/community/feed/
  CommunityDrawer.tsx              (coquille 50dvh partagée)
  CommunityCreateDrawer.tsx        (refonte création)
  CommunityFeedTopBar.tsx          (pillule « Pour toi »)
  PostAuthorPill.tsx               (pillule auteur riche, screen 2)
  CommunityFeedPost.tsx            (gestes + panneaux)
  PostCommentsPanel.tsx            (remplace CommunityCommentsSheet)
  PostSharePanel.tsx
  useHorizontalSwipe.ts
  mention-utils.ts                 (token, parse, rendu)
  usePostShareTargets.ts
src/features/messaging/components/cards/PostMessageCard.tsx
src/features/messaging/types/messaging.types.ts
src/app/api/compte/share-post/route.ts
src/components/communaute/CommunityStoriesBar.tsx
src/styles/community-drawers.css
```

Supprimés/remplacés : `CommunityCommentsSheet.tsx` (feuille basse), `AccountCreateSheet.tsx`
(ancienne liste), la pillule identité du top bar (remplacée par la pastille texte « Pour toi »),
l'ancienne pastille auteur simple (remplacée par `PostAuthorPill`), le `commentsPost` global du
`CommunityFeed`.

---

## 11. Données et actions

| Besoin | Source | Action |
|---|---|---|
| Carnets | `carnets` (`visibility='public'` + miens) + `public_profiles` | ouvrir, créer |
| Clubs | `clubs`, `club_members` | ouvrir, rejoindre/quitter, créer |
| Sorties | `events`, `event_participants` | ouvrir, RPC `join_event`/`leave_event`, créer |
| Commentaires | `post_comments`, `post_comment_likes` | envoyer, répondre, liker, éditer, supprimer, signaler |
| Mentions | `public_profiles` (recherche) + token dans le contenu | insérer, rendre cliquable |
| Partage | `GET/POST /api/compte/share-post`, `post_shares` | envoyer, copier, republier |
| Message post | `messages` (`message_type='post'`) + metadata | carte `PostMessageCard` |
| Stories | `post_stories` + storage | ordre, ring, viewer, archives |

Aucune nouvelle table, aucune nouvelle colonne. Aucune migration.

---

## 12. États, accessibilité, gestes

- Tiroir : focus sur le premier onglet, `Échap` ferme, clic extérieur ferme, focus rendu.
- Menu : `role=menu`, navigation clavier, `aria-expanded` sur la pillule.
- Panneaux : focus trap, `aria-modal`, retour du focus au bouton d’origine.
- Swipe : seuil 64 px, axe horizontal, `touch-action: pan-y` sur la carte ; tap < 8 px = like.
- `prefers-reduced-motion` : transitions instantanées, pas de rebond.
- Tiroir 50dvh : jamais plus haut ; contenu scrollable ; `overscroll-behavior: contain`.
- Cibles 44 px ; labels explicites ; contraste verre/encre du Compte.
- Invité : lecture, menus et listes ; actions d’écriture → connexion.
- Erreur réseau : ligne d’erreur + réessayer ; pas de disparition silencieuse.

---

## 13. Nettoyage

- Supprimer la feuille basse `CommunityCommentsSheet` et son état `commentsPost` dans `CommunityFeed`.
- Remplacer `AccountCreateSheet` par `CommunityCreateDrawer` (même route, nouveau design).
- Supprimer le conic-gradient des stories et le `+` de fin de rail.
- Conserver `AccountAuthorPill` pour les auteurs de posts (pas pour le top bar).
- Conserver les 5 pages métier ; ne plus les lier depuis la Communauté.
- Tests v2 à mettre à jour : le commentaire n’ouvre plus une `Sheet` mais un panneau sur la carte ;
  la pillule ne contient plus le nom.

---

## 14. Preuves attendues

- E2E : menu 3 items ; tiroir 50dvh mesuré ; 4 onglets ; rejoindre club/sortie ; créer ;
  panneau commentaires exactement superposé (bounding boxes) ; swipe droite/gauche ; envoi message ;
  carte post dans la messagerie ; mention ; story nôtre en premier ; ring sans conic.
- Visuel : 393/430/768/1440, clair/sombre, tiroirs ouverts, panneaux ouverts.
- Unit : swipe, parse mentions, API membership, `PostMessageCard`.
- `tsc` 0, build 0, tests existants verts.

---

## 15. Décisions à confirmer

| # | Décision | Défaut |
|---|---|---|
| D1 | « Identifier quelqu’un » = mention `@` inline (sans notifications) | oui, §8 |
| D2 | Pillule = menu déroulant, puis demi-tiroir (les deux) | oui, §4 |
| D3 | « Pour toi » dans le tiroir ferme le tiroir (retour au fil) | oui |
| D3b | Toutes les cartes (texte compris) = carré 1:1, hauteur unique | oui, §4.2 bis |
| D4 | Envoi en messagerie = carte post complète (`message_type='post'`) | oui, §9 |
| D5 | Tous les bottom drawers = 50dvh max, même coquille | oui |
| D6 | Panneaux commentaires/partage = sur la carte, pas des feuilles basses | oui |
| D7 | Pas de migration (mentions inline, message_type TEXT) | oui |
| D8 | Boutons en haut à droite | **`+` + loupe + cloche**. La loupe ouvre le même demi-tiroir en mode recherche ; la cloche ouvre `/compte?tab=notifications` (drawer Notifications du Compte). |
| D9 | Libellé de la pastille : `Pour toi` (brief) ou `Pour vous` (maquette screen 1) | **Pour toi**, le brief est explicite. Le libellé reste une constante unique, bascule en une ligne si tu préfères `Pour vous`. |
