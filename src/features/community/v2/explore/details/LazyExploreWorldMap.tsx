'use client';

import dynamic from 'next/dynamic';

/**
 * Perf : MapLibre (~800 Ko) n'est chargé qu'à l'ouverture du sous-volet
 * « Carte ». Les listes horizontales d'Explorer restent légères.
 */
export const ExploreWorldMap = dynamic(
  () => import('./ExploreWorldMap').then((m) => ({ default: m.ExploreWorldMap })),
  {
    ssr: false,
    loading: () => <div className="lkdv-cv2x-world-map" aria-busy="true" />,
  },
);

export default ExploreWorldMap;
