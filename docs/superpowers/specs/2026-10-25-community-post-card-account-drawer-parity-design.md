# Carte post Communauté = drawer post Compte — design

**Date :** 2026-10-25
**Statut :** relevé + cible à valider
**Périmètre :** `CommunityFeedPost` (fil `/communaute`) et `PostDrawer` (drawer post du Compte).

---

## 1. Vérité unique

Le **drawer post du Compte** est la seule référence visuelle et comportementale.
La carte du fil Communauté doit reprendre **exactement** :

- sa surface et sa géométrie ;
- son header auteur ;
- son média 4:5 ;
- sa capsule d’actions ;
- son menu `···` ;
- ses trois panneaux (partage, post, commentaires) ;
- son pager et ses gestes ;
- ses états like, lightbox, commentaires, partage, options.

Aucune variante « feed » ne doit subsister.

---

## 2. Mesures de référence (viewport 430×932, Compte)

| Élément | Compte | Communauté actuelle |
|---|---|---|
| Drawer/carte | `x=12 y=48 406×541` | `x=10 y=163 410×410` |
| Rayon | 28 px | 28 px |
| Surface | sheet transparent + verre | carte verte `#17402C` + ombre |
| Média | 4:5, plein cadre | 1:1, plein cadre |
| Header | `lkdv-overlay-heading` (verre, avatar 36, nom 13, handle + temps) | `pmi-author` (avatar 28, nom + handle, sans temps) |
| Options | menu 6 entrées | menu 4 entrées |
| Actions | 3 × 40 px, sans compteurs | 3 boutons avec compteurs `12/3/1` |
| Panneaux | LensPager 3 panes dans la sheet | PostGlassPanel 2 panes à 80 % de la carte |
| Partage | onglets Envoyer / Partage externe | actions rondes + mini-sélecteur |
| Commentaires | pane dédiée | panneau overlay |
| Lightbox | oui | non |
| Carrousel média | oui | non |
| Fermeture | header cliquable, swipe, menu Fermer | pas de fermeture explicite |

---

## 3. Captures

### Compte
- `docs/communaute/account-post-post.png`
- `docs/communaute/account-post-options.png`
- `docs/communaute/account-post-share.png`
- `docs/communaute/account-post-share-external.png`
- `docs/communaute/account-post-comments.png`

### Communauté
- `docs/communaute/community-post-card.png`
- `docs/communaute/community-post-options.png`
- `docs/communaute/community-post-comments.png`
- `docs/communaute/community-post-share.png`

---

## 4. Décision d’architecture

Extraire du `PostDrawer` un **`PostCardSurface`** partagé :

- header verre ;
- média 4:5 ;
- capsule d’actions ;
- menu d’options ;
- `PostLensPager` 3 panes ;
- panes partage/post/commentaires ;
- lightbox et carrousel média.

Le `PostDrawer` l’utilise dans son overlay Compte.
`CommunityFeedPost` l’utilise dans une **carte de fil** de mêmes dimensions, sans overlay plein écran.
Une seule source de markup/CSS/comportement.

---

## 5. Critères d’acceptation

- À 430 px, la carte du fil mesure `406×541` à `x=12`, rayon 28.
- Même header, même média 4:5, même capsule 3×40 sans compteurs.
- Même menu 6 entrées, mêmes actions.
- Même pager 3 panes, mêmes swipes, mêmes animations.
- Même pane partage (onglets Envoyer / Partage externe), mêmes actions.
- Même pane commentaires, même composer, mêmes états.
- Même lightbox, même carrousel.
- Aucun compteur dans la capsule.
- Aucun `PostGlassPanel` ni `lkdv-share-mini` dans le fil.
- Tests visuels et E2E au vert, build Cloudflare déployé.
