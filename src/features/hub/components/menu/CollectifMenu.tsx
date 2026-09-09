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
import { HubMenuGrid } from './HubMenuGrid';
import { MenuCard } from './MenuCard';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { MenuVitalsCarousel, type MenuVital } from './MenuVitalsCarousel';
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
 * Hub V4 — MENU COLLECTIF (groupe/équipage) : cartes-onglets résumées.
 * Groupe (héros), puis les onglets du cockpit (Membres, Tâches, Équipement,
 * Dépenses, Décisions, Discussion) + Invitations + Voyages liés.
 */
export function CollectifMenu({ summary, linkedTripSlug }: CollectifMenuProps) {
  const name = summary.name ?? 'Mon groupe';

  if (summary.kind === 'equipage') {
    const vitals: MenuVital[] = [
      { id: 'membres', label: 'Membres', value: `${summary.members}`, sub: 'équipage', href: hubSectionHref(collectifRef, 'groupe') },
      { id: 'invits', label: 'Invitations', value: `${summary.pendingInvites}`, sub: 'en attente', href: hubSectionHref(collectifRef, 'invitations') },
      { id: 'voyages', label: 'Voyages liés', value: `${summary.linkedTrips}`, sub: 'expédition(s)', href: hubSectionHref(collectifRef, 'voyages-lies') },
    ];
    return (
      <div className="space-y-4">
        <MenuVitalsCarousel vitals={vitals} />
        <HubMenuGrid>
          <MenuCard href={hubSectionHref(collectifRef, 'groupe')} icon={Users} label={name} wide tone="accent">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
              {summary.pendingInvites > 0 ? ` · ${summary.pendingInvites} invitation(s)` : ''}
            </p>
          </MenuCard>
          <MenuCard href={hubSectionHref(collectifRef, 'invitations')} icon={MailPlus} label="Invitations">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.pendingInvites} /> en attente
            </p>
          </MenuCard>
          <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} icon={MapIcon} label="Voyages liés">
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.linkedTrips} /> expédition{summary.linkedTrips > 1 ? 's' : ''}
            </p>
          </MenuCard>
          {linkedTripSlug && (
            <MenuCard href={tripSwitchHref(linkedTripSlug)} icon={ArrowUpRight} label="Entrer dans le voyage" wide>
              <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Ouvrir l&apos;expédition liée.</p>
            </MenuCard>
          )}
        </HubMenuGrid>
      </div>
    );
  }

  const vitals: MenuVital[] = [
    { id: 'membres', label: 'Membres', value: `${summary.members}`, sub: 'dans le groupe', href: onglet('members') },
    { id: 'taches', label: 'Tâches', value: `${summary.tasksOpen}`, sub: 'à faire', href: onglet('tasks') },
    { id: 'depenses', label: 'Dépenses', value: `${summary.expensesTotal} €`, sub: 'engagées', href: onglet('expenses') },
    { id: 'decisions', label: 'Décisions', value: `${summary.pollsOpen}`, sub: 'vote(s) ouvert(s)', href: onglet('decisions') },
  ];

  return (
    <div className="space-y-4">
      <MenuVitalsCarousel vitals={vitals} />

      <HubMenuGrid>
        <MenuCard href={hubSectionHref(collectifRef, 'groupe')} icon={Users} label={name} wide tone="accent">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
            {summary.departureLabel ? ` · ${summary.departureLabel}` : ''}
          </p>
          {summary.inviteCode && (
            <p className="text-[11px] font-mono text-[var(--lkv-text-secondary)]">Code {summary.inviteCode}</p>
          )}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${summary.progression}%` }}
            />
          </div>
        </MenuCard>

        <MenuCard href={onglet('members')} icon={Users} label="Membres">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.members} /> membre{summary.members > 1 ? 's' : ''}
          </p>
        </MenuCard>

        <MenuCard href={onglet('tasks')} icon={CheckSquare} label="Tâches">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.tasksOpen} /> à faire
          </p>
        </MenuCard>

        <MenuCard href={onglet('equipment')} icon={ListChecks} label="Équipement">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.equipmentCount} /> objet{summary.equipmentCount > 1 ? 's' : ''} partagé{summary.equipmentCount > 1 ? 's' : ''}
          </p>
        </MenuCard>

        <MenuCard href={onglet('expenses')} icon={CreditCard} label="Dépenses">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.expensesTotal} suffix=" €" /> engagés
          </p>
        </MenuCard>

        <MenuCard href={onglet('decisions')} icon={Vote} label="Décisions">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.pollsOpen} /> vote{summary.pollsOpen > 1 ? 's' : ''} ouvert{summary.pollsOpen > 1 ? 's' : ''}
          </p>
        </MenuCard>

        <MenuCard href={onglet('discussion')} icon={MessageSquare} label="Discussion">
          {summary.lastMessage ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--lkv-text-secondary)]">
              {summary.lastMessage}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Aucun message.</p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(collectifRef, 'invitations')} icon={MailPlus} label="Invitations">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.pendingInvites} /> en attente
          </p>
        </MenuCard>

        <MenuCard href={hubSectionHref(collectifRef, 'voyages-lies')} icon={MapIcon} label="Voyages liés">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.linkedTrips} /> expédition{summary.linkedTrips > 1 ? 's' : ''}
          </p>
        </MenuCard>
      </HubMenuGrid>
    </div>
  );
}

export default CollectifMenu;