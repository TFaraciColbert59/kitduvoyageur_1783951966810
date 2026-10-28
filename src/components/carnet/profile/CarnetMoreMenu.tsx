'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetMoreMenuProps {
  open: boolean;
  saved: boolean;
  isOwner: boolean;
  onSave: () => void;
  onShare: () => void;
  onCopy: () => void;
  onReport: () => void;
  onManage: () => void;
  onClose: () => void;
}

/** Menu `···` du Compte : 226 px, lignes 44 px, même verre. */
export function CarnetMoreMenu({
  open,
  saved,
  isOwner,
  onSave,
  onShare,
  onCopy,
  onReport,
  onManage,
  onClose,
}: CarnetMoreMenuProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="pmi-options-menu" role="group" aria-label="Options du carnet" hidden={!open}>
      <button type="button" onClick={run(onSave)}>
        <LKDVIcon name="signet" size={18} aria-hidden="true" />
        <span>{saved ? 'Retirer des enregistrements' : 'Enregistrer'}</span>
      </button>
      <button type="button" onClick={run(onShare)}>
        <LKDVIcon name="partager" size={18} aria-hidden="true" />
        <span>Partager</span>
      </button>
      <button type="button" onClick={run(onCopy)}>
        <LKDVIcon name="lien" size={18} aria-hidden="true" />
        <span>Copier le lien</span>
      </button>
      {isOwner ? (
        <button type="button" onClick={run(onManage)}>
          <LKDVIcon name="modifier" size={18} aria-hidden="true" />
          <span>Gérer le carnet</span>
        </button>
      ) : null}
      <button type="button" className="pmi-report" onClick={run(onReport)}>
        <LKDVIcon name="signalement" size={18} aria-hidden="true" />
        <span>Signaler</span>
      </button>
    </div>
  );
}

export default CarnetMoreMenu;
