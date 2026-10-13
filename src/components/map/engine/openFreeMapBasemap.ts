import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  OPENFREEMAP_STYLE_URL,
  classifyMapError,
  createBasemapFallback,
  parseOpenFreeMapStyle,
  type BasemapFailure,
  type OpenFreeMapStyle,
} from './openFreeMap';

/**
 * PLAN 1.6 — pose le fond OpenFreeMap sur la carte MapLibre du site, et le retire au premier échec.
 *
 * Le style du site (`createMapStyle`) porte déjà les couches `atlas-*` (sentiers, pays, points)
 * ajoutées à `style.load` : un `setStyle` les effacerait. Le style d'OpenFreeMap est donc lu (zod,
 * hôte vérifié) et SES sources et couches, préfixées `ofm-`, sont ajoutées SOUS les fonds raster
 * d'ArcGIS. Elles ne sont demandées qu'au premier affichage du mode « Plan » : tant que personne
 * ne le choisit, rien n'est envoyé à OpenFreeMap.
 *
 * Repli : style illisible ou injoignable (délai de 8 s), source en erreur, ou trois tuiles perdues
 * (un 404 ne compte pas) -> les couches et sources `ofm-` sont retirées, le fond ArcGIS
 * « standard » (déjà déclaré dans le style) reprend, `onFallback` est appelé UNE fois. Aucun
 * second basculement, aucune nouvelle tentative, un seul avertissement dans la console.
 */

export type BasemapMap = Pick<
  MapLibreMap,
  | 'addSource'
  | 'addLayer'
  | 'removeLayer'
  | 'removeSource'
  | 'getLayer'
  | 'setLayoutProperty'
  | 'setGlyphs'
  | 'setSprite'
>;

export type BasemapStatus = 'idle' | 'loading' | 'visible' | 'hidden' | 'fallback' | 'disposed';

export interface OpenFreeMapBasemapOptions {
  /** Couche du site devant laquelle poser le fond (les couches `atlas-*` restent au-dessus). */
  beforeLayerId: string;
  /** Appelé une seule fois, au repli sur ArcGIS. */
  onFallback?: (failure: BasemapFailure) => void;
  styleUrl?: string;
  /** Délai de lecture du style (8 s par défaut). */
  timeoutMs?: number;
  /** Lecture du style, injectable pour les tests. */
  fetchStyle?: (url: string, signal: AbortSignal) => Promise<unknown>;
  tileErrorLimit?: number;
  warn?: (message: string) => void;
}

export interface OpenFreeMapBasemap {
  readonly status: BasemapStatus;
  /** Affiche le fond (le charge au premier appel). Sans effet après un repli. */
  show(): void;
  /** Masque le fond sans le décharger. */
  hide(): void;
  /**
   * À brancher sur l'évènement `error` de la carte. Vrai si l'erreur concerne OpenFreeMap : elle
   * est prise en charge (comptée, ou ignorée après le repli) et ne doit pas être journalisée.
   */
  handleError(event: unknown): boolean;
  /** Arrête les lectures en cours ; à appeler avant `map.remove()`. */
  dispose(): void;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

export function createOpenFreeMapBasemap(
  map: BasemapMap,
  options: OpenFreeMapBasemapOptions
): OpenFreeMapBasemap {
  const {
    beforeLayerId,
    onFallback,
    styleUrl = OPENFREEMAP_STYLE_URL,
    timeoutMs = 8_000,
    fetchStyle = fetchJson,
    tileErrorLimit,
    warn = (message: string) => console.warn(message),
  } = options;

  const policy = createBasemapFallback({ tileErrorLimit });
  let status: BasemapStatus = 'idle';
  let wanted = false;
  let abort: AbortController | null = null;
  let layerIds: string[] = [];
  let sourceIds: string[] = [];
  let assetsSet = { glyphs: false, sprite: false };

  const setVisibility = (visible: boolean) => {
    for (const id of layerIds) {
      try {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      } catch {
        /* couche déjà retirée avec la carte */
      }
    }
  };

  const teardown = () => {
    for (const id of layerIds) {
      try {
        map.removeLayer(id);
      } catch {
        /* déjà retirée */
      }
    }
    for (const id of sourceIds) {
      try {
        map.removeSource(id);
      } catch {
        /* déjà retirée */
      }
    }
    if (assetsSet.glyphs) {
      try {
        map.setGlyphs(null);
      } catch {
        /* sans effet */
      }
    }
    if (assetsSet.sprite) {
      try {
        map.setSprite(null);
      } catch {
        /* sans effet */
      }
    }
    layerIds = [];
    sourceIds = [];
    assetsSet = { glyphs: false, sprite: false };
  };

  const fallBack = (failure: BasemapFailure) => {
    if (status === 'disposed' || !policy.report(failure)) return;
    abort?.abort();
    teardown();
    status = 'fallback';
    warn(
      `[fond de carte] OpenFreeMap indisponible (${failure.kind} : ${failure.message}) ; repli sur le fond ArcGIS.`
    );
    onFallback?.(failure);
  };

  const apply = (style: OpenFreeMapStyle) => {
    if (!map.getLayer(beforeLayerId))
      throw new Error(`couche « ${beforeLayerId} » absente de la carte`);
    if (style.glyphs) {
      map.setGlyphs(style.glyphs);
      assetsSet.glyphs = true;
    }
    if (style.sprite) {
      map.setSprite(style.sprite);
      assetsSet.sprite = true;
    }
    for (const [id, source] of Object.entries(style.sources)) {
      map.addSource(id, source);
      sourceIds.push(id);
    }
    for (const layer of style.layers) {
      map.addLayer(
        {
          ...layer,
          layout: { ...(layer.layout ?? {}), visibility: wanted ? 'visible' : 'none' },
        } as typeof layer,
        beforeLayerId
      );
      layerIds.push(layer.id);
    }
  };

  const load = async () => {
    status = 'loading';
    const controller = new AbortController();
    abort = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let style: OpenFreeMapStyle;
    try {
      style = parseOpenFreeMapStyle(await fetchStyle(styleUrl, controller.signal));
    } catch (error) {
      clearTimeout(timer);
      if (status !== 'loading') return;
      const timedOut = controller.signal.aborted;
      fallBack({
        kind: 'style',
        message: timedOut ? `délai de ${timeoutMs} ms dépassé` : messageOf(error),
      });
      return;
    }
    clearTimeout(timer);
    if (status !== 'loading') return;
    try {
      apply(style);
    } catch (error) {
      fallBack({ kind: 'style', message: messageOf(error) });
      return;
    }
    status = wanted ? 'visible' : 'hidden';
  };

  return {
    get status() {
      return status;
    },
    show() {
      if (status === 'fallback' || status === 'disposed') return;
      wanted = true;
      if (status === 'idle') void load();
      else if (status === 'hidden') {
        setVisibility(true);
        status = 'visible';
      }
    },
    hide() {
      wanted = false;
      if (status === 'visible') {
        setVisibility(false);
        status = 'hidden';
      }
    },
    handleError(event) {
      const failure = classifyMapError(event);
      if (!failure) return false;
      if (status === 'fallback' || status === 'disposed') return true;
      fallBack(failure);
      return true;
    },
    dispose() {
      abort?.abort();
      status = 'disposed';
    },
  };
}
