'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import {
  isDayFocusReady,
  useDayFocusStore,
  type DayFocusDay,
} from '@/components/mobile-nav/dayFocusStore';
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

/* --- Les deux états d'affichage --------------------------------------------- */

function MapSVG({ routeCoords, points, onPointClick }: { routeCoords: Array<[number, number]>, points: readonly PrepMapPoint[], onPointClick?: (id: string) => void }) {
  if (routeCoords.length === 0 && points.length === 0) return null;
  const allX = [...routeCoords.map(c => c[0]), ...points.map(p => p.lon)];
  const allY = [...routeCoords.map(c => c[1]), ...points.map(p => p.lat)];
  const minX = Math.min(...allX); const maxX = Math.max(...allX);
  const minY = Math.min(...allY); const maxY = Math.max(...allY);
  const width = Math.max(maxX - minX, 100) + 100;
  const height = Math.max(maxY - minY, 100) + 100;
  const transformX = (x: number) => x - minX + 50;
  const transformY = (y: number) => y - minY + 50;

  const getMarkerStyle = (p: PrepMapPoint) => {
    switch (p.category) {
      case 'arret': return { fill: 'var(--prep-kind-arret)', stroke: 'white', strokeWidth: 2.5, r: 14 };
      case 'nuit': return { fill: 'var(--prep-kind-nuit)', rx: 9, ry: 9, width: 32, height: 32 };
      case 'ravitaillement': return { fill: 'var(--prep-kind-ravitaillement)', rx: 9, ry: 9, width: 32, height: 32 };
      default: return { fill: 'var(--prep-map-skeleton-bg)', r: 14 };
    }
  };

  const getIconName = (p: PrepMapPoint) => {
    switch (p.category) {
      case 'ravitaillement': return 'utensils';
      case 'nuit': return 'bed';
      default: return null;
    }
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
      {routeCoords.length > 1 && (
        <polyline
          points={routeCoords.map(c => `${transformX(c[0])},${transformY(c[1])}`).join(' ')}
          fill="none" stroke="var(--lkv-action)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        />
      )}
      {points.map(p => {
        const x = transformX(p.lon); const y = transformY(p.lat);
        const isSquare = ['ravitaillement', 'nuit'].includes(p.category || '');
        const iconName = getIconName(p);
        return (
          <g key={p.id} transform={`translate(${x}, ${y})`} onClick={() => onPointClick?.(p.id)} style={{ cursor: 'pointer' }}>
            {isSquare ? <rect x={-16} y={-16} {...getMarkerStyle(p)} /> : <circle cx={0} cy={0} {...getMarkerStyle(p)} />}
            {iconName ? (
              <g transform="translate(-8, -8)"><foreignObject width="16" height="16"><Icon name={iconName} size={16} /></foreignObject></g>
            ) : (
              <text x={0} y={5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{(p as any).number || ''}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MapCanvas({
  name,
  routeCoords,
  position,
  highlightCoords,
  points,
  recenterKey,
}: {
  readonly name: string;
  readonly routeCoords: Array<[number, number]>;
  readonly position: [number, number] | null;
  readonly highlightCoords?: Array<[number, number]>;
  readonly points: readonly PrepMapPoint[];
  readonly recenterKey: number;
}) {
  const coords = useMemo(
    () => (position ? [...routeCoords, position] : routeCoords),
    [routeCoords, position]
  );
  
  const mapLibreAvailable = typeof window !== 'undefined' && (window as any).maplibregl;

  return (
    <div className="prep-map__canvas">
      {mapLibreAvailable ? (
        <HubGlobeMap
          key={`prep-map-${recenterKey}`}
          name={name}
          routeCoords={coords}
          highlightCoords={highlightCoords}
          points={points as unknown as HubRoutePoint[]}
        />
      ) : (
        <MapSVG routeCoords={coords} points={points} />
      )}
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
  className,
}: PrepMapProps) {
  const [full, setFull] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const geolocation = useGeolocation();
  const dayFocus = useDayFocusSelection();
  const filters = useMapFilters(filterCategories, points);
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
