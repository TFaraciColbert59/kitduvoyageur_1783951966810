# Fiche carnet — spécification visuelle complète

> **Addendum du 24/10 12 h — disposition Compte :** la disposition de la page est désormais décrite dans `11-disposition-compte-carnet.md`. Les sections 1 à 3 du présent document (wireframes, cover pleine largeur, caption card, capsule sticky) sont **remplacées** par cet addendum. Les sections 4 à 16 restent la référence des composants, boutons, drawers, typographie, couleurs, mouvement et accessibilité.


**Date :** 24 octobre 2026
**Périmètre :** la fiche d'un carnet, route `/carnets/[id]`, mobile et desktop.
**Référence unique :** la page Compte (`/compte`), son drawer Profil, ses sous-drawers, sa bottom bar, la page Communauté (`/communaute`), ses posts, son fil, son drawer post, son drawer de création et ses boutons de top page.
**Nature du document :** description visuelle et interactionnelle. **Aucun code, aucune implémentation.**
**Règle :** quand une valeur existe déjà dans le Compte ou la Communauté, elle est reprise à l'identique. Aucune couleur, aucun rayon, aucune police, aucune ombre nouvelle.

---

## 0. Les cinq décisions qui verrouillent le style

1. **Une seule colonne de 520 px maximum**, centrée, sur mobile comme sur desktop. Aucune sidebar, aucun layout 3 colonnes, aucun plateau de navigation.
2. **Une seule famille de police** : SF Pro via `--font-sans` / `--font-display`, fallback Inter. **Pas de serif, pas de mono, pas de Manrope** sur cette page. Les chiffres sont en `tabular-nums`.
3. **Un seul sélecteur** : la capsule 48 px (`CapsuleTabs`, lentille `.sel-lens`, 420 ms) pour les sections et les slots de drawer ; la capsule secondaire 30 px (`lkdv-lens-float`) pour les filtres internes. Rien d'autre.
4. **Un seul bouton** : pilule 36 px (`primary`, `secondary`, `ghost`, `danger`), bouton rond 38 px, action de post 34 px, fermeture 34 px, ligne de menu 44 px. Tous partagent le même rayon 999, la même graisse 600, la même cible tactile 44 px.
5. **Un seul fond** : la toile du Compte/Communauté (`account-bg.webp`, cover, centre 30 %, brightness 1.1 saturate 1.05) avec le voile clair de la Communauté. Le fond global montagne (`lkv-app-background`) est masqué sur cette page.

Tout le reste en découle.

---

## 1. Wireframe mobile 430 × 932

```
┌──────────────────────────────────────────────┐
│  (‹)                              (➤)(🔖)(···) │  top bar 52, 38 px
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ (av) Camille Rochat  ✓ 94        (···)   │  │  auteur 32, meta 10
│  │ @camille · il y a 3 j                    │  │
│  │                                          │  │
│  │              COUVERTURE 1:1              │  │  radius 28
│  │                                          │  │
│  │                          (♥)(◻)(➤)       │  │  capsule 3×34
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ CARNET · Vercors · 12–14 oct. 2026       │  │  caption card
│  │ Trois jours dans                         │  │  H1 24/700
│  │ la Chartreuse                            │  │  même famille, 600
│  │ « Le silence qu'on a rapporté. »         │  │  sous-titre 14
│  │                                          │  │
│  │ 27,4 km      1 620 m      3 jours        │  │  stats 17/700
│  │ DISTANCE     DÉNIVELÉ     JOURS          │  │  labels 9,5
│  │ 12 j'aime · 3 commentaires               │  │  ligne sociale
│  └──────────────────────────────────────────┘  │
│                                                │
│  ╭ Récit  Parcours  Moments  Matériel  Nature ╮ │  capsule 48, sticky
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ RÉCIT                                    │  │  H2 17/700
│  │ Trois jours, deux nuits, un col…          │  │  corps 13,5
│  │                                          │  │
│  │ ①  Saint-Pierre → Charmant Som           │  │  timeline
│  │    10,4 km · 620 m · 4 h 20               │  │
│  │    « On n'a presque pas parlé… »          │  │  citation 13,5
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ PARCOURS                    Agrandir →   │  │
│  │ [ carte 16:9 ]                           │  │
│  │ 27,4 km · 1 620 m      Télécharger GPX   │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ MOMENTS (3)                  Voir tout →  │  │
│  │ [1:1] [1:1]                              │  │  grille 2 col
│  │ [1:1]                                    │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ MATÉRIEL · 4,2 kg         Reconfigurer →  │  │
│  │ Sac 45L            1,4 kg                 │  │  rows 44
│  │ Duvet 800            920 g                │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ NATURE                                   │  │
│  │ [ photo ]  Identifier une espèce          │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ COMMENTAIRES (3)             Voir tout →  │  │
│  │ (av) Alice · Les photos sont superbes…    │  │
│  │ (av) Sofia · Le genre de récit…            │  │
│  │ [ Ajouter un commentaire… ]        (➤)    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ╭ Explorer  Compas  Matériel  Hub  Compte ╮   │  bottom bar 48
└──────────────────────────────────────────────┘
```

---

## 2. Wireframe desktop 1440 × 900

```
┌──────────────────────────────────────────────────────────────┐
│                    (‹)              (➤)(🔖)(···)             │  top bar 520
│                                                              │
│          ┌────────────────────────────────────────┐          │
│          │ (av) Camille Rochat  ✓ 94      (···)   │          │
│          │ @camille · il y a 3 j                  │          │
│          │                                        │          │
│          │            COUVERTURE 1:1              │          │
│          │                                        │          │
│          │                        (♥)(◻)(➤)       │          │
│          └────────────────────────────────────────┘          │
│          ┌────────────────────────────────────────┐          │
│          │ CARNET · Vercors · 12–14 oct. 2026     │          │
│          │ Trois jours dans                       │          │
│          │ la Chartreuse                          │          │
│          │ « Le silence qu'on a rapporté. »       │          │
│          │ 27,4 km   1 620 m   3 jours            │          │
│          └────────────────────────────────────────┘          │
│          ╭ Récit Parcours Moments Matériel Nature ╮          │
│          ┌────────────────────────────────────────┐          │
│          │ sections empilées, 520 px              │          │
│          └────────────────────────────────────────┘          │
│          ┌────────────────────────────────────────┐          │
│          │ commentaires                            │          │
│          └────────────────────────────────────────┘          │
│                                                              │
│                    ╭ Explorer Compas Matériel Hub Compte ╮   │
└──────────────────────────────────────────────────────────────┘
```

**Aucune sidebar. Aucune grille 3 colonnes. Aucun breadcrumb. Aucun plateau.**
À 768 px, la colonne reste 520 px centrée : le bug du centre à 152 px disparaît.

---

## 3. Anatomie, zone par zone

### 3.1 Fond et colonne

| Élément | Valeur |
|---|---|
| Fond | `account-bg.webp`, `background-size: cover`, `background-position: center 30%`, `filter: brightness(1.1) saturate(1.05)` + voile `linear-gradient(180deg, rgba(255,250,236,.08), transparent 30%, rgba(245,242,236,.12) 60%)` |
| Fallback | `#cfd6c8` |
| Colonne | `width: 100%`, `max-width: 520px`, `margin-inline: auto`, `padding: 0 10px` |
| Contenu | `padding: 0 4px` (soit 14 px de bord visuel) |
| Scroll | scroll document normal. Interdit : `h-[100dvh] overflow-hidden`, scroll interne, `100vh` |
| Padding bas | `calc(48px + 10px + 20px + env(safe-area-inset-bottom))` = 78 px + safe |
| Fond global | `.lkv-app-background` masqué sur cette page, comme sur `/communaute` |

### 3.2 Top bar

| Propriété | Valeur |
|---|---|
| Position | `sticky`, top 0, z 40 |
| Hauteur | 52 px + `env(safe-area-inset-top)` |
| Padding | `calc(env(safe-area-inset-top) + 8px) 10px 6px` |
| Fond | transparent au repos, puis `linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0))` après 12 px de scroll |
| Gauche | bouton rond 38 px « Retour », icône chevron 18, `aria-label="Retour"` |
| Centre | vide au repos ; après 120 px de scroll, titre compact « Carnet » 15/700, opacité 0→1 |
| Droite | 3 boutons ronds 38 px, gap 6 : Partager, Enregistrer, Options `···` |
| Boutons | primitive `gbtn` : 38×38, fond blanc .5, blur 4 px saturate 1.9 brightness 1.07, inset 1 px blanc .9, ombre 0 2px 8px rgba(23,43,36,.08), icône 18 forest |
| Cible | 44×44 via `::after` |
| État pressé | `scale(.94)` |
| Focus | anneau 2 px `#17402C`, offset 2 |

Le bouton « Partager » est rond ; il n'ouvre pas le drawer de partage directement si le navigateur supporte `navigator.share` : il tente le partage natif, puis retombe sur le drawer. Le bouton « Enregistrer » est un favori (bookmark). Le `···` ouvre le menu 226 px.

Ce sont **les mêmes boutons ronds 38 px** que le `+`, la recherche et la cloche de la page Communauté (`.gbtn`) ; seules les icônes changent. Aucune variante de taille, de rayon ou de verre. Si le produit veut la triade exacte de la Communauté, les trois slots deviennent `+` (drawer Création), `search` (recherche globale) et `bell` (notifications) ; la présente spec recommande `partager`, `enregistrer`, `options` parce que la fiche est une page de contenu, pas un fil. Le dessin des boutons reste identique dans les deux cas.

### 3.3 Couverture

| Propriété | Valeur |
|---|---|
| Format | carré 1:1, `width: 100%`, `aspect-ratio: 1/1` |
| Rayon | 28 px |
| Marge | 0, puis 10 px avant la caption |
| Objet | `cover_image` réel ; `alt` = `cover_image_alt` ou le titre |
| Remplissage | `object-fit: cover`, `display: block` |
| Ombre | `inset 0 0 0 .5px rgba(255,255,255,.18)`, `0 10px 26px rgba(23,43,36,.16)` |
| Pastille auteur | en haut à gauche, 12 px |
| Bouton `···` | en haut à droite, 12 px, 34 px |
| Capsule d'actions | en bas à droite, 12 px, 3 × 34 px |
| Tap | ouvre le viewer média |
| Double-tap | like, avec burst cœur 450 ms |

**Si `cover_image` est absent :** ne jamais mettre une photo Unsplash. Afficher une **carte de remplacement 1:1** en verre, fond `linear-gradient(160deg, #17402C, #365233)`, motif topographique en trait blanc 6 %, initiales de la destination en 48/700 blanc, et un petit label « Sans couverture » 9,5/500 blanc .7. L'ensemble garde le rayon 28 et les actions.

### 3.4 Pastille auteur

| Propriété | Valeur |
|---|---|
| Forme | pilule, rayon 999 |
| Hauteur | 44 px (cible), visuel 44 |
| Padding | 4 px 10 px 4 px 4 px |
| Avatar | 32×32, rayon 50 %, `object-fit: cover`, anneau blanc 1,5 px |
| Fallback avatar | cercle 32, fond `#ddebd8`, initiale 12/700 forest |
| Nom | 12,5/700, forest, max 120 px, ellipsis |
| Badge | si `trust_score` non null : shield 10 + score 10/700, fond forest .1, radius 999, padding 2 px 6 px — **le score de confiance réel**, pas un badge « Vérifié » |
| Vérification du carnet | badge séparé dans la caption (voir 3.7), uniquement si `carnets.verified=true` |
| Méta | 10/500, muted, max 210 px, 2 lignes max : `@handle · il y a 3 j` |
| Fond | `--bar-glass-bg`, blur `--bar-glass-blur`, ombre `--bar-thumb-shadow` |
| Lien | ouvre le **drawer Profil** du Compte, pas une page profil |
| `aria-label` | « Profil de {nom} — {méta} » |

**Aucun nom inventé.** Si `author_id` est null : afficher « Auteur non renseigné », initiale `?`, pas de lien, pas d'avatar photo.

### 3.5 Capsule d'actions du post

| Propriété | Valeur |
|---|---|
| Position | absolute, right 12, bottom 12 |
| Forme | capsule, padding 3, gap 4, radius 999 |
| Fond | `--bar-glass-bg` + `--bar-glass-blur` + `--bar-glass-shadow` |
| Boutons | 34×34, rayon 50 %, icône 18, fond transparent |
| Like | cœur outline ; actif : plein `#E0245E` |
| Commentaire | bulle outline |
| Partage | flèche sortante |
| Cible | 44×44 via `::after` |
| Pressé | `scale(.86)` |
| Compteurs | **aucun compteur dans la capsule**, comme la Communauté |
| `aria-label` | « J'aime », « Commenter », « Partager » |
| `aria-pressed` | sur le like |

### 3.6 Menu `···`

| Propriété | Valeur |
|---|---|
| Déclencheur | 34×34, en haut à droite de la couverture, verre |
| Panneau | 226 px de large, top 52, right 12, radius 20, fond blanc .72, blur 30 px saturate 180 %, bordure .5 blanc .85, ombre `0 12px 32px rgba(23,43,36,.18)` |
| Padding | 5 px |
| Lignes | 44 px min, radius 14, padding 0 10, icône 18, gap 10, texte 13/500 |
| Séparateur | hairline .5 rgba(23,43,36,.08) avant « Supprimer » |
| Visiteur | Enregistrer / Partager / Copier le lien / Signaler |
| Propriétaire | Enregistrer / Modifier le carnet / Visibilité / Exporter en PDF / Partager / Supprimer |
| Danger | `#A33227`, fond `rgba(180,60,48,.10)` au tap |
| Fermeture | clic extérieur, Échap, scroll |
| Focus | premier item à l'ouverture |
| Rôle | `role="menu"`, `menuitem` |

### 3.7 Carte de titre (caption card)

| Propriété | Valeur |
|---|---|
| Position | 10 px sous la couverture |
| Forme | radius 28, padding 14 px 16 px |
| Fond | `--post-glass-bg` (`rgba(255,255,255,.486)` → `.384`), blur 25.2 px saturate 1.8 brightness 1.05 |
| Ombre | `--post-glass-shadow` |
| Eyebrow | une ligne : `CARNET` 9,5/700 uppercase tracking .08em forest 600, `·`, destination 10,5/600, `·`, dates 10,5/500 muted ; ellipsis |
| Titre H1 | 24/27, 700, letter-spacing -0.02em, forest 800, max 2 lignes |
| Deuxième ligne | **même police**, 24/27, 600, forest 700 ; pas de serif, pas d'italique |
| Sous-titre | 14/1.45, 400, forest 800, max 5 lignes, puis « Lire la suite » 11/600 forest 700 |
| Badge vérifié | uniquement si `verified=true` : shield 12 + « Vérifié » 9,5/700, fond sage .12, radius 999 |
| Badge privé | propriétaire uniquement : lock 12 + « Privé » 9,5/700 |
| Ligne sociale | 10,5/500 muted : `12 j'aime · 3 commentaires` ; vues seulement pour le propriétaire |
| Stats | 3 cellules max, séparées par hairline .5 ; valeur 17/700 `tabular-nums`, label 9,5/600 uppercase muted |
| Stats absentes | la cellule est supprimée ; si aucune, la rangée disparaît |
| Interdits | « Récit Vérifié », « Expédition Certifiée », « Membre Explorateur », « Trace 3D », « Guide Certifié », emojis |

**Données de la caption :** `title`, `destination`, `start_date`/`end_date`, `description`, `distance_km`, `denivele_m`, `nb_nuits`/`days`, `verified`, `visibility`, `likes_count`, `comments_count`, `views_count`. Aucun champ n'est inventé.

### 3.8 Sélecteur de sections

| Propriété | Valeur |
|---|---|
| Primitive | `CapsuleTabs` 48 px, `.lkdv-capsule` + `.sel-lens` |
| Position | 12 px sous la caption ; `sticky`, top 60 px, z 30 |
| Largeur | 100 % de la colonne (520 max) |
| Hauteur | 48 px, padding 2 |
| Fond | blanc .65, blur 28 px saturate 180 %, bordure .5 blanc .8, inset 1 px blanc .95, ombre 0 4px 14px rgba(23,43,36,.08) |
| Lentille | top/bottom 4, left 3, largeur `(100% - 6px)/5`, gradient blanc .62→.26, inset, ombre, `translateX(--i)`, 420 ms cubic-bezier(.32,.72,0,1) |
| Cellules | 5, icône 18 + label 9,5/600, gap 2, actif forest 800, inactif forest 600 |
| Sections | Récit (`book-open`), Parcours (`route`), Moments (`camera`), Matériel (`backpack`), Nature (`leaf`) |
| Comportement | clic = scroll vers la section + hash `#recit` etc. ; `IntersectionObserver` met à jour la lentille |
| Accessibilité | `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, roving tabindex, flèches/Home/End |
| Interdits | `NavigationPlateau`, onglets verticaux, `Chip`, `IOSSegmentedControl`, `ScrollableTabs` |

### 3.9 Sections de contenu

Chaque section est une **carte de page** :

| Propriété | Valeur |
|---|---|
| Forme | radius 28, padding 14/16 |
| Fond | blanc .62, blur 25 px saturate 1.8, ombre post |
| En-tête | H2 17/700 + compteur 10,5/600 en pilule + action texte 11/600 à droite |
| Espacement | 10 px entre les cartes, 18 px entre les blocs |
| Ancres | `id="recit"`, `id="parcours"`, `id="moments"`, `id="materiel"`, `id="nature"` |
| Bord | hairline .5 blanc .65 |

#### Récit

- Paragraphe 13,5/1.5 forest 800, max 70 caractères par ligne.
- Timeline verticale : badge jour 32 px cercle glass, trait vertical 1 px forest .12, titre 14/700, méta 10,5/500 muted (`10,4 km · 620 m · 4 h 20`), citation 13,5/1.45 forest 700 entre guillemets.
- Chaque étape est séparée par 14 px.
- Pas de carte par étape : une seule carte conteneur, des lignes.
- Si aucune étape : état vide « Aucune étape renseignée. » + CTA propriétaire « Ajouter une étape » 36 secondary.

#### Parcours

- Carte carte : ratio 16:9, radius 18, overflow hidden, fond `#dfe8dc`.
- En-tête de carte : « Trace GPS » 11/700 + « Agrandir » 11/600.
- Carte Leaflet, tuiles OSM, ligne forest 4,5 px, départ/arrivée 7 px, attribution visible.
- Si pas de trace : fond glass, icône route 24, « Aucune trace GPS » 13/700, « Cette sortie n'a pas de tracé. » 11/500 ; propriétaire : « Ajouter une trace » 36 secondary.
- Pied de carte : stats 10,5/600 à gauche, « Télécharger le GPX » 36 primary à droite. Sans trace, le bouton est **désactivé** (opacity .45) et ne télécharge jamais un fichier vide.
- « Agrandir » ouvre le **drawer Carte** (92dvh).

#### Moments

- Grille 2 colonnes, gap 6, tuiles 1:1, radius 18, image `object-fit: cover`.
- Overlay bas : lieu + date 9,5/600 blanc, dégradé noir .55.
- Tap : viewer média plein écran.
- En-tête : « Moments (3) » + « Voir tout ».
- Si aucun : état vide « Aucun moment pour l'instant. » + propriétaire « Ajouter un moment ».
- Aucune photo générique, aucun like aléatoire.

#### Matériel

- En-tête : « Matériel » + poids réel 17/700 (`4,2 kg`) + « Reconfigurer » 36 secondary.
- Lignes 44 px : pastille couleur 10 px, nom 12,5/600, détail 10,5/500 muted, poids 10,5/600 `tabular-nums`.
- Checkbox 22×22, rayon 6, forest ; cocher = barré + opacité .6.
- Le poids total vient de la somme réelle ; 0 article = pas de poids, pas de carte.
- Lien `/compas?etape=kit` pour « Reconfigurer ».

#### Nature

- Carte avec zone photo 1:1 ou 4:3, fond glass, bordure dashed 1 px forest .2, icône appareil 24.
- Bouton « Prendre une photo » 36 primary.
- Résultat : nom commun 15/700, nom latin 10,5/500 muted, badge confiance 9,5/700, description 12,5/1.4, bandeau protégé si `is_protected`.
- Auth requise : si anonyme, le bouton devient « Se connecter pour identifier » et ouvre `/connexion?next=...`.
- Le résultat est persisté sur le moment ; sinon état vide.

#### Commentaires (aperçu)

- Carte 28, padding 14.
- En-tête : « Commentaires » 17/700 + compteur 10,5/600 + « Voir tout » 11/600.
- 2 derniers commentaires : avatar 30, nom 12/600, temps 10/500 muted, texte 12,5/1.4, actions ♥ count / Répondre.
- Composer : input 36, radius 999, blanc .76, placeholder « Ajouter un commentaire… » ; bouton envoyer 34 rond forest, icône avion 16.
- Anonyme : ligne « Se connecter pour commenter » 11/600, pas de faux succès.
- Aucun commentaire : « Aucun commentaire. Sois le premier à réagir. » 12/500 muted.
- « Voir tout » ouvre le **drawer Commentaires**.

### 3.10 Bottom bar

| Propriété | Valeur |
|---|---|
| Primitive | `AccountBottomBar` / `.tb` |
| Position | fixed, bottom 10 px, z 45 |
| Largeur | `min(calc(100% - 20px), 500px)`, centrée |
| Hauteur | 48 px, padding 2 |
| Forme | radius 999 |
| Fond | `--bar-glass-bg` + `--bar-glass-blur` (blur 7.2 saturate 1.9 brightness 1.07) + `--bar-glass-shadow` |
| Cellules | 5 : Explorer, Compas, Matériel, Hub, Compte |
| Icônes | 19 px |
| Labels | 10/600 |
| Lentille | 40 px, top/bottom 4, left 3, largeur `(100%-6)/5`, 420 ms |
| Onglet actif | **aucun** sur la fiche carnet, comme sur `/communaute` ; la lentille est masquée |
| Cible | 44×44 par cellule |
| Safe area | `bottom: calc(10px + env(safe-area-inset-bottom))` si nécessaire |
| Interdits | ajouter « Communauté » à la barre, ajouter un 6e onglet, ajouter un plateau au-dessus |

---

## 4. Système de composants

### 4.1 Boutons — une seule famille

| Nom | Taille | Forme | Fond | Texte | Usage |
|---|---|---|---|---|---|
| `Pill primary` | h 36, padding 0 14 | 999 | `#17402C` | blanc 12,5/600 | Publier, Envoyer, Télécharger le GPX |
| `Pill secondary` | h 36 | 999 | gradient blanc .72→.52 | forest | Voir tout, Agrandir, Reconfigurer |
| `Pill ghost` | h 36 | 999 | transparent | forest | Annuler, Répondre |
| `Pill danger` | h 36 | 999 | `rgba(180,60,48,.10)` | `#A33227` | Supprimer |
| `Round` | 38×38 | 50 % | blanc .5, blur 4 | forest, icône 18 | top bar, partage, favori |
| `Post action` | 34×34 | 50 % | transparent | forest / `#E0245E` | like, commentaire, partage |
| `Close` | 34×34 | 50 % | forest .06 | forest, icône 18 | fermeture de sheet |
| `Menu row` | h 44, full width | 14 | transparent | forest 13/500 | options |
| `Text action` | h 44 (cible), texte 11/600 | — | — | forest | Voir tout, Lire la suite, Répondre |
| `Capsule` | 48 | 999 | blanc .65 | icônes 18 / labels 9,5 | sélecteur principal |
| `Lens` | 30 | 999 | gradient blanc | icônes 15 | filtres secondaires |

**Règles :**
- Tous les boutons visuels ont une cible tactile **44×44 minimum**, via `::after` si le visuel est plus petit.
- Tous les boutons ont `:active { transform: scale(.97) }` ; les ronds `.94` ; les actions de post `.86`.
- Aucun bouton texte de 40/42/44 px rectangulaire, aucun gradient orange, aucune bordure 1 px grise.
- `LkvButton` peut rester dans le code, mais il doit être **restylé** avec ces tokens ; il ne doit pas introduire une deuxième hauteur ou un deuxième rayon.
- Les icônes sont **Lucide**, stroke 1,8–2,0, 18 px (15 px pour les lenses, 24 px pour les états vides). Aucun emoji.

### 4.2 Cartes

| Type | Rayon | Fond | Ombre | Usage |
|---|---|---|---|---|
| Carte de page | 28 | blanc .62 + blur 25,2 | `--post-glass-shadow` | caption, sections, commentaires |
| Carte imbriquée | 18 | blanc .55 + blur 18 | inset 1 px blanc .95, rim .5 | lignes, étapes, kit |
| Média | 28 (cover), 18 (tuiles) | — | — | images |
| Sheet | 26 en haut | `rgba(255,255,255,.94)` | `0 -18px 50px rgba(10,20,14,.22)` | drawers |
| Popover | 20 | blanc .72 + blur 30 | `0 12px 32px rgba(23,43,36,.18)` | menu `···` |

Pas d'autre rayon (pas de 12/16/24 arbitraire). Le 13 est réservé aux icônes de tuile.

### 4.3 Pastilles et badges

- Badge : h 22, padding 0 8, radius 999, fond forest .08–.12, texte 10/700.
- Tons : neutre (forest), sage (`verified`), warning (privé?), danger (suppression).
- Aucun badge décoratif. Un badge = une information réelle.

### 4.4 Champs

| Propriété | Valeur |
|---|---|
| Hauteur | 44 px (cible), visuel 36–38 |
| Forme | radius 12 (form) ou 999 (search/composer) |
| Fond | blanc .76 |
| Bordure | .5 rgba(23,43,36,.14) |
| Texte | 13/400 forest |
| Placeholder | 12/400 `#6A7A71` |
| Focus | bordure forest .48 + ring 3 px sage .14 |
| Erreur | texte 11/500 `#A33227` sous le champ |
| Interdit | placeholder comme seul label, champ < 16 px sur iOS (zoom) |

### 4.5 Drawers — une seule coquille, trois hauteurs

| Format | Hauteur | Usage |
|---|---|---|
| `HalfSheet` | 50 dvh | création (6 tuiles) |
| `Sheet` | 76 dvh | partage, gérer, formulaire, signaler |
| `FullSheet` | 92 dvh / 820 px max | commentaires, profil, carte, média |
| `Popover` | auto | menu `···` |

**Coquille commune :**
- Largeur `min(100%, 520px)`, centrée.
- Fond `linear-gradient(180deg, rgba(255,255,255,.94), rgba(242,247,238,.94) 45%, rgba(255,255,255,.96))`.
- Bordure .5 rgba(23,43,36,.12), ombre `0 -1px 0 rgba(255,255,255,.9), 0 -18px 50px rgba(10,20,14,.22)`.
- Rayon 26 px en haut, 0 en bas (mobile) ; 26 px partout + bottom 18 (desktop ≥ 720).
- Scrim `rgba(10,20,14,.32)` + blur 6.
- Poignée 40×4, rgba(23,43,36,.22), padding 6/2.
- En-tête 52 px, padding 8/12/6/16, titre 15/700, sous-titre 11/500 muted, close 34.
- Corps scrollable, padding 12/14/18, `overscroll-behavior: contain`.
- Pied sticky, padding 10/14 + safe, bordure top .5, fond blanc .88 + blur 12.
- Entrée 260 ms `cubic-bezier(.16,1,.3,1)` translateY 24/opacity .65 → 1.
- Fermeture : scrim, Échap, swipe bas (si poignée), bouton close.
- Focus trap, focus restauration, body scroll lock, `role=dialog`, `aria-modal`, `aria-labelledby`.

---

## 5. Drawers, un par un

### 5.1 Drawer Commentaires

**Déclencheur :** capsule d'action commentaire, compteur de commentaires, « Voir tout » de l'aperçu.

| Élément | Spécification |
|---|---|
| Format | `FullSheet` 92 dvh, 520 max |
| En-tête | « Commentaires » 15/700 + compteur 10,5/600 en pilule ; close 34 |
| Corps | liste de commentaires, padding 12/14 ; scroll |
| Ligne | avatar 30, nom 12/600, temps 10/500 muted, texte 12,5/1.4 forest 800 ; actions 10/600 (♥ count, Répondre, Modifier/Supprimer/Signaler) |
| Réponses | indentées 30 px, trait vertical 1 px forest .12, avatar 26 |
| Like commentaire | cœur 16, actif `#E0245E` |
| Composer | sticky footer, input 36 radius 999, placeholder « Ajouter un commentaire… », send 34 rond forest |
| Mention | `@` ouvre un picker 44 px par résultat, au-dessus du composer |
| Vide | « Sois le premier à répondre. » 12/500 muted, centré 24 px |
| Chargement | 3 squelettes de ligne |
| Erreur | « Impossible de charger les commentaires. » + « Réessayer » 11/600 |
| Auth | si anonyme, composer remplacé par « Se connecter pour commenter » 11/600 |
| Accessibilité | `role=dialog`, `aria-modal`, focus premier bouton, Échap, retour focus |

**Aucun commentaire inventé, aucun like local, aucun compteur faux.** Les likes de commentaire sont réels ou absents.

### 5.2 Drawer Partage

**Déclencheur :** bouton partage de la capsule, menu « Partager », bouton top bar.

| Élément | Spécification |
|---|---|
| Format | `Sheet` 76 dvh |
| En-tête | « Partager » 15/700 + close |
| Recherche | 44 px, radius 999, icône search 15, placeholder « Rechercher une personne ou un groupe… » |
| Actions | 3 boutons ronds 38 : Envoyer (`send`), Copier (`link`), Partager (`share`) ; label 9,5/600 sous l'icône |
| Destinataires | lignes 48, avatar 34, nom 12/600, type 10/500 muted, bouton « Envoyer » 32 secondary |
| Vide | « Aucun destinataire trouvé. » |
| Anonyme | « Se connecter pour envoyer » 11/600 |
| Copie | toast « Lien copié. » ; échec « Copie impossible. » |
| Natif | `navigator.share` si disponible, sinon copie |
| Footer | aucun ; le contenu scrolle |

**Le lien partagé** est `window.location.origin + /carnets/<id>` (pas d'URL de production en dur).

### 5.3 Menu `···`

Voir 3.6. Ce n'est **pas** un drawer : c'est un popover 226 px ancré au bouton.

### 5.4 Drawer Gérer le carnet (propriétaire)

**Déclencheur :** `···` > « Modifier le carnet » ou « Gérer ».

| Élément | Spécification |
|---|---|
| Format | `Sheet` 76 dvh |
| En-tête | « Gérer le carnet » 15/700 + close |
| Lignes | 48 px, icône 18, titre 13/600, sous-titre 10,5/500 muted, chevron 14 |
| Actions | Modifier le carnet (`pencil`), Visibilité (`eye`), Exporter en PDF (`download`), Partager (`send`), Supprimer (`trash`, danger) |
| Visibilité | ligne avec `DrawerToggle` 42×25, label « Carnet privé » |
| Export | PDF public ; JSON complet réservé au propriétaire |
| Suppression | carte inline danger 18, titre « Supprimer ce carnet ? » 13/700, texte 11,5, « Supprimer » 36 danger, « Annuler » 36 ghost ; pas de `window.confirm` |
| Feedback | toast 11,5/600, fond forest .94, blanc, radius 999, bottom 22 |

### 5.5 Drawer Création

**Déclencheur :** `+` de la top bar (si présent) ou action « Créer » du propriétaire.

| Élément | Spécification |
|---|---|
| Format | `HalfSheet` 50 dvh, poignée, **pas de titre**, **pas de croix** |
| Grille | 2 colonnes, gap 8, padding 4/0/8 |
| Tuiles | 6 : Publication, Carnet, Sortie GPS, Kit, Club, Story |
| Tuile | min-height 108/118, padding 12/14, radius 18, fond blanc .58, inset 1 px blanc .95, rim .5, texte forest |
| Icône | 42/46 px, radius 13, fond blanc .75, inset 1 px |
| Titre | 13/14, 700 |
| Sous-titre | 10,5/11, 500 muted |
| Story | pleine largeur, gradient `#17402C → #2F5A3F`, texte blanc, icône blanc .15 |
| Hint | « Tout reste dans ton univers LKDV. » 10,5/500 muted, centré |
| Fermeture | backdrop, Échap, swipe bas |
| Form | clic « Carnet » ferme la grille et ouvre `Sheet` 76 dvh : couverture 16:9, titre, destination, dates, description, visibilité (toggle), étapes ; footer sticky « Publier » 36 primary + « Annuler » 36 ghost |

### 5.6 Drawer Profil de l'auteur

**Déclencheur :** pastille auteur.

C'est **exactement** le drawer Profil du Compte, pas une nouvelle page.

| Élément | Spécification |
|---|---|
| Format | `FullSheet` 92 dvh, 520 max, **pas d'en-tête**, poignée |
| Sélecteur | capsule 48, 5 slots : Vitrine, Kit, Prêts, Souvenirs, Communauté |
| Slots | icônes 18, pas de labels (comme le Compte), `aria-label` |
| Lentille secondaire | 30 px, bottom-right 10, largeur `n*44+5`, icônes 15, actif forest |
| Contenu | pager horizontal, glissement 420 ms, cartes 18, lignes 48 |
| Vitrine | Stats, Republication, Trophées |
| Kit | Kits, Inventaire |
| Prêts | Je prête, J'emprunte, Confiance |
| Souvenirs | Timeline, Passeport, Souvenirs |
| Communauté | Défis, Clubs |
| Fermeture | scrim, Échap, swipe bas ; pas de croix |
| Accessibilité | `role=tablist` sur les deux capsules, `aria-selected`, roving tabindex, focus restauration |

**Aucune donnée inventée.** Les slots vides affichent les états vides du Compte.

### 5.7 Viewer média

**Déclencheur :** tap sur la couverture ou un moment.

| Élément | Spécification |
|---|---|
| Format | plein écran, `position: fixed`, inset 0, z 1500 |
| Fond | `rgba(6,12,8,.94)` |
| Image | `object-fit: contain`, max 100vw/100dvh |
| Close | 38 rond, top `calc(14px + safe)` right 14, blanc .16, icône X 20 |
| Compteur | 1/N, pilule 9,5/600 blanc, top-left |
| Légende | carte glass 18, bottom 14, texte 12,5/1.4 blanc |
| Navigation | swipe horizontal, flèches 38 si desktop |
| Fermeture | tap, X, Échap |
| Accessibilité | `role=dialog`, `aria-label`, focus close |

### 5.8 Drawer Carte

**Déclencheur :** « Agrandir » de la carte.

| Élément | Spécification |
|---|---|
| Format | `FullSheet` 92 dvh |
| En-tête | « Carte & trace » 15/700 + close |
| Corps | carte 100 %, pas de padding, radius 18 |
| HUD | pilule glass top-left « Trace GPS » 10/700 ; stats bottom-left 10,5/600 ; zoom 38 top-right |
| Pied | sticky 48 : stats + « Télécharger le GPX » 36 primary |
| Sans trace | état vide, CTA propriétaire « Ajouter une trace » 36 secondary |
| GPX | désactivé si aucune trace ; jamais de fichier vide |

### 5.9 Drawer Signaler

**Déclencheur :** menu `···` > Signaler, ou commentaire > Signaler.

| Élément | Spécification |
|---|---|
| Format | `Sheet` 76 dvh |
| En-tête | « Signaler » 15/700 + close |
| Corps | raisons : Contenu inapproprié, Harcèlement, Spam, Désinformation, Autre |
| Ligne | 48, radio 20, texte 13/500 |
| Détail | textarea 92, placeholder « Précisez si nécessaire… » |
| Footer | « Envoyer le signalement » 36 primary ; « Annuler » ghost |
| Feedback | toast « Signalement envoyé. Merci. » |

---

## 6. Fonctions et états

### 6.1 Actions

| Action | Anonyme | Connecté | Persistance |
|---|---|---|---|
| Like | redirige vers `/connexion?next=...` après toast | upsert `carnet_likes`, cœur plein `#E0245E`, compteur | oui, idempotent |
| Commentaire | ouvre le drawer en mode lecture + CTA connexion | insert `carnet_comments`, optimistic + rollback | oui |
| Réponse | idem | insert avec `parent_id` si disponible, sinon réponse plate | oui |
| Like commentaire | CTA connexion | brancher la table de likes de commentaire dédiée **si elle existe** ; sinon masquer le cœur (ne pas simuler un like local) | oui si table |
| Enregistrer | CTA connexion | insert/delete `carnet_favorites` | oui |
| Partager | partage natif ou copie, sans auth | idem | — |
| GPX | désactivé sans trace | téléchargement réel | — |
| Voir | insert `carnet_views` une fois/session | idem | oui |
| Signaler | CTA connexion | insert `report` | oui |
| Gérer | interdit | drawer propriétaire | oui |

**Règle absolue :** aucun toast de succès avant la confirmation serveur. Optimistic UI avec rollback.

### 6.2 États de page

| État | Rendu |
|---|---|
| Chargement | squelette : top bar, cover 1:1, caption, capsule, 3 cartes ; `aria-busy` |
| Public anonyme | page complète, actions = CTA connexion |
| Connecté | actions actives |
| Propriétaire | menu Gérer, compteur de vues, actions d'édition |
| Privé / propriétaire | badge Privé, page visible |
| Privé / autre | **404 réel**, pas de fuite d'existence |
| Introuvable | page 404, sans capsule, avec bottom bar |
| Erreur | carte d'erreur 28, « Impossible de charger le carnet. » + « Réessayer » 36 primary |
| Vide | section supprimée ou état vide 1 ligne, jamais de faux contenu |
| Sans couverture | carte de remplacement 1:1 (voir 3.3) |
| Sans auteur | « Auteur non renseigné », pas de lien |
| Sans trace | carte vide, GPX désactivé |
| Hors ligne | bandeau 32 px top, « Hors ligne — contenu en cache », actions désactivées |

### 6.3 Données affichées — aucune valeur inventée

| Élément visuel | Source unique | Si absent |
|---|---|---|
| Couverture | `carnets.cover_image` + `cover_image_alt` | placeholder 1:1 maison (3.3) |
| Auteur | `public_profiles` (`full_name`, `avatar_url`, `handle`, `trust_score`) | « Auteur non renseigné » |
| Titre | `carnets.title` | « Carnet sans titre » |
| Description | `carnets.description` | masquer le paragraphe |
| Destination | `carnets.destination` | masquer |
| Période | `carnets.start_date` / `end_date` | date de création, sinon masquer |
| Distance | `hike_sessions.distance_km` sinon `carnets.distance_km` | masquer la cellule |
| Dénivelé | `hike_sessions.elevation_gain_m` sinon `carnets.denivele_m` | masquer la cellule |
| Jours | dates si disponibles, sinon `carnets.nb_nuits + 1` | masquer la cellule |
| Vérifié | `carnets.verified = true` | aucun badge |
| Privé | `carnets.visibility` + owner | visiteur = 404 |
| Likes | `count(carnet_likes)` | 0 → pas de compteur |
| Commentaires | `count(carnet_comments)` | 0 → état vide |
| Vues | `count(carnet_views)` | visibles owner seulement |
| Favori | `carnet_favorites` | bookmark outline |
| Étapes | `groupe_etapes` **si la table existe** ; sinon `carnet_moments` groupés par `jour_numero` | état vide, pas de moyenne inventée |
| Hébergements | `groupe_hebergements` **si la table existe** | masquer la section |
| Moments | `carnet_moments` + `carnet_media` | état vide |
| Image d'un moment | `carnet_moments.image_url` / `carnet_media.url` | état vide, pas de photo générique |
| Kit | `carnet_kit_items` | masquer la carte |
| Poids du kit | somme de `poids_g` | masquer le poids |
| Espèces | `carnet_moments.identified_species` | état vide |
| Commentaires | `carnet_comments` + `public_profiles` | état vide |

**Interdits :** toute moyenne calculée à partir d'un total, tout nom/avatar par défaut, toute photo tierce de remplacement, tout compteur codé en dur, tout badge « certifié » sans `verified`.

---

## 7. Responsive et scroll

### 7.1 Breakpoints

| Largeur | Comportement |
|---|---|
| 320–767 | colonne 100 %, max 520, padding 10 ; cover 1:1 ; capsule pleine largeur |
| 768–1199 | colonne 520 centrée, marges auto ; **aucune sidebar** ; top/bottom bars 520/500 |
| 1200–1599 | colonne 520 centrée ; fond visible à gauche/droite |
| ≥ 1600 | colonne 520 centrée ; mêmes marges, pas d'élargissement |

**Interdit :** passer en 3 colonnes à `md` (768). C'est la cause du centre à 152 px.

### 7.2 Scroll

- Scroll document normal, pas de conteneur `overflow-y-auto` plein écran.
- Top bar sticky 52 + safe.
- Capsule sticky à 60 + safe ; la caption et les cartes passent dessous.
- `scroll-margin-top: 120px` sur chaque section.
- Bottom bar fixe ; le padding bas de page réserve 78 px + safe.
- Le drawer verrouille le scroll du body et restaure la position.

### 7.3 Desktop

- Même colonne 520.
- Sheets 520, bottom 18, radius 26 partout.
- Popover 226.
- Bottom bar 500.
- Aucune sidebar, aucun header global.

### 7.4 Empilement et safe areas

| Couche | z-index | Remarque |
|---|---:|---|
| Contenu de page | 0 | cartes, sections |
| Capsule de sections | 30 | sticky sous le header |
| Top bar | 40 | sticky, au-dessus du contenu |
| Bottom bar | 45 | fixe, au-dessus du contenu |
| Menu `···` | 60 | popover ancré, au-dessus de la cover |
| Scrim de drawer | 90 | couvre la page, sous la sheet |
| Sheet | 100 | 50/76/92 dvh |
| Drawer imbriqué (profil > slot) | 110 | au-dessus de la sheet |
| Toast | 1400 | au-dessus des sheets |
| Viewer média | 1500 | plein écran |

**Safe areas :**
- Top bar : `padding-top: calc(env(safe-area-inset-top) + 8px)`.
- Bottom bar : `bottom: calc(10px + env(safe-area-inset-bottom))`.
- Sheet : pied `padding-bottom: calc(10px + env(safe-area-inset-bottom))`.
- Composer de commentaires : même règle.
- Aucune page ne calcule `100vh` ; utiliser `100dvh` uniquement pour le viewer média et les sheets.

---

## 8. Typographie — une seule famille

### 8.1 Famille

```
- apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
  var(--font-inter, "Inter"), "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

- **Une seule famille** pour tout le texte.
- `--font-display` est la même famille, avec le même fallback.
- **Aucun** `Instrument Serif`, **aucun** `IBM Plex Mono`, **aucun** `Manrope` sur cette page.
- Les chiffres utilisent `font-variant-numeric: tabular-nums`.
- Aucune italic. L'emphase se fait par la graisse (600/700) et la taille.

### 8.2 Échelle

| Rôle | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| Display | 28/32 | 700 | titre de couverture si pas de cover |
| H1 | 24/27 | 700 | titre du carnet |
| H2 | 17/20 | 700 | titres de sections |
| H3 | 14/18 | 700 | titres de cartes |
| Body | 13,5/19 | 400 | description, commentaires |
| Body small | 12,5/17 | 400 | texte secondaire |
| Meta | 10,5/13 | 500 | dates, lieux, compteurs |
| Label | 9,5/12 | 600 | labels uppercase, tracking .08em |
| Stats | 17/20 | 700 | chiffres tabulaires |
| Button | 12,5/1 | 600 | pilules |
| Capsule label | 9,5/1 | 600 | sections |

- Letter-spacing : -0,02em sur H1/Display, 0 sur le corps, .08em sur les labels uppercase.
- Aucun texte < 9,5 px.
- Largeur de ligne max 70 caractères.

---

## 9. Couleurs et matériaux

### 9.1 Palette

| Rôle | Valeur |
|---|---|
| Encre | `#172B24` |
| Primaire | `#17402C` |
| Secondaire | `#56665D` |
| Sage | `#5B7F55` |
| Papier | `#FBFAF6` |
| Pierre | `#F5F2EC` |
| Like | `#E0245E` |
| Danger | `#A33227` / `#A8443A` |
| Warning | `#C89A3B` |
| Info | `#4B6B7C` |

### 9.2 Verre

| Token | Valeur |
|---|---|
| `--bar-glass-bg` | `linear-gradient(180deg, rgba(255,255,255,.485), rgba(255,255,255,.325) 55%, rgba(255,255,255,.405))` |
| `--bar-glass-blur` | `blur(7.2px) saturate(1.9) brightness(1.07)` |
| `--bar-glass-shadow` | inset 1 px blanc .9, inset -1 px blanc .45, inset ±1 px blanc .28, inset 0 0 12 px blanc .14, rim .5 rgba(23,43,36,.14), 0 8px 22px rgba(23,43,36,.12) |
| `--post-glass-bg` | `linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.384))` |
| `--post-glass-blur` | `blur(25.2px) saturate(1.8) brightness(1.05)` |
| `--post-glass-shadow` | inset 1 px blanc .95, inset -1 px blanc .4, rim .5 rgba(23,43,36,.08), 0 8px 22px rgba(23,43,36,.1) |
| `--thumb-shadow` | inset 1 px blanc .95, rim .5 rgba(23,43,36,.08), 0 2px 8px rgba(23,43,36,.08) |

**Aucune couleur littérale nouvelle.** Si un ton manque, il devient un token, pas un hex dans un composant.

### 9.3 Ombres

- Carte : `0 8px 22px rgba(23,43,36,.10)`.
- Sheet : `0 -18px 50px rgba(10,20,14,.22)`.
- Popover : `0 12px 32px rgba(23,43,36,.18)`.
- Bouton primaire : `0 4px 14px rgba(23,64,44,.24)`.
- Aucune ombre sur chaque badge.

---

## 10. Mouvement

| Interaction | Durée | Courbe |
|---|---|---|
| Lentille de capsule | 420 ms | `cubic-bezier(.32,.72,0,1)` |
| Sheet entrée | 260 ms | `cubic-bezier(.16,1,.3,1)` |
| Half drawer | 320 ms | `cubic-bezier(.32,.72,0,1)` |
| Panneau post | 340 ms | `cubic-bezier(.22,1,.36,1)` |
| Press bouton | 150 ms | `ease` |
| Like | 150 ms | `ease` |
| Double-tap burst | 450 ms | `ease-out` |
| Scroll ancrage | 300 ms | `cubic-bezier(.32,.72,0,1)` |

- `prefers-reduced-motion: reduce` : transitions 0, animations 0, pas de burst.
- Aucune animation de layout (width/height) sauf le panneau de post (référence Communauté) et le « Lire la suite » (200 ms).
- Aucune animation permanente.

---

## 11. Accessibilité

- Cible tactile **44×44** partout, même si le visuel est 34/38.
- Contraste **4,5:1** texte, **3:1** icônes.
- Focus visible : anneau 2 px `#17402C` / `--lkv-focus-ring`, offset 2.
- H1 unique ; H2 par section ; H3 par carte ; pas de H4 avant H1.
- Capsule : `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, roving tabindex, flèches/Home/End.
- Drawers : `role=dialog`, `aria-modal`, focus trap, Échap, restauration du focus, `inert` sur le fond.
- Bottom bar : `aria-current="page"` sur l'onglet actif ; aucun actif sur carnet.
- Images : `alt` éditorial ; tuiles décoratives `alt=""` ; icônes `aria-hidden`.
- Aucun emoji utilisé comme icône ou label.
- `prefers-reduced-motion`.
- Zoom 200 % : colonne fluide, pas de débordement, pas de texte coupé.
- Lecteur d'écran : tester 430 et 1440 ; ordre de lecture top bar → cover → caption → capsule → sections → commentaires → bottom bar.

---

## 12. Micro-copies

| Contexte | Texte |
|---|---|
| Retour | « Retour » |
| Top bar | « Carnet » |
| `···` | « Options du carnet » |
| Like | « J'aime » / « Retirer mon j'aime » |
| Commentaire | « Commenter » |
| Partage | « Partager » |
| Enregistrer | « Enregistrer » / « Retirer des enregistrements » |
| Menu visiteur | « Enregistrer », « Partager », « Copier le lien », « Signaler » |
| Menu propriétaire | « Modifier le carnet », « Visibilité », « Exporter en PDF », « Supprimer » |
| Commentaires | « Commentaires », « Ajouter un commentaire… », « Publier », « Répondre », « Voir plus » |
| Partage | « Partager », « Envoyer », « Copier le lien », « Rechercher une personne ou un groupe… » |
| Création | « Créer », « Publication », « Carnet », « Sortie GPS », « Kit », « Club », « Story » |
| Gérer | « Gérer le carnet » |
| Vide | « Aucun moment pour l'instant. », « Aucune trace GPS. », « Aucun commentaire. Sois le premier à réagir. » |
| Privé | « Carnet privé. », « Seul son auteur peut le voir. » |
| 404 | « Carnet introuvable. », « Ce carnet n'existe pas ou n'est plus disponible. », « Retour aux carnets » |
| Erreur | « Impossible de charger le carnet. », « Réessayer » |
| Auth | « Se connecter pour commenter », « Se connecter pour enregistrer » |
| Hors ligne | « Hors ligne — contenu en cache » |

**Interdits :** « Récit Vérifié », « Expédition Certifiée », « Certifié LKDV », « Membre Explorateur », « Guide Certifié », « Trace 3D », « Poids estimé 4.8 kg », « Trois traces enregistrées », tout chiffre/nom/photo inventé.

---

## 13. Ce qui disparaît de la page actuelle

| Élément actuel | Sort |
|---|---|
| Header global desktop | Supprimé ; top bar 52 |
| Breadcrumb Communauté/Carnets | Supprimé |
| Sidebar verticale 230 px | Supprimée |
| Sidebar droite 300 px | Supprimée |
| `lkdv-social-detail` 3 colonnes | Supprimé |
| `NavigationPlateau` carnet | Supprimé |
| Double bottom nav 102 px | Supprimé ; bottom bar 48 |
| `CarnetHero` marketing | Remplacé par cover + caption |
| `Récit Vérifié` / `Certifié LKDV` | Supprimés |
| `Expédition Certifiée` / `Membre Explorateur` | Supprimés |
| `Trace 3D` | Supprimé |
| Likes 24 / commentaires 8 codés en dur | Supprimés ; données réelles |
| `INITIAL_COMMENTS` | Supprimés |
| `PHOTO_MAP` / photos Unsplash génériques | Supprimés ; `image_url` réelle ou état vide |
| `Math.random()` likes | Supprimé |
| `Poids estimé 4.8 kg` | Supprimé ; poids réel |
| `Trois traces enregistrées` | Supprimé |
| GPX vide | Désactivé sans trace |
| Emojis 🎒📖🌿📷 | Supprimés ; icônes Lucide |
| Serif Instrument + mono IBM Plex | Supprimés ; une seule famille |
| `LkvButton` 44 rectangulaire | Remplacé par la pilule 36 / le rond 38 |
| Chips 28/32 | Supprimés ; capsule 30 pour les filtres |
| `100dvh overflow-hidden` | Supprimé ; scroll document |

---

## 14. Checklist de conformité

- [ ] Colonne 520 max, centrée, à 430/768/1024/1440.
- [ ] Aucune sidebar, aucun plateau, aucun breadcrumb, aucun header global.
- [ ] Une seule famille de police ; aucun serif, aucun mono, aucun Manrope.
- [ ] Une seule capsule 48 ; une seule lentille 30 ; aucun autre sélecteur.
- [ ] Une seule pilule 36 ; un seul rond 38 ; actions 34 ; close 34 ; menu 44.
- [ ] Aucune couleur hors tokens ; aucun rayon hors 28/26/20/18/14/999.
- [ ] Cover 1:1, radius 28, `cover_image` réelle ou placeholder maison.
- [ ] Auteur réel ou « Auteur non renseigné » ; aucun nom inventé.
- [ ] `verified=false` → aucun badge de certification.
- [ ] Likes/commentaires/saves persistés ; aucun toast avant confirmation.
- [ ] Commentaires réels ; aucun `INITIAL_COMMENTS`.
- [ ] GPX désactivé sans trace ; jamais de fichier vide.
- [ ] Poids du kit réel ; 0 article = pas de poids.
- [ ] Bottom bar 48, 5 onglets, aucun actif sur carnet.
- [ ] Drawers : une coquille, trois hauteurs, focus trap, Échap, safe area.
- [ ] Profil auteur = drawer Profil du Compte, 5 slots + lentilles.
- [ ] Création = half drawer 6 tuiles, même style que Communauté.
- [ ] Cibles 44×44 ; contraste 4,5:1 ; focus visible ; reduced motion.
- [ ] Aucun emoji ; icônes Lucide 18/15/24.
- [ ] Aucune donnée « plausible » inventée.

---

## 15. Points tranchés

- **Cover 1:1** : retenu. Dans la disposition Compte (`11-disposition-compte-carnet.md`), elle est affichée en **96/112 px** dans la carte d’identité, et en plein écran 1:1 dans le viewer.
- **Commentaires** : retenus en **sheet** 92 dvh.
- **Sections** : flux vertical, capsule 48 **dans la carte d’identité**, non sticky.
- **Périmètre** : fiche `/carnets/[id]` uniquement ; le hub `/carnets` et `/clubs/[id]` restent hors scope.

---

## 16. Sources de vérité (fichiers à copier, pas à réinterpréter)

| Élément de la spec | Fichier / composant de référence |
|---|---|
| Bottom bar 48 px, 5 cellules, lentille | `src/styles/account-glass.css` (`.tb`), `src/components/account/AccountBottomBar.tsx` |
| Bouton rond 38 px | `src/styles/account-glass.css` (`.gbtn`) |
| Pastille auteur | `src/features/community/feed/PostAuthorPill.tsx`, `src/styles/community-feed.css` (`.lkdv-post-author`) |
| Capsule d'actions 3×34 | `src/components/account/AccountActionPill.tsx`, `src/styles/account-glass.css` (`.pmi-post-actions`) |
| Menu 226 px | `src/components/account/AccountMoreMenu.tsx`, `src/styles/account-glass.css` (`.pmi-options-menu`) |
| Capsule principale 48 / lentille 30 | `src/styles/liquid-capsules.css`, `src/components/ui/CapsuleTabs.tsx` |
| Colonne 520, cover 1:1, post texte | `src/styles/community-feed.css` (`.lkdv-feed-column`, `.lkdv-feed-post`, `.lkdv-feed-post--text`) |
| Panneau commentaires / partage | `src/features/posts/ui/PostGlassPanel.tsx`, `src/features/community/feed/PostCommentsPanel.tsx`, `PostSharePanel.tsx` |
| Coquille de drawer 92 dvh / 76 dvh | `src/components/compte/overlay/OverlaySheet.tsx`, `compte-overlay.css` |
| Demi-drawer création 50 dvh | `src/features/community/sections/CommunityDrawer.tsx` |
| Grille création 6 tuiles | `src/features/community/feed/CommunityCreateDrawer.tsx`, `src/styles/community-feed.css` (`.lkdv-create-grid`) |
| Drawer Profil 5 slots + lentilles | `src/components/compte/drawer/ProfileDrawerHost.tsx`, `SlotShell.tsx`, `SlotSelector.tsx`, `DrawerShell.tsx` |
| Drawer Compte 5 onglets | `src/components/compte/drawer/compte/CompteDrawer.tsx` |
| Champs de formulaire | `src/components/compte/overlay/compte-overlay.css` (`.lkdv-overlay-field`) |
| Toile de fond | `src/styles/community-feed.css` (`.lkdv-feed-shell`, `--account-canvas-*`) |
| Fonts | `src/styles/tokens.css` (`--font-sans`, `--font-display`) |
| Couleurs | `src/styles/tokens.css`, `src/styles/account-glass.css` (`--feed-*`) |

**Règle de revue :** si un écran de la fiche carnet ne peut pas être décrit avec ces fichiers, c'est qu'il introduit un nouveau style. Il doit être corrigé ou justifié.
