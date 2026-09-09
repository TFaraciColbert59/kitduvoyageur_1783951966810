import { MenuBack } from './MenuBack';
import { SosFloatingButton } from './SosFloatingButton';
import { TripLiveCockpitView } from '@/features/trips/components/TripLiveCockpitView';
import { TripPhaseRecountView } from '@/features/trips/components/TripPhaseRecountView';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import { hubSectionHref } from '../../registry/hubSectionRegistry';

/** Vue de phase « En cours » (cockpit terrain) — accès depuis le MENU. */
export function PhaseLiveView({
  trip,
  stats,
  dayIndex,
  totalDays,
}: {
  trip: TripFull;
  stats: TripStats;
  dayIndex: number | null;
  totalDays: number | null;
}) {
  return (
    <div className="space-y-3">
      <MenuBack />
      <TripLiveCockpitView trip={trip} stats={stats} dayIndex={dayIndex} totalDays={totalDays} />
      <SosFloatingButton
        safetyHref={hubSectionHref({ nature: 'sortie', slug: trip.slug }, 'safety')}
      />
    </div>
  );
}

/** Vue de phase « Raconter » — accès depuis le MENU. */
export function PhaseRecountView({ trip }: { trip: TripFull }) {
  return (
    <div className="space-y-3">
      <MenuBack />
      <TripPhaseRecountView trip={trip} />
    </div>
  );
}