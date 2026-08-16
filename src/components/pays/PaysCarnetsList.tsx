"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Props {
  countryIso: string;
  countryName: string;
}

export default function PaysCarnetsList({ countryIso, countryName }: Props) {
  const router = useRouter();
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
            Carnets publics <em className="font-serif italic text-[#1B4332] font-normal">les plus likés</em>
          </h2>
          <p className="text-xs text-[#63736C]">Récits d'expéditions et photos en {countryName}.</p>
        </div>
        <Link href="/communaute" className="hidden sm:inline-flex px-3.5 py-1.5 border border-[#1C2620]/15 text-[#1C2620] rounded-full text-xs font-semibold hover:bg-[#1C2620]/5 transition-colors whitespace-nowrap">
          Tous les carnets
        </Link>
      </div>

      {carnets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {carnets.map((carnet) => (
            <div 
              key={carnet.id}
              onClick={() => router.push(`/carnets/${carnet.id}`)}
              className="group cursor-pointer bg-[#FBFAF6] rounded-[18px] overflow-hidden border border-[#1C2620]/8 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/10] relative overflow-hidden">
                  <img 
                    src={carnet.cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800'} 
                    alt={carnet.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  {carnet.verified && (
                    <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#C89A5A"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      <span className="text-[9px] font-bold text-[#0F2A20] uppercase tracking-wider">Vérifié</span>
                    </div>
                  )}
                </div>
                <div className="p-3.5 pb-2">
                  <h3 className="font-bold text-sm text-[#0B1F17] leading-snug group-hover:text-[#2D5A3D] transition-colors line-clamp-1 mb-1">{carnet.title}</h3>
                  <span className="text-[10px] text-[#63736C] font-mono">📍 {carnet.destination || countryName}</span>
                </div>
              </div>
              <div className="p-3.5 pt-2 flex items-center justify-between border-t border-[#1C2620]/5 mt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <img src={carnet.author?.avatar_url || 'https://i.pravatar.cc/150'} className="w-5 h-5 rounded-full object-cover border border-[#E8E4D8] shrink-0" />
                  <span className="font-medium text-[11px] text-[#1C2620] truncate max-w-[80px]">{carnet.author?.full_name || 'Voyageur'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#63736C]">
                  <span className="flex items-center gap-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    {carnet.likes_count || 0}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    {carnet.comments_count || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#FBFAF6] border border-[#1C2620]/10 rounded-[18px] p-6 text-center">
          <div className="w-10 h-10 bg-[#E7EFE7] text-[#1B4332] rounded-full flex items-center justify-center mx-auto mb-2 text-lg">📓</div>
          <h3 className="font-bold text-sm text-[#0B1F17] mb-1">Aucun carnet public pour le moment</h3>
          <p className="text-xs text-[#63736C] max-w-sm mx-auto mb-3">Soyez le premier à partager votre aventure en {countryName}.</p>
          <Link href="/communaute/publier" className="inline-flex px-4 py-2 bg-[#1B4332] text-white rounded-full font-semibold text-xs hover:bg-[#0B1F17] transition-colors">
            Créer mon carnet
          </Link>
        </div>
      )}
    </div>
  );
}
