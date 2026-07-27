'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { getGroupeComplet } from '@/lib/queries/groupe';

// Components
import HeroVoyage from '@/components/groupes/HeroVoyage';
import TabsGroupe from '@/components/groupes/TabsGroupe';
import ProgressionCard from '@/components/groupes/ProgressionCard';
import ParcoursCard from '@/components/groupes/ParcoursCard';
import TachesCard from '@/components/groupes/TachesCard';
import EquipementCard from '@/components/groupes/EquipementCard';
import DepensesCard from '@/components/groupes/DepensesCard';
import DecisionsCard from '@/components/groupes/DecisionsCard';
import DiscussionCard from '@/components/groupes/DiscussionCard';
import CountdownCard from '@/components/groupes/CountdownCard';
import VoyageursCard from '@/components/groupes/VoyageursCard';
import ActiviteCard from '@/components/groupes/ActiviteCard';
import AProposCard from '@/components/groupes/AProposCard';
import CarnetCTACard from '@/components/groupes/CarnetCTACard';
import MobileGroupeView from '@/components/groupes/MobileGroupeView';

export const dynamic = 'force-dynamic';

export default function GroupesPage() {
  const params = useParams();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [formattedData, setFormattedData] = useState<any>(null);

  const loadData = async (rawGroupId: string) => {
    setLoading(true);
    try {
      const data = await getGroupeComplet(rawGroupId);
      setFormattedData(data);
    } catch (err) {
      console.error('Error loading group data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rawId = (params?.groupId as string) || 'chartreuse-1';
    loadData(rawId);
  }, [params?.groupId]);

  const refreshData = () => {
    const rawId = (params?.groupId as string) || 'chartreuse-1';
    loadData(rawId);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#E7E3D6] flex items-center justify-center font-display text-2xl text-[#1C2620]">Chargement du cockpit...</div>;
  }

  if (!formattedData) {
    return (
      <div className="min-h-screen bg-[#E7E3D6] flex flex-col items-center justify-center">
        <h2 className="font-display text-2xl text-[#1C2620] mb-4">Groupe introuvable</h2>
        <p className="text-sm text-[#1C2620]/60 mb-6">Ce groupe n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
        <Link href="/groupes" className="px-5 py-2.5 bg-[#33463C] text-[#E7E3D6] rounded-full text-sm font-bold">Retour aux groupes</Link>
      </div>
    );
  }

  const groupId = formattedData.id || 'chartreuse-1';
  const members = formattedData.travelers || [];

  return (
    <div className="min-h-screen bg-[#E7E3D6] font-sans">
      <MobileGroupeView data={formattedData} groupId={groupId} user={user} members={members} onRefresh={refreshData} />

      <div className="hidden md:block">
        <Header />

        <main className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
          <div className="flex items-center gap-2 text-xs font-medium text-[#1C2620]/50 mb-6">
            <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} />
            <Link href="/groupes" className="hover:text-[#1C2620]">Mes groupes</Link>
            <Icon name="ChevronRightIcon" size={12} />
            <span className="text-[#1C2620]">{formattedData.meta.titlePrefix} {formattedData.meta.titleSuffix}</span>
          </div>

          <HeroVoyage data={formattedData} />
          
          <TabsGroupe activeTab={activeTab} setActiveTab={setActiveTab} data={formattedData} />

          <div className="grid grid-cols-12 gap-6 mt-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <ProgressionCard progression={formattedData.meta.progression} />
              
              {activeTab === 'overview' && (
                <>
                  <ParcoursCard />
                  <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                  <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />
                </>
              )}

              {activeTab === 'tasks' && <TachesCard tasks={formattedData.tasks} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'equipment' && <EquipementCard equipment={formattedData.equipment} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'expenses' && <DepensesCard expenses={formattedData.expenses} groupId={groupId} onRefresh={refreshData} user={user} members={members} />}
              {activeTab === 'decisions' && <DecisionsCard decisions={formattedData.decisions} groupId={groupId} onRefresh={refreshData} user={user} />}
              {activeTab === 'discussion' && <DiscussionCard discussions={formattedData.discussions} groupId={groupId} onRefresh={refreshData} user={user} />}
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
              <CountdownCard data={formattedData} />
              <VoyageursCard travelers={formattedData.travelers} groupId={groupId} onRefresh={refreshData} user={user} members={members} group={formattedData} isOrganizer={true} />
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
