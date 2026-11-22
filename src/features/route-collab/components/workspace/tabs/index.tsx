import type { SheetTab } from '@/features/explorer-v2/sheet/ExplorerSheet';
import { AnalyserTab } from './AnalyserTab';
import { DepartTab } from './DepartTab';
import { EquipeTab } from './EquipeTab';
import { EtapesTab } from './EtapesTab';
import { TracerTab } from './TracerTab';

export { AnalyserTab, DepartTab, EquipeTab, EtapesTab, TracerTab };

/** Les 5 onglets du tiroir principal (`ExplorerSheet`), dans l'ordre d'affichage. */
export const MAIN_TABS: SheetTab[] = [
  { id: 'tracer', label: 'Tracer', icon: 'route', render: () => <TracerTab /> },
  { id: 'etapes', label: 'Étapes', icon: 'flag', render: () => <EtapesTab /> },
  { id: 'analyser', label: 'Analyser', icon: 'pulse', render: () => <AnalyserTab /> },
  { id: 'equipe', label: 'Équipe', icon: 'users', render: () => <EquipeTab /> },
  { id: 'depart', label: 'Départ', icon: 'pack', render: () => <DepartTab /> },
];
