import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HubAssistantCta } from './HubAssistantCta';
import { OverviewBlocks } from './blocks';
import {
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import { activitySectionLabel } from '../engine/activityProfiles';
import { selectOverviewBlocks } from '../engine/widgetContext';
import type { AdventureProfile } from '../engine/hubProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../server/getHubAdventureData';

export interface HubOverviewSortieProps {
  profile: AdventureProfile;
  trip: TripFull;
  countdown: number | null;
  group: HubCrewBlock | null;
  hiking: HubHikingContext | null;
}

/**
 * H3.4 + H-ACT §6 — Aperçu sortie composé par le profil d'activité.
 * Randonnée et voyage produisent deux tableaux de bord clairement différents
 * à partir de la même coquille : blocs d'aperçu sélectionnés par le catalogue
 * central, puis grille de sections (libellés spécialisés par activité).
 */
export function HubOverviewSortie({ profile, trip, countdown, group, hiking }: HubOverviewSortieProps) {
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };
  const activityType = profile.activityType ?? 'travel';
  const blocks = selectOverviewBlocks(trip, activityType, group, hiking);
  const sections = visibleHubSections(profile);

  const hikeLabel = activityType === 'hiking' ? 'Randonnée active' : 'Voyage actif';

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          {hikeLabel}
          {countdown !== null && countdown >= 0 ? ` · J-${countdown}` : ''}
        </p>
        <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)] mt-1">
          {trip.title}
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-1">
          {trip.destination_name ?? trip.destination_country_code ?? 'Destination à définir'}
          {trip.status ? ` · ${trip.status}` : ''}
        </p>
      </header>

      {blocks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {blocks.map((block) =>
            block.id === 'cta-randonnee-active' ? (
              <div key={block.id} className="sm:col-span-2">
                <OverviewBlocks blocks={[block]} trip={trip} group={group} hiking={hiking} />
              </div>
            ) : (
              <OverviewBlocks key={block.id} blocks={[block]} trip={trip} group={group} hiking={hiking} />
            ),
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubAssistantCta contextLabel={`Conseils pour ${trip.title}`} />
        {sections
          .filter((d) => d.id !== 'overview')
          .map((def) => {
            const Icon = def.icon;
            return (
              <Link
                key={def.id}
                href={hubSectionHref(ref, def.id)}
                className="glass p-4 rounded-[var(--lkv-radius-card)] flex items-center gap-3 min-h-[44px]"
              >
                <Icon size={18} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold text-[var(--lkv-text-primary)]">
                  {activitySectionLabel(activityType, def.id, def.label)}
                </span>
                <ArrowRight size={14} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
              </Link>
            );
          })}
      </div>
    </div>
  );
}

export default HubOverviewSortie;