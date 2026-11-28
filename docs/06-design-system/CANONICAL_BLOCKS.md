# Catalogue des 7 Blocs Canoniques Réutilisables — LKDV

> **Loi d'Unicité** : Les 7 blocs ci-dessous doivent être **visuellement et comportementalement identiques partout dans l'application**.
> Ne **jamais** réinventer un clone local d'une pilule utilisateur, d'une story, d'un post, d'une fiche produit ou d'un aperçu : réutiliser ou étendre le composant canonique listé ici.

---

## 1. La Pilule Utilisateur (`IdentityPill` / `PostAuthorPill`)
- **Code canonique** : `src/features/community/feed/PostAuthorPill.tsx` (`IdentityPill`, `PostAuthorPill`) & `src/components/account/AccountAuthorPill.tsx`
- **Où elle apparaît** : Partout où une personne est affichée (Posts, Commentaires, Stories, Carnets, Membres de Club, Sorties, Messagerie, Classements).
- **Anatomie** :
  - Capsule verre `gc` (`border-radius: 9999px`)
  - Avatar circulaire `32px` (fallback initiales sur dégradé `var(--mint) → var(--subtle)`, bordure blanche `1.5px`)
  - Nom (`600`), badge de confiance optionnel, ligne méta compacte (`lieu · spot · il y a X`)
  - Pile contextuelle optionnelle (`lkdv-post-author-stack` + `lkdv-post-context-pill`) reliant à un **Club** (`Users`) ou un **Carnet** (`BookOpen`) sans casser la pilule principale.

---

## 2. Le Système de Stories (Identique Partout)
- **Code canonique** :
  - Bandeau : `src/components/communaute/CommunityStoriesBar.tsx`
  - Visionneur plein écran : `src/components/communaute/StoriesViewer.tsx` (chargé en `dynamic(..., { ssr: false })`)
  - Vues & Archives : `src/components/communaute/StoryViewsSheet.tsx`, `src/components/communaute/StoriesArchiveSheet.tsx`, `src/components/stories/StoryArchiveDrawer.tsx`
  - Éditeur : `src/features/community/create/shared/StoryStage.tsx`
- **Où il apparaît** : Communauté (`/communaute`), Clubs (`/clubs/[id]` + `ClubHighlightManageDrawer`), Carnets (`/carnets/[id]`), Profil.
- **Contrat visuel & technique** :
  - 4 audiences : `public`, `followers`, `close_friends`, `only_me`.
  - Overlays typés identiques partout : `text` (styles `clair` / `encre` / `sauge`, position/scale/rotation) + `sticker` (`lieu`, `altitude`, `meteo`, `distance`).
  - Limites : max `5` slides, image ≤ `10 Mo` (EXIF strippé via `stripImageMetadata`), vidéo ≤ `25 Mo` / `60 s`.

---

## 3. L'Affichage des Posts + Écran Commentaires + Écran Partage
- **Code canonique** :
  - Carte Post : `src/features/community/feed/CommunityFeedPost.tsx` + `CommunityPostMedia.tsx` + `PostAttachments.tsx` + `CommunityPostSoundtrack.tsx`
  - Flux intégré Club/Carnet : `src/components/clubs/feed/ClubInlineFeed.tsx`, `src/components/carnet/v2/CarnetFilDrawerBody.tsx`
  - Commentaires : `src/features/community/reels/FreedomCommentsDrawer.tsx`
  - Partage : `src/features/community/feed/PostSharePanel.tsx` & `src/features/community/reels/FreedomShareDrawer.tsx`
- **Anatomie invariante** :
  1. En-tête : `PostAuthorPill` (identité + contexte Club/Carnet) + menu discret à droite.
  2. Corps visuel prioritaire : média plein cadre / carrousel / pièce jointe riche (trace GPX, kit, carnet).
  3. Légende courte + tags compacts.
  4. Barre d'actions unifiée (like, commentaires → drawer commentaires identique, partage → sheet partage identique, sauvegarde).

---

## 4. Les Fiches Produits & Matériel
- **Code canonique** :
  - Carte verre boutique/partenaire : `src/components/ui/ProductGlassCard.tsx`
  - Carte matériel Club/Coffre : `src/components/clubs/drawer/ClubGearProductCard.tsx`
  - Barre d'usure : `src/features/community/create/kit/WearBar.tsx`
- **Anatomie** :
  - Surface verre `g2`, largeur compacte `168px` en rail horizontal (ou grille 2 colonnes fluide dans un drawer).
  - Visuel produit `120px` arrondi `var(--r-md)` sur fond `--lkv-surface-paper` (`#FBFAF6`).
  - Nom sur 2 lignes max (`line-clamp-2`), prix en `font-display 600 15px`, badge statut/partenaire, et `WearBar` lorsqu'il s'agit de matériel suivi.

---

## 5. Les Cartes d'Aperçu (Clubs, Carnets, Sorties, Kits, Traces)
Chaque entité possède sa **signature visuelle propre** mais partage la même matière verre `g2` et les mêmes espacements (`communaute-v2.css`) :

| Entité | Composant / Classes canoniques | Éléments clés (Visuel > Texte) |
| :--- | :--- | :--- |
| **Carnet** | `CarnetTile.tsx` / `CarnetCardV2.tsx` (`lkdv-cv2-visa`, `lkdv-cv2-trace`) | Couverture photo, tampon destination (`visa`), mini-tracé (`trace`), jours + km + D+ en `mono` |
| **Club** | `ClubCrest` (`lkdv-crest`) + `.lkdv-cv2-tile` | Blason identitaire du club, nom, massif, compteur membres + spécialité en icônes |
| **Sortie** | `EventTicket` (`.lkdv-cv2-ticket*`) + `AgendaStrip` (`.lkdv-cv2-agenda*`) | Format billet avec date mise en avant, badge difficulté, jauge capacité (`lkdv-cv2-capacity`), pile d'avatars (`lkdv-cv2-avatars`) |
| **Kit / Trace GPX** | `KitCarousel.tsx` / `GPXPreviewCard.tsx` | Poids total (`mono`), nombre d'items, mini-profil altimétrique & distance/D+ |

---

## 6. Les Drawers de Création (6 Formulaires Unifiés)
- **Code canonique** : `CreateSheetV2` / `src/features/community/create/CommunityFormDrawer.tsx` + `CreateFormEngine.tsx` + les 6 formulaires (`CarnetCreateForm`, `PostCreateForm`, `StoryCreateForm`, `SortieCreateForm`, `KitCreateForm`, `ClubCreateForm`).
- **Auto-remplissage universel** : Tous branchés sur `src/features/explorer-v2/outingHandoff.ts` (en fin de sortie Explorer, toutes les données terrain pré-remplissent le formulaire choisi).
- **Primitives communes obligatoires** : `lkdv-cv2-field`, `lkdv-cv2-chips`, `lkdv-cv2-seg`, `NumberStepper`, `DateRangeField`, `PlaceSearch`, `MediaPicker`, `StepPager`, `CloseDraftConfirm`, footer sticky verre dépoli.

---

## 7. Les Cartes du Monde / 3D Map (Même Socle, Variantes de Filtres)
- **Moteur unique** : **MapLibre GL + Three.js `r186`** (tuiles relief AWS Terrarium DEM, dioramas 3D GLB, `0 €`).
- **4 Variantes contextuelles** :
  1. **Explorer v2 (`MapStage`)** : carte plein écran 3D, HUD 6 onglets (Découvrir, Couches, Rando/GR Waymarked Trails, Nature Pokédex, Sécurité, Social), bouton `▶` + traceur `✏` en haut à droite.
  2. **CarnetMap (`src/components/carnet/map/`)** : îlot 3D extensible (`.mapbig`), trace GPX par jours (`J1`, `J2`…), pins moments géolocalisés.
  3. **ClubMap (`src/components/clubs/map/`)** : îlot 3D alpin synchronisé avec le fil du club, massifs, sorties, membres live, kits et Story Bloom.
  4. **CompteMap (`src/components/compte/map/`)** : carte personnelle des massifs et traces parcourues.
- **Invariant** : mêmes marqueurs, même palette verte/verre pour les contrôles, même fluidité 60 FPS — seuls les filtres, couches actives et densité de contrôles varient selon la page.
