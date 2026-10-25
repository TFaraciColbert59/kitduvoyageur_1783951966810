'use client';

import dynamicImport from 'next/dynamic';
import { ShimmerBlock } from '@/components/ui-layouts/shimmer-loader';

/**
 * P0-4 — Vues clientes des sections du hub, découpées dynamiquement.
 * Pattern prouvé dans le dépôt (MobileNavWrapper → BottomTabBar) :
 * un composant client par vue, `ssr: false`, SANS option loading.
 * Alias dynamicImport : piège documenté CLAUDE.md.
 */
const SectionFallback = (
  <div className="space-y-2.5" aria-busy="true">
    <div className="glass rounded-3xl min-h-[420px] p-4 space-y-3">
      <ShimmerBlock className="w-1/3" />
      <ShimmerBlock className="w-full" />
      <ShimmerBlock className="w-4/5" />
      <ShimmerBlock className="w-2/3" />
    </div>
  </div>
);

export function SectionLoading() {
  return SectionFallback;
}

export const ItineraryPlannerClient = dynamicImport(
  () => import('@/features/trips/planner/ItineraryPlannerClient'),
  { ssr: false }
);
export const ItineraryMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/itinerary/ItineraryMobileExperience').then((m) => ({ default: m.ItineraryMobileExperience })),
  { ssr: false }
);
export const TripTeamView = dynamicImport(
  () => import('@/features/trips/components/TripTeamView').then((m) => ({ default: m.TripTeamView })),
  { ssr: false }
);
export const ParticipantsManager = dynamicImport(
  () => import('@/features/participants/components/ParticipantsManager').then((m) => ({ default: m.ParticipantsManager })),
  { ssr: false }
);
export const TeamMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/team/TeamMobileExperience').then((m) => ({ default: m.TeamMobileExperience })),
  { ssr: false }
);
export const ChecklistMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/checklist/ChecklistMobileExperience').then((m) => ({ default: m.ChecklistMobileExperience })),
  { ssr: false }
);
export const DocsMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/docs/DocsMobileExperience').then((m) => ({ default: m.DocsMobileExperience })),
  { ssr: false }
);
export const SafetyMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/safety/SafetyMobileExperience').then((m) => ({ default: m.SafetyMobileExperience })),
  { ssr: false }
);
export const JournalMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/journal/JournalMobileExperience').then((m) => ({ default: m.JournalMobileExperience })),
  { ssr: false }
);
export const TripBudgetView = dynamicImport(
  () => import('@/features/trips/components/TripBudgetView').then((m) => ({ default: m.TripBudgetView })),
  { ssr: false }
);
export const TripDocumentsView = dynamicImport(
  () => import('@/features/trips/components/TripDocumentsView').then((m) => ({ default: m.TripDocumentsView })),
  { ssr: false }
);
export const TripChecklistView = dynamicImport(
  () => import('@/features/trips/components/TripChecklistView').then((m) => ({ default: m.TripChecklistView })),
  { ssr: false }
);
export const TripSafetyView = dynamicImport(
  () => import('@/features/trips/components/TripSafetyView').then((m) => ({ default: m.TripSafetyView })),
  { ssr: false }
);
export const TripNotesView = dynamicImport(
  () => import('@/features/trips/components/TripNotesView').then((m) => ({ default: m.TripNotesView })),
  { ssr: false }
);
export const TripExportView = dynamicImport(
  () => import('@/features/trips/components/TripExportView'),
  { ssr: false }
);
export const ExportMobileExperience = dynamicImport(
  () => import('@/features/hub/components/mobile/export/ExportMobileExperience').then((m) => ({ default: m.ExportMobileExperience })),
  { ssr: false }
);
export const HubGroupeCockpit = dynamicImport(
  () => import('@/features/hub/components/collectif/HubGroupeCockpit').then((m) => ({ default: m.HubGroupeCockpit })),
  { ssr: false }
);
