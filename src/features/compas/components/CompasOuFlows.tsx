'use client';

import { notedStay } from '../engine/stayProposal';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasLevel, CompasNights, CompasTerrain } from '../engine/compasModel';
import { sourceLabel, adaptationTextFor, type CtxField } from '../engine/projectContext';
import { addDaysIso, capitalize, weatherLabel } from '../engine/format';
import {
  COMPAS_ACTIVITIES,
  MAX_TRIP_DAYS,
  planApplication,
  type CompasActivity,
} from '../engine/intent';
import { daylightClock } from '../engine/sun';
import { coarsePosition } from '../engine/privacy';
import { DEFAULT_TRAVELLER_ZONE, browserTimeZone, browserToday, differentClock } from '../engine/zone';
import {
  dayQuality,
  departureAdvice,
  hourQuality,
  morningFreezingLevel,
  type CalendarDay,
  type Pace,
} from '../engine/weather';
import {
  compasApplyRouteAction,
  compasMyRoutesAction,
  compasSearchRoutesAction,
  compasSetActivityAction,
  compasSetPreferencesAction,
  type CompasRouteOption,
} from '../server/compasActions';
import { applyCurrent, inverseOps, runOps } from './compasApply';
import { PassageSection } from './CompasPassage';
import { Chip, PagedList, Segments } from './CompasPrimitives';
import GeoapifyCredit from './GeoapifyCredit';
import { compasNearbyActivitiesAction } from '../server/resaActions';
import type { CompasStayOffer } from '../engine/stays';
import { mixParcours } from '../engine/parcoursMix';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import { AI_STEP_LABEL } from '../engine/aiNotice';
import type { CompasCtl, FlowHint } from './compasTypes';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translate';
import { ACTIVITY_HINT_KEY, activityName, compasFormat, compasT, countText } from '../engine/compasI18n';
import { useCompasFormat, useCompasUnits, useWeekStart } from './useCompasUnits';
import { calendarOffset, rotateWeek } from '@/lib/i18n/region';

const staticRow = { cursor: 'default' } as const;

const noSubscribe = () => () => {};
/** Fuseau du navigateur, lu côté navigateur seulement (null au rendu serveur : aucun écart d'hydratation). */
function useBrowserZone(): string | null {
  return useSyncExternalStore(noSubscribe, browserTimeZone, () => null);
}

/* =============================================================================
   Où et quand — les quatre parcours du tiroir, dans l'ordre de la maquette :
   Activité → Parcours → Quand → Envies (rythme, nuits, éviter, envies).
   ============================================================================= */

/* ---------- Activité ---------- */

const ACTIVITY_ICON: Record<CompasActivity, string> = {
  hiking: 'footprints',
  trekking: 'mountain',
  bivouac: 'tent',
  roadtrip: 'car',
  cultural: 'building',
  bushcraft: 'flame',
  mixed: 'compass',
  cycling: 'bike',
  ski: 'cloud-snow',
  mountaineering: 'flag',
  climbing: 'trending-up',
  water: 'droplets',
  citytrip: 'building2',
  beach: 'sun',
  vanlife: 'bus',
  running: 'heart-pulse',
  trail: 'zap',
};

/**
 * Icône et aide de chaque activité. `hintKey` se traduit à l'écran (`compas.activities.*Hint`) ;
 * `hint` en est le texte français, gardé pour les appelants sans locale.
 */
export const ACTIVITY_META = Object.fromEntries(
  COMPAS_ACTIVITIES.map((a) => [
    a,
    { icon: ACTIVITY_ICON[a], hintKey: ACTIVITY_HINT_KEY[a], hint: compasT('fr')(ACTIVITY_HINT_KEY[a]) },
  ])
) as Record<CompasActivity, { icon: string; hint: string; hintKey: TranslationKey }>;

/** Ordre d'affichage : de la marche au repos, « Mixte / autre » en dernier. */
export const ACTIVITY_ORDER: CompasActivity[] = [
  'hiking',
  'trekking',
  'trail',
  'running',
  'bivouac',
  'cycling',
  'mountaineering',
  'climbing',
  'ski',
  'water',
  'roadtrip',
  'vanlife',
  'cultural',
  'citytrip',
  'beach',
  'bushcraft',
  'mixed',
];

/** Les plus demandées, visibles d'emblée au départ ; le reste derrière « Plus ». */
export const ACTIVITY_FIRST: CompasActivity[] = ['hiking', 'trekking', 'cycling', 'roadtrip', 'citytrip', 'beach', 'ski'];

export function ActiviteFlow({ ctl }: { ctl: CompasCtl }) {
  const { activity, tripId, slug } = ctl.data.model;
  const { t, locale } = useTranslation();
  const pick = (a: CompasActivity) => {
    if (!ctl.data.canEdit || a === activity) return;
    const undo = inverseOps(ctl, [{ op: 'activity', activity: a }]);
    void ctl.run(
      t('compas.activities.changed', { label: activityName(a, locale) ?? a }),
      () => compasSetActivityAction({ tripId, tripSlug: slug, activity: a }),
      undo ? () => runOps(ctl, undo) : undefined
    );
  };
  const current = COMPAS_ACTIVITIES.find((a) => a === activity);
  // Maquette finale : les activités en tuiles (icône + nom), quatre par
  // ligne ; la description de l'activité choisie se lit sous la grille.
  return (
    <>
      <div className="cp-tiles" role="group" aria-label={t('compas.activities.groupLabel')}>
        {ACTIVITY_ORDER.map((a) => {
          const on = a === activity;
          return (
            <button
              key={a}
              type="button"
              className="cp-tile"
              aria-pressed={on}
              aria-describedby={`cp-act-${a}`}
              title={t(ACTIVITY_META[a].hintKey)}
              disabled={!ctl.data.canEdit || ctl.busy}
              onClick={() => pick(a)}
            >
              <Icon name={ACTIVITY_META[a].icon} size={20} />
              <span>{activityName(a, locale)}</span>
            </button>
          );
        })}
        {/* La description n'est pas qu'une info-bulle : elle est lue avec l'activité. */}
        {ACTIVITY_ORDER.map((a) => (
          <span key={a} id={`cp-act-${a}`} hidden>
            {t(ACTIVITY_META[a].hintKey)}
          </span>
        ))}
      </div>
      <p className="cp-note">
        {current
          ? t('compas.activities.current', {
              label: activityName(current, locale) ?? current,
              hint: t(ACTIVITY_META[current].hintKey).toLowerCase(),
            })
          : t('compas.activities.none')}{' '}
        {t('compas.activities.note')}
      </p>
    </>
  );
}

/* ---------- Parcours ---------- */

type RouteMode = 'etapes' | 'autour' | 'mine' | 'cherche';

export function ParcoursFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
  const { t, locale } = useTranslation();
  const f = useCompasFormat();
  const miles = useCompasUnits().distance === 'mi';
  const [mode, setMode] = useState<RouteMode>(() =>
    hint?.query ? 'cherche' : data.itinerary.length ? 'etapes' : 'autour'
  );
  // « Autour » part de la position GPS de l'appareil ; à défaut, du départ du voyage.
  const [here, setHere] = useState<{ lat: number; lon: number; gps: boolean } | null>(
    data.origin ? { ...data.origin, gps: false } : null
  );
  const [query, setQuery] = useState(hint?.query ?? '');
  const [results, setResults] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    routes: CompasRouteOption[];
    error?: string;
  }>({
    status: 'idle',
    routes: [],
  });
  const [picked, setPicked] = useState<CompasRouteOption | null>(null);
  // Activités partenaires (dont sorties guidées), mélangées aux parcours.
  const [partners, setPartners] = useState<CompasStayOffer[]>([]);
  const partnerSeq = useRef(0);
  const loadPartners = (place: string | null) => {
    const mine = ++partnerSeq.current;
    setPartners([]);
    if (!place) return;
    compasNearbyActivitiesAction({ tripId: m.tripId, place })
      .then((res) => {
        if (mine === partnerSeq.current && res.success) setPartners(res.offers);
      })
      .catch(() => {});
  };

  /** Position GPS (4 s au plus, mémorisée 10 min), sinon le départ du voyage. */
  const locate = (): Promise<{ lat: number; lon: number; gps: boolean } | null> =>
    new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(here);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          // Plan 2.10 : la position exacte ne quitte pas l'appareil, 0,01° (~1 km) dès la lecture
          // (une recherche « autour de moi » à 50 km n'a pas besoin de mieux).
          const coarse = coarsePosition({ lat: p.coords.latitude, lon: p.coords.longitude });
          if (!coarse) return resolve(here);
          const pos = { ...coarse, gps: true };
          setHere(pos);
          resolve(pos);
        },
        () => resolve(here),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 600_000 }
      );
    });

  const load = async (next: RouteMode, q = query) => {
    setMode(next);
    setPicked(null);
    if (next === 'etapes' || next === 'mine') loadPartners(null);
    if (next === 'etapes') return;
    setResults({ status: 'loading', routes: [] });
    try {
      const at = next === 'autour' ? await locate() : here;
      if (next === 'autour' && !at) {
        setResults({
          status: 'error',
          routes: [],
          error: t('compas.ouRoute.errorNoPosition'),
        });
        return;
      }
      const res =
        next === 'mine'
          ? await compasMyRoutesAction()
          : await compasSearchRoutesAction({
              lat: at?.lat ?? null,
              lon: at?.lon ?? null,
              query: next === 'cherche' ? q.trim() || null : null,
            });
      setResults(
        res.success
          ? { status: 'ok', routes: res.routes }
          : { status: 'error', routes: [], error: res.error }
      );
      if (next !== 'mine')
        loadPartners(
          next === 'cherche'
            ? q.trim() || null
            : (m.destination ?? (res.success ? (res.routes[0]?.region ?? null) : null))
        );
    } catch {
      setResults({ status: 'error', routes: [], error: t('compas.ouRoute.errorOffline') });
    }
  };

  useEffect(() => {
    if (mode !== 'etapes') void load(mode, query);
    // Premier affichage seulement : les changements passent par `load`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 3) void load('cherche', query);
  };

  if (picked) return <RouteConfirm ctl={ctl} route={picked} onBack={() => setPicked(null)} />;

  const modes: Array<{ id: RouteMode; label: string }> = [
    {
      id: 'etapes',
      label: data.itinerary.length
        ? t('compas.ouRoute.modeStepsCount', { count: data.itinerary.length })
        : t('compas.ouRoute.modeSteps'),
    },
    { id: 'autour' as const, label: t('compas.ouRoute.modeAround') },
    { id: 'mine', label: t('compas.ouRoute.modeMine') },
  ];

  return (
    <>
      <div className="cp-sumline">
        <span>
          <b>{data.route.name ?? (data.itinerary.length ? t('compas.ouRoute.freeRoute') : t('compas.ouRoute.noRoute'))}</b>
          {m.route.stepsCount > 0 && (
            <>
              {' '}
              · {f.km(m.route.distanceKm)} · D+ {f.meters(m.route.elevationGainM)}
            </>
          )}
        </span>
        {data.route.id != null && <Chip icon="map-pin">{t('compas.ouRoute.catalogue')}</Chip>}
      </div>

      <form className="cp-searchrow" onSubmit={onSearch} role="search">
        <label className="cp-field">
          <span className="sr-only">{t('compas.ouRoute.searchLabel')}</span>
          <input
            type="search"
            value={query}
            maxLength={80}
            placeholder={t('compas.ouRoute.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="cp-ibtn cp-glass"
          aria-label={t('compas.ouRoute.searchButton')}
          disabled={query.trim().length < 3}
        >
          <Icon name="search" size={17} />
        </button>
      </form>

      <div className="cp-chiprow" role="group" aria-label={t('compas.ouRoute.sourcesLabel')}>
        {modes.map((o) => (
          <button
            key={o.id}
            type="button"
            className="cp-pill"
            aria-pressed={mode === o.id}
            onClick={() => void load(o.id)}
          >
            {o.label}
          </button>
        ))}
        {m.preferences.wishes.map((w) => (
          <button
            key={`w-${w}`}
            type="button"
            className="cp-pill"
            aria-pressed={mode === 'cherche' && query === w}
            onClick={() => {
              setQuery(w);
              void load('cherche', w);
            }}
          >
            <Icon name="heart" size={12} />
            {w}
          </button>
        ))}
      </div>

      {mode === 'etapes' ? (
        <>
          <PagedList
            label={t('compas.ouRoute.stepsLabel')}
            resetKey="etapes"
            items={data.itinerary}
            empty={
              <p className="cp-note">{t('compas.ouRoute.stepsEmpty')}</p>
            }
            render={(s) => (
              <div key={s.id} className="cp-row" style={staticRow}>
                <span className="cp-thumb" aria-hidden="true">
                  <b>{s.day}</b>
                </span>
                <span className="cp-row__t">
                  <b>{s.title}</b>
                  <span>
                    {t('compas.ouDay.day', { day: s.day })} · {s.distanceEstimated && s.distanceKm != null ? t('compas.ouRoute.estimatedKm', { km: f.km(s.distanceKm) }) : f.km(s.distanceKm)} · D+{' '}
                    {f.meters(s.elevationGainM)}
                  </span>
                  {/* Étape proposée par l'IA : dit en texte (PLAN-100 5.3), même si l'IA est éteinte depuis. */}
                  {s.aiProposed && <span>{AI_STEP_LABEL}</span>}
                </span>
                <span className="cp-row__end">
                  {notedStay(s.accommodation) && <Chip icon="bed-double">{notedStay(s.accommodation)}</Chip>}
                </span>
              </div>
            )}
          />
          {data.itinerary.some((s) => s.distanceSource === 'geoapify') && (
            <p className="cp-disc">
              {t('compas.ouRoute.roadDistances')} <GeoapifyCredit /> · {t('compas.ouRoute.osmCredit')}
            </p>
          )}
        </>
      ) : results.status === 'loading' ? (
        <p className="cp-note" aria-live="polite">
          {t('compas.ouRoute.searching')}
        </p>
      ) : results.status === 'error' ? (
        <p className="cp-note" role="alert">
          {results.error}
        </p>
      ) : (
        <>
          {mode === 'autour' && (
            <p className="cp-sub">
              {here?.gps
                ? countText(t, locale, results.routes.length, 'compas.ouRoute.aroundYouOne', 'compas.ouRoute.aroundYouOther')
                : countText(t, locale, results.routes.length, 'compas.ouRoute.aroundStartOne', 'compas.ouRoute.aroundStartOther')}
            </p>
          )}
          {/* Activités partenaires mêlées à la liste : la divulgation AVANT elle, pas après (PLAN-100 5.3). */}
          {partners.length > 0 && mode !== 'mine' && <AffiliateDisclosure compact />}
          <PagedList
            label={t('compas.ouRoute.foundLabel')}
            resetKey={`${mode}-${query}`}
            items={mixParcours(results.routes, mode === 'mine' ? [] : partners)}
            empty={
              <p className="cp-note">
                {mode === 'mine'
                  ? t('compas.ouRoute.emptyMine')
                  : mode === 'autour'
                    ? t('compas.ouRoute.emptyAround')
                    : t('compas.ouRoute.emptySearch')}
              </p>
            }
            render={(entry) => {
              if (entry.kind === 'activity') {
                const a = entry.item;
                const body = (
                  <>
                    <span className="cp-thumb" aria-hidden="true">
                      <Icon name="ticket" size={18} />
                    </span>
                    <span className="cp-row__t">
                      <b>{a.title}</b>
                      <span>
                        {a.amount != null && a.currency
                          ? t('compas.ouRoute.fromPrice', { price: f.money(a.amount, a.currency) })
                          : t('compas.ouRoute.priceAtPartner')}
                      </span>
                    </span>
                    <span className="cp-row__end">
                      <Chip>{t('compas.ouRoute.partner')}</Chip>
                    </span>
                  </>
                );
                return a.url ? (
                  <a
                    key={`a-${a.id}`}
                    className="cp-row"
                    href={a.url}
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={`a-${a.id}`} className="cp-row" style={staticRow}>
                    {body}
                  </div>
                );
              }
              const r = entry.item;
              return (<button key={r.routeId} type="button" className="cp-row" onClick={() => setPicked(r)}>
                <span className="cp-thumb" aria-hidden="true">
                  <Icon name={r.mine ? 'footprints' : 'route'} size={18} />
                </span>
                <span className="cp-row__t">
                  <b>{r.name}</b>
                  <span>
                    {[
                      r.region,
                      f.km(r.distanceKm),
                      r.elevationGainM ? `D+ ${f.meters(r.elevationGainM)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="cp-row__end">
                  {r.mine ? (
                    <Chip tone="good">{t('compas.ouRoute.doneTimes', { count: r.mine.count })}</Chip>
                  ) : r.communitySessions > 0 ? (
                    <Chip icon="users">{r.communitySessions}</Chip>
                  ) : r.distanceFromKm != null ? (
                    <span className="cp-sub">{miles ? t('compas.units.away', { distance: f.km(r.distanceFromKm) }) : t('compas.ouRoute.away', { km: f.decimal(Math.round(r.distanceFromKm), 0) })}</span>
                  ) : null}
                  <Icon name="chevron-right" size={16} />
                </span>
              </button>);
            }}
          />
        </>
      )}
    </>
  );
}

function RouteConfirm({
  ctl,
  route,
  onBack,
}: {
  ctl: CompasCtl;
  route: CompasRouteOption;
  onBack: () => void;
}) {
  const m = ctl.data.model;
  const { t, locale } = useTranslation();
  const f = useCompasFormat();
  const fixedDays = m.dates.days;
  const [days, setDays] = useState(fixedDays ?? 1);
  const choose = async () => {
    const ok = await ctl.run(
      countText(t, locale, days, 'compas.ouRoute.chosenOne', 'compas.ouRoute.chosenOther'),
      () =>
        compasApplyRouteAction({ tripId: m.tripId, tripSlug: m.slug, routeId: route.routeId, days })
    );
    if (ok) onBack();
  };
  return (
    <>
      <div className="cp-sumline">
        <span>
          <b>{route.name}</b>
          {route.region ? ` · ${route.region}` : ''}
        </span>
      </div>
      <dl className="cp-kv">
        <dt>{t('compas.ouRoute.distance')}</dt>
        <dd>{f.km(route.distanceKm)}</dd>
        <dt>{t('compas.ouRoute.elevationGain')}</dt>
        <dd>{route.elevationGainM ? f.meters(route.elevationGainM) : t('compas.ouRoute.notGivenM')}</dd>
        <dt>{t('compas.ouRoute.statedDuration')}</dt>
        <dd>{route.durationHours ? f.duration(route.durationHours * 60) : t('compas.ouRoute.notGivenF')}</dd>
        {route.difficulty && (
          <>
            <dt>{t('compas.ouRoute.difficulty')}</dt>
            <dd>{route.difficulty}</dd>
          </>
        )}
        <dt>{t('compas.ouRoute.community')}</dt>
        <dd>
          {route.communitySessions
            ? countText(t, locale, route.communitySessions, 'compas.ouRoute.publicOutingsOne', 'compas.ouRoute.publicOutingsOther')
            : t('compas.ouRoute.noPublicOutings')}
        </dd>
        {route.mine && (
          <>
            <dt>{t('compas.ouRoute.you')}</dt>
            <dd>
              {countText(t, locale, route.mine.count, 'compas.ouRoute.timesOne', 'compas.ouRoute.timesOther')}
              {route.mine.last
                ? ` · ${t('compas.ouRoute.lastOn', { date: f.dayMonth(route.mine.last.slice(0, 10)) })}`
                : ''}
            </dd>
          </>
        )}
      </dl>
      {fixedDays ? (
        <p className="cp-note">
          {countText(t, locale, fixedDays, 'compas.ouRoute.splitFixedOne', 'compas.ouRoute.splitFixedOther')}
        </p>
      ) : (
        <div className="cp-stepper" role="group" aria-label={t('compas.ouRoute.numberOfDays')}>
          <span>{t('compas.ouRoute.splitInto')}</span>
          <button
            type="button"
            className="cp-ibtn cp-ibtn--sm cp-glass"
            aria-label={t('compas.ouRoute.oneDayLess')}
            disabled={days <= 1}
            onClick={() => setDays(days - 1)}
          >
            <Icon name="minus" size={14} />
          </button>
          <b>{countText(t, locale, days, 'compas.start.daysOne', 'compas.start.daysOther')}</b>
          <button
            type="button"
            className="cp-ibtn cp-ibtn--sm cp-glass"
            aria-label={t('compas.ouRoute.oneDayMore')}
            disabled={days >= MAX_TRIP_DAYS}
            onClick={() => setDays(days + 1)}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      )}
      <p className="cp-note">{t('compas.ouRoute.splitNote')}</p>
      <div className="cp-actions">
        <button type="button" className="cp-btn cp-btn--soft" onClick={onBack}>
          <Icon name="chevron-left" size={16} />
          {t('compas.ouRoute.back')}
        </button>
        {ctl.data.canEdit && (
          <button
            type="button"
            className="cp-btn cp-btn--pg cp-btn--block"
            disabled={ctl.busy}
            onClick={() => void choose()}
          >
            <Icon name="check" size={16} />
            {t('compas.ouRoute.choose')}
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Quand ---------- */

/** Libellés de qualité (« bonnes conditions »…), traduits à l'écran. */
const QUALITY_LABEL = {
  bon: 'compas.ouWhen.qualityGood',
  moyen: 'compas.ouWhen.qualityFair',
  mauvais: 'compas.ouWhen.qualityBad',
} as const satisfies Record<string, TranslationKey>;
/** Qualité en un mot (légende du calendrier, pastille du jour). */
const QUALITY_WORD = {
  bon: 'compas.ouWhen.legendGood',
  moyen: 'compas.ouWhen.legendFair',
  mauvais: 'compas.ouWhen.legendBad',
} as const satisfies Record<string, TranslationKey>;
/** Une forme par qualité, pleine pour une prévision et creuse pour une tendance : la couleur ne porte jamais seule l'information (WCAG 1.4.1). */
const QUALITY_SHAPE = {
  prevision: { bon: '●', moyen: '◆', mauvais: '▲' },
  tendance: { bon: '○', moyen: '◇', mauvais: '△' },
} as const;

export function QuandFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
  const { t, locale } = useTranslation();
  const f = useCompasFormat();
  const weekFirst = useWeekStart();
  const week = rotateWeek(t('compas.ouWhen.weekInitials').split(' '), weekFirst);
  const weather = data.weather;
  // Le plus tôt des deux « aujourd'hui » : celui du voyageur (navigateur, le
  // même que le serveur pour « Date passée ») et celui de la destination
  // (premier jour du calendrier). Aucun des deux n'est refusé ici.
  const own = browserToday();
  const destinationDay = weather?.calendar[0]?.date;
  const today = destinationDay && destinationDay < own ? destinationDay : own;
  const initialHours =
    hint?.hours ?? (m.dates.hours != null && m.dates.hours < 24 ? m.dates.hours : null);
  const [start, setStart] = useState(m.dates.start ?? '');
  const [unit, setUnit] = useState<'days' | 'hours'>(
    initialHours != null && initialHours < 24 ? 'hours' : 'days'
  );
  const [days, setDays] = useState(
    hint?.hours != null && hint.hours >= 24 ? hint.hours / 24 : (m.dates.days ?? 1)
  );
  const [hours, setHours] = useState(initialHours != null && initialHours < 24 ? initialHours : 4);
  const [focusDay, setFocusDay] = useState(m.route.dayPlans[0]?.day ?? 1);

  const spanDays = unit === 'hours' ? 1 : days;
  const end = start ? addDaysIso(start, spanDays - 1) : null;
  const changed =
    Boolean(start) &&
    (start !== m.dates.start ||
      end !== m.dates.end ||
      (unit === 'hours' ? hours !== m.dates.hours : m.dates.hours != null && m.dates.hours < 24));
  const resplit = data.route.id != null && spanDays !== m.dates.days;

  const calendar = weather?.calendar ?? [];

  /** Qualité d'une fenêtre : la plus mauvaise journée connue (maquette : qWin). */
  const windowQuality = (from: string, to: string) => {
    const rank = { bon: 0, moyen: 1, mauvais: 2 } as const;
    let worst: keyof typeof rank | null = null;
    for (const c of calendar)
      if (c.date >= from && c.date <= to && c.quality && (!worst || rank[c.quality] > rank[worst]))
        worst = c.quality;
    return worst;
  };

  const commit = async (from: string) => {
    if (!from || from < today) {
      ctl.notify(from ? t('compas.ouWhen.pastDate') : t('compas.ouWhen.pickStart'), 'bad');
      return;
    }
    const ops = planApplication(
      [
        { type: 'set_dates', start: from, end: null },
        {
          type: 'set_duration',
          days: unit === 'days' ? days : null,
          hours: unit === 'hours' ? hours : null,
        },
      ],
      applyCurrent(ctl)
    );
    const to = addDaysIso(from, spanDays - 1);
    const q = windowQuality(from, to);
    // Annulable tant que le parcours n'est pas redécoupé (même règle que la règle de durée).
    const undo = inverseOps(ctl, ops);
    await ctl.run(
      t('compas.ouWhen.changed', {
        when: `${
          unit === 'hours'
            ? `${f.dayMonth(from)} · ${f.hours(hours)}`
            : `${f.dayMonth(from)} → ${f.dayMonth(to)}`
        }${q ? ` · ${t(QUALITY_LABEL[q])}` : ''}${ops.some((o) => o.op === 'dates' && o.resplit) ? ` · ${t('compas.ouWhen.resplit')}` : ''}`,
      }),
      () => runOps(ctl, ops),
      undo ? () => runOps(ctl, undo) : undefined
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await commit(start);
  };

  /** Le calendrier EST le sélecteur de « Quand » : toucher un jour fixe le départ. */
  const pickDay = (iso: string) => {
    setStart(iso);
    if (iso !== m.dates.start || unit === 'hours' || days !== m.dates.days) void commit(iso);
  };

  const offset = calendar.length ? calendarOffset(calendar[0].date, weekFirst) : 0;
  const inRange = (iso: string) => Boolean(start && end && iso >= start && iso <= end);

  const plan = m.route.dayPlans.find((d) => d.day === focusDay) ?? m.route.dayPlans[0];

  return (
    <>
      {ctl.data.canEdit && (
        <form className="cp-when" onSubmit={save}>
          <label className="cp-field">
            {t('compas.ouWhen.start')}
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <div className="cp-field">
            <span>{t('compas.start.duration')}</span>
            <div className="cp-when__dur">
              <select
                aria-label={t('compas.ouWhen.unitLabel')}
                value={unit}
                onChange={(e) => setUnit(e.target.value === 'hours' ? 'hours' : 'days')}
              >
                <option value="days">{t('compas.ouWhen.unitDays')}</option>
                <option value="hours">{t('compas.ouWhen.unitHours')}</option>
              </select>
              {unit === 'days' ? (
                <input
                  aria-label={t('compas.ouRoute.numberOfDays')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TRIP_DAYS}
                  value={days}
                  onChange={(e) =>
                    setDays(
                      Math.max(1, Math.min(MAX_TRIP_DAYS, Math.round(Number(e.target.value) || 1)))
                    )
                  }
                />
              ) : (
                <input
                  aria-label={t('compas.ouWhen.numberOfHours')}
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  max={23.75}
                  step={0.25}
                  value={hours}
                  onChange={(e) =>
                    setHours(
                      Math.max(
                        0.25,
                        Math.min(23.75, Math.round((Number(e.target.value) || 0.25) * 4) / 4)
                      )
                    )
                  }
                />
              )}
            </div>
          </div>
          <p className="cp-note cp-when__note">
            {start && end
              ? `${unit === 'hours' ? `${f.dayMonth(start)} · ${f.hours(hours)}` : `${f.dayMonth(start)} → ${f.dayMonth(end)}`}${resplit ? ` · ${countText(t, locale, spanDays, 'compas.ouWhen.resplitIntoOne', 'compas.ouWhen.resplitIntoOther')}` : ''}`
              : t('compas.ouWhen.tapCalendar')}
          </p>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={!changed || ctl.busy}>
            {t('compas.ouWhen.save')}
          </button>
        </form>
      )}

      {calendar.length > 0 ? (
        <div className="cp-cal" aria-label={t('compas.ouWhen.calendarLabel')}>
          <div className="cp-cal__grid">
            {week.map((d, i) => (
              <span key={`h${i}`} className="cp-cal__wd" aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`o${i}`} aria-hidden="true" />
            ))}
            {calendar.map((c) => (
              <CalendarCell
                key={c.date}
                day={c}
                selected={inRange(c.date)}
                isStart={c.date === start}
                onPick={ctl.data.canEdit && !ctl.busy ? () => void pickDay(c.date) : undefined}
              />
            ))}
          </div>
          {start && end && (
            <p className="cp-cal__sum" aria-live="polite">
              <b>
                {unit === 'hours'
                  ? `${f.dayMonth(start)} · ${f.hours(hours)}`
                  : `${f.dayMonth(start)} → ${f.dayMonth(end)}`}
              </b>
              {(() => {
                const q = windowQuality(start, end);
                return q ? ` · ${t(QUALITY_LABEL[q])}` : '';
              })()}
              {calendar.length > 0 && start > calendar[calendar.length - 1].date
                ? ` · ${t('compas.ouWhen.beyondCalendar')}`
                : ''}
            </p>
          )}
          <p className="cp-cal__legend">
            <i data-q="bon" aria-hidden="true">
              {QUALITY_SHAPE.prevision.bon}
            </i>{' '}
            {t(QUALITY_WORD.bon)}{' '}
            <i data-q="moyen" aria-hidden="true">
              {QUALITY_SHAPE.prevision.moyen}
            </i>{' '}
            {t(QUALITY_WORD.moyen)}{' '}
            <i data-q="mauvais" aria-hidden="true">
              {QUALITY_SHAPE.prevision.mauvais}
            </i>{' '}
            {t(QUALITY_WORD.mauvais)} · {t('compas.ouWhen.legendShapes')}
          </p>
        </div>
      ) : (
        <p className="cp-note">
          {data.origin ? t('compas.ouWhen.conditionsDown') : t('compas.ouWhen.noOrigin')}
        </p>
      )}

      <PassageSection ctl={ctl} />

      {m.route.dayPlans.length > 0 && m.dates.start && (
        <>
          {m.route.dayPlans.length > 1 && (
            <div className="cp-chiprow" role="group" aria-label={t('compas.ouWhen.tripDay')}>
              {m.route.dayPlans.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  className="cp-pill"
                  aria-pressed={d.day === plan?.day}
                  onClick={() => setFocusDay(d.day)}
                >
                  {t('compas.ouDay.dayShort', { day: d.day })}
                </button>
              ))}
            </div>
          )}
          {plan && <DayDetail ctl={ctl} day={plan.day} />}
        </>
      )}
    </>
  );
}

function CalendarCell({
  day,
  selected,
  isStart,
  onPick,
}: {
  day: CalendarDay;
  selected: boolean;
  isStart: boolean;
  onPick?: () => void;
}) {
  const { t } = useTranslation();
  const f = useCompasFormat();
  const n = Number(day.date.slice(8, 10));
  const label = `${t('compas.ouWhen.cellLabel', {
    date: f.dayMonth(day.date),
    state: day.quality
      ? `${t(QUALITY_LABEL[day.quality])} (${day.kind === 'prevision' ? t('compas.ouWhen.forecast') : t('compas.ouWhen.trend')})`
      : t('compas.ouWhen.noData'),
  })}${day.reasons.length ? `, ${day.reasons.join(', ')}` : ''}`;
  return (
    <button
      type="button"
      className="cp-cal__d"
      data-q={day.quality ?? undefined}
      data-kind={day.kind}
      data-sel={selected ? '1' : undefined}
      data-start={isStart ? '1' : undefined}
      aria-label={label}
      aria-pressed={isStart}
      disabled={!onPick}
      onClick={onPick}
    >
      <span>{n === 1 ? f.firstOfMonth(day.date) : n}</span>
      <i aria-hidden="true">
        {day.quality && day.kind !== 'inconnu' ? QUALITY_SHAPE[day.kind][day.quality] : ''}
      </i>
    </button>
  );
}

function DayDetail({ ctl, day }: { ctl: CompasCtl; day: number }) {
  const m = ctl.data.model;
  const plan = m.route.dayPlans.find((d) => d.day === day);
  const tripDay = ctl.data.weather?.tripDays.find((d) => d.day === day) ?? null;
  const forecast = tripDay?.forecast ?? null;
  const trend = plan?.date
    ? ctl.data.weather?.calendar.find((c) => c.date === plan.date)
    : undefined;
  // Heure de la destination (fuseau retrouvé par le serveur), au-delà de la prévision aussi.
  const zone = ctl.data.zone ?? DEFAULT_TRAVELLER_ZONE;
  const here = useBrowserZone();
  const { t, locale } = useTranslation();
  const f = useCompasFormat();
  const units = useCompasUnits();

  const light = useMemo(() => {
    if (forecast?.sunrise && forecast.sunset)
      return { sunrise: forecast.sunrise, sunset: forecast.sunset, source: t('compas.ouDay.sourceSunCalc') };
    if (plan?.date && plan.lat != null && plan.lon != null) {
      return {
        ...daylightClock(plan.lat, plan.lon, plan.date, zone),
        source: t('compas.ouDay.sourceAstro'),
      };
    }
    return null;
  }, [forecast, plan, zone, t]);

  if (!plan) return null;
  // Destination à une autre heure que le navigateur : on le dit (« heure locale »).
  const away = plan.date
    ? differentClock(ctl.data.zone, here, new Date(`${plan.date}T12:00:00Z`))
    : false;
  const advice = departureAdvice({
    walkMin: plan.walkMin,
    sunrise: light?.sunrise ?? null,
    sunset: light?.sunset ?? null,
    hours: forecast?.hours ?? [],
  });
  const freezing = forecast ? morningFreezingLevel(forecast.hours) : null;
  const q = forecast ? dayQuality(forecast) : null;
  const w = forecast?.code != null ? weatherLabel(forecast.code, locale) : null;
  const shownHours = (forecast?.hours ?? []).filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    const from = light?.sunrise ? Number(light.sunrise.slice(0, 2)) - 1 : 6;
    const to = light?.sunset ? Number(light.sunset.slice(0, 2)) + 1 : 21;
    return hh >= Math.max(4, from) && hh <= Math.min(23, to);
  });

  return (
    <section className="cp-dayd" aria-label={t('compas.ouDay.day', { day: plan.day })}>
      <div className="cp-dayd__h">
        <b>
          {t('compas.ouDay.dayShort', { day: plan.day })}
          {plan.date ? ` · ${f.dayMonth(plan.date)}` : ''}
        </b>
        <span>{plan.title}</span>
      </div>

      {forecast ? (
        <div className="cp-dayd__chips">
          {w && <Chip icon={w.icon}>{w.label}</Chip>}
          {forecast.tMin != null && forecast.tMax != null && (
            <Chip icon="thermometer">
              {f.degrees(forecast.tMin)} / {f.degrees(forecast.tMax)}
            </Chip>
          )}
          {forecast.precipPct != null && (
            <Chip icon="droplet" tone={forecast.precipPct >= 60 ? 'warn' : undefined}>
              {forecast.precipPct} %
            </Chip>
          )}
          {forecast.gustMax != null && (
            <Chip icon="wind" tone={forecast.gustMax >= 60 ? 'warn' : undefined}>
              {Math.round(forecast.gustMax)} km/h
            </Chip>
          )}
          {freezing != null && <Chip icon="mountain">{units.temperature === 'f' ? t('compas.units.freezingAt', { temp: f.temp(0), altitude: f.meters(freezing) }) : t('compas.ouDay.freezingAt', { altitude: f.meters(freezing) })}</Chip>}
          {q && (
            <Chip tone={q.quality === 'bon' ? 'good' : q.quality === 'moyen' ? 'warn' : 'bad'}>
              {t(QUALITY_WORD[q.quality])}
            </Chip>
          )}
        </div>
      ) : (
        <p className="cp-note">
          {trend?.kind === 'tendance'
            ? t('compas.ouDay.trendNote', {
                trend: `${trend.quality ? t(QUALITY_LABEL[trend.quality]) : t('compas.ouDay.unknownQuality')}${
                  trend.tMin != null && trend.tMax != null
                    ? `, ${f.degrees(trend.tMin)} / ${f.degrees(trend.tMax)}`
                    : ''
                }${trend.reasons.length ? ` (${trend.reasons.join(', ')})` : ''}`,
              })
            : t('compas.ouDay.hourlyLater')}
        </p>
      )}

      <dl className="cp-kv">
        <dt>{t('compas.ouDay.walk')}</dt>
        <dd>
          {plan.walkMin != null
            ? t('compas.ouDay.walkLine', {
                duration: f.duration(plan.walkMin),
                distance: f.km(plan.distanceKm),
                pace: t(PACE_KEY[m.preferences.pace]),
              })
            : t('compas.ouDay.unknownDistance')}
        </dd>
        {light && (
          <>
            <dt>{t('compas.ouDay.light')}</dt>
            <dd>
              {light.sunrise ?? '—'} – {light.sunset ?? '—'}
              {away ? ` · ${t('compas.ouDay.localTime')}` : ''}
            </dd>
          </>
        )}
        {advice.start && (
          <>
            <dt>{t('compas.ouDay.suggestedStart')}</dt>
            <dd>
              {advice.start} · {t('compas.ouDay.arrivalAround', { time: advice.arrival ?? '—' })}
            </dd>
          </>
        )}
        {advice.latestStart && (
          <>
            <dt>{t('compas.ouDay.latestStart')}</dt>
            <dd>{advice.latestStart}</dd>
          </>
        )}
      </dl>
      {advice.warning && (
        <p className="cp-note cp-note--warn" role="status">
          <Icon name="alert-triangle" size={14} /> {advice.warning}
        </p>
      )}

      {shownHours.length > 0 && (
        <div className="cp-hours" aria-label={t('compas.ouDay.hourly')}>
          {shownHours.map((h) => {
            const hq = hourQuality(h);
            const hw = h.code != null ? weatherLabel(h.code, locale) : null;
            return (
              <span
                key={h.time}
                className="cp-hour"
                data-q={hq.quality}
                title={hq.reasons.join(', ') || undefined}
              >
                <small>{t('compas.ouDay.hour', { hour: h.time.slice(11, 13) })}</small>
                {hw && <Icon name={hw.icon} size={16} />}
                <b>{f.degrees(h.tempC)}</b>
                <small>{h.precipPct != null ? `${h.precipPct} %` : '—'}</small>
                {/* La qualité de l'heure en texte (et une forme), pas seulement en teinte. */}
                <i className="cp-hour__q" aria-hidden="true">
                  {QUALITY_SHAPE.prevision[hq.quality]}
                </i>
                <span className="sr-only">
                  {t(QUALITY_LABEL[hq.quality])}
                  {hq.reasons.length ? ` : ${hq.reasons.join(', ')}` : ''}
                </span>
              </span>
            );
          })}
        </div>
      )}
      <p className="cp-sub">{t('compas.ouDay.sources', { light: light?.source ?? '—' })}</p>
    </section>
  );
}

/* ---------- Envies : rythme, nuits, éviter, envies ---------- */

/** Rythme : l'identifiant enregistré reste français, le mot affiché se traduit. */
const PACE_KEY: Record<Pace, TranslationKey> = {
  tranquille: 'compas.ouDay.paceEasy',
  normal: 'compas.ouDay.paceNormal',
  soutenu: 'compas.ouDay.paceBrisk',
};
const NIGHT_OPTIONS: Array<{ id: CompasNights; label: TranslationKey; icon: string }> = [
  { id: 'bivouac', label: 'compas.ouPrefs.nightBivouac', icon: 'tent' },
  { id: 'refuge', label: 'compas.ouPrefs.nightRefuge', icon: 'home' },
  { id: 'hebergement', label: 'compas.ouPrefs.nightLodging', icon: 'bed-double' },
  { id: 'mixte', label: 'compas.ouPrefs.nightMixed', icon: 'layers' },
];
/** Suggestions proposées dans la langue de l'écran (elles deviennent le texte de l'envie). */
const AVOID_SUGGESTIONS: TranslationKey[] = [
  'compas.ouPrefs.avoidCrowds',
  'compas.ouPrefs.avoidRoads',
  'compas.ouPrefs.avoidExposed',
  'compas.ouPrefs.avoidClimb',
];
const WISH_SUGGESTIONS: TranslationKey[] = [
  'compas.ouPrefs.wishLake',
  'compas.ouPrefs.wishSummit',
  'compas.ouPrefs.wishView',
  'compas.ouPrefs.wishSwim',
];

export function PreferencesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const prefs = m.preferences;
  const edit = ctl.data.canEdit;
  const { t, locale } = useTranslation();
  const save = (next: typeof prefs, message: string) =>
    void ctl.run(
      message,
      () => compasSetPreferencesAction({ tripId: m.tripId, tripSlug: m.slug, preferences: next }),
      () => compasSetPreferencesAction({ tripId: m.tripId, tripSlug: m.slug, preferences: prefs })
    );

  return (
    <>
      <div className="cp-prefs__block">
        <span className="cp-prefs__l">{t('compas.ouPrefs.pace')}</span>
        <Segments
          label={t('compas.ouPrefs.pace')}
          value={prefs.pace}
          onChange={(pace) =>
            edit && pace !== prefs.pace && save({ ...prefs, pace }, t('compas.ouPrefs.paceChanged', { pace: t(PACE_KEY[pace]) }))
          }
          options={(['tranquille', 'normal', 'soutenu'] as const).map((id) => ({
            id,
            label: capitalize(t(PACE_KEY[id])),
          }))}
        />
        <p className="cp-sub">{t('compas.ouPrefs.paceNote')}</p>
      </div>

      <div className="cp-prefs__block">
        <span className="cp-prefs__l">{t('compas.ouPrefs.nights')}</span>
        <div className="cp-chiprow" role="group" aria-label={t('compas.ouPrefs.nights')}>
          {NIGHT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="cp-pill"
              aria-pressed={prefs.nights === o.id}
              disabled={!edit || ctl.busy}
              onClick={() =>
                save(
                  { ...prefs, nights: prefs.nights === o.id ? null : o.id },
                  prefs.nights === o.id
                    ? t('compas.ouPrefs.nightsUndecided')
                    : t('compas.ouPrefs.nightsChanged', { nights: t(o.label).toLowerCase() })
                )
              }
            >
              <Icon name={o.icon} size={13} />
              {t(o.label)}
            </button>
          ))}
        </div>
        {m.route.nightsToFind > 0 && (
          <p className="cp-sub">
            {countText(t, locale, m.route.nightsToFind, 'compas.ouPrefs.nightsToFindOne', 'compas.ouPrefs.nightsToFindOther')}
          </p>
        )}
      </div>

      <ProjectBlock ctl={ctl} save={save} />

      <TagEditor
        title={t('compas.ouPrefs.avoid')}
        values={prefs.avoid}
        suggestions={AVOID_SUGGESTIONS.map((k) => t(k))}
        edit={edit && !ctl.busy}
        onChange={(avoid, msg) => save({ ...prefs, avoid }, msg)}
      />
      <TagEditor
        title={t('compas.ouPrefs.wishes')}
        values={prefs.wishes}
        suggestions={WISH_SUGGESTIONS.map((k) => t(k))}
        edit={edit && !ctl.busy}
        onChange={(wishes, msg) => save({ ...prefs, wishes }, msg)}
      />
      <p className="cp-sub">{t('compas.ouPrefs.wishesNote')}</p>
      {!edit && (
        <p className="cp-note">
          {t('compas.ouPrefs.readOnly')}{' '}
          <button
            type="button"
            className="cp-linkbtn"
            onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'qui' })}
          >
            {t('compas.ouPrefs.seeGroup')}
          </button>
        </p>
      )}
    </>
  );
}

const LEVEL_OPTIONS: Array<{ id: CompasLevel; label: TranslationKey }> = [
  { id: 'debut', label: 'compas.ouPrefs.levelBeginner' },
  { id: 'regulier', label: 'compas.ouPrefs.levelRegular' },
  { id: 'aguerri', label: 'compas.ouPrefs.levelSeasoned' },
];
const TERRAIN_OPTIONS: Array<{ id: CompasTerrain; label: TranslationKey }> = [
  { id: 'sentier', label: 'compas.ouPrefs.terrainTrails' },
  { id: 'montagne', label: 'compas.ouPrefs.terrainMountain' },
  { id: 'hors_sentier', label: 'compas.ouPrefs.terrainOffTrail' },
  { id: 'itinerance', label: 'compas.ouPrefs.terrainRoaming' },
];

/** D'où vient la valeur : « ton profil », « réglé pour ce projet », « proposé ». */
function SourceNote({ field }: { field: CtxField<unknown> }) {
  const { locale } = useTranslation();
  if (field.value == null) return null;
  return (
    <span className="cp-src" data-src={field.source}>
      {sourceLabel(field.source, locale)}
      {field.why ? ` · ${field.why}` : ''}
    </span>
  );
}

/**
 * Ce projet : niveau, terrain, nuits dehors, poids max. Chaque valeur montre
 * sa source ; le profil propose, le projet décide (« Comme mon profil » retire
 * le réglage propre au projet).
 */
function ProjectBlock({
  ctl,
  save,
}: {
  ctl: CompasCtl;
  save: (next: CompasCtl['data']['model']['preferences'], message: string) => void;
}) {
  const ctx = ctl.data.context;
  const prefs = ctl.data.model.preferences;
  const edit = ctl.data.canEdit && !ctl.busy;
  const { t, locale } = useTranslation();
  const [kg, setKg] = useState(prefs.maxPackKg != null ? String(prefs.maxPackKg) : '');
  if (!ctx) return null;
  const nightsCount = ctx.modules.nights ? Math.max(0, (ctl.data.model.dates.days ?? ctl.data.plannedDays ?? 1) - 1) : 0;
  const setKgValue = () => {
    const n = Number(kg.replace(',', '.'));
    const next = kg.trim() === '' ? null : Number.isFinite(n) && n >= 1 && n <= 40 ? Math.round(n * 10) / 10 : undefined;
    if (next === undefined || next === (prefs.maxPackKg ?? null)) return;
    save({ ...prefs, maxPackKg: next }, next == null ? t('compas.ouPrefs.maxWeightRemoved') : t('compas.ouPrefs.baseUnder', { kg: compasFormat(locale).decimal(next) }));
  };
  return (
    <>
      {ctx.adaptations.length > 0 && (
        <ul className="cp-adapt" aria-label={t('compas.ouPrefs.adapted')}>
          {ctx.adaptations.map((a) => (
            <li key={a.field}>{adaptationTextFor(a, locale)}</li>
          ))}
        </ul>
      )}

      <div className="cp-prefs__block">
        <span className="cp-prefs__l">
          {t('compas.ouPrefs.level')} <SourceNote field={ctx.level} />
        </span>
        <div className="cp-chiprow" role="group" aria-label={t('compas.ouPrefs.level')}>
          {LEVEL_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="cp-pill"
              aria-pressed={ctx.level.value === o.id}
              disabled={!edit}
              onClick={() =>
                save(
                  { ...prefs, level: prefs.level === o.id ? null : o.id },
                  prefs.level === o.id
                    ? t('compas.ouPrefs.levelAsProfile')
                    : t('compas.ouPrefs.levelChanged', { level: t(o.label).toLowerCase() })
                )
              }
            >
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>

      {ctx.scope !== 'sortie' && (
        <div className="cp-prefs__block">
          <span className="cp-prefs__l">
            {t('compas.ouPrefs.terrain')} <SourceNote field={ctx.terrain} />
          </span>
          <div className="cp-chiprow" role="group" aria-label={t('compas.ouPrefs.terrain')}>
            {TERRAIN_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="cp-pill"
                aria-pressed={ctx.terrain.value === o.id}
                disabled={!edit}
                onClick={() =>
                  save(
                    { ...prefs, terrain: prefs.terrain === o.id ? null : o.id },
                    prefs.terrain === o.id
                      ? t('compas.ouPrefs.terrainAsProfile')
                      : t('compas.ouPrefs.terrainChanged', { terrain: t(o.label).toLowerCase() })
                  )
                }
              >
                {t(o.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {ctx.modules.transport && (
        <div className="cp-prefs__block">
          <span className="cp-prefs__l">{t('compas.ouPrefs.transport')}</span>
          <div className="cp-chiprow" role="group" aria-label={t('compas.ouPrefs.transport')}>
            <button
              type="button"
              className="cp-pill"
              aria-pressed={prefs.carFree === true}
              disabled={!edit}
              onClick={() =>
                save(
                  { ...prefs, carFree: prefs.carFree === true ? null : true },
                  prefs.carFree === true ? t('compas.ouPrefs.carAgain') : t('compas.understood.carFree')
                )
              }
            >
              {t('compas.ouPrefs.carFree')}
            </button>
          </div>
          <p className="cp-sub">{t('compas.ouPrefs.carFreeNote')}</p>
        </div>
      )}

      {nightsCount > 0 && (
        <div className="cp-prefs__block">
          <span className="cp-prefs__l">{t('compas.ouPrefs.outdoorNights')}</span>
          <div className="cp-chiprow" role="group" aria-label={t('compas.ouPrefs.outdoorNights')}>
            {Array.from({ length: Math.min(nightsCount, 7) + 1 }, (_, n) => n).map((n) => (
              <button
                key={n}
                type="button"
                className="cp-pill"
                aria-pressed={(prefs.outdoorNights ?? 0) === n}
                disabled={!edit}
                onClick={() =>
                  (prefs.outdoorNights ?? 0) !== n &&
                  save(
                    { ...prefs, outdoorNights: n === 0 ? null : n },
                    n === 0
                      ? t('compas.ouPrefs.noOutdoorNights')
                      : countText(t, locale, n, 'compas.ouPrefs.outdoorNightsOne', 'compas.ouPrefs.outdoorNightsOther')
                  )
                }
              >
                {n === 0 ? t('compas.ouPrefs.outdoorFree') : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {ctx.modules.fullPack && (
        <div className="cp-prefs__block">
          <span className="cp-prefs__l" id="cp-maxpack-l">
            {t('compas.ouPrefs.maxPack')}
          </span>
          <label className="cp-field">
            <input
              aria-labelledby="cp-maxpack-l"
              inputMode="decimal"
              placeholder={t('compas.ouPrefs.noLimit')}
              value={kg}
              disabled={!edit}
              onChange={(e) => setKg(e.target.value)}
              onBlur={setKgValue}
              onKeyDown={(e) => e.key === 'Enter' && setKgValue()}
            />
          </label>
          <p className="cp-sub">{t('compas.ouPrefs.maxPackNote')}</p>
        </div>
      )}
    </>
  );
}

function TagEditor({
  title,
  values,
  suggestions,
  edit,
  onChange,
}: {
  title: string;
  values: string[];
  suggestions: string[];
  edit: boolean;
  onChange: (next: string[], message: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const { t } = useTranslation();
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (v: string) => {
    const value = v.trim().slice(0, 40);
    if (!value || has(value) || values.length >= 8) return;
    onChange([...values, value], t('compas.ouPrefs.tagAdded', { title, value }));
    setDraft('');
  };
  const free = suggestions.filter((s) => !has(s));
  return (
    <div className="cp-prefs__block">
      <span className="cp-prefs__l">{title}</span>
      <div className="cp-chiprow" role="group" aria-label={title}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className="cp-pill"
            aria-pressed
            disabled={!edit}
            aria-label={t('compas.ouPrefs.removeTag', { value: v })}
            onClick={() =>
              onChange(
                values.filter((x) => x !== v),
                t('compas.ouPrefs.tagRemoved', { value: v })
              )
            }
          >
            {v}
            <Icon name="x" size={12} />
          </button>
        ))}
        {edit &&
          values.length < 8 &&
          free.slice(0, 4).map((s) => (
            <button key={s} type="button" className="cp-pill" onClick={() => add(s)}>
              <Icon name="plus" size={12} />
              {s}
            </button>
          ))}
      </div>
      {edit && values.length < 8 && (
        <form
          className="cp-searchrow"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
        >
          <label className="cp-field">
            <span className="sr-only">{t('compas.ouPrefs.addLabel', { title })}</span>
            <input
              value={draft}
              maxLength={40}
              placeholder={t('compas.ouPrefs.addPlaceholder', { title })}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="cp-ibtn cp-glass"
            aria-label={t('compas.ouPrefs.addButton', { title })}
            disabled={!draft.trim()}
          >
            <Icon name="plus" size={17} />
          </button>
        </form>
      )}
    </div>
  );
}
