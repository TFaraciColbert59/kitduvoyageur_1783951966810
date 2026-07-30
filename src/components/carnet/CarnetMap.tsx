'use client';

import React from 'react';

interface CarnetMapProps {
  onDownloadGPX: () => void;
}

export default function CarnetMap({ onDownloadGPX }: CarnetMapProps) {
  return (
    <div className="bg-white rounded-[2rem] border border-[#1C2620]/10 shadow-sm overflow-hidden">
      {/* SVG Map */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-[#E7E3D6] to-[#d5d1c4] p-6">
        <svg viewBox="0 0 400 300" className="w-full h-full" aria-label="Carte du parcours Chartreuse">
          {/* Contour lines - subtle topo feel */}
          <ellipse cx="200" cy="150" rx="180" ry="120" fill="none" stroke="#33463C" strokeWidth="0.3" opacity="0.15" />
          <ellipse cx="200" cy="150" rx="150" ry="100" fill="none" stroke="#33463C" strokeWidth="0.3" opacity="0.12" />
          <ellipse cx="200" cy="150" rx="120" ry="80" fill="none" stroke="#33463C" strokeWidth="0.3" opacity="0.10" />
          <ellipse cx="210" cy="140" rx="90" ry="60" fill="none" stroke="#33463C" strokeWidth="0.3" opacity="0.08" />
          <ellipse cx="220" cy="130" rx="60" ry="40" fill="none" stroke="#33463C" strokeWidth="0.3" opacity="0.06" />

          {/* Mountain silhouette */}
          <path d="M0 280 L60 200 L100 230 L150 160 L200 180 L250 120 L300 150 L350 100 L400 140 L400 300 L0 300Z" fill="#33463C" opacity="0.04" />

          {/* Trail path */}
          <path
            d="M60 250 C100 230, 120 200, 150 170 C180 140, 200 130, 230 120 C260 110, 280 100, 310 90 C330 85, 345 80, 355 75"
            fill="none"
            stroke="#33463C"
            strokeWidth="2.5"
            strokeDasharray="6 3"
            strokeLinecap="round"
          />

          {/* Point 1 - Start: Saint-Pierre */}
          <circle cx="60" cy="250" r="6" fill="#17402C" />
          <circle cx="60" cy="250" r="10" fill="none" stroke="#17402C" strokeWidth="1" opacity="0.3" />
          <text x="60" y="270" textAnchor="middle" className="fill-[#1C2620]" fontSize="8" fontFamily="monospace" fontWeight="600">St-Pierre</text>

          {/* Point 2 - Charmant Som */}
          <circle cx="150" cy="170" r="5" fill="#33463C" />
          <text x="150" y="164" textAnchor="middle" className="fill-[#1C2620]" fontSize="7" fontFamily="monospace">①</text>
          <text x="150" y="190" textAnchor="middle" className="fill-[#1C2620]/60" fontSize="7" fontFamily="monospace">Charmant Som</text>

          {/* Point 3 - Grand Vaneau */}
          <circle cx="270" cy="105" r="5" fill="#33463C" />
          <text x="270" y="99" textAnchor="middle" className="fill-[#1C2620]" fontSize="7" fontFamily="monospace">②</text>
          <text x="270" y="125" textAnchor="middle" className="fill-[#1C2620]/60" fontSize="7" fontFamily="monospace">Grand Vaneau</text>

          {/* Point 4 - End: Col Charmette */}
          <circle cx="355" cy="75" r="6" fill="#33463C" />
          <circle cx="355" cy="75" r="10" fill="none" stroke="#33463C" strokeWidth="1" opacity="0.3" />
          {/* Check icon */}
          <path d="M350 75 L354 79 L362 71" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="355" y="65" textAnchor="middle" className="fill-[#1C2620]" fontSize="7" fontFamily="monospace">Col Charmette</text>
        </svg>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#1C2620]/5">
        <p className="font-mono text-[11px] text-[#1C2620]/60">27,4 km · 1 620 m D+</p>
        <button
          onClick={onDownloadGPX}
          className="font-mono text-[11px] font-semibold text-[#33463C] hover:text-[#17402C] transition-colors flex items-center gap-1"
        >
          Télécharger GPX ↓
        </button>
      </div>
    </div>
  );
}
