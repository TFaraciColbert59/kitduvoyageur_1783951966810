'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { AccountRoundButton } from '@/components/account/AccountRoundButton';

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
          <Icon name="arrow-left" size={18} aria-hidden="true" />
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
          <Icon name="send" size={17} aria-hidden="true" />
        </AccountRoundButton>
        <AccountRoundButton label="Enregistrer" onClick={onSave} pressed={saved}>
          <Icon name="bookmark" size={17} aria-hidden="true" />
        </AccountRoundButton>
        <span className="ckp-more-anchor">
          <AccountRoundButton label="Options du carnet" onClick={onMenu}>
            <Icon name="more-horizontal" size={18} aria-hidden="true" />
          </AccountRoundButton>
          {menu}
        </span>
      </div>
    </div>
  );
}

export default CarnetTopBar;
