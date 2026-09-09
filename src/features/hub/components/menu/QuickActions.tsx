import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Hub V4 — Rangée de 4 ACTIONS RAPIDES (mobile uniquement, sous le bento).
 * Pastille 44px + label : les onglets les plus utilisés de la nature active.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 md:hidden" aria-label="Actions rapides">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center justify-center gap-1.5 min-h-[72px] px-1 rounded-2xl glass border border-white/60 shadow-sm active:scale-[0.97] transition-transform"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 border border-white/70 text-[var(--lkv-secondary)] shadow-2xs">
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-center text-[var(--lkv-text-primary)]">
              {a.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default QuickActions;