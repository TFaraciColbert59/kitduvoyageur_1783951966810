import React from 'react';
import type { CarnetRandonnee } from '@/lib/mock/carnet-chartreuse';

interface RandonneesSouvenirCardProps {
  randonnees: CarnetRandonnee[];
}

function handleDownloadGPX(title: string) {
  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1"><metadata><name>${title}</name></metadata><trk><name>${title}</name><trkseg></trkseg></trk></gpx>`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RandonneesSouvenirCard({ randonnees }: RandonneesSouvenirCardProps) {
  return (
    <div className="bg-white rounded-[0.75rem] p-6 md:p-8 border border-[#1C2620]/10 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-display text-lg text-[#1C2620]">
          Randonnées <em className="font-serif italic">parcourues</em>
        </h3>
        <a href="#" className="text-xs font-medium text-[#17402C] hover:underline whitespace-nowrap">Tout →</a>
      </div>
      <p className="text-sm text-[#1C2620]/60 mb-6 font-sans">Trois traces enregistrées, trois exportables au format GPX pour la fois prochaine.</p>
      <div className="space-y-3">
        {randonnees.map(r => (
          <div key={r.id} className="flex items-center gap-3 group/rando hover:bg-[#E7E3D6]/30 -mx-3 px-3 py-3 rounded-xl transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#33463C]/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#33463C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1C2620] truncate">{r.title}</p>
              <p className="font-mono text-[10px] text-[#1C2620]/50">{r.stats}</p>
            </div>
            <button
              onClick={() => handleDownloadGPX(r.title)}
              className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#33463C] bg-[#33463C]/5 hover:bg-[#33463C]/10 px-3 py-1.5 rounded-full transition-colors font-semibold"
            >
              GPX ↓
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
