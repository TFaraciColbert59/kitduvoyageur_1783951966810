import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function CarnetCTACard() {
  return (
    <div className="glass tone-sage p-6 relative overflow-hidden transition-all duration-300">
      <div className="inline-block glass-pill mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#17402C] font-bold">APRÈS LE RETOUR</span>
      </div>
      
      <h2 className="font-display font-bold text-2xl text-[#17402C] mb-3 leading-tight">
        Ce voyage deviendra un <span className="font-serif italic font-normal text-[#17402C]">carnet.</span>
      </h2>
      
      <p className="text-xs text-[#5C6B5E] font-sans mb-6 leading-relaxed">
        Étapes, photos, hébergements et dépenses seront automatiquement archivés dans votre Carnet le 15 octobre.
      </p>
      
      <Link
        href="/carnets"
        className="w-full glass-capsule-btn primary py-3 text-xs font-bold flex items-center justify-center gap-2"
      >
        <Icon name="BookOpenIcon" size={16} className="relative z-10" />
        <span className="relative z-10">Voir le Carnet</span>
      </Link>
    </div>
  );
}
