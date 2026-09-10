import { ProgressBar } from '@/components/ui/ProgressBar';
import type { MemberResource } from '../../../mobile/gearEngine';

export interface MemberBagResourcesProps {
  members: MemberResource[];
}

export function MemberBagResources({ members }: MemberBagResourcesProps) {
  if (members.length === 0) return null;

  return (
    <section aria-label="Ressources par sac" className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
        Ressources par sac
      </p>
      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.userId} className="glass-sub-card flex items-center gap-3 rounded-2xl p-3">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-sm font-bold text-[var(--lkv-primary)] ring-2 ring-white"
                aria-hidden="true"
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-[var(--lkv-text-primary)]">
                  {member.name}
                  {member.isOwner && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-muted)]">
                      vous
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {member.progressPct}%
                </span>
              </span>
              <span className="mt-1 block">
                <ProgressBar value={member.progressPct} label={`Progression de ${member.name}`} />
              </span>
              <span className="mt-0.5 block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/75">
                {member.packedWeightKg} kg emballés
                {member.packedItems > 1 ? ` · ${member.packedItems} objets` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MemberBagResources;
