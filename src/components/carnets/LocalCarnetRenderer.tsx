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
        setData({
          meta: {
            badge: `CARNET OUVERT · ${(found.destination || 'EXPÉDITION').toUpperCase()}`,
            titleLine1: found.title,
            titleLine2: '',
            subtitleLine1: found.description || '',
            subtitleLine2: '',
            voyageurs: 1,
            dateRange: 'Octobre 2026',
            itineraire: found.destination || 'Chartreuse',
          },
          stats: [
            { value: `${found.distance_km || 27} km`, label: 'DISTANCE', hidden: false },
            { value: `${found.elevation_m || 1620} m`, label: 'DÉNIVELÉ +', hidden: false },
            { value: '3', label: 'NUITS', hidden: false },
            { value: '4', label: 'MOMENTS', hidden: false },
          ],
          jours: [
            { 
              id: 'j1', 
              dayNumber: 1, 
              label: 'JOUR 1', 
              title: 'Départ → ', 
              titleItalic: 'Découverte', 
              recit: found.description || 'Récit de cette première étape...', 
              stats: [{ icon: '📏', label: `${found.distance_km || 12} km` }, { icon: '⛰', label: `${found.elevation_m || 850} m D+` }] 
            }
          ],
          hebergements: [],
          moments: [],
          kit: { intro: 'Sac d\'expédition préparé pour ce carnet.', totalWeight: '1.4 kg', items: [] },
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
