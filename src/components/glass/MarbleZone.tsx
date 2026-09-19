'use client';

import { useEffect } from 'react';

/**
 * Zone « toile marbrée » : surfaces posées directement sur l'image de fond.
 * Sur ces écrans, le contenu des cartes .glass suit le matériau clair
 * (texte blanc via --card-content) ; les puits clairs (.glass-sub-card)
 * restent sombres. Un seul attribut document, posé au montage de l'écran.
 */
let marbleCount = 0;

export function MarbleZone() {
  useEffect(() => {
    marbleCount += 1;
    document.documentElement.setAttribute('data-lkv-marble', '');
    return () => {
      marbleCount = Math.max(0, marbleCount - 1);
      if (marbleCount === 0) document.documentElement.removeAttribute('data-lkv-marble');
    };
  }, []);
  return null;
}

export default MarbleZone;
