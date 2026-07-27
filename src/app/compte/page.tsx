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
import InventaireCTACard from '@/components/compte/InventaireCTACard';
import ParametresCompteCard from '@/components/compte/ParametresCompteCard';
import EditProfileModal from '@/components/compte/EditProfileModal';
import MobileCompteView from '@/components/compte/MobileCompteView';
import CompteFooter from '@/components/compte/CompteFooter';
import { MOCK_MARCELINE_DATA, UserProfile } from '@/lib/mock/compte-marceline';

export default function ComptePage() {
  const [activeTab, setActiveTab] = useState<CompteTab>('vue-d-ensemble');
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(MOCK_MARCELINE_DATA.profile);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const loadSavedProfile = () => {
      try {
        const saved = localStorage.getItem('user_profile_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          setProfile(prev => ({
            ...prev,
            first_name: parsed.first_name || prev.first_name,
            last_name: parsed.last_name || prev.last_name,
            bio: parsed.bio || prev.bio,
            location: parsed.location || prev.location,
            avatar_url: parsed.avatar_url || prev.avatar_url,
            hero_image_url: parsed.hero_image_url || prev.hero_image_url
          }));
        }
      } catch (e) {
        console.error("Error loading saved profile:", e);
      }
    };

    loadSavedProfile();

    const handleProfileUpdated = (e: any) => {
      const detail = e.detail || JSON.parse(localStorage.getItem('user_profile_data') || '{}');
      if (detail) {
        setProfile(prev => ({
          ...prev,
          first_name: detail.first_name || prev.first_name,
          last_name: detail.last_name || prev.last_name,
          bio: detail.bio || prev.bio,
          location: detail.location || prev.location,
          avatar_url: detail.avatar_url || prev.avatar_url,
          hero_image_url: detail.hero_image_url || prev.hero_image_url
        }));
      }
    };

    window.addEventListener('profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('profile_updated', handleProfileUpdated);
  }, []);

  const handleSaveProfile = (updatedFields: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updatedFields }));
    showToast('Profil mis à jour avec succès !');
  };

  const {
    prochainVoyage,
    aventures,
    carnets,
    clubs,
    commandes,
    badges,
    constance,
    activite,
    abonnement,
    inventaire,
  } = MOCK_MARCELINE_DATA;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'aventures':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <ProchainVoyageCard voyage={prochainVoyage} />
              <StatsGrid stats={profile.stats} />
              <MesAventuresCard aventures={aventures} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <ConstanceCard constance={constance} />
              <BadgesCard badges={badges} />
            </div>
          </div>
        );

      case 'carnets':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <MesCarnetsCard carnets={carnets} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <ActiviteCard activites={activite} />
              <InventaireCTACard inventaire={inventaire} />
            </div>
          </div>
        );

      case 'clubs':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <MesClubsCard clubs={clubs} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <ActiviteCard activites={activite} />
            </div>
          </div>
        );

      case 'commandes':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <CommandesCard commandes={commandes} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <AbonnementCard subscription={abonnement} />
              <InventaireCTACard inventaire={inventaire} />
            </div>
          </div>
        );

      case 'fidelite':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <BadgesCard badges={badges} />
              <StatsGrid stats={profile.stats} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <ConstanceCard constance={constance} />
              <AbonnementCard subscription={abonnement} />
            </div>
          </div>
        );

      case 'parametres':
        return (
          <div className="w-full">
            <ParametresCompteCard profile={profile} onSave={showToast} />
          </div>
        );

      case 'vue-d-ensemble':
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN (≈65%) */}
            <div className="lg:col-span-8 space-y-6">
              <ProchainVoyageCard voyage={prochainVoyage} />
              <StatsGrid stats={profile.stats} />
              <MesAventuresCard aventures={aventures} />
              <MesCarnetsCard carnets={carnets} />
              <MesClubsCard clubs={clubs} />
              <CommandesCard commandes={commandes} />
            </div>

            {/* RIGHT COLUMN (≈35%) */}
            <div className="lg:col-span-4 space-y-6">
              <BadgesCard badges={badges} />
              <ConstanceCard constance={constance} />
              <ActiviteCard activites={activite} />
              <AbonnementCard subscription={abonnement} />
              <InventaireCTACard inventaire={inventaire} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#1C2620] selection:bg-emerald-900/20 font-sans">
      
      {/* Mobile-only app-like view */}
      <MobileCompteView
        profile={profile}
        prochainVoyage={prochainVoyage}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenEdit={() => setEditModalOpen(true)}
      />

      {/* Desktop view (md and above) */}
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
                Vue d'ensemble d'un utilisateur riche · aventures, carnets, clubs, fidélité
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
              profile={profile}
              onEditProfile={() => setEditModalOpen(true)}
              onShareProfile={() => showToast('Lien du profil copié dans le presse-papiers !')}
            />

            {/* 3.5 Level & Key Stats Bandeau */}
            <StatsBandeau profile={profile} />

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
                commandes: 18,
                fidelite: profile.level.current_pts,
              }}
            />

            {/* Dynamic Tab Content */}
            {renderTabContent()}

          </div>
        </main>

        {/* 6. Full-Width Footer */}
        <CompteFooter profile={profile} />
      </div>

      {/* Edit Profile Modal (Accessible from both Desktop & Mobile) */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
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
