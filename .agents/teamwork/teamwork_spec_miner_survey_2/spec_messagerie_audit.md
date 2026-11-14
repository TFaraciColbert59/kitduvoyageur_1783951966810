# Spécification Technique & Audit Approfondi : Page Messagerie (`/messagerie`)
**Référence matériel** : iPhone 16 Pro physique (UDID `00008140-000E7D081A0B001C`, iOS 18)  
**Dimensions de référence** : Écran 402 × 874 pt (résolution Retina @3x : 1206 × 2622 px)  
**Date d'audit** : 14 novembre 2026  
**Sources analysées** : Section 5 d'`audit_complet_iphone.md`, 14 captures d'écran réelles (`00-messagerie-main.png` à `09-messagerie-message-longpress.png`), 5 arbres d'accessibilité XCUITest (`*.xml`), code source (`MessagesScreen.tsx`, `messages-grammar.css`, `AccountDrawerHost.tsx`, `useConversations.ts`, `useMessages.ts`, `ComposerMenuSheet.tsx`, etc.).

---

## 1. Executive Summary & Objectifs

L'audit de la page Messagerie (`/messagerie`) sur iPhone 16 Pro physique a mis en évidence des défauts architecturaux et ergonomiques majeurs qui dégradent l'expérience utilisateur et violent les recommandations officielles **Apple Human Interface Guidelines (HIG)** ainsi que la charte graphique **LKDV Green Palette (zéro noir pur `#000000`)** :

1. **Rupture de navigation intempestive vers `/compte`** : Le clic sur l'en-tête « Messages » ou la cloche de notification redirige directement vers `/compte`, avec un flash de tiroir noir charbon `#0d1117`.
2. **Superposition physique de la pilule de filtres (`SubCapsuleTabs`)** : La pastille flottante `Toutes / Directs / Groupes / Demandes` (`y=346..376`) flotte directement par-dessus la 4e discussion (`Dolomites — août`, `y=337..393`), masquant titre, aperçu et date.
3. **Collision de coordonnées dans le split view 40/60** : 
   - La poignée de redimensionnement (`msplit`, `x=157..245`) chevauche la pastille de contact (`mpill`, `x=12..201`) de **44 px** sur les groupes.
   - La première bulle de message (`y=338`) passe sous l'en-tête et sous la poignée de drag (`y=394..446`).
4. **Anomalie critique de placement des tiroirs (`y=114..386` au lieu de bottom sheet)** :
   - Le menu « Partager dans le chat » (`ComposerMenuSheet`, déclenché en bas à `y=728`) s'ouvre tout en haut (`y=110..386`) par-dessus la liste des conversations avec une hauteur tronquée à 276 px, coupant la 3e option et masquant complètement « Équipement » et « Kit ».
   - La fiche d'options (`ConversationOptionsSheet`) s'ouvre également à `y=110..386` sans bouton de fermeture et avec un bouton « Écrire un message » redondant.
5. **Gel sur squelettes gris dans les conversations de groupe** : Ouvrir un groupe réinitialise `loading=true` dans `useConversations` via les signaux Realtime de lecture, bloquant la liste supérieure sur 4 squelettes gris ou une ligne fantôme à 30 % d'opacité.
6. **Erreur « Publication indisponible » et cartes brisées** : Échec de résolution des posts partagés dans les discussions de groupe avec carte d'erreur grise et troncature d'image.
7. **Barre de réactions et d'actions dégradée sur appui long** : L'appui long insère une barre en ligne dans le flux DOM qui s'étend sur 2 lignes (3 boutons + 6 emojis), décalant la conversation vers le bas et rognant les emojis.
8. **Contraste illisible et états vides en doublon** : L'onglet « Demandes » affiche simultanément deux états vides l'un sur l'autre, avec un bouton « Nouvelle discussion » affichant du texte vert foncé sur fond vert foncé (contraste < 1.1:1).

---

## 2. Tableau des Fonctionnalités Découvertes (Features Discovered)

| # | Catégorie | Fonctionnalité | Description | Entrées (Inputs) | Sorties (Outputs) | Comportement d'Erreur (Error Behavior) | Découvert Via |
|---|-----------|----------------|-------------|------------------|-------------------|----------------------------------------|---------------|
| 1 | Navigation Header | Bouton Titre « Messages » | Bouton en haut à gauche de la barre supérieure (`x=12, y=69, w=97, h=34`) | Tap utilisateur | `router.push('/compte')` (redirection involontaire) | Flash noir `#0d1117`, quitte `/messagerie` pour `/compte` | `00-messagerie-main.png`, `messagerie-tree.xml:1471` |
| 2 | Navigation Header | Cloche « Notifications » | Bouton rond en haut à droite (`x=352, y=67, w=38, h=38`) | Tap utilisateur | `<Link href="/compte?tab=notifications">` | Quitte `/messagerie`, flash sombre vers `/compte` | `01-messagerie-tab-notifications.png`, `NotificationBell.tsx:29` |
| 3 | Recherche | Barre de recherche discussions | Champ `<input type="search">` (`x=65, y=118, w=303, h=38`) | Frappe texte (>= 2 car.) | Filtrage liste discussions + recherche personnes/messages | Bouton effacer « x » n'apparaît que si texte saisi | `messagerie-tree.xml:1484`, `MessagesScreen.tsx:1484` |
| 4 | Filtrage | Pastille de filtres flottante | Sélecteur `Toutes / Directs / Groupes / Demandes` (`x=182, y=346, w=196, h=30`) | Tap sur un filtre | Filtre `visible` conversations + animation glissement | Chevauchement physique complet de la 4e ligne de conversation | `00-messagerie-main.png`, `02-messagerie-toutes.png`, `messages-grammar.css:995` |
| 5 | Liste Conversations | Cartouche de conversation | Rangée de conversation (`x=22, w=358, h=56`) | Tap (sélection), swipe droit (supprimer/muet), appui long | Ouvre la conversation dans la zone 60% | Seulement 3,5 rangées visibles à l'écran dans le split 40% | `00-messagerie-main.png`, `messagerie-tree.xml:22` |
| 6 | Split View | Poignée de redimensionnement | Séparateur horizontal `msplit` (`x=157, y=396, w=88, h=22`) | Drag vertical pointer / double-tap | Modifie `--msg-split` (clampé entre 140 et max) | Collision avec la pastille de contact (`mpill`) de 44 px | `04-messagerie-conv-camille-rochat.png`, `06-messagerie-conv-groupe-bivouac.png`, `messages-grammar.css:1909` |
| 7 | État Vide | Zone 60% sans sélection | Bloc vide occupant 60% de l'écran (`y=394..874`) | N/A (aucun chat sélectionné) | Texte « Choisissez une discussion » + bouton « Nouvelle discussion » | 60% de l'écran gaspillé sur du vide pendant que la liste est compressée | `00-messagerie-main.png`, `messagerie-tree.xml:519` |
| 8 | Filtre Demandes | Vue filtre « Demandes » | Onglet 4e icône `bell` (`x=327, y=348, w=49, h=26`) | Tap sur Demandes | Affiche les conversations en attente (`status === 'pending'`) | Affiche 2 états vides en doublon + bouton au contraste illisible | `02-messagerie-filter-demandes.png`, `MessagesScreen.tsx:1599` |
| 9 | Action Création | Bouton « Nouvelle discussion » | Bouton vert dans l'état vide (`x=117, y=603, w=168, h=38`) | Tap utilisateur | Exécute `focusSearch` (`searchRef.current?.focus()`) | Ne permet pas de choisir un contact directement ; trompe l'utilisateur | `03-messagerie-nouvelle-discussion-tap.png`, `MessagesScreen.tsx:1439` |
| 10 | En-tête Chat | Pastille contact conversation | Capsule `mpill` (`x=12, y=402, w=148..189, h=44`) | Tap utilisateur | `selected.type === 'direct' ? setProfileDrawerUser : setOptionsConv` | Masque le premier message échangé ; collision de 44 px avec la poignée drag | `04-messagerie-conv-camille-rochat.png`, `06-messagerie-conv-groupe-bivouac.png` |
| 11 | Fil de Discussion | Historique des messages | Conteneur défilant `.mthread` (`y=452..721`) | Défilement tactile | Affiche bulles, photos, partages, accusés de lecture | Premier message défile sous l'en-tête sans padding de dégagement | `messagerie-conv-camille-tree.xml:452`, `MessagesScreen.tsx:499` |
| 12 | Fil de Discussion | Partage de publication | Composant `<SharedPostEmbed>` dans une bulle | `message_type === 'post'` | Rendu miniature d'un post communautaire | Échoue avec badge gris « Publication indisponible » si ID non résolu | `06-messagerie-conv-groupe-bivouac.png`, `SharedPostEmbed.tsx:56` |
| 13 | Fil de Discussion | Image partagée | Bulle image dans la discussion | `message_type === 'image'` | Rendu image avec zoom/aperçu | Image tranchée net horizontalement par overflow mal calibré | `06-messagerie-conv-groupe-bivouac.png`, `audit_complet_iphone.md:325` |
| 14 | Saisie / Composer | Barre de rédaction basse | Champ de saisie + vocaux + pièces jointes (`y=721..767`) | Frappe, tap micro, tap `+`, tap envoi | Envoi optimiste du message via `messagingService` | Barre calée à 12px au-dessus de la TabBar native | `messagerie-conv-camille-tree.xml:721`, `MessagesScreen.tsx:1730` |
| 15 | Tiroir Composer | Tiroir « Partager dans le chat » | Bouton `...` / `+` (`x=316, y=728, w=38, h=38`) | Tap utilisateur | Ouvre `<ComposerMenuSheet>` (Photo, GPX, Randonnée, etc.) | S'ouvre en HAUT (`y=110..386`) au lieu du bas ; tronque les 2 dernières options | `07-messagerie-composer-menu-sheet.png`, `messagerie-composer-menu-tree.xml:110` |
| 16 | Tiroir Options | Fiche options conversation | Tap sur pastille contact en haut de conversation | Tap utilisateur | Ouvre `<AccountDrawerHost variant="card">` | S'ouvre en HAUT (`y=110..386`) sans croix de fermeture ; bouton redondant | `08-messagerie-conversation-options-sheet.png`, `messagerie-conv-options-tree.xml:110` |
| 17 | Actions Message | Menu contextuel message | Appui long sur une bulle de message (`longPress`) | Long press pointer (500 ms) | Affiche 3 boutons + 6 emojis de réaction | Inséré dans le flux DOM (non flottant), casse sur 2 lignes, clipse les emojis | `09-messagerie-message-longpress.png`, `MessagesScreen.tsx:798` |
| 18 | Gestion Réseau | Accusés de lecture & Realtime | Hooks `useConversations` et `useMessages` | Événement Postgres Changes Supabase | Met à jour messages et compteurs unread | Background re-fetch réinitialise `loading=true` et fige la liste en squelettes | `06-messagerie-conv-groupe-bivouac.png`, `useConversations.ts:39` |

---

## 3. Tableau des Cas Limites (Edge Cases)

| # | Fonctionnalité | Entrée (Input) | Comportement Observé (Observed Behavior) | Impact Utilisateur & Sévérité |
|---|----------------|----------------|------------------------------------------|--------------------------------|
| 1 | Navigation Header | Tap sur bouton « Messages » (`x=12, y=69`) | Déclenche `router.push('/compte')`, affichant un écran noir de transition (`#0d1117`) pendant 400 ms. | **Critique** : L'utilisateur perd son contexte de discussion sans l'avoir demandé. |
| 2 | Navigation Header | Tap sur l'icône cloche Notifications (`x=352, y=67`) | Navigue vers `/compte?tab=notifications` et quitte la messagerie. | **Majeur** : Rupture du parcours de consultation de messagerie. |
| 3 | Filtres de discussion | Affichage de 4 conversations ou plus dans la liste | La capsule flottante `Toutes ▾` à `x=182, y=346` recouvre la 4e rangée (`Dolomites — août`). | **Majeur** : Impossibilité de lire le dernier message et risque de fausse touche. |
| 4 | Filtre Demandes | Clic sur l'onglet `Demandes` sans invitation en attente | Double état vide simultané (« Aucune discussion » en haut et « Choisissez une discussion » en bas). | **Moyen** : Pollution visuelle et confusion sur l'état de l'application. |
| 5 | Bouton Nouvelle discussion | Tap sur « Nouvelle discussion » dans l'état vide | Met le curseur dans l'input de recherche existant (`msearch`). | **Majeur** : Empêche la création intuitive d'une conversation avec un contact externe. |
| 6 | Split View | Ouverture d'une conversation de groupe à 5 membres (`Bivouac de printemps`) | La pastille de contact (`w=189`) recouvre la poignée de redimensionnement (`x=157..245`) sur 44 px. | **Majeur** : Collision visuelle inacceptable et interférence tactile sur le drag handle. |
| 7 | Défilement du chat | Arrivée sur une conversation avec historique | La première bulle de message est partiellement masquée sous l'en-tête `mpill` et `msplit` à `y=338`. | **Moyen** : Rognage du texte du message initial. |
| 8 | Conversations de groupe | Sélection d'un groupe avec 5 participants | La liste supérieure se vide et se fige sur 4 squelettes gris en boucle pendant le chargement des membres. | **Bloquant** : Donne l'illusion d'un crash ou d'un bug réseau persistant. |
| 9 | Cartes partagées | Message contenant un partage de publication sans UUID valide ou restreint par RLS | Affiche un rectangle gris « Publication indisponible » et tronque l'image adjacente. | **Moyen** : Expérience dégradée sans possibilité de rafraîchir ou d'ouvrir le lien parent. |
| 10 | Menu Pièces jointes (`+`) | Tap sur l'icône `+` dans la barre de saisie basse (`y=728`) | Le tiroir s'ouvre à `y=110` en haut de l'écran avec une hauteur bridée à 276 px. | **Critique** : Violation des lois Fitts/HIG ; « Équipement » et « Kit » deviennent invisibles. |
| 11 | Options de discussion | Tap sur le nom du contact dans l'en-tête | Ouvre une fiche contact à `y=110` sans bouton « Fermer », avec un bouton « Écrire un message » inutile. | **Majeur** : Aucune option de gestion de conversation (silence, blocage, suppression, signalement). |
| 12 | Réactions sur message | Appui prolongé (> 500 ms) sur une bulle de message | Les 9 éléments (3 actions + 6 emojis) se cassent sur 2 lignes dans le flux DOM et décalent le chat. | **Majeur** : Saut brusque du layout et rognage des émojis en haut/bas de fenêtre. |
| 13 | Clavier virtuel iOS | Ouverture du clavier logiciel sur la barre de rédaction | Si `--kb-inset` est mal propagé, la barre passe sous le clavier ou sous la TabBar native. | **Bloquant** : Empêche la saisie de texte sur appareil physique. |

---

## 4. Analyse Géométrique & Cartographie des Coordonnées (iPhone 16 Pro : 402 × 874 pt)

Toutes les coordonnées ci-dessous sont issues directement des arbres d'accessibilité XCUITest (`*.xml`) extraits de l'iPhone 16 Pro physique :

```
0 pt ------------------------------------------------------------- 402 pt
|  [Status Bar iOS : y = 0..59 pt]                                      |
|                                                                       |
|  [Header Bar : y = 67..105 pt]                                        |
|  x=12: [Messages — aller au compte (w=97, h=34)]   x=352: [Bell (38×38)]|
|                                                                       |
|  [Zone Carte Haute / Master List : #card, y = 110..386 pt (h=276 pt)] |
|  x=65: [Search Field : w=303, h=38]                                   |
|  x=22: [Row 0: Camille Rochat (y=166, h=56)]                          |
|  x=22: [Row 1: Voyageur LKDV (y=223, h=56)]                           |
|  x=22: [Row 2: Bivouac de printemps (y=280, h=56)]                    |
|  x=22: [Row 3: Dolomites — août (y=337, h=56)]                        |
|        ⚠️ COLLISION : x=182, y=346..376 : [SubCapsuleTabs (w=196)]    |
|        (Recouvre directement la rangée 3 Dolomites !)                 |
|                                                                       |
394 pt ----------------------- [SEPARATEUR SPLIT] -----------------------|
|  x=157..245: [msplit Grabber (w=88, h=22, span 36×5)]                 |
|  ⚠️ COLLISION : x=12..201: [mpill Bivouac de printemps (w=189, h=44)] |
|  (Recouvre le grabber de x=157 à x=201, soit 44 pt de collision !)    |
|                                                                       |
|  [Zone Carte Basse / Detail Chat : .mapzone, y = 394..791 pt]         |
|  - Si aucune conversation : Empty State (y=519..630)                  |
|  - Si conversation active :                                           |
|    ⚠️ Premier message : y=338 (masqué sous l'en-tête !)               |
|    - Message Thread : y=452..721                                      |
|    - Composer Bar : y=721..767 (x=10 Textbox, x=316 [+], x=362 Send)  |
|                                                                       |
791 pt ----------------------- [TAB BAR NATIVE] -------------------------|
|  [UITabBar native : y = 791..874 pt (h=83 pt)]                        |
|  x=25: Hub | x=93: Explorer | x=162: Commu | x=231: Messages | x=300: Compte |
874 pt -----------------------------------------------------------------
```

### 4.1. L'anomalie critique des coordonnées des tiroirs (`AccountDrawerHost variant="card"`)
Lorsqu'un tiroir est ouvert (menu `+` ou options de conversation `...`) :
- **Attendu (Apple HIG Bottom Sheet)** : Le tiroir doit émerger du bord bas de l'écran (`y = 874 pt` ou ancré au-dessus de la TabBar à `y = 791 pt`), s'étendre vers le haut selon les detents standards (`medium` à ~50 % soit `y = 437 pt`, `large` à ~90 % soit `y = 88 pt`), avec un voile sombre sur tout l'arrière-plan.
- **Constaté sur l'iPhone 16 Pro physique** :
  - L'élément `<AccountDrawerHost variant="card">` calcule sa position relative à `#card` (qui est la boîte de la liste du haut !) :
    ```xml
    <XCUIElementTypeOther x="0" y="110" width="391" height="276" label="Partager dans le chat, boîte de dialogue web" visible="true">
    ```
  - Le tiroir est confiné entre `y = 110 pt` et `y = 386 pt` (hauteur totale de **276 pt** seulement !).
  - Conséquences :
    1. Le tiroir apparaît en haut de l'écran alors que l'utilisateur a appuyé tout en bas (`y = 728 pt`).
    2. La liste interne déborde brutalement à `y = 386 pt` :
       - `Photo` : `y = 244..280 pt` (visible)
       - `Carte GPX` : `y = 302..337 pt` (visible)
       - `Randonnée` : `y = 360..395 pt` (tronqué à 50 % !)
       - `Équipement` : `y = 417..453 pt` (totalement invisible / hors champ)
       - `Kit` : `y = 475..511 pt` (totalement invisible / hors champ)

---

## 5. Spécifications & Exigences Apple HIG (Human Interface Guidelines)

Pour être conforme aux standards Apple iOS 18 sur iPhone 16 Pro :

### 5.1. Navigation & Hiérarchie d'écrans (`UINavigationBar` & `UINavigationController`)
- **Titre de l'écran** : Le label « Messages » en haut à gauche doit être le titre statique de la barre de navigation (`largeTitle` ou standard inline title), stylé selon `-apple-system-headline` ou `-apple-system-title2`. Il ne doit sous aucun prétexte déclencher une navigation vers `/compte`.
- **Cloche de notification** : Si une cloche est affichée dans la barre de navigation, elle doit ouvrir un panneau popover/sheet local de notifications ou filtrer les mentions non lues de la messagerie, sans basculer l'application vers un autre onglet principal (`/compte`).
- **Modèle de navigation Portrait iPhone** : Sur un écran compact de smartphone (largeur 402 pt), le split view vertical 40/60 simultané est anti-ergonomique. Apple préconise :
  - **Mode Liste (Master)** : Occupe 100 % de la vue utile (entre le header et la TabBar).
  - **Mode Conversation (Detail)** : S'ouvre en glissement complet de droite à gauche avec bouton retour chevron standard (`< Messages`) pour revenir à la liste.
  - *Alternative split maintenue* : Si le mode split 40/60 est conservé à la demande du produit, la zone basse doit pouvoir s'effacer complètement ou se réduire en mini-lecteur quand aucune discussion n'est sélectionnée, laissant 100 % d'espace à la liste.

### 5.2. Tiroirs Modaux (`UISheetPresentationController`)
- **Ancrage** : Tout tiroir modal (`ComposerMenuSheet`, `ConversationOptionsSheet`, sélecteur de contacts) doit être présenté en **Bottom Sheet natif** ancré à `bottom: 0`.
- **Poignée Grabber officielle** : Dimensions exactes `36 × 5 pt`, centrée horizontalement, rayon de courbure continu `border-radius: 2.5 pt`, couleur `rgba(255, 255, 255, 0.45)` sur fond vert foncé ou `rgba(23, 64, 44, 0.35)` sur fond clair.
- **Detents officiels** :
  - `medium` : Hauteur d'environ 50 % de l'écran (`~420 pt`).
  - `large` : Hauteur d'environ 88-92 % de l'écran (`~780 pt`), laissant voir la barre d'état et le haut de l'écran parent en retrait avec effet d'échelle (*card stack*).
- **Bouton de fermeture** : Bouton circulaire officiel Apple (`30 × 30 pt` ou `36 × 36 pt`) avec glyphe `×` centré en haut à droite, accessible avec une zone tactile minimale de `44 × 44 pt`.

### 5.3. Menus Contextuels (`UIContextMenuInteraction`)
- **Comportement d'appui long sur une bulle** :
  - Effet visuel : Légère mise en avant de la bulle avec animation d'échelle (`scale(1.03)`), léger flou et assombrissement de l'arrière-plan (*scrim*).
  - Capsule de réactions : Capsule flottante horizontale détachée positionnée directement **au-dessus** (ou en dessous si la bulle est tout en haut) de la bulle de message.
    - Contient 6 émojis (`👍`, `❤️`, `😂`, `😮`, `🙏`, `🔥`) avec espacement généreux et retour haptique léger (`UIImpactFeedbackGenerator(style: .light)`).
  - Menu vertical d'actions : Positionné en dessous de la bulle (ou au-dessus) sous forme d'une liste groupée inset (`UICollectionViewListCell`) :
    - `Répondre` (icône flèche courbe)
    - `Transférer` (icône flèche droite)
    - `Copier le texte` (icône document)
    - `Modifier` (si auteur et < 15 min)
    - `Supprimer` (en rouge destructif `var(--bad)` si auteur)
    - `Signaler` (si tiers)
  - **Absence totale de saut de layout** : L'appui long ne doit pas insérer d'élément dans le flux régulier du fil ni pousser les messages sous la barre de rédaction.

### 5.4. Cibles Tactiles & Typographie Système
- **Cible tactile minimale** : Aucun élément interactif (icônes de filtre, boutons d'action, croix de fermeture, pastilles de réaction) ne doit avoir une surface tactile inférieure à **`44 × 44 pt`** (Apple Touch Target Standard).
- **Primitives WebKit** :
  - `font: -apple-system-headline` (17 pt semibold) pour les en-têtes et titres.
  - `font: -apple-system-body` (15 pt regular) pour le corps des messages.
  - `font: -apple-system-subheadline` (13 pt regular) pour les aperçus et pseudos.
  - `font: -apple-system-caption1` (11 pt medium) pour les horodatages et métadonnées.

---

## 6. Spécifications LKDV Green Palette (Zéro Noir Pur `#000000`)

Conformément à la consigne stricte de la charte LKDV : **aucun noir pur `#000000` ni fond sombre non désiré (`#0d1117`) n'est toléré**. L'interface de messagerie doit être exclusivement composée de nuances de verts, de verres minéraux et de surfaces claires/sombres harmonisées :

### 6.1. Grille des Valeurs Hexadécimales & Tokens LKDV
| Rôle Sémantique | Token CSS LKDV | Valeur Officielle LKDV | Remplacement de la couleur défaillante |
|-----------------|----------------|------------------------|----------------------------------------|
| **Fond Profond (Dark)** | `--lkdv-dark-forest` | `#06130D` | Remplace le noir pur `#000000` et `#0d1117` |
| **Fond Primaire Sombre** | `--lkdv-green-950` | `#0B1E16` | Remplace les fonds noirs de modal / scrim |
| **Fond Verre Épais** | `--lkdv-green-900` | `#143527` | Fond des tiroirs et cartes d'en-tête |
| **Fond Verre Moyen** | `--lkdv-green-850` | `#1A4333` | Fond des bulles de messages reçus et pastilles |
| **Vert Forêt Accent** | `--lkdv-green-800` | `#245B45` | Bordures actives et boutons secondaires |
| **Vert Émeraude Maître**| `--lkdv-green-700` | `#2D7255` | Boutons d'action principaux, badges non lus |
| **Vert Menthe Vive** | `--lkdv-mint` | `#5DD49F` | Indicateurs de présence, focus rings, toggles actifs |
| **Fond Menthe Douce** | `--lkdv-mint-soft` | `rgba(93, 212, 159, 0.12)` | Fond des bulles utilisateur (*mine*) |
| **Voile Scrim Sombre** | `--lkdv-scrim` | `rgba(11, 30, 22, 0.65)` | Remplace le voile noir `rgba(0, 0, 0, 0.5)` |
| **Bordures & Séparateurs**| `--lkdv-border-glass` | `rgba(255, 255, 255, 0.18)` | Sur fond sombre |
| **Bordures Subtiles** | `--lkdv-border-mint` | `rgba(93, 212, 159, 0.25)` | Encadrements de sélection active |

### 6.2. Correction des Contrastes Textuels Défaillants
- **Problème identifié** : Le bouton « Nouvelle discussion » dans l'état vide `Demandes` utilisait du texte `--pg-ink: #17402C` sur un fond sombre `#19442C`, produisant un ratio de contraste catastrophique de `1.05:1`.
- **Règle absolue de contraste** :
  - Sur tout fond sombre ou dégradé vert foncé (`#17402C`, `#275D3F`, `#143527`) : Le texte DOIT être **blanc pur `#FFFFFF`** ou **blanc cassé mentholé `#F2F9F5`** (ratio de contraste > `8.5:1`, conforme WCAG AAA).
  - Sur fond verre clair (`rgba(255, 255, 255, 0.85)`) : Le texte principal doit être `#0B1E16` ou `#17402C` (ratio > `9:1`).

---

## 7. Plan de Remédiation & Critères d'Acceptation par Écran

### 7.1. Vue Principale & Header
- [ ] Le bouton `Messages` en haut à gauche est statique ou agit comme scroll-to-top de la liste ; il ne navigue plus vers `/compte`.
- [ ] L'icône cloche n'utilise plus `<Link href="/compte?tab=notifications">` ; elle filtre les discussions ayant des notifications non lues ou affiche un tiroir de notifications in-app.
- [ ] La pastille `SubCapsuleTabs` (`Toutes / Directs / Groupes / Demandes`) est ancrée sous la barre de recherche dans l'en-tête fixe (`position: relative` ou `sticky`), avec un espacement inférieur garantissant qu'aucune ligne de conversation ne passe dessous.
- [ ] L'espace vertical entre le master (liste) et le detail (chat) est rééquilibré : la liste des conversations affiche au moins 6 à 7 discussions en mode portrait quand aucun fil n'est actif.

### 7.2. Gestion des États Vides & Filtre Demandes
- [ ] L'onglet `Demandes` n'affiche qu'un seul état vide clair et élégant, centré dans la page.
- [ ] Le bouton d'action principale est lisible avec un contraste parfait (texte `#FFFFFF` sur fond vert émeraude `#2D7255`).
- [ ] Le clic sur « Nouvelle discussion » ouvre un tiroir modal de sélection de contact / recherche d'utilisateurs (`NewConversationModal`), et non pas seulement le focus dans l'input local.

### 7.3. Conversations de Groupe & Stabilité Realtime
- [ ] Le hook `useConversations` est corrigé : les rafraîchissements d'arrière-plan (déclenchés par `markAsRead` ou des messages entrants) ne repassent jamais `loading: true` si des données existent déjà dans le cache ou l'état.
- [ ] L'ouverture d'un groupe (`Bivouac de printemps`, `Dolomites — août`) maintient l'intégrité visuelle de la liste supérieure sans clignotement ni blocage sur squelettes gris.
- [ ] Le composant `<SharedPostEmbed>` résout correctement les publications communautaires réelles ou affiche une carte d'aperçu enrichie élégante en vert foncé au lieu d'une boîte d'erreur grise brute.

### 7.4. Tiroirs Modaux (`ComposerMenuSheet` & `ConversationOptionsSheet`)
- [ ] `ComposerMenuSheet` est entièrement refondu pour être une **Bottom Sheet** ancrée au bas de l'écran (`inset-bottom: 0`).
- [ ] La hauteur du tiroir s'adapte à son contenu ou utilise les detents 50% / 90% avec défilement fluide sans aucune coupure à `y = 386 pt`.
- [ ] Toutes les options (`Photo`, `Carte GPX`, `Randonnée`, `Équipement`, `Kit`) sont accessibles, correctement paddées à gauche (`padding-left: 16pt`) et dotées de labels explicites.
- [ ] `ConversationOptionsSheet` s'ouvre depuis le bas de l'écran avec une croix de fermeture visible, les informations réelles du contact ou du groupe, et toutes les actions de gestion (mode silencieux, notifications, partage de profil, recherche interne, bloquer/signaler, quitter le groupe, supprimer).

### 7.5. Menu Contextuel de Réaction (Appui Long)
- [ ] L'appui long sur une bulle ne modifie pas le flux DOM de la conversation.
- [ ] La rangée d'émojis flotte au-dessus de la bulle ciblée sous forme d'une capsule en verre vert sombre, sans coupure par les bords de l'écran ou le header.
- [ ] Les actions textuelles sont présentées dans un menu contextuel vertical élégant conforme à `UIContextMenuInteraction`.
