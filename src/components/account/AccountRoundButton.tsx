'use client';

import React from 'react';

export interface AccountRoundButtonProps {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

/** Bouton rond 38 px du Compte (`.gbtn`), verre clair. */
export function AccountRoundButton({
  label,
  onClick,
  children,
  className = '',
}: AccountRoundButtonProps) {
  return (
    <button
      type="button"
      className={`gbtn ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default AccountRoundButton;
