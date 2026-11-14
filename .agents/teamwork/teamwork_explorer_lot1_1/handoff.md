# Rapport d'Exploration Lot 1 : Banque Unique (`src/design/bank.ts`) & Générateur Multi-Cibles (`scripts/generate-design-bank.mjs`)

**Date** : 2026-11-13T22:25:00Z  
**Explorateur** : `teamwork_explorer_lot1_1` (Design Bank Generator Explorer)  
**Parent** : `38f1fd31-f581-4b46-b0dd-5af01c98f20a`  
**Dépôt** : `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`  
**Branche** : `codex/lkdv-integration-2026-11-11`  

---

## 1. Observation

L'exploration approfondie de la base de code, des scripts et de l'environnement de build révèle les faits tangibles suivants :

### 1.1 État des fichiers de design existants
- `src/design/bank.ts` : **Inexistant** sur `HEAD`. Le dossier `src/design/` contient uniquement `README.md`, `account/`, `breakpoints.ts`, `index.ts`, `layouts/`, `motion.ts`, `tokens.ts`.
- `src/design/tokens.ts` (356 lignes) : Ne contient **aucune valeur brute exploitable par Canvas, SVG ou MapLibre** ; c'est une coquille d'indirection mappant des variables CSS (`primary: 'var(--lkv-primary)'`, etc.) avec une seule mention littérale `"black"`.
- `src/styles/tokens.css` (1 276 lignes) : Contient une fragmentation majeure avec **6 blocs `:root` successifs et 2 blocs `.dark`** qui s'écrasent mutuellement, avec 116 variables redéfinies en interne.
- `src/styles/tailwind.css` (lignes 9-46) : Déclare un `:root` clair et un bloc `.dark` qui surcharge les ombres avec des noirs profonds `rgba(0,0,0,0.5)`.
- `tailwind.config.js` et `tailwind.config.cjs` (210 lignes, fichiers miroirs identiques) : Contiennent **des dizaines de codes hexadécimaux codés en dur** (`#0D1410`, `#131A16`, `#243028`, `#3D3828`, etc.) et aucune importation de preset externe (`presets: [...]` absent).
- `scripts/generate-design-bank.mjs` : **Inexistant**. Aucun script de génération de jetons n'est actuellement déclaré dans `package.json`.

### 1.2 Dossiers cibles natifs iOS et Android
- **iOS** : Le dossier `ios/App/App/` **existe** et héberge le code natif de l'application :
  - `AppDelegate.swift`
  - `SceneDelegate.swift` (1 131 lignes, gérant `LKDVNativeTabBarHost` et `LKDVBridgeViewController`)
  - `MainViewController.swift`
  - `LiveActivity/LkdvLiveActivityPlugin.swift`
- **Android** : Le dossier `android/app/src/main/res/values/` **existe** et contient :
  - `styles.xml`
  - `strings.xml`
  - `ic_launcher_background.xml`
- **Android Kotlin/Java Source Tree** : Le dossier `android/app/src/main/java/com/lekitduvoyageur/app/` **existe** (hébergeant `MainActivity.java`). Le package officiel de l'application est `com.lekitduvoyageur.app` (confirmé dans `android/app/build.gradle:16`).

### 1.3 Environnement d'exécution Node.js et TypeScript
- La commande `node -v` exécutée dans l'espace de travail renvoie **`v26.8.2`**.
- L'évaluation Node.js `node -e "import('./src/design/motion.ts')"` **charge nativement les fichiers TypeScript sans étape de compilation intermédiaire**, grâce au support natif de strip-types dans Node 26.
- De plus, `tsx` version `^4.7.1` est présent dans les `devDependencies` de `package.json` et déjà utilisé pour d'autres scripts (`scripts/coverage/generate-matrix.ts`, `scripts/ops/phase10_slo_check.ts`).

### 1.4 Variables orphelines, collisions et inversions observées
- **35 variables CSS orphelines** :
  - `--lkv-text-caption-1` est consommé dans **98 emplacements** dans `src/` sans déclaration dans `tokens.css`.
  - `--glass-secondary` est consommé dans **61 emplacements** (`EmptyState.tsx`, `InsetGroupedList.tsx`, `SubTabBar.tsx`, `checkout`, etc.).
  - `--glass-specular` consommé 6 fois.
  - `--bg-body` consommé 5 fois.
- **Collision de type sur `--glass-rim`** :
  - Déclaré initialement en couleur (`rgba(255, 255, 255, 0.85)`), puis réécrit en `box-shadow` (`0 0 0 0.5px rgba(0, 0, 0, 0.22)`), ce qui casse les styles Tailwind du type `border-[color:var(--glass-rim)]`.
  - Le correctif validé dans le working tree sépare strictement `--glass-rim-color: rgba(23, 43, 36, 0.14);` et `--glass-rim-shadow: 0 0 0 0.5px rgba(23, 43, 36, 0.14);` avec `--glass-rim: var(--glass-rim-color);`.
- **Inversion d'échelle z-index** :
  - Dans la version initiale de `tokens.css`, `--z-modal: 55` était inférieur à `--z-tabbar: 300` et `--z-sheet: 500`, plaçant les dialogues de confirmation sous les feuilles tactiles.
  - L'échelle 8 niveaux monotone requise place `sheet: 500 < modal: 600 < alert/toast: 700`.

### 1.5 Tests Vitest existants et dépendances à `tokens.css`
- Sur 55 fichiers de test dans `tests/design/` (543 tests exécutés via `npx vitest run tests/design`), tous passent actuellement sur le working tree local, mais plusieurs tests lisent `src/styles/tokens.css` de manière statique :
  - `tests/design/tokens-sync.spec.ts` : vérifie l'absence de hex dans `src/design/tokens.ts` et la présence de clés de base dans `src/styles/tokens.css`.
  - `tests/design/p5-direction-tokens.spec.ts` (lignes 48-69) : teste explicitement un bloc `.dark {` dans `tokens.css` (`expect(dark).toContain('--lkv-surface: #101C17;')`).
  - `tests/design/unification.spec.ts` (lignes 21-28 & 121-155) : vérifie les règles U-D60 (aucun hex hors `tokens.css`) et U-D64 (aucune variable dupliquée dans les `STYLE_FILES`).
  - `tests/design/x6-accessibility.spec.ts` (ligne 37) : extrait le premier bloc `:root` de `src/styles/tokens.css` pour valider les contrastes WCAG AAA.

---

## 2. Logic Chain (Chaîne de Raisonnement)

1. **Nécessité de `src/design/bank.ts` comme contrat amont unique** :
   - *Observation 1.1* montre que `tokens.ts` n'expose que des chaînes `var(--...)` et que `tokens.css` souffre de réécritures multiples.
   - *Observation 1.4* démontre que les contextes graphiques hors-DOM (Canvas 2D, MapLibre GL JS, SVG dynamique, extensions Swift ActivityKit, code Android Kotlin) ne peuvent pas interpréter `var(--...)`.
   - *Conclusion intermédiaire 1* : `src/design/bank.ts` doit contenir les valeurs littérales (hexadécimales, numériques et courbes bézier) sous un typage TypeScript strict (`as const`), 100% en mode clair, avec zéro noir `#000`/`#101010`/`#121815` et une palette purement verte LKDV.

2. **Rôle et architecture du générateur `scripts/generate-design-bank.mjs`** :
   - *Observation 1.3* confirme que Node 26.8.2 peut importer directement `src/design/bank.ts` sans transpilation.
   - Le script doit transformer l'objet `bank` en 5 artefacts synchronisés :
     1. `src/styles/tokens.generated.css` (CSS custom properties, 1 `:root`, 0 `.dark`, 0 `!important`).
     2. `src/design/tokens.generated.ts` (objets JS/TS typés avec valeurs littérales pour Canvas/SVG/MapLibre).
     3. `tailwind.preset.generated.js` (preset CommonJS pour éliminer le hex de `tailwind.config.js`).
     4. `ios/App/App/DesignTokens.generated.swift` (structs Swift pour UIKit / SwiftUI).
     5. `android/app/src/main/res/values/design_tokens.generated.xml` et `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt` (ressources XML Material 3 et constantes Kotlin).

3. **Câblage avec Tailwind CSS et suppression des couleurs en dur** :
   - *Observation 1.1* montre que `tailwind.config.js` et `tailwind.config.cjs` portent des couleurs hexadécimales en dur (`forest`, `sand`, `sky`, `stone`, `sage`, `ink`).
   - En intégrant `presets: [require('./tailwind.preset.generated.js')]`, Tailwind hérite directement de la banque. Les fichiers `tailwind.config.js` et `tailwind.config.cjs` peuvent ainsi purger ces tables dupliquées pour atteindre l'objectif « 0 hex en dur dans tailwind.config ».

4. **Résolution des variables orphelines et compatibilité descendante** :
   - *Observation 1.4* prouve que 98 usages de `--lkv-text-caption-1` et 61 de `--glass-secondary` échouent ou retombent sur des fallbacks non contrôlés.
   - Le générateur doit injecter ces définitions directement dans `tokens.generated.css` pour assainir immédiatement l'arbre visuel sans toucher individuellement aux 159 composants appelants.
   - Pour éviter de briser les 10+ fichiers de tests qui inspectent `src/styles/tokens.css` (*Observation 1.5*), `src/styles/tokens.css` doit devenir une façade synchronisée important `tokens.generated.css` ou être réécrit par le générateur avec le même `:root` épuré.

---

## 3. Spécification Détaillée de l'Architecture

### 3.1 Structure et Typage de `src/design/bank.ts`

Le fichier `src/design/bank.ts` doit être structuré en 9 sections strictement typées :

```typescript
// src/design/bank.ts — Source de vérité unique du Design System LKDV
// 100 % Mode Clair Liquid Glass — Pure Palette Verte LKDV, Zéro noir (#000/#101010/#121815)

export interface SurfaceTokens {
  readonly canvas: string;          // Fond d'écran / toile claire (#FBFAF6)
  readonly canvasFallback: string;  // Sauge très pâle (#F5F7F3)
  readonly canvasVoile: string;     // Voile vert forêt (rgba(242, 246, 243, 0.78))
  readonly surfaceElevated: string; // Verre blanc pur (#FFFFFF)
  readonly surfaceGrouped: string;  // Sauge 50 (#F0F5EE, pour InsetGroupedList)
  readonly surfaceMuted: string;    // Gris sauge (#EDF1EA)
  readonly border: string;          // Bordure teintée vert (rgba(23, 43, 36, 0.12))
  readonly borderSubtle: string;    // Bordure douce (rgba(23, 43, 36, 0.06))
  readonly borderStrong: string;    // Bordure forte (rgba(23, 43, 36, 0.24))
  readonly fieldBg: string;         // Fond de champ (rgba(255, 255, 255, 0.70))
  readonly fieldBorder: string;     // Bordure de champ (rgba(23, 43, 36, 0.15))
}

export interface InkTokens {
  readonly labelPrimary: string;    // Vert forêt profond WCAG AAA (#172B24)
  readonly labelSecondary: string;  // Vert forêt moyen WCAG AA (#56665D)
  readonly labelTertiary: string;   // Vert forêt adouci (#46584D)
  readonly labelQuaternary: string; // Vert forêt subtil (#8C9790)
  readonly onBrand: string;         // Blanc sur bouton vert (#FFFFFF)
  readonly onMedia: string;         // Blanc sur média plein écran (#FFFFFF)
  readonly scrim: string;           // Voile protecteur texte photo (rgba(16, 28, 23, 0.42))
}

export interface StatusColor {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

export interface BrandTokens {
  readonly primary: string;           // Vert forêt marque (#17402C)
  readonly primaryHover: string;      // Survol primaire (#205238)
  readonly primarySoft: string;       // Vert adouci (#365233)
  readonly action: string;            // Vert action LKDV (#226148)
  readonly actionHover: string;       // Survol action (#1B4F3A)
  readonly secondary: string;         // Vert sauge (#5B7F55)
  readonly secondaryHover: string;    // Survol sauge (#4A6B44)
  readonly primarySubtle: string;     // Vert clair (#D3EBD9)
  readonly secondarySubtle: string;   // Sauge clair (#D8E5D5)
  readonly onSecondarySubtle: string; // Vert forêt sur sauge clair (#17402C)
  readonly onAction: string;          // Blanc (#FFFFFF)
  readonly status: {
    readonly success: StatusColor;    // #2E6930 / #EAF5EB / #C8E6C9
    readonly warning: StatusColor;    // #8A5B10 / #FEF7E6 / #FCE8B2
    readonly danger: StatusColor;     // #A32D22 / #FDECEB / #F8C1BD
    readonly info: StatusColor;       // #1F516B / #E8F4F8 / #BEDEEA
  };
}

export interface GlassLevel {
  readonly bg: string;
  readonly blur: string;
}

export interface GlassTokens {
  readonly g1: GlassLevel;            // g1 clear: rgba(255, 255, 255, 0.55), blur 12px
  readonly g2: GlassLevel;            // g2 regular: rgba(255, 255, 255, 0.72), blur 24px
  readonly g3: GlassLevel;            // g3 prominent: #F0F5EE / rgba(240, 245, 238, 0.88), blur 36px
  readonly gc: GlassLevel;            // gc capsule: rgba(255, 255, 255, 0.82), blur 20px
  readonly rimColor: string;          // rgba(23, 43, 36, 0.14)
  readonly rimShadow: string;         // 0 0 0 0.5px rgba(23, 43, 36, 0.14)
  readonly rimInner: string;          // inset 0 0 0 0.5px rgba(255, 255, 255, 0.65)
  readonly highlight: string;         // inset 0 1px 0 rgba(255, 255, 255, 0.75)
  readonly shadow: string;            // 0 10px 32px rgba(23, 64, 44, 0.12)
  readonly shadowElevated: string;    // 0 16px 48px rgba(23, 64, 44, 0.16)
}

export interface DynamicTypeStyle {
  readonly size: number;              // pt / px
  readonly lineHeight: number;        // pt / px
  readonly weight: 400 | 500 | 600 | 700;
  readonly tracking: number;          // pt / px
}

export interface TypographyTokens {
  readonly styles: {
    readonly largeTitle: DynamicTypeStyle;  // 34 / 41, 700, 0.37
    readonly title1: DynamicTypeStyle;      // 28 / 34, 700, 0.36
    readonly title2: DynamicTypeStyle;      // 22 / 28, 700, 0.35
    readonly title3: DynamicTypeStyle;      // 20 / 25, 600, 0.38
    readonly headline: DynamicTypeStyle;    // 17 / 22, 600, -0.41
    readonly body: DynamicTypeStyle;        // 17 / 22, 400, -0.41
    readonly callout: DynamicTypeStyle;     // 16 / 21, 400, -0.32
    readonly subheadline: DynamicTypeStyle; // 15 / 20, 400, -0.24
    readonly footnote: DynamicTypeStyle;    // 13 / 18, 400, -0.08
    readonly caption1: DynamicTypeStyle;    // 12 / 16, 400, 0.00 (98 usages orphelins résolus !)
    readonly caption2: DynamicTypeStyle;    // 11 / 13, 400, 0.07
  };
  readonly fontFamilies: {
    readonly sans: string;
    readonly display: string;
    readonly brand: string;
    readonly serif: string;
    readonly mono: string;
  };
}

export interface RadiusTokens {
  readonly xs: number;                // 12
  readonly sm: number;                // 16
  readonly md: number;                // 20
  readonly lg: number;                // 24
  readonly card: number;              // 28
  readonly hero: number;              // 38
  readonly sheet: number;             // 44
  readonly pill: number;              // 9999
  readonly concentricFloor: number;   // 20
}

export interface ZIndexTokens {
  readonly base: number;              // 1
  readonly sticky: number;            // 100
  readonly subbar: number;            // 200
  readonly tabbar: number;            // 300
  readonly hud: number;               // 400
  readonly sheet: number;             // 500
  readonly modal: number;             // 600 (corrige l'inversion 55 < 300/500)
  readonly alert: number;             // 700 (toasts, prompt, dynamic island)
}

export interface SpacingTokens {
  readonly 0: number;                 // 0px
  readonly 1: number;                 // 4px
  readonly 2: number;                 // 8px
  readonly 3: number;                 // 12px
  readonly 4: number;                 // 16px
  readonly 5: number;                 // 20px
  readonly 6: number;                 // 24px
  readonly 8: number;                 // 32px
  readonly 10: number;                // 40px
  readonly 12: number;                // 48px
  readonly 16: number;                // 64px
  readonly touchMin: number;          // 44px (iOS 44pt / Android 48dp)
  readonly tabBarHeight: number;       // 64px (--lkv-native-bar-height)
  readonly bottomClearance: number;   // 88px (hauteur barre + marge)
}

export interface MotionTokens {
  readonly duration: {
    readonly instant: string;         // 100ms
    readonly fast: string;            // 200ms
    readonly med: string;             // 300ms
    readonly slow: string;            // 450ms
  };
  readonly easing: {
    readonly snappy: string;          // cubic-bezier(0.19, 1, 0.22, 1)
    readonly bouncy: string;          // cubic-bezier(0.34, 1.56, 0.64, 1)
    readonly smooth: string;          // cubic-bezier(0.16, 1, 0.3, 1)
    readonly glass: string;           // cubic-bezier(0.22, 1, 0.36, 1)
    readonly out: string;             // cubic-bezier(0, 0, 0.2, 1)
    readonly emphasis: string;        // cubic-bezier(0.32, 0.72, 0, 1)
  };
  readonly pressScale: number;        // 0.97
}

export interface DesignBank {
  readonly surfaces: SurfaceTokens;
  readonly inks: InkTokens;
  readonly brand: BrandTokens;
  readonly glass: GlassTokens;
  readonly typography: TypographyTokens;
  readonly radii: RadiusTokens;
  readonly zIndex: ZIndexTokens;
  readonly spacing: SpacingTokens;
  readonly motion: MotionTokens;
}
```

Exports de `src/design/bank.ts` :
- `export const bank: DesignBank = { ... } as const;`
- `export default bank;`
- Named exports déstructurés : `export const surfaces = bank.surfaces;`, `export const inks = bank.inks;`, `export const brand = bank.brand;`, `export const glass = bank.glass;`, `export const typography = bank.typography;`, `export const radii = bank.radii;`, `export const zIndex = bank.zIndex;`, `export const spacing = bank.spacing;`, `export const motion = bank.motion;`.

---

### 3.2 Spécification des 5 Cibles Générées

#### Cible 1 : `src/styles/tokens.generated.css`
- **Format** : Fichier CSS standard, 1 seul bloc `:root`, zéro bloc `.dark`, zéro occurrence de `!important`.
- **Variables clés garanties** :
  - `--lkv-surface-canvas: #FBFAF6;`
  - `--lkv-surface: #F5F7F3;`
  - `--lkv-surface-card: #FFFFFF;`
  - `--lkv-surface-elevated: #FFFFFF;`
  - `--lkv-surface-grouped: #F0F5EE;`
  - `--lkv-surface-muted: #EDF1EA;`
  - `--lkv-text-primary: #172B24;`
  - `--lkv-text-secondary: #56665D;`
  - `--lkv-text-muted: #46584D;`
  - `--lkv-text-subtle: #8C9790;`
  - `--lkv-primary: #17402C;`
  - `--lkv-primary-hover: #205238;`
  - `--lkv-action: #226148;`
  - `--lkv-action-hover: #1B4F3A;`
  - `--lkv-secondary: #5B7F55;`
  - `--lkv-secondary-subtle: #D8E5D5;`
  - `--lkv-on-secondary-subtle: #17402C;`
  - `--glass-rim-color: rgba(23, 43, 36, 0.14);`
  - `--glass-rim-shadow: 0 0 0 0.5px rgba(23, 43, 36, 0.14);`
  - `--glass-rim: var(--glass-rim-color);`
  - `--glass-shadow: 0 10px 32px rgba(23, 64, 44, 0.12);`
  - `--g3-bg: #F0F5EE;`
  - `--g3-text: #172B24;`
  - `--z-base: 1;`
  - `--z-sticky: 100;`
  - `--z-subbar: 200;`
  - `--z-tabbar: 300;`
  - `--z-hud: 400;`
  - `--z-sheet: 500;`
  - `--z-modal: 600;`
  - `--z-alert: 700;`
  - `--z-toast: 700;`
  - Variables de Dynamic Type : `--lkv-text-caption-1: 12px;`, `--lkv-line-caption-1: 16px;`, `--lkv-text-body: 17px;`, etc.
  - Résolution des 35 orphelines : `--glass-secondary: rgba(240, 245, 238, 0.75);`, `--glass-specular: rgba(255, 255, 255, 0.75);`, `--bg-body: var(--lkv-surface-canvas);`.

#### Cible 2 : `src/design/tokens.generated.ts`
- **Format** : TypeScript typé avec des valeurs littérales prêtes pour Canvas 2D, SVG inline et MapLibre GL JS :
  ```typescript
  // src/design/tokens.generated.ts
  // Generated by scripts/generate-design-bank.mjs. DO NOT EDIT.
  export const canvasTokens = {
    brandPrimary: '#17402C',
    brandAction: '#226148',
    surfaceCanvas: '#FBFAF6',
    surfaceCard: '#FFFFFF',
    textPrimary: '#172B24',
    textSecondary: '#56665D',
  } as const;

  export const maplibreTokens = {
    routeTrackPrimary: '#226148',
    routeTrackMuted: '#5B7F55',
    routeTrackActive: '#17402C',
    markerBackground: '#FFFFFF',
    markerBorder: 'rgba(23, 43, 36, 0.14)',
    clusterBackground: '#226148',
    clusterText: '#FFFFFF',
  } as const;

  export const radiiTokens = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    card: 28,
    hero: 38,
    sheet: 44,
    pill: 9999,
  } as const;

  export const zIndexTokens = {
    base: 1,
    sticky: 100,
    subbar: 200,
    tabbar: 300,
    hud: 400,
    sheet: 500,
    modal: 600,
    alert: 700,
  } as const;
  ```

#### Cible 3 : `tailwind.preset.generated.js`
- **Format** : Module CommonJS :
  ```javascript
  // tailwind.preset.generated.js
  // Generated by scripts/generate-design-bank.mjs. DO NOT EDIT.
  module.exports = {
    theme: {
      extend: {
        colors: {
          brand: {
            primary: '#17402C',
            'primary-hover': '#205238',
            action: '#226148',
            'action-hover': '#1B4F3A',
            secondary: '#5B7F55',
            'secondary-hover': '#4A6B44',
            'primary-subtle': '#D3EBD9',
            'secondary-subtle': '#D8E5D5',
            'on-secondary-subtle': '#17402C',
          },
          surface: {
            canvas: '#FBFAF6',
            card: '#FFFFFF',
            grouped: '#F0F5EE',
            muted: '#EDF1EA',
          },
          ink: {
            primary: '#172B24',
            secondary: '#56665D',
            tertiary: '#46584D',
            quaternary: '#8C9790',
          },
        },
        borderRadius: {
          xs: '12px',
          sm: '16px',
          md: '20px',
          lg: '24px',
          card: '28px',
          hero: '38px',
          sheet: '44px',
          pill: '9999px',
        },
        zIndex: {
          base: '1',
          sticky: '100',
          subbar: '200',
          tabbar: '300',
          hud: '400',
          sheet: '500',
          modal: '600',
          alert: '700',
        },
        transitionTimingFunction: {
          'spring-snappy': 'cubic-bezier(0.19, 1, 0.22, 1)',
          'spring-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          'spring-smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
          glass: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      },
    },
  };
  ```

#### Cible 4 : `ios/App/App/DesignTokens.generated.swift`
- **Emplacement** : `ios/App/App/DesignTokens.generated.swift` (directement accessible par `SceneDelegate.swift` et les futures extensions widgets).
- **Contenu** :
  - Imports : `import UIKit` et `import SwiftUI`.
  - Helpers d'initialisation couleur hexadécimale intégrés (autonomes, zéro dépendance externe).
  - Énumération `public enum DesignTokens` avec :
    - `Colors` : expose `UIColor` et `Color` (SwiftUI) pour `brandPrimary`, `brandAction`, `surfaceCanvas`, `surfaceCard`, `labelPrimary`, `labelSecondary`, `glassRimColor`, etc.
    - `Radii` : `CGFloat` (`xs: 12`, `card: 28`, `sheet: 44`, etc.).
    - `Typography` : polices système Apple (`largeTitle`, `body`, `caption1`, etc.) pour `UIFont` et `Font`.
    - `Motion` : animations `Animation.interpolatingSpring` et durées.
    - `ZIndex` : niveaux entiers pour les sous-vues UIKit.

#### Cible 5 : Android Material 3
1. `android/app/src/main/res/values/design_tokens.generated.xml` :
   - Fichier ressource XML standard sous `<resources>` :
   - Balises `<color name="lkdv_brand_primary">#17402C</color>`, `<color name="lkdv_surface_canvas">#FBFAF6</color>`, etc.
   - Balises `<dimen name="lkdv_radius_card">28dp</dimen>`, `<dimen name="lkdv_touch_target_min">48dp</dimen>`.
2. `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt` :
   - Fichier Kotlin avec déclaration de package `package com.lekitduvoyageur.app`.
   - Objet `LKDVTokens` définissant les constantes ARGB (`const val BrandPrimary = 0xFF17402C`), dimensions en dp et typographies Material 3.

---

### 3.3 Architecture du Script `scripts/generate-design-bank.mjs`

Le générateur doit respecter les spécifications suivantes :

1. **Importation ESM de la source de vérité** :
   ```javascript
   import { bank } from '../src/design/bank.ts';
   import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
   import { resolve, dirname } from 'node:path';
   ```
2. **Support du mode `--check` (CI invariant)** :
   - Si l'argument `--check` est passé en ligne de commande, le script compare le contenu généré en mémoire avec les fichiers existants sur le disque. Si une différence existe, il quitte avec le code d'erreur `1` en affichant la liste des fichiers désynchronisés.
   - Si `--check` n'est pas passé, il écrit les fichiers atomiquement.
3. **Création récursive des répertoires parents** :
   - Utiliser `mkdirSync(dirname(targetPath), { recursive: true })` avant chaque écriture.
4. **Header standardisé sur tous les fichiers générés** :
   - `/* Generated by scripts/generate-design-bank.mjs. DO NOT EDIT. */` (ou équivalent `//` ou `<!-- ... -->`).

---

### 3.4 Intégration dans `package.json`

Ajout des scripts suivants dans `package.json` :
```json
{
  "scripts": {
    "design:generate": "node scripts/generate-design-bank.mjs",
    "design:check": "node scripts/generate-design-bank.mjs --check",
    "predev": "node scripts/generate-design-bank.mjs && node scripts/atlas/copy-maplibre-worker.mjs",
    "prebuild": "node scripts/generate-design-bank.mjs && node scripts/icons/build-sprite.mjs && node scripts/icons/build-heroicons-map.mjs && node scripts/atlas/copy-maplibre-worker.mjs && node scripts/verify/traveller_privacy.mjs && node scripts/verify/hub_no_mockup.mjs",
    "mobile:sync": "npm run design:generate && npx cap sync"
  }
}
```

---

## 4. Caveats & Points d'Attention pour l'Implémenteur

1. **Test `p5-direction-tokens.spec.ts` à réconcilier** :
   - Ce test vérifie actuellement la présence du bloc `.dark {` dans `tokens.css`. Lors du passage au 100% mode clair (suppression du bloc `.dark`), ce test échouera à la ligne 48 si sa suite de tests n'est pas ajustée pour valider le contrat clair strict (conformément au master plan §6.2).
2. **Garde-fous de gouvernance `unification.spec.ts` (U-D60 et U-D64)** :
   - La règle U-D60 vérifie qu'aucun hexadécimal n'existe hors `tokens.css` dans `STYLE_FILES`. Si `tokens.generated.css` est ajouté, `STYLE_FILES` ou la règle U-D60 doit désigner `tokens.generated.css` comme source autorisée.
   - La règle U-D64 interdit la déclaration de la même variable CSS dans deux fichiers différents. Si `tokens.css` importe `@import './tokens.generated.css';`, il ne doit pas redéclarer les variables en double.
3. **Test `task-2a-contrast.spec.ts` et `#lkdv-theme-init`** :
   - Ce test recherche `#lkdv-theme-init` dans `layout.tsx`. La suppression du script d'inversion sombre `#lkdv-theme-init` dans `layout.tsx` nécessitera la mise à jour correspondante du test.
4. **Conservation de `src/design/tokens.ts` pour la compatibilité descendante** :
   - Pour ne pas devoir refactoriser en masse les centaines d'appels `import { colors } from '@/design/tokens'`, `src/design/tokens.ts` doit continuer à exporter les accesseurs `var(--lkv-...)`, alignés sur les nouveaux noms de `tokens.generated.css`.

---

## 5. Conclusion

L'architecture de la Banque Unique (`src/design/bank.ts`) et de son générateur multi-cibles (`scripts/generate-design-bank.mjs`) est complètement explorée, validée et prête à être implémentée par l'agent de réalisation du Lot 1.  
Tous les prérequis d'infrastructure (existence des dossiers `ios/App/App/`, `android/app/src/main/res/values/`, exécution native TS dans Node 26.8.2, support des presets Tailwind) sont confirmés.

---

## 6. Verification Method (Méthode de Vérification Indépendante)

L'implémenteur ou le critique pourra vérifier l'implémentation complète avec la séquence de commandes suivantes :

```bash
# 1. Vérification de la génération multi-cibles
npm run design:generate

# 2. Vérification que les 5 fichiers cibles existent et sont non-vides
ls -lh src/styles/tokens.generated.css
ls -lh src/design/tokens.generated.ts
ls -lh tailwind.preset.generated.js
ls -lh ios/App/App/DesignTokens.generated.swift
ls -lh android/app/src/main/res/values/design_tokens.generated.xml
ls -lh android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt

# 3. Vérification du mode invariant (--check)
npm run design:check

# 4. Vérification de conformité CSS (1 seul :root, 0 .dark, 0 !important)
grep -c ":root" src/styles/tokens.generated.css        # Doit afficher 1
grep -c "\.dark" src/styles/tokens.generated.css       # Doit afficher 0
grep -c "!important" src/styles/tokens.generated.css   # Doit afficher 0
grep "\-\-z-modal" src/styles/tokens.generated.css     # Doit afficher --z-modal: 600;
grep "\-\-glass-rim-color" src/styles/tokens.generated.css # Doit afficher rgba(23, 43, 36, 0.14)

# 5. Contrôle TypeScript & Vitest
npm run type-check
npx vitest run tests/design/
```
