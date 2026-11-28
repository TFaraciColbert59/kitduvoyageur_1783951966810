'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { IdentityPill } from '@/features/community/feed/PostAuthorPill';
import { ElevationStrip } from './ElevationStrip';
import { DrawerRow, DrawerSection, EmptyBox, ProgressBar, StatusBadge, type BadgeTone } from './DrawerPrimitives';
import { deriveWeatherAlerts, weatherFreshnessLabel } from './weatherAdvice';
import { formatWeight, type KitWeightSummary } from './kitMath';
import { evaluateDocumentExpiry } from './paperasseStatus';
import { estimateTrailCondition } from './weatherAdvanced';
import { estimateConsumablesAutonomy } from './consumablesTracker';
import { buildTripStoryDraft } from './storySummary';
import { buildDestinationSafetyBrief } from './terrainAndCollectiveContracts';
import { momentHour } from './day';
import { weatherGlyph } from './weatherGlyph';
import { stepStatusLabels, type StepExecution } from './stepExecution';
import {
  deleteOfflineMapPack,
  formatPackSize,
  saveOfflineMapPack,
  type OfflineMapPack,
} from './offlineMapPack';
import { clearCarnetDraft, saveCarnetDraft, type CarnetLocalDraft } from './CarnetDraftStore';
import type { CockpitData, CockpitExpense, CockpitReservation, CockpitStep, CockpitWeatherDay } from './model';
import type { CockpitOfflineOperation, ExpenseCreatePayload, StepExecutionPayload } from './offlineQueue';
import type { CockpitWidgetKey } from './cockpitReadiness';
import styles from './cockpit.module.css';
import ds from './cockpitDrawers.module.css';

const BudgetDrawerTools = dynamic(() => import('./BudgetDrawerTools').then((m) => m.BudgetDrawerTools), { ssr: false });
const FieldReportForm = dynamic(() => import('./FieldReportForm').then((m) => m.FieldReportForm), { ssr: false });
const TripLifecycleBar = dynamic(() => import('./TripLifecycleBar').then((m) => m.TripLifecycleBar), { ssr: false });
const SafetyContactsPanel = dynamic(() => import('./SafetyContactsPanel').then((m) => m.SafetyContactsPanel), { ssr: false });
const PaperasseQuickAdd = dynamic(() => import('./PaperasseQuickAdd').then((m) => m.PaperasseQuickAdd), { ssr: false });
const OfficialAlertsPanel = dynamic(() => import('./OfficialAlertsPanel').then((m) => m.OfficialAlertsPanel), { ssr: false });
const CorridorPoisPanel = dynamic(() => import('./CorridorPoisPanel').then((m) => m.CorridorPoisPanel), { ssr: false });
const Map = dynamic(() => import('./HubCockpitMap').then((m) => m.HubCockpitMap), {
  ssr: false,
  loading: () => <p className={styles.mapStatus} role="status">Chargement de la carte</p>,
});
const KitScene = dynamic(() => import('./HubKitPreview').then((m) => m.HubKitPreview), {
  ssr: false,
  loading: () => <p role="status">Chargement du kit…</p>,
});
const StepExecutionDetails = dynamic(() => import('./StepExecutionDetails').then((m) => m.StepExecutionDetails), { ssr: false });
const MomentEditor = dynamic(() => import('./HubMomentEditor').then((m) => m.HubMomentEditor), {
  ssr: false,
  loading: () => <p role="status">Chargement du carnet…</p>,
});

const numberFmt = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const moneyFmt = ({ amount, currency }: { amount: number; currency: string }) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

function dateLabel(date: string | null | undefined, full = false) {
  if (!date) return null;
  const time = Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        weekday: full ? 'long' : undefined,
        timeZone: 'UTC',
      }).format(time)
    : null;
}

function temperatures({ low, high }: CockpitWeatherDay) {
  return [low, high].filter((v): v is number => v != null).map((v) => `${numberFmt(v)}°`).join(' / ');
}

/** Barre de sous-volets icônes ancrée en bas à droite (Bible Design DRAWERS_AND_NAVIGATION.md). */
function BottomRightLensDock<T extends string>({
  ariaLabel,
  value,
  onChange,
  lenses,
}: {
  ariaLabel: string;
  value: T;
  onChange: (next: T) => void;
  lenses: { id: T; label: string; icon: string; badge?: number }[];
}) {
  return (
    <div className={ds.lensDockWrap}>
      <div className={ds.lensDock} role="tablist" aria-label={ariaLabel}>
        {lenses.map((lens) => {
          const active = value === lens.id;
          return (
            <button
              key={lens.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={lens.label}
              title={lens.label}
              className={ds.lensDockBtn}
              data-active={active || undefined}
              onClick={() => onChange(lens.id)}
            >
              <Icon name={lens.icon} size={18} />
              {lens.badge != null && lens.badge > 0 && (
                <span className={ds.lensDockBadge} aria-hidden="true">{lens.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface HubDrawerStateProps {
  widget: CockpitWidgetKey;
  data: CockpitData;
  fixture: boolean;
  isOnline: boolean;
  day: number;
  activeDateIso: string;
  forecast: CockpitData['weather'];
  weatherPending: boolean;
  weatherGps: boolean;
  weatherError: string | null;
  onLocateWeather: () => void;
  mergedBudget: CockpitData['budget'];
  dailyBudget: { estimate: boolean; expenses: CockpitExpense[] } | null;
  expenses: CockpitExpense[];
  onExpenseAdded: (expense: CockpitExpense) => void;
  onExpenseQueued: (payload: ExpenseCreatePayload, operationId: string) => void;
  dayMap: CockpitData;
  daySteps: CockpitStep[];
  dayArchive: StepExecution[];
  dayNotes: CockpitData['notes'];
  dayMoments: NonNullable<CockpitData['carnet']>['moments'];
  carnet: CockpitData['carnet'];
  onCarnetChange: (next: CockpitData['carnet']) => void;
  carnetDraft: CarnetLocalDraft | null;
  onCarnetDraftChange: (next: CarnetLocalDraft | null) => void;
  offlineDraftText: string;
  onOfflineDraftTextChange: (next: string) => void;
  dayKit: CockpitData['kit'];
  mergedKit: CockpitData['kit'];
  packedCount: number;
  kitWeights: KitWeightSummary;
  onToggleKitItem: (itemId: string, nextPacked: boolean) => void;
  reservations: CockpitReservation[];
  addedDocuments: NonNullable<CockpitData['documents']>;
  onDocumentAdded: (doc: NonNullable<CockpitData['documents']>[number]) => void;
  memberChunks: CockpitData['people'][];
  groupPage: number;
  onGroupPageChange: (next: number) => void;
  mapPack: OfflineMapPack | null;
  onMapPackChange: (next: OfflineMapPack | null) => void;
  offlineOps: CockpitOfflineOperation[];
  executionFor: (stepId: string) => StepExecution | undefined;
  onStepSaved: (row: StepExecution) => void;
  onStepQueued: (payload: StepExecutionPayload) => void;
  meteoTab: 'today' | 'days' | 'alerts';
  onMeteoTabChange: (next: 'today' | 'days' | 'alerts') => void;
  kitTab: 'list' | 'weights' | 'shared';
  onKitTabChange: (next: 'list' | 'weights' | 'shared') => void;
  carnetTab: 'moments' | 'notes' | 'story';
  onCarnetTabChange: (next: 'moments' | 'notes' | 'story') => void;
  paperasseTab: 'wallet' | 'bookings' | 'rules';
  onPaperasseTabChange: (next: 'wallet' | 'bookings' | 'rules') => void;
  groupeTab: 'members' | 'safety';
  onGroupeTabChange: (next: 'members' | 'safety') => void;
  onGo: (widget: CockpitWidgetKey, detail?: string, opener?: HTMLElement | null) => void;
  onBack: () => void;
  onPublishStory?: (kind: 'post' | 'story', markdown: string) => void;
  onShareAdventure?: () => void;
}

export function HubCockpitDrawerPane(props: HubDrawerStateProps): ReactNode {
  const {
    widget,
    data,
    fixture,
    isOnline,
    day,
    activeDateIso,
    forecast,
    weatherPending,
    weatherGps,
    weatherError,
    onLocateWeather,
    mergedBudget,
    dailyBudget,
    expenses,
    onExpenseAdded,
    onExpenseQueued,
    dayMap,
    daySteps,
    dayArchive,
    dayNotes,
    dayMoments,
    carnet,
    carnetDraft,
    onCarnetDraftChange,
    offlineDraftText,
    onOfflineDraftTextChange,
    dayKit,
    packedCount,
    kitWeights,
    onToggleKitItem,
    reservations,
    addedDocuments,
    onDocumentAdded,
    memberChunks,
    groupPage,
    onGroupPageChange,
    mapPack,
    onMapPackChange,
    executionFor,
    meteoTab,
    onMeteoTabChange,
    kitTab,
    onKitTabChange,
    carnetTab,
    onCarnetTabChange,
    paperasseTab,
    onPaperasseTabChange,
    groupeTab,
    onGroupeTabChange,
    onGo,
    onPublishStory,
    onShareAdventure,
  } = props;

  switch (widget) {
    case 'meteo': {
      const currentForecastDay = forecast?.days[0];
      const alerts = deriveWeatherAlerts(currentForecastDay);
      const freshness = weatherFreshnessLabel(forecast?.observedAt);
      const trailCond = estimateTrailCondition({
        rainMm: currentForecastDay?.rain,
        minTempC: currentForecastDay?.low,
        maxTempC: currentForecastDay?.high,
      });
      return (
        <div className={ds.drawerRoot}>
          <div className={ds.heroCard}>
            <div className={ds.heroTop}>
              <div>
                <p className={ds.heroFigure}>{forecast ? `${numberFmt(forecast.temperature)}°` : '—'}</p>
                <p className={ds.heroSub}>
                  {forecast
                    ? `${forecast.condition} · ${forecast.place ?? 'Destination du voyage'}`
                    : weatherPending
                      ? 'Recherche des prévisions…'
                      : 'Météo indisponible'}
                </p>
              </div>
              {forecast?.weatherCode != null && (
                <span className={ds.rowIcon} data-tone="water" style={{ width: 52, height: 52, borderRadius: 16 }}>
                  <Icon name={weatherGlyph(forecast.weatherCode)} size={28} />
                </span>
              )}
            </div>
            <div className={ds.heroTop}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {forecast?.source && <StatusBadge tone="water">{forecast.source}</StatusBadge>}
                {freshness && <StatusBadge tone="good">{freshness}</StatusBadge>}
                {currentForecastDay && <StatusBadge tone="neutral">{temperatures(currentForecastDay)}</StatusBadge>}
              </div>
              {!fixture && (
                <button
                  type="button"
                  className={ds.btnSecondary}
                  style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
                  disabled={weatherPending}
                  onClick={onLocateWeather}
                >
                  <Icon name="locate" size={14} /> {weatherGps ? 'Actualiser' : 'Ma position'}
                </button>
              )}
            </div>
            {weatherError && (
              <p role="status" className={ds.heroSub}>
                {weatherError} {forecast && 'Dernière prévision affichée.'}
              </p>
            )}
          </div>

          {meteoTab === 'today' && (
            <>
              <div className={ds.kpiGrid2}>
                <div className={ds.kpiTile}>
                  <span className={ds.kpiLabel}><Icon name="wind" size={13} /> Vent max</span>
                  <span className={ds.kpiValue}>{currentForecastDay?.wind != null ? `${numberFmt(currentForecastDay.wind)} km/h` : '—'}</span>
                </div>
                <div className={ds.kpiTile}>
                  <span className={ds.kpiLabel}><Icon name="cloud-rain" size={13} /> Précipitations</span>
                  <span className={ds.kpiValue}>{currentForecastDay?.rain != null ? `${numberFmt(currentForecastDay.rain)} mm` : '0 mm'}</span>
                </div>
                <div className={ds.kpiTile}>
                  <span className={ds.kpiLabel}><Icon name="thermometer" size={13} /> Min / Max</span>
                  <span className={ds.kpiValue}>{currentForecastDay ? temperatures(currentForecastDay) : '—'}</span>
                </div>
                <div className={ds.kpiTile}>
                  <span className={ds.kpiLabel}><Icon name="footprints" size={13} /> Sentier (estim.)</span>
                  <span className={ds.kpiValue} style={{ fontSize: 13 }}>{trailCond.label.replace(' (estimation)', '')}</span>
                </div>
              </div>

              {currentForecastDay?.hours && currentForecastDay.hours.length > 0 && (
                <DrawerSection title="Frise horaire" padded>
                  <div className={ds.hourlyRail}>
                    {currentForecastDay.hours.slice(0, 12).map((h) => (
                      <div key={h.time} className={ds.hourlyCard}>
                        <span className={ds.rowSub}>{h.time.slice(11, 16)}</span>
                        <strong style={{ fontSize: 15 }}>{h.temperature != null ? `${numberFmt(h.temperature)}°` : '—'}</strong>
                        {h.rain != null && h.rain > 0 && <StatusBadge tone="water">{numberFmt(h.rain)}mm</StatusBadge>}
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}

              {alerts.length > 0 && (
                <DrawerSection title="Impacts terrain conseillés">
                  {alerts.map((alert) => (
                    <DrawerRow
                      key={alert.id}
                      icon="alert-triangle"
                      iconTone="warn"
                      title={alert.title}
                      subtitle={alert.detail}
                      right={<StatusBadge tone="warn">{alert.targetLabel}</StatusBadge>}
                      chevron
                      onClick={() => onGo(alert.targetWidget)}
                    />
                  ))}
                </DrawerSection>
              )}
            </>
          )}

          {meteoTab === 'days' && (
            forecast?.days.length ? (
              <DrawerSection title="Prévisions journalières">
                {forecast.days.map((entry) => (
                  <DrawerRow
                    key={entry.date}
                    itemId={entry.date}
                    icon="cloud-sun"
                    iconTone={entry.rain && entry.rain >= 5 ? 'water' : 'good'}
                    title={dateLabel(entry.date, true) ?? entry.day}
                    subtitle={[entry.condition, entry.rain ? `${numberFmt(entry.rain)} mm` : null].filter(Boolean).join(' · ')}
                    right={temperatures(entry) || '—'}
                    chevron
                    onClick={(el) => onGo('meteo', entry.date, el)}
                  />
                ))}
              </DrawerSection>
            ) : (
              <EmptyBox icon="cloud-off" message="Prévisions journalières indisponibles." />
            )
          )}

          {meteoTab === 'alerts' && (
            <>
              {!fixture && isOnline && <OfficialAlertsPanel point={data.weatherPoint} />}
              {alerts.length > 0 ? (
                <DrawerSection title="Alertes seuils météo">
                  {alerts.map((alert) => (
                    <DrawerRow
                      key={alert.id}
                      icon="alert-triangle"
                      iconTone="warn"
                      title={alert.title}
                      subtitle={alert.detail}
                      chevron
                      onClick={() => onGo(alert.targetWidget)}
                    />
                  ))}
                </DrawerSection>
              ) : (
                <EmptyBox icon="check" message="Aucune vigilance météo active." />
              )}
            </>
          )}

          <BottomRightLensDock
            ariaLabel="Sous-vues météo"
            value={meteoTab}
            onChange={onMeteoTabChange}
            lenses={[
              { id: 'today', label: 'Aujourd’hui', icon: 'sun' },
              { id: 'days', label: '10 jours', icon: 'calendar' },
              { id: 'alerts', label: 'Vigilances', icon: 'alert-triangle', badge: alerts.length },
            ]}
          />
        </div>
      );
    }

    case 'budget': {
      const defaultCurrency = mergedBudget?.planned?.currency ?? expenses[0]?.currency ?? 'EUR';
      const realTotal =
        (mergedBudget?.expenses ?? [])
          .filter((e) => !e.planned && e.currency === defaultCurrency)
          .reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100;
      const envelope = mergedBudget?.planned?.amount ?? null;
      const pct = envelope && envelope > 0 ? Math.round((realTotal / envelope) * 100) : 0;
      return (
        <div className={ds.drawerRoot}>
          <div className={ds.heroCard}>
            <div className={ds.heroTop}>
              <div>
                <p className={ds.sectionTitle} style={{ marginBottom: 4 }}>Dépensé réel · {defaultCurrency}</p>
                <p className={ds.heroFigure}>{moneyFmt({ amount: realTotal, currency: defaultCurrency })}</p>
              </div>
              {envelope != null && (
                <StatusBadge tone={pct > 100 ? 'bad' : pct > 85 ? 'warn' : 'good'}>
                  {pct} % sur {moneyFmt({ amount: envelope, currency: defaultCurrency })}
                </StatusBadge>
              )}
            </div>
            {envelope != null && <ProgressBar value={pct} tone={pct > 100 ? 'bad' : pct > 85 ? 'warn' : 'good'} />}
            {dailyBudget?.estimate && <p className={ds.heroSub}>Enveloppe journalière répartie sur la durée du voyage.</p>}
          </div>

          {expenses.length > 0 && (
            <DrawerSection title={`Dépenses du jour (J${day})`} right={<StatusBadge tone="neutral">{expenses.length}</StatusBadge>}>
              {expenses.map((entry) => (
                <DrawerRow
                  key={entry.id}
                  itemId={entry.id}
                  icon="wallet"
                  iconTone={entry.planned ? 'neutral' : 'good'}
                  title={entry.title}
                  subtitle={[entry.category, entry.payer, entry.planned ? 'Prévu' : 'Réel'].filter(Boolean).join(' · ')}
                  right={moneyFmt(entry)}
                  chevron
                  onClick={(el) => onGo('budget', entry.id, el)}
                />
              ))}
            </DrawerSection>
          )}

          {mergedBudget && (
            <BudgetDrawerTools
              tripId={data.key}
              currency={defaultCurrency}
              date={activeDateIso}
              allExpenses={mergedBudget.expenses}
              plannedEnvelope={envelope}
              day={day}
              dayCount={data.dayCount}
              people={data.people}
              canEdit={Boolean(data.canEdit)}
              isOnline={isOnline}
              fixture={fixture}
              onAdded={onExpenseAdded}
              onQueued={onExpenseQueued}
            />
          )}

          {!fixture && data.budget && (
            <Link href="/hub/budget" className={ds.btnSecondary}>
              Gérer les dépenses complètes <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </div>
      );
    }

    case 'carte': {
      const dayDist = daySteps.reduce((s, st) => s + (st.distance ?? 0), 0);
      const dayElev = daySteps.reduce((s, st) => s + (st.elevation ?? 0), 0);
      return (
        <div className={ds.drawerRoot}>
          <div className={ds.card} style={{ borderRadius: 22 }}>
            <Map data={dayMap} fixture={fixture} onStep={(step) => onGo('carte', step.id)} />
          </div>

          <div className={ds.kpiGrid3}>
            <div className={ds.kpiTile}>
              <span className={ds.kpiLabel}>Distance J{day}</span>
              <span className={ds.kpiValue}>{dayDist > 0 ? `${numberFmt(dayDist)} km` : '—'}</span>
            </div>
            <div className={ds.kpiTile}>
              <span className={ds.kpiLabel}>Dénivelé +</span>
              <span className={ds.kpiValue}>{dayElev > 0 ? `+${numberFmt(dayElev)} m` : '—'}</span>
            </div>
            <div className={ds.kpiTile}>
              <span className={ds.kpiLabel}>Repères</span>
              <span className={ds.kpiValue}>{daySteps.length}</span>
            </div>
          </div>

          <ElevationStrip steps={daySteps} onSelectStep={(stepId) => onGo('carte', stepId)} />

          {!fixture && data.trip && (
            <Link href="/explorer" className={ds.btnPrimary}>
              <Icon name="compass" size={17} /> Suivre en GPS 3D sur Explorer
            </Link>
          )}

          {!fixture && data.trip && (
            <DrawerSection
              title="Pack carte hors ligne"
              right={<StatusBadge tone={mapPack ? 'good' : 'neutral'}>{mapPack ? formatPackSize(mapPack.sizeBytes) : 'Absent'}</StatusBadge>}
            >
              <div className={ds.row} role="region" aria-label="Pack carte hors ligne">
                <span className={ds.rowIcon} data-tone={mapPack ? 'good' : 'water'}>
                  <Icon name="download" size={17} />
                </span>
                <span className={ds.rowBody}>
                  <span className={ds.rowTitle}>
                    {mapPack ? `Copie hors ligne · ${formatPackSize(mapPack.sizeBytes)}` : 'Aucune copie hors ligne enregistrée'}
                  </span>
                  <span className={ds.rowSub}>Trace + {data.steps.length} étapes stockées sur cet appareil</span>
                </span>
                {mapPack ? (
                  <button
                    type="button"
                    className={ds.btnSoftDanger}
                    onClick={() => void deleteOfflineMapPack(data.key).then(() => onMapPackChange(null))}
                  >
                    Supprimer
                  </button>
                ) : (
                  <button
                    type="button"
                    className={ds.btnSecondary}
                    style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
                    onClick={() =>
                      void saveOfflineMapPack({
                        tripId: data.key,
                        title: data.title,
                        route: data.route,
                        steps: data.steps,
                        distance: data.distance,
                        elevation: data.elevation,
                      }).then(onMapPackChange)
                    }
                  >
                    Enregistrer
                  </button>
                )}
              </div>
            </DrawerSection>
          )}

          {data.clubRouteUpdates && data.clubRouteUpdates.length > 0 && (
            <DrawerSection title="Révisions de parcours club">
              {data.clubRouteUpdates.map((update) => (
                <Link
                  key={update.eventId}
                  href={`/sorties/${update.eventId}?source=club#parcours`}
                  className={`${ds.row} ${ds.rowInteractive}`}
                  style={{ textDecoration: 'none' }}
                >
                  <span className={ds.rowIcon} data-tone={update.decisionPending ? 'warn' : 'good'}>
                    <Icon name="route" size={17} />
                  </span>
                  <span className={ds.rowBody}>
                    <span className={ds.rowTitle}>{update.title}</span>
                    <span className={ds.rowSub}>
                      {update.decisionPending
                        ? 'Parcours à valider'
                        : update.adoptedRevision != null
                          ? `Tracé adopté · R${update.adoptedRevision}`
                          : `Parcours publié · R${update.revision}`}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              ))}
            </DrawerSection>
          )}

          {daySteps.length > 0 && (
            <DrawerSection title={`Repères du jour (J${day})`}>
              {daySteps.map((step) => (
                <DrawerRow
                  key={step.id}
                  itemId={step.id}
                  icon="map-pin"
                  iconTone="good"
                  title={step.title}
                  subtitle={[step.time ? `Prévue ${step.time}` : null, step.place].filter(Boolean).join(' · ')}
                  right={step.distance ? `${numberFmt(step.distance)} km` : undefined}
                  chevron
                  onClick={(el) => onGo('carte', step.id, el)}
                />
              ))}
            </DrawerSection>
          )}

          {!fixture && data.trip && (
            <CorridorPoisPanel point={data.weatherPoint ?? daySteps.find((s) => s.coordinate)?.coordinate} isOnline={isOnline} />
          )}

          {!fixture && data.trip && (
            <FieldReportForm tripId={data.key} defaultPoint={data.weatherPoint ?? daySteps.find((s) => s.coordinate)?.coordinate} isOnline={isOnline} />
          )}

          {!fixture && (
            <Link href={`/hub/itineraire?jour=${day}`} className={ds.btnSecondary}>
              Ouvrir l’itinéraire complet <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </div>
      );
    }

    case 'etapes': {
      const completed = daySteps.filter((step) => executionFor(step.id)?.status === 'completed').length;
      const pct = daySteps.length > 0 ? Math.round((completed / daySteps.length) * 100) : 0;
      return (
        <div className={ds.drawerRoot}>
          {!fixture && data.trip && <TripLifecycleBar tripId={data.key} canEdit={Boolean(data.canEdit)} isOnline={isOnline} />}

          {data.stepExecutions && daySteps.length > 0 && (
            <DrawerSection
              title={`Progression · Jour ${day}`}
              right={<StatusBadge tone={completed === daySteps.length ? 'good' : 'tint'}>{completed}/{daySteps.length} terminées</StatusBadge>}
              padded
            >
              <ProgressBar value={pct} tone={completed === daySteps.length ? 'good' : 'tint'} />
            </DrawerSection>
          )}

          {daySteps.length > 0 && (
            <div className={ds.timeline} role="list" aria-label={`Timeline des étapes J${day}`}>
              {daySteps.map((step, idx) => {
                const execution = executionFor(step.id);
                const st = execution?.status ?? 'planned';
                return (
                  <div key={step.id} className={ds.timelineItem} role="listitem">
                    <div className={ds.timelineRail}>
                      <span className={ds.timelineDot} data-status={st} aria-hidden="true">
                        {st === 'completed' ? '✓' : idx + 1}
                      </span>
                      <span className={ds.timelineLine} aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      className={ds.timelineCard}
                      data-hub-item={step.id}
                      onClick={(el) => onGo('etapes', step.id, el.currentTarget)}
                    >
                      <div className={ds.heroTop}>
                        <span className={ds.rowTitle}>{step.title}</span>
                        <StatusBadge tone={st === 'completed' ? 'good' : st === 'started' || st === 'arrived' ? 'tint' : st === 'postponed' ? 'warn' : st === 'cancelled' || st === 'skipped' ? 'bad' : 'neutral'}>
                          {execution ? stepStatusLabels[execution.status] : 'Prévue'}
                        </StatusBadge>
                      </div>
                      <span className={ds.rowSub}>
                        {[step.time ? `Prévue ${step.time}` : null, step.distance ? `${numberFmt(step.distance)} km` : null, step.elevation ? `+${numberFmt(step.elevation)} m` : null, step.place].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {dayArchive.length > 0 && (
            <DrawerSection title="Étapes retirées du plan" right={<StatusBadge tone="neutral">{dayArchive.length}</StatusBadge>}>
              {dayArchive.map((step) => (
                <DrawerRow
                  key={step.step_id}
                  itemId={step.step_id}
                  icon="archive"
                  iconTone="neutral"
                  title={step.planned_title}
                  subtitle="Archivée · conservée dans le journal"
                  right={<StatusBadge tone="neutral">{stepStatusLabels[step.status]}</StatusBadge>}
                  chevron
                  onClick={(el) => onGo('etapes', step.step_id, el)}
                />
              ))}
            </DrawerSection>
          )}

          {!daySteps.length && !dayArchive.length && (
            <EmptyBox icon="footprints" message={data.unavailableSections?.includes('steps') ? 'Étapes momentanément indisponibles.' : 'Aucune étape prévue pour ce jour.'} />
          )}

          {!fixture && (
            <Link href={`/hub/itineraire?jour=${day}`} className={ds.btnSecondary}>
              Gérer les étapes dans l’itinéraire <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </div>
      );
    }

    case 'carnet': {
      const story = buildTripStoryDraft({
        title: data.title,
        steps: data.steps,
        executions: data.stepExecutions,
        moments: carnet?.moments ?? [],
      });
      return (
        <div className={ds.drawerRoot}>
          <button
            className={ds.btnPrimary}
            type="button"
            data-hub-item="ajouter"
            onClick={(event) => onGo('carnet', 'ajouter', event.currentTarget)}
          >
            <Icon name="plus" size={18} /> Ajouter un moment
          </button>

          {carnetDraft && (
            <div className={ds.alertBanner} data-tone="warn" role="region" aria-label="Brouillon local du carnet">
              <div style={{ flex: 1 }}>
                <strong>Brouillon J{carnetDraft.day} : {carnetDraft.caption.slice(0, 60)}</strong>
                <p className={ds.heroSub}>Conservé localement sur cet appareil</p>
              </div>
              <button
                type="button"
                className={ds.btnSoftDanger}
                onClick={() => {
                  clearCarnetDraft(data.key);
                  onCarnetDraftChange(null);
                }}
              >
                Effacer
              </button>
            </div>
          )}

          {!isOnline && !fixture && (
            <DrawerSection title="Capture rapide hors ligne" padded>
              <form
                className={ds.drawerRoot}
                style={{ paddingBottom: 0 }}
                aria-label="Brouillon hors ligne"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!offlineDraftText.trim()) return;
                  const saved = saveCarnetDraft({
                    tripId: data.key,
                    day,
                    caption: offlineDraftText.trim(),
                    place: daySteps.find((s) => s.place)?.place ?? data.location ?? '',
                    capturedAt: new Date().toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
                  });
                  onCarnetDraftChange(saved);
                  onOfflineDraftTextChange('');
                }}
              >
                <label className={ds.fieldGroup}>
                  <span className={ds.fieldLabel}>Note rapide hors ligne (conservée au redémarrage)</span>
                  <textarea
                    className={ds.fieldTextarea}
                    rows={2}
                    maxLength={500}
                    value={offlineDraftText}
                    onChange={(e) => onOfflineDraftTextChange(e.currentTarget.value)}
                    placeholder="Garder un moment même sans réseau…"
                  />
                </label>
                <button type="submit" className={ds.btnPrimary}>Garder en brouillon</button>
              </form>
            </DrawerSection>
          )}

          {carnetTab === 'moments' && (
            dayMoments.length > 0 ? (
              <DrawerSection title={`Journal du jour · J${day}`}>
                {dayMoments.map((entry) => (
                  <DrawerRow
                    key={entry.id}
                    itemId={entry.id}
                    icon={entry.audio ? 'mic' : entry.media ? 'camera' : 'book-open'}
                    iconTone="good"
                    title={entry.title}
                    subtitle={`Jour ${day}${entry.time ? ` · ${entry.time}` : ''}`}
                    right={entry.time ? <StatusBadge tone="good">{entry.time}</StatusBadge> : undefined}
                    chevron
                    onClick={(el) => onGo('carnet', entry.id, el)}
                  />
                ))}
              </DrawerSection>
            ) : (
              <EmptyBox icon="book-open" message={data.carnetUnavailable ? 'Carnet momentanément indisponible.' : 'Aucun moment enregistré ce jour.'} />
            )
          )}

          {carnetTab === 'notes' && (
            dayNotes.length > 0 ? (
              <DrawerSection title={`Notes du voyage · J${day}`}>
                {dayNotes.map((note) => (
                  <DrawerRow key={note.id} icon="file-text" iconTone="neutral" title={note.title ?? 'Note du voyage'} subtitle={note.content} />
                ))}
              </DrawerSection>
            ) : (
              <EmptyBox icon="file-text" message="Aucune note enregistrée pour ce jour." />
            )
          )}

          {carnetTab === 'story' && (
            <DrawerSection
              title="Récit généré (sans notes internes)"
              right={<StatusBadge tone="good">{story.completedSteps}/{story.totalSteps} étapes</StatusBadge>}
              padded
            >
              <pre className={ds.preBox}>{story.markdown}</pre>
              {!fixture && onPublishStory && (
                <div className={ds.btnRow}>
                  <button
                    type="button"
                    className={ds.btnPrimary}
                    onClick={() => onPublishStory('post', story.markdown)}
                  >
                    <Icon name="pen-line" size={15} /> Publier en Post
                  </button>
                  <button
                    type="button"
                    className={ds.btnSecondary}
                    onClick={() => onPublishStory('story', story.markdown)}
                  >
                    <Icon name="camera" size={15} /> Créer Story
                  </button>
                </div>
              )}
              <button
                type="button"
                className={ds.btnSecondary}
                onClick={() => void navigator.clipboard?.writeText(story.markdown)}
              >
                <Icon name="copy" size={15} /> Copier le récit
              </button>
            </DrawerSection>
          )}

          {!fixture && (
            <Link href={carnet ? `/carnets/${carnet.id}` : '/hub/journal'} className={ds.btnSecondary}>
              Ouvrir le carnet complet <Icon name="chevron-right" size={16} />
            </Link>
          )}

          <BottomRightLensDock
            ariaLabel="Sous-vues carnet"
            value={carnetTab}
            onChange={onCarnetTabChange}
            lenses={[
              { id: 'moments', label: 'Moments', icon: 'camera', badge: dayMoments.length },
              { id: 'notes', label: 'Notes', icon: 'file-text', badge: dayNotes.length },
              { id: 'story', label: 'Récit & Partage', icon: 'sparkles' },
            ]}
          />
        </div>
      );
    }

    case 'kit': {
      if (data.confirmedParticipant) {
        return (
          <div className={ds.drawerRoot}>
            <EmptyBox icon="backpack" message="Le kit du voyage est réservé à l’équipe de préparation." />
          </div>
        );
      }
      const kitPct = dayKit.length > 0 ? Math.round((packedCount / dayKit.length) * 100) : 0;
      const autonomy = estimateConsumablesAutonomy({
        partySize: Math.max(1, data.people.length),
        remainingDays: Math.max(1, (data.dayCount ?? 1) - day + 1),
        hotWeather: (forecast?.days[0]?.high ?? 0) >= 30,
        powerBankMah: 10000,
      });
      const sharedItems = dayKit.filter((item) => item.shared);

      return (
        <div className={ds.drawerRoot}>
          <div className={ds.heroCard}>
            <div className={ds.kpiGrid3}>
              <div>
                <span className={ds.kpiLabel}>Poids total</span>
                <span className={ds.kpiValue}>{formatWeight(kitWeights.totalWeightGrams)}</span>
              </div>
              <div>
                <span className={ds.kpiLabel}>Préparés</span>
                <span className={ds.kpiValue}>{packedCount}/{dayKit.length}</span>
              </div>
              <div>
                <span className={ds.kpiLabel}>Vitaux restants</span>
                <span className={ds.kpiValue} style={{ color: kitWeights.vitalUnpackedCount > 0 ? 'var(--hub-bad)' : 'var(--hub-good)' }}>
                  {kitWeights.vitalUnpackedCount}
                </span>
              </div>
            </div>
            <ProgressBar value={kitPct} tone={kitPct === 100 ? 'good' : 'tint'} />
          </div>

          {kitTab === 'list' && (
            dayKit.length > 0 ? (
              <DrawerSection title="Équipement du voyage">
                {dayKit.map((item) => (
                  <label
                    key={item.id}
                    className={`${ds.row} ${data.canEdit && !fixture ? ds.rowInteractive : ''}`}
                    style={{ opacity: item.packed ? 0.68 : 1 }}
                  >
                    {data.canEdit && !fixture && (
                      <>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={item.packed}
                          aria-label={`Marquer ${item.title} comme préparé`}
                          onChange={(event) => onToggleKitItem(item.id, event.currentTarget.checked)}
                        />
                        <span className={ds.checkCircle} data-checked={item.packed} aria-hidden="true">
                          {item.packed && '✓'}
                        </span>
                      </>
                    )}
                    <span className={ds.rowBody}>
                      <span className={ds.rowTitle} style={{ textDecoration: item.packed ? 'line-through' : undefined }}>
                        {item.title}{item.amount > 1 ? ` × ${item.amount}` : ''}
                      </span>
                      <span className={ds.rowSub}>
                        {item.packed ? 'Préparé' : 'À préparer'}
                        {item.weightGrams ? ` · ${formatWeight(item.weightGrams * item.amount)}` : ''}
                      </span>
                    </span>
                    <span className={ds.rowRight}>
                      {item.vital && !item.packed && <StatusBadge tone="bad">Vital</StatusBadge>}
                      {item.shared && <StatusBadge tone="good">Partagé</StatusBadge>}
                    </span>
                  </label>
                ))}
              </DrawerSection>
            ) : (
              <EmptyBox icon="backpack" message="Aucun équipement listé pour ce jour." />
            )
          )}

          {kitTab === 'weights' && (
            <>
              <DrawerSection title="Répartition du poids" padded>
                <div className={ds.kpiGrid3}>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>Sac de base</span>
                    <span className={ds.kpiValue}>{formatWeight(kitWeights.baseWeightGrams)}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>Porté</span>
                    <span className={ds.kpiValue}>{formatWeight(kitWeights.wornWeightGrams)}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>Conso</span>
                    <span className={ds.kpiValue}>{formatWeight(kitWeights.consumableWeightGrams)}</span>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection title="Autonomie estimée (reste du voyage)" padded>
                <div className={ds.kpiGrid3}>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>Eau</span>
                    <span className={ds.kpiValue}>{autonomy.waterLitersNeeded} L</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>Repas</span>
                    <span className={ds.kpiValue}>{autonomy.mealsNeeded}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}>GPS 10Ah</span>
                    <span className={ds.kpiValue}>{autonomy.batteryHoursEstimate ? `~${autonomy.batteryHoursEstimate} h` : '—'}</span>
                  </div>
                </div>
              </DrawerSection>
            </>
          )}

          {kitTab === 'shared' && (
            <>
              {sharedItems.length > 0 ? (
                <DrawerSection title="Objets partagés du groupe">
                  {sharedItems.map((item) => {
                    const carrier = data.people.find((p) => p.id === item.ownerId);
                    return (
                      <DrawerRow
                        key={item.id}
                        icon="users"
                        iconTone="good"
                        title={`${item.title}${item.amount > 1 ? ` × ${item.amount}` : ''}`}
                        subtitle={carrier?.name ? `Porté par ${carrier.name}` : 'Porteur à confirmer'}
                        right={item.weightGrams ? formatWeight(item.weightGrams * item.amount) : undefined}
                      />
                    );
                  })}
                </DrawerSection>
              ) : (
                <EmptyBox icon="users" message="Aucun objet partagé sur ce voyage." />
              )}
              {data.kitId && !fixture && <KitScene kitId={data.kitId} />}
            </>
          )}

          {!fixture && (
            <div className={ds.btnRow}>
              <Link href="/hub/kit-voyage" className={ds.btnSecondary}>
                {data.kitId ? 'Gérer le kit' : 'Choisir un kit'}
              </Link>
              <Link href={data.kitId ? `/kit-studio?kit=${encodeURIComponent(data.kitId)}` : '/kit-studio'} className={ds.btnSecondary}>
                Kit Studio 3D <Icon name="chevron-right" size={15} />
              </Link>
            </div>
          )}

          <BottomRightLensDock
            ariaLabel="Sous-vues kit"
            value={kitTab}
            onChange={onKitTabChange}
            lenses={[
              { id: 'list', label: 'Checklist', icon: 'check-square' },
              { id: 'weights', label: 'Poids & Autonomie', icon: 'scale' },
              { id: 'shared', label: 'Partagé & 3D', icon: 'users', badge: sharedItems.length },
            ]}
          />
        </div>
      );
    }

    case 'paperasse': {
      const allDocs = data.documents ? [...addedDocuments, ...data.documents] : null;
      const expiredDocs = (allDocs ?? []).filter((d) => evaluateDocumentExpiry(d.expiration, activeDateIso).health === 'expired');
      const nextDoc = (allDocs ?? []).find((d) => evaluateDocumentExpiry(d.expiration, activeDateIso).health !== 'expired') ?? allDocs?.[0];
      const safetyBrief = buildDestinationSafetyBrief('FR');
      const docIcon = (cat: string) =>
        cat === 'passport' ? 'id-card' : cat === 'insurance' ? 'shield' : cat === 'ticket' ? 'ticket' : cat === 'booking' ? 'home' : 'file-text';
      const docTone = (health: string): BadgeTone =>
        health === 'expired' ? 'bad' : health === 'expiring_soon' ? 'warn' : health === 'valid' ? 'good' : 'neutral';

      return (
        <div className={ds.drawerRoot}>
          {nextDoc && (
            <div className={ds.walletCard}>
              <div className={ds.heroTop}>
                <p className={ds.walletMeta}>PROCHAIN DOCUMENT · PORTEFEUILLE</p>
                <StatusBadge tone="tint">{nextDoc.category.toUpperCase()}</StatusBadge>
              </div>
              <p className={ds.walletTitle}>{nextDoc.title}</p>
              <p className={ds.walletMeta}>
                {nextDoc.expiration ? `Échéance : ${dateLabel(nextDoc.expiration, true)}` : 'Sans date d’expiration'}
              </p>
            </div>
          )}

          {expiredDocs.length > 0 && (
            <div className={ds.alertBanner} data-tone="bad" role="alert">
              <Icon name="alert-triangle" size={18} />
              <span>{expiredDocs.length} document(s) expiré(s) : {expiredDocs.map((d) => d.title).join(', ')}</span>
            </div>
          )}

          {paperasseTab === 'wallet' && (
            <>
              {allDocs && allDocs.length > 0 ? (
                <DrawerSection title="Portefeuille du voyage">
                  {allDocs.map((document) => {
                    const expiry = evaluateDocumentExpiry(document.expiration, activeDateIso);
                    const tone = docTone(expiry.health);
                    return (
                      <DrawerRow
                        key={document.id}
                        itemId={`doc-${document.id}`}
                        icon={docIcon(document.category)}
                        iconTone={tone === 'tint' ? 'good' : tone}
                        title={document.title}
                        subtitle={document.category === 'passport' || document.category === 'medical' ? 'Personnel · Titulaire' : 'Document du voyage'}
                        right={<StatusBadge tone={tone}>{expiry.health === 'no_expiry' ? (dateLabel(document.expiration) ?? 'Actif') : expiry.label}</StatusBadge>}
                        chevron
                        onClick={(el) => onGo('paperasse', `doc-${document.id}`, el)}
                      />
                    );
                  })}
                </DrawerSection>
              ) : (
                <EmptyBox icon="folder" message="Aucun document enregistré pour ce voyage." />
              )}

              {!fixture && data.canEdit && data.trip && (
                <PaperasseQuickAdd tripId={data.key} isOnline={isOnline} onAdded={onDocumentAdded} />
              )}
            </>
          )}

          {paperasseTab === 'bookings' && (
            reservations.length > 0 ? (
              <DrawerSection title="Réservations à traiter">
                {reservations.map((entry) => (
                  <DrawerRow
                    key={entry.id}
                    itemId={entry.id}
                    icon="calendar"
                    iconTone={entry.status === 'À réserver' ? 'warn' : 'neutral'}
                    title={entry.title}
                    subtitle={entry.due ? `Échéance ${dateLabel(entry.due)}` : 'Échéance non renseignée'}
                    right={<StatusBadge tone={entry.status === 'À réserver' ? 'warn' : 'neutral'}>{entry.status}</StatusBadge>}
                    chevron
                    onClick={(el) => onGo('paperasse', entry.id, el)}
                  />
                ))}
              </DrawerSection>
            ) : (
              <EmptyBox icon="check" message={data.reservations === null ? (data.canEdit ? 'Réservations momentanément indisponibles.' : 'Accès aux réservations limité.') : 'Aucune réservation à traiter.'} />
            )
          )}

          {paperasseTab === 'rules' && (
            <DrawerSection title="Urgences & réglementation terrain" padded>
              <a className={ds.btnDanger} href={`tel:${safetyBrief.emergencyNumber.replace(/[^0-9+]/g, '')}`}>
                <Icon name="phone" size={16} /> Secours officiels · {safetyBrief.emergencyNumber}
              </a>
              <p className={ds.heroSub}>{safetyBrief.bivouacRuleNote}</p>
            </DrawerSection>
          )}

          {!fixture && data.documents !== null && (
            <Link href="/hub/documents" className={ds.btnSecondary}>
              Gérer tous les documents <Icon name="chevron-right" size={16} />
            </Link>
          )}

          <BottomRightLensDock
            ariaLabel="Sous-vues paperasse"
            value={paperasseTab}
            onChange={onPaperasseTabChange}
            lenses={[
              { id: 'wallet', label: 'Documents', icon: 'folder', badge: allDocs?.length },
              { id: 'bookings', label: 'Réservations', icon: 'calendar', badge: reservations.length },
              { id: 'rules', label: 'Urgences', icon: 'shield' },
            ]}
          />
        </div>
      );
    }

    case 'groupe': {
      const clampedPage = Math.min(groupPage, Math.max(0, memberChunks.length - 1));
      const visibleMembers = memberChunks[clampedPage] ?? [];
      const peopleStatus = data.peopleUnavailable
        ? 'Membres momentanément indisponibles'
        : data.pending > 0
          ? `${data.pending} invitation${data.pending > 1 ? 's' : ''} en attente`
          : 'Aucun membre actif';

      return (
        <div className={ds.drawerRoot}>
          <div className={ds.heroCard}>
            <div className={ds.heroTop}>
              <div>
                <p className={ds.sectionTitle} style={{ marginBottom: 4 }}>Équipe du voyage</p>
                <p className={ds.heroFigure}>
                  {data.people.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--hub-label2)' }}>membres</span>
                </p>
              </div>
              {data.pending > 0 && <StatusBadge tone="warn">{data.pending} en attente</StatusBadge>}
            </div>
            {!fixture && onShareAdventure && (
              <button type="button" className={ds.btnSecondary} onClick={onShareAdventure}>
                <Icon name="send" size={15} /> Partager dans une discussion
              </button>
            )}
          </div>

          {groupeTab === 'members' && (
            <>
              {visibleMembers.length > 0 ? (
                <DrawerSection
                  title="Membres actifs"
                  right={memberChunks.length > 1 ? <StatusBadge tone="neutral">Bloc {clampedPage + 1}/{memberChunks.length}</StatusBadge> : undefined}
                >
                  <div className={ds.cardPadded}>
                    {visibleMembers.map((person) => (
                      <IdentityPill
                        key={person.id}
                        name={person.name ?? 'Participant'}
                        avatarUrl={person.avatar}
                        meta={person.role}
                        itemId={person.id}
                        onClick={(element) => onGo('groupe', person.id, element)}
                      />
                    ))}
                  </div>
                </DrawerSection>
              ) : (
                <EmptyBox icon="users" message={peopleStatus} />
              )}

              {memberChunks.length > 1 && (
                <div className={ds.btnRow} role="navigation" aria-label="Blocs de participants">
                  <button
                    type="button"
                    className={ds.btnSecondary}
                    disabled={clampedPage === 0}
                    onClick={() => onGroupPageChange(Math.max(0, clampedPage - 1))}
                  >
                    Précédents
                  </button>
                  <button
                    type="button"
                    className={ds.btnSecondary}
                    disabled={clampedPage >= memberChunks.length - 1}
                    onClick={() => onGroupPageChange(Math.min(memberChunks.length - 1, clampedPage + 1))}
                  >
                    Suivants
                  </button>
                </div>
              )}

              {!fixture && (
                <Link href="/hub/groupe" className={ds.btnSecondary}>
                  Gérer le groupe & invitations <Icon name="chevron-right" size={16} />
                </Link>
              )}
            </>
          )}

          {groupeTab === 'safety' && (
            <>
              <DrawerSection title="Urgence secours officiels" padded>
                <a className={ds.btnDanger} href="tel:112">
                  <Icon name="phone" size={16} /> Urgence secours officiels · 112
                </a>
                <p className={ds.heroSub}>Seuls les secours officiels assurent la prise en charge d’urgence.</p>
              </DrawerSection>

              {!fixture && data.trip && (
                <SafetyContactsPanel tripId={data.key} defaultPoint={data.weatherPoint} isOnline={isOnline} />
              )}

              {!fixture && data.trip && (
                <Link href="/hub/securite" className={ds.btnSecondary}>
                  Ouvrir le centre sécurité <Icon name="chevron-right" size={16} />
                </Link>
              )}
            </>
          )}

          <BottomRightLensDock
            ariaLabel="Sous-vues groupe"
            value={groupeTab}
            onChange={onGroupeTabChange}
            lenses={[
              { id: 'members', label: 'Cordée', icon: 'users', badge: data.people.length },
              { id: 'safety', label: 'Sécurité & 112', icon: 'shield-alert' },
            ]}
          />
        </div>
      );
    }
  }
}

export function renderHubDrawerDetail(
  detailId: string,
  props: HubDrawerStateProps,
): { title: string; content: ReactNode } | null {
  const {
    widget,
    data,
    fixture,
    isOnline,
    day,
    forecast,
    expenses,
    daySteps,
    dayMoments,
    carnet,
    onCarnetChange,
    mergedKit,
    reservations,
    offlineOps,
    executionFor,
    onStepSaved,
    onStepQueued,
    onGo,
    onBack,
  } = props;

  const partySize = Math.max(1, data.people.length);

  if (widget === 'meteo') {
    const entry = forecast?.days.find((item) => item.date === detailId);
    return entry
      ? {
          title: dateLabel(entry.date, true) ?? entry.day,
          content: (
            <div className={ds.drawerRoot}>
              <div className={ds.heroCard}>
                <div className={ds.heroTop}>
                  <div>
                    <p className={ds.heroEyebrow}>{forecast?.place ?? data.location ?? 'Prévision du jour'}</p>
                    <p className={ds.heroValue}>{temperatures(entry) || 'Températures indisponibles'}</p>
                    <p className={ds.heroSub}>{entry.condition ?? 'Condition météo'}</p>
                  </div>
                  <StatusBadge tone={entry.rain != null && entry.rain >= 5 ? 'warn' : 'water'}>
                    {dateLabel(entry.date, true) ?? entry.day}
                  </StatusBadge>
                </div>
                <div className={ds.kpiGrid2}>
                  <div className={ds.kpiTile}>
                    <p className={ds.kpiLabel}>Vent moyen</p>
                    <p className={ds.kpiValue}>{entry.wind != null ? `${numberFmt(entry.wind)} km/h` : '—'}</p>
                  </div>
                  <div className={ds.kpiTile}>
                    <p className={ds.kpiLabel}>Précipitations</p>
                    <p className={ds.kpiValue}>{entry.rain != null ? `${numberFmt(entry.rain)} mm` : '—'}</p>
                  </div>
                </div>
              </div>
              <DrawerSection title="Détail heure par heure" right={entry.hours?.length ? <StatusBadge tone="neutral">{entry.hours.length} créneaux</StatusBadge> : undefined} padded>
                {entry.hours?.length ? (
                  <div className={ds.hourlyRail}>
                    {entry.hours.map((hour) => (
                      <div key={hour.time} className={ds.hourlyCard}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hub-label2)' }}>{hour.time.slice(11, 16)}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--hub-label)' }}>
                          {hour.temperature == null ? '—' : `${numberFmt(hour.temperature)}°`}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--hub-label2)', textAlign: 'center' }}>
                          {[hour.wind == null ? null : `${numberFmt(hour.wind)} km/h`, hour.rain == null ? null : `${numberFmt(hour.rain)} mm`].filter(Boolean).join(' · ') || 'Calme'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBox icon="clock" message="Prévision horaire indisponible pour ce jour." />
                )}
              </DrawerSection>
            </div>
          ),
        }
      : null;
  }

  if (widget === 'budget') {
    const entry = expenses.find((item) => item.id === detailId);
    const splitShare = entry && partySize > 0 ? Math.round((entry.amount / partySize) * 100) / 100 : null;
    return entry
      ? {
          title: entry.title,
          content: (
            <div className={ds.drawerRoot}>
              <div className={ds.heroCard}>
                <div className={ds.heroTop}>
                  <div>
                    <p className={ds.heroEyebrow}>{entry.category ?? 'Dépense'}</p>
                    <p className={ds.heroValue}>{moneyFmt(entry)}</p>
                    <p className={ds.heroSub}>{entry.title}</p>
                  </div>
                  <StatusBadge tone="good">{entry.payer ? `Payé par ${entry.payer}` : 'Groupe'}</StatusBadge>
                </div>
                {splitShare != null && (
                  <div className={ds.kpiGrid2}>
                    <div className={ds.kpiTile}>
                      <p className={ds.kpiLabel}>Part par personne</p>
                      <p className={ds.kpiValue}>{moneyFmt({ amount: splitShare, currency: entry.currency })}</p>
                    </div>
                    <div className={ds.kpiTile}>
                      <p className={ds.kpiLabel}>Participants</p>
                      <p className={ds.kpiValue}>{partySize} pers.</p>
                    </div>
                  </div>
                )}
              </div>
              {!fixture && <Link href="/hub/budget" className={ds.btnSecondary}>Gérer les dépenses</Link>}
            </div>
          ),
        }
      : null;
  }

  if (widget === 'carte' || widget === 'etapes') {
    const step = data.steps.find((item) => item.id === detailId);
    const execution = executionFor(detailId);
    const plan =
      step ??
      (execution?.archived
        ? { title: execution.planned_title, day: execution.planned_day_number, time: execution.planned_start_time?.slice(0, 5) }
        : null);
    if (!plan) return null;
    const { title, day: stepDay, time } = plan;
    const execStatus = execution?.status ?? 'planned';
    return {
      title,
      content: (
        <div className={ds.drawerRoot}>
          <div className={ds.heroCard}>
            <div className={ds.heroTop}>
              <div>
                <p className={ds.heroEyebrow}>{[`J${stepDay}`, time ? `Prévue à ${time}` : null, step?.place].filter(Boolean).join(' · ')}</p>
                <p className={ds.heroValue} style={{ fontSize: 20 }}>{title}</p>
                {!step && <p className={ds.heroSub}>Retirée du plan</p>}
              </div>
              <StatusBadge tone={!step ? 'warn' : execStatus === 'completed' ? 'good' : execStatus === 'started' || execStatus === 'arrived' ? 'tint' : 'neutral'}>
                {!step ? 'Archivée' : stepStatusLabels[execStatus]}
              </StatusBadge>
            </div>
            {(step?.distance != null || step?.elevation != null) && (
              <div className={ds.kpiGrid2}>
                {step?.distance != null && (
                  <div className={ds.kpiTile}>
                    <p className={ds.kpiLabel}>Distance prévue</p>
                    <p className={ds.kpiValue}>{numberFmt(step.distance)} km</p>
                  </div>
                )}
                {step?.elevation != null && (
                  <div className={ds.kpiTile}>
                    <p className={ds.kpiLabel}>Dénivelé</p>
                    <p className={ds.kpiValue}>+{numberFmt(step.elevation)} m</p>
                  </div>
                )}
              </div>
            )}
            {step?.description && <p className={ds.heroSub}>{step.description}</p>}
          </div>
          {data.stepExecutions === null && <EmptyBox icon="alert-triangle" message="Suivi terrain momentanément indisponible." />}
          {data.stepExecutions && (
            <StepExecutionDetails
              key={detailId}
              tripId={data.key}
              stepId={detailId}
              execution={execution}
              planUpdatedAt={step?.planUpdatedAt}
              canSave={Boolean(step && data.canEdit)}
              isOnline={isOnline}
              pendingOffline={offlineOps.some((op) => op.kind === 'step_execution' && (op.payload as StepExecutionPayload).stepId === detailId)}
              onSaved={onStepSaved}
              onQueued={onStepQueued}
            />
          )}
          {!fixture && step && <Link href={`/hub/itineraire?jour=${stepDay}`} className={ds.btnSecondary}>Ouvrir dans l’itinéraire</Link>}
        </div>
      ),
    };
  }

  if (widget === 'carnet') {
    const clockMatch = /^heure-([0-9]{1,2})$/.exec(detailId);
    if (clockMatch) {
      const label = `${clockMatch[1].padStart(2, '0')}h`;
      const entries = dayMoments.filter((entry) => momentHour(entry.time) === Number(clockMatch[1]));
      return {
        title: `Moments de ${label}`,
        content: (
          <div className={ds.drawerRoot}>
            {entries.length ? (
              <div className={ds.card}>
                {entries.map((entry) => (
                  <DrawerRow
                    key={entry.id}
                    itemId={entry.id}
                    icon={entry.media ? 'camera' : 'book-open'}
                    iconTone="water"
                    title={entry.title}
                    subtitle={entry.time ?? label}
                    chevron
                    onClick={(el) => onGo('carnet', entry.id, el)}
                  />
                ))}
              </div>
            ) : (
              <EmptyBox icon="clock" message={`Aucun moment à ${label}.`} />
            )}
          </div>
        ),
      };
    }
    if (detailId === 'ajouter') {
      return {
        title: 'Ajouter un moment',
        content: fixture ? (
          <div className={ds.drawerRoot}>
            <EmptyBox icon="lock" message="Connecte-toi à ton voyage pour enregistrer un moment." />
          </div>
        ) : (
          <MomentEditor
            tripId={data.key}
            day={day}
            place={daySteps.find((step) => step.place)?.place ?? data.location}
            carnet={carnet}
            kitItems={data.carnetKitItems ?? []}
            canCreate={Boolean(data.canCreateCarnet)}
            onChange={onCarnetChange}
            onBack={onBack}
          />
        ),
      };
    }
    const moment = carnet?.moments.find((item) => item.id === detailId);
    return moment
      ? {
          title: 'Moment',
          content: (
            <div className={ds.drawerRoot}>
              <div className={ds.heroCard}>
                <div className={ds.heroTop}>
                  <div>
                    <p className={ds.heroEyebrow}>{moment.time ?? `Jour ${day}`}</p>
                    <p className={ds.heroValue} style={{ fontSize: 19 }}>{moment.title}</p>
                  </div>
                  <StatusBadge tone="water">{moment.type === 'video' ? 'Vidéo' : moment.media ? 'Photo' : 'Note'}</StatusBadge>
                </div>
              </div>
              {moment.audio && (
                <div className={`${ds.card} ${ds.cardPadded}`}>
                  <audio controls preload="metadata" src={moment.audio} aria-label="Note vocale" style={{ width: '100%' }} />
                </div>
              )}
              {moment.media && (
                <div className={ds.card}>
                  {moment.type === 'video' ? (
                    <video className={styles.momentMedia} controls playsInline preload="metadata" src={moment.media} aria-label="Vidéo du moment" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- média privé via proxy du carnet
                    <img className={styles.momentMedia} alt="Photo du moment" src={moment.media} />
                  )}
                </div>
              )}
              <Link href={`/carnets/${carnet!.id}`} className={ds.btnSecondary}>Ouvrir le carnet</Link>
            </div>
          ),
        }
      : null;
  }

  if (widget === 'paperasse') {
    const entry = reservations.find((item) => item.id === detailId);
    if (entry) {
      return {
        title: entry.title,
        content: (
          <div className={ds.drawerRoot}>
            <div className={ds.heroCard}>
              <div className={ds.heroTop}>
                <div>
                  <p className={ds.heroEyebrow}>Réservation</p>
                  <p className={ds.heroValue} style={{ fontSize: 19 }}>{entry.title}</p>
                </div>
                <StatusBadge tone={entry.status.toLowerCase().includes('confirm') ? 'good' : 'warn'}>{entry.status}</StatusBadge>
              </div>
            </div>
            <div className={ds.card}>
              <DrawerRow icon="calendar" iconTone="neutral" title="Échéance" subtitle={entry.due ? dateLabel(entry.due) : 'Non renseignée'} />
              {entry.when && <DrawerRow icon="clock" iconTone="neutral" title="Date prévue" subtitle={dateLabel(entry.when)} />}
            </div>
            {entry.partnerSlug && (
              <a className={ds.btnPrimary} rel="sponsored nofollow" href={`/go/${encodeURIComponent(entry.partnerSlug)}`}>
                Voir les options de réservation
              </a>
            )}
            {!fixture && <Link href={entry.stepId ? '/hub/itineraire' : '/hub/budget'} className={ds.btnSecondary}>Voir dans le voyage</Link>}
          </div>
        ),
      };
    }
    const document = data.documents?.find((item) => `doc-${item.id}` === detailId);
    const isExpired = document?.expiration ? document.expiration < new Date().toISOString().slice(0, 10) : false;
    return document
      ? {
          title: document.title,
          content: (
            <div className={ds.drawerRoot}>
              <div className={ds.heroCard}>
                <div className={ds.heroTop}>
                  <div>
                    <p className={ds.heroEyebrow}>
                      {document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'}
                    </p>
                    <p className={ds.heroValue} style={{ fontSize: 19 }}>{document.title}</p>
                  </div>
                  <StatusBadge tone={isExpired ? 'bad' : 'good'}>{isExpired ? 'Expiré' : 'Valide'}</StatusBadge>
                </div>
              </div>
              <div className={ds.card}>
                <DrawerRow icon="calendar" iconTone={isExpired ? 'bad' : 'neutral'} title="Échéance" subtitle={document.expiration ? dateLabel(document.expiration) : 'Aucune date limite'} />
              </div>
              {!fixture && <Link href="/hub/documents" className={ds.btnSecondary}>Ouvrir les documents du voyage</Link>}
            </div>
          ),
        }
      : null;
  }

  if (widget === 'groupe') {
    const person = data.people.find((item) => item.id === detailId);
    const carriedGear = person ? mergedKit.filter((item) => item.shared && item.ownerId === person.id) : [];
    return person
      ? {
          title: person.name ?? 'Participant',
          content: (
            <div className={ds.drawerRoot}>
              <div className={ds.heroCard}>
                <IdentityPill
                  name={person.name ?? 'Participant'}
                  avatarUrl={person.avatar}
                  meta={person.role}
                  href={fixture ? undefined : `/profil/${encodeURIComponent(person.id)}`}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <StatusBadge tone={person.confirmed ? 'good' : 'warn'}>{person.confirmed ? 'Participation confirmée' : 'Invité'}</StatusBadge>
                  {person.role && <StatusBadge tone="neutral">{person.role}</StatusBadge>}
                </div>
              </div>
              <DrawerSection title="Matériel collectif porté" right={<StatusBadge tone="neutral">{carriedGear.length}</StatusBadge>}>
                {carriedGear.length > 0 ? (
                  carriedGear.map((gear) => (
                    <DrawerRow
                      key={gear.id}
                      icon="backpack"
                      iconTone="water"
                      title={gear.title}
                      subtitle={[gear.weightGrams ? `${gear.weightGrams} g` : null, gear.packed ? 'Dans le sac' : 'À prendre'].filter(Boolean).join(' · ')}
                      right={<StatusBadge tone={gear.packed ? 'good' : 'warn'}>{gear.packed ? 'Prêt' : 'À faire'}</StatusBadge>}
                    />
                  ))
                ) : (
                  <div className={ds.cardPadded}>
                    <EmptyBox icon="backpack" message="Aucun équipement collectif assigné." />
                  </div>
                )}
              </DrawerSection>
              {!fixture && <Link href="/hub/groupe" className={ds.btnSecondary}>Ouvrir le groupe</Link>}
            </div>
          ),
        }
      : null;
  }

  return null;
}
