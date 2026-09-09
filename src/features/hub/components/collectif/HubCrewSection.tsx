import Link from 'next/link';
import type { HubCrewBlock } from '../../server/getHubAdventureData';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';

/**
 * Étape UX — Section Groupe pour une SORTIE : l'équipage du voyage
 * (crew auto-lié via syncTripCrew). Membres, rôles et invitations —
 * l'écran riche qui faisait défaut (fini le 404 sur /hub/groupe).
 */
export function HubCrewSection({ crew, adventure }: { crew: HubCrewBlock | null; adventure: HubAdventureRef }) {
  const teamHref = hubSectionHref(adventure, 'team');

  if (!crew || crew.memberCount === 0) {
    return (
      <div className="glass p-6 rounded-[var(--lkv-radius-card)] text-center">
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">Aucun équipage encore.</p>
        <p className="text-xs text-[var(--lkv-text-secondary)] mt-1">
          Invitez un compagnon sur l&apos;équipage du voyage pour l&apos;activer.
        </p>
        <Link
          href={teamHref}
          className="glass-capsule-btn primary inline-flex items-center gap-2 mt-4 min-h-[44px] px-5 text-xs font-bold"
        >
          Gérer l&apos;équipage
        </Link>
      </div>
    );
  }

  const members = crew.members ?? [];

  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Membres de l'équipage">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
          Membres · {crew.memberCount}
        </p>
        {crew.pendingInvites > 0 && (
          <p className="text-[10px] font-semibold tabular-nums text-[var(--lkv-text-secondary)]">
            {crew.pendingInvites} invitation(s)
          </p>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 min-h-[44px]">
            <span className="w-8 h-8 rounded-full bg-[var(--lkv-surface-raised)] flex items-center justify-center text-xs font-bold text-[var(--lkv-text-secondary)] shrink-0">
              {(m.fullName ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[var(--lkv-text-primary)]">
              {m.fullName ?? 'Compagnon'}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
              {m.role === 'owner' ? 'Propriétaire' : m.role === 'organizer' ? 'Organisateur' : 'Membre'}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={teamHref}
        className="glass-capsule-btn primary inline-flex items-center gap-2 mt-4 min-h-[44px] px-5 text-xs font-bold"
      >
        Gérer l&apos;équipage
      </Link>
    </section>
  );
}

export default HubCrewSection;
