'use client';

import { CompasSheet, type Detent } from '../components/CompasSheet';
import { SheetContent, sheetTitle } from '../components/CompasSheets';
import type { CompasCtl, SheetState } from '../components/compasTypes';

/**
 * Héberge les parcours éprouvés de l'écran actuel (réglages du voyage, fiche objet, achat, sac d'une personne…)
 * dans le nouvel écran, sans les réécrire : ce que le contrôleur ouvre s'affiche en tiroir classique par-dessus.
 * La racine `.compas` apporte les jetons `--cp-*` dont ces tiroirs dépendent ; `v5-legacy` la détache de la mise
 * en page (plein écran, sans fond, seuls le tiroir et son voile reçoivent les gestes).
 */
export function LegacyHost({
  top,
  ctl,
  depth,
  onDetent,
  onClose,
  onBack,
  outdoor,
}: {
  top: { sheet: SheetState; detent: Detent };
  ctl: CompasCtl;
  depth: number;
  onDetent: (d: Detent) => void;
  onClose: () => void;
  onBack?: () => void;
  outdoor: boolean;
}) {
  return (
    <div className="compas v5-legacy" data-outdoor={outdoor ? '1' : undefined}>
      <CompasSheet key={depth} title={sheetTitle(top.sheet, ctl, ctl.t)} detent={top.detent} onDetent={onDetent} onClose={onClose} onBack={onBack}>
        <SheetContent sheet={top.sheet} ctl={ctl} />
      </CompasSheet>
    </div>
  );
}
