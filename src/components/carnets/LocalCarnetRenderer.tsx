'use client';

import { useEffect, useState } from 'react';
import CarnetView from '@/components/carnet/CarnetView';
import { CarnetData, mockCarnetChartreuse } from '@/lib/mock/carnet-chartreuse';
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
        const distStr = found.distance_km ? `${found.distance_km} km` : '27.4 km';
        const elevStr = found.elevation_m ? `${found.elevation_m} m D+` : '1 620 m D+';

        setData({
          id: found.id || id,
          meta: {
            badge: `CARNET D'EXPÉDITION · ${(found.destination || found.title || 'ISLANDE').toUpperCase()}`,
            titleLine1: found.title || 'Roadtrip sur la Ring Road',
            titleLine2: 'Fjords & Aurores Boréales',
            subtitleLine1: found.description || 'Le tour de l’Islande en van aménagé. Fjords, cascades et aurores boréales.',
            subtitleLine2: '',
            voyageurs: found.nb_voyageurs || 6,
            dateRange: found.created_at ? new Date(found.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '16 août 2026',
            itineraire: found.destination || found.title || 'Islande · Ring Road',
          },
          stats: [
            { value: distStr, label: 'DISTANCE' },
            { value: elevStr, label: 'DÉNIVELÉ +' },
            { value: '7', label: 'JOURS' },
            { value: '14', label: 'MOMENTS' },
          ],
          jours: [
            {
              id: 'j1',
              dayNumber: 1,
              label: 'JOUR 1 · DÉPART',
              title: found.lieu_depart ? `${found.lieu_depart} → ` : 'Reykjavík → ',
              titleItalic: found.lieu_arrivee || 'Cercle d’Or',
              recit: found.description || 'Prise en main du van aménagé sous une pluie fine typique du nord. Première étape vers les cascades de Seljalandsfoss et Skógafoss.',
              stats: [
                { icon: '📏', label: distStr },
                { icon: '⛰', label: elevStr },
                { icon: '🚐', label: 'Van 4x4' },
              ]
            },
            {
              id: 'j2',
              dayNumber: 2,
              label: 'JOUR 2 · CÔTE SUD',
              title: 'Plage de Reynisfjara → ',
              titleItalic: 'Glacier de Vatnajökull',
              recit: 'Sable noir volcanique, falaises d’orgues basaltiques et immersion face aux lagunes glaciaires de Jökulsárlón.',
              stats: [
                { icon: '📏', label: '14.2 km' },
                { icon: '⛰', label: '420 m D+' },
                { icon: '🧊', label: 'Glacier' },
              ]
            }
          ],
          hebergements: [
            {
              id: 'h1',
              nightNumber: 1,
              name: 'Camp de base du Cercle d’Or',
              price: 35,
              priceLabel: 'par van, emplacement',
              detail: 'Bivouac aménagé avec vue sur les plaines de lave',
            }
          ],
          moments: [
            {
              id: 'm1',
              label: 'JOUR 1 · 22H30',
              citation: '« Le ciel s’est soudainement teinté d’émeraude. Les premières aurores boréales dansaient au-dessus du van. »',
              author: 'Marc',
              location: 'Cercle d’Or',
            },
            {
              id: 'm2',
              label: 'JOUR 2 · 14H15',
              citation: '« Le vent glacial soufflait sur la plage de sable noir. On entendait le fracas sourd des icebergs dérivant vers l’océan. »',
              author: 'Léna',
              location: 'Jökulsárlón',
            },
            {
              id: 'm3',
              label: 'JOUR 3 · 08H00',
              citation: '« Réveil matinal face aux colonnes basaltiques, un café fumant dans les mains. »',
              author: 'Julien',
              location: 'Vik',
            }
          ],
          kit: {
            intro: 'Équipement grand froid et autonomie complète en bivouac nordique.',
            totalWeight: '4.8 kg',
            items: [
              { id: 'k1', name: 'Duvet grand froid confort -10°C', detail: 'Plumes d’oie hydrophobe 850 cuin', weight: '1.2 kg', color: '#3A6EA5' },
              { id: 'k2', name: 'Veste imperméable Hardshell 3 couches', detail: 'Membrane Gore-Tex Pro 28 000mm', weight: '460 g', color: '#17402C' },
              { id: 'k3', name: 'Réchaud tempête multi-combustible', detail: 'Résistant aux vents violents', weight: '340 g', color: '#B5652D' },
              { id: 'k4', name: 'Gourde isotherme inox 1L', detail: 'Maintien au chaud 24h', weight: '220 g', color: '#5C6B5E' },
            ]
          },
          randonnees: [
            { id: 'r1', title: 'Tour du canyon de Fjaðrárgljúfur', stats: '8.4 km · 320 m D+ · 3h00' }
          ]
        });
      } else {
        // Fallback to sample expedition
        setData(mockCarnetChartreuse);
      }
    } catch (e) {
      console.error("Error reading local carnet:", e);
      setData(mockCarnetChartreuse);
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

  return <CarnetView data={data} />;
}
