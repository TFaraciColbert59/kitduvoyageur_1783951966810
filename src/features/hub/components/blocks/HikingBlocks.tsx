import Icon from '@/components/ui/Icon';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import { formatHikeDuration } from '../../engine/activityTypes';
import { decideHikingNavigation } from '../../engine/hikingNavigation';
import type { HubHikingContext } from '../../server/getHubAdventureData';
import type { TripPoi } from '@/features/trips/types/trip.types';

/**
 * H-ACT §3 — Blocs d'aperçu du profil Randonnée : CTA cockpit, parcours
 * (distance, dénivelé, durée estimée), météo, points de passage, points d'eau.
 */

/**
 * CTA principal — Phase 3 : « Démarrer la randonnée » exige une géométrie BDD
 * réelle (`routeNavigable`, même prédicat que la sélection Phase 2). Sans tracé
 * vérifié, l'entrée devient « Choisir un parcours » avec explication : le repli
 * `uniform_from_blueprint` (estimation) n'active jamais la navigation.
 */
export function CtaRandonneeBlock({
  hiking,
  slug,
}: {
  hiking: HubHikingContext | null;
  slug: string;
}) {
  const decision = decideHikingNavigation(hiking);
  return (
    <div className="space-y-2">
      <Link
        href={decision.href}
        className="glass-capsule-btn primary inline-flex items-center justify-center gap-2 min-h-[48px] px-5 w-full"
        data-testid="hub-cta-randonnee"
        data-navigation-ready={decision.enabled ? 'true' : 'false'}
      >
        <Icon name={decision.enabled ? 'play' : 'route'} size={16} aria-hidden="true" />
        <span>{decision.label}</span>
        <span className="sr-only">— randonnée {slug}</span>
      </Link>
      {decision.reason && (
        <p
          role="note"
          className="px-1 text-[11px] leading-snug text-[var(--lkv-text-secondary)]"
        >
          {decision.reason}
        </p>
      )}
    </div>
  );
}

const fmt = (n: number | null | undefined, unit: string): string =>
  n == null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`;

/** Parcours : distance, dénivelé ±, durée estimée, parcours lié. */
export function ParcoursBlock({ hiking, slug }: { hiking: HubHikingContext | null; slug: string }) {
  const duration = hiking?.durationMin != null ? formatHikeDuration(hiking.durationMin) : null;
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Parcours">
      <div className="flex items-center gap-2">
        <Icon
          name="route"
          size={15}
          className="shrink-0 text-[var(--lkv-text-secondary)]"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
          {hiking?.routeName ?? 'Itinéraire à composer'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat
          icon={<Icon name="footprints" size={13} aria-hidden="true" />}
          label="Distance"
          value={fmt(hiking?.distanceKm, 'km')}
        />
        <Stat
          icon={<Icon name="mountain" size={13} aria-hidden="true" />}
          label="D+ / D−"
          value={`${fmt(hiking?.elevationGainM, 'm')} / ${fmt(hiking?.elevationLossM, 'm')}`}
        />
        <Stat
          icon={<Icon name="arrow-right" size={13} aria-hidden="true" />}
          label="Durée est."
          value={duration ?? '—'}
        />
      </div>
      <Link
        href={tripSectionHref(slug, 'itinerary')}
        className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <span>Voir l’itinéraire</span>
        <Icon name="arrow-right" size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--lkv-surface-raised)] p-2">
      <div className="flex items-center gap-1 text-[var(--lkv-text-muted)]">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="text-xs font-bold text-[var(--lkv-text-primary)] mt-1">{value}</p>
    </div>
  );
}

const WEATHER_LABELS: Record<number, string> = {
  0: 'Dégagé',
  1: 'Peu nuageux',
  2: 'Nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine',
  61: 'Pluie',
  63: 'Pluie forte',
  65: 'Pluie très forte',
  71: 'Neige',
  73: 'Neige forte',
  80: 'Averses',
  81: 'Averses fortes',
  95: 'Orage',
  96: 'Orage grêle',
};

function weatherLabel(code: number): string {
  return WEATHER_LABELS[code] ?? 'Variable';
}

/** Météo : conditions actuelles + 5 prochains jours (Open-Meteo). */
export function MeteoBlock({ hiking }: { hiking: HubHikingContext | null }) {
  const current = hiking?.weather?.current;
  const days = (hiking?.weather?.days ?? []).slice(0, 5);
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Météo">
      <div className="flex items-center gap-2">
        <Icon
          name="cloud-sun"
          size={15}
          className="shrink-0 text-[var(--lkv-text-secondary)]"
          aria-hidden="true"
        />
        {current ? (
          <p className="text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
            {Math.round(current.tempC)}°C · {weatherLabel(current.weathercode)}
            {current.precipPct > 0 ? ` · ${Math.round(current.precipPct)}%` : ''}
          </p>
        ) : (
          <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">Météo indisponible</p>
        )}
      </div>
      {days.length === 0 && (
        <p className="mt-2 text-[11px] text-[var(--lkv-text-secondary)]">
          Prévisions indisponibles pour ce parcours.
        </p>
      )}
      {days.length > 0 && (
        <div className="grid grid-cols-5 gap-1 mt-3">
          {days.map((d) => (
            <div
              key={d.date}
              className="rounded-lg bg-[var(--lkv-surface-raised)] p-1.5 text-center"
            >
              <p className="text-[10px] font-medium tabular-nums text-[var(--lkv-text-muted)]">
                {d.day}
              </p>
              <p className="text-[12px] font-bold text-[var(--lkv-text-primary)]">
                {Math.round(d.tempMaxC)}°
              </p>
              <p className="text-[10.5px] text-[var(--lkv-text-secondary)]">
                {Math.round(d.tempMinC)}°
              </p>
              <p className="text-[10.5px] text-[var(--lkv-text-secondary)]">{d.precipPct}%</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Points de passage : POI du voyage (waypoints). */
export function PointsPassageBlock({ pois, slug }: { pois: TripPoi[]; slug: string }) {
  const shown = pois.slice(0, 5);
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Points de passage">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            name="route"
            size={16}
            className="text-[var(--lkv-text-secondary)]"
            aria-hidden="true"
          />
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Points de passage
          </p>
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-[var(--lkv-text-muted)]">
          {pois.length}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm text-[var(--lkv-text-primary)]">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.visited ? 'bg-[var(--lkv-success)]' : 'bg-[var(--lkv-text-muted)]'}`}
            />
            <span className="flex-1 truncate">{p.name}</span>
          </li>
        ))}
      </ul>
      <Link
        href={tripSectionHref(slug, 'itinerary')}
        className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <span>Voir sur l’itinéraire</span>
        <Icon name="arrow-right" size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}

/** Points d'eau détectés le long du parcours. */
export function PointsEauBlock({ count }: { count: number }) {
  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Points d'eau">
      <div className="flex items-center gap-2">
        <Icon
          name="droplets"
          size={15}
          className="shrink-0 text-[var(--lkv-text-secondary)]"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">
          {count} point{count > 1 ? 's' : ''} d’eau
        </p>
      </div>
      <p className="text-xs text-[var(--lkv-text-secondary)] mt-1.5">
        Prévoyez une capacité adaptée entre deux ravitaillements.
      </p>
    </section>
  );
}
