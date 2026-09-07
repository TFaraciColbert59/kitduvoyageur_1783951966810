# Design System Unifié — Le Kit du Voyageur (LKDV)
Dernière révision : Chantier U (Gouvernance exécutable & Source Unique)

## 1. Principes Directeurs
Le Design System LKDV s'articule autour des principes d'ergonomie mobile Apple Human Interface Guidelines et du style "Aura & Liquid Glass" :
- **Clarté et immersion** : Nuances végétales (`#17402C`, `#5B7F55`) inspirées des forêts alpines et des roches de haute montagne.
- **Accessibilité WCAG 2.2 AA** : Ratios de contraste strictement supérieurs à 4.5:1 pour le texte courant et 7.0:1 pour les éléments primaires.
- **Composants natifs & Safe-Area** : `AppShell` et `AppShellDesktop` gérant les safe-areas iOS/Android (Dynamic Island, barre de statut, barre d'accueil) et la mise en page 3 colonnes desktop.
- **Cibles tactiles Apple HIG** : Toutes les zones cliquables respectent un format minimal de 44x44 px sur mobile (`--lkv-touch-min: 44px`).
- **Une seule source de vérité stylistique** : Seul `src/styles/tokens.css` déclare des valeurs brutes. Tout autre fichier de style est un miroir typé ou une référence via `var(--...)`.

---

## 2. Architecture des Sources de Styles

| Fichier | Statut & Rôle | Règle de gouvernance |
|---|---|---|
| `src/styles/tokens.css` | **Source Unique Canonique** | Déclare toutes les valeurs brutes (couleurs, rayons, durées, espacements) |
| `src/design/tokens.ts` | **Miroir Typé Dérivé** | Export TypeScript typé consommé par les composants TSX (0 valeur brute) |
| `src/styles/liquid-glass.css` | Recettes Liquid Glass | Ne contient que des alias vers `var(--lkv-*)` et des filtres de flou |
| `src/styles/tailwind.css` | Exposition utilitaire | Expose les variables sans re-déclaration |
| `src/app/pays/styles/country.css` | Styles spécifiques Pays | 0 hexadécimal, 0 doublon de variable |
| `src/app/pays/styles/earth.css` | Styles spécifiques Globe | 0 hexadécimal, 0 doublon de variable |

---

## 3. Échelle Canonique des Rayons (Ruling U1)

| Nom de classe | Token CSS | Valeur | Usage canonique |
|---|---|---|---|
| `rounded-card` | `--lkv-radius-card` | `28px` | Panneaux principaux, GlassCard, cartes cockpit |
| `rounded-2xl` | `--lkv-radius-2xl` | `32px` | Modales immersives, sheets supérieures |
| `rounded-xl` | `--lkv-radius-xl` | `26px` | Cartes moyennes, conteneurs secondaires |
| `rounded-lg` | `--lkv-radius-lg` | `20px` | Cartes compactes, panneaux imbriqués |
| `rounded-md` | `--lkv-radius-md` | `14px` | Éléments de formulaire, boutons standards |
| `rounded-sm` | `--lkv-radius-sm` | `10px` | Badges, tags, puces |
| `rounded-xs` | `--lkv-radius-xs` | `6px` | Indicateurs fins, repères discrets |
| `rounded-full` | `--lkv-radius-full` | `9999px` | Avatars, capsules d'état, boutons circulaires |

*Règle : Tout `rounded-[Npx]` littéral est interdit hors de `src/components/ui` (garde-fou U-D62).*

---

## 4. Palette Chromatique Officielle LKDV

| Nom | Valeur Hexadécimale | Rôle & Usage | Contraste mesuré |
|---|---|---|---|
| **Vert Forêt LKDV** | `#17402C` | Titres, fond de boutons primaires, badges sombres | 10.4:1 sur blanc |
| **Vert Sauge Action** | `#5B7F55` | Boutons secondaires, focus rings, accents visuels | 4.6:1 sur blanc |
| **Fond Écran Crème** | `#FBFAF6` | Arrière-plan global de l'application | Fond de base |
| **Fond Surface Papier** | `#FAF8F5` | Cartes et surfaces surélevées | Surface |
| **Noir Nuit Sombre** | `#0B1F17` | Arrière-plan mode Plein Soleil / Bivouac de nuit | 15.2:1 sur blanc |
| **Avertissement Warn** | `#C89A3B` | Alertes météo, statuts intermédiaires | 4.8:1 sur fond sombre |
| **Rose Alerte Danger** | `#A8443A` | Recommandations vitales, alertes sécurité terrain | 7.5:1 sur crème |
| **Bleu Ciel Sky** | `#2A5A6E` | Cartographie, cours d'eau, météo | 5.2:1 sur crème |

*Note de gouvernance : Les classes froides Tailwind (`zinc-`, `gray-`, `slate-`, `amber-`, `emerald-`, `blue-`) sont interdites au profit des palettes officielles `stone`, `forest`, `sage`, `sand`, `sky`, `ink` (garde-fou U-D61).*

---

## 5. Primitives Réutilisables Obligatoires (`src/components/ui`)

1. **`AppShell` / `AppShellDesktop`** :
   - Conteneur d'écran racine mobile et desktop.
   - Gère le layout 3 colonnes desktop, le skip-link `#main-content`, la safe-area.
2. **`GlassCard`** :
   - Panneau de verre authentique (`backdrop-blur-md`, `rounded-card`).
3. **`LkvButton`** :
   - Bouton universel respectant la cible tactile de 44 px.
4. **`LkvBadge`** :
   - Pastille sémantique pour les statuts, catégories de poids, difficultés et avertissements.
5. **Dialogues canoniques (`src/components/ui/dialogs.ts`)** :
   - `lkvAlert`, `lkvConfirm`, `lkvPrompt` centralisent en un point unique d'architecture tous les dialogues applicatifs autrefois dispersés (41 appels directs dans 33 fichiers éliminés, garde-fou U-D63).
   - *Note d'évolution : Le remplacement des implémentations de secours par des modales `GlassSheet`/`GlassModal` purement React est consigné au backlog UX (point de contact unique prêt).*

---

## 6. Garde-Fous Exécutables en CI (`tests/design/unification.spec.ts`)

- **U-D60** : 0 couleur hexadécimale hors `src/styles/tokens.css` dans les sources de styles déclaratives (`liquid-glass.css`, `tailwind.css`, `country.css`, `earth.css`, `tokens.ts`).
- **U-D61** : 0 classe froide (`zinc`, `gray`, `slate`, `amber`, `emerald`, `blue`) dans `src/`.
- **U-D62** : 0 rayon littéral `rounded-[Npx]` ni ombre `shadow-[...]` hors primitives (`src/components/ui`).
- **U-D63** : 0 appel direct à un dialogue natif (`alert`, `confirm`, `prompt`) hors primitives (`src/components/ui`).
- **U-D64** : 0 variable CSS déclarée dans 2+ fichiers de styles.


