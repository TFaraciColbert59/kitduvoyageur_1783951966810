'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LkvIcon from '@/components/ui/LkvIcon';
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

// Dynamically imported — only load when tab is active
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
    // N'affiche le plein écran de chargement que pour le tout premier chargement.
    // Les rafraîchissements silencieux (toggle, ajout, suppression…) ne font pas
    // s'effondrer la page (évite le « scroll remonté en haut » à chaque action).
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
    return <div className="min-h-screen bg-[#E7E3D6] flex items-center justify-center font-display text-2xl text-[#1C2620]">Chargement du cockpit...</div>;
  }

  if (!formattedData) {
    return (
      <div className="min-h-screen bg-[#E7E3D6] flex flex-col items-center justify-center">
        <h2 className="font-display text-2xl text-[#1C2620] mb-4">Groupe introuvable</h2>
        <p className="text-sm text-[#1C2620]/60 mb-6">Ce groupe n'existe pas ou vous n'y avez pas accès.</p>
        <div className="flex gap-3">
          <button
            onClick={refreshData}
            className="px-5 py-2.5 bg-[#17402C] text-[#E7E3D6] rounded-full text-sm font-bold hover:bg-[#0F2B1D] transition-colors"
          >
            Réessayer
          </button>
          <Link href="/groupes" className="px-5 py-2.5 bg-[#33463C] text-[#E7E3D6] rounded-full text-sm font-bold">Retour aux groupes</Link>
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
    <div className="min-h-screen bg-[#E7E3D6] font-sans">
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileGroupeView data={formattedData} groupId={groupId} user={user} members={members} onRefresh={refreshData} />
        </MobilePageShell>
      </div>

      <div className="hidden md:block">
        <Header />

        <main className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
          <div className="flex items-center gap-2 text-xs font-medium text-[#1C2620]/50 mb-6">
            <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link>
            <LkvIcon name="chevron-right" size={12} />
            <Link href="/groupes" className="hover:text-[#1C2620]">Mes groupes</Link>
            <LkvIcon name="chevron-right" size={12} />
            <span className="text-[#1C2620]">{formattedData.meta.titlePrefix} {formattedData.meta.titleSuffix}</span>
          </div>

          <HeroVoyage data={formattedData} groupId={groupId} inviteCode={formattedData.inviteCode} onOpenChat={() => setActiveTab('discussion')} />
          
          <TabsGroupe activeTab={activeTab} setActiveTab={setActiveTab} data={formattedData} />

          <div className="grid grid-cols-12 gap-6 mt-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <ProgressionCard progression={formattedData.meta.progression} />
              
              {activeTab === 'overview' && (
                <>
                  <ParcoursCard groupId={groupId} />
                  <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                  <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                </>
              )}

              {activeTab === 'tasks' && <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'equipment' && <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'expenses' && <DepensesCard expenses={formattedData.expenses} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'decisions' && <DecisionsCard decisions={formattedData.decisions} groupId={groupId} onRefresh={refreshData} user={user} />}
              {activeTab === 'discussion' && <DiscussionCard discussions={formattedData.discussions} groupId={groupId} onRefresh={refreshData} user={user} />}
              {activeTab === 'members' && <VoyageursCard travelers={formattedData.travelers} groupId={groupId} onRefresh={refreshData} user={user} members={members} group={formattedData} isOrganizer={isCurrentUserOrganizer} />}
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
              <SafetyReminderCard />
              <CountdownCard data={formattedData} />
              <VoyageursCard travelers={formattedData.travelers} groupId={groupId} onRefresh={refreshData} user={user} members={members} group={formattedData} isOrganizer={isCurrentUserOrganizer} />
              <ActiviteCard activities={formattedData.activities} />
              <AProposCard data={formattedData} />
              <CarnetCTACard />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}