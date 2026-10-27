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
