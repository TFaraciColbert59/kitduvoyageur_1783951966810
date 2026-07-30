import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function CarnetCTACard() {
  return (
    <div className="bg-gradient-to-br from-[#E7E3D6] to-[#F1EBE0] rounded-[2rem] p-6 border border-[#B5652D]/20 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#17402C] opacity-5 blur-[40px] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity" />
      
      <div className="inline-block px-3 py-1 bg-[#B5652D]/10 rounded-full mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#B5652D] font-bold">APRÈS LE RETOUR</span>
      </div>
      
      <h2 className="font-display text-2xl text-[#1C2620] mb-3 leading-tight">
        Ce voyage deviendra un <span className="font-serif italic font-bold text-[#17402C]">carnet.</span>
      </h2>
      
      <p className="text-sm text-[#1C2620]/70 font-sans mb-6 leading-relaxed">
        Étapes, photos, hébergements et dépenses seront automatiquement archivés dans votre Carnet le 15 octobre.
      </p>
      
      <button className="w-full py-3 bg-[#17402C] text-white rounded-full flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <Icon name="BookOpenIcon" size={16} />
        Voir le Carnet
      </button>
    </div>
  );
}
