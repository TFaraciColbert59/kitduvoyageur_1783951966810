'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Expand } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { IconButton } from '@/components/ui';
import { HapticLink } from '../menu/HapticLink';
import HubRouteMap, { type HubRoutePoint } from './HubRouteMap';

export interface MomentMapCardProps {
  eyebrow: string;
  badge: string;
  dateLabel?: string | null;
  routeCoords: Array<[number, number]>;
  highlightCoords?: Array<[number, number]>;
  points?: HubRoutePoint[];
  panel: ReactNode;
  sheetContent?: ReactNode;
  legend?: Array<{ label: string; color: string }>;
  cta: { href: string; label: string };
  sheetTitle: string;
  reserveFabSpace?: boolean;
  /** Plein écran vertical : carte jusqu'en bas, panneau juste au-dessus de la tab bar. */
  fillViewport?: boolean;
}

export function MomentMapCard({
  eyebrow,
  badge,
  dateLabel,
  routeCoords,
  highlightCoords = [],
  points = [],
  panel,
  sheetContent,
  legend = [],
  cta,
  sheetTitle,
  reserveFabSpace = false,
  fillViewport = false,
}: MomentMapCardProps) {
  const [open, setOpen] = useState(false);
  const heightClass = fillViewport ? 'h-full min-h-0' : 'min-h-[26rem] sm:min-h-[30rem]';

  return (
    <section
      aria-label={sheetTitle}
      className={`relative ${heightClass} overflow-hidden rounded-[var(--lkv-radius-card)] border border-white/50 bg-[var(--lkv-forest-50)] shadow-sm`}
    >
      <div className="absolute inset-0 z-0">
        <HubRouteMap
          routeCoords={routeCoords}
          highlightCoords={highlightCoords}
          points={points}
          reserveBottom={170}
        />
      </div>
      <div
        className={`relative z-20 flex h-full ${heightClass} flex-col justify-between p-3.5 ${
          fillViewport ? 'pb-[calc(var(--bottom-nav-height,52px)+16px)]' : ''
        }`}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center rounded-full bg-[var(--lkv-forest-950)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-on-dark)] backdrop-blur-sm">
              {eyebrow}
            </p>
            <p className="mt-1 inline-flex items-center rounded-full bg-[var(--lkv-surface-paper)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)] shadow-2xs">
              {badge}
            </p>
          </div>
          {dateLabel && (
            <p className="shrink-0 rounded-full bg-[var(--lkv-forest-950)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-on-dark)] backdrop-blur-sm">
              {dateLabel}
            </p>
          )}
        </header>

        <div className="glass rounded-2xl p-3.5">
          {panel}
          <div className={`mt-3 flex items-center justify-end gap-2 ${reserveFabSpace ? 'pr-16' : ''}`}>
            <IconButton
              variant="glass"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Agrandir la carte"
              aria-haspopup="dialog"
              aria-expanded={open}
              className="h-10 w-10 shrink-0 transition-transform active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
            >
              <Expand size={16} aria-hidden="true" />
            </IconButton>
            <HapticLink
              href={cta.href}
              ariaLabel={cta.label}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-white shadow-sm transition-transform active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] focus-visible:ring-offset-2"
            >
              <ArrowRight size={16} aria-hidden="true" />
            </HapticLink>
          </div>
        </div>
      </div>

      <Sheet
        open={open}
        onOpenChange={(v) => !v && setOpen(false)}
        title={sheetTitle}
        detent="medium"
      >
        <div className="flex flex-col">
          <div className="h-[40dvh] min-h-[16rem] border-b border-white/40">
            <HubRouteMap
              interactive
              routeCoords={routeCoords}
              highlightCoords={highlightCoords}
              points={points}
              reserveBottom={24}
            />
          </div>
          <div className="space-y-3 px-5 pb-6 pt-4">
            <p className="text-[10.5px] font-medium text-[var(--lkv-text-primary)]/80">
              Déplacez et zoomez la carte.
            </p>
            {legend.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Légende de la carte">
                {legend.map((item) => (
                  <li
                    key={item.label}
                    className="glass-sub-card inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-[var(--lkv-text-secondary)]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
            {sheetContent}
          </div>
        </div>
      </Sheet>
    </section>
  );
}

export default MomentMapCard;
