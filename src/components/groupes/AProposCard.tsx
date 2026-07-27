import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface AProposCardProps {
  data: any;
}

export default function AProposCard({ data }: AProposCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <h2 className="font-display text-xl text-[#1C2620] mb-2">À propos <span className="font-serif italic font-bold">du voyage</span></h2>
      <p className="text-sm text-[#1C2620]/80 font-sans mb-6">
        Les paramètres essentiels du groupe.
      </p>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="MapPinIcon" size={16} className="text-[#1C2620]/50" />
            <span className="text-sm text-[#1C2620] font-sans">Massif</span>
          </div>
          <span className="text-sm font-semibold text-[#1C2620]">{data.meta.massif}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="ChartBarIcon" size={16} className="text-[#1C2620]/50" />
            <span className="text-sm text-[#1C2620] font-sans">Difficulté</span>
          </div>
          <span className="text-sm font-semibold text-[#1C2620]">{data.meta.difficulty}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="CurrencyEuroIcon" size={16} className="text-[#1C2620]/50" />
            <span className="text-sm text-[#1C2620] font-sans">Budget prévu</span>
          </div>
          <span className="text-sm font-semibold text-[#1C2620]">{data.meta.budgetEstimate}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="LockClosedIcon" size={16} className="text-[#1C2620]/50" />
            <span className="text-sm text-[#1C2620] font-sans">Confidentialité</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest bg-[#1C2620]/5 text-[#1C2620]/70 px-2 py-0.5 rounded-sm">
            {data.meta.privacy}
          </span>
        </div>
      </div>
    </div>
  );
}
