import type { CSSProperties } from 'react';

/**
 * Styles partagés du lot C03. Aucune couleur littérale : uniquement les
 * tokens `--lkv-*`. Les cibles tactiles sont à 44 px minimum.
 */
export const palette = {
  text: 'var(--lkv-text-primary)',
  secondary: 'var(--lkv-text-secondary)',
  muted: 'var(--lkv-text-muted)',
  surface: 'var(--lkv-surface-card)',
  surfaceMuted: 'var(--lkv-surface-muted)',
  border: 'var(--lkv-border)',
  borderStrong: 'var(--lkv-border-strong)',
  primary: 'var(--lkv-primary)',
  onPrimary: 'var(--lkv-on-primary)',
  primarySoft: 'var(--lkv-primary-soft)',
  danger: 'var(--lkv-danger)',
  dangerBg: 'var(--lkv-danger-bg)',
  success: 'var(--lkv-success)',
  warning: 'var(--lkv-warning-dark)',
  focus: 'var(--lkv-focus-ring)',
} as const;

export const panelStyle: CSSProperties = {
  background: palette.surface,
  color: palette.text,
  border: `1px solid ${palette.border}`,
  borderRadius: 'var(--lkv-radius-card)',
  boxShadow: '0 24px 64px rgba(11, 31, 23, 0.24)',
};

export const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  background: 'var(--lkv-overlay-scrim)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

export const sheetStyle: CSSProperties = {
  ...panelStyle,
  width: 'min(560px, 100%)',
  maxHeight: '88dvh',
  overflowY: 'auto',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  padding: '8px 20px calc(20px + var(--safe-bottom, 0px))',
  outline: 'none',
};

export const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 0 12px',
  position: 'sticky',
  top: 0,
  background: palette.surface,
  zIndex: 1,
};

export const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 650,
  letterSpacing: '-0.02em',
  color: palette.text,
};

export const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: palette.secondary,
};

export const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
  color: palette.text,
};

export const helperStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: palette.secondary,
};

export const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 'var(--lkv-radius-button)',
  border: `1px solid ${palette.borderStrong}`,
  background: palette.surface,
  color: palette.text,
  font: 'inherit',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

export const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: palette.primary,
  borderColor: palette.primary,
  color: palette.onPrimary,
};

export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  color: palette.danger,
  borderColor: palette.danger,
  background: palette.dangerBg,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 'var(--lkv-radius-control)',
  border: `1px solid ${palette.border}`,
  background: palette.surfaceMuted,
  color: palette.text,
  font: 'inherit',
  fontSize: 14,
  boxSizing: 'border-box',
};

export const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 28,
  padding: '2px 10px',
  borderRadius: 'var(--lkv-radius-full)',
  border: `1px solid ${palette.border}`,
  background: palette.surfaceMuted,
  color: palette.secondary,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
};

export const photoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
  gap: 8,
};

export const photoStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  borderRadius: 'var(--lkv-radius-md)',
  border: `1px solid ${palette.border}`,
  background: palette.surfaceMuted,
};

export const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 0',
  borderTop: `1px solid ${palette.border}`,
};

export const iconButtonStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 'var(--lkv-radius-full)',
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  color: palette.text,
  fontSize: 18,
  cursor: 'pointer',
};

export const sectionGapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingBottom: 8,
};
