import Link from 'next/link';
import { ArrowRight, BedDouble } from 'lucide-react';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import type { TripStep } from '@/features/trips/types/trip.types';

/**
 * H-ACT §3 — Blocs d'aperçu du profil Voyage : réservations (hébergements
 * des étapes + documents de réservation).
 */

/** Réservations : hébergements rattachés aux étapes. */
export function ReservationsBlock({
  steps,
  documentsCount,
  slug,
}: {
  steps: TripStep[];
  documentsCount: number;
  slug: string;
}) {
  const stays = steps.filter((s) => Boolean(s.accommodation_name));
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Réservations">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble size={16} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
            Réservations
          </p>
        </div>
        {documentsCount > 0 ? (
          <span className="text-[10px] font-mono text-[var(--lkv-text-muted)]">
            {documentsCount} document(s)
          </span>
        ) : null}
      </div>
      {stays.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {stays.slice(0, 4).map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-mono text-[var(--lkv-text-muted)] shrink-0">J{s.day_number}</span>
              <span className="flex-1 truncate text-[var(--lkv-text-primary)]">{s.accommodation_name}</span>
              {s.location_name ? (
                <span className="text-[10px] text-[var(--lkv-text-muted)] truncate max-w-[100px]">{s.location_name}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--lkv-text-secondary)] mt-2">
          Aucun hébergement réservé — ajoutez-en sur les étapes de l’itinéraire.
        </p>
      )}
      <Link
        href={tripSectionHref(slug, 'itinerary')}
        className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <span>Gérer les réservations</span>
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}