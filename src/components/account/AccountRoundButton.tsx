'use client';

import React from 'react';

export interface AccountRoundButtonProps {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  /** État d'un bouton à bascule (Enregistrer de la fiche carnet). */
  pressed?: boolean;
}

/** Bouton rond 38 px du Compte (`.gbtn`), verre clair. */
export function AccountRoundButton({
  label,
  onClick,
  children,
  className = '',
  pressed,
}: AccountRoundButtonProps) {
  return (
    <button
      type="button"
      className={`gbtn ${className}`.trim()}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default AccountRoundButton;
