import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface HeroVoyageProps {
  data: any;
}

export default function HeroVoyage({ data }: HeroVoyageProps) {
  return (
    <div className="bg-gradient-to-br from-[#1C2620] to-[#33463C] rounded-[2rem] p-8 sm:p-10 text-[#E7E3D6] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shadow-sm">
      {/* Decors */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-white opacity-5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6 border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#E7E3D6]">{data.meta.type} · {data.meta.participantsCount} PERSONNES · {data.meta.season}</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl mb-6 leading-[1.1]">
          <span className="font-display font-400 block">{data.meta.titlePrefix}</span>
          <span className="font-serif italic font-bold text-[#E7E3D6]">{data.meta.titleSuffix}</span>
        </h1>
        
        <p className="text-white/80 font-sans text-sm md:text-base leading-relaxed mb-10 max-w-xl">
          {data.meta.description}
        </p>
        
        <div className="flex items-center gap-6 font-mono text-sm">
          <div className="flex flex-col">
            <span className="text-[#E7E3D6]/50 text-[10px] uppercase tracking-widest mb-1">Durée</span>
            <span className="font-bold">{data.meta.durationDays} jours</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[#E7E3D6]/50 text-[10px] uppercase tracking-widest mb-1">Distance</span>
            <span className="font-bold">{data.meta.distanceKm} km</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[#E7E3D6]/50 text-[10px] uppercase tracking-widest mb-1">Dénivelé +</span>
            <span className="font-bold">{data.meta.elevationGain} m</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[#E7E3D6]/50 text-[10px] uppercase tracking-widest mb-1">Voyageurs</span>
            <span className="font-bold">{data.meta.participantsCount}</span>
          </div>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-end gap-4 w-full md:w-auto mt-8 md:mt-0">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full w-24 h-24 flex flex-col items-center justify-center mb-2 shadow-xl">
          <span className="font-display text-2xl font-bold text-white">J-{data.meta.daysLeft}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/70 text-center px-2">avant le<br/>départ</span>
        </div>
        
        <button className="w-full md:w-auto px-6 py-3 bg-[#E7E3D6] text-[#1C2620] font-sans font-bold text-sm rounded-full hover:bg-white transition-colors flex items-center justify-center gap-2">
          <Icon name="PlusIcon" size={16} />
          Inviter un ami
        </button>
        
        <div className="flex items-center gap-3 mt-2">
          <button className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Icon name="ChatBubbleLeftIcon" size={16} />
          </button>
          <button className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Icon name="ShareIcon" size={16} />
          </button>
          <button className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Icon name="EllipsisHorizontalIcon" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
