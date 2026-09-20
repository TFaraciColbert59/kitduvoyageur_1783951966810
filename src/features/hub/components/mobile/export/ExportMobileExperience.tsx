'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  Download,
  LifeBuoy,
  Printer,
  Route,
  Share2,
} from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import { Badge, Button, ListItem } from '@/components/ui';
import { printActiveView } from '@/lib/native/print';
import { HUB_HOME_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { buildExportProgram, buildExportSummaryCards } from '../../../mobile/exportEngine';
import { tripItineraryTotals } from '../../../mobile/itineraryEngine';
import { GroupeRail } from '../groupe/GroupeRail';

export interface ExportMobileExperienceProps {
  trip: TripFull;
  stats: TripStats | null;
  budgetSummary: BudgetSummary;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <li className="glass-sub-card rounded-2xl p-2.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">{label}</p>
      <p className="mt-1 font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">{value}</p>
    </li>
  );
}

/** Export mobile — feuille de route : synthèse cliquable, programme, partage GPX/PDF. */
export function ExportMobileExperience({ trip, stats, budgetSummary }: ExportMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [notice, setNotice] = useState<string | null>(null);

  const cards = buildExportSummaryCards(trip, stats, budgetSummary);
  const program = buildExportProgram(trip);
  const totals = tripItineraryTotals(trip.steps ?? []);
  const daysCount = stats?.total_days ?? program.length;
  const distanceKm = stats?.total_distance_km ?? totals.distanceKm;

  const daysLeft = (() => {
    if (!trip.start_date) return null;
    const start = new Date(`${trip.start_date}T00:00:00Z`).getTime();
    if (Number.isNaN(start)) return null;
    return Math.ceil((start - Date.now()) / 86400000);
  })();

  const handleShare = async () => {
    triggerHaptic('light');
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: trip.title, url });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice('Lien copié dans le presse-papier.');
        setTimeout(() => setNotice(null), 2500);
      }
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      <section className="glass relative overflow-hidden rounded-[var(--lkv-radius-card)] p-4" aria-label="Feuille de route à exporter">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
              Export · Feuille de route
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--lkv-text-primary)]">{trip.title}</p>
          </div>
          {daysLeft != null && (
            <Badge tone="stone" className="shrink-0 uppercase tracking-[0.08em]">
              {daysLeft >= 0 ? `J-${daysLeft}` : 'En cours'}
            </Badge>
          )}
        </header>

        <ul className="mt-3.5 grid grid-cols-4 gap-2">
          <StatTile label="Jours" value={String(daysCount)} />
          <StatTile label="Distance" value={`${distanceKm} km`} />
          <StatTile label="D+" value={`${totals.elevGainM} m`} />
          <StatTile label="Étapes" value={String(totals.stepsCount)} />
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={`/api/voyages/${trip.slug}/gpx`}
            download={`${trip.slug}.gpx`}
            className="glass-capsule-btn primary inline-flex min-h-[44px] items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <Download size={15} aria-hidden="true" />
            GPX
          </a>
          <Button
            variant="secondary"
            onClick={() => {
              triggerHaptic('light');
              printActiveView();
            }}
            icon={<Printer size={15} aria-hidden="true" />}
            className="!py-3 text-sm font-bold"
          >
            PDF
          </Button>
          <Button
            variant="secondary"
            onClick={handleShare}
            icon={<Share2 size={15} aria-hidden="true" />}
            className="col-span-2 !py-3 text-sm font-bold"
          >
            Partager la feuille de route
          </Button>
        </div>

        {notice && (
          <p role="status" className="mt-2 text-center text-[11px] font-semibold text-[var(--lkv-primary)]">
            {notice}
          </p>
        )}
      </section>

      {/* ── PROGRAMME JOUR PAR JOUR ── */}
      <section aria-label="Programme jour par jour">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
              Programme
            </p>
            <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">
              {program.length} jour{program.length > 1 ? 's' : ''} planifié{program.length > 1 ? 's' : ''}
            </p>
          </div>
          <Link href={program[0]?.href ?? HUB_HOME_HREF} className="shrink-0">
            <Button variant="secondary" size="sm" className="min-h-[44px] !px-3 !py-1.5 text-[11px] font-bold">
              Ouvrir
            </Button>
          </Link>
        </div>

        <ul className="space-y-2">
          {program.slice(0, 8).map((day) => (
            <li key={day.day}>
              <Link href={day.href} className="block">
                <ListItem
                  as="div"
                  leading={
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[12px] font-extrabold text-[var(--lkv-primary)]">
                      J{day.day}
                    </span>
                  }
                  title={
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={12} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
                      <span className="truncate">{day.dateLabel ?? `Jour ${day.day}`}</span>
                    </span>
                  }
                  subtitle={
                    <span className="flex items-center gap-1.5">
                      <Route size={11} aria-hidden="true" />
                      {day.stepsCount} étape{day.stepsCount > 1 ? 's' : ''} · {day.distanceKm} km
                    </span>
                  }
                  trailing={
                    <ChevronRight size={15} className="shrink-0 text-[var(--lkv-text-primary)]/40" aria-hidden="true" />
                  }
                />
              </Link>
            </li>
          ))}
        </ul>
        {program.length > 8 && (
          <p className="mt-2 text-center text-[11px] font-medium text-[var(--lkv-text-primary)]/60">
            +{program.length - 8} autres jours dans l’itinéraire
          </p>
        )}
      </section>

      {/* ── SYNTHÈSE CLIQUABLE ── */}
      <GroupeRail
        title="Synthèse du voyage"
        subtitle="Tout est relié aux sections du hub"
        ariaLabel="Synthèse du voyage"
      >
        {cards.map((card) => (
          <li key={card.key} className="shrink-0 snap-start">
            <Link
              href={card.href}
              className="glass flex h-[8.5rem] w-[10.5rem] flex-col rounded-[var(--lkv-radius-lg)] p-3 transition-transform active:scale-[0.97]"
            >
              <span className="w-fit rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
                {card.label}
              </span>
              <span className="mt-2 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
                {card.value}
              </span>
              {card.hint && (
                <span className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-[var(--lkv-text-primary)]/65">
                  {card.hint}
                </span>
              )}
            </Link>
          </li>
        ))}
      </GroupeRail>

      {/* ── SÉCURITÉ ── */}
      <section className="glass-sub-card rounded-2xl p-4" aria-label="Numéros d'urgence">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
          <LifeBuoy size={12} aria-hidden="true" />
          Sécurité &amp; numéros d’urgence
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          <li>
            <a
              href="tel:112"
              className="glass-capsule-btn inline-flex min-h-[44px] items-center gap-1.5 !px-3.5 text-xs font-bold"
            >
              112 · Europe
            </a>
          </li>
          <li>
            <a
              href="tel:15"
              className="glass-capsule-btn inline-flex min-h-[44px] items-center gap-1.5 !px-3.5 text-xs font-bold"
            >
              15 · SAMU
            </a>
          </li>
          <li>
            <a
              href="tel:18"
              className="glass-capsule-btn inline-flex min-h-[44px] items-center gap-1.5 !px-3.5 text-xs font-bold"
            >
              18 · Pompiers
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ExportMobileExperience;
