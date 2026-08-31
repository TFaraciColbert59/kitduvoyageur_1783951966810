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
* **Façade officielle** : `LkvButton` (ou `Button` pour rétrocompatibilité).
* **Variantes autorisées** : `primary`, `secondary` / `light`, `ghost`, `danger`, `icon-only`.
* **Interdictions** : Interdiction absolue de styliser des éléments `<button>` bruts avec des couleurs ou gradients ad hoc dans les pages.

### Cartes (`GlassCard.tsx`)
* **Primitive officielle** : `GlassCard`.
* **Tons autorisés** : `neutral`, `sage`, `warn`, `danger`, `info`.
* **Cartes métier** : Les cartes spécialisées (ex: cartes produits) doivent utiliser `GlassCard` comme wrapper visuel.

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

## 5. Procédure avant de créer un composant UI

1. Vérifier si une primitive existe déjà dans `src/components/ui/`.
2. Si une primitive correspond au besoin, **l'utiliser directement**.
3. Si une variante manque, l'ajouter de façon générique dans la primitive UI sous `src/components/ui/` après comparaison avec `/materiel`.
