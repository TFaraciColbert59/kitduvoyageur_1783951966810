'use client';

import { useEffect, useState } from 'react';
import CarnetView from '@/components/carnet/CarnetView';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';
import Link from 'next/link';
import { EmptyState, LoadingState } from '@/components/ui';

/**
 * Ancien rendu des brouillons stockés localement avant la Phase 7.
 * Ces brouillons locaux ne sont jamais présentés comme des carnets serveur :
 * ils sont explicitement étiquetés « brouillon local » et ne fabriquent
 * aucune donnée manquante.
 */
export default function LocalCarnetRenderer({ id }: { id: string }) {
  const [data, setData] = useState<CarnetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const decodedId = decodeURIComponent(id);
      const localCarnets = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
      const found = Array.isArray(localCarnets)
        ? localCarnets.find((c: any) => c.id === id || c.title === decodedId || c.title === id || c.id === decodedId)
        : null;

      if (found) {
        setData({
          id: found.id || id,
          meta: {
            badge: `BROUILLON LOCAL · ${(found.destination || found.title || 'SANS TITRE').toUpperCase()}`,
            titleLine1: found.title || 'Brouillon sans titre',
            titleLine2: '',
            subtitleLine1: found.description || '',
            subtitleLine2: '',
            voyageurs: found.nb_voyageurs || 1,
            dateRange: found.created_at
              ? new Date(found.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              : '',
            itineraire: found.destination || '',
          },
          stats: [
            ...(found.distance_km ? [{ value: `${found.distance_km} km`, label: 'DISTANCE' }] : []),
            ...(found.elevation_m ? [{ value: `${found.elevation_m} m`, label: 'DÉNIVELÉ +' }] : []),
          ],
          jours: Array.isArray(found.jours)
            ? found.jours.map((j: any) => ({
                id: j.id,
                dayNumber: j.dayNumber,
                label: j.label || `JOUR ${j.dayNumber}`,
                title: j.title || '',
                titleItalic: j.titleItalic || '',
                recit: j.recit || '',
                stats: Array.isArray(j.stats) ? j.stats : [],
              }))
            : [],
          hebergements: Array.isArray(found.hebergements) ? found.hebergements : [],
          moments: Array.isArray(found.moments) ? found.moments : [],
          kit: {
            intro: found.kit?.intro || '',
            totalWeight: found.kit?.totalWeight || '',
            items: Array.isArray(found.kit?.items) ? found.kit.items : [],
          },
          randonnees: Array.isArray(found.randonnees) ? found.randonnees : [],
        });
      }
    } catch (e) {
      console.error('Error reading local carnet:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-[var(--space-6)]">
        <LoadingState label="Chargement du carnet..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-[var(--space-6)] text-center">
        <EmptyState
          icon={<span className="text-[length:var(--lkv-text-title-lg)]" aria-hidden>🏔️</span>}
          title="Carnet introuvable"
          description="Ce carnet n'existe pas ou n'est plus disponible."
        />
        <Link
          href="/carnets"
          className="mt-[var(--space-4)] inline-flex min-h-[var(--control-height-md)] items-center rounded-full bg-[color:var(--lkv-primary)] px-[var(--space-6)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]"
        >
          Retour aux carnets
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--lkv-warning-dark)] px-[var(--space-4)] py-[var(--space-2)] text-center text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]">
        Brouillon local non publié — ce contenu n&apos;est pas enregistré sur le serveur LKDV.
      </div>
      <CarnetView data={data} />
    </div>
  );
}
