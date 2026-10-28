'use client';

import React from 'react';
import { AccountRoundButton } from '@/components/account/AccountRoundButton';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetTopBarProps {
  title: string;
  coverImage: string | null;
  saved: boolean;
  scrolled?: boolean;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
  onMenu: () => void;
  onTitleClick: () => void;
  /** Menu ··· rendu sous son bouton (même ancrage que le Compte). */
  menu?: React.ReactNode;
}

/**
 * Top bar du Compte transposée : retour rond 38, pilule titre (cover 24 +
 * titre 12,5/700), trois `.gbtn` 38 à droite. Hauteur 52 + safe area.
 */
export function CarnetTopBar({
  title,
  coverImage,
  saved,
  scrolled = false,
  onBack,
  onShare,
  onSave,
  onMenu,
  onTitleClick,
  menu = null,
}: CarnetTopBarProps) {
  return (
    <div className="ckp-topbar" data-scrolled={scrolled ? 'true' : 'false'}>
      <span className="ckp-topbar-veil" aria-hidden="true" />

      <div className="ckp-top-left">
        <AccountRoundButton label="Retour" onClick={onBack}>
          <LKDVIcon name="retour" size={18} aria-hidden="true" />
        </AccountRoundButton>

        <button type="button" className="ckp-title-pill" onClick={onTitleClick} title={title}>
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- couverture distante, même source que la carte
            <img className="ckp-title-cover" src={coverImage} alt="" />
          ) : (
            <span className="ckp-title-cover ckp-title-cover--empty" aria-hidden="true">
              {title.charAt(0).toUpperCase()}
            </span>
          )}
          <b>{title}</b>
        </button>
      </div>

      <div className="ckp-top-actions">
        <AccountRoundButton label="Partager" onClick={onShare}>
          <LKDVIcon name="partager" size={17} aria-hidden="true" />
        </AccountRoundButton>
        <AccountRoundButton label="Enregistrer" onClick={onSave} pressed={saved}>
          <LKDVIcon name="signet" size={17} aria-hidden="true" />
        </AccountRoundButton>
        <span className="ckp-more-anchor">
          <AccountRoundButton label="Options du carnet" onClick={onMenu}>
            <LKDVIcon name="plus_options" size={18} aria-hidden="true" />
          </AccountRoundButton>
          {menu}
        </span>
      </div>
    </div>
  );
}

export default CarnetTopBar;
