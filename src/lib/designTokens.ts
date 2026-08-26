// Design tokens extracted from Design-tokens.md v2.0
export const COLORS = {
  FOREGROUND_900: '#17402C', // Primary foreground
  FOREGROUND_800: '#17402C', // CTA primary background
  FOREGROUND_700: '#365233',
  SAGE_500: '#5B7F55',
  SAGE_100: '#EDF3ED',
  STONE: '#FBFAF6',
  INK_300: '#5A7064',
  INK_TRANSPARENT: 'rgba(23,64,44,0.5)',
};
export const FOREGROUND_900 = COLORS.FOREGROUND_900;
export const FOREGROUND_800 = COLORS.FOREGROUND_800;
export const SAGE_100 = COLORS.SAGE_100;
export const STONE_100 = COLORS.STONE;

export const RADIUS = {
  CARD: 16,
  SMALL_CARD: 14,
  CTA: 12,
  PILL: 999,
  CONTAINER_MAX: 20,
};

export const SHADOW = {
  LEVEL1: '0 2px 8px rgba(23,64,44,0.04)',
  LEVEL2: '0 8px 24px rgba(23,64,44,0.08)',
  LEVEL3: '0 12px 30px rgba(23,64,44,0.12)',
};

export const shadow = (level: number) => SHADOW[`LEVEL${level}` as keyof typeof SHADOW] || SHADOW.LEVEL1;

export const CTA = {



  PRIMARY: {
    background: COLORS.FOREGROUND_800,
    color: COLORS.STONE,
    minHeight: 44,
    borderRadius: RADIUS.CTA,
    paddingY: 10,
    paddingX: 12,
  },
  SECONDARY: {
    background: COLORS.SAGE_100,
    color: COLORS.FOREGROUND_800,
    borderRadius: RADIUS.CTA,
    minHeight: 44,
    paddingY: 10,
    paddingX: 12,
  },
};
