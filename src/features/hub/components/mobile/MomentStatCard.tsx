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
      className="relative overflow-hidden rounded-[1.75rem] bg-[var(--lkv-primary)] p-4 text-white shadow-sm"
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
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/75">{eyebrow}</p>
        {badge && (
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]">
            {badge}
          </span>
        )}
      </header>

      <div className="relative mt-2.5">{children}</div>

      {cta && (
        <HapticLink
          href={cta.href}
          className="relative mt-4 flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/95 px-4 text-xs font-bold text-[var(--lkv-primary)] shadow-2xs transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="truncate">{cta.label}</span>
          <ArrowRight size={14} className="shrink-0" aria-hidden="true" />
        </HapticLink>
      )}
    </section>
  );
}

export default MomentStatCard;
