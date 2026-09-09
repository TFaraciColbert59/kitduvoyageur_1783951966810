import {
  CheckSquare,
  CreditCard,
  MailPlus,
  Map as MapIcon,
  MessageSquare,
  Users,
} from 'lucide-react';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import { BentoGrid } from '@/components/ui-layouts/bento-grid';
import { MenuCard } from './MenuCard';
import { QuickActions, type QuickAction } from './QuickActions';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { ActivityIdentityBar } from './ActivityIdentityBar';
import { NextActionCard, type NextActionSignal } from './NextActionCard';
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
    const equipageNext: NextActionSignal[] = [];
    if (summary.pendingInvites > 0) {
      equipageNext.push({
        kind: 'invitations',
        href: hubSectionHref(collectifRef, 'invitations'),
        title: `${summary.pendingInvites} invitation(s) en attente`,
        description: 'Relancez vos invités.',
      });
    }
    equipageNext.push({
      kind: 'all-clear',
      href: hubSectionHref(collectifRef, 'groupe'),
      title: 'Tout est à jour',
      description: 'Équipage rodé — préparez la prochaine expédition.',
    });
    const cells = [
      {
        key: 'groupe', span: 6 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'groupe')} label={name} tone="accent">
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
              <NumberStat value={summary.members} />
              <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
                membre{summary.members > 1 ? 's' : ''}
                {summary.pendingInvites > 0 ? ` · ${summary.pendingInvites} invitation(s)` : ''}
              </span>
            </p>
          </MenuCard>
        ),
      },
      {
        key: 'membres', span: 6 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'groupe')} label="Membres">
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
              <NumberStat value={summary.members} />
            </p>
            <p className="text-xs text-[var(--lkv-text-secondary)]">Rôles et invitations dans le groupe.</p>
          </MenuCard>
        ),
      },
      {
        key: 'invitations', span: 4 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'invitations')} label="Invitations">
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
              <NumberStat value={summary.pendingInvites} />
            </p>
            <p className="text-xs text-[var(--lkv-text-secondary)]">en attente de réponse.</p>
          </MenuCard>
        ),
      },
      {
        key: 'voyages-lies', span: 4 as const,
        node: (
          <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} label="Voyages liés">
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
              <NumberStat value={summary.linkedTrips} />
            </p>
            <p className="text-xs text-[var(--lkv-text-secondary)]">expédition{summary.linkedTrips > 1 ? 's' : ''} rattachée{summary.linkedTrips > 1 ? 's' : ''}.</p>
          </MenuCard>
        ),
      },
      ...(linkedTripSlug
        ? [{
            key: 'entrer', span: 6 as const,
            node: (
              <MenuCard href={tripSwitchHref(linkedTripSlug)} label="Entrer dans le voyage">
                <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Ouvrir l&apos;expédition liée.</p>
              </MenuCard>
            ),
          }]
        : []),
    ];
    return (
      <div className="space-y-4">
        <ActivityIdentityBar nature="collectif" name={name} />
        <NextActionCard actions={equipageNext} />
        <QuickActions actions={actions} />
        <BentoGrid cells={cells} />
      </div>
    );
  }

  const perPerson = summary.members > 0 ? Math.round(summary.expensesTotal / summary.members) : summary.expensesTotal;
  const actions: QuickAction[] = [
    { href: onglet('members'), label: 'Membres', icon: Users },
    { href: onglet('expenses'), label: 'Dépenses', icon: CreditCard },
    { href: onglet('tasks'), label: 'Tâches', icon: CheckSquare },
    { href: onglet('discussion'), label: 'Discussion', icon: MessageSquare },
  ];

  // ── FIL D'ACTION (règles déterministes, ordonnées par priorité) ──
  const nextActions: NextActionSignal[] = [];
  if (summary.tasksOpen > 0) {
    nextActions.push({
      kind: 'tasks',
      href: onglet('tasks'),
      title: `${summary.tasksOpen} tâche(s) à faire`,
      description: 'Répartissez et cochez les tâches du groupe.',
    });
  }
  if (summary.pollsOpen > 0) {
    nextActions.push({
      kind: 'discussion',
      href: onglet('decisions'),
      title: `${summary.pollsOpen} décision(s) à voter`,
      description: 'Votre vote compte — clôturez les sondages.',
    });
  }
  if (summary.pendingInvites > 0) {
    nextActions.push({
      kind: 'invitations',
      href: hubSectionHref(collectifRef, 'invitations'),
      title: `${summary.pendingInvites} invitation(s) en attente`,
      description: 'Relancez vos invités.',
    });
  }
  nextActions.push({
    kind: 'all-clear',
    href: onglet('discussion'),
    title: 'Tout est à jour',
    description: 'Le groupe est rodé — lancez la discussion.',
  });

  const cells = [
    {
      key: 'groupe', span: 6 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'groupe')} label={name} tone="accent">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.members} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              membre{summary.members > 1 ? 's' : ''}
              {summary.departureLabel ? ` · départ ${summary.departureLabel}` : ''}
            </span>
          </p>
          {summary.inviteCode && (
            <p className="font-mono text-xs text-[var(--lkv-text-secondary)]">Code {summary.inviteCode}</p>
          )}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]" style={{ width: `${summary.progression}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Préparation : {summary.progression}%</p>
        </MenuCard>
      ),
    },
    {
      key: 'membres', span: 6 as const,
      node: (
        <MenuCard href={onglet('members')} label="Membres">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.members} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              membre{summary.members > 1 ? 's' : ''}
              {summary.pendingInvites > 0 ? ` · ${summary.pendingInvites} en attente` : ' · rôles à jour'}
            </span>
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'tasks', span: 4 as const,
      node: (
        <MenuCard href={onglet('tasks')} label="Tâches">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.tasksOpen} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">à faire</span>
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'equipment', span: 4 as const,
      node: (
        <MenuCard href={onglet('equipment')} label="Équipement">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.equipmentCount} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              objet{summary.equipmentCount > 1 ? 's' : ''} partagé{summary.equipmentCount > 1 ? 's' : ''}
            </span>
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'expenses', span: 4 as const,
      node: (
        <MenuCard href={onglet('expenses')} label="Dépenses">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.expensesTotal} suffix=" €" />
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">engagés · ≈ {perPerson} €/pers.</p>
        </MenuCard>
      ),
    },
    {
      key: 'decisions', span: 3 as const,
      node: (
        <MenuCard href={onglet('decisions')} label="Décisions">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.pollsOpen} />
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">vote{summary.pollsOpen > 1 ? 's' : ''} ouvert{summary.pollsOpen > 1 ? 's' : ''}.</p>
        </MenuCard>
      ),
    },
    {
      key: 'discussion', span: 3 as const,
      node: (
        <MenuCard href={onglet('discussion')} label="Discussion">
          {summary.lastMessage ? (
            <p className="mt-1 line-clamp-3 text-xs text-[var(--lkv-text-secondary)]">« {summary.lastMessage} »</p>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Lancez la conversation.</p>
          )}
        </MenuCard>
      ),
    },
    {
      key: 'invitations', span: 3 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'invitations')} label="Invitations">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.pendingInvites} />
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">en attente de réponse.</p>
        </MenuCard>
      ),
    },
    {
      key: 'voyages-lies', span: 3 as const,
      node: (
        <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} label="Voyages liés">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.linkedTrips} />
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">expédition{summary.linkedTrips > 1 ? 's' : ''} rattachée{summary.linkedTrips > 1 ? 's' : ''}.</p>
        </MenuCard>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ActivityIdentityBar nature="collectif" name={name} />
      <NextActionCard actions={nextActions} />
      <QuickActions actions={actions} />
      <BentoGrid cells={cells} />
    </div>
  );
}

export default CollectifMenu;