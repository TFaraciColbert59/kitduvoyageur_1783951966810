'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import HeroProfil from '@/components/compte/HeroProfil';
import StatsBandeau from '@/components/compte/StatsBandeau';
import MesAventuresCard from '@/components/compte/MesAventuresCard';
import MesCarnetsCard from '@/components/compte/MesCarnetsCard';
import MesClubsCard from '@/components/compte/MesClubsCard';
import BadgesCard from '@/components/compte/BadgesCard';
import ConstanceCard from '@/components/compte/ConstanceCard';
import CompteFooter from '@/components/compte/CompteFooter';
import { MOCK_MARCELINE_DATA } from '@/lib/mock/compte-marceline';

export default function PublicProfilePage() {
  const { profile, aventures, carnets, clubs, badges, constance } = MOCK_MARCELINE_DATA;

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#1C2620] selection:bg-emerald-900/20 font-sans">
      <Header />

      <main className="pt-24 pb-12">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          {/* Breadcrumb & Public badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]/50">
              <Link href="/" className="hover:text-[#1C2620]">Accueil</Link>
              <span>›</span>
              <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link>
              <span>›</span>
              <span className="text-[#1C2620] font-bold">Profil de {profile.first_name}</span>
            </div>

            <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300">
              Profil public vérifié
            </span>
          </div>

          {/* Hero */}
          <HeroProfil
            profile={profile}
            onShareProfile={() => alert('Lien du profil copié !')}
          />

          {/* Stats Bandeau */}
          <StatsBandeau profile={profile} />

          {/* Public Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-8">
            <div className="lg:col-span-8 space-y-6">
              <MesAventuresCard aventures={aventures} />
              <MesCarnetsCard carnets={carnets} />
              <MesClubsCard clubs={clubs} />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <BadgesCard badges={badges} />
              <ConstanceCard constance={constance} />
            </div>
          </div>

        </div>
      </main>

      <CompteFooter profile={profile} />
    </div>
  );
}
