"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Props {
  countryIso: string;
  countryName: string;
}

export default function PaysClubsList({ countryIso, countryName }: Props) {
  const router = useRouter();
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
  }, [countryIso]);

  if (loading) {
    return (
      <div className="py-4 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1C2620]/20 border-t-[#1C2620] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-[#0B1F17] leading-tight">
            Clubs <em className="font-serif italic text-[#1B4332] font-normal">locaux</em>
          </h2>
          <p className="text-xs text-[#63736C]">Communautés de voyageurs passionnés en {countryName}.</p>
        </div>
        <Link href="/clubs" className="hidden sm:inline-flex px-3.5 py-1.5 border border-[#1C2620]/15 text-[#1C2620] rounded-full text-xs font-semibold hover:bg-[#1C2620]/5 transition-colors whitespace-nowrap">
          Voir tous les clubs
        </Link>
      </div>

      {clubs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {clubs.map((club) => (
            <div 
              key={club.id}
              onClick={() => router.push(`/clubs/${club.slug}`)}
              className="group cursor-pointer bg-white rounded-[16px] p-3.5 border border-[#1C2620]/10 hover:border-[#1C2620]/30 hover:shadow-sm transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2.5">
                  <div 
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center text-xl shadow-inner"
                    style={{ backgroundColor: club.cover_color || '#E7EFE7' }}
                  >
                    {club.emoji || '🏔️'}
                  </div>
                  {club.is_verified && (
                    <div className="bg-[#E7EFE7] text-[#1B4332] p-1 rounded-full" title="Club Vérifié">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                    </div>
                  )}
                </div>
                
                <h3 className="font-bold text-sm text-[#0B1F17] mb-1 truncate group-hover:text-[#2D5A3D] transition-colors">{club.name}</h3>
                <p className="text-[#63736C] text-[11px] line-clamp-2 mb-3 leading-relaxed">
                  {club.description || "Club de passionnés d'aventure outdoor."}
                </p>
              </div>
              
              <div className="flex items-center justify-between text-[10px] font-mono text-[#63736C] pt-2.5 border-t border-[#1C2620]/5">
                <span className="bg-[#1C2620]/5 px-2 py-0.5 rounded">
                  {club.members_count || 0} membres
                </span>
                {club.active_this_month > 0 && (
                  <span className="flex items-center gap-1 text-[#2D5A3D]">
                    <span className="w-1.5 h-1.5 bg-[#2D5A3D] rounded-full animate-pulse"></span>
                    Actif
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#FBFAF6] border border-[#1C2620]/10 rounded-[16px] p-4 text-center">
          <p className="text-xs text-[#63736C] mb-2">Aucun club spécifique à {countryName} pour le moment.</p>
          <Link href="/clubs" className="inline-flex px-3 py-1.5 bg-[#1B4332] text-white rounded-full text-xs font-semibold hover:bg-[#0B1F17] transition-colors">
            Explorer les clubs généraux
          </Link>
        </div>
      )}
      
      <Link href="/clubs" className="sm:hidden mt-3 flex justify-center px-4 py-2 border border-[#1C2620]/20 text-[#1C2620] rounded-full text-xs font-semibold hover:bg-[#1C2620]/5 transition-colors">
        Voir tous les clubs
      </Link>
    </div>
  );
}
