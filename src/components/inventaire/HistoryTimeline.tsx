// src/components/inventaire/HistoryTimeline.tsx
'use client';

import React from 'react';

interface HistoryEvent {
  id?: string;
  date: string;
  title: string;
  type: 'Contrôle' | 'Sortie' | 'Entretien' | 'Achat' | 'Prêt' | 'Réparation' | string;
  details: string;
  mileage_added?: string;
  total_mileage?: string;
  cost?: string;
}

interface HistoryTimelineProps {
  events?: HistoryEvent[];
}

export default function HistoryTimeline({ events }: HistoryTimelineProps) {
  const defaultEvents: HistoryEvent[] = [
    {
      id: 'he-1',
      date: '5 oct. 2026',
      title: 'Photos de semelle — usure 68%',
      type: 'Contrôle',
      details: '3 photos ajoutées : état contrôlé visuellement',
      total_mileage: '-',
    },
    {
      id: 'he-2',
      date: '18 sept. 2026',
      title: 'Bivouac au lac d\'Anterne',
      type: 'Sortie',
      details: '+13,6 km • dénivelé 1 240 m • avec Antoine',
      mileage_added: '+13,6 km',
      total_mileage: 'total : 380 km',
    },
    {
      id: 'he-3',
      date: '8 août 2026',
      title: 'Tour du Belleroche — 4 étapes',
      type: 'Sortie',
      details: '+68,4 km • dénivelé 4 850 m • en solo',
      mileage_added: '+68,4 km',
      total_mileage: 'total : 366.4 km',
    },
    {
      id: 'he-4',
      date: '22 juin 2026',
      title: 'Ré-imperméabilisation Vêtement',
      type: 'Entretien',
      details: 'Traitement complet, séchage 24h',
      cost: '14 € (Nikwax Spray)',
    },
    {
      id: 'he-5',
      date: '3 mai 2026',
      title: 'GR20 partiel — 5 jours',
      type: 'Sortie',
      details: '+85 km • avec Julien, Sophie',
      mileage_added: '+85 km',
      total_mileage: 'total : 298 km',
    },
    {
      id: 'he-6',
      date: '12 févr. 2025',
      title: 'Achat chez Snowleader',
      type: 'Achat',
      details: 'Facture #SL-2025-8542 • Livraison en 3j',
      cost: '219 € (-15% Solde)',
    },
  ];

  const list = events && events.length > 0 ? events : defaultEvents;

  const typeBadgeColors: Record<string, string> = {
    Contrôle: 'bg-amber-100 text-amber-800',
    Sortie: 'bg-emerald-100 text-emerald-800',
    Entretien: 'bg-blue-100 text-blue-800',
    Achat: 'bg-purple-100 text-purple-800',
    Prêt: 'bg-orange-100 text-orange-800',
    Réparation: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-[#E8E4D8] shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#132219] font-display">
            Historique <span className="italic font-serif font-normal">d'utilisation</span>
          </h2>
          <p className="text-xs text-[#132219]/60 mt-0.5">
            Achats, sorties, réparations et prêts. Les kilomètres se cumulent à partir des GPX importés.
          </p>
        </div>
        <span className="text-xs font-bold text-[#132219]/70 bg-[#F5F2EA] px-3 py-1 rounded-full whitespace-nowrap">
          {list.length} événements enregistrés
        </span>
      </div>

      {/* Timeline items */}
      <div className="space-y-3 pt-2">
        {list.map((item, idx) => (
          <div
            key={item.id || idx}
            className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-[#132219]/30"
          >
            {/* Left part: Date & Event Info */}
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-24 flex-shrink-0 text-xs font-extrabold text-[#132219]">
                {item.date}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-[#132219] text-sm sm:text-base">
                    {item.title}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      typeBadgeColors[item.type] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <p className="text-xs text-[#132219]/70">{item.details}</p>
              </div>
            </div>

            {/* Right part: Mileage or Cost */}
            <div className="text-right flex-shrink-0 text-xs sm:text-sm font-semibold text-[#132219] sm:pl-4">
              {item.mileage_added && (
                <span className="block text-emerald-700 font-extrabold">{item.mileage_added}</span>
              )}
              {item.total_mileage && (
                <span className="block text-[#132219]/60 text-xs">{item.total_mileage}</span>
              )}
              {item.cost && <span className="block font-bold text-[#132219]">{item.cost}</span>}
              {!item.mileage_added && !item.total_mileage && !item.cost && (
                <span className="text-[#132219]/40">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
