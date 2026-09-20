'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, ErrorState, LoadingState } from '@/components/ui';
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
import { GroupTrekPanel } from '@/features/adventure-intelligence/ui/GroupTrekPanel';
import { convertEphemeralGroup } from '@/features/tribu/actions/ephemeralGroup';
import { formatEphemeralCountdown } from '@/features/tribu/lib/ephemeral';
import GroupActivityLog from '@/features/tribu/components/GroupActivityLog';
import GroupTaskTemplatesPanel from '@/features/tribu/components/GroupTaskTemplatesPanel';
import LiveSharePanel from '@/features/tribu/components/LiveSharePanel';

const DepensesCard = nextDynamic(() => import('@/components/groupes/DepensesCard'), { ssr: false });
const DecisionsCard = nextDynamic(() => import('@/components/groupes/DecisionsCard'), { ssr: false });
const DiscussionCard = nextDynamic(() => import('@/components/groupes/DiscussionCard'), { ssr: false });
const GroupeMobileExperience = nextDynamic(
  () => import('@/features/hub/components/mobile/groupe/GroupeMobileExperience'),
  { ssr: false }
);

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
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const loadedRef = useRef(false);

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

  const handleConvertEphemeral = useCallback(async () => {
    if (!data?.id) return;
    setConverting(true);
    setConvertError(null);
    const result = await convertEphemeralGroup(data.id);
    setConverting(false);
    if (result.ok) {
      await refreshData();
    } else {
      setConvertError(result.error);
    }
  }, [data?.id, refreshData]);

  if (loading) {
    return (
      <Card className="relative z-10 mx-auto w-full max-w-md" aria-live="polite">
        <LoadingState label="Chargement du groupe…" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="relative z-10 mx-auto w-full max-w-md">
        <ErrorState
          title="Groupe inaccessible"
          message="Ce groupe n'existe plus ou vous n'y avez plus accès."
          onRetry={refreshData}
        />
      </Card>
    );
  }

  const members = data.travelers || [];
  const isCurrentUserOrganizer = !!user && members.some(
    (m: any) => m.user_id === user.id && (m.role_code === 'organizer' || m.role_code === 'co_organizer')
  );

  return (
    <>
      {/* ── MOBILE / TABLETTE : expérience collectif pleine page ── */}
      <div className="lg:hidden -mx-4">
        <GroupeMobileExperience
          data={data}
          groupId={data.id}
          user={user}
          members={members}
          onRefresh={refreshData}
          linkedTrip={linkedTrip}
          initialTab={initialTab}
        />
      </div>

      {/* ── DESKTOP : cockpit à onglets dans la colonne du hub ── */}
      <div className="hidden lg:block space-y-4">
        <TabsGroupe
          layoutVariant="horizontal"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
        />

        {data.ephemeral && (
          <Card
            variant="compact"
            className="flex items-center justify-between gap-4"
            data-testid="group-ephemeral-banner"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] block">
                Sortie du jour
              </span>
              <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] truncate">
                {formatEphemeralCountdown(data.ephemeral.autoDissolveAt) ?? 'Groupe éclair'}
              </h4>
            </div>
            {isCurrentUserOrganizer && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConvertEphemeral}
                disabled={converting}
                className="min-h-[44px] shrink-0"
                data-testid="group-ephemeral-convert"
              >
                {converting ? 'Conversion…' : 'Transformer en groupe complet'}
              </Button>
            )}
            {convertError && (
              <p role="alert" className="text-[10px] font-bold text-[var(--lkv-danger)]">
                {convertError}
              </p>
            )}
          </Card>
        )}

        {data.parentClub && (
          <Link
            href={`/clubs/${data.parentClub.slug || data.parentClub.id}`}
            className="block"
            data-testid="group-parent-club-badge"
          >
            <Card variant="compact" className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] block">
                  Né du club
                </span>
                <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] truncate">
                  {data.parentClub.name}
                </h4>
              </div>
              <span className="glass-capsule-btn text-xs font-bold px-4 min-h-[44px] flex items-center shrink-0">
                Voir le club →
              </span>
            </Card>
          </Link>
        )}

        {data.parentClub && (
          <GroupTaskTemplatesPanel
            groupId={data.id}
            clubId={data.parentClub.id}
            onApplied={refreshData}
          />
        )}

        <LiveSharePanel groupId={data.id} isOrganizer={isCurrentUserOrganizer} />

        {linkedTrip && (
          <Link href={tripSectionHref(linkedTrip.slug, 'overview')} className="block">
            <Card variant="compact" className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] block">
                  Expédition LKDV associée
                </span>
                <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] truncate">{linkedTrip.title}</h4>
              </div>
              <span className="glass-capsule-btn primary text-xs font-bold px-4 min-h-[44px] flex items-center shrink-0">
                Ouvrir le cockpit →
              </span>
            </Card>
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
            <GroupActivityLog entries={data.activityLog ?? []} />
          </div>
        )}

        {activeTab === 'tasks' && <Card className="p-0"><TachesCard tasks={data.tasks} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></Card>}
        {activeTab === 'equipment' && <Card className="p-0"><EquipementCard equipment={data.equipment} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></Card>}
        {activeTab === 'expenses' && <Card className="p-0"><DepensesCard expenses={data.expenses} groupId={data.id} onRefresh={refreshData} user={user} members={members} /></Card>}
        {activeTab === 'decisions' && <Card className="p-0"><DecisionsCard decisions={data.decisions} groupId={data.id} onRefresh={refreshData} user={user} /></Card>}
        {activeTab === 'discussion' && <Card className="p-0"><DiscussionCard discussions={data.discussions} groupId={data.id} onRefresh={refreshData} user={user} /></Card>}
        {activeTab === 'members' && (
          <Card className="p-0">
            <VoyageursCard travelers={data.travelers} groupId={data.id} onRefresh={refreshData} user={user} members={members} group={data} isOrganizer={isCurrentUserOrganizer} />
          </Card>
        )}
      </div>

      {/* A13 (S3) — analyse collective persistée (groupe + trek), montée dans
          le cockpit existant sans toucher la page [section]. */}
      <div className="mt-4">
        <GroupTrekPanel tripId={linkedTrip?.id ?? null} />
      </div>
    </>
  );
}

export default HubGroupeCockpit;
