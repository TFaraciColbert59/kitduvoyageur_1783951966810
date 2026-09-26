import type { ReactNode } from 'react';
import { SectionCarousel } from './SectionCarousel';
import { InfoChipsRow } from './InfoChipsRow';
import { HubEdgeDrawer } from './HubEdgeDrawer';
import ProgressionCompactCard from '@/components/progression/ProgressionCompactCard';
import type { MobileInfoChip, MobileSectionTile } from '../../mobile/mobileHubEngine';

export interface MobileAdventureHubProps {
  /**
   * Carte d etat (NextActionCard compact) — sortie du flux : tiroir droit.
   * Elle neVit plus dans la colonne, elle ouvre au bord de l ecran.
   */
  statusSlot?: ReactNode;
  /** Carte « Ma progression » — idem, tiroir droit. */
  progressionSlot?: ReactNode;
  tiles: MobileSectionTile[];
  chips: MobileInfoChip[];
  children?: ReactNode;
  /** Plein ecran sans scroll : le moment (carte) remplit l espace restant. */
  fill?: boolean;
}

/**
 * Hub mobile — le flux ne porte plus que l essentiel : tuiles de sections,
 * chips d infos et moment (carte). Tout l etat annexe (etat, progression) est
 * delegate aux tiroirs lateraux : la carte du moment remonte d autant.
 */
export function MobileAdventureHub({
  statusSlot,
  progressionSlot,
  tiles,
  chips,
  children,
  fill = false,
}: MobileAdventureHubProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-4 pt-1 pb-1 lg:hidden ${
        fill ? 'h-full min-h-0 flex-1' : ''
      }`}
    >
      {statusSlot ? (
        <HubEdgeDrawer kind="status" slot="top" label="État" title="État de l’aventure">
          {statusSlot}
        </HubEdgeDrawer>
      ) : null}
      <HubEdgeDrawer kind="progression" slot="mid" label="Points" title="Ma progression">
        {progressionSlot ?? <ProgressionCompactCard variant="drawer" />}
      </HubEdgeDrawer>
      <SectionCarousel tiles={tiles} />
      <InfoChipsRow chips={chips} />
      <div className={fill ? 'flex min-h-0 flex-1 flex-col' : undefined}>{children}</div>
    </div>
  );
}

export default MobileAdventureHub;
