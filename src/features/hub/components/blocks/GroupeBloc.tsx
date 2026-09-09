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
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">Groupe</p>
        </div>
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)] mt-2">Sortie en solo</p>
        <p className="text-xs text-[var(--lkv-text-secondary)] mt-1">
          Invitez des compagnons — l’équipage s’active dès le deuxième participant.
        </p>
        <Link
          href={equipageHref}
          className="glass-capsule-btn primary inline-flex items-center gap-2 mt-3 min-h-[44px] px-4"
        >
          <MailPlus size={14} aria-hidden="true" />
          <span>Inviter</span>
        </Link>
      </section>
    );
  }

  const members = group?.members ?? [];
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Groupe">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">Groupe</p>
        </div>
        {group?.pendingInvites ? (
          <span className="text-[10px] font-mono text-[var(--lkv-text-secondary)]">
            {group.pendingInvites} invitation(s) en attente
          </span>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1.5">
        {members.slice(0, 6).map((m) => (
          <li key={m.userId} className="flex items-center gap-2 text-sm">
            <span className="w-6 h-6 rounded-full bg-[var(--lkv-surface-raised)] flex items-center justify-center text-[10px] font-bold text-[var(--lkv-text-secondary)] shrink-0">
              {(m.fullName ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 truncate text-[var(--lkv-text-primary)]">{m.fullName ?? 'Compagnon'}</span>
            <span className="text-[10px] font-mono text-[var(--lkv-text-muted)]">{ROLE_LABELS[m.role] ?? m.role}</span>
          </li>
        ))}
        {members.length === 0 ? (
          <li className="text-sm text-[var(--lkv-text-secondary)]">
            Aucun compagnon pour l&apos;instant — invitez-en un.
          </li>
        ) : null}
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