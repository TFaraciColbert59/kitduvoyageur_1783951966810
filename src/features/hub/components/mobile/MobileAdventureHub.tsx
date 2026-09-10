import type { ReactNode } from 'react';
import { SectionCarousel } from './SectionCarousel';
import { InfoChipsRow } from './InfoChipsRow';
import type { MobileInfoChip, MobileSectionTile } from '../../mobile/mobileHubEngine';

export interface MobileAdventureHubProps {
  action?: ReactNode;
  tiles: MobileSectionTile[];
  chips: MobileInfoChip[];
  children?: ReactNode;
}

export function MobileAdventureHub({ action, tiles, chips, children }: MobileAdventureHubProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 pt-1 pb-1 lg:hidden">
      {action}
      <SectionCarousel tiles={tiles} />
      <InfoChipsRow chips={chips} />
      {children}
    </div>
  );
}

export default MobileAdventureHub;
