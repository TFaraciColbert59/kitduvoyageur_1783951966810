# INVENTAIRE DU DESIGN DE RÉFÉRENCE — à dupliquer sur `/pays/[code]`

**Référence :** `https://kitduvoyageur.faracitonyp.workers.dev/compte` (prod Cloudflare, Worker `kitduvoyageur`), compte démo **`lea.fontaine`** — 18 publications, 50 abonnés, 34 abonnements, 18 sorties, 339 km, 12,9 k m D+, sac 9,4 kg.
**Méthode :** Chromium 430 × 932, `getComputedStyle` + `getBoundingClientRect` sur chaque part, **6 captures d'états** (`audit-pays/inventaire/01…06`), JSON joints (`inventaire.json`, `inventaire-2.json`). Mesures du 25/10/2026, 16 h 45.

Chaque valeur ci-dessous est **mesurée**, pas estimée. `—` = valeur absente/non applicable.

---

## 1. Les six couches de matière

L'effet du Compte ne vient pas d'une seule surface : six couches se superposent. C'est ce qui manque aujourd'hui à la page pays.

| # | Couche | Recette exacte | Où |
|---|---|---|---|
| 1 | **Fond photo** | `<img class="bg-img">` en `position:absolute; inset:0; width/height 100%; object-fit:cover` — **une photo réelle**, pas un `background-image` CSS | `.bg` |
| 2 | **Voile du fond** | `.bg::after` `linear-gradient(rgba(255,250,236,.08), rgba(255,255,255,0) 30%, rgba(245,242,236,.12) 60%)`, `inset:0` | `.bg::after` |
| 3 | **Carte (verre lourd)** | `linear-gradient(rgba(255,255,255,.486), rgba(255,255,255,.384))` + `backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05)` + ombres `inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 1px rgba(255,255,255,.4), inset 0 0 16px rgba(255,255,255,.12), 0 0 0 .5px rgba(23,43,36,.12), 0 10px 30px rgba(23,43,36,.14)` + `r24` | `.card.cs` |
| 4 | **Verre clair** (pilule, boutons ronds, sélecteur, barre) | `linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.325) 55%, rgba(255,255,255,.404))` + `backdrop-filter: url(#lf…) blur(4px) saturate(1.9) brightness(1.07)` + `inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 1px rgba(255,255,255,.45), inset ±1px 0 1px rgba(255,255,255,.28), inset 0 0 12px rgba(255,255,255,.14), 0 0 0 .5px rgba(23,43,36,.14), 0 8px 22px rgba(23,43,36,.12)` | `.lg`, `.tb`, `.ig-tabs` |
| 5 | **Feuille (drawer)** | `linear-gradient(rgba(245,242,236,.34), rgba(245,242,236,.2) 48%, rgba(245,242,236,.26))` + `backdrop-filter: blur(30px) saturate(1.7) brightness(1.04)` + ombre de carte | `.sheet` |
| 6 | **Popover** | `linear-gradient(rgba(255,255,255,.325), rgba(255,255,255,.145) 50%, rgba(255,255,255,.243))` + `backdrop-filter: blur(7.2px) saturate(1.9) brightness(1.07)`, `r22` | `.popv` |

**Lentille liquide** : 7 filtres SVG générés (`lf109x34r17`, `lf38x38r19`, `lf88x30r15`, `lf402x48r24`…) appliqués via `backdrop-filter: url(#lf…)`. Sans elle, le verre est plat.
**Scrim** : `rgba(255,255,255,.06)` + `blur(3px)`, apparition `.35s`.

---

## 2. Typographie par rôle (mesurée)

| Rôle | Taille / interligne | Graisse | Interlettre | Couleur |
|---|---|---|---|---|
| Base écran | 14 / normal | 400 | −0,14 px | `#172B24` |
| Pilule (titre) | 16 / 16 | 600 | −0,32 px | `rgba(255,255,255,.94)` |
| Valeur de stat | 19 / 19,95 | 700 | −0,38 px | `#17402C` |
| Libellé de stat | 10,5 / 12,6 | 500 | normal | `#56665D` |
| Bio ligne 1 | 12 / normal | 600 | −0,14 px | `#17402C` |
| Bio ligne 2 | 12 / 15,6 | 400 | −0,14 px | `#56665D` |
| Anneau — libellé | 9,8 / 10,78 | 500 | −0,14 px | `#172B24` |
| Barre basse | 10 / 10 | 600 | −0,1 px | `#56665D` (actif `#2F6B45`, 700) |
| Bouton de feuille — primary/ghost | 11,5 / 1 | 600 | −0,14 px | `#fff` / `#172B24` |

`font-variant-numeric: tabular-nums` sur toutes les valeurs. **Aucune majuscule** sur les libellés (sauf le libellé historique « HUB » du DOM).

---

## 3. Anatomie 430 × 932 (boîtes mesurées)

| Part | Boîte (x / y / w / h) | Détail |
|---|---|---|
| `.phone` | 0 / 0 / 430 / 932 | `display:grid; grid-template-rows: calc(69% − 46px) 1fr` |
| `.bg` | 0 / 0 / 430 / 932 | photo + voile (§1) |
| `.top` | 0 / 0 / 430 / **597,1** | `padding: 6px 12px 8px`, `gap: 4`, colonne |
| `.ig-top` | 12 / 6 / 406 / 36 | pilule à gauche, 3 ronds à droite (`gap 5`) |
| `.ig-handle` | 12 / 7 / **109** / 34 | `padding 0 11px`, r999, contenu = pseudo/handle |
| `.ig-top-btn` | 294 / 337 / 380 → **38 × 38** | r50 %, fond `rgba(255,255,255,.5)` |
| `.card.cs` | 12 / 48 / 406 / **541,1** | r24, scroll interne |
| `.card-scroll` | même boîte | `padding: 8px 12px 56px`, `gap: 7` |
| `.ig-header` | 24 / 56 / 382 / 68 | `grid 68px minmax(0,1fr)`, `gap 10` |
| `.ig-avi-wrap` | 26 / 58 / 66 / 66 | r50, padding 2,5 |
| `.ig-avi-in` | 30 / 62 / 58 / 58 | r50, bordure `2px rgba(255,255,255,.92)`, `overflow:hidden` |
| `.ig-stats` | 102 / 71,7 / 302 / 38,5 | 3 cellules sans gap |
| `.ig-stat` | 100,7 × 38,5 | r14, `padding 2px 3px`, fond `rgba(255,255,255,.38)` |
| `.ig-bio` | 26 / 134 / 378 / 32,6 | `gap 2` |
| `.ig-hl-row` | 26 / 176,6 / 378 / 56,4 | `padding 0 2px`, `gap 8`, **défile horizontalement** |
| `.ig-hl` | 71,6 × 56,4 | `flex 0 0 calc((100% − 16px)/5)` → **5 visibles** |
| `.ig-hl-ring` | 44 × 44 | `padding 2`, `conic-gradient(from 140deg, rgba(23,64,44,.7), rgba(91,127,85,.45), rgba(255,255,255,.9), rgba(23,64,44,.7))` |
| `.ig-hl-in` | 38 × 38 | r50, `rgba(244,247,243,.88)`, bordure `1px rgba(255,255,255,.95)`, **`overflow:hidden`** → accueille la couverture |
| `.ig-grid-wrap` | 12 / 243 / 406 / (contenu) | `r22`, marges négatives −14 |
| `.ig-grid` | 406 de large | **`gap: 2px`** (et non 3) |
| `.ig-tile` | **134 × 134** | r2, fond `#17402C`, `overflow:hidden` |
| `.ig-tile .t-type` | 20 × 20, à 6 px du haut / 14 px de la droite | `rgba(12,24,18,.5)`, `blur(8px) saturate(1.4)`, **r7** |
| `.ig-tabs-float` | 320 / 549,1 | flottant dans la carte |
| `.ig-tabs` | 88 × 30 | r999, `padding 2,5` |
| `.ig-th` (lentille) | 41,5 × 25 | `translateX(0%)` / `translateX(100%)` |
| `.mapzone` / `.map` | 0 / 597,1 / 430 / 334,9 | `border-radius: 32px 32px 0 0`, `overflow:hidden`, ombre haute |
| `.tb` | 14 / 868 / 402 / 48 | r999, `padding 2`, `position:absolute` |
| `.tb button` | 79,6 × 44 | 5 items, `gap 2` |
| `.tb .lens` | 79,2 × 40 | lentille de l'item actif |
| `.tb-badge` | 16 × 16 | blanc, 9/700, en haut à droite de l'icône |

---

## 4. Composants à dupliquer

### 4.1 Barre haute
Pilule (contenu = identité : pseudo, titre) + **exactement 3 boutons ronds 38** : créer / affichage / compte. Le retour vit **dans la pilule**, le menu **dans la carte**.

### 4.2 En-tête d'identité
Visuel 66 (photo ou initiales) dans un anneau conique + **3 stats** (valeur 19/700 tint, libellé 10,5/500 gris), cellules jointives, r14, fond verre `.38`.

### 4.3 Bio
Deux lignes : `[pays] · [sorties · km · D+]` en 12/600 tint, puis le texte en 12/15,6 gris, tronqué à 1 ligne.

### 4.4 Anneaux (5 visibles sur 8)
44 px, anneau conique, disque 38 qui contient **soit une icône, soit une couverture photo** (`object-fit: cover`). Libellé 9,8 px sous l'anneau. Défile horizontalement.

### 4.5 Grille 3 colonnes
Tuiles carrées 134, **gap 2**, r2, photo `object-fit: cover`, **badge `t-type` 20 × 20 r7** en haut à droite (icône du type de contenu), pas de texte sur la tuile. Au 9ᵉ élément, la tuile porte le sélecteur flottant.

### 4.6 Sélecteur d'affichage
88 × 30, deux positions, lentille 41,5 × 25 qui glisse (`translateX(0/100%)`, `.28s`), icônes 15 px.

### 4.7 Barre basse
402 × 48, 5 items **Hub · Explorer · Communauté · Messages · Compte**, icônes 19 px + libellé 10 px, lentille 79 × 40 sur l'actif, **pastille 16 px** si compteur réel (ex. `4` sur Hub).

### 4.8 Drawer (le point le plus raté aujourd'hui)

Mesuré à l'ouverture : `data-det="card"`, **`406 × 708,3`** à (12, 48) — il couvre la carte **et déborde sur la carte du bas** (932 − 48 − 175,7).

| Part | Valeur |
|---|---|
| Support | `r24`, `overflow:hidden`, `z20`, fond transparent |
| Feuille | matière §1.5, `r24`, `padding 0 13px 11px` |
| Poignée | `.grab` 18 px de haut, capsule blanche centrée |
| **Nav interne** | capsule 378 × 48 en haut, **5 lentilles icônes** (reçus, notifications, réglages, profil, partage), fond `rgba(255,255,255,.65)`, `blur(28px) saturate(1.8)`, bordure `1px rgba(255,255,255,.8)`, r999 |
| Titre de bloc | 15/700 + sous-titre 11,5/400 gris |
| Carte interne | `r18-22`, fond `rgba(255,255,255,.34)`, padding 12, `gap 8` |
| Ligne d'article | icône dans un carré `r10` 36 × 36 `rgba(23,64,44,.08)`, titre 12,5/600, `×1` à droite |
| Stepper | 4 pastilles 14 px + barre 2 px, labels 9,5 px (`Confirmée · Préparée · Expédiée · Livrée`), état fait = tint, à venir = `rgba(23,43,36,.15)` |
| Pastille d'état | `r999`, 10,5/700, fond tinté (`Confirmeé` vert clair, `Livrée` vert, `Expédiée` bleu) |
| Boutons | **primary** : `bg #17402C`, texte blanc 11,5/600, r999, `padding 0 13px`, h32, ombre `0 4px 14px rgba(23,64,44,.2)` — **ghost** : `rgba(255,255,255,.62)`, texte label, ombre `inset 0 1px 0 #fff, 0 0 0 .5px rgba(23,43,36,.1)` |
| Sélecteur bas de feuille | capsule d'icônes (grille, liste, boîte, fermer), 378 de large |
| Effets | `.tb` sort (`opacity 0`), `phone[data-sheet-open=true]`, `Échap` et poignée ferment |

### 4.9 Popover
262 × 126,5 à (156, 102), ancré sous son bouton, r22 : titre 15/700, sous-titre 11,5 gris, interrupteur (piste 51 × 31 tint, pastille blanche 27), slider 340 px avec libellés `Clair` / `Teinté` 11,5.

### 4.11 Vue 2 du sélecteur — carte média (le modèle de présentation riche)

Quand le sélecteur passe sur sa 2ᵉ position (« Sorties et voyages faits »), la grille est remplacée par **une carte média**, pas par des lignes de texte :

```
┌─────────────────────────────────────────────┐
│ [Preuve GPS ✓]                     [3199 m] │   badges posés sur la photo,
│                                             │   verre sombre translucide, r999
│              PHOTO (object-fit cover)        │   hauteur ≈ 300 px, r18
│                                             │
│  ┌───────────────────────────────────────┐  │   carte de légende qui chevauche
│  │ Traversée des Grands Mulet            │  │   le bas de la photo (verre clair,
│  │ 20 oct.                               │  │   r16, padding 12)
│  │ 17 km · +1420 m · Mont                │  │   titre 15/700 · date 11,5 · méta 11,5
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
   rail de défilement vertical à droite (2 px, verre)
```

Règles à retenir pour la page pays :
- **jamais** une donnée brute seule : chaque bloc a un titre, un contexte, puis des métadonnées séparées par `·` ;
- les qualificatifs sont des **pastilles** posées sur l'image (preuve, difficulté, saison, altitude) ;
- la carte de légende **chevauche** l'image, elle ne la pousse pas ;
- un rail de défilement visible indique qu'il y a d'autres cartes.

### 4.10 Carte du bas
`.map` plein cadre, **`r32 32 0 0`**, ombre haute `0 -1px 0 rgba(255,255,255,.8), 0 -10px 26px rgba(23,43,36,.18)`. Contenu réel : tuiles satellite Esri/OSM, trace du compte, marqueurs numérotés, **sélecteur d'échelle à 3 positions** en haut à gauche (verre r999, h34), **colonne de contrôles** à droite (calques, repère, +, −), attribution `r999` 178,9 × 22 à (241,1 ; 838) en `opacity .78`.

---

## 5. États & motion

| Élément | État / transition |
|---|---|
| Appui | `scale(.96)` pilule et boutons, `.92` anneau |
| Lentille sélecteur | `translateX` `.28s cubic-bezier(.3,1.35,.4,1)` |
| Lentille barre | `transform .55s cubic-bezier(.3,1.35,.4,1)` |
| Drawer | `top/bottom .45s cubic-bezier(.32,.72,0,1)` |
| Popover | `opacity .2s, transform .35s cubic-bezier(.3,1.4,.5,1)` |
| Scrim | `opacity .35s` |
| Vide | phrase honnête + action dans le flux |
| Chargement | squelettes aux dimensions exactes des parts |

---

## 6. À dupliquer sur `/pays/[code]` — mapping

| Zone du Compte | Ce qu'on garde à l'identique | Contenu pays qui remplace |
|---|---|---|
| `.bg` + `.bg-img` + voile | 3 couches §1 | photo du pays (`hero_image_url`), jamais un fond plat |
| Pilule | h34, 16/600, `← Atlas` | — |
| 3 ronds | 38, verre clair, lentille | rechercher · Kit IA · fiche d'identité |
| En-tête | visuel 66 + **3 stats** | drapeau 66 · superficie · capitale · monnaie |
| Bio | 2 lignes | continent · région · fuseau · langue / slogan |
| Anneaux | 5 visibles, icône **ou couverture** | 8 sections ; couvertures = photo d'illustration quand la section en a une (destinations, gastronomie), icône sinon |
| Grille | 3 col, gap 2, tuiles 134 r2, badge 20 r7 | tuiles de la section active + badge de type ; légende dans la liste, pas sur la tuile |
| Sélecteur | 88 × 30, lentille 41,5 | Grille \| Liste |
| Barre | 402 × 48, 5 items, pastille | Hub · Explorer · Communauté · Messages · Compte |
| Drawer | **406 × 708,3**, nav 5 lentilles, cartes internes, primary/ghost | fiche d'identité, pratique (formalités, transport, budget, santé, électricité, climat), sources |
| Popover | 262 × 126,5 | « Affichage » (densité) ou « Filtres » de section |
| Carte | r32 haut, contrôles, attribution | carte du pays (contour réel ou tuiles) + repères |

---

## 7. Écarts constatés sur notre `/pays` (à corriger)

| # | Reproche | Cause mesurée | Correction |
|---|---|---|---|
| 1 | **La carte ne s'affiche pas** | la `mapzone` ne contient que des points positionnés ; aucune tuile, aucun moteur | monter une vraie carte plein cadre (Leaflet/Esri comme `CarnetTraceMap`) + contrôles + attribution |
| 2 | **Couleur de fond du drawer et de la carte fausses** | notre `.sheet` hérite d'une autre génération ; notre carte n'a pas le voile | appliquer §1.3 (carte) et §1.5 (feuille) **à la lettre**, sans surcharge |
| 3 | **Le fond n'a pas le bon effet** | on met la photo en `background-image` sur `.bg`, sans `<img class="bg-img">` ni voile `::after` | photo en `img` absolute `object-fit:cover` + `.bg::after` §1.2 |
| 4 | **Drawers et sous-drawers mal affichés** | ouverture à 541 au lieu de **708,3**, pas de poignée, pas de nav 5 lentilles, pas de cartes internes | refaire le drawer selon §4.8 : support 12/48/406×708,3, poignée, nav, cartes, boutons primary/ghost |
| 5 | **Sélecteur mal affiché** | notre lentille est en `translateX(0/100%)` mais la largeur du sélecteur n'est pas fixée à 88 et le `padding` diffère | figer 88 × 30, lentille 41,5 × 25, `padding 2,5` |
| 6 | **Boutons / infos / disposition** | notre grille liste des lignes `.li` sans hiérarchie (titre + valeur bruts), sans icône, sans pastille, sans stepper | adopter les composants §4.8 : ligne à icône, pastille d'état, stepper, boutons pill |
| 7 | **Le contenu de la grille est moche / mal positionné** | tuiles sans badge, libellés sur la tuile, gap 3 au lieu de 2, pas de 9ᵉ tuile « sélecteur » | §4.5 : photo seule, badge 20 r7, gap 2, sélecteur flottant en bas à droite |

---

## 8. Lots de correction proposés (dans cet ordre)

1. **Matière** : `.bg` en 3 couches, carte §1.3, feuille §1.5 (aucune surcharge d'écran).
2. **Carte** : vraie carte plein cadre + contrôles + attribution, arrondi 32 en haut.
3. **Drawer** : support 406 × 708,3, poignée, nav 5 lentilles, cartes internes, boutons primary/ghost, stepper.
4. **Grille** : gap 2, badge 20 r7, 9ᵉ tuile = sélecteur.
5. **Contenus** : passer les listes brutes en composants de ligne (icône 36 r10, titre 12,5/600, valeur, pastille).
6. **Recette** : les 6 captures d'états rejouées sur `/pays/fr`, `design:fidelity` 3 viewports, diff pixel.

---

## 9. Captures de référence

`audit-pays/inventaire/` : `01-ecran.png`, `02-drawer-compte.png`, `03-popover.png`, `04-selecteur-etat2.png`, `05-carte.png`, `06-carte-agrandie.png` + `inventaire.json`, `inventaire-2.json`.


---

## 10. Application concrète à la page pays (ce qui doit être « beau »)

| Section | Carte média à produire (modèle §4.11) |
|---|---|
| **Incontournables** | photo du lieu, badges `Parc national`, `4 h`, pastille altitude ; légende : nom + région + `· saison` |
| **Activités** | photo, badges `Difficile` / `Modérée`, durée ; légende : nom + `dénivelé · durée · saison` |
| **Gastronomie** | photo, badge `€€` / catégorie ; légende : nom + ville + `· spécialité` |
| **Hébergements** | photo, badge type (refuge, gîte, hôtel) ; légende : nom + altitude + prix indicatif |
| **Culture** | pas de photo : cartes typographiques (fait culturel en titre 15/700, valeur, explication 11,5) |
| **Pratique** | lignes à icône 36 r10 (visa, assurance, permis, monnaie, prises, réseau) + valeur alignée à droite, groupées par thème |
| **Communauté** | cartes horizontales (photo 64 r12 + titre + auteur + compteurs) au lieu de lignes brutes |
| **Fiche d'identité (drawer)** | cartes internes r18 : « Géographie », « Société », « Économie », « Sources », chacune avec 3-6 lignes à icône |

**Ce qui ne doit plus apparaître sur la page pays :** une ligne `Titre` + `Valeur` sans icône, sans hiérarchie ni groupement ; une tuile vide sans badge ; un drawer blanc plat ; une carte grise sans tuiles ni contrôles.
