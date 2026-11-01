'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompasStepId } from '../engine/compasModel';
import { notedStay } from '../engine/stayProposal';
import { compasAutofillStopAction } from '../server/autofillActions';
import { compasSetStayAction } from '../server/compasActions';
import type { CompasData } from '../server/getCompasData';
import { TrialNote } from '../components/TrialNote';
import { useCompasController } from '../components/useCompasController';
import type { StepFlow } from '../components/compasTypes';
import { V5Context, type V5Api } from './context';
import { Island } from './Island';
import { selectDays } from './model/trip';
import { compasV5ExtrasAction } from './server/extrasAction';
import { TopBar } from './TopBar';
import { TripCard, ViewSwitch } from './TripCard';
import { EMPTY_EXTRAS, type V5Extras, type V5Space, type V5StayOption } from './types';
import { V5Sheet } from './V5Sheet';
import './v5.css';

// Tiroirs classiques (CompasSheets, lourds) : chargés à part, rendus seulement quand un tiroir est ouvert.
// Préchargés au repos (voir l'effet dans CompasV5Screen) pour que la première ouverture n'attende pas le réseau.
const loadLegacyHost = () => import('./LegacyHost').then((m) => m.LegacyHost);
const LegacyHost = dynamic(loadLegacyHost, { ssr: false });

const LiveMap = dynamic(() => import('./map/LiveMap').then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="v5-map v5-skel" aria-hidden="true" />,
});

/** Onglets du tiroir « Voyage » = parcours éprouvés de l'écran actuel, ouverts par `LegacyHost`. */
const VOYAGE_FLOWS: StepFlow<'ou'>[] = ['activite', 'parcours', 'quand', 'preferences'];

/** Lien `?etape=` des anciens liens : l'étape d'hier ouvre le tiroir d'aujourd'hui. */
const STEP_SPACE: Record<CompasStepId, V5Space | null> = {
  ou: null,
  nous: 'nous',
  resa: 'prevoir',
  verdict: 'verifs',
  kit: 'sac',
};

const UNAVAILABLE_ALL: V5Extras = { ...EMPTY_EXTRAS, unavailable: ['lodging', 'photos', 'transport'] };

/**
 * Compas v5 — l'écran. Une card (le voyage en un coup d'œil, des bulles qui ouvrent les tiroirs, les jours et les
 * nuits en images), une carte vivante où tout se retrouve, un îlot pour les annonces. Les données, les écritures et
 * la préparation sont celles de l'écran actuel (`useCompasController`) : rien n'est réécrit, rien n'est inventé.
 */
export function CompasV5Screen({ data: rawData, initialStep }: { data: CompasData; initialStep?: CompasStepId }) {
  const [space, setSpace] = useState<V5Space | null>(() => (initialStep ? STEP_SPACE[initialStep] : null));
  const [tab, setTabState] = useState(0);
  const [day, setDay] = useState(0);
  const [view, setView] = useState<'grid' | 'fil'>('grid');
  const [mapBig, setMapBig] = useState(false);
  const [extras, setExtras] = useState<V5Extras>(EMPTY_EXTRAS);

  const c = useCompasController(rawData, { onOpen: () => setMapBig(false) });
  const { data, model, t, locale, ctl, stack, setStack, toast, setToast, prep, setPrep } = c;
  const canEdit = data.canEdit;

  /* ---- Précharge les tiroirs classiques au repos : la première ouverture n'attend pas le réseau ---- */
  useEffect(() => {
    const preload = () => void loadLegacyHost().catch(() => undefined);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const days = useMemo(() => selectDays(data, locale), [data, locale]);
  const people = Math.max(1, model.crew.size);
  const solo = people <= 1;

  /* ---- Lire ce que le serveur ajoute (nuits possibles, photos, trajets) : après l'affichage, jamais bloquant ---- */
  const extrasKey = `${model.tripId}|${days.map((d) => `${d.lat ?? ''},${d.lon ?? ''}`).join(';')}`;
  const lastKey = useRef<string>('');
  useEffect(() => {
    if (!days.length || lastKey.current === extrasKey) return;
    lastKey.current = extrasKey;
    let cancelled = false;
    // Une lecture partielle (temps ou quota atteint) est complétée une fois depuis le cache du serveur.
    const load = (retry: boolean) =>
      compasV5ExtrasAction({ tripId: model.tripId })
        .then((res) => {
          if (cancelled) return;
          setExtras(res.success ? res.extras : UNAVAILABLE_ALL);
          if (res.success && res.extras.partial && retry) window.setTimeout(() => !cancelled && void load(false), 1500);
        })
        .catch(() => {
          if (!cancelled) setExtras(UNAVAILABLE_ALL);
        });
    void load(true);
    return () => {
      cancelled = true;
    };
  }, [extrasKey, days.length, model.tripId]);

  /* ---- Tiroirs ---- */
  const openSpace = useCallback(
    (next: V5Space, opts: { tab?: number; day?: number } = {}) => {
      if (next === 'voyage') {
        const flow = VOYAGE_FLOWS[Math.min(opts.tab ?? 0, VOYAGE_FLOWS.length - 1)];
        setSpace(null);
        c.open({ kind: 'step', step: 'ou', flow });
        return;
      }
      setTabState(opts.tab ?? 0);
      if (opts.day != null) setDay(opts.day);
      setSpace(next);
      setMapBig(false);
    },
    [c]
  );
  const closeSpace = useCallback(() => setSpace(null), []);

  const announce = useCallback((message: string, sub?: string, tone?: 'bad') => ctl.notify(message, tone, sub), [ctl]);

  const api: V5Api = {
    data,
    extras,
    ctl,
    t,
    locale,
    canEdit,
    solo,
    people,
    space,
    tab,
    day,
    openSpace,
    closeSpace,
    setTab: setTabState,
    announce,
    prefs: {
      outdoor: c.display.outdoor,
      setOutdoor: (next) => c.updateDisplay({ ...c.display, outdoor: next }),
      undoS: c.display.undoS,
      setUndoS: (next) => c.updateDisplay({ ...c.display, undoS: next }),
      offlineSavedAt: c.offlineSavedAt,
      redo: ctl.autofill,
    },
  };

  /* ---- « Dis-le » a trouvé un parcours du catalogue : on l'ouvre dans « Voyage » plutôt que de l'écrire ---- */
  const onRoute = useCallback((query: string) => c.open({ kind: 'step', step: 'ou', flow: 'parcours', hint: { query } }), [c]);

  /* ---- Carte vivante ---- */
  const stages = useMemo(
    () => days.filter((d) => d.lat != null && d.lon != null).map((d) => ({ day: d.day, lat: d.lat as number, lon: d.lon as number, title: d.to ?? d.title })),
    [days]
  );
  const nights = useMemo(
    () =>
      days
        .filter((d) => !d.isLast)
        .map((d) => {
          const options = extras.nights[d.day] ?? [];
          const noted = notedStay(d.stay);
          const chosen: V5StayOption | null = noted
            ? (options.find((o) => o.name === noted) ?? {
                id: `noted:${noted}`,
                name: noted,
                kind: 'hebergement' as const,
                lat: d.lat ?? 0,
                lon: d.lon ?? 0,
                distanceM: 0,
                elevationM: null,
                price: null,
                photo: null,
                source: t('compas.v5.day.noted'),
                url: null,
                partner: null,
              })
            : null;
          const hint = chosen?.price ? `${Math.round(chosen.price.perPerson)} ${chosen.price.currency === 'EUR' ? '€' : chosen.price.currency}` : null;
          return {
            day: d.day,
            chosen,
            alternatives: options.filter((o) => o.id !== chosen?.id),
            booked: Boolean(noted) && model.bookings.confirmed > 0,
            priceLabel: hint,
          };
        }),
    [days, extras.nights, model.bookings.confirmed, t]
  );

  const pickAlternative = useCallback(
    (dayNumber: number, optionId: string) => {
      const option = (extras.nights[dayNumber] ?? []).find((o) => o.id === optionId);
      const current = notedStay(days.find((d) => d.day === dayNumber)?.stay);
      if (!option || !canEdit) return;
      void ctl.run(
        t('compas.v5.day.stayNoted', { n: dayNumber, name: option.name }),
        () => compasSetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: dayNumber, name: option.name }),
        () => compasSetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: dayNumber, name: current ?? '' })
      );
    },
    [canEdit, ctl, days, extras.nights, model.slug, model.tripId, t]
  );

  const focusDay = space === 'day' ? days[day] : undefined;
  const top = stack[stack.length - 1];
  const style = c.display.outdoor ? undefined : ({ ['--v5-ga' as string]: c.display.glass * 0.32 } as React.CSSProperties);

  /* ---- Préparation visible (l'îlot) ---- */
  const prepStop = () => {
    c.stopped.current = true;
    c.pollAbort.current?.abort();
    void compasAutofillStopAction({ tripId: model.tripId }).catch(() => undefined);
    setPrep({ stage: 'stopped', at: c.prepAt(), message: t('compas.screen.stoppedKept') });
  };
  const prepRetry = () => {
    const at = c.prepRef.current?.at;
    c.stopped.current = false;
    if (at === 'understand' && c.startSay) return void c.understand(c.startSay);
    c.autofillRetried.current = false;
    setPrep({ stage: 'itinerary' });
    c.autofill();
  };

  const islandToast = toast
    ? {
        message: toast.message,
        tone: toast.tone,
        sub: toast.sub,
        undo: toast.undo
          ? () => {
              const undo = toast.undo;
              c.undoRef.current = null;
              setToast(null);
              undo?.();
            }
          : undefined,
      }
    : null;

  return (
    <V5Context.Provider value={api}>
      <div className="v5" data-map={mapBig ? 'big' : undefined} data-outdoor={c.display.outdoor ? '1' : undefined} style={style}>
        <div className="v5-bg" aria-hidden="true" />
        <h1 className="v5-sr">{t('compas.v5.core.title', { title: model.title })}</h1>

        <Island
          toast={islandToast}
          prep={prep}
          running={c.running}
          t={t}
          onDismiss={() => {
            c.undoRef.current = null;
            setToast(null);
          }}
          onHold={c.holdToast}
          onRelease={() => c.armToast(c.toastLong.current)}
          onStop={prepStop}
          onResume={prepRetry}
          onRefine={() => {
            setPrep(null);
            c.open({ kind: 'step', step: 'ou', flow: 'activite', ...(c.startSay ? { hint: { say: c.startSay, start: true } } : {}) });
          }}
          onSeeDone={() => setPrep(null)}
          onCloseDone={() => setPrep(null)}
        />

        <header>
          <TopBar onRoute={onRoute} />
          {data.keepTrial === true && <TrialNote />}
        </header>

        <div className="v5-stage">
          <section className="v5-card v5-cs" aria-label={model.title}>
            <TripCard view={view} onDay={(index) => openSpace('day', { day: index })} />
            {days.length > 0 && <ViewSwitch view={view} onView={setView} />}
          </section>
          <V5Sheet />
        </div>

        <LiveMap
          name={model.title}
          routeGeojson={data.routeGeojson}
          coords={model.route.coords}
          stages={stages}
          nights={nights}
          points={data.points}
          layers={c.layers}
          onLayers={c.updateLayers}
          base={c.base}
          onBase={c.updateBase}
          focus={focusDay ? { kind: 'day', day: focusDay.day } : { kind: 'trip' }}
          inset={{ top: 70, bottom: 24, left: 24, right: 70 }}
          onSelectDay={(d) => openSpace('day', { day: Math.max(0, days.findIndex((x) => x.day === d)) })}
          onSelectNight={(d) => openSpace('day', { day: Math.max(0, days.findIndex((x) => x.day === d)) })}
          onPickAlternative={pickAlternative}
          onPoi={() => undefined}
          big={mapBig}
          onToggleBig={() => {
            setMapBig((v) => !v);
            setSpace(null);
          }}
          emptyText={t('compas.start.mapEmpty')}
        />

        {top && (
          <LegacyHost
            top={top}
            ctl={ctl}
            depth={stack.length}
            outdoor={c.display.outdoor}
            onDetent={(d) => setStack((s) => s.map((x, i) => (i === s.length - 1 ? { ...x, detent: d } : x)))}
            onClose={c.close}
            onBack={stack.length > 1 ? c.back : undefined}
          />
        )}
      </div>
    </V5Context.Provider>
  );
}
