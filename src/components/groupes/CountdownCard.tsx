import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface CountdownCardProps {
  data: any;
}

export default function CountdownCard({ data }: CountdownCardProps) {
  return (
    <div className="bg-[#33463C] rounded-[2rem] p-6 text-[#E7E3D6] shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 blur-[40px] rounded-full pointer-events-none" />
      
      <div className="inline-block px-3 py-1 bg-white/10 rounded-full mb-6 border border-white/20">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#E7E3D6]">DÉPART · DANS {data.meta.daysLeft} JOURS</span>
      </div>
      
      <h2 className="text-3xl mb-2 font-display">
        {data.meta.fullStartDate.split(' ')[0]} <span className="font-serif italic font-bold">{data.meta.fullStartDate.split(' ').slice(1).join(' ')}</span>
      </h2>
      
      <p className="text-white/70 text-sm font-sans mb-8">
        {data.meta.meetingPoint}
      </p>
      
      <div className="grid grid-cols-3 gap-2 mb-8">
        <div className="bg-black/20 p-3 rounded-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-1">Départ</p>
          <p className="font-mono font-bold text-sm text-white">{data.meta.startDate}</p>
        </div>
        <div className="bg-black/20 p-3 rounded-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-1">Retour</p>
          <p className="font-mono font-bold text-sm text-white">{data.meta.endDate}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-xl border border-white/10">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-1">Durée</p>
          <p className="font-mono font-bold text-sm text-[#E4501C]">{data.meta.durationDays} jours</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
        <div className="flex -space-x-2">
          {data.travelers.slice(0, 4).map((t: any, i: number) => (
            <div key={t.id} className="w-8 h-8 rounded-full border-2 border-[#33463C] bg-[#E7E3D6] text-[#1C2620] flex items-center justify-center text-xs font-bold z-10" style={{ zIndex: 10 - i }}>
              {t.name.charAt(0)}
            </div>
          ))}
          {data.travelers.length > 4 && (
            <div className="w-8 h-8 rounded-full border-2 border-[#33463C] bg-[#1C2620] text-white flex items-center justify-center text-[10px] font-bold z-0">
              +{data.travelers.length - 4}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{data.meta.participantsCount} confirmés</p>
          <p className="text-[10px] font-mono text-white/50">2 places restantes</p>
        </div>
        <button className="w-8 h-8 rounded-full bg-white text-[#1C2620] flex items-center justify-center hover:bg-white/90 transition-colors">
          <Icon name="PlusIcon" size={14} />
        </button>
      </div>
    </div>
  );
}
