import type { RouteSheetTab } from '../chrome/RouteSheet';
import { AnalyserTab } from './AnalyserTab';
import { DepartTab } from './DepartTab';
import { EquipeTab } from './EquipeTab';
import { EtapesTab } from './EtapesTab';
import { TracerTab } from './TracerTab';

export { AnalyserTab, DepartTab, EquipeTab, EtapesTab, TracerTab };

/**
 * Les 5 onglets du tiroir principal (`RouteSheet`, coquille du tiroir du Compas v5), dans l'ordre d'affichage. En solo (4.8) l'onglet
 * « Équipe » devient « Inviter » : rien d'inutile tant qu'on est seul, seulement de quoi faire venir quelqu'un.
 */
export function mainTabs(solo: boolean): RouteSheetTab[] {
  return [
    { id: 'tracer', label: 'Tracer', icon: 'route', render: () => <TracerTab /> },
    { id: 'etapes', label: 'Étapes', icon: 'flag', render: () => <EtapesTab /> },
    { id: 'analyser', label: 'Analyser', icon: 'timeline', render: () => <AnalyserTab /> },
    solo
      ? { id: 'equipe', label: 'Inviter', icon: 'people', render: () => <EquipeTab /> }
      : { id: 'equipe', label: 'Équipe', icon: 'people', render: () => <EquipeTab /> },
    { id: 'depart', label: 'Départ', icon: 'bag', render: () => <DepartTab /> },
  ];
}

/** Rangs fixes : l'ordre des onglets ne change pas avec le mode solo. */
export const MAIN_TABS: RouteSheetTab[] = mainTabs(false);
