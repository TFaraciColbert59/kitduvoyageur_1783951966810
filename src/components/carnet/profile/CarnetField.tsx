'use client';

import React from 'react';

export interface CarnetFieldProps {
  /**
   * Libellé du champ — un placeholder, jamais une phrase. L'unité y vit
   * (`Distance (km)`) et n'est jamais répétée à droite.
   */
  label: string;
  /** Valeur réelle, déjà formatée. Absente ou vide → `—` en placeholder. */
  value?: React.ReactNode;
  /** Icône 16 px à gauche, seulement quand elle aide (départ, arrivée, trace). */
  icon?: React.ReactNode;
  /** Champ d'action : bouton. */
  onClick?: () => void;
  /** Champ d'action : lien sortant (Partage). */
  href?: string;
  /** Bascule : état pressé, rendu par `aria-pressed`. */
  pressed?: boolean;
  disabled?: boolean;
  /** Action destructive : réserve `#C13B34` au liseré et à l'encre. */
  tone?: 'default' | 'danger';
  /** Erreur de la donnée : bordure 1 px `#C13B34`, aucun bandeau. */
  error?: boolean;
  /** Champ d'action sans donnée : la colonne de valeur disparaît. */
  showValue?: boolean;
  /** Valeur longue (lien) : la colonne fixe s'élargit, toujours ellipsée. */
  wide?: boolean;
  /**
   * Nom accessible complet. Le libellé visible reste un placeholder court ;
   * c'est ici que la phrase utile aux lecteurs d'écran est portée.
   */
  ariaLabel?: string;
  title?: string;
}

/**
 * Ligne de donnée du drawer : un champ visuel de 48 px (rayon 12, fond
 * `rgba(255,255,255,.55)`), le libellé en placeholder à gauche (12/500
 * `#8A968D`, 46 % de large au plus, ellipse) et la valeur à droite dans une
 * colonne fixe de 120 px (13/600 tabulaire, `#172B24`). Une donnée absente
 * n'est jamais un vide : c'est `—` en `#B4BDB6`. Aucun chevron.
 */
export function CarnetField({
  label,
  value,
  icon,
  onClick,
  href,
  pressed,
  disabled,
  tone = 'default',
  error,
  showValue = true,
  wide,
  ariaLabel,
  title,
}: CarnetFieldProps) {
  const missing = value === undefined || value === null || value === '';
  const className = [
    'ckp-field',
    tone === 'danger' ? 'ckp-field--danger' : null,
    missing ? 'is-missing' : null,
    wide ? 'ckp-field--wide' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {icon ? (
        <span className="ckp-field-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ckp-field-label">{label}</span>
      {showValue ? <span className="ckp-field-value">{missing ? '—' : value}</span> : null}
    </>
  );

  const state = { 'data-error': error ? 'true' : undefined } as const;

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={typeof pressed === 'boolean' ? pressed : undefined}
        aria-label={ariaLabel ?? (missing ? `${label} —` : `${label} ${typeof value === 'string' ? value : ''}`.trim())}
        title={title ?? label}
        {...state}
      >
        {inner}
      </button>
    );
  }

  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel ?? label}
        title={title ?? label}
        {...state}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className={className}
      aria-label={ariaLabel}
      {...state}
    >
      {inner}
    </div>
  );
}

export default CarnetField;
