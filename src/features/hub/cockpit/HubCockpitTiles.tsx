'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { IdentityPill } from '@/features/community/feed/PostAuthorPill';
import { CarnetClock } from './CarnetClock';
import { weatherGlyph } from './weatherGlyph';
import { formatWeight, type KitWeightSummary } from './kitMath';
import { evaluateDocumentExpiry } from './paperasseStatus';
import { estimateTrailCondition } from './weatherAdvanced';
import { stepStatusLabels, type StepExecution } from './stepExecution';
import type { CockpitData, CockpitExpense, CockpitReservation, CockpitStep, CockpitWeatherDay } from './model';
import type { CockpitWidgetKey } from './cockpitReadiness';
import type { OfflineMapPack } from './offlineMapPack';
import styles from './cockpit.module.css';

const Map = dynamic(() => import('./HubCockpitMap').then((mod) => mod.HubCockpitMap), {
  ssr: false,
  loading: () => <p className={styles.mapStatus} role="status">Chargement de la carte</p>,
});

const numberFmt = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const moneyFmt = ({ amount, currency }: { amount: number; currency: string }) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

function dateShort(date: string | null | undefined) {
  if (!date) return null;
  const time = Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(time)
    : null;
}

export interface HubCockpitTilesProps {
  data: CockpitData;
  fixture: boolean;
  day: number;
  dayMap: CockpitData;
  daySteps: CockpitStep[];
  dayMoments: NonNullable<CockpitData['carnet']>['moments'];
  clockHour: number;
  forecast: CockpitData['weather'];
  weatherPending: boolean;
  onLocateWeather: () => void;
  dailyBudget: {
    spent: { currency: string; amount: number }[];
    planned: { currency: string; amount: number }[];
    expenses: CockpitExpense[];
    estimate: boolean;
  } | null;
  dayKit: CockpitData['kit'];
  packedCount: number;
  kitWeights: KitWeightSummary;
  reservations: CockpitReservation[];
  activeDateIso: string;
  mapPack: OfflineMapPack | null;
  executionFor: (stepId: string) => StepExecution | undefined;
  onOpen: (widget: CockpitWidgetKey, detail?: string, opener?: HTMLElement | null) => void;
  onOpenShare?: () => void;
}

function TileShell({
  widgetKey,
  icon,
  title,
  badge,
  className,
  onOpen,
  children,
}: {
  widgetKey: CockpitWidgetKey;
  icon: string;
  title: string;
  badge?: ReactNode;
  className?: string;
  onOpen: (widget: CockpitWidgetKey, detail?: string, opener?: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.glassTile} ${className ?? ''}`} data-widget={widgetKey}>
      <div className={styles.tileHeader}>
        <h2>
          <button
            className={styles.heading}
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => onOpen(widgetKey, undefined, event.currentTarget)}
          >
            <span className={styles.headingBadge} aria-hidden="true">
              <Icon name={icon} size={15} />
            </span>
            <span>{title}</span>
            <Icon className={styles.chevron} name="chevron-right" size={14} />
          </button>
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function HubCockpitTiles({
  data,
  fixture,
  day,
  dayMap,
  daySteps,
  dayMoments,
  clockHour,
  forecast,
  weatherPending,
  onLocateWeather,
  dailyBudget,
  dayKit,
  packedCount,
  kitWeights,
  reservations,
  activeDateIso,
  mapPack,
  executionFor,
  onOpen,
  onOpenShare,
}: HubCockpitTilesProps) {
  const dayDist = daySteps.reduce((sum, st) => sum + (st.distance ?? 0), 0) || data.distance || 0;
  const dayElev = daySteps.reduce((sum, st) => sum + (st.elevation ?? 0), 0) || data.elevation || 0;
  const completedSteps = daySteps.filter((st) => executionFor(st.id)?.status === 'completed').length;

  const currentWeatherDay: CockpitWeatherDay | undefined = forecast?.days[0];
  const trailCond = estimateTrailCondition({
    rainMm: currentWeatherDay?.rain,
    minTempC: currentWeatherDay?.low,
    maxTempC: currentWeatherDay?.high,
  });

  const forecastDate = forecast?.observedAt?.slice(0, 10);
  const upcomingWeatherDays = (
    forecastDate ? forecast?.days.filter((entry) => entry.date > forecastDate) : forecast?.days
  )?.slice(0, 5);

  // Budget summary
  const defaultCurrency = dailyBudget?.planned[0]?.currency ?? dailyBudget?.spent[0]?.currency ?? 'EUR';
  const spentDay = dailyBudget?.spent.find((r) => r.currency === defaultCurrency)?.amount ?? 0;
  const plannedDay = dailyBudget?.planned.find((r) => r.currency === defaultCurrency)?.amount ?? null;
  const budgetPct = plannedDay && plannedDay > 0 ? Math.min(100, Math.round((spentDay / plannedDay) * 100)) : 0;
  const budgetTone = plannedDay && spentDay > plannedDay ? 'bad' : budgetPct > 85 ? 'warn' : 'good';

  // Kit summary
  const kitPct = dayKit.length > 0 ? Math.round((packedCount / dayKit.length) * 100) : 0;

  // Paperasse summary
  const expiredDocs = (data.documents ?? []).filter(
    (d) => evaluateDocumentExpiry(d.expiration, activeDateIso).health === 'expired',
  ).length;
  const urgentRes = reservations.filter((r) => r.status === 'À réserver').length;

  return (
    <div className={styles.bentoLayout}>
      {data.trip && (
        <div className={styles.heroBand}>
          {/* 1. CARTE SPATIALE HERO */}
          <TileShell
            widgetKey="carte"
            icon="map"
            title="Carte & Trace"
            className={styles.tileMap}
            onOpen={onOpen}
            badge={
              mapPack ? (
                <span className={styles.miniChip} data-tone="good">
                  <Icon name="check" size={11} /> Hors ligne
                </span>
              ) : null
            }
          >
            <div className={styles.mapStageWrap}>
              <button
                className={styles.mapOpen}
                type="button"
                aria-label="Ouvrir la carte complète"
                onClick={(event) => onOpen('carte', undefined, event.currentTarget)}
              >
                <Map data={dayMap} fixture={fixture} />
              </button>

              <div className={styles.mapHudOverlay} aria-hidden="true">
                {dayDist > 0 && (
                  <span className={styles.mapHudPill}>
                    <strong>{numberFmt(dayDist)}</strong> km
                  </span>
                )}
                {dayElev > 0 && (
                  <span className={styles.mapHudPill}>
                    <strong>+{numberFmt(dayElev)}</strong> m
                  </span>
                )}
                <span className={styles.mapHudPill}>
                  <strong>{daySteps.length}</strong> étape{daySteps.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </TileShell>

          {/* 2. COLONNE TACTIQUE : MÉTÉO + ÉTAPES */}
          <div className={styles.tacticalCol}>
            {/* MÉTÉO ATMOSPHÉRIQUE */}
            <TileShell
              widgetKey="meteo"
              icon="cloud-sun"
              title="Météo"
              className={styles.tileMeteo}
              onOpen={onOpen}
              badge={
                forecast?.source ? (
                  <span className={styles.miniChip} data-tone="water">{forecast.source}</span>
                ) : null
              }
            >
              {forecast ? (
                <div className={styles.meteoContent}>
                  <div className={styles.meteoPrimary}>
                    <div className={styles.meteoTempGroup}>
                      {forecast.weatherCode != null && (
                        <span className={styles.meteoGlyphBubble} aria-hidden="true">
                          <Icon name={weatherGlyph(forecast.weatherCode)} size={24} />
                        </span>
                      )}
                      <div>
                        <span className={styles.bigFigure}>{numberFmt(forecast.temperature)}°</span>
                        <p className={styles.subCaption}>
                          {forecast.condition}
                          {forecast.place ? ` · ${forecast.place}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className={styles.meteoMetricsRow}>
                      {currentWeatherDay?.wind != null && (
                        <span className={styles.miniChip} data-tone="neutral">
                          <Icon name="wind" size={12} /> {numberFmt(currentWeatherDay.wind)} km/h
                        </span>
                      )}
                      {currentWeatherDay?.rain != null && (
                        <span className={styles.miniChip} data-tone={currentWeatherDay.rain >= 5 ? 'water' : 'neutral'}>
                          <Icon name="cloud-rain" size={12} /> {numberFmt(currentWeatherDay.rain)} mm
                        </span>
                      )}
                      {trailCond.condition !== 'unknown' && (
                        <span className={styles.miniChip} data-tone="good">
                          {trailCond.label.replace(' (estimation)', '')}
                        </span>
                      )}
                    </div>
                  </div>

                  {upcomingWeatherDays && upcomingWeatherDays.length > 0 && (
                    <div className={styles.softRail} data-no-swipe="true" role="group" aria-label="Prochains jours">
                      {upcomingWeatherDays.map((entry) => (
                        <button
                          key={entry.date}
                          type="button"
                          className={styles.forecastPill}
                          data-hub-item={entry.date}
                          onClick={(e) => onOpen('meteo', entry.date, e.currentTarget)}
                        >
                          <span className={styles.forecastDay}>{entry.day}</span>
                          <strong className={styles.forecastTemp}>
                            {entry.high != null ? `${numberFmt(entry.high)}°` : '—'}
                          </strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyInline}>
                  <p className={styles.meta}>
                    {weatherPending ? 'Récupération des prévisions…' : 'Météo locale non chargée'}
                  </p>
                  {!fixture && (
                    <button
                      type="button"
                      className={styles.softActionBtn}
                      disabled={weatherPending}
                      onClick={onLocateWeather}
                    >
                      <Icon name="locate" size={14} /> Ma position
                    </button>
                  )}
                </div>
              )}
            </TileShell>

            {/* ÉTAPES TIMELINE DU JOUR */}
            <TileShell
              widgetKey="etapes"
              icon="footprints"
              title={`Étapes · J${day}`}
              className={styles.tileSteps}
              onOpen={onOpen}
              badge={
                daySteps.length > 0 ? (
                  <span className={styles.miniChip} data-tone={completedSteps === daySteps.length ? 'good' : 'tint'}>
                    {completedSteps}/{daySteps.length}
                  </span>
                ) : null
              }
            >
              <m.div
                key={day}
                className={styles.stepsTimeline}
                initial={{ opacity: 0.72 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16 }}
              >
                {daySteps.length > 0 ? (
                  daySteps.slice(0, 4).map((step, index) => {
                    const exec = executionFor(step.id);
                    const status = exec?.status ?? 'planned';
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={styles.stepRowBtn}
                        data-hub-item={step.id}
                        onClick={(e) => onOpen('etapes', step.id, e.currentTarget)}
                      >
                        <span className={styles.stepNode} data-status={status} aria-hidden="true">
                          {status === 'completed' ? '✓' : index + 1}
                        </span>
                        <span className={styles.stepRowBody}>
                          <strong className={styles.stepRowTitle}>{step.title}</strong>
                          <span className={styles.stepRowMeta}>
                            {[
                              step.time,
                              step.distance ? `${numberFmt(step.distance)} km` : null,
                              step.elevation ? `+${numberFmt(step.elevation)} m` : null,
                              step.place,
                            ]
                              .filter(Boolean)
                              .join(' · ') || stepStatusLabels[status]}
                          </span>
                        </span>
                        <Icon className={styles.chevron} name="chevron-right" size={14} />
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.emptyInline}>
                    <p className={styles.meta}>
                      {data.unavailableSections?.includes('steps')
                        ? 'Étapes momentanément indisponibles'
                        : `Aucune étape prévue le jour ${day}`}
                    </p>
                    {!fixture && (
                      <Link href={`/hub/itineraire?jour=${day}`} className={styles.softActionBtn}>
                        Planifier <Icon name="chevron-right" size={14} />
                      </Link>
                    )}
                  </div>
                )}
              </m.div>
            </TileShell>
          </div>
        </div>
      )}

      {/* 3. RANGÉE OPÉRATIONNELLE (KITS · BUDGET · CARNET · PAPERASSE) */}
      {data.trip && (
        <div className={styles.opsGrid}>
          {/* KITS & SAC */}
          <TileShell
            widgetKey="kit"
            icon="backpack"
            title="Sac & Kit"
            className={styles.tileOps}
            onOpen={onOpen}
            badge={
              kitWeights.vitalUnpackedCount > 0 ? (
                <span className={styles.miniChip} data-tone="bad">
                  {kitWeights.vitalUnpackedCount} vital
                </span>
              ) : null
            }
          >
            <div className={styles.opsBody}>
              <div className={styles.opsMetricRow}>
                <span className={styles.opsFigure}>
                  {dayKit.length > 0 ? `${packedCount}/${dayKit.length}` : '—'}
                </span>
                {kitWeights.totalWeightGrams > 0 && (
                  <span className={styles.monoChip}>{formatWeight(kitWeights.totalWeightGrams)}</span>
                )}
              </div>
              {dayKit.length > 0 ? (
                <div className={styles.meterTrack} role="progressbar" aria-valuenow={kitPct} aria-valuemin={0} aria-valuemax={100}>
                  <span
                    className={styles.meterFill}
                    data-tone={kitPct === 100 ? 'good' : 'tint'}
                    style={{ width: `${kitPct}%` }}
                  />
                </div>
              ) : null}
              <p className={styles.subCaption}>
                {data.kitName ?? (data.confirmedParticipant ? 'Accès équipe' : dayKit.length ? 'Éléments prêts' : 'Aucun kit lié')}
              </p>
            </div>
          </TileShell>

          {/* BUDGET */}
          <TileShell
            widgetKey="budget"
            icon="wallet"
            title="Budget"
            className={styles.tileOps}
            onOpen={onOpen}
          >
            <div className={styles.opsBody}>
              {dailyBudget ? (
                <>
                  <div className={styles.opsMetricRow}>
                    <span className={styles.opsFigure}>{moneyFmt({ amount: spentDay, currency: defaultCurrency })}</span>
                    {plannedDay != null && (
                      <span className={styles.subCaption}>/{moneyFmt({ amount: plannedDay, currency: defaultCurrency })}</span>
                    )}
                  </div>
                  {plannedDay != null && (
                    <div className={styles.meterTrack} role="progressbar" aria-valuenow={budgetPct} aria-valuemin={0} aria-valuemax={100}>
                      <span
                        className={styles.meterFill}
                        data-tone={budgetTone}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  )}
                  <p className={styles.subCaption}>
                    {dailyBudget.expenses.length > 0
                      ? `${dailyBudget.expenses.length} dépense${dailyBudget.expenses.length > 1 ? 's' : ''} · J${day}`
                      : `Aucune dépense · J${day}`}
                  </p>
                </>
              ) : (
                <p className={styles.meta}>Budget non configuré</p>
              )}
            </div>
          </TileShell>

          {/* CARNET & MOMENTS */}
          <TileShell
            widgetKey="carnet"
            icon="book-open"
            title="Carnet"
            className={styles.tileOps}
            onOpen={onOpen}
            badge={
              dayMoments.length > 0 ? (
                <span className={styles.miniChip} data-tone="good">{dayMoments.length}</span>
              ) : null
            }
          >
            <m.div
              key={day}
              className={styles.carnetBody}
              initial={{ opacity: 0.72 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
            >
              <CarnetClock
                focusHour={clockHour}
                moments={dayMoments}
                onOpen={(value, element) => onOpen('carnet', `heure-${value}`, element)}
              />
              <button
                className={styles.momentAddBox}
                type="button"
                aria-label="Ajouter un moment"
                title="Ajouter un moment"
                data-hub-item="ajouter"
                onClick={(event) => onOpen('carnet', 'ajouter', event.currentTarget)}
              >
                <Icon name="plus" size={20} />
              </button>
            </m.div>
          </TileShell>

          {/* PAPERASSE & RÉSERVATIONS */}
          <TileShell
            widgetKey="paperasse"
            icon="folder"
            title="Paperasse"
            className={styles.tileOps}
            onOpen={onOpen}
            badge={
              expiredDocs > 0 ? (
                <span className={styles.miniChip} data-tone="bad">{expiredDocs} expiré</span>
              ) : urgentRes > 0 ? (
                <span className={styles.miniChip} data-tone="warn">{urgentRes} à faire</span>
              ) : null
            }
          >
            <div className={styles.opsBody}>
              {reservations.length > 0 ? (
                <div className={styles.softRail} data-no-swipe="true" role="group" aria-label="Réservations">
                  {reservations.slice(0, 3).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={styles.compactChipBtn}
                      data-hub-item={entry.id}
                      onClick={(e) => onOpen('paperasse', entry.id, e.currentTarget)}
                    >
                      <strong>{entry.title}</strong>
                      <span>{dateShort(entry.due) ?? entry.status}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <span className={styles.opsFigure}>{data.documents?.length ?? 0}</span>
                  <p className={styles.subCaption}>
                    {data.documents?.length
                      ? `document${data.documents.length > 1 ? 's' : ''} · 0 résa en retard`
                      : 'Tout est en ordre'}
                  </p>
                </>
              )}
            </div>
          </TileShell>
        </div>
      )}

      {/* 4. BANDEAU CORDÉE & SÉCURITÉ */}
      {(data.trip || data.collective) && (
        <TileShell
          widgetKey="groupe"
          icon="users"
          title="Cordée & Sécurité"
          className={styles.tileCrew}
          onOpen={onOpen}
          badge={
            <div className={styles.crewHeaderActions}>
              {data.pending > 0 && (
                <span className={styles.miniChip} data-tone="warn">
                  {data.pending} en attente
                </span>
              )}
              {!fixture && onOpenShare && (
                <button
                  type="button"
                  className={styles.miniActionBtn}
                  onClick={onOpenShare}
                  aria-label="Partager l'aventure dans une discussion"
                >
                  <Icon name="send" size={12} /> Partager
                </button>
              )}
            </div>
          }
        >
          <div className={styles.crewRow}>
            {data.people.length > 0 ? (
              <div className={styles.softRail} data-no-swipe="true" role="group" aria-label="Membres actifs">
                {data.people.map((person) => (
                  <IdentityPill
                    key={person.id}
                    name={person.name ?? 'Participant'}
                    avatarUrl={person.avatar}
                    meta={person.role}
                    itemId={person.id}
                    onClick={(element) => onOpen('groupe', person.id, element)}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.meta}>
                {data.pending > 0 ? `${data.pending} invitation(s) en attente` : 'Aventure en solo'}
              </p>
            )}

            <a href="tel:112" className={styles.sosChip} aria-label="Urgence secours officiels 112">
              <Icon name="phone" size={13} /> 112
            </a>
          </div>
        </TileShell>
      )}
    </div>
  );
}
