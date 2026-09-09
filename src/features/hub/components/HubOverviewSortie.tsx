'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { OverviewBlocks } from './blocks';
import { HubActivityHero } from './HubActivityHero';
import { selectOverviewBlocks } from '../engine/widgetContext';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
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

const PHASE_HUB_LABELS: Record<TripPhase, string> = {
  prepare: 'Préparer',
  live: 'En cours',
  recount: 'Raconter',
};

/**
 * UX Hub — Aperçu sortie refondu : le hub n'est plus un carrefour de liens.
 * Hero de l'activité (cover, titre, phase, J-xx, actions) puis widgets vitaux
 * composés par le catalogue central (Phase 1). La navigation des sections vit
 * dans la sidebar gauche — plus aucune grille de liens ici.
 */
export function HubOverviewSortie({ profile, trip, countdown, group, hiking }: HubOverviewSortieProps) {
  const reduceMotion = useReducedMotion();
  const activityType = profile.activityType ?? 'travel';
  const blocks = selectOverviewBlocks(trip, activityType, group, hiking);

  const phase = getTripPhaseDetails(trip).phase;
  const badgeLabel = activityType === 'hiking' ? 'Randonnée' : 'Voyage';
  const subtitle =
    trip.destination_name ?? trip.destination_country_code ?? 'Destination à définir';

  return (
    <div className="space-y-4">
      <HubActivityHero
        title={trip.title}
        subtitle={subtitle}
        coverUrl={trip.cover_image_url}
        daysUntil={countdown}
        phaseLabel={PHASE_HUB_LABELS[phase]}
        badgeLabel={badgeLabel}
        assistantContextLabel={`Conseils pour ${trip.title}`}
      />

      {blocks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {blocks.map((block) =>
            block.id === 'cta-randonnee-active' ? (
              <motion.div
                key={block.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="sm:col-span-2"
              >
                <OverviewBlocks blocks={[block]} trip={trip} group={group} hiking={hiking} />
              </motion.div>
            ) : (
              <motion.div
                key={block.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <OverviewBlocks blocks={[block]} trip={trip} group={group} hiking={hiking} />
              </motion.div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export default HubOverviewSortie;
