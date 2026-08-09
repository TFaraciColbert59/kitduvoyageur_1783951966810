'use client';

import React from 'react';
import { RoutePoi } from '../services/RouteGeom';

interface PreHikePreparationCardProps {
  routeName: string;
  distanceKm: number;
  elevationGainM?: number | null;
  durationHours?: number | null;
  pois?: RoutePoi[];
  onStartHike: () => void;
}

export default function PreHikePreparationCard({
  routeName,
  distanceKm,
  elevationGainM,
  durationHours,
  pois = [],
  onStartHike,
}: PreHikePreparationCardProps) {
  const hasWaterPoi = pois.some(
    (p) => p.category?.toLowerCase().includes('eau') || p.name.toLowerCase().includes('eau') || p.name.toLowerCase().includes('source')
  );
  const hasRefuge = pois.some(
    (p) => p.category?.toLowerCase().includes('refuge') || p.name.toLowerCase().includes('refuge') || p.name.toLowerCase().includes('abri')
  );

  const checklist = [
    { text: 'Signal GPS actif', status: 'requis' as const, ok: true },
    { text: hasWaterPoi ? 'Point d\'eau disponible sur le tracé' : 'Eau recommandée (pas de source identifiée)', status: hasWaterPoi ? ('disponible' as const) : ('recommande' as const), ok: hasWaterPoi },
    { text: hasRefuge ? 'Abri / Refuge présent sur la route' : 'Pas de refuge identifié', status: hasRefuge ? ('disponible' as const) : ('info' as const), ok: hasRefuge },
    { text: distanceKm > 10 ? 'Mode Hors-Ligne conseillé (itinéraire > 10 km)' : 'Randonnée courte', status: distanceKm > 10 ? ('conseille' as const) : ('info' as const), ok: true },
  ];

  return (
    <div className="bg-[#FBFAF6] border border-[#0B1F17]/10 rounded-3xl p-6 shadow-xl space-y-5 text-[#0B1F17]">
      <div className="flex items-center justify-between border-b border-[#0B1F17]/10 pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#17402C] font-semibold">
            Préparation & Checklist
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-0.5">{routeName}</h2>
        </div>
        <div className="text-right font-mono text-xs text-[#5A6A5D]">
          <div>{distanceKm.toFixed(1)} km</div>
          {elevationGainM != null && <div>+{Math.round(elevationGainM)} m</div>}
        </div>
      </div>

      <div className="space-y-2.5">
        {checklist.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
              item.ok ? 'bg-[#EBF2EA] text-[#2D5A27]' : 'bg-amber-50 text-amber-700'
            }`}>
              {item.ok ? '✓' : '!'}
            </span>
            <span className="text-[#2C3E35] font-medium">{item.text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onStartHike}
        className="w-full py-3.5 bg-[#17402C] text-white text-sm font-bold rounded-2xl shadow-lg hover:bg-[#06120C] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-mono uppercase tracking-wider"
      >
        <span>🥾</span>
        <span>Démarrer cette randonnée</span>
      </button>
    </div>
  );
}
