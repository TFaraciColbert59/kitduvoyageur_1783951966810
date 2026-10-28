'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import { travelInfo } from '@/features/carnet/detail/dayinfo';
import { dayDrawerStats } from '@/features/carnet/detail/daydrawer';
import { CARNET_STATS_TABS, summarizeCarnet, type CarnetStatsTab } from '@/features/carnet/detail/stats';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';
import { extractCoords, traceLengthKm } from '../traceGeometry';
import { CarnetSubCapsule, type CarnetSubCapsuleItem } from '../CarnetSubCapsule';
import { CarnetField } from '../CarnetField';
import { CarnetRollValue } from '../CarnetRollValue';
import { CarnetDayRow } from './CarnetDayRow';
import { useScrollCut } from '../useScrollCut';
import {
  dailyBarHeights,
  documentedShare,
  elevationProfile,
  splitUnit,
  type SeriesValue,
} from '../statsGeometry';

export interface CarnetStatsPaneProps {
  detail: CarnetDetail;
  tab: CarnetStatsTab;
  onTabChange: (tab: CarnetStatsTab) => void;
  /**
   * Page de jour affichée sur la carte : `null` sur le Résumé. Quand un jour
   * est actif, les trois volets ne contiennent **que** les données de ce jour
   * (distance, allure, départ, arrivée, cumul, D+, points GPS, numéro, date et
   * récit) ; les totaux et la plage de dates restent au Résumé.
   */
  day?: CarnetDay | null;
}

/** Icône de chaque sous-onglet : aucune étiquette texte, le nom est `aria-label`. */
const TAB_ICONS: Record<CarnetStatsTab, string> = {
  distance: 'route',
  elevation: 'mountain',
  days: 'calendar-days',
};

const TABS: CarnetSubCapsuleItem[] = CARNET_STATS_TABS.map((item) => ({
  id: item.id,
  label: item.label,
  icon: <Icon name={TAB_ICONS[item.id]} size={16} aria-hidden="true" />,
}));

/** Trois lignes au plus par groupe : la règle de densité de la feuille. */
function chunk<T>(items: T[], size = 3): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

function number(value: number | null, suffix: string): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${suffix}`;
}

function dplus(value: number | null): string {
  const formatted = formatElevation(value);
  return formatted ? `${formatted} D+` : '—';
}

function perKm(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  return `${Math.round(value).toLocaleString('fr-FR')} m/km`;
}

interface Hero {
  value: string;
  unit: string;
  /** Trois sous-valeurs, sans libellé long. */
  sub: [string, string, string];
  /** Part documentée : la seule progression mesurable, sans cible inventée. */
  share: number;
}

/**
 * Chiffre héros : 40/700 tabulaire, `-1px`, interligne 1, unité 14/500 accolée,
 * barre de 6 px 12 px sous le chiffre, trois sous-valeurs 12/600 tabulaires.
 * Aucun libellé : une valeur absente s'écrit `— km`, jamais une phrase.
 */
function HeroBlock({ hero, animate, tabKey }: { hero: Hero; animate: boolean; tabKey: string }) {
  return (
    <div className="ckp-hero" key={tabKey} data-animate="true">
      <p className="ckp-hero-num" data-missing={hero.value === '—' ? 'true' : undefined}>
        <CarnetRollValue text={hero.value} animate={animate} className="ckp-hero-value" />
        <span className="ckp-hero-unit">{hero.unit}</span>
      </p>
      <div className="ckp-hero-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(hero.share * 1000) / 10}%` }} />
      </div>
      <div className="ckp-hero-sub">
        {hero.sub.map((item, index) => (
          <span key={index} data-missing={item === '—' ? 'true' : undefined}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const PROFILE_WIDTH = 374;
const PROFILE_HEIGHT = 72;

/**
 * Sous-drawer des trois statistiques de la carte.
 *
 * Anatomie : sous-sélecteur de 30 px à 16 px sous la poignée, 24 px d'air, bloc
 * héros, puis des groupes de trois champs de 48 px séparés par 20 px. Chaque
 * libellé est un placeholder, chaque valeur une donnée réelle ; une valeur
 * absente est un tiret, jamais une phrase ni un zéro.
 */
export function CarnetStatsPane({ detail, tab, onTabChange, day = null }: CarnetStatsPaneProps) {
  const stats = useMemo(() => summarizeCarnet(detail), [detail]);
  /* Lieu et informations de la page : mêmes dérivations que l'ancienne fiche,
     désormais peintes dans les volets concernés. */
  const travel = useMemo(() => travelInfo(detail, day), [day, detail]);
  /* Page de jour : les trois volets ne parlent que de ce jour — aucun total,
     aucune plage de dates, aucune moyenne du carnet. */
  const dayView = useMemo(() => (day ? dayDrawerStats(detail, day) : null), [day, detail]);
  const tracePoints = useMemo(() => extractCoords(detail.trace), [detail.trace]);
  const traceKm = useMemo(() => traceLengthKm(detail.trace), [detail.trace]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useScrollCut(rootRef);

  /* Le rouleau ne joue qu'une fois : à l'ouverture du volet. */
  const rolled = useRef(false);
  useEffect(() => {
    rolled.current = true;
  }, []);

  /* Séries et géométries dérivées : pures, donc mémoïsées sur les jours. */
  const distanceSeries = useMemo<SeriesValue[]>(
    () => detail.etapes.map((day) => day.distanceKm),
    [detail.etapes],
  );
  /* Mêmes jours que `summarizeCarnet` : le D+ dérivé d'une sortie comble une
     étape sans `denivele_m`, donc le profil et les lignes restent d'accord. */
  const elevationSeries = useMemo<SeriesValue[]>(
    () => stats.days.map(({ day }) => day.elevationM),
    [stats.days],
  );
  const daySeries = useMemo<SeriesValue[]>(() => detail.etapes.map(() => 1), [detail.etapes]);
  /* Les géométries agrégées (profil, barres, repères) n'ont aucun sens sur une
     page de jour : elles ne sont pas calculées, donc rien d'agrégé ne traîne. */
  const profile = useMemo(
    () => (dayView ? null : elevationProfile(elevationSeries, PROFILE_WIDTH, PROFILE_HEIGHT)),
    [dayView, elevationSeries],
  );
  const bars = useMemo(() => (dayView ? [] : dailyBarHeights(distanceSeries)), [dayView, distanceSeries]);

  const dayCount = stats.daysCount;
  const dayUnit = dayCount > 1 ? 'jours' : 'jour';

  const hero = useMemo<Record<CarnetStatsTab, Hero>>(() => {
    if (dayView) {
      /* Un seul jour : le chiffre héros est celui du jour, ses trois
         sous-valeurs aussi. Aucune moyenne ni total ne descend du carnet. */
      const dayDistance = formatKm(dayView.distanceKm);
      const dayElevation = formatElevation(dayView.elevationM);
      const dayLabel = `J${dayView.dayNumber}`;
      const dayDate = dayView.date ?? '—';
      const dayDuration = dayView.duration ?? '—';

      return {
        distance: {
          value: splitUnit(dayDistance).value,
          unit: 'km',
          sub: [dayLabel, dayDate, dayDuration],
          share: dayDistance ? 1 : 0,
        },
        elevation: {
          value: splitUnit(dayElevation).value,
          unit: 'm',
          sub: [dayLabel, dayDate, dayDuration],
          share: dayElevation ? 1 : 0,
        },
        days: {
          value: dayView.dayNumber.toLocaleString('fr-FR'),
          unit: 'jour',
          sub: [dayDate, dayDistance ?? '—', dplus(dayView.elevationM)],
          share: 1,
        },
      };
    }

    return {
      distance: {
        value: splitUnit(formatKm(stats.distanceKm)).value,
        unit: 'km',
        sub: [
          dayCount > 0 ? `${dayCount} étapes` : '—',
          number(stats.averageDistanceKm, 'km/j'),
          perKm(stats.elevationPerKm),
        ],
        share: documentedShare(distanceSeries),
      },
      elevation: {
        value: splitUnit(formatElevation(stats.elevationM)).value,
        unit: 'm',
        sub: [
          dplus(stats.averageElevationM),
          stats.maxElevationDay
            ? `${formatElevation(stats.maxElevationDay.elevationM) ?? '—'} · ${stats.maxElevationDay.label}`
            : '—',
          `${stats.daysWithElevation.length} / ${dayCount} ${dayUnit}`,
        ],
        share: documentedShare(elevationSeries),
      },
      days: {
        value: dayCount > 0 ? dayCount.toLocaleString('fr-FR') : '—',
        unit: dayUnit,
        sub: [
          formatKm(stats.distanceKm) ?? '—',
          number(stats.averageDistanceKm, 'km/j'),
          formatElevation(stats.elevationM) ?? '—',
        ],
        share: documentedShare(daySeries),
      },
    };
  }, [dayCount, daySeries, dayUnit, dayView, distanceSeries, elevationSeries, stats]);

  /* Trois repères verticaux : les vrais jours placés aux quarts de l'axe. */
  const ticks = useMemo(
    () =>
      detail.etapes.length
        ? [0.25, 0.5, 0.75].map((ratio) => {
            const index = Math.min(detail.etapes.length - 1, Math.round(ratio * (detail.etapes.length - 1)));
            return `J${detail.etapes[index].dayNumber}`;
          })
        : [],
    [detail.etapes],
  );

  const traceBroken = tracePoints.length === 1;
  const traceValue = useMemo(
    () =>
      tracePoints.length > 1
        ? `${tracePoints.length} pts${traceKm ? ` · ${formatKm(traceKm)}` : ''}`
        : '',
    [traceKm, tracePoints.length],
  );

  const distanceDays = stats.daysWithDistance;
  const elevationDays = stats.daysWithElevation;
  const distanceGroups = useMemo(() => chunk(distanceDays), [distanceDays]);
  const elevationGroups = useMemo(() => chunk(elevationDays), [elevationDays]);

  const changeTab = useCallback((id: string) => onTabChange(id as CarnetStatsTab), [onTabChange]);

  return (
    <div className="ckp-pane ckp-stats" ref={rootRef}>
      {/* Rappel de données au défilement : l'icône du sous-onglet et le total.
          Aucun libellé texte, donc aucun titre qui doublerait le chiffre. */}
      <div className="ckp-stats-sticky" data-on={scrolled ? 'true' : undefined} aria-hidden="true">
        <div>
          <span className="ckp-stats-sticky-icon">
            <Icon name={TAB_ICONS[tab]} size={16} aria-hidden="true" />
          </span>
          <b>{`${hero[tab].value} ${hero[tab].unit}`}</b>
        </div>
      </div>

      <div className="ckp-stats-seg">
        <CarnetSubCapsule
          items={TABS}
          active={tab}
          onChange={changeTab}
          ariaLabel="Statistiques du carnet"
        />
      </div>

      {tab === 'distance' ? (
        <div className="ckp-pane-body" role="tabpanel" aria-label="Distance">
          <HeroBlock hero={hero.distance} animate={!rolled.current} tabKey="distance" />

          {dayView ? (
            <>
              {/* Page de jour : départ, arrivée, allure et cumul du jour. */}
              <div className="ckp-group">
                <CarnetField
                  icon={<Icon name="map-pin" size={16} aria-hidden="true" />}
                  label="départ"
                  value={dayView.from ?? ''}
                  wide
                  ariaLabel={`départ ${dayView.from ?? '—'}`}
                />
                <CarnetField
                  icon={<Icon name="flag" size={16} aria-hidden="true" />}
                  label="arrivée"
                  value={dayView.to ?? ''}
                  wide
                  ariaLabel={`arrivée ${dayView.to ?? '—'}`}
                />
              </div>

              <div className="ckp-group">
                <CarnetField
                  label="allure"
                  value={dayView.pace ?? ''}
                  ariaLabel={`allure ${dayView.pace ?? '—'}`}
                />
                <CarnetField
                  label="depuis le départ"
                  value={formatKm(dayView.cumulativeKm) ?? ''}
                  ariaLabel={`depuis le départ ${formatKm(dayView.cumulativeKm) ?? '—'}`}
                />
              </div>
            </>
          ) : (
            <>
              <div className="ckp-group">
                <CarnetField
                  icon={<Icon name="compass" size={16} aria-hidden="true" />}
                  label="lieu"
                  value={travel.place ?? ''}
                  wide
                  ariaLabel={`lieu ${travel.place ?? '—'}`}
                />
                <CarnetField
                  icon={<Icon name="map-pin" size={16} aria-hidden="true" />}
                  label="départ"
                  value={travel.from ?? stats.startPlace ?? ''}
                  wide
                  ariaLabel={`départ ${travel.from ?? stats.startPlace ?? '—'}`}
                />
                <CarnetField
                  icon={<Icon name="flag" size={16} aria-hidden="true" />}
                  label="arrivée"
                  value={travel.to ?? stats.endPlace ?? ''}
                  wide
                  ariaLabel={`arrivée ${travel.to ?? stats.endPlace ?? '—'}`}
                />
              </div>

              <div className="ckp-group">
                <CarnetField
                  label="allure"
                  value={travel.pace ?? ''}
                  ariaLabel={`allure ${travel.pace ?? '—'}`}
                />
                <CarnetField
                  label="depuis le départ"
                  value={travel.cumulative ?? ''}
                  ariaLabel={`depuis le départ ${travel.cumulative ?? '—'}`}
                />
                <CarnetField
                  icon={<Icon name="route" size={16} aria-hidden="true" />}
                  label="trace gps"
                  value={traceValue}
                  error={traceBroken}
                  ariaLabel={`trace gps ${traceValue || '—'}`}
                />
              </div>

              {distanceDays.length === 0 ? (
                <div className="ckp-group">
                  <CarnetField label="distance par jour" value="" />
                </div>
              ) : (
                distanceGroups.map((group) => (
                  <div className="ckp-group" key={group[0]?.id ?? 'empty'}>
                    {group.map((day) => (
                      <CarnetField
                        key={day.id}
                        label={day.label}
                        value={formatKm(day.distanceKm) ?? ''}
                        ariaLabel={`${day.label} ${formatKm(day.distanceKm) ?? '—'}`}
                      />
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === 'elevation' ? (
        <div className="ckp-pane-body" role="tabpanel" aria-label="Dénivelé">
          <HeroBlock hero={hero.elevation} animate={!rolled.current} tabKey="elevation" />

          {profile ? (
            <div className="ckp-elev">
              {ticks.length === 3 ? (
                <div className="ckp-elev-axis" aria-hidden="true">
                  {ticks.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              ) : null}
              <svg
                viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path d={profile.area} fill="rgba(23,64,44,.12)" />
                {[0.25, 0.5, 0.75].map((ratio) => (
                  <line
                    key={ratio}
                    x1={PROFILE_WIDTH * ratio}
                    x2={PROFILE_WIDTH * ratio}
                    y1="0"
                    y2={PROFILE_HEIGHT}
                    stroke="rgba(23,43,36,.06)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <path
                  d={profile.line}
                  fill="none"
                  stroke="#17402C"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span
                className="ckp-elev-summit"
                style={{
                  left: `${(profile.summit.x / PROFILE_WIDTH) * 100}%`,
                  top: `${profile.summit.y}px`,
                }}
              >
                <i aria-hidden="true" />
                <b>{formatElevation(profile.max) ?? '—'}</b>
              </span>
              <div className="ckp-elev-bars" aria-hidden="true">
                {bars.map((height, index) => (
                  <i
                    key={detail.etapes[index]?.id ?? index}
                    data-empty={height === null ? 'true' : undefined}
                    style={{ height: height ?? 2 }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="ckp-group">
            {dayView ? (
              <>
                {/* Page de jour : distance et points GPS du jour. Le D+ du jour
                    est le chiffre héros — aucun total, aucune moyenne. */}
                <CarnetField
                  label="distance du jour"
                  value={formatKm(dayView.distanceKm) ?? ''}
                />
                <CarnetField
                  icon={<Icon name="route" size={16} aria-hidden="true" />}
                  label="points gps"
                  value={dayView.gpsPoints > 0 ? `${dayView.gpsPoints} pts` : ''}
                />
              </>
            ) : (
              <>
                <CarnetField
                  label="dénivelé du jour"
                  value={travel.elevationM !== null ? dplus(travel.elevationM) : ''}
                  ariaLabel={`dénivelé du jour ${dplus(travel.elevationM)}`}
                />
                <CarnetField label="dénivelé par km" value={perKm(stats.elevationPerKm)} />
                <CarnetField
                  label="jours sans dénivelé"
                  value={stats.daysWithoutElevation.toLocaleString('fr-FR')}
                />
              </>
            )}
          </div>

          {dayView ? null : elevationDays.length === 0 ? (
            <div className="ckp-group">
              <CarnetField label="dénivelé par jour" value="" />
            </div>
          ) : (
            elevationGroups.map((group) => (
              <div className="ckp-group" key={group[0]?.id ?? 'empty'}>
                {group.map((day) => (
                  <CarnetField
                    key={day.id}
                    label={day.label}
                    value={dplus(day.elevationM)}
                    ariaLabel={`${day.label} ${dplus(day.elevationM)}`}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'days' ? (
        <div className="ckp-pane-body" role="tabpanel" aria-label="Jours">
          <HeroBlock hero={hero.days} animate={!rolled.current} tabKey="days" />
          {/* Le récit : celui du jour quand il en porte un, sinon le récit
              global du carnet, affiché une seule fois. */}
          {dayView ? (
            <>
              {dayView.story ? <p className="ckp-story">{dayView.story}</p> : null}
              <div className="ckp-group">
                <CarnetField label="jour" value={String(dayView.dayNumber)} />
                <CarnetField label="date" value={dayView.date ?? ''} />
              </div>
            </>
          ) : (
            <>
              {detail.description ? <p className="ckp-story">{detail.description}</p> : null}
              <div className="ckp-group">
                <CarnetField
                  label="jour"
                  value={travel.dayNumber !== null ? String(travel.dayNumber) : ''}
                />
                <CarnetField label="date" value={travel.date ?? ''} />
                <CarnetField label="dates" value={detail.dateRange ?? ''} wide />
              </div>
              {stats.days.length === 0 ? null : (
                <div className="ckp-daylist">
                  {stats.days.map(({ day, moments }) => (
                    <CarnetDayRow key={day.id} day={day} moments={moments} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CarnetStatsPane;
