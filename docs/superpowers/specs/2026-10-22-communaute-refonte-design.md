# Refonte Communauté — aligner `/communaute` sur la grammaire Liquid Glass du Compte

**Date :** 2026-10-22
**Statut :** proposition à valider — **aucun code écrit, aucun fichier de `src/` modifié**
**Périmètre :** `/communaute` (lot 1), puis `/communaute/decouvrir`, `/communaute/post/[id]`,
`/communaute/reels`, `/communaute/publier`, `/communaute/pro` (lot 2).
**Référence visuelle :** `/compte` (Liquid Glass v8) — capture `docs/communaute/baseline/compte-430x932-light.png`.

---

## 1. Le problème constaté

Aujourd'hui ce ne sont pas deux pages qui divergent, ce sont **deux langages visuels dans la
même page** :

| Zone | Ce qui est rendu | Preuve |
|---|---|---|
| `/communaute` mobile | surface papier pleine largeur, plaques opaques, filets 1 px, onglets texte défilants, posts collés bord à bord | `src/styles/community-social.css:58-75` (`.lkdv-social-mobile`), `:190-306` (`.lkdv-social-post` : `border-radius: 0`, `box-shadow: none`) |
| `/communaute` desktop | cockpit verre 3 colonnes sur fond immersif, cartes `Card`, badges, rails | `src/app/communaute/page.tsx:447-875`, capture `communaute-1440x900-light.png` |
| `/compte` mobile | fond immersif voilé, capsule d'identité, carte héro en verre, lentilles, grille, drawers, barre basse | `-` |

Trois conséquences mesurables :

1. **La même page change de produit** entre 430 px et 768 px (papier ↔ verre).
2. **La navigation des 6 espaces existe en trois exemplaires** : capsule d'en-tête, `Tabs`
   scrollable milieu de page (`MobileCommunityHub.tsx:120-134`) et plateau bas
   (`NavigationPlateau.tsx:82-89`). L'utilisateur voit deux sélecteurs identiques à l'écran
   (captures 430 px).
3. **La grammaire « capsule + lentille » est définie à trois endroits**, sans source unique :
   dans le composant de référence (`CompteLiquidGlassV8.tsx`, blocs `.ig-tabs` l.802-890 et
   `.segc` l.1602-1720), dans `DRAWER_SHELL_CSS` (`shell/DrawerShell.tsx:202-236`) et dans
   `DRAWER_V2_CSS` (`SlotShell.tsx:289-333`). Tant que ces trois copies existent, toute
   reproduction dans la Communauté sera une **copie de plus**.

**Conclusion :** la refonte ne peut pas être « on applique le style du Compte à la Communauté ».
Elle doit d'abord **extraire la grammaire** (capsule, lentille, coquille, états), puis faire
consommer cette grammaire par les deux pages. C'est la seule lecture qui satisfait
« réutilisation à 100 %, 0 duplication ».

---

## 2. La cible

### 2.1 Les 14 briques du Compte, et leur traduction Communauté

| # | Brique de référence (Compte) | Traduction Communauté | Décision |
|---|---|---|---|
| 1 | Fond immersif plein cadre + voile (`MobileCompteV2` → `.lkdv-compte-v8` / `.phone`) | Même fond (`CompteBackground`, déjà partagé avec `/carnets`, `/clubs`, `/nouveau-groupe`) + voile verre | réutilisé |
| 2 | Capsule d'identité flottante (`.ig-top`, `.ig-handle`, 3 boutons ronds) | Capsule d'identité communauté : handle, actions `+`, recherche, messages | réutilisé (grammaire), contenu propre |
| 3 | Carte héro en verre (`#card.cs`) | Carte héro « La communauté » : identité, contexte réel, actions | composé depuis `Card`/`Badge` |
| 4 | Capsules de sections (`.segc.lg-tabs.lens-on`, 48 px) | La capsule unique des 6 espaces | extrait → `CapsuleTabs` |
| 5 | Lentilles (`.sel-lens`, `--i`, 420 ms) | Même lentille, même `--i`, même courbe | extrait → `liquid-capsules.css` |
| 6 | Grille / tuiles (`.ig-grid`, `aspect 1/1.05`) | Grille de contenus (carnets, clubs, sorties, photos) | réutilisé (grammaire) |
| 7 | Sélecteur flottant bas-droite (`.ig-tabs-float`, 30 px) | Sélecteur secondaire d'une section (ex. « Tous / Mes clubs ») | extrait → `LensSelector` |
| 8 | Carte contexte (`.ctx` + carte 3D) | **Pas de carte 3D** : drawer contextuel 2 lentilles (Massif / Club) | voir D3 |
| 9 | Drawers / feuilles (`.sheet`, capsules 48/30, 420 ms) | Commentaires, stories, signalement, partage, invitations | réutilisé → `DrawerShell` / `Sheet` |
| 10 | Barre de navigation basse (`.tb`) | `BottomTabBar` existante, inchangée | réutilisé |
| 11 | États squelette / vide / erreur | `DrawerSkeleton`, `DrawerEmpty`, `DrawerError`, `verifyEmpty` | réutilisé |
| 12 | Mouvement `transform`/`opacity`, 420 ms `cubic-bezier(.32,.72,0,1)` | `LensPager` (seuil 24 px, snap 250 ms) + capsule 420 ms | réutilisé |
| 13 | Tokens (`--lkv-*`, `--glass-*`, `--label*`, `--tint`, `--pg`) | Mêmes tokens, aucun nouveau | réutilisé |
| 14 | CSS réel (classes, dimensions, `!important`, media queries) | Extraction sans réécriture, puis consommation | extrait |

### 2.2 Le hub en une image

```
┌─────────────────────────────────────────┐  fond immersif + voile (brique 1)
│  (avatar)  @moi            + ⌕ ✉        │  capsule d'identité, 48 px (brique 2)
├─────────────────────────────────────────┤
│  ╭───────────────────────────────────╮  │
│  │  carte héro en verre              │  │  brique 3 — stats réelles uniquement
│  │  La communauté · 3 massifs suivis │  │
│  │  [Publier]  [Découvrir]           │  │
│  ╰───────────────────────────────────╯  │
│  ╭───────────────────────────────────╮  │
│  │ ◱ ◲ ◳ ◴ ◵ ◶   ← capsule 48 px    │  │  brique 4 (6 icônes, 18 px)
│  │         lentille .sel-lens        │  │  brique 5
│  ├───────────────────────────────────┤  │
│  │  pane active (LensPager, swipe)   │  │  brique 6
│  │  ...contenu du fil...             │  │
│  │                        ◱◲ 30 px   │  │  brique 7 (si 2e niveau)
│  ╰───────────────────────────────────╯  │
└─────────────────────────────────────────┘
        barre de navigation basse (brique 10)
```

---

## 3. Les décisions (à valider)

**D1 — Une seule grammaire, extraite, jamais copiée.**
`src/styles/liquid-capsules.css` devient la source unique de `.segc`, `.sel-lens`, `.lg-tabs`,
`.lens-on`, `.ig-tabs`, `.ig-th`, `.ig-tabs-float`. Les trois définitions actuelles n'en gardent
que les surcharges locales. `src/components/ui/CapsuleTabs.tsx` et
`src/components/ui/LensSelector.tsx` deviennent les deux primitives React ; `DrawerShell`,
`SlotSelector`, `SlotShell` et la Communauté les consomment. **Aucun `!important` nouveau.**

**D2 — Un seul sélecteur pour les 6 espaces.**
La capsule 48 px est le sélecteur unique (icônes 18 px, libellés en `aria-label` + `title`,
`role="tablist"`, roving tabindex). Le `Tabs` scrollable du hub est supprimé. Le
`NavigationPlateau` global est **supprimé pour `/communaute` seulement**, via le registre de
destinations, pas par un `startsWith` dans `AppShell` (interdit par
`tests/design/lot2-shell.spec.ts:105`).

**D3 — Pas de carte 3D dans la Communauté.**
La « carte contexte » du Compte est une carte MapLibre 3D (`page.tsx` du Compte, zone `.mapzone`).
La Communauté n'a pas de géographie à montrer qui ne soit déjà un massif textuel. Sa carte
contexte devient un **drawer 2 lentilles** (Massif / Club) ouvert depuis la carte héro, avec les
mêmes capsules et la même lentille. Aucune dépendance MapLibre ajoutée au bundle Communauté.

**D4 — Le desktop est une adaptation réelle, pas une maquette.**
À 1440 × 900, `/compte` rend un **cadre d'iPhone factice + un éditorial**
(`status 9:41`, `island`, `home`, `<aside class="notes">` — capture `compte-1440x900-light.png`).
Reproduire cela dans la Communauté serait un contresens. Le desktop Communauté reste une page
réelle en 3 colonnes, mais avec **exactement les mêmes capsules, lentilles, cartes, rayons,
ombres et transitions** que le mobile — un seul langage, deux largeurs.

**D5 — Aucun compteur mensonger.**
Le héro n'affiche un nombre que s'il est un total réel. Les compteurs actuels sont des
**longueurs de page** (`posts.length`, `.limit(20)`/`(50)` — `page.tsx:150,157,160`). Interdits
en tant que totaux. Le héro affiche : handle, massifs suivis (déjà chargés), nombre réel
d'adhésions club (`club_members` filtré `status='active'`, `page.tsx:246-250`), et les dates de
la prochaine sortie réelle. Sinon : rien.

**D6 — Deux familles de feuilles, pas trois.**
`DrawerShell` quand il y a 2 niveaux (onglets + lentilles) ; `Sheet` (primitive existante,
`src/components/ui/Sheet.tsx`) quand il n'y a qu'un niveau. Aucune feuille maison.
Les feuilles n'ont **aucun en-tête** (pas d'icône, titre, sous-titre, partage) : c'est la loi
`docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md:54-62`.

**D7 — Les cinq états sont obligatoires et partagés.**
Squelette, vide avec CTA, erreur avec réessayer, hors-ligne, visiteur. Aujourd'hui : squelette
(`MobileCommunityHub.tsx:158-173`), vide (partout), erreur par section
(`page.tsx:184-210`), **hors-ligne absent** (aucun `navigator.onLine` dans `src/app/communaute`
ni `src/components/communaute`), visiteur partiel (redirection `/connexion`,
`page.tsx:92-94`). On réutilise `OfflineBanner`
(`src/features/adventure-intelligence/ui/OfflineBanner.tsx:16`, props `offline`/`pendingCount`).

**D8 — Les sous-routes suivent, en lot 2, avec le même shell.**
Même capsule, mêmes états, même `LensPager`. Aucune sous-route ne garde un en-tête maison
(`.lkdv-community-discovery-header`, `.lkdv-community-reels-header`).

---

## 4. Les écrans

| Écran | Structure cible | Ce qui reste |
|---|---|---|
| `/communaute` mobile | capsule identité → héro → capsule 6 espaces → `LensPager` 6 panes → sélecteur secondaire | fil paginé, stories, carnets, clubs, expéditions, sorties, entraide |
| `/communaute` desktop | 3 colonnes, même grammaire ; colonne centrale = héro + capsule + pager | rails massifs, événements en direct, clubs populaires |
| `/communaute/decouvrir` | grille 3 colonnes, capsule de filtres, en-tête capsule | recherche, filtres média, tuiles 3/4 |
| `/communaute/post/[id]` | même carte de post que le fil, en pleine largeur | commentaires, actions, deep link |
| `/communaute/reels` | plein écran sombre, capsule d'actions, barre basse masquée | scroll-snap, IntersectionObserver, like |
| `/communaute/publier` | `AppShell` + sections en cartes verre, capsule d'audience | texte, photos, vidéo, carnet, club, brouillon |
| `/communaute/pro` | alias inchangé de `/communaute-pro/page` | — |

---

## 5. Ce qui ne change pas

- **URLs et deep links** : `?tab=fil|carnets|clubs|groupes|evenements|entraide`, `?post=`,
  `?comment=` (`page.tsx:42-56`, `:360-372`). Les onglets continuent de router vers
  `/carnets`, `/clubs`, `/groupes` (`page.tsx:61-72`).
- **Données** : mêmes tables, mêmes requêtes, mêmes RPC (`join_event`,
  `toggle_community_post_like`). Aucune migration.
- **Métadonnées** : `src/app/communaute/layout.tsx` (canonical, OpenGraph, JSON-LD) inchangé.
- **Tests verrouillants** : voir plan §12 — aucune classe ni littéral cité n'est renommé.
- **`/compte`** : aucun changement visuel. Preuve par capture 430 / 768 / 1440.

---

## 6. Risques majeurs (détail et mitigation dans le plan §14)

1. L'extraction de la grammaire peut déplacer une règle et changer `/compte` de 1 px → capture
   avant/après obligatoire, rollback immédiat sinon.
2. `CommunityPostCard` fait 1 498 lignes et porte la logique métier (like, save, commentaires,
   partage, signalement) : on extrait la **présentation**, jamais la logique.
3. Le dépôt contient des modifications non commitées sur les fichiers de référence
   (`CompteLiquidGlassV8.tsx`, `DrawerShell.tsx`, `SlotShell.tsx`, `ProfileDrawerHost.tsx`) :
   on ne branche pas dessus sans arbitrage.

---

## 7. Hors scope

Backend, nouveau modèle social, DM, paiement, IA, refonte de `/compte` au-delà de l'extraction,
application native, déploiement, push, migration distante.
