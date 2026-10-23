# Communauté — le fil Instagram LKDV (refonte)

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun code écrit pour ce chantier
**Périmètre :** `/communaute` uniquement (hub + feed + stories + création + barre basse).
**Référence :** la page `/compte` du 2026-10-23, son post modal (`#post_modal_instagram`, `.pmi-*`),
sa barre `.tb` et son drawer `create_menu`.
**Inventaire de départ :** `docs/communaute/INVENTAIRE-COMPLET.md`.

---

## 1. La décision

On abandonne le « hub à six espaces » (héro + capsule + grille + drawers de contenu) pour un
**fil vertical plein écran**, copie de l'anatomie du post du Compte :

1. **En haut à gauche** : notre pastille d'auteur `avatar + nom`, identique à `.pmi-author`.
2. **En haut à droite** : un bouton rond `+` qui ouvre le **même drawer de création** que le Compte
   (`create_menu` : carnet, voyage/sortie GPS, kit, club, story).
3. **Sous la pastille** : les stories, en rail horizontal, sans titre de section.
4. **En dessous** : le **fil complet** et rien d'autre. Chaque post est un **carré 1:1**, l'image
   prend toute la place, les actions sont posées dessus dans le verre de la barre basse.
5. **En bas** : la **barre basse du Compte**, à l'identique (48 px, 5 cellules, lentille, labels).
6. **Rien d'autre** : plus de héro, plus de compteurs, plus de capsule de filtres, plus de grille,
   plus de drawers de contenu, plus de sections carnets/clubs/groupes/sorties/entraide.

Le fil est **media-first** : une image carrée, une pastille auteur, `···` en haut à droite,
like/commentaire/partage en bas à droite, et un menu identique au post du Compte. Le texte du post
n'est pas dans le carré (sauf post sans image) ; il est lisible dans la feuille de commentaires ou
en légende basse optionnelle (voir D3).

---

## 2. Ce qu'on garde du Compte, à l'identique

| Brique | Valeur exacte | Source |
|---|---|---|
| Pastille auteur | `28 px` d'avatar, nom `600 12px`, padding `4px 10px 4px 4px`, radius `999`, fond `--bar-glass-bg`, blur `--bar-glass-blur`, ombre `--bar-thumb-shadow` | `.pmi-author` |
| Bouton rond `+` | `38 px`, radius 50 %, fond `rgba(255,255,255,.5)`, blur `4px saturate(1.9) brightness(1.07)`, inset 1 px | `.gbtn` |
| Post carré | `aspect-ratio: 1/1`, image `object-fit: cover`, fond `#17402C`, radius `28px` | `.pmi-media`, `.pmi-dialog` |
| Capsule d'actions | position `absolute` bas-droite `12px`, `gap:4`, `padding:3`, radius `999`, fond `--bar-glass-bg`, blur, `--bar-glass-shadow` | `.pmi-post-actions` |
| Bouton d'action | `34 × 34`, radius 50 %, icône `18 px`, like `#E0245E` | `.pmi-post-btn` |
| Menu `···` | largeur `226px`, radius `20px`, fond `rgba(255,255,255,.72)`, blur `30px`, 4 lignes | `.pmi-options-menu` |
| Barre basse | hauteur `48px`, `padding:2px`, 5 cellules, boutons `44px`, labels `600 10px`, lentille `40px`, fond `--bar-glass-bg`, blur `7.2px saturate(1.9) brightness(1.07)`, ombre `--bar-glass-shadow` | `.tb` |
| Drawer création | 5 lignes, icône, titre, sous-titre, badge | `create_menu` |
| Fond | `.lkv-app-background` global + voile | root layout |

**Jetons** : `--bar-glass-bg`, `--bar-glass-blur`, `--bar-glass-shadow`, `--bar-thumb-shadow`,
`--sf`, `--lkv-text-primary`, `--lkv-text-secondary`. Aucune nouvelle couleur.

**Menu `···` (exactement le Compte)** :
1. Enregistrer / Retirer des enregistrements
2. Republier
3. Copier le lien
4. Signaler

**Capsule d'actions (exactement le Compte)** : like, commentaire, partage. Le favori n'est **pas**
dans la capsule ; il est dans le menu `···`.

**Ce qu'on retire du post actuel** : header auteur complet dans une carte blanche, légende dans la
carte, actions en boutons texte, bouton favori dans la rangée, reproduction de kit dans le post,
double-tap seulement (le Compte like au tap sur le média), menu contextuel long-press.

---

## 3. Anatomie cible — mobile 430 × 932

```
┌──────────────────────────────────────────────┐
│  (avatar 28) Tony Faraci @tony_frc      (+)  │  pastille auteur + bouton rond
│                                              │
│  ◯ ◯ ◯ ◯ ◯ ◯   stories (70 px, sans titre)   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ (av) Léa Fontaine              (···)   │  │  carré 1:1, radius 28
│  │                                        │  │
│  │              PHOTO                     │  │  image plein cadre
│  │                                        │  │
│  │  légende 2 lignes                      │  │  option D3
│  │                    (♥)(◻)(➤)           │  │  capsule verre 3 × 34
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ (av) Karim Haddad              (···)   │  │
│  │              PHOTO                     │  │
│  │                    (♥)(◻)(➤)           │  │
│  └────────────────────────────────────────┘  │
│  …                                            │
│  ╭────────────────────────────────────────╮  │
│  │ Explorer  Compas  Matériel  Hub  Compte│  │  barre Compte 48 px
│  ╰────────────────────────────────────────╯  │
└──────────────────────────────────────────────┘
```

**Desktop** : la même colonne, centrée, largeur max **430–520 px**, sur le même fond ; la barre
basse est la même, fixée en bas de la colonne. Pas de colonne latérale, pas de cockpit.

---

## 4. Élément par élément

### 4.1 Barre supérieure

| Élément | Spécification | Action |
|---|---|---|
| Pastille auteur | `.pmi-author` : avatar 28, nom `600 12px`, `@handle` `10.5px` en dessous, verre | lien `/compte` |
| Bouton `+` | `.gbtn` 38 px, icône plus 18 px | ouvre `CommunityCreateSheet` |
| Fond | transparent ; reste **sticky** en haut avec `safe-top` | — |

La pastille remplace la capsule « Communauté » ; aucun titre de page.

### 4.2 Stories

- `CommunityStoriesBar` en mode **rail**, sans en-tête de section, sous la barre supérieure.
- Colonnes 70 px, anneaux 64 px, avatar 55 px, nom 11 px ; « Votre story », « Ajouter », « Archives ».
- Le drawer de création peut ouvrir le sélecteur de story (même `fileInputRef`).
- Le viewer, les likes, les vues, les archives et le compositeur existants sont conservés.

### 4.3 Le post du fil

| Élément | Spécification | Action |
|---|---|---|
| Conteneur | `article` carré `1:1`, radius 28, overflow hidden, fond `#17402C`, marge 10 px | — |
| Média | image `object-fit: cover` (ou vidéo), plein cadre | tap = like ; double-tap = like + burst |
| Pastille auteur | avatar 28 + nom, en haut à gauche, verre | `/profil/[id]` |
| Bouton `···` | 34 px, verre, en haut à droite | menu (Enregistrer, Republier, Copier, Signaler) |
| Capsule d'actions | like / commentaire / partage, 3 × 34, bas-droite 12, verre | like RPC ; commentaires → sheet ; partage natif/copie |
| Légende (D3) | 2 lignes max, blanc, gradient bas, à gauche, largeur jusqu'à 110 px du bord droit | aucune (lecture) |
| Indicateur médias | `1/N` si plusieurs médias | swipe horizontal (D6) |
| Fallback sans image | aplat forêt + motif + texte du post | actions identiques |
| État liké | icône pleine `#E0245E` | — |
| État enregistré | icône pleine dans le menu | — |

**Menu `···`** : `Enregistrer`, `Republier`, `Copier le lien`, `Signaler`. Les actions sont
exactement celles du post du Compte.

**Commentaires** : bouton → `CommunityCommentsSheet` (feuille basse) ; le post reste derrière.
La feuille contient le post en miniature, la liste, le composer, les réponses, les likes, l'édition,
la suppression et le signalement — mêmes fonctions que l'actuel `CommunityPostCard`.

### 4.4 Drawer de création

`Sheet` basse, `aria-label="Créer dans l'application"`, 5 lignes :

| Ligne | Sous-titre | Lien |
|---|---|---|
| Nouveau carnet de voyage | Raconte une expédition avec photos et tracé | `/carnets/nouveau` |
| Nouveau voyage / sortie GPS | Importe un GPX ou planifie un trek | `/voyages` |
| Nouveau kit de matériel | Compose un sac ultraléger | `/materiel` |
| Nouveau club ou tribu | Rassemble ta cordée | `/clubs/nouveau` |
| Nouvelle story à la une | Épingle un souvenir terrain | sélecteur de story |

Style : lignes `min-height 64px`, icône 38 px dans un carré verre, titre `600 14px`, sous-titre
`11px` secondaire, badge pilule à droite. Aucun nouveau langage visuel.

**D4** : le drawer du Compte ne contient pas « Nouvelle publication ». Sans sixième ligne, le
composeur `/communaute/publier` devient inaccessible depuis le fil. Recommandation : ajouter une
sixième ligne « Nouvelle publication » → `/communaute/publier`, ou assumer que les posts naissent
des carnets/voyages/kits.

### 4.5 Barre basse

- `.tb` du Compte : 48 px, `padding:2`, 5 cellules, boutons 44 px, labels 10 px, lentille 40 px,
  fond `--bar-glass-bg`, blur, ombre, position fixe bas 10 / gauche 10 / droite 10.
- **D1** : deux options —
  - **A (recommandée)** : même style et même comportement, mais les **5 destinations de l'app**
    (Hub, Communauté, Explorer, Messages, Compte) avec **Communauté actif**. Aucune régression de
    navigation.
  - **B (littérale)** : les 5 onglets du Compte (Explorer, Compas, Matériel, Hub, Compte), aucun
    onglet actif sur `/communaute`. Il faut alors migrer la barre globale de l'app.
- La barre globale `NavigationBar` est **masquée** sur `/communaute` pour éviter deux barres.

### 4.6 Le fil

- Une seule liste verticale de posts, sans sections, sans filtres, sans grille.
- Pagination par 10 (carrés lourds) : `range(0..9)`, `10..19`, etc. ; « Charger plus » en bas.
- Auteurs : `public_profiles` en une passe.
- Like/save : `post_likes` / `post_saves` en une passe pour les ids affichés.
- Stories : chargées par `CommunityStoriesBar`.
- Aucun compteur global, aucun `carnets`/`clubs`/`groups`/`events` chargé sur cette page.

---

## 5. Ce qu'on supprime (gros nettoyage)

| Élément | Sort |
|---|---|
| `CommunityHeroCard.tsx` | supprimé |
| `CommunityContextDrawer.tsx` | supprimé |
| `CommunityGrid.tsx` | supprimé |
| `CommunityContentDrawer.tsx` | supprimé |
| `MobileCommunityHub.tsx` | supprimé |
| `MobileCommunityHeader.tsx` | supprimé (remplacé par `CommunityFeedTopBar`) |
| `useCommunityTotals.ts` | supprimé |
| Filtres `?tab=` + `CommunityMobileTab` | supprimés |
| CSS `.lkdv-hero`, `.lkdv-community-grid*`, `.lkdv-content-drawer*`, `.lkdv-community-view-lens` | supprimés |
| Tests grille/drawers | remplacés par tests feed/post |
| `CommunityPostCard.tsx` (1 498 lignes) | découpé : `usePostInteractions`, `usePostComments`, `CommunityCommentsSheet`, `CommunityFeedPost` ; puis supprimé |
| `/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide` | **retirés de la page Communauté et de ses liens** ; les routes restent accessibles en direct (D2) |
| `AppShell`/barre globale sur `/communaute` | remplacés par la coquille + barre Compte |

**D2** : supprimer *les pages* `/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide` est un
chantier produit séparé (elles sont liées ailleurs dans l'app). Le nettoyage de ce chantier les
retire de l'expérience Communauté, pas du produit.

---

## 6. Données

| Besoin | Source | Requête |
|---|---|---|
| Posts du fil | `community_posts` | `select('*').order('created_at', desc).range(offset, offset+9)` |
| Auteurs | `public_profiles` | `fetchPublicProfilesWith` |
| Like utilisateur | `post_likes` | `select('post_id').in('post_id', ids)` |
| Favoris utilisateur | `post_saves` | idem |
| Like | RPC `toggle_community_post_like` | — |
| Favori | `post_saves` upsert/delete | — |
| Partage | `navigator.share` / clipboard | — |
| Commentaires | `post_comments`, `post_comment_likes`, `comment_reports` | mêmes requêtes que la carte actuelle |
| Stories | `post_stories`, `story_*` | `CommunityStoriesBar` inchangé |
| Création | liens du drawer | — |

Aucune migration n'est nécessaire pour le fil. Le partage ne crée toujours pas de `post_shares`
(dette existante, hors périmètre ; D7).

---

## 7. États et accessibilité

- Chargement : 2 squelettes carrés + 1 rail de stories squelette.
- Vide : « Le fil est calme » + bouton `+`.
- Erreur : carte d'erreur + Réessayer.
- Fin de liste : « Tu as tout vu ».
- Invité : le fil public s'affiche ; like/commentaire/favori demandent la connexion.
- Chaque bouton : 44 px de cible (les 34 px de la capsule ont une zone 44 px via `::after`).
- `aria-label` explicites (`J'aime`, `Commenter`, `Partager`, `Options de la publication`).
- `aria-pressed` sur like et favori ; `aria-expanded` sur `···`.
- `prefers-reduced-motion` : pas de burst, lentille instantanée.
- Contraste : icônes `#17402C` sur verre clair ; like `#E0245E`.

---

## 8. Décisions à confirmer

| # | Décision | Défaut |
|---|---|---|
| D1 | Barre basse : 5 destinations app (Communauté actif) ou 5 onglets Compte | **A : 5 destinations app, style Compte** |
| D2 | Supprimer les pages carnets/clubs/groupes/sorties/entraide ou seulement leurs liens | **liens seulement** |
| D3 | Légende sur l'image (2 lignes) ou image pure | **légende 2 lignes** |
| D4 | Ajouter « Nouvelle publication » au drawer de création | **oui, 6e ligne** |
| D5 | Commentaires : feuille basse (recommandé) ou inline | **feuille** |
| D6 | Multi-médias : premier média seulement ou carrousel | **premier + badge `1/N`** |
| D7 | Partage : créer `post_shares` ou laisser la copie de lien | **laisser** (dette séparée) |
