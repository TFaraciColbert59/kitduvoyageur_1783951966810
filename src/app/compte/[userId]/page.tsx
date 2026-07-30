'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import HeroProfil from '@/components/compte/HeroProfil';
import StatsBandeau from '@/components/compte/StatsBandeau';
import MesAventuresCard from '@/components/compte/MesAventuresCard';
import MesCarnetsCard from '@/components/compte/MesCarnetsCard';
import MesClubsCard from '@/components/compte/MesClubsCard';
import BadgesCard from '@/components/compte/BadgesCard';
import ConstanceCard from '@/components/compte/ConstanceCard';
import CompteFooter from '@/components/compte/CompteFooter';
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
  const userId = params?.userId as string;

  const [profile, setProfile] = useState<CompteUserProfile | null>(null);
  const [carnets, setCarnets] = useState<CompteCarnet[]>([]);
  const [clubs, setClubs] = useState<CompteClubItem[]>([]);
  const [badges, setBadges] = useState<CompteBadgeItem[]>([]);
  const [activite, setActivite] = useState<CompteActiviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      try {
        const [profileData, carnetsData, clubsData, badgesData, activiteData] = await Promise.all([
          fetchFullProfile(userId),
          fetchUserCarnets(userId),
          fetchUserClubs(userId),
          fetchUserBadges(userId),
          fetchUserActivities(userId),
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
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#5C6B5E] font-medium">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="font-display font-800 text-2xl text-[#1C2620] mb-2">Profil introuvable</h2>
          <p className="text-sm text-[#5C6B5E] mb-6">Ce voyageur n&apos;existe pas ou n&apos;a pas encore rejoint l&apos;aventure.</p>
          <Link
            href="/communaute"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C2620] text-white rounded-full text-sm font-bold hover:bg-[#2A3830] transition-colors"
          >
            Découvrir la communauté
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
          <main className="pt-24 pb-12">
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]/50">
                  <Link href="/" className="hover:text-[#1C2620]">Accueil</Link><span>›</span>
                  <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link><span>›</span>
                  <span className="text-[#1C2620] font-bold">Profil de {profile.first_name}</span>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300">Profil public vérifié</span>
              </div>
              <HeroProfil profile={profile as any} onShareProfile={() => alert('Lien du profil copié !')} />
              <StatsBandeau profile={profile as any} />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-8">
                <div className="lg:col-span-8 space-y-6">
                  <MesAventuresCard aventures={[]} />
                  <MesCarnetsCard carnets={carnets as any} />
                  <MesClubsCard clubs={clubs as any} />
                </div>
                <div className="lg:col-span-4 space-y-6">
                  <BadgesCard badges={badges as any} />
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
                    footer_text: `${activite.length} activité(s) récente(s)`,
                    goal_text: '',
                  }} />
                </div>
              </div>
            </div>
          </main>
          <CompteFooter profile={profile as any} />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Link href="/" style={{ color: 'rgba(28,38,32,0.5)', fontSize: '12px', textDecoration: 'none' }}>Accueil</Link>
              <span style={{ color: 'rgba(28,38,32,0.2)' }}>›</span>
              <Link href="/communaute" style={{ color: 'rgba(28,38,32,0.5)', fontSize: '12px', textDecoration: 'none' }}>Communauté</Link>
            </div>
            <HeroProfil profile={profile as any} onShareProfile={() => alert('Lien du profil copié !')} />
            <StatsBandeau profile={profile as any} />
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
