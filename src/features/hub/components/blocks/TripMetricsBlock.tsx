import { Calendar, Navigation, Package, CreditCard } from 'lucide-react';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import { getCanonicalTripSteps } from '@/features/trips/hooks/useTripCounters';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';

/**
 * H-ACT — Bloc "Métriques vitales" de l'aperçu sortie (adapté de
 * TripOverviewTab, Z-R3 : tout dérivé de trip, stats pour le budget).
 * Liens registre uniquement (jamais de /hub/ littéral — R13).
 */
export function TripMetricsBlock({ trip, stats, slug }: { trip: TripFull; stats: TripStats; slug: string }) {
  const duration = getTripDuration(trip);
  const kit = getKitCounters(trip.items);
  const dist = getTripDistance(trip.steps);
  const steps = getCanonicalTripSteps(trip.steps);
  const packedPercent = kit.total > 0 ? Math.round((kit.ready / kit.total) * 100) : 0;
  const ref: HubAdventureRef = { nature: 'sortie', slug };

  const cardClass =
    'glass p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xs min-h-[88px] flex flex-col';
  const headClass =
    'flex items-center gap-1.5 text-[var(--lkv-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <a href={hubSectionHref(ref, 'itinerary')} className={`${cardClass} cursor-pointer hover:bg-white/60 transition-colors`}>
          <div className={headClass}>
            <Calendar size={13} aria-hidden="true" />
            <span>Durée</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {duration.durationDays} {duration.durationDays > 1 ? 'jours' : 'jour'}
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">{steps.length} étapes prévues</div>
        </a>

        <a href={hubSectionHref(ref, 'itinerary')} className={`${cardClass} cursor-pointer hover:bg-white/60 transition-colors`}>
          <div className={headClass}>
            <Navigation size={13} aria-hidden="true" />
            <span>Distance</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">{dist.totalKm} km</div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5 font-mono">
            +{dist.dPlus}m / -{dist.dMinus}m D±
          </div>
        </a>

        <a href={hubSectionHref(ref, 'gear')} className={`${cardClass} cursor-pointer hover:bg-white/60 transition-colors`}>
          <div className={headClass}>
            <Package size={13} aria-hidden="true" />
            <span>Sac à dos</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">{packedPercent}%</div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">{kit.ready}/{kit.total} objets prêts</div>
        </a>

        <a href={hubSectionHref(ref, 'budget')} className={`${cardClass} cursor-pointer hover:bg-white/60 transition-colors`}>
          <div className={headClass}>
            <CreditCard size={13} aria-hidden="true" />
            <span>Budget</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {stats.total_spent} {trip.budget_currency || 'EUR'}
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
            sur {stats.estimated_budget > 0 ? `${stats.estimated_budget} ${trip.budget_currency || 'EUR'}` : 'non défini'}
          </div>
        </a>
      </div>
    </div>
  );
}

export default TripMetricsBlock;
