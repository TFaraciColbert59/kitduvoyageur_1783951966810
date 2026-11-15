'use client';

import React from 'react';
import { XpIcon } from '../ui/XpIcon';
import {
  ExplorerSearchError,
  geometryCenter,
  useNaturalSearch,
  usePoiRoutes,
  useRouteSuggestions,
  useTerrainCoverage,
} from '../data/hooks';
import { SUGGESTION_RADIUS_KM } from '../routeSuggestions';
import { isSearchableViewport } from '../searchArea';
import { AUTO_PAUSE_BY_SPORT } from '../activity/tracker';
import {
  MILE_DISTANCE_M,
  activeSplit,
  fastestSplit,
  splitPaceSecondsPerKm,
  splitPaceSecondsPerMile,
  splitSpeedKmh,
} from '../activity/splits';
import { useExplorerStore } from '../state/store';
import {
  nationalTopoSourcesFor,
  verifiedNationalTopoFor,
} from '../map/nationalTopo';
import { ElevationProfile, type ProfilePayload } from './ElevationProfile';
import { countTiles, downloadZone, purgeZone, readZone } from '../offline/zone';
import { RoutePlannerPanel } from './RoutePlannerPanel';
import { MultiDaySheetPanel } from './MultiDaySheetPanel';
import { buildExplorerRouteAnalysis } from '@/features/routes/analysis/explorerBridge';
import { copyRouteToDraft } from '@/features/routes/library/routeLibrary';
import { defaultSpeedKmHForSport, gpxFromRouteDraft } from '@/features/adventure-prep/routeRevision';
import { ebikeSupportedForSport, type RouteSport } from '@/features/adventure-prep/routeProfiles';
import { buildExplorerCatalogAdventures, explorerSportToPlanningSport } from '@/features/planning/explorerAdapter';
import { searchMultiDayPlans } from '@/features/planning/library';
import type {
  ParsedDifficulty,
  ParsedRouteType,
  ParsedStartAccess,
  ParsedSurface,
  SearchCriteriaOverrides,
} from '../search/searchQueryParser';
import { StrengthPanel } from './StrengthPanel';
import { ZoneSettingsEntry, ZoneSettingsPanel } from './ZoneSettingsPanel';
import { MetricSeriesPanel } from './MetricSeries';
import { SlopeAdjustedPacePanel } from './SlopeAdjustedPace';
import { ExplorerSegmentsSearchSection } from '../components/ExplorerSegmentsSearchSection';
import { ExplorerLiveSegmentsPanel } from '../components/ExplorerLiveSegmentsPanel';
import { ExplorerLiveTrackingPanel } from '../components/ExplorerLiveTrackingPanel';
import {
  HeatmapSubDrawer,
  ReportMapErrorPanel,
  SavedPlacesPanel,
} from './LayersExtensions';
import { TrailCommunityPanel } from './TrailCommunityPanel';
import { LiveMediaCapture } from './LiveMediaCapture';
import { isPlaceSavedInList } from '../savedPlaces';
import {
  ExplorerSummaryEffortAndSplits,
  ExplorerStatsTelemetryBridge,
} from './SummaryTelemetryPanel';
import {
  XpAvatars,
  XpCard,
  XpCardRow,
  XpChips,
  XpEmpty,
  XpEyebrow,
  XpMetrics,
  XpRow,
  XpRows,
} from './blocks';
import type { SheetTab } from './ExplorerSheet';
import {
  AudioGuidanceControls,
  ClimbDescentCard,
  CustomFieldsEditor,
  JoinStartCard,
  LiveActivityPreview,
  OrientationCompass,
  RerouteBanner,
  RouteSwapPicker,
  TurnByTurnBanner,
  UpcomingWaypointsList,
  WaypointAlertBanner,
} from '../guidance/ui';
import { browserSpeechAdapter, type ActiveRecordingSnapshot } from '@/features/navigation';
import { OfflinePacksScreen } from '@/components/offline';
import { getOfflineRuntimeStore, listPredefinedRegions } from '@/features/offline';
import {
  formatImperialDistance,
  formatImperialElevation,
  POI_ICON,
  POI_LABEL,
  POI_TONE,
  SPORT_META,
  distanceKm,
  findRegionAt,
  formatDistance,
  formatElevation,
  formatDuration,
  relativeDay,
  type SheetContext,
} from './context';
import type { ActivitySplit, Sport } from '../state/types';
import {
  SPORT_FAMILIES,
  availabilityLabel,
  defaultVariantForSport,
  familySummary,
  getSportFamily,
  getSportVariant,
  metricsLabel,
  missingOptionalMetrics,
  rhythmMetric,
  startAvailability,
  toSportSelection,
  type SportFamily,
  type SportSelection,
  type SportStartContext,
  type SportVariant,
} from './sportSelection';
import {
  LiveSpecializedPanel,
  PoolSwimStartConfig,
  RehabModeSection,
  RouteExportButtons,
  SummarySpecializedPanel,
} from './SpecializedModePanels';

export interface SheetModel {
  title: string;
  subtitle: string | null;
  tabs: SheetTab[];
  tabsBottom?: boolean;
  mini: { items: Array<{ id: string; label: string; icon: string }>; value: number; onChange: (i: number) => void } | null;
  actions: React.ReactNode;
  onBack?: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  water: 'Point d’eau',
  snow_ice: 'Neige / glace',
  danger: 'Danger',
  closure: 'Fermeture',
  obstacle: 'Obstacle',
  mud: 'Boue',
  rockfall: 'Chutes de pierres',
  flood: 'Crue',
};

/** Contexte de démarrage : permission réelle + présence de l’API GPS. */
function useSportStartContext(ctx: SheetContext): SportStartContext {
  return React.useMemo(
    () => ({
      locationPermission: ctx.state.locationPermission,
      gpsAvailable: typeof navigator !== 'undefined' && Boolean(navigator.geolocation),
    }),
    [ctx.state.locationPermission],
  );
}

function startSport(ctx: SheetContext, sport: Sport, selection?: SportSelection) {
  if (ctx.onStartSport) ctx.onStartSport(sport, selection);
  else ctx.state.startActivity(sport, null, selection);
}

/** Unique chemin de départ d’une variante : garde + conversion + callback. */
function startVariant(
  ctx: SheetContext,
  family: SportFamily,
  variant: SportVariant,
  startContext: SportStartContext,
): boolean {
  if (!startAvailability(variant, startContext).startable) return false;
  startSport(ctx, variant.sport, toSportSelection(family, variant));
  return true;
}

/**
 * État réel du départ : la séance est toujours conservée sur l'appareil, et
 * synchronisée si l'utilisateur est connecté. Ne jamais annoncer une création
 * serveur qui n'a pas encore eu lieu hors ligne.
 */
function StartLimitNote() {
  return (
    <p
      style={{
        margin: '10px 2px 6px',
        fontSize: 11.5,
        lineHeight: 1.45,
        color: 'var(--xp-mut)',
      }}
    >
      Le suivi démarre même hors ligne. La séance et ses points restent sur cet appareil, puis sont
      synchronisés avec ton compte dès que la connexion le permet.
    </p>
  );
}

/** Entrée unique du carnet musculation, dans les deux onglets de départ. */
function StrengthEntry({ ctx }: { ctx: SheetContext }) {
  return (
    <XpRow
      icon="dumbbell"
      title="Musculation"
      sub="Exercices, séries, répétitions, charges · carnet privé"
      badge={{ label: 'Saisie', tone: 'muted' }}
      onClick={() => ctx.state.setSheet('strength', 'full')}
    />
  );
}

/**
 * Choix en deux temps : famille de sport existante, puis variante.
 * Une variante indisponible n’a aucun handler de clic et porte le motif exact.
 */
function autoPauseDurationLabel(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * Réglage de préparation : la pause automatique à l'arrêt, propre au sport.
 * Désactivée, seule la détection d'arrêt est coupée ; les seuils GPS du sport
 * (plausibilité, coupure de tracé) restent actifs.
 */
function AutoPauseSetting({ sport }: { sport?: Sport | null }) {
  const enabled = useExplorerStore((state) => state.autoPauseEnabled) ?? false;
  const setEnabled = useExplorerStore((state) => state.setAutoPauseEnabled);
  const config = sport ? AUTO_PAUSE_BY_SPORT[sport] : null;
  const sub = !enabled
    ? 'Désactivée · pas d’arrêt automatique, seuils GPS du sport conservés.'
    : config
      ? `Activée · pause après ${autoPauseDurationLabel(config.durationS)} d’arrêt, reprise au mouvement.`
      : 'Activée · chaque sport a son seuil d’arrêt et de reprise.';
  return (
    <>
      <XpEyebrow>Préparation</XpEyebrow>
      <XpRows>
        <XpRow
          icon="pause"
          title="Pause automatique"
          sub={sub}
          trailing={
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Pause automatique à l’arrêt"
              onClick={() => setEnabled(!enabled)}
              style={{
                flex: 'none',
                width: 52,
                height: 44,
                padding: 0,
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Le switch visuel garde 46 × 28 ; la cible tactile est le bouton
                  de 52 × 44, conforme à la règle des 44 px. */}
              <span
                aria-hidden="true"
                style={{
                  width: 46,
                  height: 28,
                  padding: 3,
                  boxSizing: 'border-box',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: enabled ? 'flex-end' : 'flex-start',
                  background: enabled ? 'var(--xp-inkbtn)' : 'var(--xp-thumb)',
                  boxShadow: enabled
                    ? 'var(--xp-inkbtn-shadow)'
                    : 'inset 0 1px 2px rgba(23,43,36,0.18)',
                  transition: 'background 160ms ease',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(23,43,36,0.25)',
                  }}
                />
              </span>
            </button>
          }
        />
      </XpRows>
    </>
  );
}

export function SportPicker({ ctx }: { ctx: SheetContext }) {
  const startContext = useSportStartContext(ctx);
  const [sport, setSport] = React.useState<Sport | null>(null);
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const family = sport ? getSportFamily(sport) : null;
  const variant = variantId ? getSportVariant(variantId) : null;
  const availability = variant ? startAvailability(variant, startContext) : null;

  const openFamily = (next: Sport) => {
    setSport(next);
    const nextFamily = getSportFamily(next);
    const preferred = defaultVariantForSport(next, startContext);
    setVariantId(preferred?.id ?? nextFamily?.variants[0]?.id ?? null);
  };

  const start = () => {
    if (!family || !variant) return;
    startVariant(ctx, family, variant, startContext);
  };

  if (!family) {
    return (
      <>
        <XpEyebrow>Choisir un sport</XpEyebrow>
        <XpRows>
          {SPORT_FAMILIES.map((entry) => {
            const available = entry.variants.filter(
              (candidate) => startAvailability(candidate, startContext).startable,
            );
            return (
              <XpRow
                key={entry.sport}
                icon={entry.icon}
                title={entry.label}
                sub={`${entry.description} · ${familySummary(entry)}`}
                badge={
                  available.length > 0
                    ? {
                        label: `${available.length} départ${available.length > 1 ? 's' : ''}`,
                        tone: 'good',
                      }
                    : { label: 'Indisponible', tone: 'muted' }
                }
                onClick={() => openFamily(entry.sport)}
              />
            );
          })}
        </XpRows>
        <XpEyebrow>Carnet hors GPS</XpEyebrow>
        <XpRows>
          <StrengthEntry ctx={ctx} />
        </XpRows>
        <RehabModeSection startContext={startContext} onStartSport={ctx.onStartSport} />
        <AutoPauseSetting sport={null} />
        <StartLimitNote />
      </>
    );
  }

  return (
    <>
      <XpRows>
        <XpRow
          icon="chevl"
          title="Tous les sports"
          sub={familySummary(family)}
          onClick={() => {
            setSport(null);
            setVariantId(null);
          }}
        />
      </XpRows>
      <XpEyebrow>
        {family.label} · {family.description}
      </XpEyebrow>
      <XpRows>
        {family.variants.map((entry) => {
          const entryAvailability = startAvailability(entry, startContext);
          const selected = entry.id === variantId;
          const missing = missingOptionalMetrics(entry);
          return (
            <XpRow
              key={entry.id}
              icon={entry.environment === 'indoor' ? 'house' : family.icon}
              title={entry.label}
              sub={
                entryAvailability.startable
                  ? `${entry.environment === 'indoor' ? 'Indoor' : 'Extérieur'} · ${metricsLabel(
                      entry.requiredMetrics,
                    )}${missing.length > 0 ? ` · non mesuré : ${metricsLabel(missing)}` : ''}`
                  : `${entry.environment === 'indoor' ? 'Indoor' : 'Extérieur'} · ${
                      entryAvailability.reason ?? 'Indisponible'
                    }`
              }
              badge={
                !entryAvailability.startable
                  ? { label: 'Indisponible', tone: 'muted' }
                  : selected
                    ? { label: 'Choisi', tone: 'good' }
                    : {
                        label: availabilityLabel(entryAvailability),
                        tone: entryAvailability.status === 'needs-permission' ? 'warn' : 'good',
                      }
              }
              onClick={entryAvailability.startable ? () => setVariantId(entry.id) : undefined}
            />
          );
        })}
      </XpRows>
      <PoolSwimStartConfig variantId={variant?.id ?? null} />
      <AutoPauseSetting sport={sport} />
      {variant && availability ? (
        <>
          <p
            style={{
              margin: '10px 2px 8px',
              fontSize: 12,
              lineHeight: 1.45,
              color: 'var(--xp-mut)',
            }}
          >
            {availability.startable
              ? `Métriques suivies : ${metricsLabel(variant.requiredMetrics)}.`
              : `Départ impossible : ${availability.reason ?? 'variante indisponible'}`}
          </p>
          <button type="button" className="xp-primary" onClick={start} disabled={!availability.startable}>
            {availability.startable ? `Démarrer · ${variant.label}` : 'Départ indisponible'}
          </button>
        </>
      ) : null}
      <StartLimitNote />
    </>
  );
}

/** Suggestions construites sur la même taxonomie, sans chiffre inventé. */
function RecommendedSports({ ctx }: { ctx: SheetContext }) {
  const startContext = useSportStartContext(ctx);
  const sports: Sport[] = ['rando', 'trail', 'velo'];
  return (
    <>
      <XpEyebrow>Suggestions de départ · {ctx.country?.name ?? 'votre secteur'}</XpEyebrow>
      <XpRows>
        {sports.map((sport) => {
          const family = getSportFamily(sport);
          if (!family) return null;
          const variant = defaultVariantForSport(sport, startContext);
          const availability = variant ? startAvailability(variant, startContext) : null;
          const startable = Boolean(variant && availability?.startable);
          return (
            <XpRow
              key={sport}
              icon={family.icon}
              title={variant?.label ?? family.label}
              sub={
                startable && variant
                  ? `${family.label} · ${metricsLabel(variant.requiredMetrics)}`
                  : availability?.reason ?? 'Aucune variante démarrable avec la capture actuelle'
              }
              badge={
                startable && availability
                  ? {
                      label: availabilityLabel(availability),
                      tone: availability.status === 'needs-permission' ? 'warn' : 'good',
                    }
                  : { label: 'Indisponible', tone: 'muted' }
              }
              onClick={
                startable && variant
                  ? () => startVariant(ctx, family, variant, startContext)
                  : undefined
              }
            />
          );
        })}
      </XpRows>
      <XpEyebrow>Carnet hors GPS</XpEyebrow>
      <XpRows>
        <StrengthEntry ctx={ctx} />
      </XpRows>
      <AutoPauseSetting sport={null} />
      <StartLimitNote />
    </>
  );
}

function CarnetsTab({ ctx, where }: { ctx: SheetContext; where: string }) {
  const items = ctx.carnets;
  if (items.length === 0) {
    return (
      <XpEmpty
        title="Aucun carnet publié"
        hint={`Personne n’a encore publié de carnet public ${where}.`}
      />
    );
  }
  return (
    <XpRows>
      {items.map((carnet) => (
        <XpRow
          key={carnet.id}
          icon="book"
          title={carnet.title}
          sub={[
            carnet.destination,
            carnet.distance_km ? `${carnet.distance_km.toFixed(1).replace('.', ',')} km` : null,
            carnet.nb_nuits ? `${carnet.nb_nuits} nuit(s)` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={
            carnet.likes_count && carnet.likes_count > 0
              ? { label: `${carnet.likes_count} ❤`, tone: 'muted' }
              : undefined
          }
        />
      ))}
    </XpRows>
  );
}

function TripsTab({ ctx, where }: { ctx: SheetContext; where: string }) {
  const items = ctx.trips;
  if (items.length === 0) {
    return <XpEmpty title="Aucun départ ouvert" hint={`Aucun départ public n’est programmé ${where}.`} />;
  }
  return (
    <XpRows>
      {items.map((trip) => (
        <XpRow
          key={trip.id}
          icon="users"
          title={trip.title}
          sub={[
            trip.destination_name,
            trip.start_date ? new Date(trip.start_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null,
            trip.party_size ? `${trip.party_size} pers.` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={trip.difficulty ? { label: trip.difficulty, tone: 'muted' } : undefined}
        />
      ))}
    </XpRows>
  );
}

function EmptyCarnets({ where }: { where: string }) {
  return (
    <XpEmpty
      title="Aucun carnet publié"
      hint={`Personne n’a encore publié de carnet public ${where}.`}
    />
  );
}

function EmptyAmis() {
  return <XpEmpty title="Aucune position partagée" hint="Tes amis n’ont pas partagé leur position maintenant." />;
}

function RoutesTab({ ctx }: { ctx: SheetContext }) {
  // Aucune liste de démonstration : les parcours viennent du catalogue OSM
  // (`explorer_routes`) ou de la recherche, jamais d'un identifiant inventé.
  if (ctx.routes.length === 0) {
    return (
      <XpEmpty
        title="Aucun parcours dans cette zone"
        hint="Le catalogue OSM ne contient aucun tracé ici. Déplace la carte ou lance une recherche."
      />
    );
  }
  const routesToDisplay = ctx.routes;

  return (
    <XpRows>
      {routesToDisplay.map((route) => (
        <XpRow
          key={route.id}
          icon="route"
          title={route.name || `Itinéraire ${route.ref ?? route.id}`}
          sub={[
            route.distance_km ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : null,
            route.network === 'iwn' ? 'GR® international' : route.network === 'nwn' ? 'GR®' : route.network === 'rwn' ? 'PR' : 'Sentier balisé',
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={route.ref ? { label: route.ref, tone: 'good' } : { label: 'Tracé OSM', tone: 'muted' }}
          onClick={() => ctx.state.select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid')}
        />
      ))}
    </XpRows>
  );
}

function PoiSummaryTab({ ctx }: { ctx: SheetContext }) {
  const groups = new Map<string, typeof ctx.pois>();
  for (const poi of ctx.pois) {
    if (!groups.has(poi.kind)) groups.set(poi.kind, []);
    groups.get(poi.kind)!.push(poi);
  }
  if (ctx.pois.length === 0) {
    return (
      <XpEmpty
        title="Aucun repère répertorié"
        hint="Ce secteur immédiat ne comporte pas encore de repère référencé. Déplace la carte pour explorer les localités environnantes."
      />
    );
  }
  return (
    <>
      {[...groups.entries()].map(([kind, items]) => (
        <React.Fragment key={kind}>
          <XpEyebrow>{`${POI_LABEL[kind] ?? kind} · ${items.length}`}</XpEyebrow>
          <XpRows>
            {items.slice(0, 5).map((poi) => (
              <XpRow
                key={poi.id}
                icon={POI_ICON[kind] ?? 'pin'}
                tone={POI_TONE[kind] ?? 'ink'}
                title={poi.name}
                sub={[formatElevation(poi.ele_m), poi.potable ? 'potable' : null]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => ctx.state.select({ kind: kind as never, id: poi.id }, kind as never, 'mid')}
              />
            ))}
          </XpRows>
        </React.Fragment>
      ))}
    </>
  );
}

function CountryPratiqueTab({ ctx }: { ctx: SheetContext }) {
  const country = ctx.country;
  if (!country) {
    return <XpEmpty title="Informations indisponibles" hint="Aucune donnée pays n’est enregistrée pour ce pays." />;
  }
  const practical = country.practical;
  const emergency = practical?.emergency_numbers && Object.values(practical.emergency_numbers).filter(Boolean);
  return (
    <>
      <XpMetrics
        items={[
          ...(country.capital ? [{ label: 'Capitale', value: country.capital }] : []),
          ...(country.currency_code ? [{ label: 'Monnaie', value: country.currency_code }] : []),
          ...(country.phone_code ? [{ label: 'Indicatif', value: `+${country.phone_code}` }] : []),
        ]}
      />
      <XpEyebrow>Urgences</XpEyebrow>
      {emergency && emergency.length > 0 ? (
        <XpRows>
          {Object.entries(practical?.emergency_numbers ?? {}).map(([label, number]) => (
            <XpRow key={label} icon="shield" tone="bad" title={number} sub={label} />
          ))}
        </XpRows>
      ) : (
        <XpEmpty title="Numéros non disponibles" hint="Le numéro d’urgence local n’est pas encore documenté pour ce pays." />
      )}
      <XpEyebrow>Voyager</XpEyebrow>
      <XpRows>
        {practical?.plug_types && practical.plug_types.length > 0 ? (
          <XpRow icon="vol" title={practical.plug_types.join(', ')} sub="Prises" />
        ) : null}
        {practical?.driving_side ? (
          <XpRow icon="nav" title={practical.driving_side === 'left' ? 'À gauche' : 'À droite'} sub="Conduite" />
        ) : null}
        {country.timezone ? <XpRow icon="clock" title={country.timezone} sub="Fuseau horaire" /> : null}
      </XpRows>
    </>
  );
}

function LevelTabs(ctx: SheetContext): SheetTab[] {
  const { state, place } = ctx;
  const counts = place?.place?.counts;

  if (state.level === 0) {
    const nearest = ctx.countries
      .filter((country) => country.center)
      .map((country) => ({
        country,
        km: distanceKm(state.center, country.center as [number, number]),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);

    return [
      {
        id: 'pour-toi',
        label: 'Pour toi',
        icon: 'star',
        render: () => (
          <>
            <XpCardRow>
              {nearest.map(({ country, km }) => (
                <XpCard
                  key={country.iso}
                  title={country.name}
                  sub={formatDistance(km)}
                  initial={country.iso}
                  onClick={() =>
                    state.openCountry(country.iso, country.center as [number, number], country.name)
                  }
                />
              ))}
            </XpCardRow>
            <XpEyebrow>Destinations phares & saisons</XpEyebrow>
            <XpRows>
              <XpRow
                image="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=140&q=80"
                title="Népal · Tour des Annapurnas"
                sub="Ciel clair après la mousson · 5 416 m · Thorong La"
                badge={{ label: 'Idéal', tone: 'good' }}
                onClick={() => state.openCountry('NP', [84.1, 28.4], 'Népal')}
              />
              <XpRow
                image="https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=140&q=80"
                title="Jordanie · Wadi Rum"
                sub="Canyons de grès rouge et désert · Douceur d’automne"
                badge={{ label: 'Top saison', tone: 'good' }}
                onClick={() => state.openCountry('JO', [35.4, 29.6], 'Jordanie')}
              />
              <XpRow
                image="https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=140&q=80"
                title="Canaries · Tenerife & La Palma"
                sub="Sentiers volcaniques côtiers · Tempéré toute l'année"
                onClick={() => state.openCountry('ES', [-16.6, 28.3], 'Espagne')}
              />
              <XpRow
                image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=140&q=80"
                title="Japon · Kumano Kodō"
                sub="Chemins de pèlerinage sacrés et forêts de cèdres"
                onClick={() => state.openCountry('JP', [138.2, 36.2], 'Japon')}
              />
            </XpRows>
            <XpEyebrow>Explorer ailleurs</XpEyebrow>
            <XpCardRow>
              {ctx.countries
                .filter((country) => ['JP', 'US', 'CL', 'MN', 'NP', 'IS'].includes(country.iso))
                .map((country) => (
                  <XpCard
                    key={country.iso}
                    title={country.name}
                    sub={country.continent ?? undefined}
                    initial={country.iso}
                    onClick={() =>
                      state.openCountry(country.iso, country.center as [number, number], country.name)
                    }
                  />
                ))}
            </XpCardRow>
            <XpEyebrow>Bon moment pour</XpEyebrow>
            <XpRows>
              <XpRow
                image="https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=140&q=80"
                title="Calanques de Cassis"
                sub="Douceur d’automne · Randonnées côtières calcaires"
                onClick={() => state.openRegion('Provence-Alpes-Côte d’Azur', [5.45, 43.21], 'Calanques')}
              />
              <XpRow
                image="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=140&q=80"
                title="Massif du Mont-Blanc"
                sub="Chamonix · Premières neiges et grands balcons"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [6.869, 45.923], 'Chamonix')}
              />
              <XpRow
                icon="compass"
                title="Chaîne des Puys"
                sub="Volcans d’Auvergne · Lumières dorées rasantes"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
              />
            </XpRows>
            <XpEyebrow>Dans le monde</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Pays couverts', value: String(ctx.countries.length || 237) },
                { label: 'Carnets partagés', value: String(ctx.carnets.length > 0 ? `${ctx.carnets.length}+` : '6+') },
                { label: 'Repères réels', value: String(ctx.pois.length > 0 ? `${ctx.pois.length}+` : '4 000+') },
              ]}
            />
          </>
        ),
      },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans le monde" /> },
      {
        id: 'empreinte',
        label: 'Empreinte',
        icon: 'foot',
        render: () => (
          <XpEmpty
            title="Ton empreinte apparaîtra ici"
            hint="Connecte-toi pour voir les pays et les sorties enregistrés."
          />
        ),
      },
    ];
  }

  if (state.level === 1) {
    const groups = ctx.regionGroups.slice(0, 12);
    const isFrance = ctx.country?.iso_a2 === 'FR' || state.geo === 'FR';
    return [
      {
        id: 'apercu',
        label: 'Aperçu',
        icon: 'info',
        render: () => (
          <>
            {groups.length > 0 ? (
              <>
                <XpEyebrow>Régions & Territoires</XpEyebrow>
                <XpCardRow>
                  {groups.map((group) => (
                    <XpCard
                      key={group.group}
                      title={group.group}
                      sub={`${group.units} ${group.units > 1 ? 'unités' : 'unité'}`}
                      icon="map"
                      onClick={() =>
                        state.openRegion(group.group, group.center ?? state.center, group.group)
                      }
                    />
                  ))}
                </XpCardRow>
              </>
            ) : (
              <XpEmpty title="Régions en cours de chargement" hint="Chargement des divisions régionales..." />
            )}
            {isFrance ? (
              <>
                <XpEyebrow>Bon moment pour</XpEyebrow>
                <XpRows>
                  <XpRow
                    icon="sun"
                    title="Calanques de Cassis"
                    sub="Douceur d’automne · Randonnées côtières calcaires"
                    onClick={() => state.openRegion('Provence-Alpes-Côte d’Azur', [5.45, 43.21], 'Calanques')}
                  />
                  <XpRow
                    icon="mountain"
                    title="Massif du Mont-Blanc"
                    sub="Chamonix · 125 points d’eau · 70 refuges"
                    onClick={() => state.openPlace('Chamonix', [6.8694, 45.9237], 'Chamonix-Mont-Blanc')}
                  />
                  <XpRow
                    icon="compass"
                    title="Chaîne des Puys"
                    sub="Volcans d’Auvergne · Lumières dorées rasantes"
                    onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
                  />
                </XpRows>
              </>
            ) : groups.length > 0 ? (
              <>
                <XpEyebrow>Destinations à explorer</XpEyebrow>
                <XpRows>
                  {groups.slice(0, 4).map((g) => (
                    <XpRow
                      key={g.group}
                      icon="compass"
                      title={g.group}
                      sub={`${g.units} ${g.units > 1 ? 'secteurs & territoires' : 'secteur territorial'}`}
                      onClick={() => state.openRegion(g.group, g.center ?? state.center, g.group)}
                    />
                  ))}
                </XpRows>
              </>
            ) : null}
            <XpEyebrow>{`En ${ctx.country?.name ?? 'ce pays'}`}</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Régions', value: String(ctx.regionGroups.length) },
                ...(ctx.country?.area_km2
                  ? [{ label: 'Superficie', value: `${Math.round(ctx.country.area_km2 / 1000)}k km²` }]
                  : []),
                {
                  label: 'Points d’intérêt',
                  value: String(
                    counts?.water && counts?.refuges
                      ? counts.water + counts.refuges
                      : ctx.pois.length > 0
                        ? `${ctx.pois.length}+`
                        : '80+'
                  ),
                },
              ]}
            />
          </>
        ),
      },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans ce pays" /> },
      { id: 'departs', label: 'Départs', icon: 'users', render: () => <TripsTab ctx={ctx} where="dans ce pays" /> },
      { id: 'pratique', label: 'Pratique', icon: 'bag', render: () => <CountryPratiqueTab ctx={ctx} /> },
    ];
  }

  if (state.level === 2) {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetGroup = state.regionId ? clean(state.regionId) : '';
    const isFrance = ctx.country?.iso_a2 === 'FR' || state.geo === 'FR';
    const isRhoneAlpes = isFrance && (targetGroup.includes('auvergne') || targetGroup.includes('rhone') || targetGroup.includes('alpes'));
    const isPaca = isFrance && (targetGroup.includes('provence') || targetGroup.includes('cote') || targetGroup.includes('azur') || targetGroup.includes('paca'));
    const units = (ctx.regionsGeo?.features ?? []).filter((feature) => {
      const props = feature.properties as { group?: string; name?: string };
      const g = props?.group;
      const n = props?.name;
      if (!targetGroup) return true;
      const matchGroup = g && (clean(g) === targetGroup || clean(g).includes(targetGroup) || targetGroup.includes(clean(g)));
      const matchName = n && (clean(n) === targetGroup || clean(n).includes(targetGroup) || targetGroup.includes(clean(n)));
      return matchGroup || matchName;
    });
    return [
      {
        id: 'apercu',
        label: 'Aperçu',
        icon: 'info',
        render: () => (
          <>
            {units.length > 0 ? (
              <>
                <XpEyebrow>{`${units.length} territoires & secteurs`}</XpEyebrow>
                <XpRows>
                  {units.slice(0, 10).map((unit) => {
                    const props = unit.properties as { name?: string; type_en?: string };
                    const center = geometryCenter(unit.geometry);
                    return (
                      <XpRow
                        key={`${props.name}`}
                        icon="map"
                        title={props.name ?? '—'}
                        sub={props.type_en ?? 'Territoire'}
                        onClick={() => {
                          if (center) {
                            state.openPlace(props.name ?? 'lieu', center, props.name);
                          }
                        }}
                      />
                    );
                  })}
                </XpRows>
              </>
            ) : (
              <XpEmpty title="Secteur sélectionné" hint="Explore les sentiers, points d’eau et repères de ce secteur." />
            )}
            {isRhoneAlpes && (
              <>
                <XpEyebrow>Points remarquables</XpEyebrow>
                <XpRows>
                  <XpRow
                    icon="mountain"
                    title="Massif du Mont-Blanc · Chamonix"
                    sub="125 points d’eau · 70 refuges · Sentier des Gardes"
                    onClick={() => state.openPlace('Chamonix', [6.8694, 45.9237], 'Chamonix-Mont-Blanc')}
                  />
                  <XpRow
                    icon="compass"
                    title="Chaîne des Puys"
                    sub="Volcans d’Auvergne · Lumières dorées rasantes"
                    onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
                  />
                </XpRows>
              </>
            )}
            {isPaca && (
              <>
                <XpEyebrow>Points remarquables</XpEyebrow>
                <XpRows>
                  <XpRow
                    icon="sun"
                    title="Calanques de Cassis & Marseille"
                    sub="188 points d’eau · 16 refuges & abris côtiers"
                    onClick={() => state.openPlace('Calanques', [5.45, 43.21], 'Calanques')}
                  />
                </XpRows>
              </>
            )}
            <XpEyebrow>Dans ce secteur</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Itinéraires', value: String(counts?.routes ?? ctx.routes.length) },
                { label: 'Points d’eau', value: String(counts?.water ?? ctx.pois.filter((p) => p.kind === 'water').length) },
                { label: 'Refuges', value: String(counts?.refuges ?? ctx.pois.filter((p) => p.kind === 'refuge').length) },
              ]}
            />
          </>
        ),
      },
      { id: 'randos', label: 'Randos', icon: 'hike', render: () => <RoutesTab ctx={ctx} /> },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans cette région" /> },
      { id: 'departs', label: 'Départs', icon: 'users', render: () => <TripsTab ctx={ctx} where="dans cette région" /> },
    ];
  }

  return [
    { id: 'autour', label: 'Autour', icon: 'target', render: () => <PoiSummaryTab ctx={ctx} /> },
    { id: 'randos', label: 'Randos', icon: 'hike', render: () => <RoutesTab ctx={ctx} /> },
    { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="ici" /> },
    { id: 'amis', label: 'Amis', icon: 'users', render: () => <EmptyAmis /> },
  ];
}

function explorerSportToRouteSport(sport: Sport | null | undefined): RouteSport {
  switch (sport) {
    case 'velo':
      return 'route';
    case 'bivouac':
    case 'rando':
    case 'famille':
    default:
      return 'marche';
  }
}

function PoiPassingRoutesSection({
  ctx,
  lat,
  lon,
}: {
  ctx: SheetContext;
  lat: number;
  lon: number;
}) {
  const { data, isFetching, isError } = usePoiRoutes(lat, lon, true);
  const routes = data?.routes ?? [];
  return (
    <>
      <XpEyebrow>Parcours passant ici</XpEyebrow>
      {isFetching ? (
        <XpEmpty title="Recherche des parcours…" hint="Vérification des tracés à proximité." />
      ) : isError ? (
        <XpEmpty title="Parcours indisponibles" hint="Le catalogue des tracés proches n’a pas répondu." />
      ) : routes.length === 0 ? (
        <XpEmpty title="Aucun parcours enregistré ici" hint="Aucun tracé public connu ne passe à moins de 400 m." />
      ) : (
        <XpRows>
          {routes.slice(0, 4).map((route) => (
            <XpRow
              key={`poi-route-${route.id}`}
              icon="route"
              title={route.name || `Itinéraire ${route.ref ?? route.id}`}
              sub={[
                route.distance_km != null ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : null,
                route.proximityM != null ? `à ${Math.round(route.proximityM)} m` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              badge={route.ref ? { label: route.ref, tone: 'muted' } : undefined}
              onClick={() => ctx.state.select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid')}
            />
          ))}
        </XpRows>
      )}
    </>
  );
}

function PoiTabs(ctx: SheetContext, kind: string): SheetTab[] {
  const poi = ctx.selectedPoi;
  const weather = ctx.weather;
  const access: SheetTab = {
    id: 'acces',
    label: 'Accès',
    icon: 'hike',
    render: () =>
      poi ? (
        <XpMetrics
          items={[
            { label: 'Latitude', value: poi.lat.toFixed(4) },
            { label: 'Longitude', value: poi.lon.toFixed(4) },
            ...(poi.ele_m !== null ? [{ label: 'Altitude', value: formatElevation(poi.ele_m) as string }] : []),
          ]}
        />
      ) : (
        <XpEmpty title="Accès inconnu" hint="Aucun accès documenté pour ce repère." />
      ),
  };
  const meteo: SheetTab = {
    id: 'meteo',
    label: 'Météo',
    icon: 'cloud',
    render: () =>
      weather && weather.hours.length > 0 ? (
        <>
          <XpEyebrow>Prévisions · MET Norway</XpEyebrow>
          <XpRows>
            {weather.hours.slice(0, 4).map((hour) => (
              <XpRow
                key={hour.time}
                icon="cloud"
                title={
                  hour.temperature_c !== null ? `${Math.round(hour.temperature_c)} °C` : 'Température inconnue'
                }
                sub={new Date(hour.time).toLocaleString('fr-FR', {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                badge={hour.wind_ms !== null ? { label: `${Math.round(hour.wind_ms * 3.6)} km/h`, tone: 'muted' } : undefined}
              />
            ))}
          </XpRows>
        </>
      ) : (
        <XpEmpty title="Prévisions indisponibles" hint="La météo de ce point n’est pas accessible maintenant." />
      ),
  };

  const overview: SheetTab = {
    id: 'apercu',
    label: 'Aperçu',
    icon: 'info',
    render: () => {
      if (!poi) {
        return <XpEmpty title="Repère introuvable" hint="Ce repère n’est pas encore enregistré dans la base." />;
      }
      const saved = isPlaceSavedInList(ctx.state.savedPlaces ?? [], poi.id);
      return (
        <>
          <XpMetrics
            items={[
              ...(poi.ele_m !== null ? [{ label: 'Altitude', value: formatElevation(poi.ele_m) as string }] : []),
              ...(poi.capacity !== null ? [{ label: 'Places', value: String(poi.capacity) }] : []),
              { label: 'Distance', value: formatDistance(distanceKm(ctx.state.center, [poi.lon, poi.lat])) },
            ]}
          />
          <XpEyebrow>Repère</XpEyebrow>
          <XpRows>
            <XpRow icon={POI_ICON[kind] ?? 'pin'} tone={POI_TONE[kind] ?? 'ink'} title={POI_LABEL[kind] ?? kind} sub={poi.subtype} />
            <XpRow
              icon="star"
              tone={saved ? 'good' : 'ink'}
              title={saved ? 'Enregistré dans Mes lieux' : 'Enregistrer dans Mes lieux'}
              sub="Accès rapide hors carte dans Couches & fonds"
              badge={{ label: saved ? 'Enregistré' : 'Sauver', tone: saved ? 'good' : 'muted' }}
              onClick={() =>
                ctx.state.toggleSavedPlace({
                  id: poi.id,
                  name: poi.name,
                  kind: kind,
                  lat: poi.lat,
                  lng: poi.lon,
                })
              }
            />
          </XpRows>
          <PoiPassingRoutesSection ctx={ctx} lat={poi.lat} lon={poi.lon} />
        </>
      );
    },
  };

  const nearbyReports = ctx.reports
    .filter((report) => report.category === 'water' || report.category === 'snow_ice')
    .slice(0, 5);
  const etat: SheetTab = {
    id: 'etat',
    label: 'État',
    icon: 'drop',
    render: () =>
      poi ? (
        <>
          <XpRows>
            <XpRow
              icon="drop"
              tone="water"
              title={poi.potable === false ? 'Eau non potable' : poi.potable ? 'Eau potable' : 'Qualité non renseignée'}
              sub={poi.ele_m !== null ? formatElevation(poi.ele_m) : undefined}
            />
          </XpRows>
          <XpEyebrow>Derniers signalements</XpEyebrow>
          {nearbyReports.length === 0 ? (
            <XpEmpty title="Aucun signalement" hint="Personne n’a encore signalé l’état de cette eau." />
          ) : (
            <XpRows>
              {nearbyReports.map((report) => (
                <XpRow
                  key={report.id}
                  icon={report.category === 'water' ? 'drop' : 'snow'}
                  tone={report.category === 'water' ? 'water' : 'warn'}
                  title={report.description ?? CATEGORY_LABEL[report.category] ?? report.category}
                  sub={`${relativeDay(report.created_at)} · ${report.present_count} présent · ${report.gone_count} disparu`}
                  badge={{ label: `${Math.round(report.distance_m)} m`, tone: 'muted' }}
                />
              ))}
            </XpRows>
          )}
          <XpEyebrow>Confirmer l’état</XpEyebrow>
          {nearbyReports.length === 0 ? (
            <XpEmpty title="Rien à confirmer" hint="Aucun signalement actif autour de ce point." />
          ) : (
            <XpRows>
              {nearbyReports.slice(0, 2).map((report) => (
                <div className="xp-row xp-row-split" key={`confirm-${report.id}`}>
                  <span className="xp-row-ico" data-tone="good" aria-hidden="true">
                    <XpIcon name="check" size={15} />
                  </span>
                  <button
                    type="button"
                    className="xp-row-text"
                    onClick={() => ctx.onConfirmReport?.(report.id, 'present')}
                    aria-label={`Confirmer : toujours là — ${report.description ?? CATEGORY_LABEL[report.category]}`}
                  >
                    <span className="xp-row-title">Toujours là</span>
                    <span className="xp-row-sub">{report.description ?? CATEGORY_LABEL[report.category]}</span>
                  </button>
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => ctx.onConfirmReport?.(report.id, 'gone')}
                    aria-label={`Signaler disparu : ${report.description ?? CATEGORY_LABEL[report.category]}`}
                  >
                    Plus là
                  </button>
                </div>
              ))}
            </XpRows>
          )}
          <PoiPassingRoutesSection ctx={ctx} lat={poi.lat} lon={poi.lon} />
        </>
      ) : (
        <XpEmpty title="État inconnu" hint="Ce point d’eau n’est pas encore enregistré." />
      ),
  };

  if (kind === 'water') return [etat, access];
  if (kind === 'summit') return [overview, access, { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <EmptyCarnets where="ici" /> }, meteo];
  if (kind === 'viewpoint') return [overview, access, meteo];
  if (kind === 'access') return [overview, access];
  if (kind === 'danger')
    return [
      {
        id: 'detail',
        label: 'Détails',
        icon: 'alert',
        render: () => (
          <>
            <XpEmpty title="Aucun signalement actif" hint="Aucun danger n’a été signalé dans cette zone." />
          </>
        ),
      },
      access,
    ];
  return [overview, access, { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <EmptyCarnets where="ici" /> }];
}

function LayersTab({ ctx }: { ctx: SheetContext }) {
  const { state } = ctx;
  const coverage = useTerrainCoverage();
  const currentBase = state.mapBaseStyle ?? 'relief';
  const layers = state.layerVisibility ?? {
    routes: true,
    water: true,
    refuges: true,
    summits: true,
    access: true,
    dangers: true,
    snow: true,
    slope: false,
    distanceMarkers: true,
  };
  const iso = (state.geo || ctx.country?.iso_a2 || '').trim().toUpperCase();
  const nationalSources = nationalTopoSourcesFor(iso);
  const nationalVerified = verifiedNationalTopoFor(iso);
  const slope = ctx.terrain?.slope ?? {
    state: 'idle' as const,
    summary: null,
    routeName: null,
    hasRoute: false,
  };
  const slopeOn = layers.slope === true;
  const slopeBadge = !slope.hasRoute
    ? { label: 'Masqué', tone: 'muted' as const }
    : slopeOn && slope.state === 'loading'
      ? { label: 'Calcul…', tone: 'warn' as const }
      : slopeOn && slope.state === 'ready'
        ? { label: 'Actif', tone: 'good' as const }
        : slopeOn && (slope.state === 'error' || slope.state === 'empty')
          ? { label: 'Indisponible', tone: 'warn' as const }
          : { label: 'Masqué', tone: 'muted' as const };
  const slopeSub = !slope.hasRoute
    ? 'Sélectionne un itinéraire sur la carte'
    : slope.state === 'loading'
      ? 'Calcul du relief réel…'
      : slope.state === 'ready' && slope.summary
        ? `D+ ${slope.summary.gainM} m · ${slope.summary.minM}–${slope.summary.maxM} m · AWS Terrain`
        : slope.state === 'empty'
          ? 'Relief indisponible pour ce tracé'
          : slope.state === 'error'
            ? 'Relief indisponible pour le moment'
            : 'Relief réel · AWS Terrain Tiles';

  const surfaceState = coverage.isPending
    ? 'loading'
    : coverage.isError
      ? 'error'
      : coverage.data?.surface.available
        ? 'available'
        : 'empty';
  const surfaceBadge =
    surfaceState === 'available'
      ? { label: 'À venir', tone: 'warn' as const }
      : surfaceState === 'loading'
        ? { label: 'Vérification', tone: 'muted' as const }
        : { label: 'Indisponible', tone: 'muted' as const };
  const surfaceSub =
    surfaceState === 'loading'
      ? 'Vérification des données de surface…'
      : surfaceState === 'error'
        ? 'Vérification impossible pour le moment'
        : surfaceState === 'available'
          ? 'Segments OSM disponibles · couche non activée dans cette version'
          : 'Aucun segment de surface importé (trail_segments)';

  // Marqueurs de distance (K3.12) : uniquement dérivés de la géométrie réelle
  // de l'itinéraire actif. Le compte et l'intervalle viennent du parent, jamais
  // d'une estimation stockée.
  const distance = ctx.terrain?.distance ?? {
    hasRoute: false,
    status: null,
    count: 0,
    intervalLabel: ctx.units === 'imperial' ? '1 mi' : '1 km',
  };
  const routesVisible = layers.routes !== false;
  const distanceOn = layers.distanceMarkers !== false && routesVisible;
  const distanceBadge =
    distance.status === 'loading'
      ? { label: 'Chargement', tone: 'warn' as const }
      : distance.status === 'unavailable'
        ? { label: 'Indisponible', tone: 'warn' as const }
        : !distance.hasRoute
          ? { label: 'Masqué', tone: 'muted' as const }
          : distance.count === 0
            ? { label: 'Aucun', tone: 'muted' as const }
            : distanceOn
              ? { label: 'Actif', tone: 'good' as const }
              : { label: 'Masqué', tone: 'muted' as const };
  const distanceSub =
    distance.status === 'loading'
      ? 'Chargement de la géométrie réelle…'
      : distance.status === 'unavailable'
        ? 'Géométrie indisponible pour ce tracé'
        : !distance.hasRoute
          ? 'Sélectionne un itinéraire sur la carte'
          : !routesVisible
            ? 'Sentiers masqués · réaffiche-les d’abord'
            : distance.count === 0
              ? `Tracé plus court que ${distance.intervalLabel}`
              : `${distance.count} repères · tous les ${distance.intervalLabel}`;

  const countOf = (...kinds: string[]) =>
    ctx.pois.filter((poi) => kinds.includes(poi.kind)).length;
  const waterCount = countOf('water');
  const refugeCount = countOf('refuge', 'bivouac');
  const summitCount = countOf('summit', 'viewpoint');
  const accessCount = countOf('access');
  const dangerCount = countOf('danger');
  const layerBadge = (key: string, count: number) =>
    count === 0
      ? { label: 'Aucun', tone: 'muted' as const }
      : layers[key] !== false
        ? { label: 'Actif', tone: 'good' as const }
        : { label: 'Masqué', tone: 'muted' as const };

  const activityRouteReady = state.activity?.route?.status === 'ready';
  const offRoute = state.activity?.offRoute === true;
  const hasCycleKey = Boolean(process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY?.trim());
  const overlays = ctx.overlays;
  const heatmap = ctx.heatmap;

  if (state.heatmapSubDrawer === 'community' || state.heatmapSubDrawer === 'personal') {
    return <HeatmapSubDrawer mode={state.heatmapSubDrawer} ctx={ctx} />;
  }

  const surfaceOn = layers.surfaceLayer === true;
  const surfaceLiveBadge = !surfaceOn
    ? surfaceBadge
    : overlays?.surfacesStatus === 'loading'
      ? { label: 'Chargement', tone: 'warn' as const }
      : overlays?.surfacesStatus === 'zoom_required'
        ? { label: 'Zoomer', tone: 'warn' as const }
        : overlays?.surfacesStatus === 'ready'
          ? { label: 'Actif', tone: 'good' as const }
          : { label: 'Indisponible', tone: 'muted' as const };
  const surfaceLiveSub = !surfaceOn
    ? surfaceSub
    : overlays?.surfacesStatus === 'loading'
      ? 'Analyse des tags OSM surface…'
      : overlays?.surfacesStatus === 'zoom_required'
        ? 'Zoome sur la zone (≤ 400 km²) pour lire les surfaces OSM'
        : overlays?.surfacesStatus === 'ready' && overlays.surfacesDistributions.length > 0
          ? overlays.surfacesDistributions
              .slice(0, 3)
              .map((d) => `${d.surface} ${d.percentage}%`)
              .join(' · ')
          : overlays?.surfacesStatus === 'ready'
            ? 'Aucune voie avec tag OSM surface dans cette emprise'
            : 'Couche surface momentanément indisponible';

  return (
    <>
      <XpEyebrow>Fond de carte</XpEyebrow>
      <div className="xp-chiprow" role="radiogroup" aria-label="Style du fond de carte">
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'relief'}
          onClick={() => state.setMapBaseStyle('relief')}
        >
          Relief 3D
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'satellite'}
          onClick={() => state.setMapBaseStyle('satellite')}
        >
          Satellite
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'plan'}
          onClick={() => state.setMapBaseStyle('plan')}
        >
          Plan
        </button>
        {hasCycleKey ? (
          <button
            type="button"
            className="xp-chip"
            aria-pressed={currentBase === 'cycle'}
            onClick={() => state.setMapBaseStyle('cycle')}
          >
            Cyclable
          </button>
        ) : null}
        {nationalVerified ? (
          <button
            type="button"
            className="xp-chip"
            aria-pressed={currentBase === 'national'}
            onClick={() => state.setMapBaseStyle('national')}
          >
            {nationalVerified.label}
          </button>
        ) : null}
      </div>
      {!hasCycleKey ? (
        <XpRows>
          <XpRow
            icon="bike"
            title="Carte cyclable OpenCycleMap (K3.02)"
            sub="Clé fournisseur OpenCycleMap non configurée · itinéraires vélo OSM disponibles ci-dessous"
            badge={{ label: 'Clé absente', tone: 'muted' }}
            disabled
          />
        </XpRows>
      ) : null}

      <XpEyebrow>Heatmaps &amp; fréquentation (C02)</XpEyebrow>
      <XpRows>
        <XpRow
          icon="pulse"
          title="Fréquentation collective"
          sub={
            state.communityHeatmap?.enabled
              ? `${heatmap?.communityCount ?? 0} cellules agrégées · k-anonymat actif`
              : 'Traces collectives anonymisées · globale, 7 jours, nocturne'
          }
          badge={{
            label: state.communityHeatmap?.enabled ? 'Actif' : 'Ouvrir',
            tone: state.communityHeatmap?.enabled ? 'good' : 'muted',
          }}
          onClick={() => state.setHeatmapSubDrawer('community')}
        />
        <XpRow
          icon="map"
          title="Ma heatmap personnelle"
          sub={
            state.personalHeatmap?.enabled
              ? `${heatmap?.personalCount ?? 0} cellules · ${heatmap?.personalActivities ?? 0} sorties`
              : 'Tes traces par sport, période et comparaison'
          }
          badge={{
            label: state.personalHeatmap?.enabled ? 'Actif' : 'Ouvrir',
            tone: state.personalHeatmap?.enabled ? 'good' : 'muted',
          }}
          onClick={() => state.setHeatmapSubDrawer('personal')}
        />
      </XpRows>

      <XpEyebrow>Fonds nationaux officiels</XpEyebrow>
      {!iso ? (
        <XpEmpty
          title="Choisis un pays"
          hint="Les fonds nationaux sont propres à chaque pays. Ouvre un pays pour voir les sources officielles déclarées."
        />
      ) : nationalSources.length === 0 ? (
        <XpEmpty
          title="Aucun fond national déclaré"
          hint={`Aucune source officielle n’est déclarée pour ${ctx.country?.name ?? iso}. Les fonds Relief 3D, Satellite et Plan restent disponibles.`}
        />
      ) : (
        <XpRows>
          {nationalSources.map((source) => {
            const verified = nationalVerified?.id === source.id;
            return (
              <XpRow
                key={source.id}
                icon="map"
                title={source.label}
                sub={
                  verified
                    ? `${source.provider} · ${source.licence}`
                    : `${source.provider} · ${source.licence} · ${source.note}`
                }
                badge={{
                  label: verified ? 'Disponible' : 'À confirmer',
                  tone: verified ? 'good' : 'muted',
                }}
                disabled={!verified}
                onClick={verified ? () => state.setMapBaseStyle('national') : undefined}
              />
            );
          })}
        </XpRows>
      )}
      {nationalSources.some((source) => source.status !== 'verified') ? (
        <p className="xp-layer-note">
          Aucune tuile nationale n’est chargée tant que l’accès et la couverture ne sont pas
          confirmés.
        </p>
      ) : null}

      <XpEyebrow>Éléments visibles</XpEyebrow>
      <XpRows>
        <XpRow
          icon="flag"
          title="Marqueurs de distance"
          sub={distanceSub}
          badge={distanceBadge}
          disabled={
            distance.status !== 'ready' || distance.count === 0 || !routesVisible
          }
          onClick={
            distance.status === 'ready' && distance.count > 0 && routesVisible
              ? () => state.toggleLayer('distanceMarkers')
              : undefined
          }
        />
        <XpRow
          icon="route"
          title="Itinéraires et sentiers"
          sub={
            ctx.routes.length > 0
              ? `GR®, PR, itinéraires · ${ctx.routes.length} disponibles`
              : 'Aucun itinéraire dans cette zone'
          }
          badge={layerBadge('routes', ctx.routes.length)}
          disabled={ctx.routes.length === 0}
          onClick={ctx.routes.length > 0 ? () => state.toggleLayer('routes') : undefined}
        />
        <XpRow
          icon="drop"
          title="Points d’eau"
          sub={
            waterCount > 0
              ? `Sources et fontaines · ${waterCount} repères`
              : 'Aucun point d’eau répertorié ici'
          }
          badge={layerBadge('water', waterCount)}
          disabled={waterCount === 0}
          onClick={waterCount > 0 ? () => state.toggleLayer('water') : undefined}
        />
        <XpRow
          icon="house"
          title="Refuges, abris et bivouacs"
          sub={
            refugeCount > 0
              ? `Gardiennage et règles · ${refugeCount} spots`
              : 'Aucun refuge ni bivouac répertorié ici'
          }
          badge={layerBadge('refuges', refugeCount)}
          disabled={refugeCount === 0}
          onClick={refugeCount > 0 ? () => state.toggleLayer('refuges') : undefined}
        />
        <XpRow
          icon="mtn"
          title="Sommets et belvédères"
          sub={
            summitCount > 0
              ? `Point de vue et altitude · ${summitCount} repères`
              : 'Aucun sommet ni belvédère répertorié ici'
          }
          badge={layerBadge('summits', summitCount)}
          disabled={summitCount === 0}
          onClick={summitCount > 0 ? () => state.toggleLayer('summits') : undefined}
        />
        <XpRow
          icon="pin"
          title="Accès et départs"
          sub={
            accessCount > 0
              ? `Parkings, gares et têtes de sentier · ${accessCount} repères`
              : 'Aucun accès répertorié ici'
          }
          badge={layerBadge('access', accessCount)}
          disabled={accessCount === 0}
          onClick={accessCount > 0 ? () => state.toggleLayer('access') : undefined}
        />
        <XpRow
          icon="alert"
          tone="bad"
          title="Dangers signalés"
          sub={
            dangerCount > 0
              ? `Névés, éboulements, crues · ${dangerCount} alertes`
              : 'Aucun danger signalé ici'
          }
          badge={layerBadge('dangers', dangerCount)}
          disabled={dangerCount === 0}
          onClick={dangerCount > 0 ? () => state.toggleLayer('dangers') : undefined}
        />
        {/* K3.10 — Services et ateliers vélo OSM (Overpass à la demande). */}
        <XpRow
          icon="bike"
          title="Services, locations, réparation & VAE"
          sub={
            layers.bikePois !== true
              ? 'Boutiques, locations, bornes de réparation et recharge (OSM ODbL)'
              : overlays?.bikePoisStatus === 'loading'
                ? 'Interrogation OpenStreetMap sur l’emprise…'
                : overlays?.bikePoisStatus === 'zoom_required'
                  ? 'Zoome sur une zone ≤ 400 km² pour charger les services vélo'
                  : overlays?.bikePoisStatus === 'ready'
                    ? `${overlays.bikePoisCount} service${overlays.bikePoisCount > 1 ? 's' : ''} vélo dans l’emprise`
                    : 'Serveur OSM Overpass momentanément indisponible'
          }
          badge={
            layers.bikePois !== true
              ? { label: 'Masqué', tone: 'muted' }
              : overlays?.bikePoisStatus === 'loading'
                ? { label: 'Chargement', tone: 'warn' }
                : overlays?.bikePoisStatus === 'zoom_required'
                  ? { label: 'Zoomer', tone: 'warn' }
                  : overlays?.bikePoisStatus === 'ready'
                    ? { label: `${overlays.bikePoisCount}`, tone: 'good' }
                    : { label: 'Indisponible', tone: 'warn' }
          }
          onClick={() => state.toggleLayer('bikePois')}
        />
        <XpRow
          icon="hike"
          title="Itinéraires pédestres (K3.03)"
          sub="GR®, PR et sentiers pédestres"
          badge={{ label: layers.walkRoutes !== false ? 'Actif' : 'Masqué', tone: layers.walkRoutes !== false ? 'good' : 'muted' }}
          onClick={() => state.toggleLayer('walkRoutes')}
        />
        <XpRow
          icon="bike"
          title="Itinéraires cyclables (K3.03)"
          sub="EuroVelo, voies vertes et boucles VTT / route"
          badge={{ label: layers.bikeRoutes !== false ? 'Actif' : 'Masqué', tone: layers.bikeRoutes !== false ? 'good' : 'muted' }}
          onClick={() => state.toggleLayer('bikeRoutes')}
        />
        <XpRow
          icon="star"
          title="Mes lieux enregistrés (K3.11)"
          sub={
            overlays?.savedPlacesCount
              ? `${overlays.savedPlacesCount} lieu${overlays.savedPlacesCount > 1 ? 'x' : ''} enregistré${overlays.savedPlacesCount > 1 ? 's' : ''}`
              : 'Épingle tes points favoris depuis leur fiche repère'
          }
          badge={{
            label: layers.savedPlaces === true ? 'Actif' : 'Masqué',
            tone: layers.savedPlaces === true ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('savedPlaces')}
        />
        <XpRow
          icon="spark"
          title="Highlights & points forts (K5.13)"
          sub={
            overlays?.highlightsCount
              ? `${overlays.highlightsCount} point${overlays.highlightsCount > 1 ? 's' : ''} fort${overlays.highlightsCount > 1 ? 's' : ''} visible${overlays.highlightsCount > 1 ? 's' : ''}`
              : 'Points remarquables de la communauté'
          }
          badge={{
            label: layers.highlights !== false ? 'Actif' : 'Masqué',
            tone: layers.highlights !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('highlights')}
        />
        <XpRow
          icon="alert"
          tone="bad"
          title="Feux actifs & alertes (K3.14)"
          sub={
            layers.fires !== true
              ? 'Hotspots NASA FIRMS en temps réel (si clé configurée)'
              : overlays?.firesStatus === 'loading'
                ? 'Interrogation NASA FIRMS…'
                : overlays?.firesStatus === 'ready'
                  ? `${overlays.firesCount} hotspot${overlays.firesCount > 1 ? 's' : ''} (${overlays.firesSource ?? 'FIRMS'})`
                  : 'Source feux indisponible (clé NASA_FIRMS_MAP_KEY non configurée)'
          }
          badge={
            layers.fires !== true
              ? { label: 'Masqué', tone: 'muted' }
              : overlays?.firesStatus === 'loading'
                ? { label: 'Chargement', tone: 'warn' }
                : overlays?.firesStatus === 'ready'
                  ? { label: `${overlays.firesCount}`, tone: 'bad' }
                  : { label: 'Indisponible', tone: 'muted' }
          }
          onClick={() => state.toggleLayer('fires')}
        />
        <XpRow
          icon="cloud"
          title="Neige et avalanche"
          sub="Aucune couche neige importée dans cette version"
          badge={{ label: 'Indisponible', tone: 'muted' }}
          disabled
        />
        <XpRow
          icon="alert"
          tone="warn"
          title="Feux et zones brûlées"
          sub={
            layers.fire !== false
              ? 'Superposition active lorsqu’une source d’incidents est chargée'
              : 'Calque feux masqué sur la carte'
          }
          badge={
            layers.fire !== false
              ? { label: 'Actif', tone: 'good' }
              : { label: 'Masqué', tone: 'muted' }
          }
          onClick={() => state.toggleLayer('fire')}
        />
      </XpRows>
      <SavedPlacesPanel ctx={ctx} />
      <p className="xp-layer-note">
        Les marqueurs de distance sont calculés sur le tracé réel de l’itinéraire
        sélectionné, tous les {distance.intervalLabel}. Aucune distance n’est stockée
        ni estimée sur un tracé absent ; les repères masqués ne sont plus dessinés.
        Tracés et repères : © OpenStreetMap contributors (ODbL).
      </p>

      <XpEyebrow>Couches terrain</XpEyebrow>
      <XpRows>
        <XpRow
          icon="cube"
          title="Relief 3D (K3.06)"
          sub="Modèle numérique de terrain AWS Terrarium"
          badge={{ label: layers.terrain3d !== false ? 'Actif' : 'Masqué', tone: layers.terrain3d !== false ? 'good' : 'muted' }}
          onClick={() => state.toggleLayer('terrain3d')}
        />
        <XpRow
          icon="mtn"
          title="Ombres portées / hillshade (K3.06)"
          sub="Estompage du relief sur fond vectoriel"
          badge={{ label: layers.hillshade !== false ? 'Actif' : 'Masqué', tone: layers.hillshade !== false ? 'good' : 'muted' }}
          onClick={() => state.toggleLayer('hillshade')}
        />
        <XpRow
          icon="mtn"
          title="Pente de l’itinéraire"
          sub={slopeSub}
          badge={slopeBadge}
          disabled={!slope.hasRoute}
          onClick={slope.hasRoute ? () => state.toggleLayer('slope') : undefined}
        />
        <XpRow
          icon="layers"
          title="Surface du sol (K3.04)"
          sub={surfaceLiveSub}
          badge={surfaceLiveBadge}
          onClick={() => state.toggleLayer('surfaceLayer')}
        />
        <XpRow
          icon="route"
          title="Hors-route"
          sub={
            activityRouteReady
              ? offRoute
                ? `Écart signalé · ${Math.round(state.activity?.offRouteM ?? 0)} m`
                : 'Seuil 40 m / 15 s · retour sous 25 m'
              : 'Actif pendant une sortie avec itinéraire'
          }
          badge={{
            label: offRoute ? 'Écart' : activityRouteReady ? 'En veille' : 'Inactif',
            tone: offRoute ? 'bad' : 'muted',
          }}
          disabled
        />
      </XpRows>
      <p className="xp-layer-note">
        Marche, vélo de route, gravel et VTT partagent ces couches. Les surfaces sont lues depuis les
        tags OSM existants sans invention de données manquantes.
      </p>

      <XpEyebrow>Contribution carte &amp; accès (K3.13)</XpEyebrow>
      <ReportMapErrorPanel ctx={ctx} />

      <XpEyebrow>Zone hors ligne</XpEyebrow>
      <XpRows>
        <XpRow
          icon="offline"
          title="Télécharger la zone"
          sub="Tuiles, repères et tracés stockés sur l’appareil"
          onClick={() => state.setSheet('offline', 'mid')}
        />
      </XpRows>
    </>
  );
}

function formatEstimateDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function downloadRouteGpx(title: string, gpxXml: string) {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'itineraire'}.gpx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TrailTraceTab({
  ctx,
  route,
  positions,
}: {
  ctx: SheetContext;
  route: SheetContext['routes'][number] | undefined;
  positions: Array<[number, number]>;
}) {
  const activeSport = explorerSportToRouteSport(ctx.state.searchSport);
  const [profile, setProfile] = React.useState<ProfilePayload | null>(null);
  const [speedKmH, setSpeedKmH] = React.useState<number>(() => defaultSpeedKmHForSport(activeSport));
  const [customPace, setCustomPace] = React.useState(false);
  const [ebike, setEbike] = React.useState(false);
  const [selectedClimbId, setSelectedClimbId] = React.useState<string | null>(null);

  const nearbyWater = ctx.pois.filter((p) => p.kind === 'water');
  const nearbyRefuges = ctx.pois.filter((p) => p.kind === 'refuge');

  const analysis = React.useMemo(
    () =>
      buildExplorerRouteAnalysis({
        positions,
        profilePoints: profile?.points ?? null,
        sport: activeSport,
        speedKmH: customPace ? speedKmH : null,
        ebike,
        explorerWeather: ctx.weather,
      }),
    [positions, profile, activeSport, customPace, speedKmH, ebike, ctx.weather],
  );

  const openCopyInPlanner = (_options?: { avoidSteps?: boolean; avoidFerries?: boolean }) => {
    if (positions.length < 2) return;
    const copied = copyRouteToDraft({
      sourceId: String(route?.id ?? 'route'),
      name: route?.name ?? 'Itinéraire',
      geojson: route?.geojson ?? { type: 'LineString', coordinates: positions },
      sport: activeSport,
      distanceKm: route?.distance_km ?? null,
    });
    if (!copied) return;
    ctx.state.patch({
      plannerDraft: copied.draft,
      plannerTitle: copied.name,
      plannerLibraryId: null,
      plannerMapPick: false,
    });
    ctx.state.openSubSheet('planner', 'full');
  };

  if (!route) {
    return <XpEmpty title="Aucune trace sélectionnée" hint="Choisis un itinéraire sur la carte." />;
  }

  return (
    <>
      {positions.length > 1 ? (
        <ElevationProfile
          positions={positions}
          onProfileLoaded={setProfile}
          onCursorChange={(pt) => ctx.state.patch({ profileCursor: pt })}
          climbs={analysis.climbs?.climbs ?? []}
          surfaces={analysis.surfaces}
          highlightedClimbId={selectedClimbId}
          onSelectClimb={(climb) => {
            if (!climb) {
              setSelectedClimbId(null);
              ctx.state.patch({ highlightedSegment: null });
              return;
            }
            const nextId = selectedClimbId === climb.id ? null : climb.id;
            setSelectedClimbId(nextId);
            if (!nextId || positions.length < 2) {
              ctx.state.patch({ highlightedSegment: null });
              return;
            }
            const totalM = Math.max(1, profile?.distance_m ?? (route.distance_km ?? 1) * 1000);
            const i0 = Math.max(0, Math.floor((climb.fromM / totalM) * (positions.length - 1)));
            const i1 = Math.min(positions.length - 1, Math.ceil((climb.toM / totalM) * (positions.length - 1)));
            ctx.state.patch({
              highlightedSegment: {
                coordinates: positions.slice(i0, Math.max(i0 + 2, i1 + 1)),
                label: climb.categoryLabel,
              },
            });
          }}
        />
      ) : null}

      <XpMetrics
        items={[
          { label: 'Distance', value: route.distance_km ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : '—' },
          {
            label: 'D+',
            value: profile
              ? `${Math.round(profile.gain_m)} m`
              : typeof (route as { dplus_m?: number }).dplus_m === 'number'
                ? `${Math.round((route as { dplus_m?: number }).dplus_m!)} m`
                : '—',
          },
          {
            label: 'Durée est.',
            value: formatEstimateDuration(analysis.difficulty.duration.seconds),
          },
          {
            label: 'Difficulté',
            value: analysis.difficulty.status === 'unavailable' ? 'Partielle' : analysis.difficulty.levelLabel,
          },
        ]}
      />

      <div className="xp-chiprow" aria-label="Actions itinéraire">
        <button
          type="button"
          className="xp-chip"
          onClick={() => openCopyInPlanner()}
        >
          Copier et modifier
        </button>
        <button
          type="button"
          className="xp-chip"
          onClick={() => {
            ctx.state.patch({ activeMultiDayPlan: null });
            ctx.state.openSubSheet('multiday', 'full');
          }}
        >
          Découper en étapes
        </button>
        <button
          type="button"
          className="xp-chip"
          onClick={() => {
            const copied = copyRouteToDraft({
              sourceId: String(route.id),
              name: route.name ?? 'Itinéraire',
              geojson: route.geojson ?? { type: 'LineString', coordinates: positions },
              sport: activeSport,
              distanceKm: route.distance_km ?? null,
            });
            if (!copied) return;
            downloadRouteGpx(
              route.name ?? 'itineraire',
              gpxFromRouteDraft(route.name ?? 'Itinéraire', copied.draft.points, copied.draft.geometry),
            );
            ctx.state.showToast({ title: 'GPX généré depuis la trace réelle' });
          }}
        >
          Exporter GPX
        </button>
      </div>

      <XpEyebrow>Effort &amp; rythme personnel</XpEyebrow>
      <div className="xp-chiprow" aria-label="Ajuster l'allure personnelle">
        {[3.5, 4.5, 12, 20].map((v) => (
          <button
            key={v}
            type="button"
            className="xp-chip"
            aria-pressed={customPace && speedKmH === v}
            onClick={() => {
              setSpeedKmH(v);
              setCustomPace(true);
            }}
          >
            {String(v).replace('.', ',')} km/h
          </button>
        ))}
        {ebikeSupportedForSport(activeSport) ? (
          <button
            type="button"
            className="xp-chip"
            aria-pressed={ebike}
            onClick={() => setEbike((prev) => !prev)}
          >
            VAE {ebike ? 'actif' : 'off'}
          </button>
        ) : null}
        {customPace ? (
          <button
            type="button"
            className="xp-chip"
            onClick={() => {
              setCustomPace(false);
              setSpeedKmH(defaultSpeedKmHForSport(activeSport));
            }}
          >
            Standard
          </button>
        ) : null}
      </div>
      <p className="xp-layer-note">
        Score {analysis.difficulty.score}/100 ({analysis.difficulty.effortKm} km-effort) · Base :{' '}
        {analysis.difficulty.duration.personalized ? 'rythme personnel' : 'barème sport standard'}.
      </p>

      <XpEyebrow>Revêtement &amp; surfaces</XpEyebrow>
      {analysis.surfaces.status === 'unavailable' ? (
        <XpEmpty
          title="Surfaces non importées"
          hint="Aucune donnée OSM trail_segments associée à ce tracé ; aucun pourcentage n’est estimé."
        />
      ) : (
        <XpRows>
          {analysis.surfaces.shares.map((share) => (
            <XpRow
              key={share.category}
              icon="layers"
              title={share.category}
              sub={`${Math.round(share.lengthM)} m`}
              badge={{ label: `${Math.round(share.ratio * 100)} %`, tone: 'good' }}
            />
          ))}
        </XpRows>
      )}

      <XpEyebrow>Montées et descentes</XpEyebrow>
      {!profile ? (
        <XpEmpty title="Analyse du relief en cours…" hint="Calcul des côtes dès réception du profil DEM." />
      ) : (analysis.climbs?.climbs.length ?? 0) === 0 ? (
        <XpEmpty title="Aucune montée marquée" hint="Le profil ne dépasse pas le seuil de côte du sport." />
      ) : (
        <XpRows>
          {analysis.climbs!.climbs.map((climb) => (
            <XpRow
              key={climb.id}
              icon="climb"
              tone={selectedClimbId === climb.id ? 'good' : 'ink'}
              title={`Montée ${(climb.lengthM / 1000).toFixed(1).replace('.', ',')} km · +${Math.round(climb.gainM)} m`}
              sub={`Pente moy. ${climb.avgGradePct.toFixed(1)} % (max ${climb.maxGradePct.toFixed(1)} %)`}
              badge={{ label: climb.categoryLabel, tone: selectedClimbId === climb.id ? 'good' : 'muted' }}
              onClick={() => {
                const nextId = selectedClimbId === climb.id ? null : climb.id;
                setSelectedClimbId(nextId);
                if (!nextId) {
                  ctx.state.patch({ highlightedSegment: null });
                  return;
                }
                const totalM = Math.max(1, profile.distance_m);
                const i0 = Math.max(0, Math.floor((climb.fromM / totalM) * (positions.length - 1)));
                const i1 = Math.min(positions.length - 1, Math.ceil((climb.toM / totalM) * (positions.length - 1)));
                ctx.state.patch({
                  highlightedSegment: {
                    coordinates: positions.slice(i0, Math.max(i0 + 2, i1 + 1)),
                    label: climb.categoryLabel,
                  },
                });
              }}
            />
          ))}
        </XpRows>
      )}

      <XpEyebrow>Alertes tracé</XpEyebrow>
      {analysis.alerts.alerts.length === 0 ? (
        <XpRows>
          <XpRow
            icon="check"
            tone="good"
            title={
              analysis.alerts.status === 'partial'
                ? 'Aucun aller-retour détecté'
                : 'Aucune alerte détectée'
            }
            sub={
              analysis.alerts.checked.stairs && analysis.alerts.checked.ferry
                ? 'Escaliers, ferries et détours vérifiés'
                : 'Détours géométriques vérifiés · tags escaliers/ferries non fournis sur cette trace'
            }
            badge={{ label: analysis.alerts.status === 'partial' ? 'Partiel' : 'OK', tone: 'muted' }}
          />
        </XpRows>
      ) : (
        <XpRows>
          {analysis.alerts.alerts.map((al) => (
            <XpRow
              key={al.id}
              icon="alert"
              tone={al.severity === 'warning' ? 'warn' : 'ink'}
              title={al.message}
              sub={al.evidence}
              badge={
                al.recalculable
                  ? { label: 'Éviter', tone: 'warn' }
                  : undefined
              }
              onClick={
                al.suggestedAction === 'avoid_steps'
                  ? () => openCopyInPlanner({ avoidSteps: true })
                  : al.suggestedAction === 'avoid_ferry'
                    ? () => openCopyInPlanner({ avoidFerries: true })
                    : undefined
              }
            />
          ))}
        </XpRows>
      )}

      <XpEyebrow>Couches et affichage</XpEyebrow>
      <XpRows>
        <XpRow
          icon="layers"
          title="Éléments visibles"
          sub={`Fond, repères et marqueurs de distance (${ctx.units === 'imperial' ? 'mi' : 'km'})`}
          onClick={() => ctx.state.openLayers()}
        />
      </XpRows>

      <XpEyebrow>Points d’eau et abris sur la trace</XpEyebrow>
      {nearbyWater.length > 0 || nearbyRefuges.length > 0 ? (
        <XpRows>
          {nearbyWater.slice(0, 4).map((poi) => (
            <XpRow
              key={poi.id}
              icon="drop"
              tone="water"
              title={poi.name}
              sub={[formatElevation(poi.ele_m), poi.potable ? 'potable' : 'eau de source'].filter(Boolean).join(' · ')}
              onClick={() => ctx.state.select({ kind: 'water', id: poi.id }, 'water', 'mid')}
            />
          ))}
          {nearbyRefuges.slice(0, 3).map((poi) => (
            <XpRow
              key={poi.id}
              icon="house"
              title={poi.name}
              sub={[formatElevation(poi.ele_m), poi.capacity ? `${poi.capacity} places` : 'refuge gardé'].filter(Boolean).join(' · ')}
              onClick={() => ctx.state.select({ kind: 'refuge', id: poi.id }, 'refuge', 'mid')}
            />
          ))}
        </XpRows>
      ) : (
        <XpEmpty title="Points d'eau en cours d'indexation" hint="Sources et torrents répertoriés le long de la vallée." />
      )}
    </>
  );
}

function TrailConditionsTab({
  ctx,
  route,
  positions,
}: {
  ctx: SheetContext;
  route: SheetContext['routes'][number] | undefined;
  positions: Array<[number, number]>;
}) {
  const [departureMode, setDepartureMode] = React.useState<'now' | 'tomorrow7'>('now');
  const startAtIso = React.useMemo(() => {
    const base = new Date();
    if (departureMode === 'tomorrow7') {
      base.setDate(base.getDate() + 1);
      base.setHours(7, 0, 0, 0);
    }
    return base.toISOString();
  }, [departureMode]);

  const analysis = React.useMemo(
    () =>
      buildExplorerRouteAnalysis({
        positions,
        sport: explorerSportToRouteSport(ctx.state.searchSport),
        explorerWeather: ctx.weather,
        startAtIso,
      }),
    [positions, ctx.state.searchSport, ctx.weather, startAtIso],
  );

  const fireVisible = ctx.state.layerVisibility?.fire !== false;
  const netLabel =
    route?.network === 'iwn'
      ? 'GR® international'
      : route?.network === 'nwn'
        ? 'Réseau national (GR®)'
        : route?.network === 'rwn'
          ? 'Réseau régional (PR / LAW)'
          : route?.network === 'lwn'
            ? 'Sentier local balisé'
            : 'Balisage terrain à vérifier sur place';

  const wx = analysis.weather;

  return (
    <>
      <XpEyebrow>Heure de départ &amp; météo horodatée</XpEyebrow>
      <div className="xp-chiprow" aria-label="Choisir l'heure de départ">
        <button
          type="button"
          className="xp-chip"
          aria-pressed={departureMode === 'now'}
          onClick={() => setDepartureMode('now')}
        >
          Départ maintenant
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={departureMode === 'tomorrow7'}
          onClick={() => setDepartureMode('tomorrow7')}
        >
          Demain 07h00
        </button>
      </div>

      {wx && wx.samples.length > 0 ? (
        <XpRows>
          <XpRow
            icon="cloud"
            title={
              wx.summary.minTemperatureC !== null && wx.summary.maxTemperatureC !== null
                ? `${Math.round(wx.summary.minTemperatureC)}° à ${Math.round(wx.summary.maxTemperatureC)} °C`
                : 'Prévisions horodatées'
            }
            sub={`Vent max ${wx.summary.maxWindKmH ?? '—'} km/h · Pluie : ${wx.summary.rainRisk} · Orage : ${wx.summary.stormRisk}`}
            badge={{ label: `${wx.coverage.withForecast}/${wx.coverage.samples} pts`, tone: wx.coverage.ratio > 0 ? 'good' : 'muted' }}
          />
          {wx.samples.slice(0, 4).map((sample, idx) => (
            <XpRow
              key={`${sample.distanceM}-${idx}`}
              icon="clock"
              title={`${(sample.distanceM / 1000).toFixed(1).replace('.', ',')} km · ${
                sample.etaIso
                  ? new Date(sample.etaIso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '—'
              }`}
              sub={
                sample.status === 'forecast'
                  ? `${sample.temperatureC !== null ? `${Math.round(sample.temperatureC)} °C` : '—'} · vent ${sample.windKmH ?? '—'} km/h · ${sample.condition ?? 'prévision'}`
                  : 'Heure hors fenêtre de prévision'
              }
              badge={{ label: sample.status === 'forecast' ? 'MET No' : 'Manquant', tone: sample.status === 'forecast' ? 'muted' : 'warn' }}
            />
          ))}
        </XpRows>
      ) : (
        <XpEmpty
          title="Prévisions horodatées indisponibles"
          hint="Les séries MET Norway se chargent dès que la trace est centrée."
        />
      )}

      {wx ? (
        <p className="xp-layer-note">
          Alertes météo officielles : {wx.officialAlerts.message}
        </p>
      ) : null}

      <XpEyebrow>Feux actifs &amp; zones brûlées</XpEyebrow>
      <XpRows>
        <XpRow
          icon="alert"
          tone={analysis.fire.status === 'alerts' ? 'bad' : 'warn'}
          title={
            analysis.fire.status === 'unavailable'
              ? 'Source feux non connectée'
              : analysis.fire.status === 'clear'
                ? 'Aucun feu actif recoupé'
                : `${analysis.fire.impacts.length} zone(s) à proximité`
          }
          sub={
            analysis.fire.status === 'unavailable'
              ? 'État explicitement indisponible (aucune donnée active sans flux EFFIS/NASA FIRMS).'
              : `Calque feux : ${fireVisible ? 'visible' : 'masqué'}`
          }
          badge={{ label: fireVisible ? 'Calque actif' : 'Masqué', tone: fireVisible ? 'good' : 'muted' }}
          onClick={() => ctx.state.toggleLayer('fire')}
        />
        <XpRow
          icon="route"
          title={route?.ref ? `Réseau ${route.ref}` : 'Itinéraire tracé'}
          sub={netLabel}
        />
      </XpRows>
    </>
  );
}

function ToolsTabs(ctx: SheetContext, kind: string): SheetTab[] {
  if (kind === 'layers') {
    return [
      {
        id: 'calques',
        label: 'Calques',
        icon: 'layers',
        render: () => <LayersTab ctx={ctx} />,
      },
    ];
  }
  if (kind === 'offline') {
    return [
      {
        id: 'hors-ligne',
        label: 'Hors ligne',
        icon: 'offline',
        render: () => <OfflineTab ctx={ctx} />,
      },
    ];
  }
  if (kind === 'trail') {
    const route = ctx.routes.find((item) => String(item.id) === ctx.state.selection?.id) ?? ctx.routes[0];
    const positions: Array<[number, number]> = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        positions.push([value[0] as number, value[1] as number]);
        return;
      }
      for (const child of value) walk(child);
    };
    walk((route?.geojson as { coordinates?: unknown } | undefined)?.coordinates);

    const routePack = route
      ? (ctx.offline?.installedPacks ?? []).find((p) => p.manifest.routeId === String(route.id)) ?? null
      : null;
    return [
      {
        id: 'trace',
        label: 'Trace',
        icon: 'route',
        render: () =>
          route ? (
            <>
              <TrailTraceTab ctx={ctx} route={route} positions={positions} />
              {ctx.guidance && ctx.state.trailRoute?.id === String(route.id) ? (
                <JoinStartCard
                  evaluation={ctx.guidance.state.departureEvaluation}
                  externalLinks={ctx.guidance.state.externalLinks}
                  accessPlan={ctx.guidance.state.accessPlan}
                  onAction={(action) => {
                    if (action === 'start_at_origin' || action === 'start_here_on_route') {
                      const fallbackSport = ctx.state.activity?.sport ?? 'rando';
                      ctx.onStartSport?.(fallbackSport);
                      return;
                    }
                    ctx.guidance?.onSelectDepartureAction(action);
                  }}
                />
              ) : null}
              <XpEyebrow>Hors ligne · Itinéraire</XpEyebrow>
              <XpRows>
                <XpRow
                  icon="offline"
                  tone={routePack ? 'good' : undefined}
                  title={
                    routePack
                      ? 'Itinéraire disponible hors ligne'
                      : 'Télécharger l’itinéraire hors ligne'
                  }
                  sub={
                    routePack
                      ? `Trace, manœuvres TBT (${routePack.capabilities.followInstructions.status}) & repères vérifiés`
                      : 'Trace, instructions virage par virage, couloir et repères à venir'
                  }
                  badge={
                    routePack
                      ? { label: routePack.status === 'available' ? 'Prêt' : routePack.status, tone: 'good' }
                      : { label: 'Télécharger', tone: 'muted' }
                  }
                  onClick={() => {
                    if (routePack) {
                      ctx.offline?.onDeletePack(routePack.manifest.packId);
                      return;
                    }
                    if (ctx.offline) {
                      ctx.offline.onDownloadRoutePack({
                        id: route.id,
                        name: route.name,
                        geojson: route.geojson,
                      });
                    } else {
                      void getOfflineRuntimeStore().downloadRouteOfflinePack(
                        { id: route.id, name: route.name, geojson: route.geojson },
                        ctx.pois,
                      );
                    }
                  }}
                />
              </XpRows>
              <RouteExportButtons routeId={route.id} routeName={route.name} />
              <TrailCommunityPanel
                ctx={ctx}
                routeId={String(route.id)}
                routeTitle={route.name ?? 'Itinéraire'}
                routeLat={positions[0]?.[1] ?? null}
                routeLng={positions[0]?.[0] ?? null}
              />
            </>
          ) : (
            <XpEmpty title="Aucune trace sélectionnée" hint="Choisis un itinéraire sur la carte." />
          ),
      },
      {
        id: 'conditions',
        label: 'Conditions',
        icon: 'cloud',
        render: () => <TrailConditionsTab ctx={ctx} route={route} positions={positions} />,
      },
    ];
  }
  if (kind === 'depart') {
    return [
      {
        id: 'quand',
        label: 'Quand',
        icon: 'cal',
        render: () => <DepartForm ctx={ctx} />,
      },
    ];
  }
  if (kind === 'search') {
    return [
      {
        id: 'recherche',
        label: 'Recherche',
        icon: 'search',
        render: () => <SearchTab ctx={ctx} />,
      },
    ];
  }
  return [{ id: 'info', label: 'Infos', icon: 'info', render: () => <XpEmpty title="Rien à afficher" hint="Aucune donnée pour cet écran." /> }];
}

/**
 * Création d'un départ (P6-07). Écrit dans `trips` sous RLS : la requête
 * exige un utilisateur connecté, et le formulaire ne prétend rien créer
 * tant que ce n'est pas le cas.
 */
/**
 * Zone hors ligne (05_DONNEES §7) : estimation avant téléchargement, taille
 * réelle après, purge manuelle. Les tuiles partent dans le cache du service
 * worker, les repères et itinéraires dans IndexedDB.
 */
function OfflineTab({ ctx }: { ctx: SheetContext }) {
  const [fallbackPacks, setFallbackPacks] = React.useState(() =>
    getOfflineRuntimeStore().listInstalledPacks(),
  );
  const [fallbackProgress, setFallbackProgress] = React.useState<
    import('@/features/offline').OfflineDownloadProgress | null
  >(null);

  React.useEffect(() => {
    if (ctx.offline) return;
    void getOfflineRuntimeStore().hydrate().then(setFallbackPacks);
  }, [ctx.offline]);

  const packs = ctx.offline?.installedPacks ?? fallbackPacks;
  const progress = ctx.offline?.progress ?? fallbackProgress;
  const regions = React.useMemo(() => listPredefinedRegions(), []);
  const parentSheet = ctx.state.sheetParent?.sheet ?? 'level';
  const parentDetent = ctx.state.sheetParent?.detent ?? 'peek';
  const parentTab = ctx.state.sheetParent?.tab ?? 0;

  const activeRoutePack = ctx.state.trailRoute?.id
    ? getOfflineRuntimeStore().getInstalledRouteNavigationData(ctx.state.trailRoute.id)
    : null;
  const upcomingItems =
    ctx.state.trailRoute?.id && activeRoutePack
      ? getOfflineRuntimeStore().getUpcomingOfflinePois(ctx.state.trailRoute.id, 0)
      : undefined;

  return (
    <OfflinePacksScreen
      installedPacks={packs}
      returnContext={{
        parentSheet,
        parentDetent,
        parentTab,
        selectedRouteId: ctx.state.trailRoute?.id ?? null,
        cameraCenter: ctx.state.center,
        cameraZoom: ctx.state.zoom,
      }}
      regions={regions}
      progress={progress}
      routeData={activeRoutePack}
      routeName={ctx.state.trailRoute?.name ?? null}
      upcomingItems={upcomingItems}
      coverageViewport={{
        bounds: ctx.mapViewport
          ? {
              west: ctx.mapViewport.minLng,
              south: ctx.mapViewport.minLat,
              east: ctx.mapViewport.maxLng,
              north: ctx.mapViewport.maxLat,
            }
          : {
              west: ctx.state.center[0] - 0.1,
              south: ctx.state.center[1] - 0.08,
              east: ctx.state.center[0] + 0.1,
              north: ctx.state.center[1] + 0.08,
            },
        zoom: ctx.state.zoom,
      }}
      onDownloadRegion={(region) => {
        if (ctx.offline) {
          ctx.offline.onDownloadRegion(region);
          return;
        }
        void getOfflineRuntimeStore()
          .downloadOrResumeRegion(
            region,
            { pois: ctx.pois, routes: ctx.routes },
            { onProgress: setFallbackProgress },
          )
          .then(() => setFallbackPacks(getOfflineRuntimeStore().listInstalledPacks()));
      }}
      onResumeRegion={(region) => {
        if (ctx.offline) {
          ctx.offline.onDownloadRegion(region);
          return;
        }
        void getOfflineRuntimeStore()
          .downloadOrResumeRegion(
            region,
            { pois: ctx.pois, routes: ctx.routes },
            { onProgress: setFallbackProgress },
          )
          .then(() => setFallbackPacks(getOfflineRuntimeStore().listInstalledPacks()));
      }}
      onPausePack={(packId) => {
        if (ctx.offline) {
          ctx.offline.onPausePack(packId);
          return;
        }
        void getOfflineRuntimeStore().pausePack(packId);
      }}
      onDeletePack={(packId) => {
        if (ctx.offline) {
          ctx.offline.onDeletePack(packId);
          return;
        }
        void getOfflineRuntimeStore()
          .deletePack(packId)
          .then(() => setFallbackPacks(getOfflineRuntimeStore().listInstalledPacks()));
      }}
      onDownloadZones={(multi) => {
        if (ctx.offline) {
          ctx.offline.onDownloadZones(multi);
          return;
        }
        void getOfflineRuntimeStore()
          .downloadCustomZones(
            multi,
            { pois: ctx.pois, routes: ctx.routes },
            { onProgress: setFallbackProgress },
          )
          .then(() => setFallbackPacks(getOfflineRuntimeStore().listInstalledPacks()));
      }}
      onShowCoverage={(geoJson) => {
        ctx.offline?.onShowCoverage(geoJson);
      }}
      onLaunchShortcut={(deepLinkUri) => {
        ctx.offline?.onLaunchShortcut(deepLinkUri);
      }}
      onReturn={(restored) => {
        if (ctx.state.sheetParent) {
          ctx.state.patch({
            sheet: restored.parentSheet as never,
            detent: restored.parentDetent,
            tab: restored.parentTab,
            sheetParent: undefined,
          });
        } else {
          ctx.state.patch({ sheet: 'level', detent: 'peek' });
        }
      }}
    />
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

function DepartForm({ ctx }: { ctx: SheetContext }) {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const inAWeek = new Date(today.getTime() + 7 * 86400000);
  const [title, setTitle] = React.useState('');
  const [place, setPlace] = React.useState('');
  const [start, setStart] = React.useState(iso(inAWeek));
  const [end, setEnd] = React.useState(iso(new Date(inAWeek.getTime() + 2 * 86400000)));
  const [party, setParty] = React.useState(4);
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'created' | 'unauthenticated' | 'error'>('idle');

  const submit = async () => {
    setStatus('sending');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus('unauthenticated');
        ctx.state.showToast({ title: 'Connecte-toi pour créer un départ', tone: 'warn' });
        return;
      }
      const res = await fetch('/api/explorer/v2/trips', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.session?.user?.id,
          title: title.trim(),
          destination: place.trim() || undefined,
          countryCode: ctx.state.geo || undefined,
          startDate: start,
          endDate: end,
          partySize: party,
          activity: 'hiking',
        }),
      });
      if (!res.ok) {
        setStatus('error');
        ctx.state.showToast({ title: 'Départ non créé', sub: `HTTP ${res.status}`, tone: 'warn' });
        return;
      }
      setStatus('created');
      ctx.state.showToast({ title: 'Départ créé', sub: title.trim() });
    } catch {
      setStatus('error');
    }
  };

  const disabled = title.trim().length < 3 || status === 'sending';

  return (
    <>
      <div className="xp-form">
        <label>
          <span>Titre</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tour du Mont-Blanc en 4 jours" maxLength={120} />
        </label>
        <label>
          <span>Lieu</span>
          <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Chamonix" maxLength={160} />
        </label>
        <div className="xp-form-row">
          <label>
            <span>Début</span>
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            <span>Fin</span>
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <label>
          <span>Places</span>
          <input
            type="number"
            min={1}
            max={50}
            value={party}
            onChange={(event) => setParty(Number(event.target.value))}
          />
        </label>
      </div>
      <button type="button" className="xp-primary" onClick={submit} disabled={disabled}>
        {status === 'sending' ? 'Création…' : 'Créer le départ'}
      </button>
      {status === 'unauthenticated' ? (
        <XpEmpty title="Départ non créé" hint="Connecte-toi pour publier un départ." />
      ) : null}
      {status === 'created' ? (
        <XpEmpty title="Départ publié" hint="Il apparaît maintenant dans les départs ouverts." />
      ) : null}
      <XpEyebrow>Départs ouverts</XpEyebrow>
      <TripsTab ctx={ctx} where="autour d’ici" />
    </>
  );
}

function RouteSuggestions({ ctx }: { ctx: SheetContext }) {
  const sport = ctx.state.searchSport ?? null;
  const me = ctx.me;
  const position =
    ctx.state.locationPermission === 'granted' &&
    me !== null &&
    Number.isFinite(me.lat) &&
    Number.isFinite(me.lng)
      ? me
      : null;
  const { data, isFetching, isError, error, refetch } = useRouteSuggestions(
    position?.lat ?? null,
    position?.lng ?? null,
    sport,
    position !== null && sport !== null && ctx.state.online,
  );
  const searchError = error instanceof ExplorerSearchError ? error : null;
  const unknownSport = searchError?.reason === 'sport-inconnu';
  const patch = ctx.state.patch;
  const suggestedRoutes = data?.routes;
  const selectedSuggestionKept =
    ctx.state.selection?.kind === 'trail' &&
    (ctx.state.routeSuggestions ?? []).some(
      (route) => String(route.id) === ctx.state.selection?.id,
    );

  // Les suggestions vivent à part de `searchRoutes` : une recherche textuelle
  // ne doit jamais écraser les parcours trouvés autour de la position, et
  // inversement. Elles restent en mémoire de session, jamais persistées. Une
  // suggestion déjà ouverte n'est pas effacée pendant un rechargement.
  React.useEffect(() => {
    if (suggestedRoutes) {
      patch({ routeSuggestions: suggestedRoutes });
      return;
    }
    if (!selectedSuggestionKept) patch({ routeSuggestions: [] });
  }, [suggestedRoutes, selectedSuggestionKept, patch]);

  const label = sport && SPORT_META[sport] ? SPORT_META[sport].label : 'ce sport';

  return (
    <>
      <XpEyebrow>Autour de moi</XpEyebrow>
      <XpChips
        items={SPORT_FAMILIES.map((family) => ({ id: family.sport, label: family.label }))}
        value={sport ?? ''}
        onChange={(id) => patch({ searchSport: id as Sport })}
        ariaLabel="Sport des suggestions autour de moi"
      />
      {position === null ? (
        <XpEmpty
          title={
            ctx.state.locationPermission === 'denied'
              ? 'Position refusée'
              : 'Position non disponible'
          }
          hint="Les suggestions autour de toi ne s’affichent qu’avec une position autorisée. La carte et la recherche textuelle restent utilisables sans position."
          action={
            ctx.onRequestLocation ? (
              <button
                type="button"
                className="xp-secondary"
                onClick={() => ctx.onRequestLocation?.()}
              >
                Demander la position
              </button>
            ) : undefined
          }
        />
      ) : sport === null ? (
        <XpEmpty
          title="Choisis un sport"
          hint="Aucun sport n’est déduit de la carte ni de la position : choisis-le pour voir les parcours qui le concernent."
        />
      ) : !ctx.state.online ? (
        <XpEmpty
          title="Suggestions indisponibles hors ligne"
          hint="Les parcours autour de toi viennent de la base. Reviens en ligne pour les charger ; la recherche textuelle en cache reste consultable."
        />
      ) : isError ? (
        <XpEmpty
          title={unknownSport ? 'Sport inconnu' : 'Suggestions temporairement indisponibles'}
          hint={
            unknownSport
              ? 'Ce sport ne fait pas partie de la taxonomie de l’Explorer. Aucun autre sport n’est choisi à sa place.'
              : 'La base n’a pas répondu. Aucun résultat vide n’est affiché à la place d’une panne.'
          }
          action={
            unknownSport ? undefined : (
              <button type="button" className="xp-secondary" onClick={() => void refetch()}>
                Réessayer
              </button>
            )
          }
        />
      ) : isFetching && !data ? (
        <XpEmpty
          title={`Recherche autour de toi · ${label}`}
          hint={`Classement des parcours réels dans un rayon de ${SUGGESTION_RADIUS_KM} km.`}
        />
      ) : !data ? (
        <XpEmpty
          title="Suggestions en préparation"
          hint="La position et le sport sont prêts ; la requête n’a pas encore répondu."
        />
      ) : !data.supported ? (
        <XpEmpty
          title={`Aucun catalogue de parcours ${label.toLowerCase()}`}
          hint="Le catalogue disponible ne contient que des itinéraires de randonnée. Aucun parcours d’un autre sport n’est proposé, et la difficulté n’est pas déduite."
        />
      ) : data.routes.length === 0 ? (
        <XpEmpty
          title={`Aucun parcours à moins de ${data.radiusKm} km`}
          hint="Aucun itinéraire de randonnée du catalogue ne passe dans ce rayon autour de ta position. La recherche textuelle reste disponible."
        />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--xp-mut)' }}>
            {data.routes.length > 1 ? 'Itinéraires réels' : 'Itinéraire réel'} de randonnée ·
            tracé à moins de {data.radiusKm} km · difficulté non renseignée
          </p>
          <XpRows>
            {data.routes.map((route) => {
              const length =
                route.distance_km != null
                  ? `${route.distance_km.toFixed(1).replace('.', ',')} km`
                  : null;
              const network =
                route.network === 'iwn'
                  ? 'GR® international'
                  : route.network === 'nwn'
                    ? 'GR®'
                    : route.network === 'rwn'
                      ? 'PR'
                      : route.network === 'lwn'
                        ? 'Sentier local'
                        : null;
              const distance =
                route.distanceKm != null
                  ? `tracé à ${formatDistance(route.distanceKm)}`
                  : 'distance au tracé inconnue';
              return (
                <XpRow
                  key={`suggestion-${route.id}`}
                  icon="route"
                  title={route.name || `Itinéraire ${route.ref || route.id}`}
                  sub={[length, route.ref || network, distance].filter(Boolean).join(' · ')}
                  onClick={() =>
                    ctx.state.select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid')
                  }
                />
              );
            })}
          </XpRows>
          {data.truncated ? (
            <XpEmpty
              title="Suggestions tronquées"
              hint="La lecture est bornée à 60 parcours ; le classement ne porte que sur cette sélection."
            />
          ) : null}
        </>
      )}
    </>
  );
}

function SearchTab({ ctx }: { ctx: SheetContext }) {
  // La demande vit dans le store : fermer le tiroir puis déplacer la carte ne
  // doit pas perdre la recherche que « Rechercher dans cette zone » relance.
  const query = ctx.state.searchQuery ?? '';
  const requestedViewport = ctx.state.searchViewport ?? null;
  const overrides = ctx.state.searchOverrides ?? null;
  const [editingCriteria, setEditingCriteria] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const areaUnavailable = requestedViewport !== null && !isSearchableViewport(requestedViewport);
  const { data, isFetching, isError, error, refetch } = useNaturalSearch(
    query,
    ctx.state.center[1],
    ctx.state.center[0],
    requestedViewport,
    overrides,
  );
  const patch = ctx.state.patch;
  const mapViewport = ctx.mapViewport;

  const updateOverride = (next: Partial<SearchCriteriaOverrides>) => {
    patch({
      searchOverrides: {
        ...(overrides ?? {}),
        ...next,
      },
    });
  };

  // Préservation et restauration de la position de défilement (R03 / C-UI).
  React.useEffect(() => {
    const scrollEl = inputRef.current?.closest('.xp-sheet-scroll') as HTMLElement | null;
    if (!scrollEl) return;
    if (typeof ctx.state.searchScrollTop === 'number' && ctx.state.searchScrollTop > 0) {
      scrollEl.scrollTop = ctx.state.searchScrollTop;
    }
    const onScroll = () => {
      patch({ searchScrollTop: scrollEl.scrollTop });
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [patch, ctx.state.searchScrollTop]);

  // Les résultats affichés correspondent à cette emprise. Une recherche
  // explicite porte sa propre emprise (`data.zone`) ; une recherche autour du
  // centre retient l'emprise visible au moment de la réponse.
  React.useEffect(() => {
    if (!data) return;
    const reference = data.zone ?? mapViewport;
    if (!reference) return;
    patch({ searchReferenceViewport: reference });
  }, [data, mapViewport, patch]);

  // Les parcours et aventures multi-jours sont mémorisés avec les résultats.
  React.useEffect(() => {
    patch({
      searchRoutes: data?.routes ?? [],
      searchAdventures: data?.adventures ?? [],
    });
  }, [data?.routes, data?.adventures, patch]);

  const featuredAdventures = React.useMemo(
    () =>
      searchMultiDayPlans(
        buildExplorerCatalogAdventures(),
        { rawQuery: '' },
        { viewerId: null, friendIds: [], tribuIds: [], blockedUserIds: [] },
      )
        .items.slice(0, 2),
    [],
  );

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return {
      countries: q.length < 2 ? [] : ctx.countries.filter((country) => country.name.toLowerCase().includes(q)).slice(0, 4),
      pois: data?.results ?? [],
      routes: data?.routes ?? [],
      adventures: data?.adventures ?? [],
    };
  }, [ctx.countries, data, query]);

  const searchError = error instanceof ExplorerSearchError ? error : null;
  const zoneTooLarge = searchError?.reason === 'zone-too-large';
  const unavailableWhileOffline = !ctx.state.online && !data;
  const hasCenter =
    Number.isFinite(ctx.state.center[1]) && Number.isFinite(ctx.state.center[0]);
  const noResults =
    results.countries.length === 0 &&
    results.pois.length === 0 &&
    results.routes.length === 0 &&
    results.adventures.length === 0 &&
    !data?.routesUnavailable;

  return (
    <>
      <input
        ref={inputRef}
        className="xp-searchinput"
        value={query}
        onChange={(event) => patch({ searchQuery: event.target.value })}
        placeholder="Ex : boucle 15 km lac facile gare…"
        aria-label="Rechercher un lieu ou un parcours"
        style={{
          width: '100%',
          height: 38,
          borderRadius: 12,
          border: '0.5px solid rgba(23,43,36,.16)',
          padding: '0 12px',
          background: 'rgba(255,255,255,.7)',
          fontSize: 13,
        }}
      />
      <div className="xp-chiprow" aria-label="Création et boucles" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="xp-chip"
          onClick={() => ctx.state.openSubSheet('planner', 'full')}
        >
          Créer un itinéraire
        </button>
        <button
          type="button"
          className="xp-chip"
          onClick={() => ctx.state.openSubSheet('planner', 'full')}
        >
          Générer une boucle
        </button>
      </div>
      {query.trim().length < 2 ? (
        <>
          <RouteSuggestions ctx={ctx} />
          <ExplorerSegmentsSearchSection
            query={query}
            center={ctx.state.center}
            online={ctx.state.online}
          />
          {featuredAdventures.length > 0 ? (
            <>
              <XpEyebrow>Aventures multi-jours</XpEyebrow>
              <XpRows>
                {featuredAdventures.map((adv) => {
                  const advDist = adv.stages.reduce((acc, s) => acc + s.distanceKm, 0);
                  const advGain = adv.stages.reduce((acc, s) => acc + s.elevationGainM, 0);
                  return (
                    <XpRow
                      key={adv.id}
                      icon="map"
                      title={adv.title}
                      sub={`${adv.daysCount} jours · ${advDist.toFixed(0)} km · +${Math.round(advGain)} m`}
                      badge={{ label: `${adv.daysCount} j`, tone: 'good' }}
                      onClick={() => {
                        patch({ activeMultiDayPlan: adv });
                        ctx.state.openSubSheet('multiday', 'full');
                      }}
                    />
                  );
                })}
              </XpRows>
            </>
          ) : null}
          <p style={{ margin: 0, padding: '0 4px', fontSize: 11.5, color: 'var(--xp-mut)' }}>
            Tape deux lettres pour chercher un lieu, un parcours ou un repère dans toute la
            zone disponible.
          </p>
        </>
      ) : areaUnavailable ? (
        <XpEmpty
          title="Zoome pour chercher dans cette zone"
          hint="La recherche dans l’emprise visible demande une carte plus précise (zoom 12 minimum)."
        />
      ) : !hasCenter ? (
        <XpEmpty
          title="Recherche sans position"
          hint="Déplace la carte pour choisir une zone, puis relance la recherche."
        />
      ) : unavailableWhileOffline ? (
        <XpEmpty
          title="Recherche indisponible hors ligne"
          hint="La recherche interroge la base. Reviens en ligne pour la relancer ; les derniers résultats restent consultables."
        />
      ) : isFetching ? (
        <XpEmpty title="Recherche…" hint="Analyse de la demande et interrogation de la base." />
      ) : isError && !data ? (
        <XpEmpty
          title={
            zoneTooLarge
              ? 'Zoome pour chercher dans cette zone'
              : !ctx.state.online
                ? 'Recherche indisponible hors ligne'
                : 'Recherche temporairement indisponible'
          }
          hint={
            zoneTooLarge
              ? 'L’emprise demandée est trop vaste pour être interrogée sans un déplacement plus précis.'
              : 'La base n’a pas répondu. Aucun résultat vide n’est affiché à la place d’une panne.'
          }
          action={
            zoneTooLarge || !ctx.state.online ? undefined : (
              <button type="button" className="xp-secondary" onClick={() => void refetch()}>
                Réessayer
              </button>
            )
          }
        />
      ) : !data ? (
        <XpEmpty title="Recherche…" hint="Préparation de la requête." />
      ) : (
        <>
          {data?.filters ? (
            <>
              <XpEyebrow>Filtres compris</XpEyebrow>
              <div className="xp-chiprow" aria-label="Filtres extraits de la demande">
                {data.zone ? (
                  <span className="xp-chip" aria-pressed="true">
                    Emprise visible
                  </span>
                ) : null}
                <button
                  type="button"
                  className="xp-chip"
                  aria-pressed={editingCriteria}
                  onClick={() => setEditingCriteria((v) => !v)}
                >
                  {data.filters.kinds.map((kind) => POI_LABEL[kind] ?? kind).join(' · ')}
                </button>
                {data.filters.maxDistanceKm ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    {data.filters.maxDistanceKm} km max
                  </button>
                ) : null}
                {data.filters.maxDurationHours ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    ≤ {data.filters.maxDurationHours} h
                  </button>
                ) : null}
                {data.filters.routeType ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    {data.filters.routeType}
                  </button>
                ) : null}
                {data.filters.difficulty ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    {data.filters.difficulty}
                  </button>
                ) : null}
                {data.filters.surface ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    {data.filters.surface}
                  </button>
                ) : null}
                {data.filters.startAccess ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    accès {data.filters.startAccess}
                  </button>
                ) : null}
                {data.filters.easy ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    facile
                  </button>
                ) : null}
                {data.filters.family ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingCriteria((v) => !v)}
                  >
                    famille
                  </button>
                ) : null}
                <button
                  type="button"
                  className="xp-chip"
                  aria-pressed={editingCriteria}
                  onClick={() => setEditingCriteria((v) => !v)}
                >
                  {editingCriteria ? 'Fermer l’ajustement' : 'Corriger'}
                </button>
              </div>
              {editingCriteria ? (
                <div
                  style={{
                    margin: '6px 0 10px',
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,.72)',
                    border: '0.5px solid rgba(23,43,36,.12)',
                  }}
                >
                  <div className="xp-chiprow" aria-label="Distance maximale">
                    {[5, 10, 20, 35].map((km) => (
                      <button
                        key={km}
                        type="button"
                        className="xp-chip"
                        aria-pressed={data.filters.maxDistanceKm === km}
                        onClick={() => updateOverride({ maxDistanceKm: km })}
                      >
                        ≤ {km} km
                      </button>
                    ))}
                  </div>
                  <div className="xp-chiprow" aria-label="Difficulté et format" style={{ marginTop: 6 }}>
                    {(['facile', 'modere', 'difficile'] as ParsedDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        className="xp-chip"
                        aria-pressed={data.filters.difficulty === diff}
                        onClick={() => updateOverride({ difficulty: diff })}
                      >
                        {diff}
                      </button>
                    ))}
                    {(['boucle', 'aller-retour', 'traversee'] as ParsedRouteType[]).map((rt) => (
                      <button
                        key={rt}
                        type="button"
                        className="xp-chip"
                        aria-pressed={data.filters.routeType === rt}
                        onClick={() => updateOverride({ routeType: rt })}
                      >
                        {rt}
                      </button>
                    ))}
                  </div>
                  <div className="xp-chiprow" aria-label="Surface et accès" style={{ marginTop: 6 }}>
                    {(['route', 'chemin', 'sentier'] as ParsedSurface[]).map((surf) => (
                      <button
                        key={surf}
                        type="button"
                        className="xp-chip"
                        aria-pressed={data.filters.surface === surf}
                        onClick={() => updateOverride({ surface: surf })}
                      >
                        {surf}
                      </button>
                    ))}
                    {(['gare', 'bus', 'parking'] as ParsedStartAccess[]).map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        className="xp-chip"
                        aria-pressed={data.filters.startAccess === acc}
                        onClick={() => updateOverride({ startAccess: acc })}
                      >
                        {acc}
                      </button>
                    ))}
                    {overrides ? (
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() => patch({ searchOverrides: null })}
                      >
                        Réinitialiser
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {noResults ? (
            <XpEmpty
              title={requestedViewport ? 'Aucun résultat dans cette zone' : 'Aucun résultat'}
              hint={
                requestedViewport
                  ? 'Aucun pays, repère ni parcours ne correspond dans l’emprise visible. Déplace la carte ou corrige la demande.'
                  : 'Aucun pays, repère ni parcours ne correspond dans les données disponibles.'
              }
            />

          ) : (
            <>
              {results.countries.length > 0 ? (
                <>
                  <XpEyebrow>Pays</XpEyebrow>
                  <XpRows>
                    {results.countries.map((country) => (
                      <XpRow
                        key={country.iso}
                        icon="globe"
                        title={country.name}
                        sub={country.continent ?? undefined}
                        onClick={() =>
                          country.center && ctx.state.openCountry(country.iso, country.center, country.name)
                        }
                      />
                    ))}
                  </XpRows>
                </>
              ) : null}

              {results.adventures.length > 0 ? (
                <>
                  <XpEyebrow>Aventures multi-jours</XpEyebrow>
                  <XpRows>
                    {results.adventures.map((adv) => {
                      const advDist = adv.stages.reduce((acc, s) => acc + s.distanceKm, 0);
                      const advGain = adv.stages.reduce((acc, s) => acc + s.elevationGainM, 0);
                      return (
                        <XpRow
                          key={adv.id}
                          icon="map"
                          title={adv.title}
                          sub={`${adv.daysCount} jours · ${advDist.toFixed(0)} km · +${Math.round(advGain)} m`}
                          badge={{ label: `${adv.daysCount} j`, tone: 'good' }}
                          onClick={() => {
                            patch({ activeMultiDayPlan: adv });
                            ctx.state.openSubSheet('multiday', 'full');
                          }}
                        />
                      );
                    })}
                  </XpRows>
                </>
              ) : null}

              {results.pois.length > 0 ? (
                <>
                  <XpEyebrow>Repères</XpEyebrow>
                  <XpRows>
                    {results.pois.map((poi) => (
                      <XpRow
                        key={poi.id}
                        icon={POI_ICON[poi.kind] ?? 'pin'}
                        tone={POI_TONE[poi.kind] ?? 'ink'}
                        title={poi.name}
                        sub={`${POI_LABEL[poi.kind] ?? poi.kind} · ${
                          ctx.units === 'imperial' ? formatImperialDistance(poi.distanceKm) : formatDistance(poi.distanceKm)
                        }`}
                        badge={poi.ele_m ? { label: formatElevation(poi.ele_m) ?? '', tone: 'muted' } : undefined}
                        onClick={() => ctx.state.select({ kind: poi.kind as PoiKind, id: poi.id }, poi.kind as never, 'mid')}
                      />
                    ))}
                  </XpRows>
                </>
              ) : null}

              {results.routes.length > 0 ? (
                <>
                  <XpEyebrow>Parcours</XpEyebrow>
                  <XpRows>
                    {results.routes.map((route) => {
                      const length =
                        route.distance_km != null
                          ? `${route.distance_km.toFixed(1).replace('.', ',')} km`
                          : null;
                      const network =
                        route.network === 'iwn'
                          ? 'GR® international'
                          : route.network === 'nwn'
                            ? 'GR®'
                            : route.network === 'rwn'
                              ? 'PR'
                              : 'Sentier balisé';
                      const distance =
                        route.distanceKm != null ? `à ${formatDistance(route.distanceKm)}` : null;
                      const badgeLabel = route.matched
                        ? 'Nom cité'
                        : route.smartReasons?.[0] ?? (route.distance_km ? 'Circuit prêt' : null);
                      return (
                        <XpRow
                          key={`route-${route.id}`}
                          icon="route"
                          title={route.name || `Itinéraire ${route.ref ?? route.id}`}
                          sub={[length, route.ref ?? network, distance].filter(Boolean).join(' · ')}
                          badge={badgeLabel ? { label: badgeLabel, tone: 'good' } : undefined}
                          onClick={() =>
                            ctx.state.select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid')
                          }
                        />
                      );
                    })}
                  </XpRows>
                </>
              ) : null}

              {data.routesUnavailable ? (
                <XpEmpty
                  title="Parcours indisponibles"
                  hint="Le catalogue de parcours n’a pas répondu ; les repères restent affichés."
                />
              ) : null}
              {data.truncated || data.routesTruncated ? (
                <XpEmpty
                  title="Une partie des résultats est affichée"
                  hint="Zoome pour affiner l’emprise et voir les repères et parcours suivants."
                />
              ) : null}
            </>
          )}
          <ExplorerSegmentsSearchSection
            query={query}
            center={ctx.state.center}
            online={ctx.state.online}
          />
        </>
      )}
    </>
  );
}

/** Chrono qui avance, formaté mm:ss ou h:mm:ss. */
function useElapsed(startedAt: number | undefined): string {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return '0:00';
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Allure LKDV (même conversion que StatsSheet) : 500 s/km → 8'20". */
function formatPace(secondsPerKm: number): string {
  const total = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

export function LiveDirectTab({ ctx }: { ctx: SheetContext }) {
  const activity = ctx.state.activity;
  const elapsed = useElapsed(activity?.startedAt);
  if (!activity) {
    return <XpEmpty title="Aucune activité en cours" hint="Démarre une activité pour voir les métriques en direct." />;
  }
  const activeVariant = activity.selection?.variantId
    ? getSportVariant(activity.selection.variantId)
    : null;
  const requiresGps = activeVariant
    ? activeVariant.requiresGps
    : activity.selection?.environment !== 'indoor';
  const gpsDenied = requiresGps && ctx.state.locationPermission === 'denied';
  const isSwim =
    activity.selection?.variantId === 'natation-piscine' ||
    activity.selection?.variantId === 'natation-eau-libre';
  const rhythm = rhythmMetric(activity.sport, activity.selection);
  const rhythmLabel = rhythm === 'pace' ? 'Allure' : 'Vitesse';
  const speed = activity.movingS > 0 ? (activity.distanceM / activity.movingS) * 3.6 : null;
  const paceSeconds =
    activity.movingS > 0 && activity.distanceM > 0
      ? isSwim
        ? activity.movingS / (activity.distanceM / 100)
        : activity.movingS / (activity.distanceM / 1000)
      : null;
  const rhythmValue = gpsDenied
    ? '—'
    : rhythm === 'pace'
      ? paceSeconds !== null
        ? isSwim
          ? `${formatPace(paceSeconds)}/100m`
          : `${formatPace(paceSeconds)}/km`
        : '—'
      : speed !== null
        ? `${speed.toFixed(1).replace('.', ',')} km/h`
        : '—';
  const metrics =
    ctx.guidance && ctx.guidance.state.customFieldValues.length > 0 && !gpsDenied
      ? ctx.guidance.state.customFieldValues.map((field) => ({
          label: field.label,
          value: field.available
            ? field.unitLabel
              ? `${field.formattedValue} ${field.unitLabel}`
              : field.formattedValue
            : '—',
        }))
      : [
          { label: 'Distance', value: gpsDenied ? '—' : formatDistance(activity.distanceM / 1000) },
          { label: rhythmLabel, value: rhythmValue },
          { label: 'Temps', value: formatDuration(activity.movingS) },
          {
            label: 'D+',
            value:
              !requiresGps || isSwim
                ? '0 m'
                : gpsDenied
                  ? '—'
                  : `${Math.round(activity.elevGainM)} m`,
          },
        ];
  const next = ctx.pois[0];
  const guidance = ctx.guidance?.state;
  return (
    <>
      {guidance && activity.route ? (
        <TurnByTurnBanner state={guidance.turnByTurn} />
      ) : null}
      {guidance && guidance.reroute.status !== 'on_route' ? (
        <RerouteBanner
          state={guidance.reroute}
          units={ctx.units}
          onRetry={ctx.guidance?.onRetryReroute}
        />
      ) : null}
      {guidance && guidance.activeWaypointAlert ? (
        <WaypointAlertBanner alert={guidance.activeWaypointAlert} units={ctx.units} />
      ) : null}
      {guidance ? <ClimbDescentCard card={guidance.climbCard} units={ctx.units} /> : null}
      {gpsDenied ? (
        <XpEmpty
          title="Position refusée"
          hint="Aucun point GPS n’est enregistré. Autorise la position pour reprendre une trace."
        />
      ) : null}
      {activity.paused || activity.autoPaused ? (
        <XpRows>
          <XpRow
            icon="pause"
            title={activity.paused ? 'Pause manuelle' : 'Pause automatique'}
            sub={
              activity.paused
                ? 'Le suivi est suspendu · appuie sur Reprendre pour continuer.'
                : 'Arrêt détecté · les métriques sont gelées et la reprise est automatique.'
            }
            badge={{ label: activity.paused ? 'pausé' : 'auto', tone: 'warn' }}
          />
        </XpRows>
      ) : null}
      <div className="xp-chrono" aria-live="off">
        {elapsed}
      </div>
      <XpMetrics items={metrics} />
      <LiveSpecializedPanel activity={activity} />
      {guidance && (guidance.upcomingWaypoints.length > 0 || activity.route) ? (
        <UpcomingWaypointsList
          items={guidance.upcomingWaypoints}
          onSelect={(item) => {
            const w = item.waypoint;
            const kind = ['water', 'refuge', 'bivouac', 'viewpoint', 'danger', 'access', 'summit'].includes(w.kind)
              ? (w.kind as never)
              : 'viewpoint';
            ctx.state.select({ kind, id: w.id }, kind, 'mid');
          }}
        />
      ) : (
        <>
          <XpEyebrow>Prochain repère</XpEyebrow>
          {next ? (
            <XpRows>
              <XpRow
                icon={POI_ICON[next.kind] ?? 'pin'}
                title={next.name}
                sub={`${
                  ctx.units === 'imperial'
                    ? formatImperialDistance(distanceKm(ctx.state.center, [next.lon, next.lat]))
                    : formatDistance(distanceKm(ctx.state.center, [next.lon, next.lat]))
                } · ${POI_LABEL[next.kind] ?? next.kind}`}
              />
            </XpRows>
          ) : (
            <XpEmpty
              title="Aucun repère devant"
              hint="Aucun point d’eau ni refuge n’est enregistré sur la suite du parcours."
            />
          )}
        </>
      )}
      <ExplorerLiveSegmentsPanel
        sport={activity.sport}
        center={ctx.state.center}
        online={ctx.state.online}
        paused={Boolean(activity.paused || activity.autoPaused)}
      />
      <LiveMediaCapture ctx={ctx} />
    </>
  );
}

/** Durée d’un segment : 5'04", ou 1 h 02'03" au-delà d’une heure. */
function formatSplitTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h} h ${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

/** Allure ou vitesse propre au segment, jamais l’allure globale de la sortie. */
function splitRhythmValue(
  split: ActivitySplit,
  rhythm: 'pace' | 'speed',
  units: 'metric' | 'imperial',
): string | null {
  if (rhythm === 'pace') {
    const pace =
      units === 'imperial'
        ? splitPaceSecondsPerMile(split)
        : splitPaceSecondsPerKm(split);
    return pace === null ? null : `${formatPace(pace)}/${units === 'imperial' ? 'mi' : 'km'}`;
  }
  const speed = splitSpeedKmh(split);
  if (speed === null) return null;
  return units === 'imperial'
    ? `${(speed / (MILE_DISTANCE_M / 1000)).toFixed(1).replace('.', ',')} mph`
    : `${speed.toFixed(1).replace('.', ',')} km/h`;
}

/**
 * Détail d’un split : durée mesurée, distance du segment et rythme propre.
 * Un split terminé n’affiche pas la distance (elle vaut 1 km ou 1 mile) ;
 * un rythme de type vitesse reste utile pour le vélo, le kayak et le ski.
 */
function splitDetail(
  split: ActivitySplit,
  rhythm: 'pace' | 'speed',
  withDistance: boolean,
  units: 'metric' | 'imperial',
): string {
  const parts = [formatSplitTime(split.movingS)];
  if (withDistance) {
    parts.push(
      units === 'imperial'
        ? formatImperialDistance(split.distanceM / 1000)
        : formatDistance(split.distanceM / 1000),
    );
  }
  const rhythmValue = splitRhythmValue(split, rhythm, units);
  if (rhythmValue && (withDistance || rhythm === 'speed')) parts.push(rhythmValue);
  return parts.join(' · ');
}

/** Tours : splits kilométriques, miles et tours manuels réels, sans allure globale. */
function LiveLapsTab({ ctx }: { ctx: SheetContext }) {
  const activity = ctx.state.activity;
  if (!activity) {
    return <XpEmpty title="Aucun tour" hint="Démarre une activité pour enregistrer des tours." />;
  }
  if (ctx.state.locationPermission === 'denied') {
    return (
      <XpEmpty
        title="Position refusée"
        hint="Aucun point GPS n’est enregistré : les splits ne peuvent pas être calculés."
      />
    );
  }

  const units = ctx.units;
  const scaleSplits = units === 'imperial' ? activity.mileSplits : activity.splits;
  if (!scaleSplits) {
    return (
      <XpEmpty
        title="Découpe indisponible"
        hint="Cette séance n’a pas de points GPS exploitables : aucun split n’est inventé."
      />
    );
  }

  const rhythm = rhythmMetric(activity.sport, activity.selection);
  const currentSplit = activeSplit(scaleSplits);
  const completedSplits = scaleSplits.filter((split) => split.completed);
  const fastest = fastestSplit(completedSplits);
  const laps = activity.laps ?? [];
  const currentLap = activeSplit(laps);
  const completedLaps = laps.filter((split) => split.completed);
  const fastestLap = fastestSplit(completedLaps);
  const measured = activity.distanceM > 0;
  const splitWord = units === 'imperial' ? 'Mile' : 'Km';
  const splitSection = units === 'imperial' ? 'Miles' : 'Kilomètres';

  if (!measured && completedSplits.length === 0) {
    return (
      <XpEmpty
        title="Pas encore de tour"
        hint={`Le premier ${units === 'imperial' ? 'mile' : 'kilomètre'} n’est pas terminé.`}
      />
    );
  }

  const canLap =
    !!ctx.onMarkLap &&
    !activity.paused &&
    currentLap !== null &&
    currentLap.distanceM >= 1;
  const onMarkLap = ctx.onMarkLap;

  return (
    <>
      <XpEyebrow>{splitSection}</XpEyebrow>
      <XpRows>
        {currentSplit ? (
          <XpRow
            icon="route"
            title={`${splitWord} ${currentSplit.index}`}
            sub={splitDetail(currentSplit, rhythm, true, units)}
            badge={{ label: 'en cours', tone: 'warn' }}
          />
        ) : null}
        {completedSplits.map((split) => (
          <XpRow
            key={`${split.kind}-${split.index}`}
            icon="route"
            title={`${splitWord} ${split.index}`}
            sub={splitDetail(split, rhythm, false, units)}
            badge={
              fastest?.index === split.index
                ? { label: 'plus rapide', tone: 'good' }
                : { label: 'ok', tone: 'good' }
            }
          />
        ))}
      </XpRows>

      <XpEyebrow>Tours manuels</XpEyebrow>
      <XpRows>
        {onMarkLap ? (
          canLap ? (
            <XpRow
              icon="repeat"
              title="Nouveau tour"
              sub="Clôt le tour en cours et en commence un autre."
              onClick={onMarkLap}
            />
          ) : (
            <XpRow
              icon="repeat"
              title="Nouveau tour"
              sub={
                activity.paused
                  ? 'Indisponible pendant une pause manuelle.'
                  : 'Disponible après quelques mètres mesurés.'
              }
            />
          )
        ) : null}
        {completedLaps.map((split) => (
          <XpRow
            key={`lap-${split.index}`}
            icon="repeat"
            title={`Tour ${split.index}`}
            sub={splitDetail(split, rhythm, true, units)}
            badge={
              fastestLap?.index === split.index
                ? { label: 'plus rapide', tone: 'good' }
                : { label: 'ok', tone: 'good' }
            }
          />
        ))}
        {currentLap && completedLaps.length > 0 ? (
          <XpRow
            icon="repeat"
            title={`Tour ${currentLap.index}`}
            sub={splitDetail(currentLap, rhythm, true, units)}
            badge={{ label: 'en cours', tone: 'warn' }}
          />
        ) : null}
      </XpRows>

      <XpEyebrow>Total</XpEyebrow>
      <XpRows>
        <XpRow
          icon="clock"
          title="Temps en mouvement"
          sub={formatDuration(activity.movingS)}
        />
        <XpRow
          icon="route"
          title="Distance mesurée"
          sub={
            units === 'imperial'
              ? formatImperialDistance(activity.distanceM / 1000)
              : formatDistance(activity.distanceM / 1000)
          }
        />
        <XpRow icon="pause" title="Pauses" sub="Exclues des splits et des tours." />
      </XpRows>
    </>
  );
}

/** Sécurité en activité : numéro d'urgence réel du pays, SOS, partage. */
function LiveSafetyTab({ ctx }: { ctx: SheetContext }) {
  const emergency = ctx.country?.practical?.emergency_numbers?.general ?? null;
  return (
    <>
      <XpEyebrow>Urgences · {ctx.country?.name ?? 'pays courant'}</XpEyebrow>
      {emergency ? (
        <XpRows>
          <XpRow icon="shield" tone="bad" title={emergency} sub="Numéro d’urgence local (Wikidata)" />
        </XpRows>
      ) : (
        <XpEmpty title="Numéro non documenté" hint="Aucun numéro d’urgence n’est enregistré pour ce pays." />
      )}
      <XpEyebrow>Partage en direct & Sécurité (Beacon)</XpEyebrow>
      <ExplorerLiveTrackingPanel />
    </>
  );
}

function ActivityTabs(ctx: SheetContext, kind: string): SheetTab[] {
  const { state } = ctx;
  if (kind === 'start') {
    const isReco = state.mini === 0;
    const isCatalog = state.mini === 1;
    const isRoutes = state.mini === 2;

    return [
      {
        id: 'activites',
        label: isReco ? 'Recommandé' : isCatalog ? 'Catalogue' : 'Itinéraires',
        icon: isReco ? 'star' : isCatalog ? 'run' : 'map',
        render: () => {
          const armedJoinCard =
            ctx.guidance && state.trailRoute?.status === 'ready' ? (
              <JoinStartCard
                evaluation={ctx.guidance.state.departureEvaluation}
                externalLinks={ctx.guidance.state.externalLinks}
                accessPlan={ctx.guidance.state.accessPlan}
                onAction={(action) => {
                  if (action === 'start_at_origin' || action === 'start_here_on_route') {
                    ctx.onStartSport?.('rando');
                    return;
                  }
                  ctx.guidance?.onSelectDepartureAction(action);
                }}
              />
            ) : null;
          if (isReco) {
            return (
              <>
                {armedJoinCard}
                <RecommendedSports ctx={ctx} />
                <ZoneSettingsEntry />
              </>
            );
          }
          if (isRoutes) {
            return (
              <>
                {armedJoinCard}
                <RoutesTab ctx={ctx} />
                <ZoneSettingsEntry />
              </>
            );
          }
          return (
            <>
              {armedJoinCard}
              <SportPicker ctx={ctx} />
              <ZoneSettingsEntry />
            </>
          );
        },
      },
    ];
  }
  if (kind === 'liveSettings') {
    const activity = state.activity;
    const guidance = ctx.guidance;
    const recordingSnap: ActiveRecordingSnapshot | null = activity
      ? {
          sessionId: null,
          sport: activity.sport,
          selection: activity.selection,
          clientSessionId: activity.clientSessionId ?? `local-${activity.startedAt}`,
          startedAt: activity.startedAt,
          paused: activity.paused,
          autoPaused: Boolean(activity.autoPaused),
          distanceM: activity.distanceM,
          elevGainM: activity.elevGainM,
          movingS: activity.movingS,
          splits: activity.splits ?? [],
          mileSplits: activity.mileSplits ?? [],
          laps: activity.laps ?? [],
        }
      : null;

    return [
      {
        id: 'audio',
        label: 'Audio',
        icon: 'vol',
        render: () =>
          guidance ? (
            <AudioGuidanceControls
              preferences={guidance.state.audioPrefs}
              sport={activity?.sport ?? 'rando'}
              onChange={guidance.onSetAudioPrefs}
              speech={browserSpeechAdapter}
              onTestVoice={guidance.onTestVoice}
            />
          ) : (
            <XpEmpty title="Audio indisponible" hint="Démarre une sortie pour régler le guidage vocal." />
          ),
      },
      {
        id: 'orientation',
        label: 'Carte',
        icon: 'compass',
        render: () =>
          guidance ? (
            <OrientationCompass
              orientation={guidance.state.orientation}
              onModeChange={guidance.onSetOrientationMode}
              onRecenter={guidance.onRecenter}
            />
          ) : (
            <XpEmpty title="Orientation indisponible" hint="Contrôle de carte indisponible." />
          ),
      },
      {
        id: 'champs',
        label: 'Écran',
        icon: 'gauge',
        render: () =>
          guidance ? (
            <CustomFieldsEditor
              preferences={guidance.state.displayPrefs}
              wakeLock={guidance.state.wakeLock}
              units={ctx.units}
              onChange={guidance.onSetDisplayPrefs}
              onDone={() => state.closeLiveSettings()}
            />
          ) : (
            <XpEmpty title="Champs indisponibles" hint="Démarre une sortie pour personnaliser l'écran." />
          ),
      },
      {
        id: 'parcours-verrou',
        label: 'Parcours',
        icon: 'route',
        render: () => (
          <>
            {guidance && recordingSnap ? (
              <RouteSwapPicker
                recording={recordingSnap}
                routes={guidance.state.availableSwapRoutes}
                currentRouteId={activity?.route?.id ?? null}
                units={ctx.units}
                onSwap={(next) => {
                  guidance.onSwapRoute(next);
                  state.closeLiveSettings();
                }}
              />
            ) : null}
            {guidance && guidance.state.lockScreenPayload ? (
              <LiveActivityPreview
                payload={guidance.state.lockScreenPayload}
                capability={guidance.state.lockScreenCapability}
                onAction={guidance.onLockScreenAction}
              />
            ) : null}
          </>
        ),
      },
    ];
  }
  if (kind === 'live') {
    return [
      {
        id: 'direct',
        label: 'Direct',
        icon: 'pulse',
        render: () => <LiveDirectTab ctx={ctx} />,
      },
      {
        id: 'tours',
        label: 'Tours',
        icon: 'repeat',
        render: () => <LiveLapsTab ctx={ctx} />,
      },
      {
        id: 'mesures',
        label: 'Mesures',
        icon: 'heart',
        render: () => {
          const activity = ctx.state.activity;
          if (!activity) {
            return (
              <XpEmpty
                title="Aucune mesure"
                hint="Démarre une activité pour voir les séries réellement reçues."
              />
            );
          }
          return (
            <MetricSeriesPanel
              series={activity.metricSeries ?? []}
              units={ctx.units}
              sport={activity.sport}
            />
          );
        },
      },
      {
        id: 'securite',
        label: 'Sécurité',
        icon: 'shield',
        render: () => <LiveSafetyTab ctx={ctx} />,
      },
    ];
  }
  if (kind === 'sos') {
    return [
      {
        id: 'sos',
        label: 'SOS',
        icon: 'shield',
        render: () => (
          <XpEmpty
            title="SOS en attente"
            hint="Maintiens le bouton rouge 1,5 s pour armer l’alerte. Aucun appel réel n’est passé en mode test."
          />
        ),
      },
    ];
  }
  if (kind === 'summary') {
    const summary = state.summary ?? null;
    return [
      {
        id: 'bilan',
        label: 'Bilan',
        icon: 'star',
        render: () => {
          if (!summary) {
            return (
              <XpEmpty
                title="Aucune sortie à résumer"
                hint="Termine une activité pour voir ton bilan."
              />
            );
          }
          const durationS = summary.movingS || (summary.endedAt - summary.startedAt) / 1000;
          return (
            <>
              <XpMetrics
                items={[
                  { label: 'Distance', value: formatDistance(summary.distanceM / 1000) },
                  { label: 'D+', value: `${Math.round(summary.elevGainM)} m` },
                  { label: 'Durée', value: formatDuration(durationS) },
                ]}
              />
              <XpEyebrow>Sortie</XpEyebrow>
              <XpRows>
                <XpRow
                  icon={SPORT_META[summary.sport].icon}
                  title={summary.selection?.variantLabel ?? SPORT_META[summary.sport].label}
                  sub={[
                    SPORT_META[summary.sport].label,
                    new Date(summary.startedAt).toLocaleString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  ].join(' · ')}
                />
                <XpRow
                  icon={
                    state.summarySaved === 'saved' || state.summarySaved === 'already_finished'
                      ? 'check'
                      : state.summarySaved === 'local' ||
                          state.summarySaved === 'pending' ||
                          state.summarySaved === 'already_finished_without_summary'
                        ? 'info'
                        : 'alert'
                  }
                  tone={
                    state.summarySaved === 'saved' || state.summarySaved === 'already_finished'
                      ? 'good'
                      : state.summarySaved === 'local' ||
                          state.summarySaved === 'pending' ||
                          state.summarySaved === 'already_finished_without_summary'
                        ? 'muted'
                        : 'warn'
                  }
                  title={
                    state.summarySaved === 'saved'
                      ? 'Sortie enregistrée'
                      : state.summarySaved === 'already_finished'
                        ? 'Sortie déjà enregistrée'
                        : state.summarySaved === 'already_finished_without_summary'
                          ? 'Sortie déjà close'
                          : state.summarySaved === 'pending'
                            ? 'Enregistrement en cours…'
                            : state.summarySaved === 'local'
                              ? 'Sortie locale'
                              : state.summarySaved === 'unauthenticated'
                                ? 'Sortie non enregistrée'
                                : state.summarySaved === 'conflict'
                                  ? 'Enregistrement en conflit'
                                  : 'Enregistrement impossible'
                  }
                  sub={
                    state.summarySaved === 'already_finished'
                      ? 'Aucun doublon n’a été créé.'
                      : state.summarySaved === 'already_finished_without_summary'
                        ? 'Aucun résumé n’a été retrouvé pour cette séance.'
                        : state.summarySaved === 'local'
                          ? 'Cette séance n’a pas d’identité serveur ; elle n’est pas synchronisée.'
                          : state.summarySaved === 'unauthenticated'
                            ? 'Connecte-toi pour conserver tes sorties'
                            : state.summarySaved === 'conflict'
                              ? 'Vérifie ton compte avant de réessayer.'
                              : state.summarySaved === 'failed'
                                ? 'Réessaie depuis ton compte'
                                : undefined
                  }
                />
              </XpRows>
              <SummarySpecializedPanel summary={summary} />
              <ExplorerSummaryEffortAndSplits summary={summary} units={ctx.units} />
            </>
          );
        },
      },
      {
        id: 'statistiques',
        label: 'Statistiques',
        icon: 'gauge',
        render: () => {
          const bilan = state.summary;
          if (!bilan) {
            return (
              <XpEmpty
                title="Aucune série à afficher"
                hint="Termine une activité pour voir les mesures réellement reçues."
              />
            );
          }
          return (
            <MetricSeriesPanel
              series={bilan.metricSeries ?? []}
              units={ctx.units}
              sport={bilan.sport}
              emptyTitle="Aucune série mesurée"
              emptyHint="Cette sortie ne contient aucun point GPS ou capteur exploitable. Aucune moyenne ni aucun pic n’est inventé."
            >
              <ExplorerStatsTelemetryBridge summary={bilan} units={ctx.units} />
            </MetricSeriesPanel>
          );
        },
      },
    ];
  }
  return [{ id: 'info', label: 'Infos', icon: 'info', render: () => <XpEmpty title="Rien à afficher" hint="" /> }];
}

function StateTabs(ctx: SheetContext): SheetTab[] {
  const { state } = ctx;
  return [
    {
      id: 'profil',
      label: 'Profil',
      icon: 'userplus',
      render: () => (
        <>
          <XpEyebrow>Pour qui explores-tu ?</XpEyebrow>
          <XpChips
            ariaLabel="Profil"
            items={[
              { id: 'solo', label: 'Solo' },
              { id: 'famille', label: 'En famille' },
              { id: 'enfants', label: 'Avec enfants' },
              { id: 'senior', label: 'Senior' },
              { id: 'pmr', label: 'Mobilité réduite' },
              { id: 'sportif', label: 'Sportif' },
            ]}
            value={state.profile ?? 'solo'}
            onChange={(id) => state.patch({ profile: id as never })}
          />
          <p style={{ margin: '12px 2px', fontSize: 12.5, color: 'var(--xp-mut)', lineHeight: 1.45 }}>
            Explorer s’ouvre là où tu es. Le globe tourne vers toi puis descend jusqu’à ton quartier. Langue,
            unités et numéros d’urgence suivent le pays affiché.
          </p>
          <XpRows>
            <XpRow
              icon="loc"
              title="Autoriser ma position"
              sub="Pour ouvrir la carte sur ton quartier"
              onClick={() => {
                // Le bouton ne fabrique jamais une permission « accordée » :
                // il demande la position réelle, et seul le callback du
                // navigateur patche `locationPermission`.
                ctx.onRequestLocation?.();
                state.patch({ sheet: 'level', detent: 'peek' });
              }}
            />
            <XpRow icon="chevr" title="Plus tard" onClick={() => state.patch({ sheet: 'level', detent: 'peek' })} />
          </XpRows>
        </>
      ),
    },
  ];
}

function getLocalizedCountryName(iso?: string | null): string | null {
  if (!iso || typeof iso !== 'string' || iso.length !== 2) return null;
  try {
    const displayNames = new Intl.DisplayNames(['fr'], { type: 'region' });
    return displayNames.of(iso.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

export function buildSheetModel(ctx: SheetContext): SheetModel {
  const { state } = ctx;
  const kind = state.sheet;

  if (kind === 'level' || kind === 'previewCountry') {
    const region = findRegionAt(ctx.regionsGeo, state.center);
    let title = 'Le monde';
    let subtitle: string | null = 'Le globe s’ouvre sur toi';
    if (state.level === 1 || kind === 'previewCountry') {
      const fallbackName = getLocalizedCountryName(state.geo);
      title = ctx.country?.name ?? ctx.countries.find((c) => c.iso === state.geo)?.name ?? fallbackName ?? state.geo;
      subtitle = [ctx.country?.continent, ctx.country?.capital].filter(Boolean).join(' · ') || null;
    } else if (state.level === 2) {
      title = state.regionId ?? 'Région';
      const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = clean(state.regionId ?? '');
      const units = ctx.regionGroups.find((group) => {
        const g = clean(group.group);
        return g === target || g.includes(target) || target.includes(g);
      })?.units;
      subtitle = [ctx.country?.name, units ? `${units} unités` : null].filter(Boolean).join(' · ') || null;
    } else if (state.level === 3) {
      const realPlaceName = ctx.place?.place?.placeName ?? ctx.place?.place?.regionName;
      title = state.placeId ?? realPlaceName ?? region?.name ?? ctx.country?.name ?? 'Secteur';
      const ele = ctx.place?.place?.elevationM;
      const eleStr = ele != null ? `${ele} m` : null;
      const counts = ctx.place?.place?.counts;
      const totalWater = counts?.water ?? ctx.pois.filter((p) => p.kind === 'water').length;
      const totalRefuges = counts?.refuges ?? ctx.pois.filter((p) => p.kind === 'refuge').length;
      const countsStr =
        totalWater > 0 || totalRefuges > 0
          ? `${totalWater} points d’eau · ${totalRefuges} refuges`
          : ctx.pois.length > 0
            ? `${ctx.pois.length} repères réels`
            : null;
      subtitle = [
        region?.name ?? ctx.country?.name,
        eleStr,
        countsStr,
      ]
        .filter(Boolean)
        .join(' · ') || 'Secteur d’exploration';
    }
    const mini =
      state.level === 2
        ? { items: [{ id: 'ete', label: 'Été', icon: 'sun' }, { id: 'hiver', label: 'Hiver', icon: 'snow' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
        : state.level === 3
          ? { items: [{ id: '2d', label: 'Vue 2D', icon: 'map' }, { id: '3d', label: 'Relief 3D', icon: 'cube' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
          : null;
    return {
      title,
      subtitle,
      tabs: LevelTabs(ctx),
      tabsBottom: state.level === 0,
      mini,
      actions: (
        <button type="button" className="xp-round-ink" onClick={() => state.setSheet('start', 'low')} aria-label="Démarrer une activité">
          <XpIcon name="play" size={15} />
        </button>
      ),
      onBack: state.level > 0 ? state.goUp : undefined,
    };
  }

  if (['summit', 'water', 'refuge', 'bivouac', 'viewpoint', 'danger', 'access', 'friend'].includes(kind)) {
    const poi = ctx.selectedPoi;
    const kindLabel = POI_LABEL[kind] ?? kind;
    return {
      title: poi?.name ?? kindLabel,
      subtitle: poi
        ? [
            kindLabel,
            formatElevation(poi.ele_m),
            formatDistance(distanceKm(state.center, [poi.lon, poi.lat])),
          ]
            .filter(Boolean)
            .join(' · ')
        : 'Aucun repère enregistré à cet endroit',
      tabs: PoiTabs(ctx, kind),
      mini: null,
      actions: (
        <button type="button" className="xp-round-ink" onClick={() => state.setSheet('start', 'low')} aria-label="Démarrer une activité">
          <XpIcon name="play" size={15} />
        </button>
      ),
      onBack: () => state.clearSelection(),
    };
  }

  if (kind === 'planner') {
    return {
      title: state.plannerTitle || 'Planifier un itinéraire',
      subtitle: 'Édition, boucle & bibliothèque',
      tabs: [
        {
          id: 'editeur',
          label: 'Éditeur',
          icon: 'route',
          render: () => <RoutePlannerPanel ctx={ctx} />,
        },
      ],
      mini: null,
      actions: null,
      onBack: () => state.closeSubSheet(),
    };
  }

  if (kind === 'multiday') {
    const activePlanDist = state.activeMultiDayPlan
      ? state.activeMultiDayPlan.stages.reduce((acc, s) => acc + s.distanceKm, 0)
      : 0;
    return {
      title: state.activeMultiDayPlan?.title ?? 'Trek multi-jours',
      subtitle: state.activeMultiDayPlan
        ? `${state.activeMultiDayPlan.daysCount} jours · ${activePlanDist.toFixed(0)} km`
        : 'Étapes & hébergements',
      tabs: [
        {
          id: 'etapes',
          label: 'Étapes',
          icon: 'map',
          render: () => <MultiDaySheetPanel ctx={ctx} />,
        },
      ],
      mini: null,
      actions: null,
      onBack: () => state.closeSubSheet(),
    };
  }

  if (['trail', 'depart', 'search', 'layers', 'offline'].includes(kind)) {
    const titles: Record<string, [string, string]> = {
      trail: ['Itinéraire', 'Trace enregistrée'],
      depart: ['Créer un départ', 'Invite d’autres membres'],
      search: ['Recherche', 'Pays, repères, itinéraires'],
      layers: ['Calques', 'Éléments visibles de la carte'],
      offline: ['Hors ligne', 'Zone téléchargeable'],
    };
    const [title, subtitle] = titles[kind];
    const route = ctx.routes.find((item) => String(item.id) === state.selection?.id);
    return {
      title: kind === 'trail' && route?.name ? route.name : title,
      subtitle:
        kind === 'trail' && route
          ? `${route.distance_km != null && Number.isFinite(route.distance_km) ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : '—'}${route.ref ? ` · ${route.ref}` : ''}`
          : subtitle,
      tabs: ToolsTabs(ctx, kind),
      mini:
        kind === 'trail'
          ? { items: [{ id: 'carte', label: 'Carte', icon: 'map' }, { id: 'survol', label: 'Survol 3D', icon: 'play' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
          : null,
      actions: null,
      onBack:
        kind === 'layers'
          ? () => state.closeLayers()
          : () => state.patch({ sheet: 'level', detent: 'peek' }),
    };
  }

  if (kind === 'strength') {
    return {
      title: 'Musculation',
      subtitle: 'Carnet privé · exercices, séries, répétitions, charges',
      tabs: [
        {
          id: 'carnet',
          label: 'Carnet',
          icon: 'dumbbell',
          render: () => <StrengthPanel />,
        },
      ],
      mini: null,
      actions: null,
      onBack: () => state.setSheet('start', 'low'),
    };
  }

  if (kind === 'zoneSettings') {
    return {
      title: 'Zones et seuils',
      subtitle: 'Réglages sportifs privés · aucune valeur par défaut',
      tabs: [
        {
          id: 'zones',
          label: 'Réglages',
          icon: 'gauge',
          render: () => <ZoneSettingsPanel displayUnits={ctx.units} />,
        },
      ],
      mini: null,
      actions: null,
      onBack: () => {
        state.setTab(0);
        state.setSheet('start', 'low');
      },
    };
  }

  if (kind === 'liveSettings') {
    return {
      title: 'Réglages sortie',
      subtitle: 'Audio, orientation, champs, parcours & verrou',
      tabs: ActivityTabs(ctx, 'liveSettings'),
      mini: null,
      actions: null,
      onBack: () => state.closeLiveSettings(),
    };
  }

  if (['start', 'live', 'sos', 'summary'].includes(kind)) {
    const titles: Record<string, [string, string]> = {
      start: ['Démarrer', 'Choisis ton activité'],
      live: ['En direct', 'Sortie en cours'],
      sos: ['SOS', 'Alerte en attente'],
      summary: ['Bilan', 'Fin de sortie'],
    };
    const [title, subtitle] = titles[kind];
    const activity = state.activity;
    const sport = activity?.sport;
    return {
      title:
        kind === 'live' && sport
          ? (activity?.selection?.variantLabel ?? SPORT_META[sport].label)
          : title,
      subtitle:
        kind === 'live' && sport
          ? state.locationPermission === 'denied'
            ? `${SPORT_META[sport].label} · GPS refusé`
            : `${SPORT_META[sport].label} · Suivi en cours`
          : subtitle,
      tabs: ActivityTabs(ctx, kind),
      mini:
        kind === 'start'
          ? {
              items: [
                { id: 'reco', label: 'Recommandé', icon: 'star' },
                { id: 'sports', label: 'Catalogue', icon: 'run' },
                { id: 'traces', label: 'Itinéraires', icon: 'map' },
              ],
              value: state.mini,
              onChange: (index: number) => state.setMini(index),
            }
          : null,
      actions:
        kind === 'live' ? (
          <button
            type="button"
            className="xp-round-ink"
            onClick={() => state.openLiveSettings()}
            aria-label="Réglages guidage et sortie"
          >
            <XpIcon name="wrench" size={15} />
          </button>
        ) : null,
      onBack: () => state.patch({ sheet: 'level', detent: 'peek' }),
    };
  }

  // États : bienvenue, sans position, mode facile, nuit
  const titles: Record<string, [string, string]> = {
    welcome: ['Bienvenue dans Explorer', 'Le monde à ta hauteur, du globe au sentier'],
    noLocation: ['Sans position', 'Explorer sans partager où tu es'],
    easy: ['Mode facile', 'Une seule action à la fois'],
    level0: ['Le monde', 'Le globe s’ouvre sur toi'],
  };
  const [title, subtitle] = titles[kind] ?? ['Explorer', null as unknown as string];
  return { title, subtitle, tabs: StateTabs(ctx), mini: null, actions: null };
}
