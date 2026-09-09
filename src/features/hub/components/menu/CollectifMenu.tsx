import {
  ArrowUpRight,
  CheckSquare,
  CreditCard,
  ListChecks,
  MailPlus,
  Map as MapIcon,
  MessageSquare,
  Users,
  Vote,
} from 'lucide-react';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import { BentoGrid } from '@/components/ui-layouts/bento-grid';
import { MenuCard } from './MenuCard';
import { QuickActions, type QuickAction } from './QuickActions';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import type { GroupeMenuSummary } from '../../server/getGroupeMenu';

export interface CollectifMenuProps {
  summary: GroupeMenuSummary;
  linkedTripSlug?: string | null;
}

const collectifRef: HubAdventureRef = { nature: 'collectif' };

function onglet(id: string): string {
  return `${hubSectionHref(collectifRef, 'groupe')}?onglet=${id}`;
}

/**
 * Hub V4 — MENU COLLECTIF en disposition BENTO (racine /hub).
 * [Groupe 6, Membres 6] → [Tâches 4, Équipement 4, Dépenses 4] →
 * [Décisions 3, Discussion 3, Invitations 3, Voyages liés 3].
 */
export function CollectifMenu({ summary, linkedTripSlug }: CollectifMenuProps) {
  const name = summary.name ?? 'Mon groupe';

  if (summary.kind === 'equipage') {
    const actions: QuickAction[] = [
      { href: hubSectionHref(collectifRef, 'groupe'), label: 'Membres', icon: Users },
      { href: hubSectionHref(collectifRef, 'invitations'), label: 'Invitations', icon: MailPlus },
      { href: hubSectionHref(collectifRef, 'voyages-lies'), label: 'Voyages', icon: MapIcon },
    ];
    const cells = [
      {
        key: 'groupe', span: 6 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'groupe')} icon={Users} label={name} tone="accent">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
              {summary.pendingInvites > 0 ? ` · ${summary.pendingInvites} invitation(s)` : ''}
            </p>
          </MenuCard>
        ),
      },
      {
        key: 'membres', span: 6 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'groupe')} icon={Users} label="Membres">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
            </p>
          </MenuCard>
        ),
      },
      {
        key: 'invitations', span: 4 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'invitations')} icon={MailPlus} label="Invitations">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.pendingInvites} /> en attente
            </p>
          </MenuCard>
        ),
      },
      {
        key: 'voyages-lies', span: 4 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} icon={MapIcon} label="Voyages liés">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.linkedTrips} /> expédition{summary.linkedTrips > 1 ? 's' : ''}
            </p>
          </MenuCard>
        ),
      },
      ...(linkedTripSlug
        ? [{
            key: 'entrer', span: 6 as const,
            node: (
              <MenuCard href={tripSwitchHref(linkedTripSlug)} icon={ArrowUpRight} label="Entrer dans le voyage">
                <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Ouvrir l&apos;expédition liée.</p>
              </MenuCard>
            ),
          }]
        : []),
    ];
    return (
      <div className="space-y-4">
        <QuickActions actions={actions} />
        <BentoGrid cells={cells} />
      </div>
    );
  }

  const actions: QuickAction[] = [
    { href: onglet('members'), label: 'Membres', icon: Users },
    { href: onglet('expenses'), label: 'Dépenses', icon: CreditCard },
    { href: onglet('tasks'), label: 'Tâches', icon: CheckSquare },
    { href: onglet('discussion'), label: 'Discussion', icon: MessageSquare },
  ];

  const cells = [
    {
      key: 'groupe', span: 6 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'groupe')} icon={Users} label={name} tone="accent">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
            {summary.departureLabel ? ` · ${summary.departureLabel}` : ''}
          </p>
          {summary.inviteCode && (
            <p className="text-[11px] font-mono text-[var(--lkv-text-secondary)]">Code {summary.inviteCode}</p>
          )}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]" style={{ width: `${summary.progression}%` }} />
          </div>
        </MenuCard>
      ),
    },
    {
      key: 'membres', span: 6 as const,
      node: (
        <MenuCard href={onglet('members')} icon={Users} label="Membres">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'tasks', span: 4 as const,
      node: (
        <MenuCard href={onglet('tasks')} icon={CheckSquare} label="Tâches">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.tasksOpen} /> à faire
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'equipment', span: 4 as const,
      node: (
        <MenuCard href={onglet('equipment')} icon={ListChecks} label="Équipement">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.equipmentCount} /> objet{summary.equipmentCount > 1 ? 's' : ''} partagé{summary.equipmentCount > 1 ? 's' : ''}
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'expenses', span: 4 as const,
      node: (
        <MenuCard href={onglet('expenses')} icon={CreditCard} label="Dépenses">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.expensesTotal} suffix=" €" /> engagés
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'decisions', span: 3 as const,
      node: (
        <MenuCard href={onglet('decisions')} icon={Vote} label="Décisions">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.pollsOpen} /> vote{summary.pollsOpen > 1 ? 's' : ''} ouvert{summary.pollsOpen > 1 ? 's' : ''}
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'discussion', span: 3 as const,
      node: (
        <MenuCard href={onglet('discussion')} icon={MessageSquare} label="Discussion">
          {summary.lastMessage ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--lkv-text-secondary)]">{summary.lastMessage}</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Aucun message.</p>
          )}
        </MenuCard>
      ),
    },
    {
      key: 'invitations', span: 3 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'invitations')} icon={MailPlus} label="Invitations">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.pendingInvites} /> en attente
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'voyages-lies', span: 3 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} icon={MapIcon} label="Voyages liés">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.linkedTrips} /> expédition{summary.linkedTrips > 1 ? 's' : ''}
          </p>
        </MenuCard>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <QuickActions actions={actions} />
      <BentoGrid cells={cells} />
    </div>
  );
}

export default CollectifMenu;