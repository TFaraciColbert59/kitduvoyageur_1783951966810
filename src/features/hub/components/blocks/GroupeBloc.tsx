import Link from 'next/link';
import { MailPlus, UserPlus, Users } from 'lucide-react';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import type { HubCrewBlock } from '../../server/getHubAdventureData';

/**
 * H-ACT §4 — Bloc Groupe universel, présent dans chaque hub d'activité.
 * Solo (équipage invisible, ≤ 1 membre) : action « Inviter ».
 * Collectif (≥ 2 membres) : membres, rôles et invitations.
 */

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  organizer: 'Organisateur',
  member: 'Membre',
  guest: 'Invité',
};

export function GroupeBloc({ trip, group }: { trip: { slug: string; collaborators?: unknown[] }; group: HubCrewBlock | null }) {
  const collective = (group?.memberCount ?? 1) > 1 || (trip.collaborators?.length ?? 0) > 0;
  const equipageHref = tripSectionHref(trip.slug, 'team');

  if (!collective) {
    return (
      <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Groupe">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">Sortie en solo</p>
          <UserPlus size={15} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
        </div>
        <Link
          href={equipageHref}
          className="glass-capsule-btn primary inline-flex items-center gap-2 mt-3 min-h-[44px] px-4"
        >
          <MailPlus size={14} aria-hidden="true" />
          <span>Inviter un compagnon</span>
        </Link>
      </section>
    );
  }

  const members = group?.members ?? [];
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Groupe">
      <div className="flex items-center justify-between">
        <Users size={15} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
        {group?.pendingInvites ? (
          <span className="text-[10px] font-mono text-[var(--lkv-text-secondary)]">
            {group.pendingInvites} invitation(s)
          </span>
        ) : null}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {members.slice(0, 6).map((m) => (
          <li key={m.userId} className="flex items-center gap-2 text-sm">
            <span className="w-6 h-6 rounded-full bg-[var(--lkv-surface-raised)] flex items-center justify-center text-[10px] font-bold text-[var(--lkv-text-secondary)] shrink-0">
              {(m.fullName ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 truncate text-[var(--lkv-text-primary)]">{m.fullName ?? 'Compagnon'}</span>
            <span className="text-[10px] font-mono text-[var(--lkv-text-muted)]">{ROLE_LABELS[m.role] ?? m.role}</span>
          </li>
        ))}
      </ul>
      <Link
        href={equipageHref}
        className="glass-capsule-btn primary inline-flex items-center gap-2 mt-3 min-h-[44px] px-4"
      >
        <MailPlus size={14} aria-hidden="true" />
        <span>{members.length === 0 ? 'Inviter un compagnon' : 'Gérer l’équipage'}</span>
      </Link>
    </section>
  );
}

export default GroupeBloc;