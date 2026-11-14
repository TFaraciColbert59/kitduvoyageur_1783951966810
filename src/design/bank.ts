/**
 * src/design/bank.ts — Source de vérité unique du Design System LKDV
 * 100 % Mode Clair Liquid Glass — Pure Palette Verte LKDV, Zéro noir (#000/#101010/#121815)
 *
 * Tous les jetons Web, iOS (Swift / UIKit / SwiftUI) et Android (Kotlin / Material 3)
 * sont dérivés de cet objet maître via scripts/generate-design-bank.mjs.
 */

export interface SurfaceTokens {
  readonly canvas: string;          // Fond d'écran / toile claire (#FBFAF6)
  readonly sauge: string;           // Sauge très pâle (#F5F7F3)
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
  readonly onAction: string;        // Blanc sur action (#FFFFFF)
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
    readonly success: StatusColor;
    readonly warning: StatusColor;
    readonly danger: StatusColor;
    readonly info: StatusColor;
  };
}

export interface GlassLevel {
  readonly bg: string;
  readonly blur: string;
  readonly sat: string;
}

export interface GlassTokens {
  readonly clear: GlassLevel;            // g1 clear: rgba(255, 255, 255, 0.65), blur 12px
  readonly regular: GlassLevel;          // g2 regular: rgba(255, 255, 255, 0.85), blur 24px
  readonly prominent: GlassLevel & { readonly reducedBg: string; readonly text: string }; // g3 prominent: #EBF2EC / rgba(235, 242, 236, 0.88), blur 36px, text #172B24
  readonly capsule: GlassLevel;          // gc capsule: rgba(255, 255, 255, 0.72), blur 20px
  readonly g1?: GlassLevel;
  readonly g2?: GlassLevel;
  readonly g3?: GlassLevel & { readonly reducedBg: string; readonly text: string };
  readonly gc?: GlassLevel;
  readonly rimColor: string;          // rgba(23, 43, 36, 0.14)
  readonly rimShadow: string;         // 0 0 0 0.5px rgba(23, 43, 36, 0.14)
  readonly rimInner: string;          // inset 0 0 0 0.5px rgba(255, 255, 255, 0.65)
  readonly highlight: string;         // inset 0 1px 0 rgba(255, 255, 255, 0.75)
  readonly shadow: string;            // 0 10px 32px rgba(23, 64, 44, 0.12)
  readonly shadowElevated: string;    // 0 16px 48px rgba(23, 64, 44, 0.16)
}

export interface DynamicTypeStyle {
  readonly size: number;              // px
  readonly lineHeight: number;        // px
  readonly weight: 400 | 500 | 600 | 700;
  readonly tracking: number;          // px
}

export interface TypographyTokens {
  readonly styles: {
    readonly largeTitle: DynamicTypeStyle;
    readonly title1: DynamicTypeStyle;
    readonly title2: DynamicTypeStyle;
    readonly title3: DynamicTypeStyle;
    readonly headline: DynamicTypeStyle;
    readonly body: DynamicTypeStyle;
    readonly callout: DynamicTypeStyle;
    readonly subheadline: DynamicTypeStyle;
    readonly footnote: DynamicTypeStyle;
    readonly caption1: DynamicTypeStyle;
    readonly caption2: DynamicTypeStyle;
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
  readonly modal: number;             // 600
  readonly alert: number;             // 700
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
  readonly touchMinApple: number;     // 44px
  readonly touchMinAndroid: number;   // 48dp
  readonly navHeight: number;         // 60px
  readonly tabBarHeight: number;      // 64px
  readonly bottomClearance: number;   // 88px
}

export interface MotionTokens {
  readonly duration: {
    readonly instant: string;         // 100ms
    readonly fast: string;            // 200ms
    readonly med: string;             // 300ms
    readonly slow: string;            // 450ms
  };
  readonly easing: {
    readonly snappy: string;
    readonly bouncy: string;
    readonly smooth: string;
    readonly glass: string;
    readonly out: string;
    readonly emphasis: string;
  };
  readonly pressScale: number;        // 0.97
}

export interface GhostVariablesCatalog {
  readonly [variableName: string]: string;
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
  readonly ghosts: GhostVariablesCatalog;
}

export const bank: DesignBank = {
  surfaces: {
    canvas: '#FBFAF6',
    sauge: '#F5F7F3',
    canvasFallback: '#F5F7F3',
    canvasVoile: 'rgba(242, 246, 243, 0.78)',
    surfaceElevated: '#FFFFFF',
    surfaceGrouped: '#F0F5EE',
    surfaceMuted: '#EDF1EA',
    border: 'rgba(23, 43, 36, 0.12)',
    borderSubtle: 'rgba(23, 43, 36, 0.06)',
    borderStrong: 'rgba(23, 43, 36, 0.24)',
    fieldBg: 'rgba(255, 255, 255, 0.70)',
    fieldBorder: 'rgba(23, 43, 36, 0.15)',
  },
  inks: {
    labelPrimary: '#172B24',
    labelSecondary: '#56665D',
    labelTertiary: '#46584D',
    labelQuaternary: '#8C9790',
    onBrand: '#FFFFFF',
    onAction: '#FFFFFF',
    onMedia: '#FFFFFF',
    scrim: 'rgba(16, 28, 23, 0.42)',
  },
  brand: {
    primary: '#17402C',
    primaryHover: '#205238',
    primarySoft: '#365233',
    action: '#226148',
    actionHover: '#1B4F3A',
    secondary: '#5B7F55',
    secondaryHover: '#4A6B44',
    primarySubtle: '#D3EBD9',
    secondarySubtle: '#D8E5D5',
    onSecondarySubtle: '#17402C',
    onAction: '#FFFFFF',
    status: {
      success: { fg: '#3D6038', bg: '#EAF3E9', border: '#B4D4B0' },
      warning: { fg: '#8F671E', bg: '#FBF1DC', border: '#E8CF96' },
      danger: { fg: '#85261E', bg: '#F5DDD9', border: '#DFA8A1' },
      info: { fg: '#2C4C5E', bg: '#DDE7EE', border: '#A3BDCC' },
    },
  },
  glass: {
    clear: {
      bg: 'rgba(255, 255, 255, 0.65)',
      blur: '12px',
      sat: '180%',
    },
    regular: {
      bg: 'rgba(255, 255, 255, 0.85)',
      blur: '24px',
      sat: '180%',
    },
    prominent: {
      bg: 'rgba(235, 242, 236, 0.88)',
      reducedBg: '#EBF2EC',
      text: '#172B24',
      blur: '36px',
      sat: '190%',
    },
    capsule: {
      bg: 'rgba(255, 255, 255, 0.72)',
      blur: '20px',
      sat: '180%',
    },
    rimColor: 'rgba(23, 43, 36, 0.14)',
    rimShadow: '0 0 0 0.5px rgba(23, 43, 36, 0.14)',
    rimInner: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.65)',
    highlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.75)',
    shadow: '0 10px 32px rgba(23, 64, 44, 0.12)',
    shadowElevated: '0 16px 48px rgba(23, 64, 44, 0.16)',
  },
  typography: {
    styles: {
      largeTitle:  { size: 34, lineHeight: 41, weight: 700, tracking: 0.37 },
      title1:      { size: 28, lineHeight: 34, weight: 700, tracking: 0.36 },
      title2:      { size: 22, lineHeight: 28, weight: 700, tracking: 0.35 },
      title3:      { size: 20, lineHeight: 25, weight: 600, tracking: 0.38 },
      headline:    { size: 17, lineHeight: 22, weight: 600, tracking: -0.41 },
      body:        { size: 17, lineHeight: 22, weight: 400, tracking: -0.41 },
      callout:     { size: 16, lineHeight: 21, weight: 400, tracking: -0.32 },
      subheadline: { size: 15, lineHeight: 20, weight: 400, tracking: -0.24 },
      footnote:    { size: 13, lineHeight: 18, weight: 400, tracking: -0.08 },
      caption1:    { size: 12, lineHeight: 16, weight: 400, tracking: 0.00 },
      caption2:    { size: 11, lineHeight: 13, weight: 400, tracking: 0.07 },
    },
    fontFamilies: {
      sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif",
      display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      brand: "'Manrope', -apple-system, sans-serif",
      serif: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
      mono: "'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
  },
  radii: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    card: 28,
    hero: 38,
    sheet: 44,
    pill: 9999,
    concentricFloor: 20,
  },
  zIndex: {
    base: 1,
    sticky: 100,
    subbar: 200,
    tabbar: 300,
    hud: 400,
    sheet: 500,
    modal: 600,
    alert: 700,
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    touchMinApple: 44,
    touchMinAndroid: 48,
    navHeight: 60,
    tabBarHeight: 64,
    bottomClearance: 88,
  },
  motion: {
    duration: {
      instant: '100ms',
      fast: '200ms',
      med: '300ms',
      slow: '450ms',
    },
    easing: {
      snappy: 'var(--ease-emphasis)',
      bouncy: 'var(--ease-spring)',
      smooth: 'var(--ease-smooth)',
      glass: 'var(--ease-glass)',
      out: 'var(--ease-out)',
      emphasis: 'var(--ease-emphasis)',
    },
    pressScale: 0.97,
  },
  ghosts: {
    '--lkv-text-caption-1': '12px',
    '--lkv-line-caption-1': '16px',
    '--glass-secondary': '#56665D',
    '--glass-specular': 'inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 2px 8px rgba(23, 64, 44, 0.06)',
    '--bg-body': '#FBFAF6',
    '--lkv-native-bar-height': '64px',
    '--glass-bg-subtle': 'rgba(240, 245, 238, 0.70)',
    '--glass-bg-prominent': 'rgba(235, 242, 236, 0.95)',
    '--glass-bg-base': 'rgba(255, 255, 255, 0.72)',
    '--z-nav': '300',
    '--lkv-radius-pill': '9999px',
    '--lkv-surface-primary': '#FFFFFF',
    '--lkv-font-mono': '"IBM Plex Mono", SFMono-Regular, monospace',
    '--white-glass': 'rgba(255, 255, 255, 0.78)',
    '--kb-inset': 'env(keyboard-inset-height, 0px)',
    '--shell-top-padding': 'calc(env(safe-area-inset-top, 0px) + 12px)',
    '--cookie-banner-h': '0px',
    '--font-inter': '"Inter", -apple-system, sans-serif',
    '--font-sf': '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    '--lkv-warn': '#D97706',
    '--lkv-like': '#E11D48',
    '--forest-500': '#3D6038',
    '--lkv-text': '#172B24',
    '--cv2-layer-z': '1',
    '--post-pill-top': '12px',
    '--post-pill-h': '32px',
    '--lkv-sheet-from': 'translateY(100%)',
    '--lkdv-text-scale': '1',
    '--lkdv-a11y-map-min-height': '280px',
    '--explorer-carousel-height': '140px',
    '--msg-split': '360px',
    '--space-7': '28px',
    '--lkdv-cd-kb': 'env(keyboard-inset-height, 0px)',
    '--result-tone': '#17402C',
    '--lkdv-progress': '0%',
    '--card-radius': '28px',
  },
} as const;

export default bank;

export const surfaces = bank.surfaces;
export const inks = bank.inks;
export const brand = bank.brand;
export const glass = bank.glass;
export const typography = bank.typography;
export const radii = bank.radii;
export const zIndex = bank.zIndex;
export const spacing = bank.spacing;
export const motion = bank.motion;
export const ghosts = bank.ghosts;
