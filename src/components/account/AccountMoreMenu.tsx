'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface AccountMoreMenuProps {
  open: boolean;
  saved: boolean;
  onSave: () => void;
  onRepublish: () => void;
  onCopy: () => void;
  onReport: () => void;
}

/**
 * Menu `···` du post Compte : Enregistrer, Republier, Copier le lien, Signaler.
 * Même largeur (226 px), même verre, mêmes libellés.
 */
export function AccountMoreMenu({
  open,
  saved,
  onSave,
  onRepublish,
  onCopy,
  onReport,
}: AccountMoreMenuProps) {
  return (
    <div
      className="pmi-options-menu"
      id="pmi_options_menu"
      role="group"
      aria-label="Options de la publication"
      hidden={!open}
    >
      <button type="button" onClick={onSave}>
        <LKDVIcon name="signet" size={18} aria-hidden="true" />
        <span>{saved ? 'Retirer des enregistrements' : 'Enregistrer'}</span>
      </button>
      <button type="button" onClick={onRepublish}>
        <LKDVIcon name="partager" size={18} aria-hidden="true" />
        <span>Republier</span>
      </button>
      <button type="button" onClick={onCopy}>
        <LKDVIcon name="lien" size={18} aria-hidden="true" />
        <span>Copier le lien</span>
      </button>
      <button type="button" className="pmi-report" onClick={onReport}>
        <LKDVIcon name="signalement" size={18} aria-hidden="true" />
        <span>Signaler</span>
      </button>
    </div>
  );
}

export default AccountMoreMenu;
