'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import './action-pill.css';

export type ActionPillTone = 'glass' | 'primary' | 'danger';

export interface ActionPillProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Nom lu par les lecteurs d'écran et affiché au survol : la pilule n'a souvent qu'une icône. */
  label: string;
  icon: React.ReactNode;
  /** Texte court visible à côté de l'icône, seulement quand l'icône seule serait ambiguë. */
  text?: string;
  tone?: ActionPillTone;
  busy?: boolean;
}

/**
 * Pilule d'action des drawers : petite, légère, icône d'abord. Même gabarit que
 * la pilule des formulaires de la Communauté (40 × 32, cible tactile 44 px).
 */
export function ActionPill({
  label,
  icon,
  text,
  tone = 'glass',
  busy = false,
  className = '',
  disabled,
  ...props
}: ActionPillProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      className={`lkdv-apill is-${tone}${text ? ' has-text' : ''} ${className}`.trim()}
      aria-label={label}
      title={props.title ?? label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
    >
      {busy ? <Loader2 size={16} className="lkdv-apill-spin" aria-hidden="true" /> : icon}
      {text ? <span>{text}</span> : null}
    </button>
  );
}

/** Même pilule pour un lien. */
export function ActionPillLink({
  label,
  icon,
  text,
  tone = 'glass',
  className = '',
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  label: string;
  icon: React.ReactNode;
  text?: string;
  tone?: ActionPillTone;
}) {
  return (
    <a
      {...props}
      className={`lkdv-apill is-${tone}${text ? ' has-text' : ''} ${className}`.trim()}
      aria-label={label}
      title={props.title ?? label}
    >
      {icon}
      {text ? <span>{text}</span> : null}
    </a>
  );
}

export default ActionPill;
