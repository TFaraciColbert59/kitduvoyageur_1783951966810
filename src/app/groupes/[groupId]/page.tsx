'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LkvIcon from '@/components/ui/LkvIcon';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CompteBackground from '@/components/compte/CompteBackground';
import { getGroupeComplet } from '@/lib/queries/groupe';
import nextDynamic from 'next/dynamic';

// Components — always visible
import HeroVoyage from '@/components/groupes/HeroVoyage';
import TabsGroupe from '@/components/groupes/TabsGroupe';
import ProgressionCard from '@/components/groupes/ProgressionCard';
import ParcoursCard from '@/components/groupes/ParcoursCard';
import TachesCard from '@/components/groupes/TachesCard';
import EquipementCard from '@/components/groupes/EquipementCard';
import CountdownCard from '@/components/groupes/CountdownCard';
import VoyageursCard from '@/components/groupes/VoyageursCard';
import ActiviteCard from '@/components/groupes/ActiviteCard';
import AProposCard from '@/components/groupes/AProposCard';
import CarnetCTACard from '@/components/groupes/CarnetCTACard';
import SafetyReminderCard from '@/components/groupes/SafetyReminderCard';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

// Dynamically imported — load on demand
const DepensesCard = nextDynamic(() => import('@/components/groupes/DepensesCard'), { ssr: false });
const DecisionsCard = nextDynamic(() => import('@/components/groupes/DecisionsCard'), { ssr: false });
const DiscussionCard = nextDynamic(() => import('@/components/groupes/DiscussionCard'), { ssr: false });
const MobileGroupeView = nextDynamic(() => import('@/components/groupes/MobileGroupeView'), { ssr: false });

export const dynamic = 'force-dynamic';

export default function GroupesPage() {
  const params = useParams();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [formattedData, setFormattedData] = useState<any>(null);
  const loadedRef = useRef(false);

  const loadData = async (rawGroupId: string) => {
    const isFirstLoad = !loadedRef.current;
    if (isFirstLoad) setLoading(true);
    try {
      const data = await getGroupeComplet(rawGroupId);
      setFormattedData(data);
    } catch (err) {
      console.error('Error loading group data:', err);
    } finally {
      setLoading(false);
      loadedRef.current = true;
    }
  };

  useEffect(() => {
    const rawId = params?.groupId as string;
    if (rawId) loadData(rawId);
    else setLoading(false);
  }, [params?.groupId]);

  const refreshData = () => {
    const rawId = params?.groupId as string;
    if (rawId) loadData(rawId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <CompteBackground />
        <div className="glass p-8 text-center max-w-md w-full relative z-10">
          <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="font-display font-bold text-xl text-[#17402C]">Chargement du cockpit...</div>
        </div>
      </div>
    );
  }

  if (!formattedData) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <CompteBackground />
        <div className="glass p-8 text-center max-w-md w-full relative z-10">
          <h2 className="font-display font-bold text-2xl text-[#17402C] mb-2">Groupe introuvable</h2>
          <p className="text-sm text-[#5C6B5E] mb-6">Ce groupe n'existe pas ou vous n'y avez pas accès.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={refreshData}
              className="glass-capsule-btn primary px-5 py-2.5 text-xs font-bold"
            >
              <span className="relative z-10">Réessayer</span>
            </button>
            <Link href="/groupes" className="glass-capsule-btn px-5 py-2.5 text-xs font-semibold">
              <span className="relative z-10">Retour aux groupes</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const groupId = formattedData.id || '';
  const members = formattedData.travelers || [];
  const isCurrentUserOrganizer = !!user && members.some(
    (m: any) => m.user_id === user.id && (m.role_code === 'organizer' || m.role_code === 'co_organizer')
  );

  return (
    <div className="min-h-screen bg-transparent font-sans">
      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell videoBackground={true}>
          <MobileGroupeView data={formattedData} groupId={groupId} user={user} members={members} onRefresh={refreshData} />
        </MobilePageShell>
      </div>

      {/* ── DESKTOP (3-Column Fullscreen 100dvh + CompteBackground) ── */}
      <div className="hidden md:block">
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
          <CompteBackground />
          <Header />

          {/* MAIN FULLSCREEN 3-COLUMN GRID */}
          <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">

            {/* COLONNE GAUCHE (Nav & Vertical Cockpit Side Tabs) - 230px */}
            <aside className="w-[230px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3">
              <CommunityHubNav
                layoutVariant="vertical"
                activeTab="groupes"
              />

              {/* VERTICAL SIDE TABS FOR COCKPIT SECTIONS */}
              <TabsGroupe
                layoutVariant="vertical"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                data={formattedData}
              />
            </aside>

            {/* COLONNE CENTRALE (FLUX DE CONTENU SCROLLABLE UNIQUE) */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-5">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
                <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
                <LkvIcon name="chevron-right" size={12} />
                <Link href="/groupes" className="hover:text-[#17402C] transition-colors">Mes groupes</Link>
                <LkvIcon name="chevron-right" size={12} />
                <span className="text-[#17402C] font-semibold">{formattedData.meta.titlePrefix} {formattedData.meta.titleSuffix}</span>
              </div>

              {/* OVERVIEW TAB ONLY: Hero & Progression Card */}
              {activeTab === 'overview' && (
                <>
                  <HeroVoyage data={formattedData} groupId={groupId} inviteCode={formattedData.inviteCode} onOpenChat={() => setActiveTab('discussion')} />
                  <ProgressionCard progression={formattedData.meta.progression} />
                  <ParcoursCard groupId={groupId} trail={formattedData.trail} meta={formattedData.meta} />
                  <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                  <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                </>
              )}

              {/* INDIVIDUAL SPECIFIC TABS: Only display section card (Hero & Progression hidden) */}
              {activeTab === 'tasks' && <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'equipment' && <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'expenses' && <DepensesCard expenses={formattedData.expenses} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'decisions' && <DecisionsCard decisions={formattedData.decisions} groupId={groupId} onRefresh={refreshData} user={user} />}
              {activeTab === 'discussion' && <DiscussionCard discussions={formattedData.discussions} groupId={groupId} onRefresh={refreshData} user={user} />}
              {activeTab === 'members' && <VoyageursCard travelers={formattedData.travelers} groupId={groupId} onRefresh={refreshData} user={user} members={members} group={formattedData} isOrganizer={isCurrentUserOrganizer} />}
            </div>

            {/* COLONNE DROITE (WIDGETS SIDEBAR) - 300px */}
            <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <CountdownCard data={formattedData} />
              <VoyageursCard travelers={formattedData.travelers} groupId={groupId} onRefresh={refreshData} user={user} members={members} group={formattedData} isOrganizer={isCurrentUserOrganizer} />
              <AProposCard data={formattedData} />
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}
