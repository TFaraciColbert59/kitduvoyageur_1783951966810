'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { OverviewBlocks } from './blocks';
import { HubActivityHero } from './HubActivityHero';
import { selectOverviewBlocks } from '../engine/widgetContext';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import { TripPhaseController } from '@/features/trips/components/TripPhaseController';
import { TripLiveCockpitView } from '@/features/trips/components/TripLiveCockpitView';
import { TripPhaseRecountView } from '@/features/trips/components/TripPhaseRecountView';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import type { AdventureProfile } from '../engine/hubProfileEngine';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../server/getHubAdventureData';

export interface HubOverviewSortieProps {
  profile: AdventureProfile;
  trip: TripFull;
  stats: TripStats;
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
 * Hero de l'activité (cover, titre, phase, J-xx, actions) puis contrôle de
 * phase (Préparer / Vivre / Raconter — TripPhaseController réintégré) qui
 * commute la surface : cockpit terrain (TripLiveCockpitView) en phase live,
 * bilan (TripPhaseRecountView) en recount, widgets vitaux en préparation.
 */
export function HubOverviewSortie({ profile, trip, stats, countdown, group, hiking }: HubOverviewSortieProps) {
  const reduceMotion = useReducedMotion();
  const activityType = profile.activityType ?? 'travel';
  const phaseDetails = getTripPhaseDetails(trip);
  const naturalPhase = phaseDetails.phase;
  const [activePhase, setActivePhase] = useState<TripPhase>(naturalPhase);
  const [shareOpen, setShareOpen] = useState(false);
  const blocks = selectOverviewBlocks(trip, activityType, group, hiking);

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
        phaseLabel={PHASE_HUB_LABELS[activePhase]}
        badgeLabel={badgeLabel}
        assistantContextLabel={`Conseils pour ${trip.title}`}
        onShareClick={() => setShareOpen(true)}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <TripPhaseController
          activePhase={activePhase}
          naturalPhase={naturalPhase}
          onPhaseChange={setActivePhase}
          dayIndex={phaseDetails.dayIndex}
          totalDays={phaseDetails.totalDays}
          daysUntilStart={countdown}
        />
      </motion.div>

      {activePhase === 'live' ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <TripLiveCockpitView
            trip={trip}
            stats={stats}
            dayIndex={phaseDetails.dayIndex}
            totalDays={phaseDetails.totalDays}
          />
        </motion.div>
      ) : activePhase === 'recount' ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <TripPhaseRecountView trip={trip} />
        </motion.div>
      ) : blocks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {blocks.map((block) =>
            block.id === 'metriques-voyage' || block.id === 'cta-randonnee-active' ? (
              <motion.div
                key={block.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="sm:col-span-2"
              >
                <OverviewBlocks blocks={[block]} trip={trip} group={group} hiking={hiking} stats={stats} />
              </motion.div>
            ) : (
              <motion.div
                key={block.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <OverviewBlocks blocks={[block]} trip={trip} group={group} hiking={hiking} stats={stats} />
              </motion.div>
            ),
          )}
        </div>
      ) : null}

      <TripShareModal trip={trip} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

export default HubOverviewSortie;
