'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';

interface CarnetHeroProps {
  meta: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    subtitleLine1: string;
    subtitleLine2: string;
    voyageurs: number;
    dateRange: string;
    itineraire: string;
  };
  onExport: () => void;
  carnetId?: string;
}

export default function CarnetHero({ meta, onExport, carnetId }: CarnetHeroProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user || !carnetId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('carnet_favorites')
          .select('id')
          .eq('carnet_id', carnetId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsSaved(!!data);
      } catch (err) {
        console.error('Error checking favorite:', err);
      }
    })();
  }, [user, carnetId, supabase]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: `${meta.titleLine1} ${meta.titleLine2}`, url });
      } catch (err) {}
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Lien copié dans le presse-papier !', 'success');
  };

  const handleToggleSave = async () => {
    if (!user) { toast('Connectez-vous pour enregistrer ce carnet', 'error'); return; }
    if (!carnetId) { toast('Carnet indisponible', 'error'); return; }
    if (isSaved) {
      await supabase.from('carnet_favorites').delete().eq('carnet_id', carnetId).eq('user_id', user.id);
      setIsSaved(false);
      toast('Retiré des favoris', 'success');
    } else {
      await supabase.from('carnet_favorites').insert({ carnet_id: carnetId, user_id: user.id });
      setIsSaved(true);
      toast('Ajouté aux favoris', 'success');
    }
  };

  return (
    <section className="relative bg-gradient-to-b from-[#1C2620] via-[#1C2620] to-[#33463C] text-[#E7E3D6] overflow-hidden">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")' }} aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        {/* Action bar */}
        <div className="flex items-center justify-end gap-3 pt-6 pb-4">
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-[#E7E3D6]/70 hover:text-[#E7E3D6]"
            aria-label="Partager"
          >
            <Icon name="ShareIcon" size={18} />
          </button>
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded-full transition-colors ${isSaved ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/10 text-[#E7E3D6]/70 hover:text-[#E7E3D6]'}`}
            aria-label="Enregistrer"
          >
            <Icon name={isSaved ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={18} />
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 bg-[#E7E3D6] text-[#1C2620] px-4 py-2 rounded-full text-xs font-semibold hover:bg-white transition-colors"
          >
            <Icon name="ArrowDownTrayIcon" size={14} />
            Exporter
          </button>
        </div>

        {/* Hero content */}
        <div className="pb-14 pt-4 md:pt-8">
          <div className="mb-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#E7E3D6]/50 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
              {meta.badge}
            </span>
          </div>

          <h1 className="mb-8">
            <span className="block font-display text-4xl md:text-6xl lg:text-7xl font-bold text-[#E7E3D6] tracking-tight leading-[1.05]">
              {meta.titleLine1}
            </span>
            <span className="block font-display text-4xl md:text-6xl lg:text-7xl font-bold text-[#E7E3D6] tracking-tight leading-[1.05]">
              {meta.titleLine2}
            </span>
            <span className="block font-serif text-3xl md:text-5xl lg:text-6xl italic text-[#E7E3D6]/70 mt-1 leading-[1.15]">
              {meta.subtitleLine1}
            </span>
            <span className="block font-serif text-3xl md:text-5xl lg:text-6xl italic text-[#E7E3D6]/70 leading-[1.15]">
              {meta.subtitleLine2}
            </span>
          </h1>

          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-4 text-[#E7E3D6]/60 text-xs">
            {/* Avatar stack */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...(Array(4) as undefined[])].map((_, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-[#1C2620] bg-[#33463C] flex items-center justify-center text-[8px] font-bold text-[#E7E3D6]/80"
                  >
                    {['L', 'A', 'M', 'C'][i]}
                  </div>
                ))}
              </div>
              <span className="font-mono text-[10px] tracking-widest uppercase">{meta.voyageurs} voyageurs</span>
            </div>
            <span className="hidden md:inline text-[#E7E3D6]/20">·</span>
            <span className="font-mono text-[10px] tracking-widest">{meta.dateRange}</span>
            <span className="hidden md:inline text-[#E7E3D6]/20">·</span>
            <span className="font-mono text-[10px] tracking-widest">{meta.itineraire}</span>
          </div>
        </div>
      </div>
    </section>
  );
}