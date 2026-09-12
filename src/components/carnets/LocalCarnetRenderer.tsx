'use client';

import { useEffect, useState } from 'react';
import CarnetView from '@/components/carnet/CarnetView';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';
import Link from 'next/link';

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
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-3 border-[#17402C]/20 border-t-[#17402C] rounded-full animate-spin"></div>
        <p className="text-xs font-mono font-bold text-[#5C6B5E] uppercase tracking-widest">Chargement du carnet...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="text-6xl">🏔️</div>
        <div className="space-y-2">
          <h1 className="font-display font-800 text-3xl text-[#17402C]">Carnet introuvable</h1>
          <p className="text-sm text-[#5C6B5E] max-w-md mx-auto">
            Ce carnet n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
        <Link href="/carnets" className="px-6 py-3 bg-[#17402C] text-white rounded-full text-xs font-bold transition-colors">
          Retour aux carnets
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-50 bg-[#8C6418] text-white text-[11px] font-bold text-center py-2 px-4">
        Brouillon local non publié — ce contenu n&apos;est pas enregistré sur le serveur LKDV.
      </div>
      <CarnetView data={data} />
    </div>
  );
}
