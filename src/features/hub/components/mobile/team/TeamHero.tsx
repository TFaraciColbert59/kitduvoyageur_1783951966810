'use client';

import { CalendarDays, Dog, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { personInitials } from '../../../mobile/teamEngine';

export interface TeamHeroProps {
  title: string;
  daysLeft: number | null;
  collaboratorNames: string[];
  humansCount: number;
  dogsCount: number;
  packWeightKg: number;
  waterLiters: number;
  isOwner: boolean;
  onInvite: () => void;
  onOpenCarnet: () => void;
}

function MetaPill({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10.5px] font-semibold text-[var(--lkv-text-primary)]/80 ring-1 ring-white/60">
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Hero mobile de l'équipe (sortie) — même langage que Budget/Équipement. */
export function TeamHero({
  title,
  daysLeft,
  collaboratorNames,
  humansCount,
  dogsCount,
  packWeightKg,
  waterLiters,
  isOwner,
  onInvite,
  onOpenCarnet,
}: TeamHeroProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Équipe du voyage">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Équipe du voyage
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-[var(--lkv-text-primary)]">{title}</p>
        </div>
        {daysLeft != null && (
          <span className="glass-pill shrink-0 uppercase tracking-[0.08em]">
            {daysLeft >= 0 ? `J-${daysLeft}` : 'En cours'}
          </span>
        )}
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex -space-x-2" aria-hidden="true">
          {collaboratorNames.slice(0, 4).map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-[11px] font-bold uppercase text-white ring-2 ring-white"
            >
              {personInitials(name)}
            </span>
          ))}
          {collaboratorNames.length > 4 && (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lkv-primary)]/80 text-[10px] font-bold text-white ring-2 ring-white">
              +{collaboratorNames.length - 4}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <MetaPill icon={Users} label={`${collaboratorNames.length} équipier${collaboratorNames.length > 1 ? 's' : ''}`} />
          {humansCount > 0 && <MetaPill icon={Users} label={`${humansCount} au carnet`} />}
          {dogsCount > 0 && <MetaPill icon={Dog} label={`${dogsCount} chien${dogsCount > 1 ? 's' : ''}`} />}
        </div>
      </div>

      <ul className="mt-3.5 grid grid-cols-3 gap-2">
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            Poids portage
          </p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {packWeightKg} kg
          </p>
        </li>
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            Eau / jour
          </p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {waterLiters} L
          </p>
        </li>
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            Sécurité ICE
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--lkv-text-primary)]">
            <ShieldCheck size={13} aria-hidden="true" />
            Verrouillée
          </p>
        </li>
      </ul>

      <div className="mt-4 flex gap-2">
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onInvite();
            }}
            className="glass-capsule-btn primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <UserPlus size={15} aria-hidden="true" />
            Inviter
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onOpenCarnet();
          }}
          className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
        >
          <CalendarDays size={15} aria-hidden="true" />
          Carnet d&apos;équipage
        </button>
      </div>
    </section>
  );
}

export default TeamHero;
