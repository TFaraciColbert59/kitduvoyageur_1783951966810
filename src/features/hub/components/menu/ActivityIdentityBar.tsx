import { Compass, Package, Users, type LucideIcon } from 'lucide-react';

export interface ActivityIdentityBarProps {
  nature: 'sortie' | 'possession' | 'collectif';
  name: string;
  /** Phase courante (sortie seulement). */
  phaseLabel?: string | null;
  /** Compte à rebours en jours (sortie seulement). */
  daysUntil?: number | null;
}

const ICONS = {
  sortie: Compass,
  possession: Package,
  collectif: Users,
} as const;

/**
 * Hub V4 — Bandeau d'identité fin (40px) au-dessus du bento :
 * icône + nom de l'activité + phase + J-x. Le bento reste anonyme sans lui.
 */
export function ActivityIdentityBar({ nature, name, phaseLabel, daysUntil }: ActivityIdentityBarProps) {
  const Icon: LucideIcon = ICONS[nature];
  return (
    <div className="flex items-center gap-2.5 px-1 py-0.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] ring-1 ring-[var(--lkv-primary)]/20 shrink-0">
        <Icon size={13} aria-hidden="true" />
      </span>
      <p className="min-w-0 truncate text-lg font-serif-lkv italic leading-snug text-[var(--card-content)]">{name}</p>
      {phaseLabel && (
        <span className="shrink-0 rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-primary)] ring-1 ring-white/70">
          {phaseLabel}
        </span>
      )}
      {daysUntil != null && daysUntil >= 0 && (
        <span className="shrink-0 rounded-full border border-white/70 bg-white/50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
          J-{daysUntil}
        </span>
      )}
    </div>
  );
}

export default ActivityIdentityBar;
