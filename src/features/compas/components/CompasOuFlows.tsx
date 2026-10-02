'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasNights } from '../engine/compasModel';
import {
  activityLabel,
  addDaysIso,
  formatDayMonth,
  formatDuration,
  formatHours,
  formatKm,
  formatMeters,
  formatMoney,
  weatherLabel,
} from '../engine/format';
import {
  COMPAS_ACTIVITIES,
  MAX_TRIP_DAYS,
  planApplication,
  type CompasActivity,
} from '../engine/intent';
import { daylightClock } from '../engine/sun';
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
import { Chip, PagedList, Segments } from './CompasPrimitives';
import { compasNearbyActivitiesAction } from '../server/resaActions';
import type { CompasStayOffer } from '../engine/stays';
import { mixParcours } from '../engine/parcoursMix';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import type { CompasCtl, FlowHint } from './compasTypes';

const TIME_ZONE = 'Europe/Paris';
const staticRow = { cursor: 'default' } as const;

/* =============================================================================
   Où et quand — les quatre parcours du tiroir, dans l'ordre de la maquette :
   Activité → Parcours → Quand → Envies (rythme, nuits, éviter, envies).
   ============================================================================= */

/* ---------- Activité ---------- */

export const ACTIVITY_META: Record<CompasActivity, { icon: string; hint: string }> = {
  hiking: { icon: 'footprints', hint: 'À la journée ou sur quelques jours' },
  trekking: { icon: 'mountain', hint: 'Itinérance, sac complet' },
  bivouac: { icon: 'tent', hint: 'Nuits sous tente' },
  roadtrip: { icon: 'car', hint: 'Étapes en véhicule' },
  cultural: { icon: 'building', hint: 'Villes et visites' },
  bushcraft: { icon: 'flame', hint: 'Vie en forêt' },
  mixed: { icon: 'compass', hint: 'Plusieurs activités' },
};

export function ActiviteFlow({ ctl }: { ctl: CompasCtl }) {
  const { activity, tripId, slug } = ctl.data.model;
  const pick = (a: CompasActivity) => {
    if (!ctl.data.canEdit || a === activity) return;
    const undo = inverseOps(ctl, [{ op: 'activity', activity: a }]);
    void ctl.run(
      `Activité : ${activityLabel(a)}`,
      () => compasSetActivityAction({ tripId, tripSlug: slug, activity: a }),
      undo ? () => runOps(ctl, undo) : undefined
    );
  };
  const current = COMPAS_ACTIVITIES.find((a) => a === activity);
  // Maquette finale : les activités en tuiles (icône + nom), quatre par
  // ligne ; la description de l'activité choisie se lit sous la grille.
  return (
    <>
      <div className="cp-tiles" role="group" aria-label="Activités">
        {COMPAS_ACTIVITIES.map((a) => {
          const on = a === activity;
          return (
            <button
              key={a}
              type="button"
              className="cp-tile"
              aria-pressed={on}
              title={ACTIVITY_META[a].hint}
              disabled={!ctl.data.canEdit || ctl.busy}
              onClick={() => pick(a)}
            >
              <Icon name={ACTIVITY_META[a].icon} size={20} />
              <span>{activityLabel(a)}</span>
            </button>
          );
        })}
      </div>
      <p className="cp-note">
        {current
          ? `${activityLabel(current)} : ${ACTIVITY_META[current].hint.toLowerCase()}.`
          : 'Aucune activité choisie.'}{' '}
        Le choix règle le matériel proposé et les règles de sécurité du verdict.
      </p>
    </>
  );
}

/* ---------- Parcours ---------- */

type RouteMode = 'etapes' | 'autour' | 'mes' | 'cherche';

export function ParcoursFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
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
          const pos = { lat: p.coords.latitude, lon: p.coords.longitude, gps: true };
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
    if (next === 'etapes' || next === 'mes') loadPartners(null);
    if (next === 'etapes') return;
    setResults({ status: 'loading', routes: [] });
    try {
      const at = next === 'autour' ? await locate() : here;
      if (next === 'autour' && !at) {
        setResults({
          status: 'error',
          routes: [],
          error: 'Position indisponible : autorise la localisation ou cherche un lieu.',
        });
        return;
      }
      const res =
        next === 'mes'
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
      if (next !== 'mes')
        loadPartners(
          next === 'cherche'
            ? q.trim() || null
            : (m.destination ?? (res.success ? (res.routes[0]?.region ?? null) : null))
        );
    } catch {
      setResults({ status: 'error', routes: [], error: 'Connexion perdue : réessaie.' });
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
    { id: 'etapes', label: `Étapes${data.itinerary.length ? ` · ${data.itinerary.length}` : ''}` },
    { id: 'autour' as const, label: 'Autour · 50 km' },
    { id: 'mes', label: 'Mes randos' },
  ];

  return (
    <>
      <div className="cp-sumline">
        <span>
          <b>{data.route.name ?? (data.itinerary.length ? 'Parcours libre' : 'Aucun parcours')}</b>
          {m.route.stepsCount > 0 && (
            <>
              {' '}
              · {formatKm(m.route.distanceKm)} · D+ {formatMeters(m.route.elevationGainM)}
            </>
          )}
        </span>
        {data.route.id != null && <Chip icon="map-pin">catalogue</Chip>}
      </div>

      <form className="cp-searchrow" onSubmit={onSearch} role="search">
        <label className="cp-field">
          <span className="sr-only">Chercher un parcours</span>
          <input
            type="search"
            value={query}
            maxLength={80}
            placeholder="Lieu, massif ou nom du parcours"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="cp-ibtn cp-glass"
          aria-label="Chercher"
          disabled={query.trim().length < 3}
        >
          <Icon name="search" size={17} />
        </button>
      </form>

      <div className="cp-chiprow" role="group" aria-label="Sources de parcours">
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
        <PagedList
          label="Étapes du parcours"
          resetKey="etapes"
          items={data.itinerary}
          empty={
            <p className="cp-note">
              Aucune étape : choisis un parcours autour de toi, dans tes randos, ou cherche un lieu.
            </p>
          }
          render={(s) => (
            <div key={s.id} className="cp-row" style={staticRow}>
              <span className="cp-thumb" aria-hidden="true">
                <b>{s.day}</b>
              </span>
              <span className="cp-row__t">
                <b>{s.title}</b>
                <span>
                  Jour {s.day} · {formatKm(s.distanceKm)} · D+ {formatMeters(s.elevationGainM)}
                </span>
              </span>
              <span className="cp-row__end">
                {s.accommodation && <Chip icon="bed-double">{s.accommodation}</Chip>}
              </span>
            </div>
          )}
        />
      ) : results.status === 'loading' ? (
        <p className="cp-note" aria-live="polite">
          Recherche dans le catalogue LKDV…
        </p>
      ) : results.status === 'error' ? (
        <p className="cp-note" role="alert">
          {results.error}
        </p>
      ) : (
        <>
          {mode === 'autour' && (
            <p className="cp-sub">
              {results.routes.length} parcours à moins de 50 km{' '}
              {here?.gps ? 'de toi' : 'du départ du voyage'}, du plus proche au plus loin
            </p>
          )}
          <PagedList
            label="Parcours trouvés"
            resetKey={`${mode}-${query}`}
            items={mixParcours(results.routes, mode === 'mes' ? [] : partners)}
            empty={
              <p className="cp-note">
                {mode === 'mes'
                  ? 'Aucune sortie enregistrée sur un parcours du catalogue pour l’instant.'
                  : mode === 'autour'
                    ? 'Aucun parcours du catalogue à moins de 50 km.'
                    : 'Aucun parcours ne correspond à cette recherche.'}
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
                          ? `dès ${formatMoney(a.amount, a.currency)}`
                          : 'prix chez le partenaire'}
                      </span>
                    </span>
                    <span className="cp-row__end">
                      <Chip>Partenaire</Chip>
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
                      formatKm(r.distanceKm),
                      r.elevationGainM ? `D+ ${formatMeters(r.elevationGainM)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="cp-row__end">
                  {r.mine ? (
                    <Chip tone="good">fait ×{r.mine.count}</Chip>
                  ) : r.communitySessions > 0 ? (
                    <Chip icon="users">{r.communitySessions}</Chip>
                  ) : r.distanceFromKm != null ? (
                    <span className="cp-sub">à {Math.round(r.distanceFromKm)} km</span>
                  ) : null}
                  <Icon name="chevron-right" size={16} />
                </span>
              </button>);
            }}
          />
          {partners.length > 0 && mode !== 'mes' && <AffiliateDisclosure compact />}
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
  const fixedDays = m.dates.days;
  const [days, setDays] = useState(fixedDays ?? 1);
  const choose = async () => {
    const ok = await ctl.run(
      `Parcours choisi · découpé en ${days} jour${days > 1 ? 's' : ''}`,
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
        <dt>Distance</dt>
        <dd>{formatKm(route.distanceKm)}</dd>
        <dt>Dénivelé positif</dt>
        <dd>{route.elevationGainM ? formatMeters(route.elevationGainM) : 'non renseigné'}</dd>
        <dt>Durée indiquée</dt>
        <dd>{route.durationHours ? formatDuration(route.durationHours * 60) : 'non renseignée'}</dd>
        {route.difficulty && (
          <>
            <dt>Difficulté</dt>
            <dd>{route.difficulty}</dd>
          </>
        )}
        <dt>Communauté</dt>
        <dd>
          {route.communitySessions
            ? `${route.communitySessions} sortie${route.communitySessions > 1 ? 's' : ''} publique${route.communitySessions > 1 ? 's' : ''}`
            : 'aucune sortie publique'}
        </dd>
        {route.mine && (
          <>
            <dt>Toi</dt>
            <dd>
              {route.mine.count} fois
              {route.mine.last
                ? ` · dernière le ${formatDayMonth(route.mine.last.slice(0, 10))}`
                : ''}
            </dd>
          </>
        )}
      </dl>
      {fixedDays ? (
        <p className="cp-note">
          Découpé en {fixedDays} jour{fixedDays > 1 ? 's' : ''}, comme tes dates.
        </p>
      ) : (
        <div className="cp-stepper" role="group" aria-label="Nombre de jours">
          <span>Découper en</span>
          <button
            type="button"
            className="cp-ibtn cp-ibtn--sm cp-glass"
            aria-label="Un jour de moins"
            disabled={days <= 1}
            onClick={() => setDays(days - 1)}
          >
            <Icon name="minus" size={14} />
          </button>
          <b>
            {days} jour{days > 1 ? 's' : ''}
          </b>
          <button
            type="button"
            className="cp-ibtn cp-ibtn--sm cp-glass"
            aria-label="Un jour de plus"
            disabled={days >= MAX_TRIP_DAYS}
            onClick={() => setDays(days + 1)}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      )}
      <p className="cp-note">
        Tes étapes gardent leurs titres et hébergements ; la distance de chaque jour vient du tracé
        réel. Le dénivelé est réparti à parts égales entre les jours.
      </p>
      <div className="cp-actions">
        <button type="button" className="cp-btn cp-btn--soft" onClick={onBack}>
          <Icon name="chevron-left" size={16} />
          Retour
        </button>
        {ctl.data.canEdit && (
          <button
            type="button"
            className="cp-btn cp-btn--pg cp-btn--block"
            disabled={ctl.busy}
            onClick={() => void choose()}
          >
            <Icon name="check" size={16} />
            Choisir ce parcours
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Quand ---------- */

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const QUALITY_LABEL = {
  bon: 'bonnes conditions',
  moyen: 'conditions moyennes',
  mauvais: 'mauvaises conditions',
} as const;

function todayParis(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function QuandFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
  const weather = data.weather;
  const today = weather?.calendar[0]?.date ?? todayParis();
  const initialHours =
    hint?.hours ?? (m.dates.hours != null && m.dates.hours < 24 ? m.dates.hours : null);
  const [start, setStart] = useState(m.dates.start ?? '');
  const [unit, setUnit] = useState<'jours' | 'heures'>(
    initialHours != null && initialHours < 24 ? 'heures' : 'jours'
  );
  const [days, setDays] = useState(
    hint?.hours != null && hint.hours >= 24 ? hint.hours / 24 : (m.dates.days ?? 1)
  );
  const [hours, setHours] = useState(initialHours != null && initialHours < 24 ? initialHours : 4);
  const [focusDay, setFocusDay] = useState(m.route.dayPlans[0]?.day ?? 1);

  const spanDays = unit === 'heures' ? 1 : days;
  const end = start ? addDaysIso(start, spanDays - 1) : null;
  const changed =
    Boolean(start) &&
    (start !== m.dates.start ||
      end !== m.dates.end ||
      (unit === 'heures' ? hours !== m.dates.hours : m.dates.hours != null && m.dates.hours < 24));
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
      ctl.notify(from ? 'Date passée' : 'Choisis un jour de départ', 'bad');
      return;
    }
    const ops = planApplication(
      [
        { type: 'set_dates', start: from, end: null },
        {
          type: 'set_duration',
          days: unit === 'jours' ? days : null,
          hours: unit === 'heures' ? hours : null,
        },
      ],
      applyCurrent(ctl)
    );
    const to = addDaysIso(from, spanDays - 1);
    const q = windowQuality(from, to);
    // Annulable tant que le parcours n'est pas redécoupé (même règle que la règle de durée).
    const undo = inverseOps(ctl, ops);
    await ctl.run(
      `Quand : ${
        unit === 'heures'
          ? `${formatDayMonth(from)} · ${formatHours(hours)}`
          : `${formatDayMonth(from)} → ${formatDayMonth(to)}`
      }${q ? ` · ${QUALITY_LABEL[q]}` : ''}${ops.some((o) => o.op === 'dates' && o.resplit) ? ' · parcours redécoupé' : ''}`,
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
    if (iso !== m.dates.start || unit === 'heures' || days !== m.dates.days) void commit(iso);
  };

  const offset = calendar.length
    ? (new Date(`${calendar[0].date}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const inRange = (iso: string) => Boolean(start && end && iso >= start && iso <= end);

  const plan = m.route.dayPlans.find((d) => d.day === focusDay) ?? m.route.dayPlans[0];

  return (
    <>
      {ctl.data.canEdit && (
        <form className="cp-when" onSubmit={save}>
          <label className="cp-field">
            Départ
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <div className="cp-field">
            <span>Durée</span>
            <div className="cp-when__dur">
              <select
                aria-label="Unité de durée"
                value={unit}
                onChange={(e) => setUnit(e.target.value === 'heures' ? 'heures' : 'jours')}
              >
                <option value="jours">jours</option>
                <option value="heures">heures</option>
              </select>
              {unit === 'jours' ? (
                <input
                  aria-label="Nombre de jours"
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
                  aria-label="Nombre d’heures"
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
              ? `${unit === 'heures' ? `${formatDayMonth(start)} · ${formatHours(hours)}` : `${formatDayMonth(start)} → ${formatDayMonth(end)}`}${resplit ? ` · parcours redécoupé en ${spanDays} jour${spanDays > 1 ? 's' : ''}` : ''}`
              : 'Touche un jour du calendrier : c’est ton départ.'}
          </p>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={!changed || ctl.busy}>
            Enregistrer
          </button>
        </form>
      )}

      {calendar.length > 0 ? (
        <div className="cp-cal" aria-label="Conditions sur six semaines au départ">
          <div className="cp-cal__grid">
            {WEEK.map((d, i) => (
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
                {unit === 'heures'
                  ? `${formatDayMonth(start)} · ${formatHours(hours)}`
                  : `${formatDayMonth(start)} → ${formatDayMonth(end)}`}
              </b>
              {(() => {
                const q = windowQuality(start, end);
                return q ? ` · ${QUALITY_LABEL[q]}` : '';
              })()}
              {calendar.length > 0 && start > calendar[calendar.length - 1].date
                ? ' · au-delà du calendrier (six semaines)'
                : ''}
            </p>
          )}
          <p className="cp-cal__legend">
            <i data-q="bon" /> bon <i data-q="moyen" /> moyen <i data-q="mauvais" /> mauvais · plein
            : prévision 16 j · cerclé : tendance des 5 dernières années · Open-Meteo
          </p>
        </div>
      ) : (
        <p className="cp-note">
          {data.origin
            ? 'Conditions indisponibles pour l’instant (Open-Meteo ne répond pas).'
            : 'Ajoute un point de départ au parcours pour voir les conditions jour par jour.'}
        </p>
      )}

      {m.route.dayPlans.length > 0 && m.dates.start && (
        <>
          {m.route.dayPlans.length > 1 && (
            <div className="cp-chiprow" role="group" aria-label="Jour du voyage">
              {m.route.dayPlans.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  className="cp-pill"
                  aria-pressed={d.day === plan?.day}
                  onClick={() => setFocusDay(d.day)}
                >
                  J{d.day}
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
  const n = Number(day.date.slice(8, 10));
  const label = `${formatDayMonth(day.date)} : ${
    day.quality
      ? `${QUALITY_LABEL[day.quality]} (${day.kind === 'prevision' ? 'prévision' : 'tendance'})`
      : 'pas de donnée'
  }${day.reasons.length ? `, ${day.reasons.join(', ')}` : ''}`;
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
      <span>{n === 1 ? `1 ${formatDayMonth(day.date).split(' ')[2]}` : n}</span>
      <i aria-hidden="true" />
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

  const light = useMemo(() => {
    if (forecast?.sunrise && forecast.sunset)
      return { sunrise: forecast.sunrise, sunset: forecast.sunset, source: 'Open-Meteo' };
    if (plan?.date && plan.lat != null && plan.lon != null) {
      return {
        ...daylightClock(plan.lat, plan.lon, plan.date, TIME_ZONE),
        source: 'calcul astronomique',
      };
    }
    return null;
  }, [forecast, plan]);

  if (!plan) return null;
  const advice = departureAdvice({
    walkMin: plan.walkMin,
    sunrise: light?.sunrise ?? null,
    sunset: light?.sunset ?? null,
    hours: forecast?.hours ?? [],
  });
  const freezing = forecast ? morningFreezingLevel(forecast.hours) : null;
  const q = forecast ? dayQuality(forecast) : null;
  const w = forecast?.code != null ? weatherLabel(forecast.code) : null;
  const shownHours = (forecast?.hours ?? []).filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    const from = light?.sunrise ? Number(light.sunrise.slice(0, 2)) - 1 : 6;
    const to = light?.sunset ? Number(light.sunset.slice(0, 2)) + 1 : 21;
    return hh >= Math.max(4, from) && hh <= Math.min(23, to);
  });
  const paceLabel: Record<Pace, string> = {
    tranquille: 'tranquille',
    normal: 'normal',
    soutenu: 'soutenu',
  };

  return (
    <section className="cp-dayd" aria-label={`Jour ${plan.day}`}>
      <div className="cp-dayd__h">
        <b>
          J{plan.day}
          {plan.date ? ` · ${formatDayMonth(plan.date)}` : ''}
        </b>
        <span>{plan.title}</span>
      </div>

      {forecast ? (
        <div className="cp-dayd__chips">
          {w && <Chip icon={w.icon}>{w.label}</Chip>}
          {forecast.tMin != null && forecast.tMax != null && (
            <Chip icon="thermometer">
              {Math.round(forecast.tMin)}° / {Math.round(forecast.tMax)}°
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
          {freezing != null && <Chip icon="mountain">0 °C à {formatMeters(freezing)}</Chip>}
          {q && (
            <Chip tone={q.quality === 'bon' ? 'good' : q.quality === 'moyen' ? 'warn' : 'bad'}>
              {q.quality}
            </Chip>
          )}
        </div>
      ) : (
        <p className="cp-note">
          {trend?.kind === 'tendance'
            ? `Prévision 16 jours avant. Tendance des années passées : ${trend.quality ? QUALITY_LABEL[trend.quality] : 'inconnue'}${
                trend.tMin != null && trend.tMax != null
                  ? `, ${Math.round(trend.tMin)}° / ${Math.round(trend.tMax)}°`
                  : ''
              }${trend.reasons.length ? ` (${trend.reasons.join(', ')})` : ''}.`
            : 'Prévision heure par heure disponible à 16 jours du départ.'}
        </p>
      )}

      <dl className="cp-kv">
        <dt>Marche</dt>
        <dd>
          {plan.walkMin != null
            ? `${formatDuration(plan.walkMin)} · ${formatKm(plan.distanceKm)}, rythme ${paceLabel[m.preferences.pace]}`
            : 'distance de l’étape inconnue'}
        </dd>
        {light && (
          <>
            <dt>Lumière</dt>
            <dd>
              {light.sunrise ?? '—'} – {light.sunset ?? '—'}
            </dd>
          </>
        )}
        {advice.start && (
          <>
            <dt>Départ conseillé</dt>
            <dd>
              {advice.start} · arrivée vers {advice.arrival}
            </dd>
          </>
        )}
        {advice.latestStart && (
          <>
            <dt>Au plus tard</dt>
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
        <div className="cp-hours" aria-label="Heure par heure">
          {shownHours.map((h) => {
            const hq = hourQuality(h);
            const hw = h.code != null ? weatherLabel(h.code) : null;
            return (
              <span
                key={h.time}
                className="cp-hour"
                data-q={hq.quality}
                title={hq.reasons.join(', ') || undefined}
              >
                <small>{h.time.slice(11, 13)} h</small>
                {hw && <Icon name={hw.icon} size={16} />}
                <b>{h.tempC != null ? `${Math.round(h.tempC)}°` : '—'}</b>
                <small>{h.precipPct != null ? `${h.precipPct} %` : '—'}</small>
              </span>
            );
          })}
        </div>
      )}
      <p className="cp-sub">
        Temps de marche DIN 33466 au pas du plus lent, pauses +15 %. Lumière :{' '}
        {light?.source ?? '—'}. Météo : Open-Meteo.
      </p>
    </section>
  );
}

/* ---------- Envies : rythme, nuits, éviter, envies ---------- */

const NIGHT_OPTIONS: Array<{ id: CompasNights; label: string; icon: string }> = [
  { id: 'bivouac', label: 'Bivouac', icon: 'tent' },
  { id: 'refuge', label: 'Refuge', icon: 'home' },
  { id: 'hebergement', label: 'Hébergement', icon: 'bed-double' },
  { id: 'mixte', label: 'Mixte', icon: 'layers' },
];
const AVOID_SUGGESTIONS = ['Foule', 'Routes', 'Passages exposés', 'Gros dénivelé'];
const WISH_SUGGESTIONS = ['Lac', 'Sommet', 'Point de vue', 'Baignade'];

export function PreferencesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const prefs = m.preferences;
  const edit = ctl.data.canEdit;
  const save = (next: typeof prefs, message: string) =>
    void ctl.run(
      message,
      () => compasSetPreferencesAction({ tripId: m.tripId, tripSlug: m.slug, preferences: next }),
      () => compasSetPreferencesAction({ tripId: m.tripId, tripSlug: m.slug, preferences: prefs })
    );

  return (
    <>
      <div className="cp-prefs__block">
        <span className="cp-prefs__l">Rythme</span>
        <Segments
          label="Rythme"
          value={prefs.pace}
          onChange={(pace) =>
            edit && pace !== prefs.pace && save({ ...prefs, pace }, `Rythme ${pace}`)
          }
          options={[
            { id: 'tranquille', label: 'Tranquille' },
            { id: 'normal', label: 'Normal' },
            { id: 'soutenu', label: 'Soutenu' },
          ]}
        />
        <p className="cp-sub">
          Le temps de marche suit le plus lent du groupe ; tranquille l’allonge de 15 %, soutenu le
          réduit de 15 %.
        </p>
      </div>

      <div className="cp-prefs__block">
        <span className="cp-prefs__l">Nuits</span>
        <div className="cp-chiprow" role="group" aria-label="Nuits">
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
                  prefs.nights === o.id ? 'Nuits : à décider' : `Nuits : ${o.label.toLowerCase()}`
                )
              }
            >
              <Icon name={o.icon} size={13} />
              {o.label}
            </button>
          ))}
        </div>
        {m.route.nightsToFind > 0 && (
          <p className="cp-sub">
            {m.route.nightsToFind} nuit{m.route.nightsToFind > 1 ? 's' : ''} sans hébergement dans
            les étapes.
          </p>
        )}
      </div>

      <TagEditor
        title="Éviter"
        values={prefs.avoid}
        suggestions={AVOID_SUGGESTIONS}
        edit={edit && !ctl.busy}
        onChange={(avoid, msg) => save({ ...prefs, avoid }, msg)}
      />
      <TagEditor
        title="Envies"
        values={prefs.wishes}
        suggestions={WISH_SUGGESTIONS}
        edit={edit && !ctl.busy}
        onChange={(wishes, msg) => save({ ...prefs, wishes }, msg)}
      />
      <p className="cp-sub">
        Visibles par tout le groupe. Les envies servent de raccourcis de recherche dans Parcours.
      </p>
      {!edit && (
        <p className="cp-note">
          Lecture seule : seuls les organisateurs modifient le voyage.{' '}
          <button
            type="button"
            className="cp-linkbtn"
            onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'qui' })}
          >
            Voir le groupe
          </button>
        </p>
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
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (v: string) => {
    const value = v.trim().slice(0, 40);
    if (!value || has(value) || values.length >= 8) return;
    onChange([...values, value], `${title} : ${value}`);
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
            aria-label={`Retirer ${v}`}
            onClick={() =>
              onChange(
                values.filter((x) => x !== v),
                `${v} retiré`
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
            <span className="sr-only">Ajouter : {title}</span>
            <input
              value={draft}
              maxLength={40}
              placeholder={`Ajouter à « ${title} »`}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="cp-ibtn cp-glass"
            aria-label={`Ajouter à ${title}`}
            disabled={!draft.trim()}
          >
            <Icon name="plus" size={17} />
          </button>
        </form>
      )}
    </div>
  );
}
