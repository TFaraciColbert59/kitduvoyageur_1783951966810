# DESIGN SYSTEM LKDV — GOUVERNANCE ET SPECIFICATIONS OFFICIELLES

> **Règle absolue :** Aucune page ni composant métier ne doit recréer ad hoc un composant UI existant ni introduire de nouvelles couleurs/polices arbitraires.

---

## 1. Sources de Vérité Canoniques

1. **`/materiel` = Source unique de vérité visuelle**  
   Fait foi pour le style Liquid Glass, les surfaces, les cartes, les boutons, les badges, la typographie, les rayons de bordure (`12px`, `16px`, `24px`, `rounded-full`), les ombres, les flous (`backdrop-blur`), et les micro-interactions tactiles.
2. **`/compte` = Source unique de vérité des patterns utilisateur**  
   Fait foi pour la structure des profils, des réglages, des groupes d'actions, des listes d'éléments et des formulaires.

---

## 2. Palette & Design Tokens

Toutes les couleurs doivent provenir directement de `src/design/tokens.ts` ou des variables CSS de `src/styles/liquid-glass.css` :

* **Forest (Primaire) :** `#17402C` (hover `#205238`, soft `#365233`)
* **Sage (Accent) :** `#5B7F55` (subtle `#A6C1A0`)
* **Stone (Arrière-plans) :** `#FAF8F5` (desktop/cards), `#F5F2EC` (mobile global background)
* **Paper (Surfaces Verre) :** `#FBFAF6` (avec `backdrop-blur` et bordures `border-white/60`)
* **Sémantiques :**
  * Warning : `#C89A3B` / `--warn-bg` (`#FBF1DC`)
  * Danger : `#A8443A` / `--danger-bg` (`#F5DDD9`)
  * Info : `#4B6B7C` / `--info-bg` (`#DDE7EE`)

---

## 3. Primitives UI Canoniques (`src/components/ui/`)

### Boutons (`LkvButton.tsx`)
* **Façade officielle** : `LkvButton` — l'alias `Button` a été supprimé en Phase 1 (doublon d'exacte délégation).
* **Variantes autorisées** : `primary`, `secondary` / `light`, `ghost`, `danger`, `icon-only`.
* **Interdictions** : Interdiction absolue de styliser des éléments `<button>` bruts avec des couleurs ou gradients ad hoc dans les pages.

### Cartes (`GlassCard.tsx`)
* **Primitive officielle** : `GlassCard` — l'alias `Card` a été supprimé en Phase 1.
* **Tons autorisés** : `neutral`, `sage`, `warn`, `danger`, `info`.
* **Cartes métier** : Les cartes spécialisées (ex: cartes produits) doivent utiliser `GlassCard` comme wrapper visuel.

### Structure de page (Phase 1)
* **Primitives** : `Page`, `PageHeader`, `PageContent`, `PageActions`, `Section`, `Divider`.
* **Layouts** : `src/design/layouts/` — `PageLayout`, `ListPageLayout`, `DetailPageLayout`, `FormPageLayout`, `DashboardPageLayout`, `MapPageLayout` (composés au-dessus d'`AppShell`).
* **Règle d'emplacement** : retour à gauche du header, actions à droite, action principale en bas de page — mêmes emplacements partout.

### Chargement
* **Primitive officielle** : `Spinner` (indicateurs) et `Skeleton*` (contenus). Les spinners artisanaux (`rounded-full animate-spin` recopiés) sont proscrits pour les nouveaux écrans.

### État des primitives (Phase 1)
* **Conservées non adoptées** (cibles de migration, pas encore utilisées) : `LkvInput`, `LkvTextarea`, `LkvSelect`, `LkvCheckbox`, `LkvSwitch`, `Tabs`/`ScrollableTabs`, `PremiumGlassCard`, `MediaUpload`.
* **Façade d'import unique** : `@/design` réexporte tokens + primitives + layouts (aucune duplication d'implémentation).

### Badges & Chips (`LkvChip.tsx`)
* **Primitive officielle** : `LkvChip` (et `Badge` en rétrocompatibilité).
* **Tons** : `sage`, `warn`, `danger`, `info`, `stone`, `light`, `dark`.

### Onglets (`IOSSegmentedControl.tsx` & `ScrollableTabs.tsx`)
1. **`IOSSegmentedControl`** : Choix exclusifs courts (2 à 4 items).
2. **`ScrollableTabs`** : Navigation horizontale défilante et filtres de catégories.

### Formulaires (`src/components/ui/`)
* **Primitives form** : `LkvInput`, `LkvTextarea`, `LkvSelect`, `LkvCheckbox`, `LkvSwitch`.
* **Anti-zoom iOS Safari** : Taille de police minimale de `16px` sur mobile (`text-[16px] sm:text-sm`).

### Icônes (`LkvIcon.tsx`)
* **Primitive officielle** : `LkvIcon` et sous-icônes animées de `@/components/icons/*`.
* **Target tactile minimale** : $44 \times 44 \text{ px}$.

---

## 4. Règles de Sécurité & Mobile Apple / Android

* **Safe Areas** : Respecter `env(safe-area-inset-top)` et `env(safe-area-inset-bottom)` via `AppShell` ou `MobilePageShell`.
* **Tactile** : Toutes les zones cliquables mobiles doivent mesurer au moins $44 \text{ px}$ de hauteur/largeur.
* **Haptique** : Utiliser `useHapticFeedback()` pour les sélections et boutons tactiles.

---

## 5. Mémoire musculaire et contrats de structure (Phase 2, Lot 2)

### Règles d'emplacement (non négociables)

| Zone | Règle |
|---|---|
| **Leading** | Le retour est toujours à gauche, via `HeaderBackButton` (44×44, chevron, historique puis `backHref`). Aucune page ne réimplémente un bouton retour. |
| **Centre / titre** | Même alignement (gauche) et mêmes niveaux : titre inline 17 semi-bold, titre large 34 bold (`PageHeader variant`). Sous-titre en footnote 13. |
| **Trailing** | L'action contextuelle est toujours à droite du header, même taille de cible ; l'overflow/menu y reste aussi. |
| **Page** | Recherche au même niveau logique (header ou premier bloc), filtres sous le header (`toolbar` de `ListPageLayout`), CTA de validation selon `PageActions` (inline ou sticky). |

### Contrats

1. **AppShell** — unique shell de page : `Background → header → contenu (scroll) → bottomExtra`. Il réserve la navigation via `--bottom-nav-height` et applique `--page-top-inset` / `--nav-offset*`. Aucune page ne calcule `env(safe-area-inset-*)`.
2. **Safe areas** — source unique : `src/styles/tokens.css` (`--safe-*`, `--nav-height: 52px`, `--nav-offset`, `--nav-offset-extended`, `--page-*-inset`, `--keyboard-inset`). Le plateau secondaire est déclaré une seule fois (`destinationRegistry.hasExtendedNav`).
3. **PageHeader** — structure invariable `[Back] — Titre — [Trailing]` ; variantes `inline`/`large`, `sticky`, `transparent`/`scrollAware`. Aucune feature ne crée son propre header.
4. **NavigationBar** — une seule barre active (`NavigationBar` → `BottomTabBar`) ; onglets définis par `destinationRegistry` (une source pour Web/Android/futur natif) ; `NATIVE_TABBAR_ENABLED` reste `false` jusqu'à vérification SDK macOS.
5. **Scroll** — le shell est le seul conteneur de scroll ; `min-height: 100svh`/`100dvh` (`.lkv-shell`) ; pas de `100vh` brut, pas de padding bas manuel (réservé par le shell), pas de scroll imbriqué sans nécessité.
6. **Clavier** — Capacitor `Keyboard.resize: 'body'` gère la compensation native ; le CSS ne rajoute **aucune** compensation (pas de double). `--keyboard-inset` reste disponible pour les cas web purs.
7. **Overlays** — une seule échelle (`--z-*` / `src/lib/ui/zIndex.ts`) : contenu < header sticky < FAB < nav < drawer < sheet < modal < popover < command < toast < tooltip < urgence. Les `z-[...]` locaux sont migrés progressivement.

## 6. Procédure avant de créer un composant UI

> **Règle anti-régression (Phase 2) :** « Existe-t-il déjà une primitive ou un pattern dans `@/design` capable de couvrir ce besoin ? »
> Si oui : étendre ou réutiliser. **Ne jamais créer une variante uniquement pour reproduire exactement l'ancien écran.**

1. Vérifier si une primitive existe déjà dans `src/components/ui/` (ou via la façade `@/design`).
2. Si une primitive correspond au besoin, **l'utiliser directement**.
3. Si une variante manque, l'ajouter de façon générique dans la primitive UI sous `src/components/ui/` après comparaison avec `/materiel`.
4. Les baselines de validation Phase 2 (mesures avant, captures, protocole) vivent dans `docs/design-system/PHASE2_READINESS.md`.
