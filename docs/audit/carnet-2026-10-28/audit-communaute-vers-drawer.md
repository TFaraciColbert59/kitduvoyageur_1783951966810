# Audit — design system de la page Communauté, réappliqué au drawer Moments

Worktree `lkdv-cf-carnet2`, branche `cf/carnet-latest`, dev `localhost:4317`.
Mesures Playwright : `/communaute` et `/carnets/13072b4b-fa66-40d2-b30b-a66f8aabb2c2`,
viewport 430 × 932, locale `fr-FR` (29 octobre 2026).
Sources lues : `src/features/community/feed/**` (`CommunityFeedPost.tsx`,
`PostSharePanel.tsx`, `PostCommentsPanel.tsx`, `CommunityFeedTopBar.tsx`,
`usePostShareTargets.ts`, `usePostInteractions.ts`), `src/features/posts/ui/PostGlassPanel.tsx`,
`src/features/community/sections/CommunityDrawer.tsx`, `src/styles/community-feed.css`,
et les primitives partagées `src/styles/account-glass.css` (`.pmi-*`, `.gbtn`, `.tb`).

Rappel : « valeur mesurée » = `getComputedStyle` sur la page Communauté du jour ;
« déclaré » = aucune instance à l'écran au moment de la mesure, valeur lue dans la feuille.

## 1. Boutons

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Bouton rond d'action | `.gbtn` — `38 × 38`, `border-radius: 50%`, `rgba(255,255,255,.5)`, `inset 0 1px 0 rgba(255,255,255,.9), 0 2px 8px rgba(23,43,36,.08)`, `:active scale(.94)` | Rien à ajouter : le volet n'a aucune action. La croix du châssis (36) en tient lieu |
| Croix de fermeture | `.ckp-drawer-close` — `36 × 36`, rayon 999, `rgba(255,255,255,.9)`, cible 44 px (`::after inset -4px`), `:active scale(.94)` | En-tête du drawer (repris tel quel) |
| Poignée | `.ckp-grabber` — barre `42 × 5`, piste `rgba(23,43,36,.18)`, 6 px / `.32` au toucher en 120 ms | En-tête du drawer (repris tel quel) |
| Segments de capsule | `.ckp-capsule .ckp-tabs button` — `41,5 × 25`, rayon 999, `600 11.5px/1`, `#56665d`, actif `#17402C`, `:active scale(.94)` | Capsule du pied : elle ouvre Statistiques / Partage |
| Capsule de verre | `.ckp-capsule` — mesuré `88 × 30` à `318 / 509`, `rgba(23,43,36,.06)`, `blur(18px) saturate(1.6)`, `inset 0 1px 1px .06`, `inset 0 -1px 0 rgba(255,255,255,.65)`, `0 2px 8px rgba(23,43,36,.10)` | Pied du drawer, à 12 px des bords — **identique** à celle du drawer Statistiques |
| Bouton de compteur | `.pmi-post-btn.lkdv-count-btn` — `45 × 34` (min-width 34 + `padding 0 8px`), rayon 50 %, `transform .15s`, `:active scale(.86)` | Pas de compteur dans le volet. Le point d'entrée est `.ckp-daypill-count`, qui garde la mesure carnet `11/500` (voir § 2) |
| Pastille « Pour toi » | `.lkdv-pourtoi-pill` — `77,14 × 40`, rayon 999, `padding 0 14px`, `600 13px/1`, `--bar-thumb-shadow` | Rien : le volet n'a pas de sélecteur ‹ Pour toi › |

## 2. Typographie

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Texte de post | `.lkdv-feed-post-text` — `400 15px/21,3px`, `#17402c` | Aucun texte long dans le volet : heure à gauche, lieu à droite |
| Nom d'auteur | `.pmi-author-txt b` — `600 12px/13,8px`, `#17402c` | Rien (pas de personne dans la liste) |
| Métadonnée d'auteur | `.pmi-author-txt small` — `500 10.5px/12,07px`, `#56665d` | Teinte et graisse de référence pour la méta du carnet (`#6B7A70`, `500 11px`) |
| Compteur | `.lkdv-count` — `600 10.5px/1`, `tabular-nums`, `#17402c` | Compte de moments : **écart assumé**, `.ckp-daypill-count` reste `500 11px/1.15 #6B7A70` (mesure de la carte, inchangée) |
| Kicker de section | `.lkdv-search-kicker` — `800 9.5px/1`, capitales, `letter-spacing .1em`, `#56665d` | Aucun : le volet n'a **aucun titre** |
| Libellé de ligne | `.ckp-field-label` — `500 13px/1.42`, `#6B7A70`, ellipse, 46 % max | Colonne gauche : l'heure (`J2 · 13:20` sur le Résumé, `13:20` sur un jour) |
| Valeur de ligne | `.ckp-field-value` — `500 13px/1.15`, `#172B24`, `tabular-nums` (mesuré `tabular-nums`), alignée à droite | Colonne droite : le lieu |
| Valeur absente | `.ckp-field.is-missing .ckp-field-value` — `#B4BDB6` | Un lieu manquant garde sa colonne et prend la teinte du tiret |

## 3. Surfaces

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Verre de barre / pastille | `--bar-glass-bg` = `linear-gradient(rgba(255,255,255,.486), rgba(255,255,255,.325) 55%, rgba(255,255,255,.404))` + `--bar-glass-blur` = `blur(7.2px) saturate(1.9) brightness(1.07)` | La capsule du pied garde **le verre du châssis carnet** (`rgba(23,43,36,.06)` + 2 `inset` + `0 2px 8px .10`) : c'est la référence imposée par le drawer Statistiques |
| Ombre de pose | `.pmi-more-pill` — `inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 .5px rgba(23,43,36,.08), 0 2px 8px rgba(23,43,36,.08)` | Même famille que l'ombre de la capsule (`0 2px 8px .10`) |
| Feuille | `.lkdv-half-drawer` — rayon `24px 24px 0 0`, `blur(30px) saturate(1.7) brightness(1.04)`, `0 0 0 .5px .12`, `0 -8px 36px .16` | Châssis carnet `.ckp-card--drawer` : rayon `24 24 16 16`, mêmes liserés, `0 -10px 34px .16` — non touché |
| Panneau de post | `.lkdv-post-panel` — rayon 28, `#fcfbf8` | Sans objet (le volet vit dans la feuille carnet) |
| Filet de séparation | `.lkdv-comments-excerpt` / `.lkdv-section-row` — `.5px solid rgba(23,43,36,.1)` / `.08` | Filet des lignes : `.ckp-field + .ckp-field::before` — mesuré `top 0`, `left 16px`, `right 16px`, `height .5px`, `rgba(23,43,36,.06)` |
| Carte de post | `.lkdv-feed-post` — `410 × 410`, rayon 28, `inset 0 0 0 .5px rgba(255,255,255,.18)`, `0 10px 26px rgba(23,43,36,.16)` | Sans objet |

## 4. Espacements et géométrie

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Colonne | `.lkdv-feed-column` — `430` de large, `padding: 0 10px 80px`, `max-width: 520px` | Le châssis carnet garde sa feuille `12 / 48 / 406` ; le corps garde `16px` de gouttière |
| Ligne de liste | 48 px de haut, valeur à droite | `.ckp-field` — mesuré `374 × 48`, `x = 28` |
| Rythme de groupe | 3 lignes puis 20 px d'air | `.ckp-group` + `groupsOfThree` — mesuré : `J1 · 19:30` finit à `y = 265`, `J2 · 07:40` commence à `y = 285` |
| Barre basse | `.tb` — `402 × 54`, `left/right 14`, `bottom 24`, rayon 999, `padding 3px` | Hors feuille : la bottom bar reste sous le drawer, non touchée |
| Poignée / corps | poignée 13 px, contenu à 16 px sous elle, réserve basse 64 px | Mesuré : première ligne à `y = 97` (`48` + `13` + `16` + `20`) |

## 5. Pastilles

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Pastille auteur | `.pmi-author` — `124,78 × 36`, rayon 999, `padding 4px 10px 4px 4px`, `min-height 36px`, verre de barre | Rien : aucune personne dans la liste |
| Badge | `.lkdv-create-badge` — `600 9.5px/1.2`, capitales, `rgba(23,64,44,.08)` | Rien |
| Badge de notification | `.lkdv-notif-badge` — 17 px, rayon 999, `rgba(23,64,44,.74)` | Rien |
| Compte de la carte | `.ckp-daypill-count` — `500 11px/1.15`, `#6B7A70`, `tabular-nums`, mesuré `67 × 12,64` | **Point d'entrée du drawer** : bouton, même texte (« 15 moments »), cible 44 px par `::after inset -14px -8px`, `:active opacity .6` |

## 6. Listes

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Ligne de commentaire | `.lkdv-comment` — avatar 30, `gap 9`, nom `600 13`, temps `400 10.5 #56665d` | Sans objet |
| Ligne de section | `.lkdv-section-row` — `min-height 72`, `padding 8px 6px`, `border-bottom .5px rgba(23,43,36,.08)` | Remplacée par la ligne de 48 px du carnet (filet inséré de 16 px, jamais pleine largeur) |
| Conversation de partage | `.lkdv-share-conv` — `padding 8px 2px`, `border-bottom .5px .08` | Sans objet |
| Liste de champs | `.ckp-field` — 48 px, libellé placeholder, valeur à droite | **La liste des moments** : une ligne par moment |
| État vide | `.ckp-empty-state` — glyphe 32 px à 30 % + tiret `#B4BDB6` | **État vide du volet** : glyphe + `—`, aucun texte |

## 7. Icônes

| Élément | Classe / valeur mesurée | Où l'appliquer dans le drawer Moments |
|---|---|---|
| Actions de post | `.pmi-post-btn svg` — 18 px | Sans objet |
| Capsule | icônes 16 px (`Icon name="trending-up" size={16}`) | Segments de la capsule du pied (inchangés) |
| Croix | `X size={16}` dans un bouton de 36 px | En-tête (inchangé) |
| Glyphe d'état vide | 32 px, opacité `.3` | État vide du volet |

## 8. Ce que le volet Moments réutilise — et ce qu'il n'invente pas

| Besoin | Réutilisé | Nouveau ? |
|---|---|---|
| Capsule du pied | `.ckp-capsule` + `CarnetMediaTabs` (`--n: 2`, pas 41,5) | non |
| Ligne de liste | `CarnetField` (`.ckp-field`, `.ckp-field--wide`, `.ckp-field--mid`) | non |
| Groupes de trois | `.ckp-group` + `groupsOfThree` | non |
| État vide | `CarnetEmpty` (`.ckp-empty-state`, `.ckp-empty-glyph`, `.ckp-empty-dash`) | non |
| En-tête | `.ckp-drawer-head` (poignée + croix), aucun titre | non |
| Point d'entrée | `.ckp-daypill-count` devenu bouton (`button.ckp-daypill-count`) | une règle de 3 lignes, aucun composant |
| Volet | `.ckp-pane ckp-pane-moments` ajouté à la règle de rythme existante (`.ckp-pane-share, .ckp-pane-moments, …`) | une classe, zéro propriété nouvelle |

Aucun préfixe `lkdv-*` concurrent n'a été créé, aucun `ckp-*` ad hoc non plus :
le volet est un assemblage de primitives déjà mesurées, la seule règle ajoutée est
la cible tactile du bouton de compte (44 px, `::after`) et sa pression (`opacity .6`).

## 9. Écarts assumés vis-à-vis de la Communauté

| Écart | Pourquoi | Effet mesuré |
|---|---|---|
| Compte de moments en `500 11px #6B7A70` (Communauté : `600 10.5px #17402c`) | La pastille appartient à la carte du carnet ; changer sa graisse ou son encre déplacerait la ligne de 16 px du gabarit profil | `.ckp-daypill-count` : `67 × 12,64`, inchangé au pixel |
| Verre de la capsule `rgba(23,43,36,.06)` (Communauté : `--bar-glass-bg` blanc) | La consigne impose la capsule **du drawer Statistiques**, qui est la référence de la fiche | `88 × 30`, lentille `41,5 × 25` — identique |
| Colonne de valeur élargie (jusqu'à 58 %) au lieu de 120 px | Un lieu est une donnée longue : c'est la règle du système pour un lieu (`.ckp-field--wide` + `--mid`, ellipse au milieu), déjà appliquée à départ / arrivée dans le drawer Statistiques | Valeur mesurée `197,13` de large, alignée à droite, `tabular-nums` |
| Aucun segment actif dans la capsule quand Moments est ouvert | Moments n'est pas un volet du sélecteur (2 segments, 88 px imposés). La lentille s'éteint — état « page hors sélecteur » déjà prévu par `.ckp-capsule > .ckp-th[data-off='true']` | Lentille `320,5 / 511,5 / 41,5 × 25`, `opacity 0` (drawer Statistiques : `opacity 1`) |

## 10. Reproduire les mesures

```bash
CKP_BASE=http://localhost:4317 node docs/audit/carnet-2026-10-28/outils/moments-captures.mjs
```

Sortie : `/tmp/ckp-moments/mesures.json` + captures `01` à `09`.
