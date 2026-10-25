import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { HapticLink } from '../menu/HapticLink';

export interface MomentStatCardProps {
  eyebrow: string;
  badge?: string | null;
  children: ReactNode;
  cta?: { href: string; label: string } | null;
}

export function MomentStatCard({ eyebrow, badge, children, cta }: MomentStatCardProps) {
  return (
    <section
      aria-label={eyebrow}
      className="hub-content-material relative overflow-hidden rounded-[var(--lkv-radius-card)] p-4 text-[color:var(--lkv-text-primary)]"
    >
      <span
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/5"
        aria-hidden="true"
      />

      <header className="relative flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">{eyebrow}</p>
        {badge && (
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--lkv-text-primary)]">
            {badge}
          </span>
        )}
      </header>

      <div className="relative mt-2.5">{children}</div>

      {cta && (
        <HapticLink
          href={cta.href}
          className="hub-liquid-action relative mt-4 flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-bold transition-transform hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <span className="truncate">{cta.label}</span>
          <ArrowRight size={14} className="shrink-0" aria-hidden="true" />
        </HapticLink>
      )}
    </section>
  );
}

export default MomentStatCard;
