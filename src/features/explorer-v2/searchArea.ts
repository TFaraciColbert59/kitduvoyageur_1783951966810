/**
 * Emprise visible de la carte Explorer, partagée par la carte, le tiroir de
 * recherche et l'API. Aucune dépendance React : le serveur peut valider la
 * même règle que le client sans importer un module client.
 *
 * Les bornes sont exprimées en degrés WGS84, dans l'ordre [ouest, sud, est,
 * nord]. Une emprise qui traverse l'antiméridien produit `minLng > maxLng` et
 * est refusée : mieux vaut ne pas proposer l'action que chercher au mauvais
 * endroit.
 */

export interface SearchViewport {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

/** En dessous, l'emprise couvre une région entière : la recherche n'aurait pas de sens. */
export const SEARCH_AREA_MIN_ZOOM = 12;

/**
 * Les RPC tolèrent jusqu'à 6° ; la règle Explorer borne une recherche
 * d'emprise à 2° de côté pour rester une consultation de zone. Une fenêtre
 * plus large est refusée explicitement, jamais confondue avec un résultat vide.
 */
export const SEARCH_AREA_MAX_SPAN_DEG = 2;

export function isSearchableViewport(
  value: SearchViewport | null | undefined,
): value is SearchViewport {
  if (!value) return false;
  const { minLat, maxLat, minLng, maxLng, zoom } = value;
  if (![minLat, maxLat, minLng, maxLng, zoom].every(Number.isFinite)) return false;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return false;
  if (minLat >= maxLat || minLng >= maxLng) return false;
  if (zoom < SEARCH_AREA_MIN_ZOOM) return false;
  return (
    maxLat - minLat <= SEARCH_AREA_MAX_SPAN_DEG &&
    maxLng - minLng <= SEARCH_AREA_MAX_SPAN_DEG
  );
}

/** Centre [lng, lat] de l'emprise : sert de référence aux distances affichées. */
export function viewportCenter(viewport: SearchViewport): [number, number] {
  return [(viewport.minLng + viewport.maxLng) / 2, (viewport.minLat + viewport.maxLat) / 2];
}

/** Paramètres de requête stables pour `useNaturalSearch` et l'API. */
export function viewportQueryParams(viewport: SearchViewport): string {
  return [
    `minLat=${viewport.minLat}`,
    `maxLat=${viewport.maxLat}`,
    `minLng=${viewport.minLng}`,
    `maxLng=${viewport.maxLng}`,
    `zoom=${viewport.zoom}`,
  ].join('&');
}

/**
 * Vrai quand la carte a bougé depuis la dernière recherche. Un déplacement de
 * moins de 15 % de la largeur (ou 25 % de zoom) est considéré comme du bruit :
 * le bouton ne doit pas apparaître au moindre tremblement de doigt.
 */
export function viewportMoved(
  current: SearchViewport | null | undefined,
  reference: SearchViewport | null | undefined,
): boolean {
  if (!current || !isSearchableViewport(current)) return false;
  if (!reference || !isSearchableViewport(reference)) return true;
  if (Math.abs(current.zoom - reference.zoom) >= 0.75) return true;

  const refWidth = Math.max(1e-6, reference.maxLng - reference.minLng);
  const refHeight = Math.max(1e-6, reference.maxLat - reference.minLat);
  const currentWidth = Math.max(1e-6, current.maxLng - current.minLng);
  const currentHeight = Math.max(1e-6, current.maxLat - current.minLat);
  if (Math.abs(currentWidth - refWidth) > refWidth * 0.25) return true;
  if (Math.abs(currentHeight - refHeight) > refHeight * 0.25) return true;

  const currentCenterLng = (current.minLng + current.maxLng) / 2;
  const currentCenterLat = (current.minLat + current.maxLat) / 2;
  const refCenterLng = (reference.minLng + reference.maxLng) / 2;
  const refCenterLat = (reference.minLat + reference.maxLat) / 2;
  return (
    Math.abs(currentCenterLng - refCenterLng) > refWidth * 0.15 ||
    Math.abs(currentCenterLat - refCenterLat) > refHeight * 0.15
  );
}
