'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LazyMotion, MotionConfig, domMax, m } from 'framer-motion';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import { CarnetClock } from './CarnetClock';
import { cockpitDayBudget, cockpitDayRoute, currentCockpitDay, momentHour } from './day';
import { weatherGlyph } from './weatherGlyph';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { IdentityPill } from '@/features/community/feed/PostAuthorPill';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { CockpitData, CockpitWeatherDay } from './model';
import { useCockpitWeather } from './useCockpitWeather';
import styles from './cockpit.module.css';

const Map = dynamic(() => import('./HubCockpitMap').then((m) => m.HubCockpitMap), {
  ssr: false, loading: () => <p className={styles.mapStatus} role="status">Chargement de la carte</p>,
});
const KitScene = dynamic(() => import('./HubKitPreview').then((m) => m.HubKitPreview), {
  ssr: false, loading: () => <p role="status">Chargement du kit…</p>,
});
const MomentEditor = dynamic(() => import('./HubMomentEditor').then((m) => m.HubMomentEditor), {
  ssr: false, loading: () => <p role="status">Chargement du carnet…</p>,
});

const widgets = {
  meteo: { name: 'Météo', icon: 'cloud-sun' },
  budget: { name: 'Budget', icon: 'wallet' },
  carte: { name: 'Carte', icon: 'map' },
  etapes: { name: 'Étapes', icon: 'footprints' },
  carnet: { name: 'Carnet', icon: 'book-open' },
  kit: { name: 'Kits', icon: 'backpack' },
  paperasse: { name: 'Paperasse', icon: 'folder' },
  groupe: { name: 'Groupe', icon: 'users' },
};
type Widget = keyof typeof widgets;
type View = { widget: Widget; detail?: string };

const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const money = ({ amount, currency }: { amount: number; currency: string }) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

function dateLabel(date: string | null | undefined, full = false) {
  if (!date) return null;
  const time = Date.parse(date.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', weekday: full ? 'long' : undefined, timeZone: 'UTC' }).format(time)
    : null;
}

function temperatures({ low, high }: CockpitWeatherDay) {
  return [low, high].filter((value): value is number => value != null).map((value) => `${number(value)}°`).join(' / ');
}

function readView(): View | null {
  const query = new URLSearchParams(window.location.search);
  const value = query.get('widget');
  if (!value || !Object.hasOwn(widgets, value)) return null;
  return { widget: value as Widget, detail: query.get('detail') ?? undefined };
}

function Action({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={`lkdv-cv2-chip ${styles.action}`}>{children}<Icon name="chevron-right" size={16} /></Link>;
}

function Status({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className={`lkdv-cv2-empty ${styles.status}`}><p>{children}</p>{action}</div>;
}

function Pill({ title, meta, onClick, itemId, inline = false }: {
  title: string; meta?: ReactNode; onClick: (element: HTMLButtonElement) => void; itemId: string; inline?: boolean;
}) {
  return <button type="button" className={['lkdv-cv2-chip', styles.pill, inline && styles.inlinePill].filter(Boolean).join(' ')}
    title={title} data-hub-item={itemId} onClick={(event) => onClick(event.currentTarget)}>
    <strong>{title}</strong>{meta && <span>{meta}</span>}
  </button>;
}

function Rail({ label, children, small = false }: { label: string; children: ReactNode; small?: boolean }) {
  return <div className={`lkdv-cv2-rail ${styles.rail} ${small ? styles.railThree : ''}`} role="group" aria-label={label}>{children}</div>;
}

export function HubCockpit({ data, fixture = false, adventureControl }: {
  data: CockpitData; fixture?: boolean; adventureControl?: ReactNode;
}) {
  const id = useId();
  const { isOnline } = useOnlineStatus();
  const [view, setView] = useState<View | null>(null);
  const [lastWidget, setLastWidget] = useState<Widget>('meteo');
  const [clock, setClock] = useState<{ date: string; hour: number } | null>(null);
  const [selection, setSelection] = useState<{ day: number; date: string | undefined } | null>(null);
  const [carnet, setCarnet] = useState(data.carnet);
  const restore = useRef<{ item: string; top: number } | null>(null);
  const dayRail = useRef<HTMLDivElement>(null);
  const widget = view?.widget ?? lastWidget;
  const weather = useCockpitWeather(data, !fixture && data.trip && isOnline);
  const forecast = weather.forecast;
  const today = !fixture && clock ? currentCockpitDay(data.startDate, data.dayCount, clock.date) : data.today ?? 1;
  const day = selection && selection.date === clock?.date ? selection.day : today;
  const dailyBudget = data.budget && cockpitDayBudget(data.budget, data.startDate, day, data.dayCount, clock?.date ?? normalizeCivilDateString());
  const expenses = dailyBudget?.expenses ?? [];
  const reservations = data.reservations ?? [];
  const peopleStatus = data.peopleUnavailable ? 'Membres momentanément indisponibles'
    : data.pending > 0 ? `${data.pending} invitation${data.pending > 1 ? 's' : ''} en attente`
    : 'Aucun membre actif';
  const daySteps = useMemo(() => data.steps.filter((step) => step.day === day), [data.steps, day]);
  const dayMap = useMemo(() => ({
    ...data, steps: daySteps, route: cockpitDayRoute(data.route, daySteps, day, data.dayCount),
  }), [data, daySteps, day]);
  const dayNotes = data.notes.filter((note) => note.day === day);
  const dayMoments = (carnet?.moments ?? []).filter((moment) => moment.day === day)
    .sort((a, b) => (a.time ?? '24:00').localeCompare(b.time ?? '24:00'));
  const hour = day === today && !fixture ? clock?.hour ?? 12
    : dayMoments.reduce((first, moment) => Math.min(first, momentHour(moment.time) ?? 24), 24);
  const clockHour = hour < 24 ? hour : 12;
  const dayKit = data.kit.filter((item) => item.day == null || item.day === day);
  const packed = dayKit.filter((item) => item.packed).length;
  const days = useMemo(() => {
    const list = new Set([today, ...data.steps.map((step) => step.day)]);
    if (data.dayCount) for (let i = 1; i <= data.dayCount; i += 1) list.add(i);
    return [...list].sort((a, b) => a - b);
  }, [data.steps, data.dayCount, today]);

  useEffect(() => {
    function syncClock() {
      const now = new Date();
      const date = normalizeCivilDateString();
      const hour = now.getHours();
      setClock((prev) => prev?.date === date && prev.hour === hour ? prev : { date, hour });
    }
    syncClock();
    const timer = window.setInterval(syncClock, 60_000);
    window.addEventListener('pageshow', syncClock);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pageshow', syncClock);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, []);

  useEffect(() => {
    const rail = dayRail.current;
    const active = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !active) return;
    rail.scrollLeft = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  }, [day]);
  useEffect(() => {
    const sync = () => {
      const next = readView();
      setView(next);
      if (next) setLastWidget(next.widget);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (!view || view.detail || !restore.current) return;
    const position = restore.current;
    restore.current = null;
    const frame = requestAnimationFrame(() => {
      const dialog = document.querySelector('.lkdv-cv2-sheet');
      const target = [...(dialog?.querySelectorAll<HTMLElement>('[data-hub-item]') ?? [])]
        .find((element) => element.dataset.hubItem === position.item);
      const pane = target?.closest<HTMLElement>('.lkdv-cv2-pane') ?? dialog?.querySelector('.lkdv-cv2-pane');
      if (pane) pane.scrollTop = position.top;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  function go(next: View, opener?: HTMLElement | null) {
    if (opener) {
      if (!view) opener.focus({ preventScroll: true });
      else if (next.detail && !view.detail && opener.dataset.hubItem) {
        restore.current = { item: opener.dataset.hubItem, top: opener.closest('.lkdv-cv2-pane')?.scrollTop ?? 0 };
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set('widget', next.widget);
    if (next.detail) url.searchParams.set('detail', next.detail);
    else url.searchParams.delete('detail');
    const depth = Number(window.history.state?.lkdvHubDepth) || 0;
    const fromHour = view?.widget === 'carnet' && view.detail?.startsWith('heure-') && next.detail;
    if ((view?.detail && !fromHour) || (view && !next.detail)) {
      window.history.replaceState(window.history.state, '', url);
    } else {
      window.history.pushState({ ...window.history.state, lkdvHubDepth: depth + 1 }, '', url);
    }
    setLastWidget(next.widget);
    setView(next);
  }

  function back() {
    if (!view) return;
    if (Number(window.history.state?.lkdvHubDepth) > 1) {
      window.history.back();
      return;
    }
    go({ widget: view.widget });
  }

  function close() {
    setView(null);
    restore.current = null;
    const depth = Number(window.history.state?.lkdvHubDepth) || 0;
    if (depth > 0) window.history.go(-depth);
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete('widget');
      url.searchParams.delete('detail');
      window.history.replaceState(window.history.state, '', url);
    }
  }

  function stepRows(target: 'carte' | 'etapes') {
    return daySteps.map((step) => (
      <Pill key={step.id} itemId={step.id} title={step.title} meta={step.time} inline
        onClick={(element) => go({ widget: target, detail: step.id }, element)} />
    ));
  }

  function weatherDays() {
    const forecastDate = forecast?.observedAt?.slice(0, 10);
    const upcoming = forecastDate ? forecast?.days.filter((entry) => entry.date > forecastDate) : forecast?.days;
    return (upcoming?.length ? upcoming : forecast?.days)?.map((entry) => (
      <Pill key={entry.date} itemId={entry.date} title={entry.day} meta={entry.high == null ? entry.condition : `${number(entry.high)}°`}
        onClick={(element) => go({ widget: 'meteo', detail: entry.date }, element)} />
    ));
  }

  function budgetRows() {
    return expenses.map((entry) => (
      <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={money(entry)} inline
        onClick={(element) => go({ widget: 'budget', detail: entry.id }, element)} />
    ));
  }

  function reservationRows(entries = reservations) {
    return entries.map((entry) => (
      <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={dateLabel(entry.due) ?? entry.status}
        onClick={(element) => go({ widget: 'paperasse', detail: entry.id }, element)} />
    ));
  }

  function peopleRows() {
    return data.people.map((person) => (
      <IdentityPill key={person.id} name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role}
        itemId={person.id} onClick={(element) => go({ widget: 'groupe', detail: person.id }, element)} />
    ));
  }

  function dayPicker() {
    return <m.div layoutScroll ref={dayRail} role="group" aria-label="Jour du voyage" className={styles.dayRail}>
      {days.map((option) => <button key={option} className={styles.dayPill} type="button" aria-label={`Jour ${option}`}
        aria-current={option === today ? 'date' : undefined} aria-pressed={option === day}
        onClick={() => setSelection({ day: option, date: clock?.date })}>
        {option === day && <m.span layoutId={`${id}-day`} className={styles.daySelection} aria-hidden="true"
          transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
        <span>J{option}</span>
      </button>)}
    </m.div>;
  }

  function dayContent(body: ReactNode, className: string, label?: string) {
    return <m.div key={day} className={className} role={label ? 'group' : undefined} aria-label={label}
      initial={{ opacity: 0.64 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>{body}</m.div>;
  }

  function makeTile(key: Widget, body: ReactNode, control?: ReactNode) {
    const definition = widgets[key];
    return <section className={`lkdv-cv2-card ${styles.tile} ${styles[key] ?? ''}`}>
      <div className={styles.tileHeader}>
        <h2><button className={styles.heading} type="button" aria-haspopup="dialog"
          onClick={(event) => go({ widget: key }, event.currentTarget)}>
          {key !== 'meteo' && <Icon className={styles.headingIcon} name={definition.icon} size={16} />}
          <span>{definition.name}</span>
          <Icon className={styles.chevron} name="chevron-right" size={14} />
        </button></h2>
        {control}
      </div>
      {body}
    </section>;
  }

  function budgetSummary() {
    if (data.unavailableSections?.includes('expenses')) return <p className={styles.meta}>Dépenses momentanément indisponibles</p>;
    if (!dailyBudget) return <p className={styles.meta}>Accès au budget indisponible</p>;
    const currencies = new Set([...dailyBudget.spent, ...dailyBudget.planned].map(({ currency }) => currency));
    if (!currencies.size) return <p className={styles.meta}>Aucune dépense ce jour</p>;
    return <div className={styles.metrics}>{Array.from(currencies, (currency) => {
      const spent = dailyBudget.spent.find((row) => row.currency === currency)?.amount ?? 0;
      const planned = dailyBudget.planned.find((row) => row.currency === currency);
      return <span className={styles.budgetAmount} key={currency}>
        <span className={styles.value}>{money({ amount: spent, currency })}</span>
        {planned && <small title={dailyBudget.estimate ? 'Budget du jour estimé' : 'Budget prévu du jour'}
          aria-label={`sur ${money(planned)} prévus${dailyBudget.estimate ? ', estimation' : ''}`}>/{money(planned)}</small>}
      </span>;
    })}</div>;
  }

  function weatherSummary(inTile = false) {
    if (!forecast) return <p className={styles.meta}>{weather.pending ? 'Recherche des prévisions…' : 'Météo indisponible'}</p>;
    return <>
      <span className={styles.weatherValue}>
        {forecast.weatherCode != null && <span className={styles.weatherGlyph} role="img" aria-label={forecast.condition}>
          <Icon name={weatherGlyph(forecast.weatherCode)} size={25} />
        </span>}
        <span className={styles.value}>{number(forecast.temperature)}°</span>
      </span>
      {!inTile && <p className={styles.meta}>{forecast.condition} · {forecast.place ?? 'Destination du voyage'}</p>}
    </>;
  }

  function renderPane() {
    switch (widget) {
      case 'meteo':
        return <>
          {weatherSummary()}
          {!fixture && <button className="lkdv-cv2-chip" type="button" disabled={weather.pending} onClick={() => void weather.locate()}>
            <Icon name="locate" size={16} />{weather.gps ? 'Actualiser ma position' : 'Utiliser ma position'}
          </button>}
          {weather.error && <p role="status" className={styles.meta}>{weather.error} {forecast && 'Dernière prévision affichée.'}</p>}
          {forecast?.observedAt && <p className={styles.meta}>Prévision · {forecast.observedAt.slice(11, 16)} · {forecast.source}</p>}
          {forecast?.days.length ? <div className={styles.rows}>{weatherDays()}</div> : <Status>Prévisions journalières indisponibles.</Status>}
        </>;
      case 'budget':
        return <>
          {budgetSummary()}
          {dailyBudget?.estimate && <p className={styles.meta}>Budget du jour estimé à partir de l’enveloppe du voyage.</p>}
          {expenses.length > 0 && <div className={styles.rows}>{budgetRows()}</div>}
          {!fixture && data.budget && <Action href="/hub/budget">Gérer les dépenses</Action>}
        </>;
      case 'carte':
        return <>
          <Map data={dayMap} fixture={fixture} onStep={(step) => go({ widget: 'carte', detail: step.id })} />
          {data.clubRouteUpdates?.map((update) => (
            <Action key={update.eventId} href={`/sorties/${update.eventId}?source=club#parcours`}>
              {update.title} · {update.decisionPending ? 'Parcours à valider'
                : update.adoptedRevision != null ? `Tracé adopté · R${update.adoptedRevision}`
                  : `Parcours publié · R${update.revision}`}
            </Action>
          ))}
          {daySteps.length > 0 && <div className={styles.rows}>{stepRows('carte')}</div>}
          {!fixture && <Action href={"/hub/itineraire?jour=" + day}>Ouvrir l’itinéraire</Action>}
        </>;
      case 'etapes':
        return <>
          {daySteps.length ? <div className={styles.rows}>{stepRows('etapes')}</div> : <Status>{data.unavailableSections?.includes('steps') ? 'Étapes momentanément indisponibles.' : 'Aucune étape prévue pour ce jour.'}</Status>}
          {!fixture && <Action href={`/hub/itineraire?jour=${day}`}>Gérer les étapes</Action>}
        </>;
      case 'carnet':
        return <>
          <button className={`lkdv-cv2-chip ${styles.addMoment}`} type="button"
            data-hub-item="ajouter" onClick={(event) => go({ widget: 'carnet', detail: 'ajouter' }, event.currentTarget)}>
            <Icon name="plus" size={17} /> Ajouter un moment
          </button>
          {dayMoments.length ? <div className={styles.rows}>{momentRows(dayMoments)}</div>
            : !dayNotes.length && <Status>{data.carnetUnavailable ? 'Carnet momentanément indisponible.' : 'Aucun moment enregistré ce jour.'}</Status>}
          {dayNotes.length > 0 && <ul className={styles.list}>{dayNotes.map((note) =>
            <li key={note.id}><strong>{note.title ?? 'Note du voyage'}</strong><p>{note.content}</p></li>)}</ul>}
          {!fixture && <Action href={carnet ? `/carnets/${carnet.id}` : '/hub/journal'}>Ouvrir le carnet</Action>}
        </>;
      case 'kit':
        if (data.confirmedParticipant) return <Status>Le kit du voyage est réservé à l’équipe de préparation.</Status>;
        return <>
          {data.kitId && !fixture && <KitScene kitId={data.kitId} />}
          {!data.kitId && <Status action={!fixture && <Action href="/hub/kit-voyage">Choisir le kit du voyage</Action>}>Aucun kit affecté au voyage.</Status>}
          {!!dayKit.length && <ul className={styles.list}>{dayKit.map((item) =>
            <li key={item.id}><strong>{item.title}{item.amount > 1 && ` × ${item.amount}`}</strong>
              <p className={styles.meta}>{item.packed ? 'Préparé' : 'À préparer'}</p></li>)}</ul>}
          {!fixture && data.kitId && <Action href="/hub/kit-voyage">Gérer le kit</Action>}
        </>;
      case 'paperasse':
        return <>
          {reservations.length ? <div className={styles.rows}>{reservationRows()}</div>
            : <Status>{data.reservations === null ? (data.canEdit ? 'Réservations momentanément indisponibles.' : 'Accès aux réservations limité.') : 'Aucune réservation à traiter.'}</Status>}
          {!!data.documents?.length && <div className={styles.rows}>{data.documents.map((document) =>
            <Pill key={document.id} itemId={`doc-${document.id}`} title={document.title} meta={dateLabel(document.expiration)}
              onClick={(element) => go({ widget: 'paperasse', detail: `doc-${document.id}` }, element)} />)}</div>}
          {!fixture && data.documents !== null && <Action href="/hub/documents">Gérer les documents</Action>}
        </>;
      case 'groupe':
        return <>
          {data.people.length > 0 && <div className={styles.rows}>{peopleRows()}</div>}
          {(!data.people.length || data.pending > 0) && <Status>{peopleStatus}</Status>}
          {!fixture && <Action href="/hub/groupe">Gérer le groupe</Action>}
          {!fixture && data.trip && <Action href="/hub/securite">Sécurité</Action>}
        </>;
    }
  }

  function momentRows(entries: typeof dayMoments) {
    return entries.map((entry) => <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={entry.time} inline
      onClick={(element) => go({ widget: 'carnet', detail: entry.id }, element)} />);
  }

  function renderDetail(detailId: string): { title: string; content: ReactNode } | null {
    if (widget === 'meteo') {
      const entry = forecast?.days.find((item) => item.date === detailId);
      return entry ? { title: dateLabel(entry.date, true) ?? entry.day, content: <>
        <p className={styles.value}>{temperatures(entry) || 'Températures indisponibles'}</p>
        <p>{[entry.condition, forecast?.place].filter(Boolean).join(' · ')}</p>
        {entry.wind != null && <p>Vent moyen jusqu’à {number(entry.wind)} km/h</p>}
        {entry.rain != null && <p>Précipitations · {number(entry.rain)} mm</p>}
        {entry.hours?.length ? <ul className={styles.list}>{entry.hours.map((hour) =>
          <li key={hour.time}><strong>{hour.time.slice(11, 16)}</strong>
            <p>{[hour.temperature == null ? null : `${number(hour.temperature)}°`, hour.wind == null ? null : `${number(hour.wind)} km/h`,
              hour.rain == null ? null : `${number(hour.rain)} mm`].filter(Boolean).join(' · ') || 'Détail indisponible'}</p></li>)}</ul>
          : <p className={styles.meta}>Prévision horaire indisponible pour ce jour.</p>}
      </> } : null;
    }
    if (widget === 'budget') {
      const entry = expenses.find((item) => item.id === detailId);
      return entry ? { title: entry.title, content: <>
        <p><strong>{entry.title}</strong></p>
        <p className={styles.value}>{money(entry)}</p>
        {[entry.category, entry.payer].filter(Boolean).length > 0 && <p>{[entry.category, entry.payer].filter(Boolean).join(' · ')}</p>}
        {!fixture && <Action href="/hub/budget">Gérer les dépenses</Action>}
      </> } : null;
    }
    if (widget === 'carte' || widget === 'etapes') {
      const step = data.steps.find((item) => item.id === detailId);
      return step ? { title: step.title, content: <>
        <p><strong>{step.title}</strong></p>
        <p>{[`J${step.day}`, step.time, step.place].filter(Boolean).join(' · ')}</p>
        {step.description && <p className={styles.bodyCopy}>{step.description}</p>}
        {step.distance != null && <p>{number(step.distance)} km prévus</p>}
        {step.elevation != null && <p>+{number(step.elevation)} m</p>}
        {!fixture && <Action href={`/hub/itineraire?jour=${step.day}`}>Ouvrir dans l’itinéraire</Action>}
      </> } : null;
    }
    if (widget === 'carnet') {
      const clockMatch = /^heure-([0-9]{1,2})$/.exec(detailId);
      if (clockMatch) {
        const label = clockMatch[1].padStart(2, '0') + 'h';
        const entries = dayMoments.filter((entry) => momentHour(entry.time) === Number(clockMatch[1]));
        return { title: `Moments de ${label}`, content: entries.length
          ? <div className={styles.rows}>{momentRows(entries)}</div>
          : <Status>Aucun moment à {label}.</Status> };
      }
      if (detailId === 'ajouter') return { title: 'Ajouter un moment', content: fixture
        ? <Status>Connecte-toi à ton voyage pour enregistrer un moment.</Status>
        : <MomentEditor tripId={data.key} day={day} place={daySteps.find((step) => step.place)?.place ?? data.location}
            carnet={carnet} kitItems={data.carnetKitItems ?? []} canCreate={Boolean(data.canCreateCarnet)} onChange={setCarnet} onBack={back} /> };
      const moment = carnet?.moments.find((item) => item.id === detailId);
      return moment ? { title: 'Moment', content: <>
        <p>{moment.title}</p>{moment.time && <p>{moment.time}</p>}
        {moment.audio && <audio controls preload="metadata" src={moment.audio} aria-label="Note vocale" />}
        {moment.media && (moment.type === 'video'
          ? <video className={styles.momentMedia} controls playsInline preload="metadata" src={moment.media} aria-label="Vidéo du moment" />
          // eslint-disable-next-line @next/next/no-img-element -- le média privé passe par le proxy du carnet
          : <img className={styles.momentMedia} alt="Photo du moment" src={moment.media} />)}
        <Action href={`/carnets/${carnet!.id}`}>Ouvrir le carnet</Action></> } : null;
    }
    if (widget === 'paperasse') {
      const entry = reservations.find((item) => item.id === detailId);
      if (entry) return { title: entry.title, content: <>
        <p><strong>{entry.title}</strong></p>
        <p>{entry.status}</p>
        <p>{entry.due ? `Échéance · ${dateLabel(entry.due)}` : 'Échéance non renseignée'}</p>
        {entry.when && <p>Prévu le {dateLabel(entry.when)}</p>}
        {entry.partnerSlug && <a className="lkdv-cv2-chip" rel="sponsored nofollow" href={`/go/${encodeURIComponent(entry.partnerSlug)}`}>Voir les options de réservation</a>}
        {!fixture && <Action href={entry.stepId ? '/hub/itineraire' : '/hub/budget'}>Voir dans le voyage</Action>}
      </> };
      const document = data.documents?.find((item) => `doc-${item.id}` === detailId);
      return document ? { title: document.title, content: <>
        <p><strong>{document.title}</strong></p>
        {document.expiration && <p>Échéance · {dateLabel(document.expiration)}</p>}
        <p>{document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'}</p>
        {!fixture && <Action href="/hub/documents">Ouvrir les documents du voyage</Action>}
      </> } : null;
    }
    if (widget === 'groupe') {
      const person = data.people.find((item) => item.id === detailId);
      return person ? { title: person.name ?? 'Participant', content: <>
        <IdentityPill name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role} href={fixture ? undefined : `/profil/${encodeURIComponent(person.id)}`} />
        {person.confirmed && <p className={styles.meta}>Participation confirmée</p>}
        {!fixture && <Action href="/hub/groupe">Ouvrir le groupe</Action>}
      </> } : null;
    }
    return null;
  }

  const info = view?.detail ? renderDetail(view.detail) : null;

  return <LazyMotion features={domMax}><MotionConfig reducedMotion="user"><section className={`lkdv-communaute-v2 ${styles.shell}`} data-hub-cockpit aria-labelledby={id}>
    <h1 id={id} className="sr-only">{data.title}</h1>
    {!isOnline && <p role="status">Hors connexion</p>}
    {!fixture && !data.trip && <Action href="/compas">Préparer une aventure</Action>}
    {(data.trip || data.collective) && <div className={styles.gridSpace}><div className={styles.grid} data-trip={data.trip}>
      {data.trip && <>
        {makeTile('meteo', <>
          {weatherSummary(true)}
          {forecast?.days.length ? <Rail label="Prochains jours" small>{weatherDays()}</Rail>
            : !fixture && <button type="button" className="lkdv-cv2-chip" disabled={weather.pending} onClick={() => void weather.locate()}>Utiliser ma position</button>}
        </>)}
        {makeTile('budget', dayContent(<>
          {budgetSummary()}
          {expenses.length > 0 && <Rail label="Dépenses du jour">{budgetRows().slice(0, 12)}</Rail>}
        </>, styles.budgetBody))}
        {makeTile('carte', <>
          <button className={styles.mapOpen} type="button" aria-label="Ouvrir la carte" onClick={(event) => go({ widget: 'carte' }, event.currentTarget)}>
            <Map data={dayMap} fixture={fixture} />
          </button>
        </>)}
        {makeTile('etapes', daySteps.length ? dayContent(stepRows('etapes'), styles.daySteps, 'Étapes de la journée')
          : <p className={styles.meta}>{data.unavailableSections?.includes('steps') ? 'Étapes indisponibles' : 'Aucune étape prévue'}</p>, dayPicker())}
        {makeTile('carnet', dayContent(<>
          <CarnetClock focusHour={clockHour} moments={dayMoments}
            onOpen={(value, element) => go({ widget: 'carnet', detail: `heure-${value}` }, element)} />
          <button className={styles.momentAddBox} type="button" aria-label="Ajouter un moment"
            data-hub-item="ajouter" onClick={(event) => go({ widget: 'carnet', detail: 'ajouter' }, event.currentTarget)}>
            <Icon name="plus" size={25} />
          </button>
        </>, styles.carnetBody))}
        {makeTile('kit', <p className={styles.meta}>{data.kitName && <>{data.kitName}{dayKit.length > 0 && <br />}</>}
          {dayKit.length ? `${packed}/${dayKit.length} préparés` : !data.kitName && (data.confirmedParticipant ? 'Accès réservé' : 'Aucun kit affecté')}</p>)}
        {makeTile('paperasse', reservations.length ? <Rail label="À réserver">{reservationRows()}</Rail>
          : <p className={styles.meta}>{data.reservations === null ? 'Réservations indisponibles' : 'Aucune réservation à traiter'}</p>)}
      </>}
      {makeTile('groupe', data.people.length ? <Rail label="Membres actifs">{peopleRows()}</Rail>
        : <p className={styles.meta}>{data.pending > 0 ? `${data.pending} invitation(s) en attente` : 'Aucun membre actif'}</p>)}
    </div></div>}
    {adventureControl && <footer className={styles.footer}>{adventureControl}</footer>}
    <CommunitySheetShell
      open={view !== null}
      onClose={close}
      initialDetent="large"
      hideCapsule
      hideDetailTitle
      showClose
      className={styles.drawerLayer}
      resetKey={widget}
      label={widgets[widget].name}
      capsule={{ items: [{ id: `hub-${widget}`, label: widgets[widget].name, icon: <Icon name={widgets[widget].icon} size={22} /> }],
        active: 0, onChange: () => undefined }}
      panes={[<div key={widget} className={styles.pane}>{renderPane()}</div>]}
      detail={view?.detail ? {
        title: info?.title ?? 'Détail indisponible', index: 0,
        pages: [<div key={view.detail} className={styles.pane}>{info?.content ?? <Status>Cette donnée n’est plus accessible.</Status>}</div>],
        onBack: back,
      } : null}
    />
  </section></MotionConfig></LazyMotion>;
}
