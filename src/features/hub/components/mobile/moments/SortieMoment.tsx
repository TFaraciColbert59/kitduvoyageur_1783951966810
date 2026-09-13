import type { ReactNode } from 'react';
import {
  BedDouble,
  CalendarDays,
  Clock,
  Flag,
  PenLine,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { MomentMapCard } from '../MomentMapCard';
import {
  formatKm,
  poiCategoryMeta,
  selectSortieMoment,
  type SortieContext,
} from '../../../mobile/mobileHubEngine';
import { HUB_HOME_HREF, hubSectionHref, type HubAdventureRef } from '../../../registry/hubSectionRegistry';
import { estimateHikeDurationMin, formatHikeDuration } from '../../../engine/activityTypes';
import { decideHikingNavigation } from '../../../engine/hikingNavigation';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { HubHikingContext } from '../../../server/getHubAdventureData';

export interface SortieMomentProps {
  trip: TripFull;
  context: SortieContext;
  hiking?: HubHikingContext | null;
  /** Carte plein écran vertical sur la racine du hub (mobile). */
  fillViewport?: boolean;
}

function MomentRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px]">
      <Icon size={13} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
      <span className="shrink-0 font-medium text-[var(--lkv-text-secondary)]">{label}</span>
      <span className="ml-auto min-w-0 truncate font-bold text-[var(--lkv-text-primary)]">{value}</span>
    </li>
  );
}

export function SortieMoment({ trip, context, hiking, fillViewport = false }: SortieMomentProps) {
  const moment = selectSortieMoment({ trip, context });
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };

  const points = moment.pois
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      label: p.name,
      color: poiCategoryMeta(p.category, p.name).color,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const legendMap = new Map<string, string>();
  for (const p of moment.pois) {
    const meta = poiCategoryMeta(p.category, p.name);
    if (!legendMap.has(meta.label)) legendMap.set(meta.label, meta.color);
  }
  const legend = [...legendMap.entries()].map(([label, color]) => ({ label, color }));

  const duration =
    moment.distanceKm > 0 || moment.dPlus > 0
      ? estimateHikeDurationMin(moment.distanceKm, moment.dPlus)
      : null;

  // Phase 3 — en préparation, un parcours lié n'ouvre la navigation que si sa
  // géométrie BDD est réelle et navigable ; sinon « Choisir un parcours »
  // (jamais une navigation sur estimation `uniform_from_blueprint`).
  const navigation = decideHikingNavigation(hiking ?? null);
  const hasRoute = Boolean(hiking?.routeId);
  const cta =
    context.phase === 'live'
      ? { href: hubSectionHref(ref, 'itinerary'), label: 'Voir l’itinéraire' }
      : context.phase === 'recount'
        ? { href: `${HUB_HOME_HREF}?phase=recount`, label: 'Voir le bilan' }
        : hasRoute
          ? { href: navigation.href, label: navigation.label }
          : { href: hubSectionHref(ref, 'itinerary'), label: 'Voir l’itinéraire' };

  const sheetTitle =
    context.phase === 'live'
      ? `Étape du jour — ${moment.title}`
      : context.phase === 'recount'
        ? 'Bilan de l’expédition'
        : 'Départ de l’expédition';

  let panel: ReactNode;
  if (context.phase === 'live') {
    panel = (
      <>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[26px] font-extrabold leading-none tracking-tight text-[var(--lkv-text-primary)]">
              {moment.distanceKm > 0 ? `${formatKm(moment.distanceKm)} km` : 'Étape du jour'}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
              {moment.stepCount > 0
                ? `${moment.stepCount} étape${moment.stepCount > 1 ? 's' : ''}`
                : 'aucune étape planifiée'}
              {moment.dPlus > 0 ? ` · +${moment.dPlus.toLocaleString('fr-FR')} m` : ''}
              {moment.dMinus > 0 ? ` / -${moment.dMinus.toLocaleString('fr-FR')} m` : ''}
            </p>
          </div>
          {duration != null && (
            <p className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--lkv-text-primary)]">
              <Clock size={12} aria-hidden="true" />
              {formatHikeDuration(duration)}
            </p>
          )}
        </div>

        {moment.pois.length > 0 && (
          <ul className="mt-2.5 flex gap-1.5 overflow-x-auto" aria-label="Points d’intérêt du jour">
            {moment.pois.slice(0, 8).map((p) => {
              const meta = poiCategoryMeta(p.category, p.name);
              return (
                <li
                  key={p.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-2 py-1 text-[10.5px] font-semibold text-[var(--lkv-text-primary)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta.color }}
                    aria-hidden="true"
                  />
                  <span className="max-w-[7.5rem] truncate">{p.name}</span>
                </li>
              );
            })}
          </ul>
        )}

        {moment.accommodation || moment.checkpoint || moment.note ? (
          <ul className="mt-2.5 space-y-1.5 border-t border-black/5 pt-2.5">
            {moment.accommodation && (
              <MomentRow icon={BedDouble} label="Nuit" value={moment.accommodation} />
            )}
            {moment.checkpoint && (
              <MomentRow icon={Shield} label="Point de contrôle" value={moment.checkpoint.label} />
            )}
            {moment.note && (
              <MomentRow icon={PenLine} label="Note du jour" value={moment.note.title || 'Journal'} />
            )}
          </ul>
        ) : (
          <p className="mt-2.5 border-t border-black/5 pt-2.5 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
            Rien de particulier pour cette étape.
          </p>
        )}
      </>
    );
  } else if (context.phase === 'recount') {
    panel = (
      <>
        <p className="font-display text-[26px] font-extrabold leading-none tracking-tight text-[var(--lkv-text-primary)]">
          {formatKm(moment.distanceKm)} km parcourus
        </p>
        <p className="mt-1 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
          {moment.stepCount} étapes · +{moment.dPlus.toLocaleString('fr-FR')} m de dénivelé
        </p>
        {moment.note ? (
          <ul className="mt-2.5 space-y-1.5 border-t border-black/5 pt-2.5">
            <MomentRow
              icon={PenLine}
              label="Dernière note"
              value={moment.note.title || moment.note.content.slice(0, 40)}
            />
          </ul>
        ) : (
          <p className="mt-2.5 border-t border-black/5 pt-2.5 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
            Aucune note de carnet — racontez l’expédition.
          </p>
        )}
      </>
    );
  } else {
    panel = (
      <>
        <p className="font-display text-[26px] font-extrabold leading-none tracking-tight text-[var(--lkv-text-primary)]">
          {formatKm(moment.distanceKm)} km
        </p>
        <p className="mt-1 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
          {moment.stepCount} étapes au programme
        </p>
        <ul className="mt-2.5 space-y-1.5 border-t border-black/5 pt-2.5">
          {moment.dateLabel && (
            <MomentRow icon={CalendarDays} label="Départ" value={moment.dateLabel} />
          )}
          <MomentRow icon={Flag} label="Première étape" value={moment.title} />
          {moment.accommodation && (
            <MomentRow icon={BedDouble} label="Nuit" value={moment.accommodation} />
          )}
        </ul>
        {hasRoute && !navigation.enabled && navigation.reason && (
          <p className="mt-2 border-t border-black/5 pt-2 text-[10.5px] font-medium text-[var(--lkv-text-secondary)]">
            {navigation.reason}
          </p>
        )}
      </>
    );
  }

  const sheetContent = (
    <div className="space-y-2 pb-4">
      <p className="text-xs font-semibold text-[var(--lkv-text-primary)]">{moment.title}</p>
      <ul className="space-y-1.5">
        {context.phase === 'prepare' && moment.dateLabel && (
          <MomentRow icon={CalendarDays} label="Départ" value={moment.dateLabel} />
        )}
        <MomentRow icon={Flag} label="Étapes" value={String(moment.stepCount)} />
        <MomentRow icon={Clock} label="Distance" value={`${formatKm(moment.distanceKm)} km`} />
      </ul>
      {moment.pois.length > 0 && (
        <ul className="space-y-1.5 border-t border-black/5 pt-2">
          {moment.pois.map((p) => {
            const meta = poiCategoryMeta(p.category, p.name);
            return (
              <li key={p.id} className="flex items-center gap-2 text-[11.5px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate font-semibold text-[var(--lkv-text-primary)]">
                  {p.name}
                </span>
                <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--lkv-text-muted)]">
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {hiking?.weather?.current && (
        <p className="border-t border-black/5 pt-2 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
          Météo du jour : {Math.round(hiking.weather.current.tempC)}°C ·{' '}
          {hiking.weather.locationLabel ?? 'sur place'}
        </p>
      )}
    </div>
  );

  return (
    <MomentMapCard
      eyebrow={moment.eyebrow}
      badge={moment.badge}
      dateLabel={moment.dateLabel}
      routeCoords={moment.routeCoords}
      highlightCoords={moment.highlightCoords}
      points={points}
      panel={panel}
      legend={legend}
      cta={cta}
      sheetTitle={sheetTitle}
      sheetContent={sheetContent}
      reserveFabSpace={context.phase === 'live'}
      fillViewport={fillViewport}
    />
  );
}

export default SortieMoment;
