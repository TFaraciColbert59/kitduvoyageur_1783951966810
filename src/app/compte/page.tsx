'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { CompteBackground } from '@/components/compte/CompteBackground';
import HeroProfil from '@/components/compte/HeroProfil';
import StatsBandeau from '@/components/compte/StatsBandeau';
import { CompteTab } from '@/components/compte/TabsCompte';
import CompteLeftSidebar from '@/components/compte/CompteLeftSidebar';
import CompteRightSidebar from '@/components/compte/CompteRightSidebar';
import ProchainVoyageCard from '@/components/compte/ProchainVoyageCard';
import StatsGrid from '@/components/compte/StatsGrid';
import MesAventuresCard from '@/components/compte/MesAventuresCard';
import MesCarnetsCard from '@/components/compte/MesCarnetsCard';
import MesClubsCard from '@/components/compte/MesClubsCard';
import CommandesCard from '@/components/compte/CommandesCard';
import ParametresCompteCard from '@/components/compte/ParametresCompteCard';
import EditProfileModal from '@/components/compte/EditProfileModal';
import MobileCompteV2 from '@/components/compte/MobileCompteV2';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import CompteFooter from '@/components/compte/CompteFooter';
import dynamic from 'next/dynamic';

const AventuresTab = dynamic(() => import('@/components/compte/AventuresTab'), { ssr: false });
const CarnetsTab = dynamic(() => import('@/components/compte/CarnetsTab'), { ssr: false });
const ClubsTab = dynamic(() => import('@/components/compte/ClubsTab'), { ssr: false });
const CommandesTab = dynamic(() => import('@/components/compte/CommandesTab'), { ssr: false });
const FideliteTab = dynamic(() => import('@/components/compte/FideliteTab'), { ssr: false });
import { useAuth } from '@/contexts/AuthContext';
import { fetchDashboardData, type CompteDashboardData } from '@/lib/supabase/queries-compte';

export default function ComptePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CompteTab>('vue-d-ensemble');
  const [toast, setToast] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<CompteDashboardData | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function loadData() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchDashboardData(user.id);
        setDashboardData(data);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleSaveProfile = (updatedFields: any) => {
    showToast('Profil mis à jour avec succès !');
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center font-sans relative">
        <CompteBackground />
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#17402C] font-semibold">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-dvh flex items-center justify-center font-sans relative">
        <CompteBackground />
        <div className="glass rounded-3xl p-8 text-center max-w-md shadow-xl">
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="font-display font-bold text-2xl text-[#17402C] mb-2 tracking-tight">Connexion requise</h2>
          <p className="text-sm text-[#5A7064] mb-6">Connectez-vous pour accéder à votre tableau de bord voyageur.</p>
          <Link href="/connexion?mode=connexion" className="glass-capsule-btn primary">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const dashboard = dashboardData;
  const { profile, prochainVoyage, aventures, carnets, clubs, commandes, badges, constance, activite, abonnement, inventaire } = dashboard ?? {
    profile: null, prochainVoyage: null, aventures: [], carnets: [], clubs: [], commandes: [], badges: [], constance: null, activite: [], abonnement: null, inventaire: null,
  } as any;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'aventures':
        return <AventuresTab profile={profile as any} />;

      case 'carnets':
        return <CarnetsTab profile={profile as any} />;

      case 'clubs':
        return <ClubsTab profile={profile as any} />;

      case 'commandes':
        return <CommandesTab profile={profile as any} />;

      case 'fidelite':
        return <FideliteTab profile={profile as any} />;

      case 'parametres':
        return (
          <div className="w-full">
            <ParametresCompteCard profile={profile as any} onSave={showToast} />
          </div>
        );

      case 'vue-d-ensemble':
      default:
        return (
          <div className="space-y-6">
            {/* Hero and stats bandeau are shown ONLY on vue-d-ensemble */}
            <HeroProfil
              profile={profile as any}
              onEditProfile={() => setEditModalOpen(true)}
              onShareProfile={() => showToast('Lien du profil copié dans le presse-papiers !')}
            />

            <StatsBandeau profile={profile as any} />

            {prochainVoyage && <ProchainVoyageCard voyage={prochainVoyage} />}
            <StatsGrid stats={profile.stats} />
            <MesAventuresCard aventures={aventures as any} />
            <MesCarnetsCard carnets={carnets as any} />
            <MesClubsCard clubs={clubs as any} />
            <CommandesCard commandes={commandes as any} />

            <CompteFooter profile={profile as any} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] selection:bg-[#17402C]/10 font-sans relative">
      {/* Background immersif végétal */}
      <CompteBackground />

      {/* Mobile-only app-like view */}
      <div className="block md:hidden min-h-screen">
        <MobilePageShell background="transparent">
          <MobileCompteV2 />
        </MobilePageShell>
      </div>

      {/* Desktop view (md and above) — 3-column Fullscreen Cockpit */}
      {dashboard && (
        <div className="hidden md:flex flex-col h-full overflow-hidden">
          <Header />

          {/* Main 3-Column Cockpit Container — Safe distance under floating header */}
          <div className="flex-1 overflow-hidden pt-24 sm:pt-[96px] pb-5 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto">
            <div className="flex items-start gap-6 h-full">

              {/* LEFT COLUMN: NAVIGATION TABS SIDEBAR (280px) */}
              <div className="w-[280px] shrink-0 h-full overflow-hidden">
                <CompteLeftSidebar
                  activeTab={activeTab}
                  onTabChange={(tab) => {
                    if ((tab as string) === 'recompenses') {
                      router.push('/recompenses');
                      return;
                    }
                    setActiveTab(tab);
                    showToast(`Onglet : ${tab.replace('-', ' ')}`);
                  }}
                  profile={profile as any}
                  counts={{
                    aventures: profile.stats.sorties,
                    carnets: profile.stats.carnets,
                    clubs: profile.stats.clubs,
                    commandes: commandes.length,
                    fidelite: profile.level.current_pts,
                  }}
                  onEditProfile={() => setEditModalOpen(true)}
                  onShareProfile={() => showToast('Lien copié dans le presse-papiers !')}
                />
              </div>

              {/* CENTER COLUMN: MAIN TAB CONTENT */}
              <main className="flex-1 h-full overflow-y-auto no-scrollbar space-y-6 px-1">
                {renderTabContent()}
              </main>

              {/* RIGHT COLUMN: SIDEBAR WIDGETS (310px) */}
              <div className="w-[310px] shrink-0 h-full overflow-hidden">
                <CompteRightSidebar
                  badges={badges as any}
                  trustScore={profile?.trust_score ?? 50}
                  constance={constance}
                  activite={activite as any}
                  abonnement={abonnement}
                />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile as any}
        onSave={handleSaveProfile}
      />

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#17402C] text-white px-6 py-3 rounded-full text-xs font-extrabold animate-fade-in-up flex items-center gap-2 border border-white/20 shadow-2xl">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

