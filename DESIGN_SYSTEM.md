# DESIGN SYSTEM LKDV — GOUVERNANCE ET SPÉCIFICATIONS OFFICIELLES

> **Règle absolue :** Aucune page ni composant métier ne doit recréer ad hoc un composant UI existant ni introduire de nouvelles couleurs/polices arbitraires. Toute l'application s'appuie sur la banque unique `src/design/bank.ts`.

---

## 0. Architecture de la Banque Unique (`src/design/bank.ts`)

La source de vérité unique, typée et centralisée de tout le système visuel LKDV est **`src/design/bank.ts`**.
Tous les artefacts multi-plateformes sont automatiquement dérivés et synchronisés via le générateur atomique `scripts/generate-design-bank.mjs` :
- `src/styles/tokens.generated.css` (Web Custom Properties, 1 seul `:root`, 0 `.dark`, 0 `!important`)
- `src/design/tokens.generated.ts` (Valeurs littérales typées pour Canvas 2D, SVG inline et MapLibre GL JS)
- `tailwind.preset.generated.js` (Preset CommonJS pour Tailwind CSS, 0 hex codé en dur)
- `ios/App/App/DesignTokens.generated.swift` (UIKit / SwiftUI structs et couleurs natives Apple)
- `android/app/src/main/res/values/design_tokens.generated.xml` & `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt` (Material 3 XML et Kotlin)

Le contrat Liquid Glass Mode Clair est rigoureusement uniforme sur l'ensemble des 80+ routes de l'application (Hub, Explorer, Compas, Compte, Communauté, Carnet).

---

## 1. 100% Mode Clair Liquid Glass & Zéro Noir

LKDV applique une politique stricte de **100 % Mode Clair Liquid Glass** :
- **Quasi zéro sombre, zéro noir (`#000`/`#101010`/`#121815`)** : fin définitive de la polarité `.dark`, des surcharges sombres `liquid-ios27.css` et de `#lkdv-theme-init`.
- `StatusBar` en `Style.Light` par défaut (encres et icônes système sombres sur fond clair).
- Surfaces de verre dépoli clair teinté sauge/blanc : `--g3-bg`, `CookieConsentBanner` et carte `404` en verre clair dépoli (`#EBF2EC` / `#D8E5D5` avec encre sombre `#172B24`).

---

## 2. Palette & Design Tokens Canoniques

Toutes les couleurs proviennent directement de `src/design/bank.ts` :

### Surfaces & Fonds
* **Toile de fond (Canvas) :** `#FBFAF6` (`--lkv-surface-canvas`)
* **Fond applicatif (Sauge très pâle) :** `#F5F7F3` (`--lkv-surface`)
* **Surfaces Cartes & Élevées :** `#FFFFFF` (`--lkv-surface-card`, `--lkv-surface-elevated`)
* **Listes Groupées (Sauge 50) :** `#F0F5EE` (`--lkv-surface-grouped`)
* **Surfaces Muted :** `#EDF1EA` (`--lkv-surface-muted`)
* **Voile de fond applicatif :** `rgba(242, 246, 243, 0.78)` (`--lkv-app-bg-scrim`)

### Encres & Textes (WCAG AAA / AA, Zéro Noir)
* **Texte Primaire :** `#172B24` (contraste > 14:1 sur blanc et canvas)
* **Texte Secondaire :** `#56665D` (contraste > 5.6:1)
* **Texte Tertiaire / Muted :** `#46584D` (contraste > 7.0:1)
* **Texte Quaternaire / Subtle :** `#8C9790`
* **On Brand / On Action :** `#FFFFFF` sur boutons vert forêt
* **Scrim photo :** `rgba(16, 28, 23, 0.42)`

### Gamme Verte LKDV & Actions
* **Brand Primary (Vert Forêt Marque) :** `#17402C` (hover `#205238`, soft `#365233`)
* **Action (Vert LKDV) :** `#226148` (hover `#1B4F3A`)
* **Secondary (Vert Sauge) :** `#5B7F55` (hover `#4A6B44`)
* **Primary Subtle :** `#D3EBD9`
* **Secondary Subtle (Pilules Sauge) :** `#D8E5D5` avec texte `#17402C` (`--lkv-on-secondary-subtle`)

### Rims & Ombres Teintées Vert Forêt
* **Liseré de verre (Rim Color) :** `rgba(23, 43, 36, 0.14)` (`--glass-rim-color`)
* **Ombre de liseré :** `0 0 0 0.5px rgba(23, 43, 36, 0.14)` (`--glass-rim-shadow`)
* **Ombre portée Liquid Glass :** `0 10px 32px rgba(23, 64, 44, 0.12)` (`--glass-shadow`)
* **Ombre élevée :** `0 16px 48px rgba(23, 64, 44, 0.16)` (`--glass-shadow-elevated`)

---

## 3. Primitives UI Canoniques (`src/components/ui/`)

### Icônes Vectorielles (`Icon.tsx`)
* **Primitive canonique unique** : `src/components/ui/Icon.tsx` et `src/components/ui/Icon/Icon.tsx`.
* **Zéro masque raster PNG** (`/icons/*.png` supprimé). Rendu 100% vectoriel via Lucide SVGs, SF Symbols sur iOS et Material Symbols sur Android.
* Tous les composants applicatifs importent leurs icônes depuis `@/components/ui/Icon` (aucun import direct `lucide-react` dans les pages fonctionnelles).
* Target tactile minimale : $44 \times 44 \text{ pt}$ ($48 \text{ dp}$ sur Android).

### Boutons & Cartes
* **Bouton officiel** : `LkvButton` (variantes `primary`, `secondary`, `ghost`, `danger`, `icon-only`).
* **Carte officielle** : `GlassCard` (surfaces de verre dépoli translucide avec rim teinté vert forêt).

### Unification des Primitives
* **1 seule primitive Sheet / Tiroir** : tiroir tactile 3 crans piloté par la banque.
* **1 seul SegmentedControl** : aligné Apple `UISegmentedControl` (remplaçant `CapsuleTabs`, `Tabs`, `SubTabBar`).
* **1 seul DynamicIslandHost** : aligné sous `env(safe-area-inset-top)`.
* **1 seule InsetGroupedList & ListItem** : groupement Apple HIG standardisé.

---

## 4. Rayons Concentriques & Échelle Z-Index Monotone

### Règle des Rayons Concentriques
Formule géométrique stricte : $R_{\text{enfant}} = \max(12, R_{\text{parent}} - \text{padding})$.
* `xs`: 12px
* `sm`: 16px
* `md`: 20px
* `lg`: 24px
* `card`: 28px
* `hero`: 38px
* `sheet`: 44px
* `pill`: 9999px
* Plancher concentrique (`concentricFloor`): 20px

### Échelle Z-Index Monotone (8 Niveaux)
Échelle strictement ordonnée éliminant tout conflit d'empilement :
`base (1) < sticky (100) < subbar (200) < tabbar (300) < hud (400) < sheet (500) < modal (600) < alert/toast/island (700)`

---

## 5. Navigation & Multi-OS Parité Apple Swift / Android M3

* **iOS** : `UITabBar` Liquid Glass natif Apple actif sur **toutes** les routes (y compris `/compas`), icônes SF Symbols sans texte (`icon-first`). Extension `LkdvWidgetsExtension` (Live Activities Dynamic Island & Lock Screen).
* **Android** : `LKDVAndroidTabBarHost` (NavigationBar Material 3 en capsule flottante claire) et service de notification d'activité continue.
* **Web** : `FloatingLiquidTabBar` en fallback fluide avec alignement pixel au millimètre.
* **Safe Areas** : Dégagement Dynamic Island haut et TabBar bas (`--lkv-native-bar-height: 64px`, `bottomClearance: 88px`).
