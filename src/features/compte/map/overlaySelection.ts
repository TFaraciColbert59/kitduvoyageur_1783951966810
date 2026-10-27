/**
 * Priorité de superposition : la sélection passe au-dessus de tous les types de
 * points (`MAP_ZOOM_PRIORITY` : `selected` > `poi` > `carnet` > `massif`).
 *
 * Un type = un bouton d'overlay, une classe CSS et un `data-*` portant l'id de
 * l'entité. Le CSS pose les niveaux (massif 2, carnet 3, poi 4) et
 * `.is-selected` remonte le bouton sélectionné à 6 ; cette table est la seule
 * source de vérité côté DOM, pour qu'aucun type ne puisse être oublié.
 */
export type OverlaySelectionKind = 'massif' | 'poi' | 'carnet';

/** Sélection courante : les traces n'ont pas de bouton dans l'overlay. */
export type OverlaySelection =
  | { kind: 'outing'; id: string }
  | { kind: OverlaySelectionKind; id: string };

interface OverlaySelectionTarget {
  kind: OverlaySelectionKind;
  selector: string;
  datasetKey: 'massifId' | 'poiId' | 'carnetId';
}

/** Focus à conserver quand l'overlay est reconstruit (changement de données/mode). */
export interface OverlayFocus {
  kind: OverlaySelectionKind;
  id: string;
}

export const OVERLAY_SELECTION_TARGETS: readonly OverlaySelectionTarget[] = [
  { kind: 'massif', selector: '.lkdv-map-massif', datasetKey: 'massifId' },
  { kind: 'poi', selector: '.lkdv-map-poi', datasetKey: 'poiId' },
  { kind: 'carnet', selector: '.lkdv-map-carnet', datasetKey: 'carnetId' },
];

/**
 * Applique l'état sélectionné à tous les boutons sélectionnables de l'overlay.
 * Les agrégats (`.lkdv-map-cluster`) ne sont pas sélectionnables : ils ne
 * matchent aucun sélecteur de la table et gardent leur niveau de massif.
 */
export function applyOverlaySelection(
  container: HTMLElement,
  selected: OverlaySelection | null
): void {
  for (const { kind, selector, datasetKey } of OVERLAY_SELECTION_TARGETS) {
    container.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.classList.toggle(
        'is-selected',
        selected !== null && selected.kind === kind && selected.id === element.dataset[datasetKey]
      );
    });
  }
}

/**
 * Retient le marqueur qui a le focus clavier avant que l'overlay soit vidé.
 *
 * Sans cela, un franchissement de bande ou un changement de mode qui reconstruit
 * le DOM renvoie le focus sur `<body>` : la navigation clavier perd l'élément
 * qu'elle était en train de parcourir. Seuls les boutons typés (massif, POI,
 * carnet) sont mémorisés ; les agrégats ne portent pas d'id stable.
 */
export function captureOverlayFocus(container: HTMLElement): OverlayFocus | null {
  const active = container.ownerDocument.activeElement as HTMLElement | null;
  if (!active || !container.contains(active)) return null;

  for (const { kind, selector, datasetKey } of OVERLAY_SELECTION_TARGETS) {
    if (!active.matches(selector)) continue;
    const id = active.dataset[datasetKey];
    return id ? { kind, id } : null;
  }
  return null;
}

/**
 * Repose le focus sur le marqueur de même type/id après reconstruction.
 *
 * Renvoie `false` quand le marqueur n'existe plus (agrégat absorbé, couche
 * masquée par le mode) : l'appelant garde alors le focus courant, sans forcer
 * un élément qui ne peut pas être focalisé.
 */
export function restoreOverlayFocus(
  container: HTMLElement,
  focus: OverlayFocus | null
): boolean {
  if (!focus) return false;
  const target = OVERLAY_SELECTION_TARGETS.find((entry) => entry.kind === focus.kind);
  if (!target) return false;

  for (const element of container.querySelectorAll<HTMLElement>(target.selector)) {
    if (element.dataset[target.datasetKey] !== focus.id) continue;
    element.focus({ preventScroll: true });
    return true;
  }
  return false;
}
