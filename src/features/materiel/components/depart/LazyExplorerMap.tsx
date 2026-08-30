'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import type { MapTrail } from '@/components/explorer/types';

const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full min-h-[140px] md:min-h-[220px] animate-pulse bg-stone-200/60 rounded-[var(--r-lg)]"
      aria-hidden="true"
    />
  ),
});

/** W-D-1 Carte centrale — déplacement natif activé via touch-action pan-x pan-y.
 *  Cliquer sur le tracé (ligne, point de départ ou pastille km) ouvre le préparateur.
 *  La géolocalisation auto est désactivée ici pour ne pas parasiter le cockpit départ. */
export function LazyExplorerMap({ trail }: { trail: MapTrail | null }) {
  const router = useRouter();
  const handleTrailClick = (t: MapTrail) => {
    if (Number.isFinite(Number(t.id))) {
      router.push(`/materiel/depart/none?route=${t.id}`);
    }
  };

  return (
    <GlassCard
      as="article"
      tone="sage"
      ariaLabelledBy="depart-map-title"
      // Pas de overflow-hidden ici — bloquait la propagation des événements touch Leaflet
      className="p-0"
    >
      <h3 id="depart-map-title" className="sr-only">Carte de la randonnée du départ</h3>
      {trail ? (
        // touch-action natif : pan libre sur la carte sans bloquer Framer Motion sur les autres widgets
        <div
          className="h-full w-full rounded-[var(--r-lg)] overflow-hidden"
          style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        >
          <ExplorerMap
            trails={[trail]}
            selectedTrailId={trail.id}
            onTrailClick={handleTrailClick}
            compact
            disableGeolocate
          />
        </div>
      ) : (
        <div className="h-full w-full min-h-[140px] md:min-h-[220px] flex items-center justify-center text-sm text-[color:var(--label-tertiary)] rounded-[var(--r-lg)]">
          Aucune randonnée disponible.
        </div>
      )}
    </GlassCard>
  );
}