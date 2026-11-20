'use client';

import dynamic from 'next/dynamic';

/**
 * Chargeurs dynamiques côté client pour les vues legacy du Hub (`LKDV_HUB_LAYOUT=legacy`
 * ou `?phase=live|recount`), afin que Next.js n'inclue pas leurs chunks (~100 Ko gzip)
 * dans le JS initial de `/hub`.
 */
export const DynamicHubShell = dynamic(
  () => import('./HubShell').then((m) => ({ default: m.HubShell })),
  { ssr: false },
);
export const DynamicAdventureIntelligenceHub = dynamic(
  () => import('@/features/adventure-intelligence/ui').then((m) => ({ default: m.AdventureIntelligenceHub })),
  { ssr: false },
);
export const DynamicItineraryAdventureCockpit = dynamic(
  () => import('./mobile/itinerary/ItineraryAdventureCockpit').then((m) => ({ default: m.ItineraryAdventureCockpit })),
  { ssr: false },
);
export const DynamicHubCampShell = dynamic(
  () => import('./HubCampShell').then((m) => ({ default: m.HubCampShell })),
  { ssr: false },
);
export const DynamicHubResumeBanner = dynamic(
  () => import('./HubResumeBanner').then((m) => ({ default: m.HubResumeBanner })),
  { ssr: false },
);
export const DynamicSortieMenu = dynamic(
  () => import('./menu/SortieMenu').then((m) => ({ default: m.SortieMenu })),
  { ssr: false },
);
export const DynamicPossessionMenu = dynamic(
  () => import('./menu/PossessionMenu').then((m) => ({ default: m.PossessionMenu })),
  { ssr: false },
);
export const DynamicCollectifMenu = dynamic(
  () => import('./menu/CollectifMenu').then((m) => ({ default: m.CollectifMenu })),
  { ssr: false },
);
export const DynamicPhaseLiveView = dynamic(
  () => import('./menu/PhaseViews').then((m) => ({ default: m.PhaseLiveView })),
  { ssr: false },
);
export const DynamicPhaseRecountView = dynamic(
  () => import('./menu/PhaseViews').then((m) => ({ default: m.PhaseRecountView })),
  { ssr: false },
);
