'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Backpack,
  BedDouble,
  Check,
  ChevronRight,
  Compass,
  Crosshair,
  MapPin,
  Navigation,
  Plane,
  UtensilsCrossed,
  Wallet,
  ListChecks,
  Loader2,
  Plus,
} from 'lucide-react';
import dynamicImport from 'next/dynamic';
import { ShimmerBlock } from '@/components/ui-layouts/shimmer-loader';
import { HubGlobeMap } from '@/features/hub/components/mobile/HubGlobeMap';
import { StepBookingLinkCta } from '@/features/affiliation/components/StepBookingLinkCta';
import { addTripPoiAction } from '@/app/voyages/poi-actions';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';
import type { PreparatorData } from '../server/getPreparatorData';
import type { PreparatorMarker } from '../engine/preparatorModel';
import './preparator.css';

/**
 * Préparateur de voyage — écran unique, toutes activités.
 *
 * UNE carte (globe/hiking) porte TOUT : tracé, POI, nuitées, transports, repas.
 * Les onglets ne changent pas de source : ils lisent le même modèle, dérivé du
 * voyage par le moteur pur. Chaque élément réservable (nuit, transport, table)
 * affiche son lien partenaire résolu côté serveur — jamais une URL reconstruite
 * côté client.
 *
 * Le tap sur la carte (hors POI) ouvre la pose d'un point : c'est le geste
 * natural du préparateur, pas un formulaire de plus.
 */

const ItineraryPlannerClient = dynamicImport(
  () => import('@/features/trips/planner/ItineraryPlannerClient'),
  { ssr: false },
);
const ItineraryMobileExperience = dynamicImport(
  () =>
    import('@/features/hub/components/mobile/itinerary/ItineraryMobileExperience').then((m) => ({
      default: m.ItineraryMobileExperience,
    })),
  { ssr: false },
);
const TripBudgetView = dynamicImport(
  () => import('@/features/trips/components/TripBudgetView').then((m) => ({ default: m.TripBudgetView })),
  { ssr: false },
);
const TripChecklistView = dynamicImport(
  () =>
    import('@/features/trips/components/TripChecklistView').then((m) => ({ default: m.TripChecklistView })),
  { ssr: false },
);
const ChecklistMobileExperience = dynamicImport(
  () =>
    import('@/features/hub/components/mobile/checklist/ChecklistMobileExperience').then((m) => ({
      default: m.ChecklistMobileExperience,
    })),
  { ssr: false },
);

/**
 * L'assistant équipement est une brique INTERNE du preparateur : charge
 * seulement a l'ouverture de l'onglet (jamais au premier render), et cable
 * sur le voyage actif via tripContext (application directe sur le Trip).
 */
const KitConfiguratorWizard = dynamicImport(
  () => import('@/app/ai-configurator/components/KitConfiguratorWizard'),
  { ssr: false },
);

type TabId = 'itineraire' | 'nuits' | 'tables' | 'budget' | 'checklist' | 'equipement';

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: typeof Navigation }> = [
  { id: 'itineraire', label: 'Itinéraire', icon: Navigation },
  { id: 'nuits', label: 'Nuit & Transport', icon: BedDouble },
  { id: 'tables', label: 'Tables', icon: UtensilsCrossed },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'checklist', label: 'Check-list', icon: ListChecks },
  { id: 'equipement', label: 'Équipement', icon: Backpack },
];

/** Couleur de pastille par famille de marqueur (palette DS, cf. mapTheme). */
const MARKER_COLORS: Record<string, string> = {
  stay: '#17402C',
  food: '#A8443A',
  transport: '#4B6B7C',
  step: '#365233',
  poi: '#5A7064',
  refuge: '#17402C',
  summit: '#C89A3B',
  water: '#4B6B7C',
  viewpoint: '#365233',
  camping: '#5B7F55',
  col: '#365233',
  waterfall: '#4B6B7C',
};

function markerColor(marker: PreparatorMarker): string {
  return MARKER_COLORS[marker.category] ?? MARKER_COLORS[marker.kind] ?? '#5A7064';
}

function formatKm(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
}

function formatM(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return Math.round(value).toLocaleString('fr-FR') + ' m';
}

export function PreparatorView({
  data,
  initialTab = 'itineraire',
}: {
  data: PreparatorData;
  /** Onglet ouvert a l'arrivee (?tab=equipement depuis les anciens liens configurateur). */
  initialTab?: TabId;
}) {
  const router = useRouter();
  const { trip, model } = data;
  const [tab, setTab] = useState<TabId>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState('viewpoint');
  const [isPending, startTransition] = useTransition();

  const points = useMemo<HubRoutePoint[]>(
    () =>
      model.markers.map((marker) => ({
        id: marker.id,
        lat: marker.lat,
        lon: marker.lon,
        label: marker.label,
        category: marker.category,
        description: marker.detail ?? marker.label,
        visited: marker.visited,
        color: markerColor(marker),
      })),
    [model.markers],
  );

  // La barre d'onglets defile : l'onglet ouvert reste centre (jamais coupe
  // quand on arrive via /preparer?tab=equipement depuis un ancien lien).
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [tab]);

  const submitPoi = () => {
    if (!draft) return;
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await addTripPoiAction({
        tripId: trip.id,
        tripSlug: trip.slug,
        name,
        category: draftCategory,
        latitude: draft.lat,
        longitude: draft.lng,
      });
      if (result.success) {
        setDraft(null);
        setDraftName('');
        router.refresh();
      }
    });
  };

  const { counters, readiness } = model;

  /**
   * Contexte transmis a l'assistant equipement : la config n'est jamais
   * generique, elle est derivee du VOYAGE ACTIF (activite, difficulte,
   * duree, destination) — c'est la fusion, pas un configurateur a cote.
   */
  const tripContext = useMemo(
    () => ({
      tripId: trip.id,
      tripSlug: trip.slug,
      title: trip.title,
      activity: trip.primary_activity,
      difficulty: trip.difficulty,
      destination: trip.destination_name ?? undefined,
      countryCode: trip.destination_country_code ?? undefined,
      days: model.counters.days,
    }),
    [trip, model.counters.days],
  );

  return (
    <div className="preparator" data-preparator="true">
      <header className="preparator__top glass">
        <Link href="/hub" className="preparator__back" aria-label="Retour au hub">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="glass-eyebrow">Préparation</p>
          <h1 className="preparator__title">{model.title}</h1>
          {model.destination ? (
            <p className="preparator__sub">{model.destination}</p>
          ) : null}
        </div>
        <div
          className="preparator__score"
          role="meter"
          aria-valuenow={readiness.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Préparation du voyage"
        >
          <span className="preparator__score-value">{readiness.score}</span>
          <span className="preparator__score-label">%</span>
        </div>
      </header>

      <section className="preparator__map glass" aria-label="Carte du voyage">
        <HubGlobeMap
          name={model.title}
          routeCoords={data.routeCoords}
          routeGeojson={data.routeGeojson}
          points={points}
          onMapClick={
            data.canEdit
              ? (lat, lng) => {
                  setDraft({ lat, lng });
                  setDraftName('');
                }
              : undefined
          }
        />
        {data.canEdit ? (
          <p className="preparator__map-hint">
            <Crosshair size={12} aria-hidden="true" /> Touchez la carte pour ajouter un point
          </p>
        ) : null}
      </section>

      <section className="preparator__metrics" aria-label="Compteurs du voyage">
        <Metric label="Jours" value={String(counters.days)} />
        <Metric label="Étapes" value={String(counters.steps)} />
        <Metric label="Distance" value={formatKm(counters.distanceKm)} />
        <Metric label="D+" value={formatM(counters.elevationGainM)} />
        <Metric label="POI" value={String(counters.pois)} />
      </section>

      <div
        ref={tabsRef}
        className="glass-segmented preparator__tabs"
        role="tablist"
        aria-label="Sections du voyage"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`glass-segmented-item ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <section className="preparator__panel" role="tabpanel">
        {tab === 'itineraire' ? (
          <>
            <div className="hidden lg:block">
              <ItineraryPlannerClient trip={trip} initialSteps={data.plannerSteps} />
            </div>
            <div className="lg:hidden">
              <ItineraryMobileExperience trip={trip} initialSteps={data.plannerSteps} />
            </div>
          </>
        ) : null}

        {tab === 'nuits' ? (
          <div className="space-y-2.5">
            <Panel title="Nuitées" icon={<BedDouble size={14} aria-hidden="true" />} count={model.stays.length}>
              {model.stays.length === 0 ? (
                <EmptyRow label="Aucune nuitée enregistrée" />
              ) : (
                model.stays.map((stay) => {
                  const booking = data.bookingByStepId[stay.id];
                  return (
                    <div key={stay.id} className="glass-sub-card preparator__row">
                      <div className="min-w-0 flex-1">
                        <p className="preparator__row-title">
                          <span className="preparator__day">J{stay.dayNumber}</span>
                          {stay.name}
                        </p>
                        {stay.locationName ? (
                          <p className="preparator__row-sub">
                            <MapPin size={11} aria-hidden="true" /> {stay.locationName}
                          </p>
                        ) : null}
                      </div>
                      {booking ? (
                        <StepBookingLinkCta
                          booking={booking}
                          slug={booking.slug}
                          partnerName={booking.partnerName}
                          tripId={trip.id}
                          className="preparator__cta"
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </Panel>

            <Panel
              title="Transports"
              icon={<Plane size={14} aria-hidden="true" />}
              count={model.transports.length}
            >
              {model.transports.length === 0 ? (
                <EmptyRow label="Aucun transport réservé" />
              ) : (
                model.transports.map((transport) => {
                  const booking = data.bookingByStepId[transport.id.replace(/^transport-/, '')];
                  return (
                    <div key={transport.id} className="glass-sub-card preparator__row">
                      <div className="min-w-0 flex-1">
                        <p className="preparator__row-title">
                          <span className="preparator__day">J{transport.dayNumber}</span>
                          {transport.label}
                        </p>
                        {transport.locationName ? (
                          <p className="preparator__row-sub">
                            <MapPin size={11} aria-hidden="true" /> {transport.locationName}
                          </p>
                        ) : null}
                      </div>
                      {booking ? (
                        <StepBookingLinkCta
                          booking={booking}
                          slug={booking.slug}
                          partnerName={booking.partnerName}
                          tripId={trip.id}
                          className="preparator__cta"
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </Panel>
          </div>
        ) : null}

        {tab === 'tables' ? (
          <Panel
            title="Tables"
            icon={<UtensilsCrossed size={14} aria-hidden="true" />}
            count={model.meals.length}
          >
            {model.meals.length === 0 ? (
              <EmptyRow label="Aucune table enregistrée" />
            ) : (
              model.meals.map((meal) => {
                const booking = data.bookingByPoiId[meal.id];
                return (
                  <div key={meal.id} className="glass-sub-card preparator__row">
                    <div className="min-w-0 flex-1">
                      <p className="preparator__row-title">
                        {meal.dayNumber ? <span className="preparator__day">J{meal.dayNumber}</span> : null}
                        {meal.name}
                      </p>
                      {meal.notes ? <p className="preparator__row-sub">{meal.notes}</p> : null}
                    </div>
                    {booking ? (
                      <StepBookingLinkCta
                        booking={booking}
                        slug={booking.slug}
                        partnerName={booking.partnerName}
                        tripId={trip.id}
                        className="preparator__cta"
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </Panel>
        ) : null}

        {tab === 'budget' ? (
          data.canManageBudget ? (
            <TripBudgetView trip={trip} />
          ) : (
            <Panel title="Budget" icon={<Wallet size={14} aria-hidden="true" />}>
              <EmptyRow label="Budget non accessible" />
            </Panel>
          )
        ) : null}

        {tab === 'checklist' ? (
          <>
            <div className="hidden lg:block">
              <TripChecklistView
                tripId={trip.id}
                daysUntilStart={data.daysUntilStart}
                items={data.checklist}
              />
            </div>
            <div className="lg:hidden">
              <ChecklistMobileExperience
                tripId={trip.id}
                daysUntilStart={data.daysUntilStart}
                items={data.checklist}
              />
            </div>
          </>
        ) : null}

        {tab === 'equipement' ? (
          <section className="preparator__kit" aria-label="Assistant équipement">
            <KitConfiguratorWizard
              tripContext={tripContext}
              onApplied={() => router.refresh()}
              onClose={() => router.refresh()}
            />
          </section>
        ) : null}
      </section>

      {draft ? (
        <div className="preparator__sheet" role="dialog" aria-label="Ajouter un point">
          <div className="glass preparator__sheet-card">
            <p className="glass-eyebrow">Nouveau point</p>
            <p className="preparator__row-sub">
              <MapPin size={11} aria-hidden="true" />{' '}
              {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
            </p>
            <input
              className="glass-input mt-2 w-full"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Nom du point"
              maxLength={150}
              autoFocus
            />
            <select
              className="glass-input mt-2 w-full"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
            >
              <option value="viewpoint">Point de vue</option>
              <option value="water">Point d&apos;eau</option>
              <option value="refuge">Refuge / gîte</option>
              <option value="camp">Camping</option>
              <option value="summit">Sommet</option>
              <option value="pass">Col / passage</option>
              <option value="food">Table / restaurant</option>
              <option value="other">Autre</option>
            </select>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="glass-btn flex-1"
                onClick={() => setDraft(null)}
                disabled={isPending}
              >
                Annuler
              </button>
              <button
                type="button"
                className="glass-btn-primary flex-1"
                onClick={submitPoi}
                disabled={isPending || draftName.trim().length === 0}
              >
                {isPending ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-metric preparator__metric">
      <span className="preparator__metric-value">{value}</span>
      <span className="preparator__metric-label">{label}</span>
    </div>
  );
}

function Panel({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="glass preparator__panel-card">
      <header className="preparator__panel-head">
        <span className="preparator__panel-title">
          {icon}
          {title}
        </span>
        {typeof count === 'number' ? (
          <span className="preparator__panel-count">
            {count}
            <ChevronRight size={12} aria-hidden="true" />
          </span>
        ) : null}
      </header>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="preparator__empty">
      <Compass size={13} aria-hidden="true" />
      {label}
    </p>
  );
}

export function PreparatorLoading() {
  return (
    <div className="preparator" aria-busy="true">
      <div className="glass rounded-3xl min-h-[420px] p-4 space-y-3">
        <ShimmerBlock className="w-1/3" />
        <ShimmerBlock className="w-full" />
        <ShimmerBlock className="w-4/5" />
      </div>
    </div>
  );
}

export default PreparatorView;
