'use client';

import { useEffect, useState } from 'react';
import CarnetView from '@/components/carnet/CarnetView';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';
import Link from 'next/link';

export default function LocalCarnetRenderer({ id }: { id: string }) {
  const [data, setData] = useState<CarnetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const decodedId = decodeURIComponent(id);
      const localCarnets = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
      const found = localCarnets.find((c: any) => c.id === id || c.title === decodedId || c.title === id || c.id === decodedId);
      
      if (found) {
        const distStr = found.distance_km ? `${found.distance_km} km` : undefined;
        const elevStr = found.elevation_m ? `${found.elevation_m} m D+` : undefined;

        setData({
          meta: {
            badge: `CARNET OUVERT · ${(found.destination || found.title || 'EXPÉDITION').toUpperCase()}`,
            titleLine1: found.title || 'Carnet local',
            titleLine2: '',
            subtitleLine1: found.description || '',
            subtitleLine2: '',
            voyageurs: found.nb_voyageurs || 1,
            dateRange: found.created_at ? new Date(found.created_at).toLocaleDateString('fr-FR') : '',
            itineraire: found.destination || found.title || '',
          },
          stats: [
            { value: distStr || '', label: 'DISTANCE', hidden: !distStr },
            { value: elevStr || '', label: 'DÉNIVELÉ +', hidden: !elevStr },
          ].filter((s) => !s.hidden),
          jours: [
            { 
              id: 'j1', 
              dayNumber: 1, 
              label: 'JOUR 1', 
              title: found.lieu_depart ? `${found.lieu_depart} → ` : 'Départ → ', 
              titleItalic: found.lieu_arrivee || 'Arrivée', 
              recit: found.description || 'Récit de cette étape...', 
              stats: [
                { icon: '📏', label: distStr || '' },
                { icon: '⛰', label: elevStr || '' },
              ].filter((s) => Boolean(s.label))
            }
          ],
          hebergements: [],
          moments: [],
          kit: { intro: found.description ? 'Sac d\'expédition préparé pour ce carnet.' : '', totalWeight: '', items: [] },
          randonnees: []
        });
      }
    } catch (e) {
      console.error("Error reading local carnet:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2E8] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-[#2D5A3D]/20 border-t-[#2D5A3D] rounded-full animate-spin"></div>
        <p className="text-xs font-mono font-bold text-[#5C6B5E] uppercase tracking-widest">Chargement du carnet...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F2E8] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="text-6xl">🏔️</div>
        <div className="space-y-2">
          <h1 className="font-display font-800 text-3xl text-[#1C2620]">Carnet introuvable</h1>
          <p className="text-sm text-[#5C6B5E] max-w-md mx-auto">
            Ce carnet n'existe pas ou n'est plus disponible. Il se peut qu'il ait été supprimé ou défini comme privé.
          </p>
        </div>
        <Link href="/communaute" className="px-6 py-3 bg-[#1C2620] hover:bg-[#2D5A3D] text-white rounded-full text-xs font-bold transition-colors shadow-lg">
          Retour à la communauté
        </Link>
      </div>
    );
  }

  return <CarnetView data={data} />;
}
