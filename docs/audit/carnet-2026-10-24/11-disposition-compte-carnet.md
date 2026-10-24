# Fiche carnet — disposition Compte

**Date :** 24 octobre 2026
**Statut :** addendum **autoritaire** pour la disposition de `/carnets/[id]`.
**Remplace :** les sections 1 à 3 de `10-spec-visuelle-carnet.md` (wireframes, cover pleine largeur, caption card, capsule sticky).
**Conserve :** `10-spec-visuelle-carnet.md` sections 4 à 16 pour les composants, boutons, drawers, typographie, couleurs, mouvement, accessibilité et sources.
**Décision utilisateur :** « la même disposition que la page Compte quand on arrive sur un carnet ».
**Décisions verrouillées :** cover **1:1**, commentaires en **feuille** (sheet), une seule police, un seul sélecteur, un seul bouton.

---

## 0. Principe : le carnet est un profil, pas un post

La page ne reprend pas la grammaire « post du fil » (cover pleine largeur, caption card, capsule d’actions sur la photo). Elle reprend la grammaire **profil** de `/compte` :

1. **Top bar** : un contrôle d’identité à gauche, trois boutons ronds à droite.
2. **Carte d’identité** : un visuel carré à gauche (ici la cover 1:1), les chiffres à droite, le texte, l’auteur et les actions en dessous.
3. **Bloc médias** : grille 3 colonnes de moments, avec un sélecteur secondaire grille/carte.
4. **Sections** : récit, matériel, nature, commentaires, en cartes empilées.
5. **Bottom bar** du Compte, 48 px, 5 onglets.
6. **Drawers** : ceux du Compte/Communauté, inchangés dans leur style.

Le carnet garde son identité (cover, titre, auteur, récit, étapes, moments, kit, nature), mais **la structure de page est celle du profil**.

---

## 1. Wireframe mobile 430 × 932

```
┌──────────────────────────────────────────────┐
│ (‹)  [cover 24] Tour du Mont-Blanc  (➤)(🔖)(···) │  top bar 52
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ ┌──────┐  Tour du Mont-Blanc              │ │  header card 28
│ │ │      │  France / Italie / Suisse        │ │
│ │ │ 1:1  │  26 sept. – 2 oct. 2026          │ │
│ │ │ 96   │  106 km   2 002 m   7 jours      │ │  stats 17/700
│ │ └──────┘                                  │ │
│ │  (av) Camille Rochat ✓ 94                 │ │  auteur 32/44
│ │  Dix jours, trois pays, deux bivouacs…    │ │  bio 13,5
│ │  [ ♥ 12 ]  [ 💬 3 ]                       │ │  actions 36
│ │  ╭ Récit Parcours Moments Matériel Nature ╮│ │  capsule 48
│ └────────────────────────────────────────────┘ │
│                                                │
│  ┌─────┬─────┬─────┐                           │  grille 3 col
│  │     │     │     │                           │  1:1, gap 2
│  ├─────┼─────┼─────┤                           │  pas de radius
│  │     │     │     │                           │
│  ├─────┼─────┼─────┤                           │
│  │     │     │  +2 │                           │
│  └─────┴─────┴─────┘                           │
│                       ╭ ▦  🗺 ╮                 │  toggle 30
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ RÉCIT                                      │ │  carte 28
│ │ Dix jours, trois pays…                     │ │
│ │ ① Chamonix → Les Houches                   │ │  timeline
│ │ ② Les Contamines → …                       │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │ MATÉRIEL · 4,2 kg          Reconfigurer →  │ │
│ │ Sac 45L              1,4 kg                │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │ NATURE                                     │ │
│ │ [ photo ]  Identifier une espèce            │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │ COMMENTAIRES (3)              Voir tout →  │ │
│ │ (av) Alice · Les photos sont superbes…     │ │
│ │ [ Ajouter un commentaire… ]          (➤)   │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│  ╭ Explorer  Compas  Matériel  Hub  Compte ╮   │  bottom bar 48
└──────────────────────────────────────────────┘
```

---

## 2. Wireframe desktop 1440 × 900

```
┌──────────────────────────────────────────────────────────────┐
│                 (‹) [cover 24] Tour du Mont-Blanc  (➤)(🔖)(···)│  top bar 520
│                                                              │
│        ┌──────────────────────────────────────────┐          │
│        │ ┌──────┐  Tour du Mont-Blanc             │          │
│        │ │ 1:1  │  France / Italie / Suisse       │          │
│        │ │ 112  │  26 sept. – 2 oct. 2026         │          │
│        │ └──────┘  106 km  2 002 m  7 jours      │          │
│        │  (av) Camille Rochat ✓ 94               │          │
│        │  Dix jours, trois pays…                 │          │
│        │  [ ♥ 12 ] [ 💬 3 ]                       │          │
│        │  ╭ Récit Parcours Moments Matériel Nature ╮│        │
│        └──────────────────────────────────────────┘          │
│        ┌─────┬─────┬─────┐                                    │
│        │     │     │     │   grille 3 col, 2 px              │
│        ├─────┼─────┼─────┤                                    │
│        │     │     │     │                                    │
│        └─────┴─────┴─────┘                                    │
│                         ╭ ▦  🗺 ╮                             │
│        ┌──────────────────────────────────────────┐          │
│        │ RÉCIT / MATÉRIEL / NATURE / COMMENTAIRES │          │
│        └──────────────────────────────────────────┘          │
│                    ╭ Explorer Compas Matériel Hub Compte ╮   │
└──────────────────────────────────────────────────────────────┘
```

Aucune sidebar. Aucun layout 3 colonnes. Aucun breadcrumb. Aucun plateau.
À 768 px, la colonne reste 520 px centrée.

---

## 3. Anatomie

### 3.1 Colonne, fond, scroll

| Élément | Valeur |
|---|---|
| Colonne | `max-width: 520px`, centrée, padding 0 10 px |
| Fond | `account-bg.webp` cover center 30 %, brightness 1.1 saturate 1.05, voile Communauté |
| Scroll | document normal, pas de conteneur `100dvh` |
| Padding bas | 78 px + `env(safe-area-inset-bottom)` |
| Top bar | sticky, 52 px + safe |
| Bottom bar | fixed, 48 px, bottom 10 |

### 3.2 Top bar

| Élément | Valeur |
|---|---|
| Hauteur | 52 px + `env(safe-area-inset-top)` |
| Padding | `calc(safe + 8px) 10px 6px` |
| Gauche | bouton rond 38 « Retour » + **pilule titre** |
| Pilule titre | h 34, radius 999, glass, padding 4 10 4 4, **cover 24×24 radius 8** + titre 12,5/700 max 220 px ellipsis |
| Droite | 3 boutons ronds 38, gap 6 : Partager, Enregistrer, Options `···` |
| Fond | transparent, puis voile glass après 12 px de scroll |
| Boutons | `.gbtn` : 38, blanc .5, blur 4 sat 1.9 brightness 1.07, icône 18 |
| Cible | 44 via `::after` |
| Pressé | `scale(.94)` |
| Focus | anneau 2 px forest |

La pilule titre remplace la pilule `@handle` du Compte. Elle n’est **pas** un sélecteur : elle indique seulement l’identité du carnet. La cover 24 est un aperçu ; un tap sur la pilule remonte en haut de page.

### 3.3 Carte d’identité (header card)

C’est la pièce centrale : elle reprend la carte profil du Compte.

| Élément | Valeur |
|---|---|
| Forme | radius 28, padding 14, marge 10 0 |
| Fond | blanc .62, blur 25,2, ombre post |
| Ligne haute | `display: flex`, gap 12, align-items: flex-start |
| Cover | **96×96** mobile / **112×112** desktop, radius 18, `object-fit: cover`, tap = viewer |
| Cover absente | carré 96/112 en dégradé forest, initiales destination 24/700 blanc, label « Sans couverture » 8,5 |
| Icône expand | 16, bas-droite de la cover, dans un cercle glass 22 |
| Colonne droite | flex 1, min-width 0 |
| Titre | 20/24 mobile, 22/26 desktop, 700, forest 800, max 2 lignes |
| Destination | 11/500 muted, une ligne, ellipsis |
| Dates | 10,5/500 muted, une ligne |
| Stats | 3 cellules alignées, gap 8, marge top 8 ; valeur 17/700 `tabular-nums`, label 9,5/600 uppercase muted |
| Stats absentes | cellule supprimée ; si aucune, rangée supprimée |
| Auteur | juste sous la ligne haute, pleine largeur : pastille 32/44, nom 12,5/700, `@handle · date`, badge trust score réel |
| Auteur absent | « Auteur non renseigné », initiale `?`, pas de lien |
| Badge vérifié | dans la ligne du titre, seulement si `verified=true` : shield 12 + « Vérifié » 9,5/700, fond sage .12 |
| Badge privé | propriétaire seulement : lock 12 + « Privé » 9,5/700 |
| Description | 13,5/1,45, forest 800, max 3 lignes, puis « Lire la suite » 11/600 → scroll vers Récit |
| Actions | rangée de 2 pilules 36 : `♥ 12` (like), `💬 3` (commentaire) ; icônes 16, compteurs 11/600 ; like actif `#E0245E` |
| Action owner | 3e pilule « Modifier » 36 secondary |
| Séparateur | hairline .5 avant la capsule |
| Capsule | 48, 5 sections, pleine largeur de la carte, marge top 12 |
| Hauteur totale | ~300 px mobile, ~320 desktop |

**La cover n’est plus pleine largeur.** Elle est le visuel d’identité à gauche, comme l’avatar du Compte. Le plein écran reste 1:1. C’est le prix de la disposition Compte ; c’est aussi ce qui distingue la fiche d’un post.

### 3.4 Capsule de sections (dans la carte)

| Élément | Valeur |
|---|---|
| Primitive | `CapsuleTabs` 48, identique au Compte |
| Position | dans la carte d’identité, sous les actions, pleine largeur |
| Hauteur | 48, padding 2 |
| Fond | blanc .65, blur 28, bordure .5 blanc .8, inset 1 px, ombre |
| Lentille | top/bottom 4, left 3, largeur `(100%-6)/5`, 420 ms |
| Cellules | 5 : Récit, Parcours, Moments, Matériel, Nature ; icône 18 + label 9,5/600 |
| Actif | forest 800 ; inactif forest 600 |
| Comportement | clic = scroll vers la section ; `Parcours` met le bloc médias en mode carte, `Moments` en mode grille |
| Accessibilité | `role=tablist`, `aria-selected`, `aria-controls`, roving tabindex |
| Sticky | **non** : la capsule reste dans la carte et défile avec elle, comme les highlights du Compte |

### 3.5 Bloc médias (grille / carte)

C’est le bloc « posts » du profil, transposé aux moments du carnet.

| Élément | Valeur |
|---|---|
| Position | 10 px sous la carte d’identité |
| Grille | 3 colonnes, gap 2 px, tuiles 1:1, **sans radius** (signature du Compte) |
| Largeur | 100 % de la colonne (520 max) |
| Nombre | jusqu’à 9 tuiles ; si plus, 9e tuile = « +N » |
| Tuile | image `object-fit: cover`, overlay bas noir .55 au tap, icône appareil 16 en haut à droite dans un cercle glass 24 |
| Vide | carte 28 glass, icône appareil 24, « Aucun moment pour l’instant. » + CTA propriétaire |
| Toggle | capsule secondaire 30, 2 cellules (grille / carte), bottom-right 10, z 5 |
| Mode grille | tuiles moments |
| Mode carte | carte 1:1, radius 18, tuiles OSM, trace forest 4,5, départ/arrivée |
| Carte vide | fond glass, icône route 24, « Aucune trace GPS. » ; propriétaire « Ajouter une trace » |
| Carte actions | « Agrandir » 38 top-right ; footer stats + « Télécharger le GPX » 36 primary ; GPX désactivé sans trace |
| Tap tuile | viewer média plein écran |
| Tap carte | mode carte, pas de navigation |
| `Parcours` capsule | active le mode carte et scroll au bloc |
| `Moments` capsule | active le mode grille et scroll au bloc |

**Pas de carte 28 autour de la grille** : les tuiles sont posées sur le fond, comme la grille du Compte. Le toggle 30 est le seul élément flottant.

### 3.6 Sections sous le bloc médias

| Section | Forme | Contenu |
|---|---|---|
| Récit | carte 28, padding 14/16 | H2 17/700 ; description complète 13,5/1,5 ; timeline verticale des étapes (badge 32, trait 1 px, titre 14/700, méta 10,5/500, citation 13/5) ; « Lire la suite » de la carte d’identité scrolle ici |
| Matériel | carte 28 | H2 17/700 + poids réel 17/700 + « Reconfigurer » 36 secondary ; lignes 44, dot 10, nom 12,5/600, détail 10,5, poids 10,5 tabular ; checkbox 22 |
| Nature | carte 28 | H2 17/700 ; zone photo 1:1/4:3 dashed, bouton « Prendre une photo » 36 primary ; résultat nom 15/700, latin 10,5, confiance 9,5, description 12,5, protégé |
| Commentaires | carte 28 | H2 17/700 + count + « Voir tout » ; 2 vrais commentaires ; composer 36 + send 34 ; anonyme = CTA connexion |

Chaque section a `scroll-margin-top: 72px` (top bar seule, pas de capsule sticky).
La section **Étapes** n’existe pas comme carte séparée : elle est dans Récit. La capsule n’a donc que 5 entrées.

### 3.7 Bottom bar

Identique au Compte :

| Élément | Valeur |
|---|---|
| Hauteur | 48, bottom 10 |
| Largeur | `min(calc(100% - 20px), 500px)` |
| Forme | 999, padding 2 |
| Fond | `--bar-glass-bg`, blur 7,2 sat 1.9 brightness 1.07 |
| Cellules | 5 : Explorer, Compas, Matériel, Hub, Compte |
| Icônes | 19 ; labels 10/600 |
| Lentille | 40, top/bottom 4, left 3, largeur `(100%-6)/5`, 420 ms |
| Actif | **aucun** sur la fiche carnet |
| Cible | 44 par cellule |
| Safe area | bottom + safe |

---

## 4. Correspondance avec la page Compte

| Page Compte | Fiche carnet |
|---|---|
| Top bar : pilule `@handle` + 3 gbtn | Top bar : back 38 + pilule titre (cover 24) + 3 gbtn |
| Carte profil : avatar 66 + stats 10/50/32 | Carte identité : cover 96/112 + stats distance/D+/jours |
| Bio + liens | Titre, destination, dates, description, auteur |
| Highlights 5 cercles | Capsule 48, 5 sections |
| Grille 3 colonnes de posts | Grille 3 colonnes de moments |
| Toggle grille/carte 31 | Toggle 30, 2 cellules |
| Carte MapLibre | Carte Leaflet 1:1, trace |
| Bottom bar 48, Compte actif | Bottom bar 48, aucun actif |
| Drawer Profil 5 slots | Drawer Profil auteur 5 slots (identique) |
| Drawer Compte 5 onglets | Drawer Gérer le carnet (owner) + menu `···` |
| OverlaySheet 92/76 dvh | Commentaires 92, partage 76, gérer 76, carte 92, signaler 76 |

**Différence assumée :** le Compte n’a pas de cover pleine largeur ; la fiche carnet non plus. La cover est le visuel d’identité de la carte, pas un hero.

---

## 5. Ce qui change par rapport à `10-spec-visuelle-carnet.md`

| `10` (post) | `11` (profil) |
|---|---|
| Cover pleine largeur 1:1 | Cover 96/112 dans la carte d’identité |
| Capsule d’actions 3×34 sur la cover | 2 pilules 36 like/comment dans la carte |
| Caption card séparée | Carte d’identité unique |
| Capsule sticky sous la caption | Capsule dans la carte, non sticky |
| Sections en cartes, pas de grille | Grille 3 colonnes + toggle carte |
| Aperçu commentaires après Nature | Identique |
| Top bar 3 gbtn | Identique, avec back + pilule titre |
| Drawers | Identiques (voir `10` sections 4-5) |

Le reste de `10` — boutons, sélecteurs, drawers, typographie, couleurs, mouvement, accessibilité, sources — reste valide.

---

## 6. Points d’entrée des drawers

| Déclencheur | Drawer |
|---|---|
| `···` top bar | Menu 226 px : Enregistrer, Partager, Copier, Signaler ; owner : Modifier, Visibilité, Export, Supprimer |
| `♥` carte | Like (pas de drawer) |
| `💬` carte | Commentaires 92 dvh |
| Partager top bar | Partage 76 dvh ou `navigator.share` |
| Enregistrer top bar | Favori (pas de drawer) |
| Auteur | Drawer Profil 92 dvh, 5 slots |
| Cover | Viewer média plein écran |
| Tuile moment | Viewer média |
| « Agrandir » carte | Drawer Carte 92 dvh |
| « Modifier » owner | Drawer Gérer 76 dvh |
| « Voir tout » commentaires | Drawer Commentaires |
| « Reconfigurer » kit | `/compas?etape=kit` |
| « Prendre une photo » nature | API + état, pas de drawer |
| `+` (si ajouté) | Half drawer Création 50 dvh |

Le drawer **Création** n’est pas monté par défaut sur la fiche : il reste accessible depuis la Communauté/Compte. Si un `+` est ajouté, il ouvre le même half-drawer 6 tuiles.

---

## 7. Responsive

| Largeur | Comportement |
|---|---|
| 320–767 | colonne 100 %, max 520, padding 10 ; cover 96 ; grille 3 col ; carte 1:1 |
| 768–1199 | colonne 520 centrée ; cover 112 ; aucune sidebar ; top/bottom 520/500 |
| 1200+ | colonne 520 centrée ; mêmes marges |

À 768, le centre ne peut plus être écrasé : il n’y a plus de sidebars.
La grille 3 colonnes à 520 fait des tuiles de 172 px ; à 430, 134 px.

---

## 8. Checklist de conformité

- [ ] Même shell que `/compte` : top bar, carte d’identité, contenu, bottom bar.
- [ ] Aucune sidebar, aucun layout 3 colonnes, aucun breadcrumb, aucun plateau.
- [ ] Cover 1:1 **dans la carte** (96/112), pas en pleine largeur.
- [ ] Carte d’identité : cover + titre + stats + auteur + description + actions + capsule.
- [ ] Grille 3 colonnes, gap 2, tuiles 1:1 sans radius, toggle 30 grille/carte.
- [ ] Carte 1:1, trace, GPX désactivé sans trace.
- [ ] Capsule 48 dans la carte, 5 sections, non sticky.
- [ ] Bottom bar 48, 5 onglets, aucun actif.
- [ ] Une seule police SF/Inter ; pas de serif, pas de mono.
- [ ] Un seul sélecteur : capsule 48 + lentille 30.
- [ ] Un seul bouton : pilule 36, rond 38, action 34, close 34, menu 44.
- [ ] Données réelles uniquement ; aucun nom/chiffre/photo inventé.
- [ ] Drawers de `10` sections 4-5, avec focus trap et safe areas.
- [ ] 430/768/1440 sans débordement ; cibles 44 ; contraste 4,5:1.

---

## 9. Décisions retenues

1. **Commentaires en sheet 92 dvh** — retenu. Plus lisible qu’un panneau inline sur une page longue.
2. **Cover 96 px mobile / 112 px desktop** — retenu. C’est l’équilibre de la carte Compte : assez grand pour identifier, assez petit pour laisser respirer le titre et les stats.
3. **Actions like/comment en pilules 36 dans la carte** — retenu. La capsule 3×34 appartient au post du fil ; la pilule appartient au profil.
4. **Capsule 48 dans la carte, non sticky** — retenu. Elle remplace les highlights du Compte et défile avec la carte.
5. **Grille 3 colonnes, gap 2, tuiles sans radius** — retenu. C’est la signature de la grille Compte.
6. **Toggle grille/carte 30 px, bottom-right 10** — retenu. Sélecteur secondaire unique.

Aucun arbitrage ouvert. La disposition est prête pour le plan d’implémentation.
