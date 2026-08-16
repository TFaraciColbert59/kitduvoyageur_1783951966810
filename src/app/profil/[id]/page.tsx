'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroProfil from '@/components/compte/HeroProfil';
import StatsBandeau from '@/components/compte/StatsBandeau';
import MesCarnetsCard from '@/components/compte/MesCarnetsCard';
import MesClubsCard from '@/components/compte/MesClubsCard';
import BadgesCard from '@/components/compte/BadgesCard';
import ConstanceCard from '@/components/compte/ConstanceCard';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import {
  fetchFullProfile,
  fetchUserCarnets,
  fetchUserClubs,
  fetchUserBadges,
  fetchUserActivities,
  type CompteUserProfile,
  type CompteCarnet,
  type CompteClubItem,
  type CompteBadgeItem,
  type CompteActiviteItem,
} from '@/lib/supabase/queries-compte';

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params?.id as string;

  const [profile, setProfile] = useState<CompteUserProfile | null>(null);
  const [carnets, setCarnets] = useState<CompteCarnet[]>([]);
  const [clubs, setClubs] = useState<CompteClubItem[]>([]);
  const [badges, setBadges] = useState<CompteBadgeItem[]>([]);
  const [activite, setActivite] = useState<CompteActiviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      try {
        const [profileData, carnetsData, clubsData, badgesData, activiteData] = await Promise.all([
          fetchFullProfile(profileId),
          fetchUserCarnets(profileId),
          fetchUserClubs(profileId),
          fetchUserBadges(profileId),
          fetchUserActivities(profileId),
        ]);

        if (!profileData) {
          setNotFound(true);
          return;
        }

        setProfile(profileData);
        setCarnets(carnetsData);
        setClubs(clubsData);
        setBadges(badgesData);
        setActivite(activiteData);
      } catch (err) {
        console.error('Error loading public profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#5C6B5E] font-medium">Chargement du profil voyageur...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-[#1C2620]/10 shadow-xl">
          <p className="text-5xl mb-4">🧭</p>
          <h2 className="font-display font-800 text-2xl text-[#1C2620] mb-2">Profil introuvable</h2>
          <p className="text-sm text-[#5C6B5E] mb-6">Ce voyageur n&apos;existe pas ou son profil est indisponible.</p>
          <Link
            href="/communaute"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2A3830] transition-colors"
          >
            Explorer la communauté
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F3ED] text-[#1C2620] selection:bg-emerald-900/20 font-sans">
          <Header />
          
          <main className="pt-24 pb-16">
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
              
              {/* Top Navigation & Status */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]/60">
                  <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
                  <span>›</span>
                  <Link href="/communaute" className="hover:text-[#1C2620] transition-colors">Communauté</Link>
                  <span>›</span>
                  <span className="text-[#1C2620] font-bold">Profil de {profile.first_name}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1.5">
                    <span>✓</span> Profil vérifié
                  </span>
                </div>
              </div>

              {/* Photographic Hero Profile */}
              <HeroProfil 
                profile={profile as any} 
                onShareProfile={() => {
                  if (typeof window !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('Lien du profil copié dans le presse-papiers !');
                  }
                }} 
              />

              {/* Stats Bandeau */}
              <StatsBandeau profile={profile as any} />

              {/* 2-Column Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-8">
                {/* Left Column (Carnets & Clubs) */}
                <div className="lg:col-span-8 space-y-6">
                  <MesCarnetsCard carnets={carnets as any} />
                  <MesClubsCard clubs={clubs as any} />
                </div>

                {/* Right Column (Badges & Constance) */}
                <div className="lg:col-span-4 space-y-6">
                  <BadgesCard badges={badges as any} trustScore={profile.trust_score ?? 50} />
                  <ConstanceCard constance={{
                    streak_weeks: 0,
                    subtitle: 'Activité récente',
                    days: [
                      { day: 'L', count: 0, active: false },
                      { day: 'M', count: 0, active: false },
                      { day: 'M', count: 0, active: false },
                      { day: 'J', count: 0, active: false },
                      { day: 'V', count: 0, active: false },
                      { day: 'S', count: 0, active: false },
                      { day: 'D', count: 0, active: false },
                    ],
                    footer_text: `${activite.length} activité(s) enregistrée(s)`,
                    goal_text: '',
                  }} />
                </div>
              </div>

            </div>
          </main>

          <Footer />

          {/* Toast */}
          {toast && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-[#1C2620] text-white px-6 py-3 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#2D5A3D]">
              <span>✨</span>
              <span>{toast}</span>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell background="#F5F3ED">
          <div className="p-4 space-y-4 pb-20">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]/60 mb-2">
              <Link href="/" className="hover:text-[#1C2620]">Accueil</Link>
              <span>›</span>
              <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link>
              <span>›</span>
              <span className="text-[#1C2620] font-bold truncate">Profil de {profile.first_name}</span>
            </div>

            <HeroProfil 
              profile={profile as any} 
              onShareProfile={() => {
                if (typeof window !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('Lien du profil copié !');
                }
              }} 
            />
            
            <StatsBandeau profile={profile as any} />
            <MesCarnetsCard carnets={carnets as any} />
            <MesClubsCard clubs={clubs as any} />
            <BadgesCard badges={badges as any} trustScore={profile.trust_score ?? 50} />
          </div>

          {toast && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-[#1C2620] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#2D5A3D]">
              <span>✨</span>
              <span>{toast}</span>
            </div>
          )}
        </MobilePageShell>
      </div>
    </>
  );
}
