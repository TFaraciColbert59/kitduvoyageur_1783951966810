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

export default function PaysClubsList({ countryIso, countryName }: Props) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = createClient();
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClubs() {
      if (!countryIso) return;
      const iso = (countryIso || '').toLowerCase();

      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .ilike('country_iso', iso)
        .order('members_count', { ascending: false })
        .limit(4);

      if (!error && data) {
        setClubs(data);
      }
      setLoading(false);
    }
    fetchClubs();
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
            Clubs outdoor <em className="font-serif italic text-emerald-800 font-normal">en {countryName}</em>
          </h3>
          <p className="text-[10px] text-[#5C6B5E]">Communautés locales et sorties collectives.</p>
        </div>
        <Link
          href="/clubs"
          onClick={() => triggerHaptic('light')}
          className="glass-capsule-btn !min-h-[28px] !py-0.5 !px-3 !text-[11px] !font-bold shrink-0"
        >
          Tous les clubs →
        </Link>
      </div>

      {clubs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {clubs.map((club) => (
            <div
              key={club.id}
              onClick={() => {
                triggerHaptic('light');
                router.push(`/clubs/${club.slug}`);
              }}
              className="glass bg-white/90 backdrop-blur-xl group cursor-pointer rounded-3xl p-3.5 flex flex-col justify-between transition-all duration-300 border border-white shadow-xs space-y-2.5"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-2xs"
                    style={{ backgroundColor: club.cover_color || 'rgba(166,193,160,0.25)' }}
                  >
                    {club.emoji || '🏔️'}
                  </div>
                  {club.is_verified && (
                    <span className="glass-pill text-emerald-900 bg-emerald-50 text-[9px] font-mono font-bold">
                      ✓ Vérifié
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-xs text-[#17402C] mb-0.5 truncate group-hover:text-[#17402C]">
                  {club.name}
                </h4>
                <p className="text-[#5C6B5E] text-[11px] line-clamp-2 leading-relaxed">
                  {club.description || "Club de passionnés d'aventure outdoor."}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#5C6B5E] pt-2 border-t border-[#17402C]/10">
                <span className="bg-[#17402C]/5 px-2 py-0.5 rounded-md font-bold text-[#17402C]">
                  {club.members_count || 0} membres
                </span>
                {club.active_this_month > 0 && (
                  <span className="flex items-center gap-1 text-emerald-800 font-bold">
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                    Actif ce mois
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass bg-white/80 p-5 text-center rounded-3xl border border-white space-y-2">
          <span className="text-3xl block">🏔️</span>
          <h4 className="font-bold text-xs text-[#17402C]">Aucun club dédié à {countryName}</h4>
          <p className="text-[11px] text-[#5C6B5E] max-w-xs mx-auto">
            Rejoignez les clubs régionaux ou fondez votre communauté.
          </p>
          <div className="pt-1">
            <Link
              href="/clubs"
              onClick={() => triggerHaptic('selection')}
              className="glass-capsule-btn primary !min-h-[32px] !py-1 !px-4 !text-xs !font-bold inline-flex"
            >
              Explorer les clubs
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}