import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function ParcoursCard() {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-display text-xl text-[#1C2620]">Le <span className="font-serif italic font-bold">parcours</span></h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">3 étapes</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">27,4 km</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors flex items-center gap-1.5">
            <Icon name="ArrowDownTrayIcon" size={12} /> GPX
          </button>
          <button className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors">
            Modifier
          </button>
        </div>
      </div>
      
      <p className="text-sm text-[#1C2620]/80 mb-6 font-sans">
        Saint-Pierre-de-Chartreuse — Charmant Som — Grand Vaneau — Col de la Chamette. Deux nuits en refuge gardé.
      </p>
      
      {/* SVG Map mock */}
      <div className="h-48 bg-[#E7E3D6]/50 rounded-xl relative overflow-hidden border border-[#1C2620]/5 mb-4 flex items-center justify-center group-hover:bg-[#E7E3D6]/80 transition-colors">
        {/* Lignes topo mock */}
        <svg className="absolute inset-0 w-full h-full text-[#1C2620]/5" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,50 Q100,20 200,80 T400,60" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M0,100 Q150,150 250,90 T400,120" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M0,150 Q100,180 200,130 T400,160" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        
        <svg className="relative w-full h-full z-10" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
          {/* Main route */}
          <path d="M50,140 C120,130 180,60 250,90 C300,110 330,70 350,50" fill="none" stroke="#1C2620" strokeWidth="3" strokeDasharray="6,4" />
          
          {/* Variant */}
          <path d="M180,60 C210,30 240,40 250,90" fill="none" stroke="#E4501C" strokeWidth="2" strokeDasharray="4,4" />
          
          {/* Points */}
          <circle cx="50" cy="140" r="4" fill="#1C2620" />
          <text x="50" y="158" fontSize="10" fill="#1C2620" textAnchor="middle" fontWeight="bold">Départ</text>
          
          <circle cx="180" cy="60" r="4" fill="#1C2620" />
          <text x="180" y="48" fontSize="10" fill="#1C2620" textAnchor="middle" fontWeight="bold">Refuge 1</text>
          
          <circle cx="250" cy="90" r="4" fill="#1C2620" />
          <text x="250" y="108" fontSize="10" fill="#1C2620" textAnchor="middle" fontWeight="bold">Refuge 2</text>
          
          <circle cx="350" cy="50" r="6" fill="#E4501C" />
          <text x="350" y="36" fontSize="10" fill="#E4501C" textAnchor="middle" fontWeight="bold">Arrivée</text>
        </svg>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[#1C2620]/60">
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[#1C2620]" /> Tracé principal</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[#E4501C] border-dashed border-t-2" /> Variantes</span>
        <span className="flex items-center gap-1.5"><Icon name="ArrowTrendingUpIcon" size={12} /> 1 620 m D+</span>
        <span className="flex items-center gap-1.5"><Icon name="HomeIcon" size={12} /> 3 refuges</span>
      </div>
    </div>
  );
}
