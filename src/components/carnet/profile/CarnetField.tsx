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
  /** Erreur de la donnée : liseré 1 px `#C13B34`, aucun bandeau. */
  error?: boolean;
  /** Message de l'erreur : 11/500 `#C13B34` sous la ligne, jamais un bandeau. */
  errorMessage?: string;
  /** Champ d'action sans donnée : la colonne de valeur disparaît. */
  showValue?: boolean;
  /** Valeur longue (lien) : la colonne fixe s'élargit, toujours ellipsée. */
  wide?: boolean;
  /**
   * Valeur longue qui se reconnaît par sa fin (un lieu : `…Landmannalaugar`) :
   * l'ellipse se fait au milieu, jamais du seul côté droit. Le texte complet
   * reste dans le DOM, dans `aria-label` et dans `title`.
   */
  mid?: boolean;
  /**
   * Nom accessible complet. Le libellé visible reste un placeholder court ;
   * c'est ici que la phrase utile aux lecteurs d'écran est portée.
   */
  ariaLabel?: string;
  title?: string;
}

/**
 * Ligne de donnée du drawer : une ligne de 48 px sans cadre, le libellé en
 * placeholder à gauche (13/500 `#6B7A70`, 46 % de large au plus, ellipse) et la
 * valeur à droite dans une colonne fixe de 120 px (13/500 tabulaire,
 * `#172B24`). Une donnée absente n'est jamais un vide : c'est `—` en
 * `#B4BDB6`. Le chevron n'est peint que sur une ligne qui navigue (lien
 * interne) ; une erreur ajoute un liseré de 1 px et son message de 11 px sous
 * la ligne.
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
  errorMessage,
  showValue = true,
  wide,
  mid,
  ariaLabel,
  title,
}: CarnetFieldProps) {
  const missing = value === undefined || value === null || value === '';
  const className = [
    'ckp-field',
    tone === 'danger' ? 'ckp-field--danger' : null,
    missing ? 'is-missing' : null,
    wide ? 'ckp-field--wide' : null,
    mid ? 'ckp-field--mid' : null,
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
  /* 26 — chevron seulement si la ligne navigue : un lien interne. Une
     destination externe garde son glyphe d'ouverture, fourni par l'appelant. */
  const navigates = Boolean(href && href.startsWith('/'));

  const withMessage = (node: React.ReactNode) => {
    if (!error || !errorMessage) return node;
    return (
      <div className="ckp-field-wrap">
        {node}
        <span className="ckp-field-error" role="alert">
          {errorMessage}
        </span>
      </div>
    );
  };

  if (onClick) {
    return withMessage(
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
        {navigates ? <Chevron /> : null}
      </button>,
    );
  }

  if (href) {
    return withMessage(
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel ?? label}
        title={title ?? (typeof value === 'string' ? value : label)}
        {...state}
      >
        {inner}
        {navigates ? <Chevron /> : null}
      </a>,
    );
  }

  return withMessage(
    <div
      className={className}
      aria-label={ariaLabel}
      title={title ?? (typeof value === 'string' ? value : label)}
      {...state}
    >
      {inner}
      {navigates ? <Chevron /> : null}
    </div>,
  );
}

/** Chevron de navigation : 16 px, `#56665D`, jamais un glyphe décoratif nu. */
function Chevron() {
  return (
    <span className="ckp-field-chevron" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export default CarnetField;
