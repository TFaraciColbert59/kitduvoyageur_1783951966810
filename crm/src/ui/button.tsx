import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './crm.module.css';
import { cx } from './cx';
import { Kbd } from './kbd';

export type ButtonTone = 'pg' | 'soft' | 'bad';

const TONE: Record<ButtonTone, string> = { pg: s.btnPg, soft: s.btnSoft, bad: s.btnBad };

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: 'md' | 'sm';
  shortcut?: string;
  icon?: ReactNode;
  block?: boolean;
};

/** Bouton en verre teinté (jamais de couleur primaire pleine). Cible ≥ 44 px. */
export function Button({
  tone = 'soft',
  size = 'md',
  shortcut,
  icon,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cx(s.btn, TONE[tone], size === 'sm' && s.btnSm, block && s.btnWide, className)}
      {...rest}
    >
      {icon}
      {children}
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </button>
  );
}
