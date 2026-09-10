import type { ReactNode } from 'react';
import { SectionCarousel } from './SectionCarousel';
import { InfoChipsRow } from './InfoChipsRow';
import type { MobileInfoChip, MobileSectionTile } from '../../mobile/mobileHubEngine';

export interface MobileAdventureHubProps {
  action?: ReactNode;
  tiles: MobileSectionTile[];
  chips: MobileInfoChip[];
  children?: ReactNode;
  /** Plein écran sans scroll : le moment (carte) remplit l'espace restant. */
  fill?: boolean;
}

export function MobileAdventureHub({ action, tiles, chips, children, fill = false }: MobileAdventureHubProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-4 pt-1 pb-1 lg:hidden ${
        fill ? 'h-full min-h-0 flex-1' : ''
      }`}
    >
      {action}
      <SectionCarousel tiles={tiles} />
      <InfoChipsRow chips={chips} />
      <div className={fill ? 'flex min-h-0 flex-1 flex-col' : undefined}>{children}</div>
    </div>
  );
}

export default MobileAdventureHub;
