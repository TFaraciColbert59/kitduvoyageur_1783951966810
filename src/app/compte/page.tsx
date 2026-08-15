'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import HeroProfil from '@/components/compte/HeroProfil';
import StatsBandeau from '@/components/compte/StatsBandeau';
import TabsCompte, { CompteTab } from '@/components/compte/TabsCompte';
import ProchainVoyageCard from '@/components/compte/ProchainVoyageCard';
import StatsGrid from '@/components/compte/StatsGrid';
import MesAventuresCard from '@/components/compte/MesAventuresCard';
import MesCarnetsCard from '@/components/compte/MesCarnetsCard';
import MesClubsCard from '@/components/compte/MesClubsCard';
import CommandesCard from '@/components/compte/CommandesCard';
import BadgesCard from '@/components/compte/BadgesCard';
import ConstanceCard from '@/components/compte/ConstanceCard';
import ActiviteCard from '@/components/compte/ActiviteCard';
import AbonnementCard from '@/components/compte/AbonnementCard';
import InventaireCTACard from '@/components/compte/mon-materielCTACard';
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
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#5C6B5E] font-medium">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="font-display font-800 text-2xl text-[#1C2620] mb-2">Connexion requise</h2>
          <p className="text-sm text-[#5C6B5E] mb-6">Connectez-vous pour accéder à votre tableau de bord voyageur.</p>
          <Link
            href="/connexion?mode=connexion"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C2620] text-white rounded-full text-sm font-bold hover:bg-[#2A3830] transition-colors"
          >
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN (≈65%) */}
            <div className="lg:col-span-8 space-y-6">
              {prochainVoyage && <ProchainVoyageCard voyage={prochainVoyage} />}
              <StatsGrid stats={profile.stats} />
              <MesAventuresCard aventures={aventures as any} />
              <MesCarnetsCard carnets={carnets as any} />
              <MesClubsCard clubs={clubs as any} />
              <CommandesCard commandes={commandes as any} />
            </div>

            {/* RIGHT COLUMN (≈35%) */}
            <div className="lg:col-span-4 space-y-6">
              <BadgesCard badges={badges as any} />
              <ConstanceCard constance={constance} />
              <ActiviteCard activites={activite as any} />
              <AbonnementCard subscription={abonnement} />
              <InventaireCTACard inventaire={inventaire} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#1C2620] selection:bg-emerald-900/20 font-sans">

      {/* Mobile-only app-like view (refonte) */}
      <div className="block md:hidden">
        <MobilePageShell background="#FAF7F1">
          <MobileCompteV2 />
        </MobilePageShell>
      </div>

      {/* Desktop view (md and above) — strictement inchangé */}
      {dashboard && (
      <div className="hidden md:block">
        <Header />

        <main className="pt-24 pb-12">
          {/* Main Container */}
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">

            {/* 3.1 Page Header Title */}
            <div className="mb-6">
              <h1 className="font-display font-900 text-3xl sm:text-4xl text-[#1C2620] tracking-tight">
                Compte — Dashboard voyageur
              </h1>
              <p className="text-sm text-[#1C2620]/60 font-medium mt-1">
                Vue d&apos;ensemble · aventures, carnets, clubs, fidélité
              </p>
            </div>

            {/* 3.3 Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]/50 mb-6">
              <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
              <span>›</span>
              <span className="text-[#1C2620]/70">Mon compte</span>
              <span>›</span>
              <span className="text-[#1C2620] font-bold uppercase tracking-wider text-[11px]">
                {activeTab.replace('-', ' ')}
              </span>
            </div>

            {/* 3.4 Photographic Profile Hero */}
            <HeroProfil
              profile={profile as any}
              onEditProfile={() => setEditModalOpen(true)}
              onShareProfile={() => showToast('Lien du profil copié dans le presse-papiers !')}
            />

            {/* 3.5 Level & Key Stats Bandeau */}
            <StatsBandeau profile={profile as any} />

            {/* 3.6 Internal Navigation Tabs */}
            <TabsCompte
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                showToast(`Onglet : ${tab.replace('-', ' ')}`);
              }}
              counts={{
                aventures: profile.stats.sorties,
                carnets: profile.stats.carnets,
                clubs: profile.stats.clubs,
                commandes: commandes.length,
                fidelite: profile.level.current_pts,
              }}
            />

            {/* Dynamic Tab Content */}
            {renderTabContent()}

          </div>
        </main>

        {/* 6. Full-Width Footer */}
        <CompteFooter profile={profile as any} />
      </div>
      )}

      {/* Edit Profile Modal (Accessible from both Desktop & Mobile) */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile as any}
        onSave={handleSaveProfile}
      />

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#1C2620] text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-2xl animate-fade-in-up flex items-center gap-2 border border-white/20">
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
}
