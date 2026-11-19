'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight, ArrowUpRight, Backpack, BookOpen, Camera, Check, ChevronLeft,
  ChevronRight, CloudSun, Compass, FolderClosed, Footprints, Mountain, Navigation2,
  Users, Wallet, WifiOff, X,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { CockpitData, CockpitStep } from './model';
import { RouteSketch } from './RouteSketch';
import styles from './cockpit.module.css';

const widgets = {
  meteo: { name: 'Météo', icon: CloudSun },
  budget: { name: 'Budget', icon: Wallet },
  carte: { name: 'Carte', icon: Navigation2 },
  etapes: { name: 'Étapes', icon: Footprints },
  carnet: { name: 'Carnet', icon: BookOpen },
  kit: { name: 'Kit', icon: Backpack },
  paperasse: { name: 'Paperasse', icon: FolderClosed },
  groupe: { name: 'Groupe', icon: Users },
};

type Widget = keyof typeof widgets;
type PhotoDraft = { url: string; place: string | null; day: number | null; date: string };

function readWidget(): Widget | null {
  const value = new URLSearchParams(window.location.search).get('widget');
  return value && Object.hasOwn(widgets, value) ? value as Widget : null;
}

const money = ({ amount, currency }: { amount: number; currency: string }) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const dateLabel = (date: string) => {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(value);
};

function Action({ href, children }: { href: string; children: ReactNode }) {
  return <Link className={styles.action} href={href}>{children}<ArrowRight size={17} aria-hidden /></Link>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function StepRows({ steps, onStep }: { steps: CockpitStep[]; onStep: (step: CockpitStep) => void }) {
  if (!steps.length) return <Empty>Aucune étape prévue pour ce jour.</Empty>;
  return (
    <ol className={styles.timeline}>
      {steps.map((step) => (
        <li key={step.id}>
          <button type="button" onClick={() => onStep(step)}>
            <time>{step.time ?? '—'}</time>
            <span><strong>{step.title}</strong>{step.place && <small>{step.place}</small>}</span>
            <ChevronRight size={17} aria-hidden />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function HubCockpit({
  data, fixture = false, adventureControl,
}: { data: CockpitData; fixture?: boolean; adventureControl?: ReactNode }) {
  const { isOnline } = useOnlineStatus();
  const [active, setActive] = useState<Widget | null>(null);
  const [selectedStep, setSelectedStep] = useState<CockpitStep | null>(null);
  const [day, setDay] = useState(data.today ?? data.steps[0]?.day ?? 1);
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [photoError, setPhotoError] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const detailBack = useRef<HTMLButtonElement | null>(null);
  const scrollPane = useRef<HTMLDivElement | null>(null);
  const priorScroll = useRef(0);

  useEffect(() => {
    function sync() {
      setActive(readWidget());
      setSelectedStep(null);
    }
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  useEffect(() => {
    if (selectedStep) {
      if (scrollPane.current) scrollPane.current.scrollTop = 0;
      detailBack.current?.focus();
    }
  }, [selectedStep]);

  const days = useMemo(() => {
    const daysWithSteps = new Set(data.steps.map((step) => step.day));
    if (data.dayCount && data.dayCount <= 60) {
      for (let i = 1; i <= data.dayCount; i += 1) daysWithSteps.add(i);
    }
    daysWithSteps.add(data.today ?? data.steps[0]?.day ?? 1);
    return [...daysWithSteps].sort((a, b) => a - b);
  }, [data.steps, data.dayCount, data.today]);
  const daySteps = data.steps.filter((step) => step.day === day);
  const pins = useMemo(() => data.steps.flatMap((step) => step.coordinate ? [step.coordinate] : []).slice(0, 250), [data.steps]);
  const kitPacked = data.kit.filter((item) => item.packed).length;
  const amounts = data.budget?.spent ?? [];
  const amountLabel = !data.budget ? 'Indisponible' : amounts.length === 1 ? money(amounts[0]) :
    amounts.length > 1 ? `${amounts.length} devises` : 'Aucune dépense';
  const groupPages = Array.from({ length: Math.ceil(data.people.length / 3) }, (_, index) => data.people.slice(index * 3, index * 3 + 3));

  function open(widget: Widget, button: HTMLButtonElement) {
    trigger.current = button;
    const url = new URL(window.location.href);
    url.searchParams.set('widget', widget);
    window.history.pushState({ ...window.history.state, lkdvHubWidget: true }, '', url);
    setSelectedStep(null);
    setActive(widget);
  }

  function close() {
    setActive(null);
    setSelectedStep(null);
    if (window.history.state?.lkdvHubWidget) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('widget');
      window.history.replaceState(window.history.state, '', url);
    }
  }

  function inspectStep(step: CockpitStep) {
    priorScroll.current = scrollPane.current?.scrollTop ?? 0;
    setSelectedStep(step);
  }

  function backToSteps() {
    setSelectedStep(null);
    requestAnimationFrame(() => {
      if (scrollPane.current) {
        scrollPane.current.scrollTop = priorScroll.current;
        scrollPane.current.querySelector<HTMLButtonElement>('li button')?.focus({ preventScroll: true });
      }
    });
  }

  function addPhoto(file: File | undefined) {
    if (!file) return;
    if ((!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) || file.size > 15 * 1024 * 1024) {
      setPhotoError('Choisis une photo de 15 Mo maximum.');
      return;
    }
    setPhotoError('');
    setPhoto({
      url: URL.createObjectURL(file),
      date: new Date().toLocaleDateString('fr-FR'),
      day: data.today,
      place: data.location,
    });
  }

  function tile(widget: Widget, children: ReactNode, className = '') {
    const { icon: Icon, name } = widgets[widget];
    return (
      <button
        type="button"
        className={`${styles.tile} ${className}`}
        onClick={(event) => open(widget, event.currentTarget)}
        aria-haspopup="dialog"
      >
        <span className={styles.tileLabel}>
          <Icon size={19} aria-hidden /> {name} <ArrowUpRight className={styles.arrow} size={16} aria-hidden />
        </span>
        {children}
      </button>
    );
  }

  function describe(text: string | null, fallback: string) {
    return <span className={styles.tileDetail}>{text ?? fallback}</span>;
  }

  function renderPeople() {
    return (
      <>
        {!data.people.length && <Empty>Aucun participant affiché.</Empty>}
        {data.people.length > 0 && (
          <div className={styles.rail} aria-label="Participants par groupes de trois" tabIndex={0}>
            {groupPages.map((people, index) => (
              <ul className={styles.crewPage} key={people[0].id} aria-label={`Participants ${index + 1} sur ${groupPages.length}`}>
                {people.map((person) => (
                  <li key={person.id}><span className={styles.avatar} aria-hidden>{person.name?.slice(0, 1) ?? '•'}</span>
                    <span><strong>{person.name ?? 'Participant'}</strong><small>{person.role}</small></span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
        {data.pending > 0 && <p>{data.pending} invitation{data.pending > 1 ? 's' : ''} en attente</p>}
        {data.people.length > 1 && <p className={styles.annotation}>Positions et progression en direct indisponibles.</p>}
        {!fixture && (data.trip || data.collective) && <Action href="/hub/groupe">Gérer le groupe</Action>}
      </>
    );
  }

  function renderDrawer(widget: Widget) {
    switch (widget) {
      case 'meteo':
        return data.weather ? <>
          <div className={styles.metric}>{number(data.weather.temperature)}°<span>{data.weather.condition}</span></div>
          {data.weather.place && <p className={styles.annotation}>{data.weather.place}</p>}
          {data.weather.rain && <p>Précipitations annoncées · {data.weather.rain}</p>}
          <ul className={styles.list}>{data.weather.days.map((forecast) => (
            <li key={forecast.date}><span><strong>{forecast.day} {dateLabel(forecast.date)}</strong><small>{forecast.condition}</small></span>
              <span>{number(forecast.low)}° / {number(forecast.high)}°</span>
            </li>
          ))}</ul>
        </> : <Empty>La météo n’est pas disponible pour cette aventure.</Empty>;
      case 'budget':
        return data.budget ? <>
          {amounts.length ? amounts.map((amount) => (
            <div className={styles.metric} key={amount.currency}>{money(amount)}<span>Dépensé</span></div>
          )) : <Empty>Aucune dépense enregistrée.</Empty>}
          {data.budget.planned && <p>Budget prévu · {money(data.budget.planned)}</p>}
          <ul className={styles.list}>{data.budget.expenses.map((expense) => (
            <li key={expense.id}><strong>{expense.title}</strong><span>{money(expense)}</span></li>
          ))}</ul>
          {!fixture && <Action href="/hub/budget">Gérer le budget</Action>}
        </> : <Empty>Le budget n’est pas disponible pour cette aventure ou pour ton rôle.</Empty>;
      case 'carte':
        return <>
          {data.route.length || pins.length ? <div className={`${styles.map} ${styles.fullMap}`}>
            <RouteSketch lines={data.route} pins={pins} />
          </div> : <Empty>Aucun tracé géolocalisé.</Empty>}
          <p className={styles.annotation}>{data.route.length ? 'Aperçu du tracé prévu' : pins.length ? 'Repères des étapes prévues' : ''}</p>
          {!fixture && data.trip && <Action href="/hub/itineraire">Ouvrir la carte interactive</Action>}
        </>;
      case 'etapes':
        if (selectedStep) return <>
          <h3 className={styles.detailTitle}>{selectedStep.title}</h3>
          <p className={styles.annotation}>{[`Jour ${selectedStep.day}`, selectedStep.time, selectedStep.place].filter(Boolean).join(' · ')}</p>
          {selectedStep.description && <p className={styles.bodyCopy}>{selectedStep.description}</p>}
          <ul className={styles.list}>
            {selectedStep.distance != null && <li><span>Distance prévue</span><strong>{number(selectedStep.distance)} km</strong></li>}
            {selectedStep.elevation != null && <li><span>Dénivelé positif</span><strong>{number(selectedStep.elevation)} m</strong></li>}
          </ul>
        </>;
        return <>
          <label className={styles.selectDay}>Jour du voyage
            <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
              {days.map((option) => <option key={option} value={option}>Jour {option}</option>)}
            </select>
          </label>
          <StepRows steps={daySteps} onStep={inspectStep} />
          {!fixture && data.trip && <Action href={`/hub/itineraire?jour=${day}`}>Ouvrir l’itinéraire</Action>}
        </>;
      case 'carnet':
        return <>
          {data.trip && <label className={styles.photoButton}><Camera size={19} aria-hidden /> Ajouter une photo
            <input type="file" accept="image/*,.heic,.heif" capture="environment" onChange={(event) => {
              addPhoto(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }} />
          </label>}
          {photoError && <p role="alert">{photoError}</p>}
          {photo && <article className={styles.photoDraft}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Photo du brouillon" />
            <h3>Brouillon dans cet onglet</h3>
            <p>{[photo.date, photo.day ? `Jour ${photo.day}` : null, photo.place].filter(Boolean).join(' · ')}</p>
            <button type="button" onClick={() => setPhoto(null)}>Retirer la photo</button>
          </article>}
          {data.notes.length === 0 && <Empty>Aucune note dans le carnet.</Empty>}
          <ul className={styles.list}>{data.notes.map((note) => (
            <li key={note.id}><span><strong>{note.title ?? 'Note du voyage'}</strong><small className={styles.bodyCopy}>{note.content}</small></span></li>
          ))}</ul>
          {!fixture && data.trip && <Action href="/hub/journal">Ouvrir le carnet de voyage</Action>}
        </>;
      case 'kit':
        return <>
          {data.kit.length ? <>
            <div className={styles.metric}>{kitPacked}/{data.kit.length}<span>Articles préparés</span></div>
            <ul className={styles.list}>{data.kit.map((item) => (
              <li key={item.id}><strong>{item.title}{item.amount > 1 ? ` × ${item.amount}` : ''}</strong>
                <span className={styles.itemStatus}>{item.packed ? <><Check aria-hidden size={16} /> Préparé</> : 'À préparer'}</span>
              </li>
            ))}</ul>
          </> : <Empty>Aucun article de kit renseigné pour cette aventure.</Empty>}
          {!fixture && data.trip && <Action href="/hub/kit-voyage">Gérer le kit</Action>}
        </>;
      case 'paperasse':
        return <>
          {!data.documents?.length && <Empty>{data.documents === null ? 'Documents indisponibles pour cette aventure ou pour ton rôle.' : 'Aucun document ajouté.'}</Empty>}
          {data.documents && <ul className={styles.list}>{data.documents.map((document) => (
            <li key={document.id}><span><strong>{document.title}</strong>
              <small>{document.expiration ? `Échéance · ${dateLabel(document.expiration)}` :
                document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'}</small>
            </span></li>
          ))}</ul>}
          {!fixture && data.documents !== null && <Action href="/hub/documents">Ouvrir les documents</Action>}
        </>;
      case 'groupe':
        return renderPeople();
    }
  }

  return (
    <main className={styles.shell}>
      <h1 className={styles.screenReader}>{data.title}</h1>
      {!isOnline && <p className={styles.offline} role="status"><WifiOff size={16} aria-hidden /> Hors connexion</p>}
      {!fixture && !data.trip && <Action href="/compas">Préparer une aventure</Action>}
      {(data.trip || data.collective) && <div className={styles.grid} aria-label="Tableau de bord du voyage">
        {data.trip && <>
        {tile('meteo', <>
          <span className={styles.value}>{data.weather ? `${number(data.weather.temperature)}°` : '—'}</span>
          {describe(data.weather?.condition ?? null, 'Prévisions indisponibles')}
        </>, styles.weather)}
        {tile('budget', <>
          <span className={`${styles.value} ${styles.budgetValue}`}>{amountLabel}</span>
          {describe(data.budget && amounts.length ? 'Dépensé' : null, data.budget ? 'Dépenses du voyage' : 'Données indisponibles')}
        </>, styles.budget)}
        {tile('carte', <>
          <span className={styles.map}>
            {data.route.length || pins.length ? <RouteSketch lines={data.route} pins={pins} /> : <Compass size={42} aria-hidden />}
          </span>
          <span className={styles.mapFacts}>
            {data.distance != null && <span><Navigation2 size={14} aria-hidden />{number(data.distance)} km</span>}
            {data.elevation != null && <span><Mountain size={15} aria-hidden />+{number(data.elevation)} m</span>}
            {data.distance == null && data.elevation == null && <span>{data.route.length ? 'Tracé prévu' : pins.length ? 'Repères des étapes' : 'Aucun tracé'}</span>}
          </span>
        </>, styles.mapTile)}
        {tile('etapes', <>
          <span className={styles.tileDetail}>{`Jour ${day}`}{data.dayCount ? ` sur ${data.dayCount}` : ''}</span>
          {!daySteps.length && <span className={styles.tileDetail}>Aucune étape prévue</span>}
          <span className={styles.miniSteps}>
            {daySteps.slice(0, 3).map((step) => (
              <span key={step.id}><small>{step.time ?? '—'}</small><strong>{step.title}</strong></span>
            ))}
          </span>
        </>, styles.steps)}
        {tile('carnet', <>{describe(photo ? 'Brouillon photo' : data.notes[0]?.title ?? null, 'Notes et photos')}</>, styles.carnet)}
        {tile('kit', <>{describe(data.kit.length ? `${kitPacked} sur ${data.kit.length} prêts` : null, 'Équipement')}</>, styles.kit)}
        {tile('paperasse', <>{describe(data.documents?.[0]?.title ?? null, 'Documents et billets')}</>, styles.docs)}
        </>}
        {tile('groupe', <>
          <span className={styles.groupSummary}>
            <span className={styles.avatars} aria-hidden>{data.people.slice(0, 3).map((person) => (
              <span className={styles.avatar} key={person.id}>{person.name?.slice(0, 1) ?? '•'}</span>
            ))}</span>
            <span><strong>{data.peopleCount == null ? 'Groupe du voyage' : data.peopleCount === 1 ? 'Voyage en solo' : `${data.peopleCount} participants`}</strong>
              {data.pending > 0 && <small>{data.pending} en attente</small>}
            </span>
          </span>
        </>, styles.group)}
      </div>}

      {!fixture && <footer className={styles.footer}>
        {adventureControl}
        <Link href="/kit-studio"><Backpack size={17} aria-hidden /> Kit Studio</Link>
        {data.trip && <Link href="/hub/securite">Sécurité <ChevronRight size={15} aria-hidden /></Link>}
      </footer>}

      <Dialog.Root open={active !== null} onOpenChange={(value) => { if (!value) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={styles.sheet}
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => { if (trigger.current) { event.preventDefault(); trigger.current.focus(); } }}
            onEscapeKeyDown={(event) => { if (selectedStep) { event.preventDefault(); backToSteps(); } }}
          >
            <div className={styles.handle} aria-hidden />
            <div className={styles.sheetHeader}>
              {selectedStep && <button type="button" ref={detailBack} onClick={backToSteps} aria-label="Retour aux étapes"><ChevronLeft size={22} /></button>}
              <Dialog.Title>{active ? widgets[active].name : 'Détail du voyage'}</Dialog.Title>
              <Dialog.Close aria-label="Fermer"><X size={20} /></Dialog.Close>
            </div>
            <div className={styles.sheetBody} ref={scrollPane}>{active && renderDrawer(active)}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
