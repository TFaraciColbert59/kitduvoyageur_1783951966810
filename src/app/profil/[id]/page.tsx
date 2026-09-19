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
import CompteBackground from '@/components/compte/CompteBackground';
import { MarbleZone } from '@/components/glass/MarbleZone';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import PublicMobileProfileView from '@/components/profile/PublicMobileProfileView';
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
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#EEF3EC] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#CCE0D4] font-medium">Chargement du profil voyageur...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="glass text-center max-w-md p-8 rounded-3xl">
          <p className="text-5xl mb-4">🧭</p>
          <h2 className="font-display font-800 text-2xl text-[var(--lkv-primary)] mb-2">Profil introuvable</h2>
          <p className="text-sm text-[var(--lkv-text-muted)] mb-6">Ce voyageur n&apos;existe pas ou son profil est indisponible.</p>
          <Link
            href="/communaute"
            className="glass-capsule-btn primary text-xs font-bold"
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
        <div className="min-h-screen bg-transparent text-[var(--lkv-primary)] selection:bg-forest-900/20 font-sans relative">
          <CompteBackground />
          <MarbleZone />
          <Header />
          
          <main className="pt-24 pb-16">
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
              
              {/* Top Navigation & Status */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--lkv-text-muted)]">
                  <Link href="/" className="hover:text-[var(--lkv-primary)] transition-colors">Accueil</Link>
                  <span>›</span>
                  <Link href="/communaute" className="hover:text-[var(--lkv-primary)] transition-colors">Communauté</Link>
                  <span>›</span>
                  <span className="text-[var(--lkv-primary)] font-bold">Profil de {profile.first_name}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-forest-100 text-forest-900 rounded-full text-xs font-bold border border-forest-300 flex items-center gap-1.5">
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
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-[var(--lkv-primary)] text-white px-6 py-3 rounded-full text-xs font-bold  flex items-center gap-2 border border-[var(--lkv-primary)]">
              <span>✨</span>
              <span>{toast}</span>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        {/* safeTop=false: PublicMobileProfileView embarque son propre header sticky (PublicMobileProfileView.tsx:67)
            qui calcule pt-[max(10px,env(safe-area-inset-top))] */}
        <MobilePageShell safeTop={false} background="transparent">
          <PublicMobileProfileView
            profile={profile as any}
            carnets={carnets as any}
            clubs={clubs as any}
            badges={badges as any}
            activite={activite as any}
            onShare={() => {
              if (typeof window !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                showToast('Lien du profil copié dans le presse-papiers !');
              }
            }}
          />

          {toast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-[var(--lkv-primary)] text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 border border-white/20 shadow-xl">
              <span>✨</span>
              <span>{toast}</span>
            </div>
          )}
        </MobilePageShell>
      </div>
    </>
  );
}
