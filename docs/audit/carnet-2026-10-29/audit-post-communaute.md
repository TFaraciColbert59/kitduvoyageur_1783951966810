# Audit — post de la Communauté appliqué au drawer de post du carnet

Worktree `lkdv-cf-carnet2`, branche `cf/carnet-latest`, dev `localhost:4317`.
Mesures Playwright `getComputedStyle` : `/communaute` et `/carnets/ea5bddab-326e-4d39-9fbb-2d63f7651785`,
viewport **430 × 932**, 29 octobre 2026. Captures : `captures/b7-01-fil-commentaires-430.png`,
`captures/b7-02-fil-partage-430.png`, `captures/b7-03-carnet-commentaires-430.png`,
`captures/b7-04-carnet-partage-430.png`.

Sources lues (jamais modifiées) : `src/features/community/feed/CommunityFeedPost.tsx`,
`PostCommentsPanel.tsx`, `PostSharePanel.tsx`, `usePostComments.ts`, `usePostShareTargets.ts`,
`src/features/posts/ui/PostGlassPanel.tsx`, `PostReplyComposer.tsx`,
`src/styles/community-feed.css`, `src/styles/post-system.css`.
Côté carnet : `CarnetPostSheet.tsx`, `panes/CarnetCommentsPane.tsx`, `panes/CarnetSharePane.tsx`.

## 1. Classes `lkdv-*` du fil, telles qu'elles se peignent

| Propriété | Valeur mesurée sur `/communaute` | Où l'appliquer |
|---|---|---|
| Panneau | `.lkdv-post-panel` — `410 × 354`, rayon `28px`, `backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05)`, ombre `inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 1px rgba(255,255,255,.4), 0 0 0 .5px rgba(23,43,36,.08), 0 8px 22px rgba(23,43,36,.1)` | Panneaux Commentaires et Partage du post carnet (déjà porté par `LensPager` + `.lkdv-post-panel`) |
| Poignée de panneau | `.lkdv-panel-grab` — `410 × 12`, `padding: 6px 0 2px` ; `.lkdv-panel-grab span` — `40 × 4`, rayon `999px`, `rgba(23,43,36,.22)` | Idem, en tête de chaque panneau |
| Corps | `.lkdv-post-panel-body` — `410 × 283`, `padding: 8px 12px 4px` | Liste de commentaires, contenu du partage |
| Pied | `.lkdv-post-panel-foot` — `410 × 59`, `padding: 8px 10px 10px`, `position: relative` | Composer de commentaire (`PostReplyComposer`) |
| Ligne de commentaire | `.lkdv-comment` — `386 × 52`, `display: flex`, `gap: 9px` | Une ligne par commentaire du carnet |
| Avatar | `.lkdv-comment-av` — `30 × 30`, `border-radius: 50%` | Avatar ou initiale (`.pmi-author-initial`) |
| Corps de ligne | `.lkdv-comment-body` — `347` de large | Nom, texte, actions |
| Tête de ligne | `.lkdv-comment-head` — `347 × 16`, `gap: 6px`, alignement horizontal | Nom + date relative |
| Nom | `.lkdv-comment-name` — `600 13px`, `rgb(23,64,44)` | Nom de l'auteur du commentaire |
| Date relative | `.lkdv-comment-time` — `10.5px`, `rgb(63,81,72)` | `timeAgo` du commentaire carnet |
| Texte | `.lkdv-comment-text` — `13.5px/19.575px`, `margin: 1px 0 0`, `rgb(34,34,34)` | Texte du commentaire |
| Actions | `.lkdv-comment-actions` — `margin: 2px 0 0`, `gap: 10px` | « supprimer » (le carnet n'a ni ♥ ni réponse : voir § 4) |
| Bouton d'action | `.lkdv-comment-actions button` — `600 11px`, `rgb(63,81,72)` | Idem |
| Porte (non connecté) | `.lkdv-comments-gate` — `p` + lien, `padding` du bloc | État non connecté du composer |
| Recherche de partage | `.lkdv-search-box` — `386 × 44`, `padding: 0 12px`, rayon `999px`, `rgba(255,255,255,.72)`, `inset 0 0 0 .5px rgba(23,43,36,.12)`, `gap: 8px` ; `input` — `500 13px` | Partage du post carnet |
| Actions de partage | `.lkdv-share-actions` — `386 × 75`, `grid 4 colonnes`, `gap: 6px`, `padding: 10px 0 8px` | Idem |
| Action de partage | `.lkdv-share-action` — `92 × 57`, `600 9.5px/10.45px`, `gap: 5px` ; `.ico` — `42 × 42`, rond, `rgba(255,255,255,.7)` | Idem |
| Conversation | `.lkdv-share-conv` — ligne bordée `.5px` en bas, `padding: 8px 2px` | Destinations et conversations |
| Mini-barre | `.lkdv-share-mini` — `132 × 30`, `padding: 2.5px`, rayon `999px` ; boutons `42 × 25` | Pied du panneau de partage |

## 2. Comportements du fil (à retrouver à l'identique côté carnet)

| Comportement | Fil | Carnet (avant ce lot) |
|---|---|---|
| Ouverture du panneau | glissement horizontal ou appui sur 💬 / ↗, panneau posé 8 px sous l'en-tête du post (`--post-panel-top`) | `LensPager` à trois panneaux (Partage · Post · Commentaires) |
| Composer | `PostReplyComposer` dans `.lkdv-post-panel-foot` | identique |
| Envoi | `send(draft, replyTo)` puis scroll en bas | `send(draft)` puis scroll en bas |
| Suppression | ligne possédée → « Supprimer » | ligne possédée → « supprimer » |
| Réponse, ♥ de commentaire, édition, signalement, mentions | présents (`usePostComments`) | **absents** : `carnet_comments` n'a ni `parent_id`, ni compteur de réactions, ni table de signalement dédiée (voir § 4) |
| Tri | aucun | capsule Récents / Anciens (donnée du carnet) — conservée |
| État vide | `Sois le premier à répondre.` (12 px, centré, `#56665D`) | glyphe + tiret (règle de la fiche) → **remplacé** par l'état du fil |
| Chargement | `Chargement…` centré | squelette 5 lignes → **remplacé** par l'état du fil |
| Partage | recherche, 3 actions, conversations réelles, mini-barre | liste de champs `.ckp-field` (copier / partager / whatsapp / x / facebook / mail / lien) → **remplacé** |

## 3. Ce que le lot applique

| Zone | Classes désormais utilisées | Ce qui ne change pas |
|---|---|---|
| Commentaires | `.lkdv-post-panel-body`, `.lkdv-comment`, `.lkdv-comment-av` (+ `.pmi-author-initial`), `.lkdv-comment-body`, `.lkdv-comment-head`, `.lkdv-comment-name`, `.lkdv-comment-time`, `.lkdv-comment-text`, `.lkdv-comment-actions`, `.lkdv-comments-gate` | données réelles (`useCarnetComments`), envoi, suppression, tri Récents/Anciens, composer `PostReplyComposer`, `maxLength` 500 |
| Partage | `.lkdv-search-box`, `.lkdv-share-actions`, `.lkdv-share-action` (`.ico`), `.lkdv-share-conv`, `.lkdv-share-mini`, `.lkdv-section-empty` | les quatre destinations réelles (whatsapp, x, facebook, e-mail), copier le lien, partage natif, lien du carnet |

Aucune règle `lkdv-*` n'est dupliquée : le carnet réutilise les classes du fil. Deux règles
seulement sont ajoutées, préfixées `lkdv-`, dans `carnet-profile.css` :

- `.lkdv-comment-name .lkdv-comment-handle` — le handle `@…` que la fiche affiche depuis
  toujours, dans la ligne de nom (10.5 px, `rgb(63,81,72)`), pour ne pas perdre la donnée ;
- `.lkdv-comments-sort` — la capsule de tri du carnet, en tête du corps, à la largeur du fil.

## 4. Écarts assumés (et pourquoi)

| Écart | Raison | Effet |
|---|---|---|
| Pas de ♥ sur un commentaire de carnet | `carnet_comments` n'a pas de table de réactions : l'afficher serait un bouton mort | aucune ligne d'action n'est peinte à vide |
| Pas de « Répondre » ni d'édition | pas de `parent_id` ni d'`updated_at` dans `carnet_comments` (DDL hors périmètre) | documenté ; à faire avec une migration |
| Pas de « Signaler » sur un commentaire | le carnet ne signale que le carnet (`ReportSheet`, `table_name = 'carnets'`) | inchangé |
| Capsule de tri conservée | c'est une donnée du carnet (ordre réel des commentaires), pas une décoration | visible en tête de liste, même verre que la fiche |
| État vide et chargement alignés sur le fil | la consigne du lot 7 prime la règle « glyphe + tiret » pour ce drawer | « Sois le premier à répondre. » / « Chargement… » |
| Partage : destinations réelles au lieu des conversations | envoyer un carnet dans une conversation passe par `message_posts` (id de post), pas par un carnet : le bouton enverrait une référence invalide | les quatre cibles réelles restent, dans la forme `.lkdv-share-conv` |

## 5. Mesures après application (fiche carnet, 430 × 932)

| Élément | Fil (mesuré) | Carnet (mesuré après le lot) |
|---|---|---|
| `.lkdv-post-panel-body` | `padding: 8px 12px 4px` | `8px 12px 4px` |
| `.lkdv-comment` | `gap: 9px` | `9px` |
| `.lkdv-comment-av` | `30 × 30`, rond | `30 × 30`, rond |
| `.lkdv-comment-head` | `gap: 6px`, 16 px de haut | `6px`, 16 px |
| `.lkdv-comment-name` | `600 13px`, `#17402c` | `600 13px`, `rgb(23,64,44)` |
| `.lkdv-comment-time` | `10.5px`, `rgb(63,81,72)` | `10.5px`, `#56665D` (jeton) |
| `.lkdv-comment-text` | `13.5px/19.575px` | `13.5px/19.575px` |
| `.lkdv-post-panel-foot` | `8px 10px 10px`, filet `.5px` | identique |
| `.lkdv-share-actions` | grille 4 × 92 px, `gap 6` | grille 4 × 91 px, `gap 6` |
| `.lkdv-share-action` | `600 9.5px/10.45px` | identique |
| `.lkdv-share-action .ico` | `42 × 42`, rond, blanc `.7` | identique |
| `.lkdv-share-conv` | `padding 8px 2px`, `gap 9` | `8px 2px`, `gap 9` |
| `.lkdv-search-box` | `44 × 386`, rayon 999 | identique |
| `.lkdv-share-mini` | `132 × 30`, `padding 2.5px` | identique |

Cause de divergence trouvée : `src/components/compte/overlay/compte-overlay.css` (hors
périmètre) force `.lkdv-post-drawer .lkdv-comment-body p { font-size: 12.5px !important;
line-height: 1.35 !important; color: #222 !important }`, `.lkdv-share-actions { display: flex;
flex-wrap: wrap; gap: 7px }` et `.lkdv-share-conv { gap: 12px !important; padding: 10px 4px
!important }`. Les règles `.ckp-post-sheet` de `carnet-profile.css` rétablissent les valeurs
du fil avec la même spécificité et les mêmes `!important`.

## 6. Reproduire les mesures

```js
// Playwright, viewport 430 × 932, sur /communaute puis sur la fiche
[...document.querySelectorAll('.lkdv-comment, .lkdv-post-panel-body, .lkdv-search-box')]
  .map((el) => [el.className, getComputedStyle(el).padding, getComputedStyle(el).font]);
```
