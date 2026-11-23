import type { SheetTab } from '@/features/explorer-v2/sheet/ExplorerSheet';
import { AnalyserTab } from './AnalyserTab';
import { DepartTab } from './DepartTab';
import { EquipeTab } from './EquipeTab';
import { EtapesTab } from './EtapesTab';
import { TracerTab } from './TracerTab';

export { AnalyserTab, DepartTab, EquipeTab, EtapesTab, TracerTab };

/**
 * Les 5 onglets du tiroir principal (`ExplorerSheet`), dans l'ordre d'affichage. En solo (4.8) l'onglet
 * « Équipe » devient « Inviter » : rien d'inutile tant qu'on est seul, seulement de quoi faire venir quelqu'un.
 */
export function mainTabs(solo: boolean): SheetTab[] {
  return [
    { id: 'tracer', label: 'Tracer', icon: 'route', render: () => <TracerTab /> },
    { id: 'etapes', label: 'Étapes', icon: 'flag', render: () => <EtapesTab /> },
    { id: 'analyser', label: 'Analyser', icon: 'pulse', render: () => <AnalyserTab /> },
    solo
      ? { id: 'equipe', label: 'Inviter', icon: 'users', render: () => <EquipeTab /> }
      : { id: 'equipe', label: 'Équipe', icon: 'users', render: () => <EquipeTab /> },
    { id: 'depart', label: 'Départ', icon: 'pack', render: () => <DepartTab /> },
  ];
}

/** Rangs fixes : l'ordre des onglets ne change pas avec le mode solo. */
export const MAIN_TABS: SheetTab[] = mainTabs(false);
