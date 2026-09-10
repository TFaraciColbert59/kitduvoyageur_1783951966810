'use client';

import { useState } from 'react';
import { Check, Copy, Users } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface GroupeMemberRow {
  userId: string;
  name: string;
  role?: string;
}

export interface GroupeMembersCardProps {
  members: GroupeMemberRow[];
  pending: GroupeMemberRow[];
  inviteCode: string | null;
  onManage?: () => void;
}

export function GroupeMembersCard({ members, pending, inviteCode, onManage }: GroupeMembersCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      triggerHaptic('selection');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papier indisponible */
    }
  };

  return (
    <section aria-label="Membres du groupe" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
          Membres · {members.length}
        </p>
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="glass-capsule-btn !px-3 !py-1.5 text-[11px] font-bold min-h-[44px]"
          >
            Gérer
          </button>
        )}
      </div>

      <div className="glass-sub-card rounded-2xl p-3">
        <ul className="space-y-1">
          {members.map((member) => (
            <li key={member.userId} className="flex min-h-[44px] items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-xs font-bold text-[var(--lkv-primary)]"
                aria-hidden="true"
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--lkv-text-primary)]">
                {member.name}
              </span>
              {member.role && (
                <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                  {member.role}
                </span>
              )}
            </li>
          ))}
          {members.length === 0 && (
            <li className="py-2 text-sm font-medium text-[var(--lkv-text-primary)]/70">
              Aucun membre actif pour le moment.
            </li>
          )}
        </ul>

        {pending.length > 0 && (
          <div className="mt-2 border-t border-black/5 pt-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Invitations · {pending.length}
            </p>
            <ul className="mt-1.5 space-y-1">
              {pending.map((member) => (
                <li key={member.userId} className="flex min-h-[44px] items-center gap-3 opacity-75">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold text-[var(--lkv-text-primary)]/60"
                    aria-hidden="true"
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--lkv-text-primary)]/80">
                    {member.name}
                  </span>
                  <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/50">
                    En attente
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {inviteCode && (
          <div className="mt-2 flex items-center gap-3 border-t border-black/5 pt-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--lkv-secondary)]">
              <Users size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                Code d’invitation
              </span>
              <span className="block truncate text-sm font-bold tracking-widest tabular-nums text-[var(--lkv-text-primary)]">
                {inviteCode}
              </span>
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="glass-capsule-btn shrink-0 !px-3 !py-1.5 text-[11px] font-bold min-h-[44px]"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default GroupeMembersCard;
