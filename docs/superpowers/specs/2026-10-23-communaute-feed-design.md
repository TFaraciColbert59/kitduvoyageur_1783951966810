# Communauté — le fil Instagram LKDV (refonte)

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun code écrit pour ce chantier
**Périmètre :** `/communaute` uniquement (fil + stories + création + barre basse).
**Référence :** la page `/compte` du 2026-10-23, son post modal (`#post_modal_instagram`, `.pmi-*`),
sa barre `.tb` et son drawer `create_menu`.
**Inventaire de départ :** `docs/communaute/INVENTAIRE-COMPLET.md`.

---

## 1. La décision

On abandonne le hub à six espaces pour un **fil vertical plein écran**, copie de l'anatomie du post
du Compte :

1. **En haut à gauche** : notre pastille auteur `avatar + nom`, identique à `.pmi-author`.
2. **En haut à droite** : un bouton rond `+` qui ouvre **le drawer de création du Compte**
   (`create_menu` : carnet, voyage/sortie GPS, kit, club, story).
3. **Sous la pastille** : les stories, en rail horizontal, sans titre de section.
4. **En dessous** : le **fil complet** et rien d'autre. Chaque post avec image est un **carré 1:1**,
   l'image prend toute la place, les actions sont posées dessus dans le verre de la barre basse.
   Un post **sans image** utilise le **fond verre de la carte principale du Compte**, avec le texte
   par-dessus ; sa hauteur s'adapte au texte **sans jamais dépasser la hauteur du carré**.
5. **En bas** : la **barre basse du Compte à l'identique** — les **mêmes 5 onglets**
   (Explorer, Compas, Matériel, Hub, Compte), le même ordre, les mêmes icônes, les mêmes labels.
6. **Rien d'autre** : plus de héro, plus de compteurs, plus de capsule de filtres, plus de grille,
   plus de drawers de contenu, plus de sections carnets/clubs/groupes/sorties/entraide.
7. **Suppression** des anciennes pages de l'expérience Communauté devenues inutiles :
   `/communaute/decouvrir`, `/communaute/reels`, `/communaute/publier`, `/communaute/post/[id]`.
   Les pages métier `/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide` **restent** :
   elles sont utilisées ailleurs (Compte, Pays, Carnets, Clubs, notifications). Elles ne sont plus
   liées depuis la Communauté.

Le fil est **media-first**. Aucune légende sur les posts avec image. Le texte d'un post avec image
n'est pas affiché ; il est lisible dans la feuille de commentaires. Un post sans image affiche son
texte sur le fond de carte du Compte.

---

## 2. Ce qu'on garde du Compte, à l'identique

| Brique | Valeur exacte | Source |
|---|---|---|
| Pastille auteur | `28 px` d'avatar, nom `600 12px`, `@handle` `10.5px`, padding `4px 10px 4px 4px`, radius `999`, fond `--bar-glass-bg`, blur `--bar-glass-blur`, ombre `--bar-thumb-shadow` | `.pmi-author` |
| Bouton rond `+` | `38 px`, radius 50 %, fond `rgba(255,255,255,.5)`, blur `4px saturate(1.9) brightness(1.07)`, inset 1 px | `.gbtn` |
| Post image | `aspect-ratio: 1/1`, image `object-fit: cover`, fond `#17402C`, radius `28px` | `.pmi-media` |
| Post texte | fond de la carte Compte : `rgba(255,255,255,.62)`, `blur(25px) saturate(1.8) brightness(1.05)`, radius `28px`, encre `#17402C` | `.card.cs` |
| Capsule d'actions | `absolute` bas-droite `12px`, `gap:4`, `padding:3`, radius `999`, fond `--bar-glass-bg`, blur, `--bar-glass-shadow` | `.pmi-post-actions` |
| Bouton d'action | `34 × 34`, radius 50 %, icône `18 px`, like `#E0245E` | `.pmi-post-btn` |
| Menu `···` | largeur `226px`, radius `20px`, fond `rgba(255,255,255,.72)`, blur `30px`, 4 lignes | `.pmi-options-menu` |
| Barre basse | `48px`, `padding:2px`, 5 cellules, boutons `44px`, labels `600 10px`, lentille `40px`, fond `--bar-glass-bg`, blur `7.2px saturate(1.9) brightness(1.07)`, ombre `--bar-glass-shadow` | `.tb` |
| Drawer création | 5 lignes, icône, titre, sous-titre, badge | `create_menu` |
| Fond | `.lkv-app-background` global + voile | root layout |

**Jetons** : `--bar-glass-bg`, `--bar-glass-blur`, `--bar-glass-shadow`, `--bar-thumb-shadow`,
`--sf`, `--lkv-text-primary`, `--lkv-text-secondary`. Aucune nouvelle couleur.

**Menu `···` (exactement le Compte)** :
1. Enregistrer / Retirer des enregistrements
2. Republier
3. Copier le lien
4. Signaler

**Capsule d'actions (exactement le Compte)** : like, commentaire, partage. Le favori est dans le
menu `···`, pas dans la capsule.

**Retiré du post actuel** : header auteur dans une carte blanche, légende, boutons texte, favori
dans la rangée, reproduction de kit, menu long-press.

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
│  │              PHOTO                     │  │  image plein cadre, aucune légende
│  │                                        │  │
│  │                    (♥)(◻)(➤)           │  │  capsule verre 3 × 34
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ (av) Karim Haddad              (···)   │  │  post TEXTE : carte verre du Compte
│  │  « Le TMB en autonomie, c'est 10 jours │  │  texte sur le fond de carte
│  │    à porter sa maison… »               │  │  hauteur auto ≤ carré
│  │                    (♥)(◻)(➤)           │  │
│  └────────────────────────────────────────┘  │
│  …                                            │
│  ╭────────────────────────────────────────╮  │
│  │ Explorer  Compas  Matériel  Hub  Compte│  │  barre Compte 48 px, 5 onglets
│  ╰────────────────────────────────────────╯  │
└──────────────────────────────────────────────┘
```

**Desktop** : la même colonne, centrée, largeur max **430–520 px**, même fond, même barre fixée en
bas de la colonne. Pas de colonne latérale.

---

## 4. Élément par élément

### 4.1 Barre supérieure

| Élément | Spécification | Action |
|---|---|---|
| Pastille auteur | `.pmi-author` : avatar 28, nom `600 12px`, `@handle` 10.5px, verre | lien `/compte` |
| Bouton `+` | `.gbtn` 38 px, icône plus 18 px | ouvre `AccountCreateSheet` |
| Fond | transparent, sticky, `safe-top` | — |

La pastille remplace la capsule « Communauté » ; aucun titre de page.

### 4.2 Stories

- `CommunityStoriesBar` en mode **rail**, sans en-tête de section, sous la barre supérieure.
- Colonnes 70 px, anneaux 64 px, avatar 55 px, nom 11 px ; « Votre story », « Ajouter », « Archives ».
- Le drawer de création peut ouvrir le sélecteur de story (même `fileInputRef`).
- Viewer, likes, vues, archives et compositeur conservés.

### 4.3 Le post du fil

#### Post avec image

| Élément | Spécification | Action |
|---|---|---|
| Conteneur | `article` carré `1:1`, radius 28, overflow hidden, fond `#17402C`, marge 10 px | — |
| Média | image `object-fit: cover` (ou vidéo), plein cadre | tap = like ; double-tap = like + burst |
| Pastille auteur | avatar 28 + nom, en haut à gauche, verre | `/profil/[id]` |
| Bouton `···` | 34 px, verre, en haut à droite | menu 4 lignes |
| Capsule d'actions | like / commentaire / partage, 3 × 34, bas-droite 12, verre | like RPC ; commentaires → feuille ; partage natif/copie |
| Légende | **aucune** | — |
| Indicateur médias | `1/N` si plusieurs médias | swipe (D6) |
| État liké | icône pleine `#E0245E` | — |
| État enregistré | icône pleine dans le menu | — |

#### Post sans image

| Élément | Spécification | Action |
|---|---|---|
| Conteneur | largeur 100 %, `border-radius:28`, fond `rgba(255,255,255,.62)` + blur 25 px, ombre de la carte Compte | — |
| Hauteur | `height:auto`, `max-height:100cqw` (le carré), `min-height:120px` ; texte court = carte plus basse, texte long = plafonné | — |
| Texte | `#17402C`, 15/1.4, padding `18px 18px 64px`, `overflow:hidden`, dégradé de fin si plafonné | lecture |
| Pastille auteur | idem, sur le verre | `/profil/[id]` |
| `···` + actions | idem, posés sur le verre | idem |
| Image | aucune | — |

**Règle de hauteur** : la carte texte ne dépasse **jamais** la hauteur du carré (largeur du
conteneur). Plus courte, oui ; plus grande, non. La largeur du conteneur est la référence
(`container-type: inline-size`, `max-height:100cqw`).

### 4.4 Drawer de création

`Sheet` basse, `aria-label="Créer dans l'application"`, **exactement 5 lignes** :

| Ligne | Sous-titre | Lien |
|---|---|---|
| Nouveau carnet de voyage | Raconte une expédition avec photos et tracé | `/carnets/nouveau` |
| Nouveau voyage / sortie GPS | Importe un GPX ou planifie un trek | `/voyages` |
| Nouveau kit de matériel | Compose un sac ultraléger | `/materiel` |
| Nouveau club ou tribu | Rassemble ta cordée | `/clubs/nouveau` |
| Nouvelle story à la une | Épingle un souvenir terrain | sélecteur de story |

Style : lignes `min-height 64px`, icône 38 px dans un carré verre, titre `600 14px`, sous-titre
`11px`, badge pilule à droite.

Pas de ligne « Nouvelle publication » : `/communaute/publier` est supprimé. Les posts naissent des
carnets, voyages, kits et sorties.

### 4.5 Barre basse — identique au Compte

- **Les 5 mêmes onglets, dans le même ordre** : `Explorer`, `Compas`, `Matériel`, `Hub`, `Compte`.
- Icônes du Compte (globe, boussole, sac, hub, utilisateur), labels `600 10px`, 44 px, lentille 40 px.
- `48px`, `padding:2`, 5 cellules, fond `--bar-glass-bg`, blur `7.2px saturate(1.9) brightness(1.07)`,
  ombre `--bar-glass-shadow`, position fixe bas 10 / gauche 10 / droite 10.
- **Aucun onglet actif sur `/communaute`** (la Communauté n'est pas dans cette barre) : la lentille
  est masquée. C'est le comportement littéral du Compte, transposé.
- La barre globale `NavigationBar` est **masquée** sur `/communaute` pour éviter deux barres.

### 4.6 Le fil

- Une seule liste verticale, sans sections, sans filtres, sans grille.
- Pagination par 10 (carrés lourds) ; « Charger plus » en bas.
- Auteurs : `public_profiles` en une passe.
- Like/save : `post_likes` / `post_saves` en une passe.
- Stories : chargées par `CommunityStoriesBar`.
- Aucun `carnets`/`clubs`/`groups`/`events` chargé sur cette page.

---

## 5. Ce qu'on supprime (gros nettoyage)

| Élément | Sort |
|---|---|
| `CommunityHeroCard.tsx` | supprimé |
| `CommunityContextDrawer.tsx` | supprimé |
| `CommunityGrid.tsx` | supprimé |
| `CommunityContentDrawer.tsx` | supprimé |
| `MobileCommunityHub.tsx` | supprimé |
| `MobileCommunityHeader.tsx` | supprimé |
| `useCommunityTotals.ts` | supprimé |
| Filtres `?tab=` + `CommunityMobileTab` | supprimés |
| CSS `.lkdv-hero*`, `.lkdv-community-grid*`, `.lkdv-content-drawer*`, `.lkdv-community-view-lens` | supprimés |
| Tests grille/drawers | remplacés par tests feed/post |
| `CommunityPostCard.tsx` (1 498 lignes) | découpé en hooks + feuille, puis supprimé |
| `/communaute/decouvrir` | supprimé + redirect `/communaute` |
| `/communaute/reels` | supprimé + redirect `/communaute` |
| `/communaute/publier` | supprimé + redirect `/communaute` |
| `/communaute/post/[id]` | supprimé + redirect `/communaute?post=:id` |
| **`/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide`** | **conservés** : pages métier liées depuis Compte, Pays, Carnets, Clubs, notifications. Retirés des liens Communauté. |

> **Note de périmètre :** supprimer les cinq pages métier casserait 26 liens internes recensés
> (Compte, Pays, Carnets, Clubs, groupes). Ce n'est pas le même chantier. Si tu veux les supprimer
> réellement, il faut un plan séparé avec redirects et nettoyage de tous les liens.

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

Aucune migration. Le partage ne crée toujours pas de `post_shares` (dette séparée).

---

## 7. États et accessibilité

- Chargement : 2 squelettes carrés + rail de stories.
- Vide : « Le fil est calme » + `+`.
- Erreur : carte d'erreur + Réessayer.
- Fin de liste : « Tu as tout vu ».
- Invité : fil public ; like/commentaire/favori demandent la connexion.
- Post texte : hauteur auto ≤ carré ; texte long plafonné avec dégradé.
- Cibles 44 px (les 34 px de la capsule ont une zone 44 px via `::after`).
- `aria-label` : `J'aime`, `Commenter`, `Partager`, `Options de la publication`.
- `aria-pressed` like/favori ; `aria-expanded` sur `···`.
- `prefers-reduced-motion` : pas de burst, lentille instantanée.
- Contraste : `#17402C` sur verre ; like `#E0245E`.

---

## 8. Décisions validées

| # | Décision | Valeur |
|---|---|---|
| D1 | Barre basse | **les 5 onglets du Compte à l'identique, aucun actif sur `/communaute`** |
| D2 | Pages | **supprimer l'ancienne expérience Communauté** ; garder les cinq pages métier |
| D3 | Légende | **aucune** sur les posts image ; texte uniquement pour les posts sans image |
| D4 | Création | **5 lignes du Compte** ; pas de ligne « Nouvelle publication » ; `/communaute/publier` supprimé |
| D5 | Commentaires | feuille basse |
| D6 | Multi-médias | premier média + badge `1/N` |
| D7 | Partage | copie/natif, pas de `post_shares` |
