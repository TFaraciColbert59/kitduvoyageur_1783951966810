'use client';

import { useEffect } from 'react';

/**
 * Ferme une feuille au clavier. `OverlaySheet` ne câble pas `Échap` (la
 * maquette Compte le fait au niveau du runtime) : la fiche carnet s'en charge
 * pour ne pas dépendre de ce runtime.
 */
export function useSheetEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
}

export default useSheetEscape;
