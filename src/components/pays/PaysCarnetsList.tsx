'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface Props {
  countryIso: string;
  countryName: string;
}

export default function PaysCarnetsList({ countryIso, countryName }: Props) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = createClient();
  const [carnets, setCarnets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCarnets() {
      if (!countryIso) return;
      const iso = (countryIso || '').toLowerCase();

      const { data, error } = await supabase
        .from('carnets')
        .select(`*, author:user_profiles(full_name, avatar_url)`)
        .eq('visibility', 'public')
        .ilike('country_iso', iso)
        .order('likes_count', { ascending: false })
        .limit(4);

      if (!error && data) {
        setCarnets(data);
      }
      setLoading(false);
    }
    fetchCarnets();
  }, [countryIso, supabase]);

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <div className="w-7 h-7 border-2 border-[#17402C]/20 border-t-[#17402C] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h3 className="text-base font-bold font-display text-[#17402C] leading-tight">
            Carnets d’expédition <em className="font-serif italic text-emerald-800 font-normal">en {countryName}</em>
          </h3>
          <p className="text-[10px] text-[#5C6B5E]">Récits vécus, traces et retours de marcheurs.</p>
        </div>
        <Link
          href="/carnets"
          onClick={() => triggerHaptic('light')}
          className="glass-capsule-btn !min-h-[28px] !py-0.5 !px-3 !text-[11px] !font-bold shrink-0"
        >
          Tous les carnets →
        </Link>
      </div>

      {carnets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {carnets.map((carnet) => (
            <div
              key={carnet.id}
              onClick={() => {
                triggerHaptic('light');
                router.push(`/carnets/${carnet.id}`);
              }}
              className="glass bg-white/90 backdrop-blur-xl group cursor-pointer rounded-3xl overflow-hidden flex flex-col justify-between transition-all duration-300 border border-white shadow-xs p-3 space-y-2.5"
            >
              <div className="space-y-2">
                <div className="aspect-[16/10] rounded-2xl relative overflow-hidden bg-[#17402C]">
                  <img
                    src={
                      carnet.cover_image ||
                      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800'
                    }
                    alt={carnet.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 glass-pill text-white text-[9px] font-mono bg-black/40 backdrop-blur-md">
                    📍 {carnet.destination || countryName}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-[#17402C] leading-snug line-clamp-2">
                    {carnet.title}
                  </h4>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#17402C]/10 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-[9px] overflow-hidden shrink-0">
                    {carnet.author?.avatar_url ? (
                      <img src={carnet.author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      carnet.author?.full_name?.charAt(0) || '👤'
                    )}
                  </div>
                  <span className="font-medium text-[11px] text-[#17402C] truncate">
                    {carnet.author?.full_name || 'Voyageur'}
                  </span>
                </div>

                <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-rose-600 shrink-0">
                  ❤️ {carnet.likes_count || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass bg-white/80 p-5 text-center rounded-3xl border border-white space-y-2">
          <span className="text-3xl block">📖</span>
          <h4 className="font-bold text-xs text-[#17402C]">Aucun carnet publié en {countryName}</h4>
          <p className="text-[11px] text-[#5C6B5E] max-w-xs mx-auto">
            Soyez le premier à partager votre trace et inspirer la communauté.
          </p>
          <div className="pt-1">
            <Link
              href="/carnets"
              onClick={() => triggerHaptic('selection')}
              className="glass-capsule-btn primary !min-h-[32px] !py-1 !px-4 !text-xs !font-bold inline-flex"
            >
              + Rédiger un carnet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}