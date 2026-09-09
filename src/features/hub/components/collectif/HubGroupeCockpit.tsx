'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { getGroupeComplet } from '@/lib/queries/groupe';
import { createClient } from '@/lib/supabase/client';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import TabsGroupe from '@/components/groupes/TabsGroupe';
import HeroVoyage from '@/components/groupes/HeroVoyage';
import ProgressionCard from '@/components/groupes/ProgressionCard';
import ParcoursCard from '@/components/groupes/ParcoursCard';
import TachesCard from '@/components/groupes/TachesCard';
import EquipementCard from '@/components/groupes/EquipementCard';
import VoyageursCard from '@/components/groupes/VoyageursCard';

const DepensesCard = nextDynamic(() => import('@/components/groupes/DepensesCard'), { ssr: false });
const DecisionsCard = nextDynamic(() => import('@/components/groupes/DecisionsCard'), { ssr: false });
const DiscussionCard = nextDynamic(() => import('@/components/groupes/DiscussionCard'), { ssr: false });
const MobileGroupeView = nextDynamic(() => import('@/components/groupes/MobileGroupeView'), { ssr: false });

const VALID_TABS = ['overview', 'parcours', 'tasks', 'equipment', 'expenses', 'decisions', 'discussion', 'members'];

/**
 * Étape UX — Cockpit Groupe du hub (réintégration de l'ancien cockpit
 * /groupes/[id] supprimé). Les 7 onglets du widget legacy (Vue d'ensemble,
 * Tâches, Équipement, Dépenses, Décisions, Discussion, Membres) alimentés
 * par getGroupeComplet() — mobile en accordéon (MobileGroupeView),
 * desktop en onglets horizontaux dans la colonne du hub.
 */
export function HubGroupeCockpit({ groupId, initialTab }: { groupId: string; initialTab?: string }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [linkedTrip, setLinkedTrip] = useState<{ id: string; slug: string; title: string } | null>(null);
  const loadedRef = useRef(false);

  // Mobile : le cockpit écoute l'événement onglet (MobileGroupeView).
  useEffect(() => {
    if (initialTab && VALID_TABS.includes(initialTab)) {
      window.dispatchEvent(new CustomEvent('groupe-cockpit-tab-change', { detail: initialTab }));
    }
  }, [initialTab]);

  const loadData = useCallback(async () => {
    const isFirstLoad = !loadedRef.current;
    if (isFirstLoad) setLoading(true);
    try {
      const result = await getGroupeComplet(groupId);
      setData(result);
      const realId = result?.id || groupId;
      const supabase = createClient();
      const { data: tripData } = await supabase
        .from('trips')
        .select('id, slug, title')
        .eq('group_id', realId)
        .maybeSingle();
      setLinkedTrip((tripData as { id: string; slug: string; title: string } | null) ?? null);
    } catch (err) {
      console.error('[HubGroupeCockpit] load error:', err);
      setData(null);
    } finally {
      setLoading(false);
      loadedRef.current = true;
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) loadData();
    else setLoading(false);
  }, [groupId, loadData]);

  const refreshData = useCallback(() => loadData(), [loadData]);

  if (loading) {
    return (
      <div className="glass p-8 text-center max-w-md w-full mx-auto relative z-10" aria-live="polite">
        <div className="w-8 h-8 border-2 border-[var(--lkv-text-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="font-display font-bold text-lg text-[var(--lkv-text-primary)]">Chargement du groupe...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass p-8 text-center max-w-md w-full mx-auto relative z-10">
        <h2 className="font-display font-bold text-xl text-[var(--lkv-text-primary)] mb-2">Groupe inaccessible</h2>
        <p className="text-sm text-[var(--lkv-text-secondary)] mb-6">
          Ce groupe n&apos;existe plus ou vous n&apos;y avez plus accès.
        </p>
        <button
          onClick={refreshData}
          className="glass-capsule-btn primary px-5 py-2.5 text-xs font-bold min-h-[44px]"
        >
          <span className="relative z-10">Réessayer</span>
        </button>
      </div>
    );
  }

  const members = data.travelers || [];
  const isCurrentUserOrganizer = !!user && members.some(
    (m: any) => m.user_id === user.id && (m.role_code === 'organizer' || m.role_code === 'co_organizer')
  );
  const cardClass = 'glass rounded-[var(--lkv-radius-card)]';

  return (
    <>
      {/* ── MOBILE : accordéon legacy complet ── */}
      <div className="md:hidden -mx-4">
        <MobileGroupeView
          data={data}
          groupId={data.id}
          user={user}
          members={members}
          onRefresh={refreshData}
          linkedTrip={linkedTrip}
        />
      </div>

      {/* ── DESKTOP : cockpit à onglets dans la colonne du hub ── */}
      <div className="hidden md:block space-y-4">
        <TabsGroupe
          layoutVariant="horizontal"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
        />

        {linkedTrip && (
          <Link
            href={tripSectionHref(linkedTrip.slug, 'overview')}
            className={`${cardClass} p-4 border border-white/70 shadow-sm flex items-center justify-between gap-4`}
          >
            <div className="min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] block">
                Expédition LKDV associée
              </span>
              <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] truncate">{linkedTrip.title}</h4>
            </div>
            <span className="glass-capsule-btn primary text-xs font-bold px-4 min-h-[44px] flex items-center shrink-0">
              Ouvrir le cockpit →
            </span>
          </Link>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <HeroVoyage data={data} groupId={data.id} inviteCode={data.inviteCode} onOpenChat={() => setActiveTab('discussion')} />
            <div className="grid grid-cols-2 gap-4">
              <ProgressionCard progression={data.meta.progression} />
              <ParcoursCard groupId={data.id} trail={data.trail} meta={data.meta} />
            </div>
            <TachesCard tasks={data.tasks} groupId={data.id} onRefresh={refreshData} user={user} members={members} />
          </div>
        )}

        {activeTab === 'tasks' && <div className={cardClass}><TachesCard tasks={data.tasks} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></div>}
        {activeTab === 'equipment' && <div className={cardClass}><EquipementCard equipment={data.equipment} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></div>}
        {activeTab === 'expenses' && <div className={cardClass}><DepensesCard expenses={data.expenses} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></div>}
        {activeTab === 'decisions' && <div className={cardClass}><DecisionsCard decisions={data.decisions} groupId={data.id} onRefresh={refreshData} user={user} /></div>}
        {activeTab === 'discussion' && <div className={cardClass}><DiscussionCard discussions={data.discussions} groupId={data.id} onRefresh={refreshData} user={user} /></div>}
        {activeTab === 'members' && (
          <div className={cardClass}>
            <VoyageursCard travelers={data.travelers} groupId={data.id} onRefresh={refreshData} user={user} members={members} group={data} isOrganizer={isCurrentUserOrganizer} />
          </div>
        )}
      </div>
    </>
  );
}

export default HubGroupeCockpit;
