# 06 — Bible Design System LKDV (Unique Vérité Produit)

> **Seule et unique source de vérité design** de **Le Kit du Voyageur (LKDV)**, extraite des 3 références vivantes de l'application :
> - **`/carnets/[id]`** (`CarnetScreenV2`, `carnet-v2.css`, `carnet-v2-lenses.css`)
> - **`/clubs/[id]`** (`ClubLiquidGlassV8`, `club-drawers-v2.css`, `SlotShell`)
> - **`/communaute`** (Communauté V2 : Stories, Posts + Commentaires/Partage, Pilule Utilisateur, Drawers de création)
> - **Socle de jetons** : `src/design/bank.ts` (compilé par `scripts/generate-design-bank.mjs`, vérifié par `npm run design:check`)

### Architecture de la Documentation Design (5 volets)
1. **Ce document (`DESIGN_SYSTEM.md`)** — Philosophie ergonomique, Fondations (Palette, Verre, Typographie, Rayons, Espacements, Motion, Interdits).
2. **[DRAWERS_AND_NAVIGATION.md](DRAWERS_AND_NAVIGATION.md)** — Le Pilier Drawers (sélecteur haut + sous-volets & filtres en **bas à droite**, hauteurs/élévations par page, 4 modes d'ouverture, sobriété sans `×` redondant).
3. **[CANONICAL_BLOCKS.md](CANONICAL_BLOCKS.md)** — Catalogue des **7 blocs identiques partout** (Pilule Utilisateur, Stories, Posts/Commentaires/Partage, Fiches Produits, Aperçus Carnet/Club/Sortie/Kit, Drawers de Création, Cartes du Monde 3D).
4. **[GESTURES_MOTION_ICONS.md](GESTURES_MOTION_ICONS.md)** — Gestes tactiles, hiérarchie anti-conflit des swipes, loi de sobriété zéro doublon, micro-interactions/haptique et dictionnaire unique d'icônes.
5. **[SYSTEM_CHROME_AND_RESPONSIVE.md](SYSTEM_CHROME_AND_RESPONSIVE.md)** — Desktop/iPad, barre flottante, `DynamicIsland`, confirmations destructives, clavier mobile, safe-areas et mode offline montagne.

---

## 1. Principes Ergonomiques Non Négociables

1. **Visuel > Texte** : l'image, la carte, la couleur, la jauge ou le chiffre lisible passent toujours avant les paragraphes explicatifs.
2. **Icônes > Libellés** : dans les sélecteurs de sous-volets, filtres et barres d'actions, utiliser des **icônes claires** (`aria-label` + `title` pour l'accessibilité) plutôt que des textes longs qui surchargent.
3. **Simplicité visuelle & rapidité d'accès** : l'utilisateur doit comprendre l'écran en < 1 seconde et atteindre l'information clé en 1–2 taps maximum.
4. **Rangement strict en Catégories → Sous-catégories** : chaque écran ou drawer hiérarchise son contenu en **volets principaux** (catégories, en haut) et **lentilles / sous-volets** (sous-catégories, en bas à droite).
5. **Forme de page libre, langage de blocs unifié** : la mise en page en « 2 grandes cartes » (69 % / 31 %) des pages Carnets/Clubs n'est **pas** obligatoire sur toutes les pages. En revanche, **tous les drawers, sélecteurs, polices, espacements, rayons et blocs canoniques doivent être 100 % cohérents sur toute l'app**.

---

## 2. Identité Visuelle : 100 % Mode Clair Liquid Glass — Pure Palette Verte LKDV

> **INTERDIT ABSOLU : ZÉRO NOIR PUR** (`#000000`, `#101010`, `#121815` et gris froids neutres bannis).
> Toute encre, bordure, ombre et surface est ancrée dans la **palette verte forêt & papier ivoire LKDV**.

### Surfaces & Fonds (`src/design/bank.ts`)
| Token | Valeur | Rôle |
| :--- | :--- | :--- |
| `surfaces.canvas` (`--bg-body`) | `#FBFAF6` | Fond papier/ivoire principal |
| `carnet --page` | `#F5F2EC` | Toile chaude des vues immersives |
| `surfaces.sauge` | `#F5F7F3` | Fond sauge pâle / fallback |
| `surfaces.surfaceElevated` | `#FFFFFF` | Verre blanc pur / cartes élevées |
| `surfaces.surfaceGrouped` | `#F0F5EE` | Listes groupées (`InsetGroupedList`) |
| `surfaces.surfaceMuted` | `#EDF1EA` | Fonds de chips/pills neutres |
| `carnet --mint` | `#EBF2EC` | Fond verre prominent & badges doux |
| `surfaces.border` / `borderSubtle` / `borderStrong` | `rgba(23,43,36, 0.12 / 0.06 / 0.24)` | Bordures hairline teintées forêt |

### Encres (Contraste WCAG AAA / AA)
| Token | Valeur | Rôle |
| :--- | :--- | :--- |
| `inks.labelPrimary` (`--label`) | `#172B24` | Texte principal (WCAG AAA) |
| `inks.labelSecondary` (`--label2`) | `#56665D` | Métadonnées, sous-titres (WCAG AA) |
| `inks.labelTertiary` (`--label3`) | `#46584D` / `rgba(23,43,36,0.44)` | Labels discrets, placeholders |
| `inks.labelQuaternary` | `#8C9790` | Indices subtils, icônes inactives |
| `inks.onBrand` / `onAction` / `onMedia` | `#FFFFFF` | Texte sur vert forêt ou sur photo |
| `inks.scrim` | `rgba(16, 28, 23, 0.42)` | Voile protecteur sur média plein écran |

### Marque, Actions & Statuts
| Token | Valeur | Rôle |
| :--- | :--- | :--- |
| `brand.primary` (`--tint`) | `#17402C` | Vert forêt signature (actif, titres, boutons pleins) |
| `brand.action` | `#226148` | CTA principal (hover `#1B4F3A`) |
| `brand.secondary` (`--accent`) | `#5B7F55` | Vert sauge secondaire |
| `brand.primarySubtle` | `#D3EBD9` | Fonds de sélection doux |
| `status.success` (`--good`) | `#3D6038` / bg `#EAF3E9` / border `#B4D4B0` | OK, synchronisé |
| `status.warning` (`--warn`) | `#8F671E` / bg `#FBF1DC` / border `#E8CF96` | Prudence, alerte douce |
| `status.danger` (`--bad`) | `#85261E` / bg `#F5DDD9` / border `#DFA8A1` | Danger, suppression |
| `status.info` (`--info` / `--water`) | `#2C4C5E` / bg `#DDE7EE` / border `#A3BDCC` (`#3F93B8` eau) | Info, eau/météo |

---

## 3. Système Liquid Glass (4 Niveaux)

| Niveau | Fond (`bg`) | Flou | Saturation | Usage |
| :---: | :--- | :---: | :---: | :--- |
| **`g1` (clear)** | `rgba(255, 255, 255, 0.65)` | `12px` | `180%` | Badges flottants, étiquettes sur média |
| **`g2` (regular)** | `rgba(255, 255, 255, 0.85)` | `24px` | `180%` | Cartes, popovers, tuiles standards |
| **`g3` (prominent)** | `rgba(235, 242, 236, 0.88)` | `36px` | `190%` | Drawers V2, barres dominantes |
| **`gc` (capsule)** | `rgba(255, 255, 255, 0.72)` | `20px` | `180%` | Sélecteurs de volets, `CapsuleTabs`, `IdentityPill`, filtres |

**Finitions constantes** :
- Specular top : `inset 0 1px 0 rgba(255, 255, 255, 0.75)`
- Rim hairline : `0 0 0 0.5px rgba(23, 43, 36, 0.14)` + `inset 0 0 0 0.5px rgba(255, 255, 255, 0.65)`
- Ombres forêt : standard `0 10px 32px rgba(23, 64, 44, 0.12)` · élevée `0 16px 48px rgba(23, 64, 44, 0.16)`

---

## 4. Typographie Cohérente (Police Unique + Variantes)

| Rôle | Famille (`bank.typography.fontFamilies`) | Usage |
| :--- | :--- | :--- |
| **UI & Corps (`sans`)** | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif` | 90 % de l'interface (lisibilité native iOS/Web) |
| **Titres (`display` / `brand`)** | `'SF Pro Display'` / `'Manrope'` | Titres d'écrans, prix, chiffres forts |
| **Éditorial (`serif`)** | `'Instrument Serif', Georgia, serif` | Accents éditoriaux (récits de carnets, manifeste) |
| **Données & Télémétrie (`mono`)** | `'IBM Plex Mono', SFMono-Regular, monospace` | Horodatages, distances, D+, allures, coordonnées, badges `J1/J2` |

**Échelle Dynamic Type Apple** :
`largeTitle 34/41 (700)` · `title1 28/34 (700)` · `title2 22/28 (700)` · `title3 20/25 (600)` · `headline 17/22 (600)` · `body 17/22 (400)` · `callout 16/21` · `subheadline 15/20` · `footnote 13/18` · `caption1 12/16` · `caption2 11/13`.

---

## 5. Géométrie, Espacements, Z-Index & Mouvements

- **Rayons concentriques (`bank.radii`)** : `xs: 12px` · `sm: 16px` · `md: 20px` · `lg: 24px` (drawers) · `card: 28px` · `hero: 38px` · `sheet: 44px` · `pill: 9999px`. **Loi concentrique** : `rayon_interne = rayon_externe - padding` (plancher `20px`).
- **Grille d'espacement (`bank.spacing`)** : multiple de `4px` (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`). Cibles tactiles : **≥ 44 px** (iOS) / **≥ 48 dp** (Android) / **≥ 60 px** en `glovesMode`. Barres : `navHeight: 60px`, `tabBarHeight: 64px`, `bottomClearance: 88px`.
- **Z-Index** : `base: 1` · `sticky: 100` · `subbar: 200` · `tabbar: 300` · `hud: 400` · `sheet: 500` · `modal: 600` · `alert: 700`.
- **Motion (courbes tokenisées uniquement)** : `instant: 100ms`, `fast: 200ms`, `med: 300ms`, `slow: 450ms`, `pressScale: 0.97`, courbes `--ease-spring`, `--ease-smooth`, `--ease-glass`, `--ease-emphasis`.

---

## 6. Garde-Fous Non Négociables (Tests Automatisés)
- Aucun hex/rgb/font/courbe écrit à la main dans les feuilles V2 : uniquement des `var(--…)` (vérifié par `tests/design/unification.spec.ts` & `motion-unique.spec.ts`).
- Modifier `src/design/bank.ts` (jamais `tailwind.preset.generated.*`) et exécuter **`npm run design:check`**.
- Réduction de mouvement toujours scopée (`[data-reduce-motion='true']`), jamais `*` global.
