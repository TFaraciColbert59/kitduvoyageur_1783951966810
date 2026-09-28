'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import {
  isDayFocusReady,
  useDayFocusStore,
  type DayFocusDay,
} from '@/components/mobile-nav/dayFocusStore';
import {
  ARMED_TTL_MS,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  armedStillValid,
  isLongPress,
} from '../engine/mapLongPress';
import { zIndex } from '@/lib/ui/zIndex';
import { cn } from '@/lib/utils';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';

/**
 * La carte MapLibre du hub est un chunk lourd : elle n'est jamais incluse dans
 * le premier rendu. `ssr: false` la sort du graphe RSC, et le `loading` garde
 * la zone peinte immédiatement — la carte ne « saute » pas d'une étape à
 * l'autre (A7 : la carte reste en place, sans rechargement brutal).
 */
const HubGlobeMap = dynamic(
  () => import('@/features/hub/components/mobile/HubGlobeMap').then((module) => module.default),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
);

function MapSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: 'var(--prep-map-skeleton-bg)' }}
    />
  );
}

export interface PrepMapPoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  color: string;
  category?: string | null;
  stepId?: string | null;
}

export interface PrepMapProps {
  /** Nom du tracé — libellé accessible et titre de calque. */
  name: string;
  /** Tracé. Un seul point suffit : HubGlobeMap cadre automatiquement. */
  routeCoords: Array<[number, number]>;
  points?: readonly PrepMapPoint[];
  highlightCoords?: Array<[number, number]>;
  /** Étiquette du périmètre affiché : « Jour 1 » ou « Ensemble ». */
  scopeLabel: string;
  /** Familles de points proposées ; pilote les filtres du plein écran. */
  filterCategories?: readonly string[];
  hideExpand?: boolean;
  /**
   * Appui long sur la carte : poser un point de passage a cet endroit.
   *
   * Absente = la carte n accepte aucun geste de pose. Un tap simple ne pose
   * RIEN : seule la lecture du programme passe par la carte, un tap qui ajoute
   * un point rendrait le parcours ineditable par accident.
   */
  onLongPress?: (lat: number, lon: number) => void;
  className?: string;
}

/**
 * Palette des points : un symbole par famille, jamais la couleur seule.
 *
 * Les valeurs sont des tokens `--prep-kind-*` et non des teintes en dur : la
 * carte du hub et celle du préparateur peignent le même programme, et une
 * dérive de teinte entre les deux se verrait immédiatement. Les valeurs
 * brutes vivent dans `adventure-prep.css`, seule source des teintes.
 */
export const PREP_POINT_COLORS: Readonly<Record<string, string>> = {
  trajet: 'var(--prep-kind-trajet)',
  arret: 'var(--prep-kind-arret)',
  repos: 'var(--prep-kind-repos)',
  nuit: 'var(--prep-kind-nuit)',
  ravitaillement: 'var(--prep-kind-ravitaillement)',
};

export interface PrepMapFilter {
  id: string;
  label: string;
}

const FILTERS: readonly PrepMapFilter[] = [
  { id: 'trajet', label: 'Trajets' },
  { id: 'arret', label: 'Arrêts' },
  { id: 'repos', label: 'Pauses' },
  { id: 'nuit', label: 'Nuits' },
  { id: 'ravitaillement', label: 'Ravitaillement' },
];

const DEFAULT_FILTERS = FILTERS.map((filter) => filter.id);

/**
 * Sélecteur du bouton « Réduire » : c'est lui qui reçoit le focus à
 * l'ouverture (voir `applyOverlayFocus`), donc il doit être adressable sans
 * dépendre de l'ordre du DOM.
 */
export const MAP_CLOSE_SELECTOR = '[data-prep-map-close]';

/* --- Décisions pures -------------------------------------------------------- */

/**
 * Catégories réellement proposées par la barre de filtres.
 *
 * Une catégorie déclarée mais sans un seul point est un bouton qui ne filtre
 * rien : l'appuyer ne change pas la carte, ce qui se lit comme une carte
 * cassée. On exige donc les DEUX conditions — la catégorie est déclarée par
 * l'étape appelante (`filterCategories`, garde-fou de périmètre) ET porte au
 * moins un point. La liste reçue n'est jamais modifiée.
 */
export function resolveVisibleFilters(
  declared: readonly string[],
  points: readonly PrepMapPoint[]
): readonly PrepMapFilter[] {
  // Un point sans catégorie est un arrêt : c'est le défaut du filtre de
  // visibilité, il doit rester le même des deux côtés.
  const populated = new Set(points.map((point) => point.category ?? 'arret'));
  return FILTERS.filter((filter) => declared.includes(filter.id) && populated.has(filter.id));
}

export interface PrepMapDayTab {
  /** Texte de l'onglet : « Ensemble » ou « Jour 3 », jamais un chiffre nu. */
  label: string;
  /** Nom accessible ; il doit CONTENIR le texte visible (WCAG 2.5.3). */
  ariaLabel: string;
  /** Valeur transmise au store — `null` = vue globale du voyage. */
  day: number | null;
}

/**
 * Onglets du rail jour, dérivés de l'état du store jour.
 *
 * Fonction pure par construction : le composant ne possède aucun jour, il ne
 * fait que traduire l'état publié. Un jour invalide ne réapparaît donc jamais
 * — si `selectedDay` ne correspond à aucun onglet, c'est « Ensemble » qui
 * reste marqué.
 */
export function resolveDayTabs(
  days: readonly DayFocusDay[],
  selectedDay: number | null
): readonly PrepMapDayTab[] {
  return [
    {
      label: 'Ensemble',
      ariaLabel: 'Ensemble, tout le voyage',
      day: null,
    },
    ...days.map((entry) => ({
      label: `Jour ${entry.day}`,
      ariaLabel: entry.dateLabel ? `Jour ${entry.day}, ${entry.dateLabel}` : `Jour ${entry.day}`,
      day: entry.day,
    })),
  ];
}

/* --- Piège de focus --------------------------------------------------------- */

/**
 * Contrat minimal d'un élément focusable. Les membres sont OPTIONNELS pour que
 * `document.activeElement` (un `Element`) soit directement acceptable : le
 * focus n'existe que sur les éléments interactifs, et c'est le piège qui
 * décide — pas le type.
 */
export interface OverlayFocusable {
  focus?(): void;
  getAttribute?(name: string): string | null;
}

/** Contrat minimal du conteneur : un `HTMLElement` le satisfait tel quel. */
type FocusTrapContainer = Pick<Element, 'querySelectorAll' | 'querySelector'> | null;

/** Événement clavier réduit à ce que le piège consomme. */
export interface OverlayKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

/**
 * Ce qui peut prendre le focus dans l'overlay, dans l'ordre du tabulateur.
 *
 * `aria-hidden` est filtré ici et pas seulement dans le sélecteur : un
 * conteneur caché doit rester hors du cycle même s'il contient un bouton.
 */
export function collectFocusable(container: FocusTrapContainer): readonly OverlayFocusable[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (node) =>
      node.getAttribute('aria-hidden') !== 'true' &&
      typeof (node as OverlayFocusable).focus === 'function'
  );
}

function focusableOf(node: Element | null): OverlayFocusable | null {
  if (!node) return null;
  return typeof (node as OverlayFocusable).focus === 'function' ? (node as OverlayFocusable) : null;
}

/**
 * Index suivant dans l'anneau du piège.
 *
 * Une liste de `count` contrôles est un anneau : le premier et le dernier sont
 * voisins. `currentIndex < 0` = rien de focalisé dans l'overlay (le focus est
 * encore sur la page derrière), donc on entre par le début — ou par la fin si
 * l'utilisateur remonte.
 */
export function resolveTrappedIndex(
  count: number,
  currentIndex: number,
  backwards: boolean
): number {
  if (count <= 0) return -1;
  if (currentIndex < 0) return backwards ? count - 1 : 0;
  return (currentIndex + (backwards ? -1 : 1) + count) % count;
}

/**
 * Clavier du plein écran : Échap ferme, Tab et Shift+Tab bouclent.
 *
 * Un `role="dialog" aria-modal` sans piège n'est pas accessible : la tabulation
 * file vers la page masquée et l'utilisateur se perd derrière l'overlay. Le
 * déplacement est piloté ici plutôt que par le navigateur, donc `Tab` est
 * toujours neutralisé — y compris quand l'overlay n'a aucun contrôle, sinon
 * Tab sortirait par le défaut natif.
 */
export function handleOverlayKeyEvent(
  event: OverlayKeyEvent,
  options: {
    container: FocusTrapContainer;
    activeElement: () => OverlayFocusable | null;
    onEscape: () => void;
  }
): void {
  if (event.key === 'Escape') {
    options.onEscape();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = collectFocusable(options.container);
  event.preventDefault();
  if (items.length === 0) return;
  const current = items.indexOf(options.activeElement() as OverlayFocusable);
  items[resolveTrappedIndex(items.length, current, event.shiftKey)]?.focus?.();
}

/**
 * Focus d'ouverture + restitution : renvoie le resteur de fermeture.
 *
 * On mémorise l'élément focalisé AVANT l'ouverture (le bouton « Agrandir »)
 * pour le rendre à la fermeture — sans quoi l'utilisateur qui referme la carte
 * se retrouve au début du document, sur le même écran qu'avant mais hors du
 * contexte. On cible « Réduire » et non le premier contrôle du DOM : « Ma
 * position » déclenche une action, poser le focus dessus transformerait un
 * simple « j'ai ouvert la carte » en consentement à se localiser.
 */
export function applyOverlayFocus(options: {
  container: FocusTrapContainer;
  activeElement: () => OverlayFocusable | null;
  preferredSelector: string;
}): () => void {
  const previous = options.activeElement();
  const preferred = focusableOf(
    options.container?.querySelector(options.preferredSelector) ?? null
  );
  const controls = collectFocusable(options.container);
  (preferred ?? controls[0] ?? null)?.focus?.();
  return () => {
    previous?.focus?.();
  };
}

/* --- Chrome du plein écran (briques sans état) ------------------------------ */

function MapScope({ label }: { readonly label: string }) {
  return (
    <div className="prep-map__scope">
      <span className="prep-map__glass">{label}</span>
    </div>
  );
}

function MapActions({ children }: { readonly children: React.ReactNode }) {
  return <div className="prep-map__controls prep-map__controls--end">{children}</div>;
}

/**
 * Commandes du plein écran.
 *
 * Le bouton de fermeture porte `data-prep-map-close` : c'est la cible que
 * `applyOverlayFocus` vise à l'ouverture, donc le focus d'entrée ne dépend pas
 * de l'ordre du DOM — un tri ou un redesign ne peut pas le détourner.
 */
function MapOverlayActions({
  onLocate,
  locating,
  onRequestClose,
}: {
  readonly onLocate: () => void;
  readonly locating: boolean;
  readonly onRequestClose: () => void;
}) {
  return (
    <MapActions>
      <button type="button" className="prep-map__glass" onClick={onLocate} disabled={locating}>
        <Icon name="map-pin" size={16} />
        Ma position
      </button>
      <button
        type="button"
        className="prep-map__glass"
        data-prep-map-close=""
        onClick={onRequestClose}
        aria-label="Réduire la carte"
      >
        <Icon name="minus" size={16} />
        Réduire
      </button>
    </MapActions>
  );
}
/**
 * Rail jour du plein écran.
 *
 * `aria-pressed` plutôt qu'un `role="tab"` : le rail ne pilote aucun panneau,
 * il change le périmètre affiché. `aria-label` CONTIENT le texte visible, sinon
 * un lecteur d'écran annonce « Jour 2 » sans le contexte « périmètre ».
 */
function MapDayRail({
  tabs,
  activeDay,
  onSelectDay,
}: {
  readonly tabs: readonly PrepMapDayTab[];
  readonly activeDay: number | null;
  readonly onSelectDay: (day: number | null) => void;
}) {
  return (
    <div className="prep-map__dayrail" role="group" aria-label="Périmètre du parcours">
      {tabs.map((tab) => (
        <button
          key={tab.day ?? 'ensemble'}
          type="button"
          className="prep-map__glass"
          aria-pressed={tab.day === activeDay}
          aria-label={tab.ariaLabel}
          onClick={() => onSelectDay(tab.day)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function MapFilterBar({
  filters,
  activeFilters,
  onToggle,
}: {
  readonly filters: readonly PrepMapFilter[];
  readonly activeFilters: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  return (
    <div className="prep-map__fullbar">
      {filters.map((filter) => {
        const on = activeFilters.includes(filter.id);
        return (
          <button
            key={filter.id}
            type="button"
            className="prep-map__glass"
            aria-pressed={on}
            onClick={() => onToggle(filter.id)}
          >
            <Icon name={on ? 'check' : 'plus'} size={15} />
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

export interface PrepMapFullscreenProps {
  /** Étiquette du périmètre affiché, reprise telle quelle. */
  scopeLabel: string;
  /** Journées publiées par le store — jamais une liste locale. */
  days: readonly DayFocusDay[];
  selectedDay: number | null;
  /** Écriture autorisée : c'est le store qui décide, pas l'overlay. */
  onSelectDay: (day: number | null) => void;
  /** Catégories proposées : déclarées ET peuplées. */
  filters: readonly PrepMapFilter[];
  activeFilters: readonly string[];
  onToggleFilter: (id: string) => void;
  onLocate: () => void;
  locating: boolean;
  onRequestClose: () => void;
  geolocateError: string | null;
}

/**
 * Chrome du plein écran : pastille de périmètre, commandes, rail jour, barre de
 * filtres.
 *
 * Composant PUR, sans aucun hook : tout lui arrive par props. C'est ce qui
 * permet de vérifier le clic sur un onglet et le rendu exact sans navigateur,
 * et ce qui garantit qu'il ne peut pas se doter d'un état parallèle à celui du
 * store.
 */
export function PrepMapFullscreen({
  scopeLabel,
  days,
  selectedDay,
  onSelectDay,
  filters,
  activeFilters,
  onToggleFilter,
  onLocate,
  locating,
  onRequestClose,
  geolocateError,
}: PrepMapFullscreenProps) {
  // Même porte que le plateau jour de la bottom bar : un voyage d'une seule
  // journée n'a rien à focaliser, le rail serait du bruit sur les deux rails.
  const dayTabs = isDayFocusReady(days) ? resolveDayTabs(days, selectedDay) : [];
  // Un `selectedDay` sans onglet correspondant ne laisse AUCUN onglet actif :
  // le rail afficherait une rangée sans réponse. On retombe donc sur
  // « Ensemble » — dérivation pure, toujours aucun état local.
  const activeDay = dayTabs.some((tab) => tab.day === selectedDay) ? selectedDay : null;

  return (
    <>
      <MapScope label={scopeLabel} />
      <MapOverlayActions onLocate={onLocate} locating={locating} onRequestClose={onRequestClose} />
      {dayTabs.length > 0 && (
        <MapDayRail tabs={dayTabs} activeDay={activeDay} onSelectDay={onSelectDay} />
      )}
      {filters.length > 0 && (
        <MapFilterBar filters={filters} activeFilters={activeFilters} onToggle={onToggleFilter} />
      )}
      {geolocateError && <p className="prep-note prep-note--overlay">{geolocateError}</p>}
    </>
  );
}

/* --- État local : tout ce qui n'est PAS le périmètre du voyage -------------- */

interface MapFilters {
  readonly active: readonly string[];
  readonly available: readonly PrepMapFilter[];
  readonly visiblePoints: readonly PrepMapPoint[];
  readonly toggle: (id: string) => void;
}

/**
 * Filtres de la carte.
 *
 * Le filtre ACTIF démarre sur toutes les familles : c'est un réglage de confort
 * local (qu'un utilisateur referme sans doute), pas une vérité partagée. Le
 * store jour, lui, n'est jamais dupliqué ici.
 */
function useMapFilters(declared: readonly string[], points: readonly PrepMapPoint[]): MapFilters {
  const [active, setActive] = useState<readonly string[]>(DEFAULT_FILTERS);
  const toggle = useCallback((id: string) => {
    setActive((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }, []);
  const available = useMemo(() => resolveVisibleFilters(declared, points), [declared, points]);
  const visiblePoints = useMemo(
    () => points.filter((point) => active.includes(point.category ?? 'arret')),
    [points, active]
  );
  return useMemo(
    () => ({ active, available, visiblePoints, toggle }),
    [active, available, visiblePoints, toggle]
  );
}

interface Geolocation {
  readonly coords: [number, number] | null;
  readonly locating: boolean;
  readonly error: string | null;
  readonly locate: () => void;
}

function useGeolocation(): Geolocation {
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Localisation indisponible sur cet appareil');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Position non obtenue — réessaie quand tu en as besoin');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [locating]);

  return useMemo(() => ({ coords, locating, error, locate }), [coords, locating, error, locate]);
}

/**
 * Miroir du store jour, pas un second état.
 *
 * La bottom bar, le hub et cette carte vivent dans des arbres React disjoints ;
 * seul le store module les relie. Un `useState` ici afficherait un jour que
 * personne d'autre ne sait, et le focus d'onglet partirait sur deux rails.
 */
interface DayFocusSelection {
  readonly days: readonly DayFocusDay[];
  readonly selectedDay: number | null;
  readonly onSelectDay: (day: number | null) => void;
}

function useDayFocusSelection(): DayFocusSelection {
  const days = useDayFocusStore((state) => state.days);
  const selectedDay = useDayFocusStore((state) => state.selectedDay);
  const selectDay = useDayFocusStore((state) => state.selectDay);
  return { days, selectedDay, onSelectDay: selectDay };
}
/**
 * Cycle de vie du plein écran : focus, clavier, scroll.
 *
 * Regroupé pour que `PrepMap` reste lisible : ces trois effets partagent le
 * même déclencheur (`open`) et la même durée de vie que l'overlay.
 */
function useOverlayLifecycle(
  open: boolean,
  container: React.RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  // Focus : mémorisation à l'ouverture, restitution à la fermeture.
  useEffect(() => {
    if (!open) return;
    return applyOverlayFocus({
      container: container.current,
      activeElement: () => document.activeElement,
      preferredSelector: MAP_CLOSE_SELECTOR,
    });
  }, [open]);

  // Scroll bloqué pour que la carte reste fixe, et clavier branché sur le
  // document : la cible est l'overlay, l'événement vient de la page entière.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      handleOverlayKeyEvent(event, {
        container: container.current,
        activeElement: () => document.activeElement,
        onEscape: onClose,
      });
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, container]);
}


/**
 * Cadre par defaut quand aucun point n est connu : centre France.
 *
 * Meme valeur et meme raison que le selecteur de lieu de ce feature
 * (`PICKER_FALLBACK`). Sert uniquement a cadrer la carte : aucun trait n est
 * dessine, aucune extremite n est affichee, donc aucune donnee n est inventee.
 */
const DEFAULT_MAP_VIEW: [number, number] = [46.6, 2.45];

/**
 * Appui long sur la carte — capture du geste, pas de la coordonnee.
 *
 * MapLibre ne livre une coordonnee qu au moment du clic, c est a dire apres le
 * relachement du doigt. On ne peut donc pas transformer un appui long en point
 * sans armement : on memorise que le geste vient d etre qualifie, puis on
 * attribue le clic suivant — et lui seul — a un point de passage.
 *
 * Les ecouteurs sont natifs et captures en phase de capture : MapLibre
 * appelle `stopPropagation` sur ses propres gestes de carte, et un gestionnaire
 * React delegue au racine aurait-rate le maintien. `passive: true` garantit
 * qu on n'introduit pas de delai de rendu sur le deplacement de la carte.
 *
 * L arme est un `ref`, pas un etat : elle vit entre le geste et le clic qui
 * le confirme, deux evenements de la meme interaction. Un re-rendu ne doit
 * jamais la faire perdre — ni la rendre permanente si le clic n arrive pas.
 */
function useMapLongPress(onLongPress: ((lat: number, lon: number) => void) | undefined) {
  const surface = useRef<HTMLDivElement | null>(null);
  const origin = useRef<{ x: number; y: number; at: number } | null>(null);
  const movedPx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedAt = useRef<number | null>(null);
  const handler = useRef(onLongPress);
  handler.current = onLongPress;

  const disarm = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    const node = surface.current;
    if (!node) return undefined;

    const stop = (e: TouchEvent) => {
      const point = e.touches[0];
      if (!point) return;
      origin.current = { x: point.clientX, y: point.clientY, at: Date.now() };
      movedPx.current = 0;
      disarm();
      timer.current = setTimeout(() => {
        timer.current = null;
        const start = origin.current;
        if (!start) return;
        if (isLongPress(Date.now() - start.at, movedPx.current)) {
          armedAt.current = Date.now();
        }
      }, LONG_PRESS_MS);
    };

    const move = (e: TouchEvent) => {
      const start = origin.current;
      const point = e.touches[0];
      if (!start || !point) return;
      movedPx.current = Math.max(
        movedPx.current,
        Math.hypot(point.clientX - start.x, point.clientY - start.y),
      );
      // Des que le doigt quitte la zone de tolerance, c est un recadrage :
      // on retire l arme pour qu aucun clic ne pose de point par surprise.
      if (movedPx.current > LONG_PRESS_SLOP_PX) {
        disarm();
        armedAt.current = null;
      }
    };

    const release = () => {
      disarm();
      origin.current = null;
    };

    node.addEventListener('touchstart', stop, { capture: true, passive: true });
    node.addEventListener('touchmove', move, { capture: true, passive: true });
    node.addEventListener('touchend', release, { capture: true, passive: true });
    node.addEventListener('touchcancel', release, { capture: true, passive: true });
    return () => {
      node.removeEventListener('touchstart', stop, { capture: true });
      node.removeEventListener('touchmove', move, { capture: true });
      node.removeEventListener('touchend', release, { capture: true });
      node.removeEventListener('touchcancel', release, { capture: true });
      disarm();
    };
  }, [disarm]);

  /** Le clic MapLibre, attribue ou refuse. Un tap nu ne fait rien. */
  const onMapClick = useCallback((lat: number, lng: number) => {
    const armed = armedAt.current;
    armedAt.current = null;
    if (armed === null || !armedStillValid(armed, Date.now())) return;
    handler.current?.(lat, lng);
  }, []);

  return { surfaceRef: surface, onMapClick };
}

function MapCanvas({
  name,
  routeCoords,
  position,
  highlightCoords,
  points,
  recenterKey,
  onMapClick,
  surfaceRef,
}: {
  readonly name: string;
  readonly routeCoords: Array<[number, number]>;
  readonly position: [number, number] | null;
  readonly highlightCoords?: Array<[number, number]>;
  readonly points: readonly PrepMapPoint[];
  readonly recenterKey: number;
  readonly onMapClick?: (lat: number, lng: number) => void;
  readonly surfaceRef: React.RefObject<HTMLDivElement | null>;
}) {
  const coords = useMemo(() => {
    const known = position ? [...routeCoords, position] : routeCoords;
    // HubGlobeMap rend `null` des qu il n a pas deux coordonnees a afficher,
    // ce qui laissait un cadre NOIR sans carte : lePreparateur apparaitrait
    // mort avant meme le premier point. On lui fournit donc toujours deux
    // coordonnees.
    //
    // 0 point  -> centre France (M_DEFAULT_MAP_VIEW), meme convention que le
    //              selecteur de lieu du meme feature ;
    // 1 point  -> on duplique, la carte se centre dessus sans tracer de ligne ;
    // 2 et plus -> les coordonnees reelles, trace intact.
    //
    // Le centre France n invente aucune donnee de trajet : c est un cadrage,
    // pas une extremite. Aucun point, aucun trace, aucun discours.
    if (known.length === 0) return [DEFAULT_MAP_VIEW, DEFAULT_MAP_VIEW];
    if (known.length === 1) return [known[0], known[0]];
    return known;
  }, [routeCoords, position]);
  
  return (
    <div className="prep-map__canvas" ref={surfaceRef}>
      <HubGlobeMap
        key={`prep-map-${recenterKey}`}
        name={name}
        routeCoords={coords}
        highlightCoords={highlightCoords}
        points={points as unknown as HubRoutePoint[]}
        onMapClick={onMapClick}
      />
    </div>
  );
}

function MapCompactActions({
  hideExpand,
  onExpand,
  onRecenter,
}: {
  readonly hideExpand: boolean;
  readonly onExpand: () => void;
  readonly onRecenter: () => void;
}) {
  return (
    <MapActions>
      {!hideExpand && (
        <button
          type="button"
          className="prep-map__glass"
          onClick={onExpand}
          aria-label="Agrandir la carte"
        >
          <Icon name="arrow-up-right" size={16} />
          Agrandir
        </button>
      )}
      <button
        type="button"
        className="prep-map__glass"
        onClick={onRecenter}
        aria-label="Recentrer sur le parcours"
      >
        <Icon name="navigation" size={16} />
        Recentrer
      </button>
    </MapActions>
  );
}

interface PrepMapSurfaceProps {
  readonly open: boolean;
  readonly overlayRef: React.RefObject<HTMLDivElement | null>;
  readonly map: {
    readonly name: string;
    readonly routeCoords: Array<[number, number]>;
    readonly position: [number, number] | null;
    readonly highlightCoords?: Array<[number, number]>;
    readonly points: readonly PrepMapPoint[];
    readonly recenterKey: number;
    readonly onMapClick?: (lat: number, lng: number) => void;
    readonly surfaceRef: React.RefObject<HTMLDivElement | null>;
  };
  readonly scopeLabel: string;
  readonly dayFocus: DayFocusSelection;
  readonly filters: MapFilters;
  readonly geolocation: Geolocation;
  readonly onRequestClose: () => void;
  readonly onExpand: () => void;
  readonly onRecenter: () => void;
  readonly hideExpand: boolean;
  readonly className?: string;
}

/**
 * Surface de la carte : compacte par défaut, plein écran quand `open`.
 *
 * Les deux états partagent le même canvas et la même pastille de périmètre —
 * seul le chrome change. Les regrouper ici évite de faire circuler le canvas
 * d'un composant à l'autre et garantit qu'aucune commande ne peut exister dans
 * l'un des deux états sans exister dans l'autre.
 */
function PrepMapSurface({
  open,
  overlayRef,
  map,
  scopeLabel,
  dayFocus,
  filters,
  geolocation,
  onRequestClose,
  onExpand,
  onRecenter,
  hideExpand,
  className,
}: PrepMapSurfaceProps) {
  if (open) {
    return (
      <div
        ref={overlayRef}
        className="prep-map prep-map--full"
        role="dialog"
        aria-modal="true"
        aria-label="Carte en plein écran"
        style={{ zIndex: zIndex.modal }}
      >
        <MapCanvas {...map} />
        <PrepMapFullscreen
          scopeLabel={scopeLabel}
          days={dayFocus.days}
          selectedDay={dayFocus.selectedDay}
          onSelectDay={dayFocus.onSelectDay}
          filters={filters.available}
          activeFilters={filters.active}
          onToggleFilter={filters.toggle}
          onLocate={geolocation.locate}
          locating={geolocation.locating}
          onRequestClose={onRequestClose}
          geolocateError={geolocation.error}
        />
      </div>
    );
  }

  return (
    <div className={cn('prep-map', className)}>
      <MapCanvas {...map} />
      <MapScope label={scopeLabel} />
      <MapCompactActions hideExpand={hideExpand} onExpand={onExpand} onRecenter={onRecenter} />
    </div>
  );
}

/**
 * Carte du préparateur — mêmes commandes à toutes les étapes (A7).
 *
 * Ce composant ne fait QUE câbler : le chrome est dans `PrepMapSurface`, le
 * comportement dans les hooks. Les libellés sont explicites (« Agrandir »,
 * « Recentrer », « Ma position ») : l'icône ne porte jamais seule le sens.
 */
export function PrepMap({
  name,
  routeCoords,
  points = [],
  highlightCoords,
  scopeLabel,
  filterCategories = DEFAULT_FILTERS,
  hideExpand = false,
  onLongPress,
  className,
}: PrepMapProps) {
  const [full, setFull] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const geolocation = useGeolocation();
  const dayFocus = useDayFocusSelection();
  const filters = useMapFilters(filterCategories, points);
  // Le meme geste sert dans les deux etats (compact et plein ecran) : l appui
  // long y pose un point de passage, et un tap simple n y fait rien.
  const longPress = useMapLongPress(onLongPress);
  const closeFull = useCallback(() => setFull(false), []);
  useOverlayLifecycle(full, overlayRef, closeFull);
  const recenter = useCallback(() => setRecenterKey((key) => key + 1), []);

  const map = {
    name,
    routeCoords,
    position: geolocation.coords,
    highlightCoords,
    points: filters.visiblePoints,
    recenterKey,
    onMapClick: longPress.onMapClick,
    surfaceRef: longPress.surfaceRef,
  };

  return (
    <PrepMapSurface
      open={full}
      overlayRef={overlayRef}
      map={map}
      scopeLabel={scopeLabel}
      dayFocus={dayFocus}
      filters={filters}
      geolocation={geolocation}
      onRequestClose={closeFull}
      onExpand={() => setFull(true)}
      onRecenter={recenter}
      hideExpand={hideExpand}
      className={className}
    />
  );
}

export default PrepMap;
