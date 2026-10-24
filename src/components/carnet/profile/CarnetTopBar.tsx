'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { AccountRoundButton } from '@/components/account/AccountRoundButton';

export interface CarnetTopBarProps {
  title: string;
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
 * Barre du haut du Compte : retour rond 38, puis la pilule d'identité
 * (34 px, 700/16, bord 1 px, fond .14, sans vignette) et trois `.gbtn` 38.
 */
export function CarnetTopBar({
  title,
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
