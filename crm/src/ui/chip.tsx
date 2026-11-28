import type { ReactNode } from 'react';
import s from './crm.module.css';
import { cx } from './cx';

export type ChipTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';

const TONE: Record<ChipTone, string> = {
  sage: s.chipSage,
  warn: s.chipWarn,
  danger: s.chipDanger,
  info: s.chipInfo,
  stone: s.chipStone
};

const DOT: Record<ChipTone, string> = {
  sage: s.dotSuccess,
  warn: s.dotWarn,
  danger: s.dotDanger,
  info: s.dotInfo,
  stone: s.dot
};

/** Pastille d'état. La couleur ne porte jamais seule le sens : le texte dit l'état. */
export function Chip({
  tone = 'stone',
  dot = false,
  title,
  children
}: {
  tone?: ChipTone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx(s.chip, TONE[tone])} title={title}>
      {dot ? <span className={cx(s.dot, DOT[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
