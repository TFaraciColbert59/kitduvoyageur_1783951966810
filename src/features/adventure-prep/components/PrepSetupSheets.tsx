'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, SearchField, Switch } from '@/components/ui';
import { getCurrentGeoPosition, type GeoCoordinates } from '@/lib/native/geolocation';
import type { PublicUser } from '@/lib/users/publicUser';
import {
  buildReverseGeocodeUrl,
  myPositionToPlace,
  parseReverseGeocode,
  withDefaultOrigin,
  type CommuneName,
} from '../myPosition';
import { useAdventurePrepStore, type AdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  GroupMode,
  Pace,
  PlaceRef,
  TransportPreference,
} from '../types';
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER, budgetTierLabel } from '../engine/budgetTiers';
import { A_VERIFIER } from '../engine/trust';
import { buildGearNeeds, gearGaps } from '../engine/gear';
import { daysLabel } from '../engine/labels';
import { headcountOf, sharedGear } from '../engine/people';
import { geocodeMessage, useGeocode } from '../hooks/useGeocode';
import { placeCandidates, type PlaceCandidate } from '../placeCandidates';
import { PrepCalendar } from './PrepCalendar';
// Le gabarit des tiroirs. Le tiroir Lieu en est le modele ; le reste le
// RECOPIE plutot que de redessiner ses listes a la main (M1.1).
import {
  DrawerActions,
  DrawerEmpty,
  DrawerList,
  DrawerRow,
  DrawerSection,
} from './PrepDrawerTemplate';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';

// La carte du tiroir de lieu est la VRAIE carte (celle du hub), pas un cadre
// decoratif : le tiroir montait un div pose sur une grille CSS et inventait
// ses coordonnees. MapLibre est un chunk lourd, charge apres montage.
const HubGlobeMap = dynamic(
  () => import('@/features/hub/components/mobile/HubGlobeMap').then((module) => module.default),
  { ssr: false }
);

export interface PrepSheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
  onClose: () => void;
}

/**
 * Extremite du trajet que la vue « Lieu » edite.
 *
 * Indispensable : sans elle, la vue deduisait l extremite de `origin === null`
 * et editait donc l arrivee des la premiere fois que le depart etait choisi.
 * Cliquer « Depart » modifiait silencieusement l arrivee.
 */
export type PrepPlaceField = 'origin' | 'destination';

const PACES: readonly { id: Pace; label: string }[] = [
  { id: 'tranquille', label: 'Tranquille' },
  { id: 'normal', label: 'Normal' },
  { id: 'rapide', label: 'Rapide' },
];

const TRANSPORTS: readonly { id: TransportPreference; label: string }[] = [
  { id: 'peigne', label: 'À pied' },
  { id: 'train', label: 'Train' },
  { id: 'voiture', label: 'Voiture' },
  { id: 'avion', label: 'Avion' },
  { id: 'mixte', label: 'Mixte' },
];

const INTERESTS: readonly string[] = [
  'Nature',
  'Paysage',
  'Patrimoine',
  'Gastronomie',
  'Photographie',
  'Eau',
];

function SheetActions({
  onClose,
  onApply,
  label = 'Appliquer',
}: {
  onClose: () => void;
  onApply: () => void;
  label?: string;
}) {
  return (
    <div className="prep-actionrow prep-actionrow--sticky" style={{ marginTop: 16, justifyContent: 'flex-end', display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="md" onClick={onClose}>
        Annuler
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={() => {
          onApply();
          onClose();
        }}
      >
        {label}
      </Button>
    </div>
  );
}

/**
 * La section du tiroir, version d avant le gabarit.
 *
 * Elle reste parce que `--f-h2` n est defini dans aucun CSS du depot : la
 * taille retombait sur l heritage, ce qui rendait le titre dependant du
 * contexte. Le gabarit (`DrawerSection`) ne porte plus de style inline et
 * laisse `.prep-section-title` faire son travail. Ce corps n est conserve que
 * le temps que les derniers tiroirs migrate ; il rend le MEME balisage.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="prep-drawer__section" style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      <h3 className="prep-section-title">{title}</h3>
      {children}
    </section>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.id}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiChipRow<T extends string>({
  options,
  values,
  onChange,
}: {
  options: readonly { id: T; label: string }[] | readonly string[];
  values: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const id = typeof option === 'string' ? option : option.id;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <button
            key={id}
            className="chip"
            aria-pressed={values.includes(id as T)}
            onClick={() => onChange(id as T)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function useLocalPlaces(): readonly PlaceRef[] {
  return useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('lkdv_prep_recent_places_v1');
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlaceRef[]) : [];
    } catch {
      return [];
    }
  }, []);
}

function rememberPlace(place: PlaceRef): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('lkdv_prep_recent_places_v1');
    const current: PlaceRef[] = raw ? (JSON.parse(raw) as PlaceRef[]) : [];
    const next = [place, ...current.filter((item) => item.id !== place.id)].slice(0, 12);
    window.localStorage.setItem('lkdv_prep_recent_places_v1', JSON.stringify(next));
  } catch {
  }
}

/* ------------------------------------------------------------------ */
/* Position reelle — le module natif, jamais un appel parallele          */
/* ------------------------------------------------------------------ */

/**
 * Convertit une lecture GPS en lieu selectionnable.
 *
 * L'identifiant ne depend QUE des coordonnees : deux reponses successives
 * pour le meme spot doivent produire le meme lieu, sinon la liste afficherait
 * deux lignes pour une seule position.
 *
 * `country` reste vide. Un GPS ne donne pas de pays : ecrire « France » a
 * partir de 45,9 N / 6,8 E serait une invention presentee comme une donnee.
 */
export function toMyPositionPlace(gps: GeoCoordinates): PlaceRef {
  return {
    id: `here-${gps.latitude.toFixed(5)}-${gps.longitude.toFixed(5)}`,
    name: 'Ma position',
    country: '',
    lat: gps.latitude,
    lon: gps.longitude,
  };
}

/**
 * Place la position reelle en tete de la liste des lieux, une seule fois.
 *
 * Fonction pure : la liste d origine n'est ni triee en place ni completee, on
 * renvoie une nouvelle liste. `null` = pas de position : la liste reste telle
 * quelle plutot que de recevoir une ligne vide.
 */
function asCandidate(item: PlaceCandidate | PlaceRef): PlaceCandidate {
  if ('place' in item) return item;
  const unverified = item.lat === 0 || item.lon === 0;
  return {
    place: item,
    source: 'remembered',
    precision: unverified ? 'unknown' : 'commune',
    context: null,
    hint: unverified ? 'Coordonnées à vérifier — le parcours ne partira pas de ce point.' : null,
  };
}

/**
 * L4.6 — une suggestion sans nom lisible ne s'affiche pas.
 *
 * Le proprietaire l'a tranche : pas de nom, pas de ligne. La seule chose
 * qu'un point nu sait dire, c'est sa position ; la publier dans la liste
 * remplacerait un nom de lieu par « 46.79907° N 2.56303° E », c'est-a-dire
 * des nombres bruts la ou la personne attendait un lieu.
 *
 * Le contrat des lignes (titre « Point sans nom verifie », detail
 * « Coordonnees : ... ») reste intact pour qui l'appelle : c'est le tiroir
 * qui refuse d'afficher la ligne, pas la ligne qui ment sur elle-meme.
 */
export function isDisplayableSuggestion(candidate: PlaceCandidate): boolean {
  return candidate.place.name.trim().length > 0;
}

export function mergePositionCandidate(
  results: readonly (PlaceCandidate | PlaceRef)[],
  place: PlaceRef | null,
): readonly PlaceCandidate[] {
  const list = results.map(asCandidate);
  if (place === null) return list;
  const candidate: PlaceCandidate = {
    place,
    source: 'remembered',
    precision: 'commune',
    context: null,
    hint: null,
  };
  return [candidate, ...list.filter((item) => item.place.id !== place.id)];
}

function geolocationCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

/**
 * Traduit un echec de geolocalisation en phrase utilisable.
 *
 * `null` quand il n'y a rien a dire : pas d'erreur, pas de bandeau. Sinon les
 * trois refus du navigateur sont nommes differemment, parce que les remedies
 * ne se ressemblent pas (autoriser, sortir, reessayer).
 */
export function geoErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const code = geolocationCode(error);
  if (code === 1) return 'Position non activée — choisis ton lieu dans la liste ci-dessous.';
  if (code === 2) return 'Position indisponible — le GPS ne répond pas sur ce coup-là.';
  if (code === 3) return 'Position introuvable — trop de temps sans réponse, réessaie dehors.';
  const detail = error instanceof Error ? error.message.trim() : '';
  return detail ? `Position non obtenue — ${detail}.` : 'Position non obtenue — la localisation a échoué.';
}

// Le refus de permission n est pas une panne : c est une decision. Elle ne doit
// donc pas s afficher en rouge, la liste des lieux juste en dessous fait le travail.
export function isGeoDenied(error: unknown): boolean {
  return geolocationCode(error) === 1;
}

/** Etat de la position reelle : lue a l'ouverture, relue sur demande. */
function useMyPosition() {
  const [gps, setGps] = useState<GeoCoordinates | null>(null);
  const [commune, setCommune] = useState<CommuneName | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [locating, setLocating] = useState(false);

  const read = useCallback(() => {
    setLocating(true);
    setError(null);
    getCurrentGeoPosition()
      .then((next) => {
        setGps(next);
        setError(null);
        // Le GPS donne deux nombres ; le nom vient du service, jamais de nous.
        // Un echec ici ne doit surtout pas annuler la position : on garde le
        // point mesure et la ligne s affiche sous « Ma position ».
        const controller = new AbortController();
        fetch(buildReverseGeocodeUrl(next), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
          .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
          .then((payload: unknown) => setCommune(parseReverseGeocode(payload)))
          .catch(() => setCommune(null));
      })
      .catch((cause: unknown) => {
        setError(cause);
      })
      .finally(() => {
        setLocating(false);
      });
  }, []);

  // La position doit etre presente DANS la liste des que le tiroir s'ouvre :
  // la demander au clic obligerait a faire un geste de plus pour l'option la
  // plus frequente (partir de chez soi).
  useEffect(() => {
    read();
  }, [read]);

  return {
    gps,
    commune,
    error,
    errorMessage: geoErrorMessage(error),
    denied: isGeoDenied(error),
    locating,
    read,
    place: gps === null ? null : myPositionToPlace(gps, commune),
  };
}

/**
 * Le depart par defaut de l'ecran 2.
 *
 * A l'arrivee sur l'ecran, si la personne n'a choisi aucun depart, on propose
 * l ou elle est. La ligne apparait une fois, avec le nom de la commune, et
 * reste modifiable : c'est une donnee reelle proposee, jamais une valeur
 * imposee. Si la localisation est refusee, rien ne s'ecrit et l'ecran
 * continue d'afficher « a verifier » — ce qui est vrai.
 */
export function useDefaultOrigin(enabled: boolean) {
  const [place, setPlace] = useState<PlaceRef | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const controller = new AbortController();
    getCurrentGeoPosition()
      .then((gps) =>
        fetch(buildReverseGeocodeUrl(gps), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
          .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
          .then((payload: unknown) => {
            if (alive) setPlace(myPositionToPlace(gps, parseReverseGeocode(payload)));
          })
          .catch(() => {
            if (alive) setPlace(myPositionToPlace(gps, null));
          }),
      )
      .catch(() => {
        // Position refusee ou indisponible : aucun depart n est invente.
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [enabled]);

  useEffect(() => {
    if (place === null) return;
    const { draft, setRoute } = useAdventurePrepStore.getState();
    const next = withDefaultOrigin(draft.route, place);
    if (next !== draft.route) setRoute(next);
  }, [place]);

  return place;
}

/* ------------------------------------------------------------------ */
/* Personnes — la liste d'amis et la recherche, lues dans la base       */
/* ------------------------------------------------------------------ */

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Lit la reponse de `/api/users/search` telle quelle, sans rien ajouter.
 *
 * Une charge utile malformee vaut ABSENCE de donnee (`null`), pas liste vide :
 * « personne trouve » et « service casse » ne doivent pas se melanger, sinon
 * l'ecran affirmerait un fait qui n'a pas ete verifie. Une ligne sans
 * identifiant est ecartee : sans cle, on ne peut ni la selectionner ni l'inviter.
 */
export function parsePeopleResponse(payload: unknown): PublicUser[] | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const users = (payload as { users?: unknown }).users;
  if (!Array.isArray(users)) return null;
  const out: PublicUser[] = [];
  for (const row of users as unknown[]) {
    if (typeof row !== 'object' || row === null) continue;
    const item = row as Record<string, unknown>;
    const id = readString(item.id);
    if (id === null) continue;
    out.push({
      id,
      fullName: readString(item.fullName) ?? '',
      avatarUrl: readString(item.avatarUrl),
      location: readString(item.location),
      trustScore: readNumber(item.trustScore),
    });
  }
  return out;
}

/**
 * Nom affichable d'un profil.
 *
 * Jamais de prenom invente : un profil sans nom public reste affichable sous
 * une formule explicite, pas sous une initiale qui ferait croire a une donnee.
 */
export function userDisplayName(person: PublicUser): string {
  const name = person.fullName.trim();
  return name.length > 0 ? name : 'Profil sans nom';
}

/** Interroge la vraie base : les abonnements, ou n'importe quel profil. */
export function peopleRequestUrl(scope: 'friends' | 'all', query: string | null): string {
  const params = new URLSearchParams({ scope });
  const clean = query?.trim() ?? '';
  if (clean.length >= 2) params.set('q', clean);
  return `/api/users/search?${params.toString()}`;
}

/**
 * Phrase d'echec de la lecture des personnes.
 *
 * `null` = pas d'erreur. Le hors-ligne est distingue d'un refus de session,
 * et une panne du service ne doit JAMAIS se lire « aucun resultat » : c'est la
 * difference entre « la liste est vide » et « la liste n'est pas la ».
 */
export function peopleErrorMessage(status: number | null): string | null {
  if (status === null) return null;
  if (status === 0) return 'Hors ligne — la liste ne peut pas être lue.';
  if (status === -1) return 'Réponse illisible — la liste est indisponible.';
  if (status === 401 || status === 403) return 'Session absente — tu n’es pas connecté, reconnecte-toi pour voir tes amis.';
  if (status === 400) return 'Recherche refusée — affine le terme.';
  if (status >= 500) return 'Service indisponible — la liste ne se charge pas.';
  if (status >= 200 && status < 300) return null;
  return `Liste indisponible (code ${status}).`;
}

type PeopleState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly people: readonly PublicUser[] }
  | { readonly kind: 'failed'; readonly status: number | null };

/**
 * Lecture des personnes, sans repli silencieux.
 *
 * `url === null` = rien a demander (recherche trop courte). Sinon la reponse
 * est lue telle quelle ; une panne reste une panne, jamais une liste vide.
 */
function usePeople(url: string | null): PeopleState {
  const [state, setState] = useState<PeopleState>({ kind: 'idle' });

  useEffect(() => {
    if (url === null) {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setState({ kind: 'loading' });
    fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw response;
        return response.json() as Promise<unknown>;
      })
      .then((payload: unknown) => {
        if (!alive) return;
        const people = parsePeopleResponse(payload);
        if (people === null) {
          setState({ kind: 'failed', status: -1 });
          return;
        }
        setState({ kind: 'ready', people });
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        if (cause instanceof Error && cause.name === 'AbortError') return;
        const status =
          typeof cause === 'object' && cause !== null && 'status' in cause
            ? Number((cause as Response).status)
            : 0;
        setState({ kind: 'failed', status: Number.isFinite(status) ? status : 0 });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [url]);

  return state;
}

/** Liste d'invites : immuable, sans doublon, nom nettoye. */
export function addMember(members: readonly string[], name: string): readonly string[] {
  const clean = name.trim();
  if (clean.length === 0) return members;
  if (members.includes(clean)) return members;
  return [...members, clean];
}

export function removeMember(members: readonly string[], name: string): readonly string[] {
  if (!members.includes(name)) return members;
  return members.filter((member) => member !== name);
}

/**
 * Mode du voyage, deduit et non choisi.
 *
 * Une personne seule reste seule. Des que le groupe compte une personne de
 * plus — adulte, enfant ou invite — c'est un groupe. L'inference remplace le
 * choix « solo ou groupe », qui pouvait contredire les chiffres saisis.
 */
export function groupModeFrom(
  adults: number,
  children: number,
  knownMembers: readonly string[],
): GroupMode {
  return adults + children + knownMembers.length > 1 ? 'groupe' : 'solo';
}

function PersonRow({
  person,
  invited,
  onToggle,
}: {
  person: PublicUser;
  invited: boolean;
  onToggle: () => void;
}) {
  const detail = [
    person.location,
    person.trustScore === null ? null : `confiance ${person.trustScore}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
  return (
    <button type="button" className={`li ${invited ? 'sel' : ''}`} onClick={onToggle}>
      <div className="rt">
        <div className="t1">{userDisplayName(person)}</div>
        <div className="t2">{detail || 'Profil à vérifier'}</div>
      </div>
      <Icon name={invited ? 'check' : 'plus'} size={16} />
    </button>
  );
}

/** Liste de personnes, ou la raison exacte pour laquelle elle est absente. */
function PeopleList({
  state,
  invited,
  onToggle,
  emptyLabel,
}: {
  state: PeopleState;
  invited: readonly string[];
  onToggle: (name: string) => void;
  emptyLabel: string;
}) {
  if (state.kind === 'loading') {
    return <div className="note neutral">Chargement…</div>;
  }
  if (state.kind === 'failed') {
    return <div className="note red">{peopleErrorMessage(state.status) ?? 'Liste indisponible.'}</div>;
  }
  if (state.kind === 'ready' && state.people.length === 0) {
    return <div className="note neutral">{emptyLabel}</div>;
  }
  if (state.kind !== 'ready') return null;
  return (
    <div className="list">
      {state.people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          invited={invited.includes(userDisplayName(person))}
          onToggle={() => onToggle(userDisplayName(person))}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carte courte                                                         */
/* ------------------------------------------------------------------ */

/**
 * Demi-etendue du carre de selection, en degres, de chaque cote du centre.
 *
 * 0.18 deg vaut environ 20 km : c'est la portee utile pour trancher entre deux
 * communes voisines quand le lieu connu n'est pas un point precis.
 */
export function pickerSpanFor(zoomLevel: number): number {
  return 0.18 / 2 ** Math.max(0, Math.min(2, Math.round(zoomLevel)));
}

/** Centre par defaut : la France, quand aucun point n'est encore connu. */
const PICKER_FALLBACK = { lat: 46.6, lon: 2.45 } as const;

/** Hauteur en pixels : une carte « peu haute », pas un carre plein ecran. */
const MINI_MAP_HEIGHT = 150;

/** Arrondi lisible : cinq decimales valent environ 1 m, on s'arrete la. */
function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function formatCoord(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(5)}° ${hemisphere}`;
}

export interface PickerCaption {
  /** Ce qui se lit en tete : le nom du lieu quand on l'a, sinon la position. */
  readonly label: string;
  /** La position exacte, quand le nom occupe deja la tete. */
  readonly detail: string | null;
}

/**
 * AN5 — la legende du point, sous la carte du tiroir Lieu.
 *
 * Defaut corrige (constate le 2026-09-28) : la carte affichait la position
 * seule, meme quand le lieu portait un nom. Choisir « Chamonix-Mont-Blanc »
 * laissait lire « 45.92375° N · 6.86933° E » : des nombres a la place du nom
 * choisi, donc plus rien pour verifier d'un coup d'oeil ce qu'on a retenu.
 *
 * Regle : le NOM vient toujours en tete des qu'il existe. La position ne
 * disparaît pas pour autant — elle descend en second, parce qu'elle reste une
 * information vraie et precise. Et rien n'est invente pour la remplacer :
 * un point sans nom garde la position comme unique fait, ce qui est
 * exactement ce qu'on sait de lui.
 *
 * `place` n'est jamaisMelange a un point pose : en mode pose le marqueur est
 * neuf, et lui attribuer le nom de l'ancien lieu afficherait un nom qui ne
 * designe pas le point. D'ou le `null` passe par l'ecran en mode interactif.
 */
export function pickerPlaceCaption(
  place: PlaceRef | null,
  marker: { readonly lat: number; readonly lon: number } | null,
  interactive: boolean,
  typedName = '',
): PickerCaption | null {
  if (marker === null) return null;
  const position = `${formatCoord(marker.lat, 'N', 'S')} · ${formatCoord(marker.lon, 'E', 'O')}`;
  const name = interactive ? typedName.trim() : (place?.name ?? '').trim();
  if (name.length === 0) return { label: position, detail: null };
  const country = (place?.country ?? '').trim();
  return { label: country.length > 0 ? `${name} · ${country}` : name, detail: position };
}

// Les deux extremites du trace affiche par la carte du tiroir.
// `HubGlobeMap` ne rend rien sans deux points distincts : on lui donne le
// centre et, s il existe, le point pose. Sans point pose, un second point a
// l echelle du perimetre cadre la bonne region sans inventer de destination.
export function pickerRouteCoords(
  centre: { readonly lat: number; readonly lon: number } | null,
  picked: { readonly lat: number; readonly lon: number } | null
): Array<[number, number]> {
  const origin = centre ?? PICKER_FALLBACK;
  const span = pickerSpanFor(0);
  const end = picked ?? { lat: origin.lat + span, lon: origin.lon + span };
  return [
    [origin.lat, origin.lon],
    [end.lat, end.lon],
  ];
}

export interface PickedPoint {
  readonly lat: number;
  readonly lon: number;
  readonly name: string;
}

interface MiniMapProps {
  /** Centre propose : le lieu retenu, sinon l'autre extremite du trajet. */
  readonly centre: { readonly lat: number; readonly lon: number } | null;
  /** Lieu retenu, montre comme repere quand la carte ne sert qu'a informer. */
  readonly shown: PlaceRef | null;
  /** `true` quand la carte sert a poser un point, `false` quand elle montre. */
  readonly interactive: boolean;
  readonly onPick: (point: PickedPoint) => void;
  readonly onCancel: () => void;
}

/**
 * Carte courte, toujours presente.
 *
 * La poser sur le carre, et non sur une image : `PrepMap` est un schema
 * vectoriel sans fond de tuiles ni projection cliquable. Y accrocher un point
 * donnerait des coordonnees posees sur une image qui ne sait pas ou elle se
 * trouve. Ici le clic est resolu en pourcentage puis reconverti, donc la
 * coordonnee ne depend pas de la taille reelle du composant.
 *
 * Deux modes : en lecture elle montre le lieu retenu et n'offre aucun bouton ;
 * en pose, elle ajoute le nom facultatif et la validation. Poser un point et
 * valider sont deux gestes distincts, sinon la premiere touche appliquerait le
 * lieu et fermerait le tiroir.
 */
function MiniMap({ centre, shown, interactive, onPick, onCancel }: MiniMapProps) {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // La carte est basse dans le tiroir : passer en mode pose sans la ramener a
  // l'ecran ferait poser le point hors du regard, et la personne lirait la
  // carte comme having ignore son geste.
  useEffect(() => {
    if (!interactive) return;
    wrapRef.current?.scrollIntoView({ block: 'nearest' });
  }, [interactive]);

  const onMapClick = (lat: number, lon: number) => {
    setPoint({ lat: round5(lat), lon: round5(lon) });
  };

  const marker = interactive
    ? point
    : shown === null || (shown.lat === 0 && shown.lon === 0)
      ? null
      : { lat: shown.lat, lon: shown.lon };
  const routeCoords = pickerRouteCoords(centre, interactive ? point : marker);

  // La carte doit afficher le point pose comme un repere : c est lui qui
  // donne le retour visuel du clic, et il remplace la fausse epingle CSS.
  const markerPoints: HubRoutePoint[] =
    marker === null
      ? []
      : [
          {
            id: 'picker-point',
            lat: marker.lat,
            lon: marker.lon,
            label: interactive
              ? name.trim() === ''
                ? 'Point choisi'
                : name.trim()
              : (shown?.name?.trim() ?? '') || 'Lieu retenu',
            category: 'step',
            color: '#1f7a4d',
          },
        ];

  // En lecture, la legende suit le lieu retenu ; en pose, elle suit le point
  // que la personne vient de poser. `shown` n'est donc pas passe en mode
  // interactif : son nom ne designerait pas le nouveau point.
  const caption = pickerPlaceCaption(
    interactive ? null : shown,
    marker,
    interactive,
    name,
  );

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        className="prep-picker"
        style={{ height: MINI_MAP_HEIGHT, cursor: interactive ? 'crosshair' : 'default' }}
      >
        <HubGlobeMap
          name={interactive ? 'Choix du point' : shown?.name || 'Lieu du trajet'}
          routeCoords={routeCoords}
          points={markerPoints}
          onMapClick={interactive ? onMapClick : undefined}
          hideBuiltInControls
          className="prep-picker__map"
        />
      </div>

      {caption !== null ? (
        <div className="prep-picker__caption">
          <span className="prep-picker__caption-label">{caption.label}</span>
          {caption.detail !== null ? (
            <span className="prep-picker__caption-detail">{caption.detail}</span>
          ) : null}
        </div>
      ) : null}

      {marker === null ? (
        <p className="prep-picker__hint">
          {interactive
            ? 'Touche la carte pour placer le point'
            : 'Position à vérifier pour cette étape'}
        </p>
      ) : null}

      {interactive ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="t2">Nom du point (facultatif)</span>
            <SearchField
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Le col"
              aria-label="Nom du point choisi"
              onClear={() => setName('')}
            />
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
              Annuler
            </Button>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              disabled={point === null}
              onClick={() => {
                if (!point) return;
                onPick({ ...point, name: name.trim() });
              }}
            >
              Utiliser ce point
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Un point pose devient un lieu — mais un lieu sans nom si personne n'en a saisi
 * un. Le nom vient de la personne ou de rien : ni adresse devinee, ni
 * « Point 50.64° N 03.06° E ». Une coordonnee ne se lit pas comme un nom de
 * lieu, et l'afficher comme tel laisserait croire a une verification que
 * personne n'a faite.
 */
export function pickedPlace(point: PickedPoint): PlaceRef {
  return {
    id: `point-${point.lat.toFixed(4)}-${point.lon.toFixed(4)}`,
    name: point.name,
    country: '',
    lat: point.lat,
    lon: point.lon,
  };
}

/** Titre d'une ligne de resultats : un point sans nom se dit tel quel. */
export function placeRowTitle(place: PlaceRef): string {
  return place.name.trim() === '' ? 'Point sans nom vérifié' : place.name;
}

/** Sous-titre d'une ligne de resultats : la seule information vraie, sinon. */
export function placeRowDetail(place: PlaceRef, candidate: PlaceCandidate): string {
  const hasCoords = !(place.lat === 0 && place.lon === 0);
  if (place.name.trim() === '') {
    // Sans nom, il ne reste que la position. Elle est publiee comme une
    // coordonnee ; le titre porte deja « a verifier ».
    return hasCoords
      ? `Coordonnées : ${formatCoord(place.lat, 'N', 'S')} ${formatCoord(place.lon, 'E', 'O')}`
      : 'Point sans nom ni coordonnees exploitables';
  }
  return (
    [place.country, candidate.context].filter(Boolean).join(' · ') ||
    candidate.hint ||
    'Coordonnées à vérifier'
  );
}

function PlaceRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: PlaceCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { place } = candidate;
  return (
    <button type="button" className={`li ${selected ? 'sel' : ''}`} onClick={onSelect}>
      <div className="rt">
        <div className="t1">{placeRowTitle(place)}</div>
        <div className="t2">{placeRowDetail(place, candidate)}</div>
      </div>
      {selected ? <Icon name="check" size={16} /> : null}
    </button>
  );
}

/** Bouton icone : meme verre que les autres, mais carre et sans texte. */
const ICON_BUTTON: React.CSSProperties = {
  width: 'var(--control-height-md)',
  minWidth: 'var(--control-height-md)',
  padding: 0,
  borderRadius: 'var(--lkv-radius-full)',
};

export function PlaceSheet({ draft, actions, onClose, field }: PrepSheetProps & { field?: PrepPlaceField | null }) {
  const recent = useLocalPlaces();
  const [query, setQuery] = useState('');
  // Recherche et pose sur la carte sont deux gestes distincts : melanges, ils
  // se marchent dessus. `picking` bascule d'un mode a l'autre.
  const [picking, setPicking] = useState(false);
  const myPosition = useMyPosition();

  // `field` vient de la ligne cliquee. Le repli ne sert que si la vue est
  // ouverte sans contexte (deep link, test) : alors on deduit comme avant.
  const target: PrepPlaceField = field ?? (draft.route.origin === null ? 'origin' : 'destination');
  const isOrigin = target === 'origin';
  const current = isOrigin ? draft.route.origin : draft.route.destination;
  const other = isOrigin ? draft.route.destination : draft.route.origin;

  const geo = useGeocode(query);
  const matches = geo.kind === 'results' ? geo.matches : [];
  const results = useMemo(
    () => placeCandidates({ recent, matches, hasQuery: query.trim().length > 0, query }),
    [recent, matches, query],
  );

  // La position reelle ouvre la liste, pour le depart comme pour l'arrivee.
  const here = myPosition.place;
  // L4.6 — un point sans nom n entre pas dans la liste : ni ici, ni plus tard
  // par la liste « lieux mémorisés ». La ligne ne peut pas etre rendue, donc
  // elle ne se propose pas.
  const list = useMemo(
    () => mergePositionCandidate(results, here).filter(isDisplayableSuggestion),
    [results, here],
  );
  const geoMessage = geocodeMessage(geo);

  const apply = (place: PlaceRef, remember = true) => {
    if (remember) rememberPlace(place);
    actions.setRoute(
      isOrigin ? { ...draft.route, origin: place } : { ...draft.route, destination: place },
    );
  };

  const hasCoords = (place: PlaceRef | null): place is PlaceRef =>
    place !== null && !(place.lat === 0 && place.lon === 0);

  // Centre propose au selecteur : le lieu deja retenu, sinon l'autre extremite
  // du trajet, sinon la position reelle. Choisir l arrivee en dernier n'impose
  // donc pas de repartir de zero.
  const centre = useMemo<{ readonly lat: number; readonly lon: number } | null>(() => {
    if (hasCoords(current)) return { lat: current.lat, lon: current.lon };
    if (other) return { lat: other.lat, lon: other.lon };
    return here;
  }, [current, other, here]);

  const shown = hasCoords(current) ? current : here;

  const applyPicked = (point: PickedPoint) => {
    setPicking(false);
    apply(pickedPlace(point));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="prep-search">
        <Button
          size="md"
          variant="secondary"
          style={ICON_BUTTON}
          aria-label="Utiliser ma position"
          onClick={() => (here === null ? myPosition.read() : apply(here, false))}
        >
          <Icon name="compass" size={18} />
        </Button>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un lieu…"
          aria-label="Rechercher un lieu"
        />

        {query.length > 0 ? (
          <Button
            size="md"
            variant="ghost"
            style={ICON_BUTTON}
            aria-label="Effacer la recherche"
            onClick={() => setQuery('')}
          >
            <Icon name="x" size={16} />
          </Button>
        ) : null}

        <Button
          size="md"
          variant="secondary"
          style={ICON_BUTTON}
          aria-label="Choisir un point sur la carte"
          aria-pressed={picking}
          onClick={() => setPicking((next) => !next)}
        >
          <Icon name="map" size={18} />
        </Button>
      </div>

      <div
        className="row between small muted"
        // Le flex est pose ici, pas dans la feuille : sans lui les deux
        // extremites se collent (« DepartAutre extremite a choisir »).
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: -4,
        }}
      >
        <span>{isOrigin ? 'Départ' : 'Arrivée'}</span>
        <span>{other ? (isOrigin ? 'Arrivée' : 'Départ') : 'Autre extrémité à choisir'}</span>
      </div>

      {myPosition.errorMessage ? (
        <div className={myPosition.denied ? 'note neutral' : 'note red'}>
          {myPosition.errorMessage}
        </div>
      ) : null}

      <div className="list">
        {list.map((candidate) => (
          <PlaceRow
            key={`${candidate.source}:${candidate.place.id}`}
            candidate={candidate}
            selected={current?.id === candidate.place.id}
            onSelect={() => apply(candidate.place, candidate.place.id !== here?.id)}
          />
        ))}
      </div>

      {geoMessage ? <div className="note neutral">{geoMessage}</div> : null}

      {/* Basse, et apres la liste : chercher puis choisir, ou alors poser un
          point. Au milieu, la carte coupait la recherche en deux et mangeait la
          moitie du tiroir sans rien apprendre. */}
      <MiniMap
        centre={centre}
        shown={shown}
        interactive={picking}
        onPick={applyPicked}
        onCancel={() => setPicking(false)}
      />

      {/* L4.1 — un SEUL verre. Ce `backgroundColor` peignait un second
          materiau plat par-dessus le verre du tiroir : la bande devenait plus
          sombre, a bords durs, et le degrade de la feuille s'arretait net au
          niveau du bouton. Le pied n'ajoute plus de fond — seul le verre de la
          feuille traverse.

          L4.5 — plus de `marginTop: 'auto'` : c'etait l'ecarteur qui laissait
          le tiroir a moitie vide quand le contenu etait court. Le tiroir prend
          la hauteur de son contenu, le bouton suit le dernier bloc. */}
      <div
        className="prep-place-cta"
        style={{
          paddingTop: '16px',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <Button variant="primary" style={{ width: '100%' }} disabled={!current} onClick={onClose}>
          Choisir ce lieu
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date — un seul calendrier, le retour appartient a l'IA              */
/* ------------------------------------------------------------------ */

/**
 * Ajoute des jours en arithmetique UTC.
 *
 * `new Date('2026-07-11T12:00:00')` puis `toISOString()` fait dependre la date
 * rendue du fuseau de la machine : en UTC-12, midi le 11 devient le 11 a
 * 00h... ou le 10 selon le sens. On travaille donc sur minuit UTC.
 */
function isoPlusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Ne garde une date de retour que si elle decoule encore du depart et de la
 * duree.
 *
 * Changer le depart invalide une arrivee plus ancienne : la conserver
 * afficherait un trajet qui n'existe pas. On prefere `null` — « l'IA choisira »
 * — plutot qu'une date devenue fausse.
 */
export function keepReturnDate(
  returnDate: string | null,
  startDate: string | null,
  durationDays: number | null,
): string | null {
  if (returnDate === null || startDate === null || durationDays === null) return null;
  if (durationDays < 1) return null;
  return isoPlusDays(startDate, durationDays - 1) === returnDate ? returnDate : null;
}


/**
 * C9 - l heure de depart, SAISIE et jamais deduite.
 *
 * Le modele, le store et la route de commit portaient deja cette heure ; le
 * tiroir ne laissait personne la saisir. Ce composant pose le seul maillon
 * qui manquait, et il est volontairement mince : la regle de l heure est
 * ecrite UNE fois, dans `normalizeClockTime` (types.ts). Le champ
 * n APPROCHE rien, ne complete rien, ne devine rien.
 *
 * Deux consequences, qui sont le contrat de C9 :
 *
 *   - une heure absente reste ABSENTE (`null`). Le champ s affiche donc vide,
 *     jamais « 08:00 » : une heure affichee sans reponse derriere elle se
 *     lirait comme un fait. C est cette absence qui laisse l IA choisir le
 *     moment le plus opportun ;
 *   - une saisie invalide ne devient pas une heure approchee : le store la
 *     normalise en `null`, et l absence se relit comme une absence.
 *
 * Le `<input type="time">` natif est le seul controle qui donne le pave
 * numerique du systeme et la validation HH:MM sur mobile. Il est laisse
 * TRANSPARENT (`opacity: 0`) et pose sur une pastille de verre : le natif
 * garde son comportement, le tiroir garde son materiau. Aucun glyphe n est
 * ajoute — le depot n expose pas d icone d horloge, et en inventer une
 * produirait un dessin qui ne veut rien dire.
 */
function StartTimeField(props: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { value, onChange } = props;

  return (
    <div className="field">
      <label htmlFor="prep-start-time" className="t2">
        Heure de départ
      </label>

      {/* Le materiau vient de la FEUILLE, jamais du composant : `.note` porte
          le verre du tiroir, et lui seul. Un fond pose ici rouvrirait la porte
          a un second materiau et casserait le verre — regle que le tiroir Lieu
          fait verifier sur le CODE, pas seulement sur le rendu. Le composant ne
          declare donc que la GEOMETRIE de la pastille. */}
      <span
        className="note"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          width: "fit-content",
          minHeight: 44,
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          className={value === null ? "t2" : "t1"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
            // La couleur est POSEE ICI, et pas laissee a la classe. `.t1`
            // porte `--lkv-text-primary` : c est l encre des surfaces CLAIRES
            // du hub, pas celle du verre. Mesure au navigateur (2026-09-29,
            // 393x852) sur ce composant reel, l heure choisie sortait en
            // rgb(23, 43, 36) sur la pastille sombre - quasi-noir sur
            // quasi-noir, donc une heure repondue illisible, et la pastille
            // devenait l element le plus lumineux d une carte qui ne veut rien
            // dire. Le tiroir expose ses propres encres, mesurees sur SON
            // verre : une heure repondue est un accent pose, une heure absente
            // est une reponse qui n a pas ete donnee. La classe ne garde que
            // la TAILLE ; la COULEUR vient du tiroir.
            color:
              value === null
                ? "var(--prep-ink-secondary)"
                : "var(--prep-ink-accent-strong)",
            // L absence se DIT. Une heure vide ne s affiche pas comme une heure
            // approchee, mais comme une reponse qui n a pas ete donnee.
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {value === null ? "À choisir" : value}
        </span>

        {/* Le depot natif est TRANSPARENT et pose sur la pastille : le natif
            garde son comportement et son pave numerique, la feuille garde le
            materiau. Aucun glyphe n est ajoute — le tiroir Quand n expose pas
            d icone d horloge, et en inventer une produirait un dessin qui ne
            veut rien dire. L element reste focusable et atteignable : on ne le
            masque que visuellement. */}
        <input
          id="prep-start-time"
          type="time"
          value={value ?? ""}
          aria-label="Heure de départ"
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            border: 0,
            padding: 0,
          }}
        />
      </span>

      <p className="prep-drawer__note">
        {value === null
          ? "Facultatif. Laisse vide, l’IA choisira le moment le plus opportun."
          : "Départ choisi. Efface le champ pour revenir à un choix de l’IA."}
      </p>
    </div>
  );
}

export function CalendarSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [startDate, setStartDate] = useState(draft.calendar.startDate ?? '');
  const [duration, setDuration] = useState(
    draft.calendar.durationDays === null ? '' : String(draft.calendar.durationDays),
  );
  // C9 - l heure se LIT sur le brouillon, elle ne se deduit pas. Un champ vide
  // donne `null` : le store le normalise, et l absence reste une absence.
  const [startTime, setStartTime] = useState<string | null>(draft.calendar.startTime ?? null);

  // C9 - la saisie traverse IMMEDIATEMENT le store, et pas seulement a la
  // validation : le tiroir du Lieu et le tiroir Quand sont deux vues du meme
  // brouillon, et une heure saisie puis abandonnee ne doit pas laisser une
  // reponse a moitie posee. Le store normalise (HH:MM), donc `null` reste
  // une absence et une forme fausse ne devient jamais une heure approchee.
  const choisirHeure = (next: string | null) => {
    setStartTime(next);
    actions.setCalendarStartTime(next);
  };

  const days = Number(duration);
  const suggested = draft.calendar.durationIsSuggested;

  const apply = () => {
    const totalDays = Number.isFinite(days) && days >= 1 ? Math.round(days) : null;
    // Ouvrir ce tiroir et valider, c'est un choix de la personne : les deux
    // drapeaux retombent a `false`. Le badge « propose par l'IA » disparait
    // donc des que la main reprend la main, sans qu'aucune autre piece ait a
    // savoir qu'une proposition avait existe.
    actions.setCalendar({
      startDate: startDate || null,
      startDateIsSuggested: false,
      durationDays: totalDays,
      durationIsSuggested: false,
      returnDate: keepReturnDate(draft.calendar.returnDate, startDate || null, totalDays),
      // C9 - l heure validee est celle du champ. `normalizeClockTime` la
      // ramene a `null` si elle n en est pas une : une saisie hors forme ne
      // devient donc jamais une heure approchee.
      startTime,
    });
    onClose();
  };

  return (
    <div>
      <Section title="Date de départ">
        <PrepCalendar value={startDate} onChange={setStartDate} />
      </Section>

      {/* C9 - une seule section de date : la date de retour n a pas son propre
          reglage, elle se DEDUIT de la date de depart et de la duree. Ce champ
          ne fait qu y ajouter l heure, sans jamais remplacer l une ou l autre. */}
      <Section title="Heure de départ">
        <StartTimeField value={startTime} onChange={choisirHeure} />
      </Section>

      <Section title="Durée">
        <p className="note neutral" style={{ margin: 0 }}>
          L’arrivée se déduit du départ et de la durée. Quand aucune fin n’est fixée,
          l’IA choisit le moment le plus opportun.
        </p>
        <div className="stepper" style={{ marginTop: '12px' }}>
          <button onClick={() => setDuration(String(Math.max(1, days - 1)))} disabled={days <= 1}>
            <Icon name="minus" size={16} />
          </button>
          <div className="n">{daysLabel(Number.isFinite(days) && days >= 1 ? Math.round(days) : null)}</div>
          <button onClick={() => setDuration(String(days + 1))}>
            <Icon name="plus" size={16} />
          </button>
        </div>
        {suggested ? <div className="badge badge--suggestion" style={{ marginTop: '8px' }}>Durée proposée · modifiable</div> : null}
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avec qui — le mode se deduit, les invites viennent de la base       */
/* ------------------------------------------------------------------ */

export function GroupSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [adults, setAdults] = useState(draft.group.adults);
  const [children, setChildren] = useState(draft.group.children);
  const [hasPets, setHasPets] = useState(draft.group.hasPets);
  const [members, setMembers] = useState<readonly string[]>(draft.group.knownMembers);
  const [query, setQuery] = useState('');

  const term = query.trim();
  const friends = usePeople(peopleRequestUrl('friends', null));
  // En dessous de deux caracteres, on n'interroge pas : une recherche de
  // deux lettres ne ramene que du bruit et coute une requete.
  const found = usePeople(term.length >= 2 ? peopleRequestUrl('all', term) : null);

  const toggle = (name: string) =>
    setMembers((prev) => (prev.includes(name) ? removeMember(prev, name) : addMember(prev, name)));

  const apply = () => {
    actions.setGroup({
      mode: groupModeFrom(adults, children, members),
      adults,
      children,
      hasPets,
      knownMembers: members,
    });
    onClose();
  };

  return (
    <div>
      <Section title="Composition">
        <div className="row between">
          <span>Adultes</span>
          <div className="stepper">
            <button onClick={() => setAdults((n) => Math.max(1, n - 1))} disabled={adults <= 1}>
              <Icon name="minus" size={16} />
            </button>
            <div className="n">{adults}</div>
            <button onClick={() => setAdults((n) => n + 1)}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
        <div className="row between">
          <span>Enfants</span>
          <div className="stepper">
            <button onClick={() => setChildren((n) => Math.max(0, n - 1))} disabled={children <= 0}>
              <Icon name="minus" size={16} />
            </button>
            <div className="n">{children}</div>
            <button onClick={() => setChildren((n) => n + 1)}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      </Section>

      <Section title="Animaux">
        <Switch checked={hasPets} onCheckedChange={setHasPets} label="Un animal accompagne le groupe" />
      </Section>

      <Section title="Nos amis">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une personne…"
          aria-label="Rechercher une personne"
          onClear={() => setQuery('')}
        />
        {term.length >= 2 ? (
          <PeopleList
            state={found}
            invited={members}
            onToggle={toggle}
            emptyLabel="Aucun profil ne correspond à cette recherche."
          />
        ) : null}
        <PeopleList
          state={friends}
          invited={members}
          onToggle={toggle}
          emptyLabel="Vous ne suivez personne pour l’instant."
        />
      </Section>

      {members.length > 0 ? (
        <Section title="Déjà invités">
          <div className="list">
            {members.map((name) => (
              <button key={name} type="button" className="li sel" onClick={() => toggle(name)}>
                <div className="rt">
                  <div className="t1">{name}</div>
                  <div className="t2">Invité · toucher pour retirer</div>
                </div>
                <Icon name="x" size={16} />
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <SheetActions onClose={onClose} onApply={apply} label="Confirmer" />
    </div>
  );
}

export function PreferencesSheet({ draft, actions, onClose }: PrepSheetProps) {
  const { preferences } = draft;

  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const apply = () => {
    onClose();
  };

  // Le palier affiche est celui que le brouillon porte reellement. Si l'identifiant
  // ne correspond a aucun palier connu, on le dit (`A_VERIFIER`) plutot que de
  // retomber sur le premier de la liste : retomber afficherait un budget que
  // personne n'a choisi.
  const activeTier = BUDGET_TIERS.find((tier) => tier.id === preferences.budgetLevel) ?? null;
  const isProposedDefault = preferences.budgetLevel === DEFAULT_BUDGET_TIER;

  return (
    <div>
      {/* C13 — trois paliers, trois pastilles de verre. Le tiroir ne demande pas
          « quel budget ? » mais « lequel de ces trois ? » : le budget est
          optionnel, et l'ecran doit toujours proposer quelque chose de
          selectionne. La pastille qui porte `data-default` est celle que la base
          pose sur un brouillon neuf — l'ecran nomme donc sa proposition au lieu
          de la laisser deviner. */}
      <Section title="Budget">
        <div className="prep-budget" role="group" aria-label="Palier de budget">
          {BUDGET_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              className="prep-budget__pill"
              aria-pressed={preferences.budgetLevel === tier.id}
              data-budget-tier={tier.id}
              data-default={tier.id === DEFAULT_BUDGET_TIER ? 'true' : undefined}
              onClick={() => actions.setPreferences({ ...preferences, budgetLevel: tier.id })}
            >
              {tier.label}
            </button>
          ))}
        </div>
        <p className="prep-budget__detail">
          {activeTier ? activeTier.detail : `Budget ${A_VERIFIER}`}
          {isProposedDefault ? ' C’est le palier proposé par défaut.' : ''}
          {preferences.budgetPerPerson == null
            ? ''
            : ` Budget réel saisi : ${preferences.budgetPerPerson} EUR par personne.`}
        </p>
      </Section>

      <Section title="Rythme">
        <ChipRow
          options={PACES}
          value={preferences.pace}
          onChange={(next) => actions.setPreferences({ ...preferences, pace: next })}
        />
      </Section>

      <Section title="Transport">
        <MultiChipRow
          options={TRANSPORTS}
          values={[preferences.transport]}
          onChange={(next) => actions.setPreferences({ ...preferences, transport: next })}
        />
      </Section>

      <Section title="Intérêts">
        <MultiChipRow
          options={INTERESTS}
          values={preferences.interests}
          onChange={(next) =>
            actions.setPreferences({ ...preferences, interests: toggle(preferences.interests, next) })
          }
        />
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

export function CoverageSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [name, setName] = useState(draft.coverName ?? '');
  const model = draft.itinerary;

  return (
    <div>
      <Section title="Nom de l’aventure">
        <input
          className="prep-text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => actions.setCoverName(name.trim() || null)}
          aria-label="Nom de l’aventure"
          placeholder="Ex. Boucle des lacs"
        />
      </Section>

      <Section title="Image">
        <p className="note neutral">
          Aucune image n’est appliquée automatiquement. La photo du paysage vient de la
          carte quand elle est disponible.
        </p>
      </Section>

      <Section title="Repères">
        <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>
          {model ? `${model.days} jour${model.days > 1 ? 's' : ''} · ${model.steps.length} étapes` : 'Programme pas encore généré'}
        </p>
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

export function ParticipantsSheet({
  draft,
  actions,
  onClose,
  onOpenInvite,
}: PrepSheetProps & { onOpenInvite?: () => void }) {
  const headcount = headcountOf(draft);
  // Seuls les participants REELS peuvent porter un objet : la liste des
  // porteurs est `knownMembers`, pas un effectif deviné ni un nom plausible.
  const members = draft.group.knownMembers;
  const shared = sharedGear(draft);

  return (
    <div className="prep-people">
      <DrawerSection title="Confirmés">
        {members.length === 0 ? (
          <DrawerEmpty>
            Personne n&apos;est encore confirmé. Ajoute les participants dans « Avec qui ».
          </DrawerEmpty>
        ) : (
          <DrawerList>
            {members.map((member) => (
              <DrawerRow
                key={member}
                data-prep-row="confirme"
                title={member}
                detail="Participant connu · peut proposer des étapes"
                trailing={<span className="prep-people__badge">Confirmé</span>}
              />
            ))}
          </DrawerList>
        )}
        <p className="prep-drawer__note">
          {headcount} personne{headcount > 1 ? 's' : ''} au total ·{' '}
          {members.length} confirmée{members.length > 1 ? 's' : ''} par leur nom ; le reste est un
          effectif déclare.
        </p>
      </DrawerSection>

      <DrawerSection title="Invités">
        {/* Le lien d invitation est signe et emis une fois ; le brouillon ne
            conserve pas la liste de ceux qui l ont recu. Ecrire « 0 invite »
            ou des noms afficherait un suivi que l app n assure pas. */}
        <DrawerEmpty>
          Aucun invité suivi ici : l&apos;invitation part par un lien signé, et le préparateur
          ne conserve pas la liste de ses destinataires.
        </DrawerEmpty>
        {onOpenInvite ? (
          <div className="prep-people__cta">
            <span>Preparer une invitation</span>
            <button type="button" className="btn ghost" onClick={onOpenInvite}>
              Inviter
            </button>
          </div>
        ) : null}
      </DrawerSection>

      <DrawerSection title="Matériel partagé">
        {headcount <= 1 ? (
          <DrawerEmpty>
            Tu pars seul : il n y a personne avec qui partager un objet. Chaque piece du
            materiel est a porter par toi.
          </DrawerEmpty>
        ) : shared.length === 0 ? (
          <DrawerEmpty>
            Aucun materiel a repartir : cette aventure n a aucun besoin d equipement derive.
          </DrawerEmpty>
        ) : (
          <DrawerList>
            {shared.map((item) => (
              <DrawerRow
                key={item.id}
                data-prep-row="partage"
                title={item.name + ' x' + item.quantity}
                detail={
                  item.ownerId
                    ? 'Porteur désigné dans « Équipement »'
                    : 'Personne à désigner — décision de groupe'
                }
                trailing={
                  item.state === 'attribue' ? (
                    <span className="prep-people__badge">Porte par {item.ownerId}</span>
                  ) : (
                    <span className="prep-people__badge prep-people__badge--open">À attribuer</span>
                  )
                }
              >
                {/* Le porteur se choisit ICI, dans la colonne qui en parle.
                    Les options sont les participants reels : sans nom saisi,
                    la liste propose le seul porteur possible — soit personne. */}
                <label className="prep-people__owner">
                  <span>Porteur</span>
                  <select
                    aria-label={'Porteur de ' + item.name}
                    value={item.ownerId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      actions.assignGear(item.id, value === '' ? null : value);
                    }}
                  >
                    <option value="">Personne désignée</option>
                    {members.map((member) => (
                      <option key={member} value={member}>
                        {member}
                      </option>
                    ))}
                  </select>
                </label>
              </DrawerRow>
            ))}
          </DrawerList>
        )}
      </DrawerSection>

      <DrawerActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}
