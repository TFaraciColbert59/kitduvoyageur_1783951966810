// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyOverlaySelection,
  captureOverlayFocus,
  restoreOverlayFocus,
} from '../overlaySelection';

const SELECTABLE = [
  { className: 'lkdv-map-massif', datasetKey: 'massifId', id: 'massif-1' },
  { className: 'lkdv-map-poi', datasetKey: 'poiId', id: 'poi-1' },
  { className: 'lkdv-map-carnet', datasetKey: 'carnetId', id: 'carnet-1' },
] as const;

/** Overlay minimal avec l'ordre DOM réel : agrégat, massif, poi, carnet. */
function buildOverlay() {
  const container = document.createElement('div');
  container.className = 'lkdv-map-overlay';

  const cluster = document.createElement('button');
  cluster.type = 'button';
  cluster.className = 'lkdv-map-cluster';
  cluster.dataset.clusterCount = '3';
  container.append(cluster);

  for (const { className, datasetKey, id } of SELECTABLE) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset[datasetKey] = id;
    container.append(button);
  }

  return container;
}

/** Classes de type des boutons marqués `is-selected`, agrégat compris. */
function selectedClasses(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.is-selected')).map(
    (element) => element.classList[0]
  );
}

describe('applyOverlaySelection', () => {
  it('massif sélectionné : seul le massif est marqué', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'massif', id: 'massif-1' });
    expect(selectedClasses(container)).toEqual(['lkdv-map-massif']);
  });

  it('poi sélectionné : seul le poi est marqué', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'poi', id: 'poi-1' });
    expect(selectedClasses(container)).toEqual(['lkdv-map-poi']);
  });

  it('carnet sélectionné : le carnet est marqué (régression : il restait sous un poi)', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'carnet', id: 'carnet-1' });
    expect(selectedClasses(container)).toEqual(['lkdv-map-carnet']);
  });

  it('mauvais id : aucun bouton marqué', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'carnet', id: 'carnet-2' });
    expect(selectedClasses(container)).toEqual([]);
  });

  it('trace sélectionnée : aucun bouton d’overlay marqué', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'outing', id: 'outing-1' });
    expect(selectedClasses(container)).toEqual([]);
  });

  it('sélection nulle : rien n’est marqué', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'carnet', id: 'carnet-1' });
    applyOverlaySelection(container, null);
    expect(selectedClasses(container)).toEqual([]);
  });

  it('changer de type retire la marque précédente', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'carnet', id: 'carnet-1' });
    applyOverlaySelection(container, { kind: 'poi', id: 'poi-1' });
    expect(selectedClasses(container)).toEqual(['lkdv-map-poi']);
  });

  it('l’agrégat n’est jamais sélectionnable', () => {
    const container = buildOverlay();
    applyOverlaySelection(container, { kind: 'massif', id: 'massif-1' });
    expect(container.querySelector('.lkdv-map-cluster.is-selected')).toBeNull();
  });
});

describe('focus de l’overlay reconstruit', () => {
  it('capture le focus d’un marqueur typé et le repose sur le même id', () => {
    const container = buildOverlay();
    document.body.append(container);
    try {
      const poi = container.querySelector<HTMLElement>('[data-poi-id="poi-1"]')!;
      poi.focus();
      const focus = captureOverlayFocus(container);
      expect(focus).toEqual({ kind: 'poi', id: 'poi-1' });

      // Reconstruction réelle : nouveaux boutons, mêmes data-*.
      container.innerHTML = '';
      container.append(buildOverlay());
      expect(restoreOverlayFocus(container, focus)).toBe(true);
      expect(document.activeElement).toBe(container.querySelector('[data-poi-id="poi-1"]'));
    } finally {
      container.remove();
    }
  });

  it('ne capture rien quand le focus est hors de l’overlay', () => {
    const container = buildOverlay();
    const outside = document.createElement('button');
    document.body.append(container, outside);
    try {
      outside.focus();
      expect(captureOverlayFocus(container)).toBeNull();
    } finally {
      container.remove();
      outside.remove();
    }
  });

  it('renvoie false quand le marqueur n’existe plus (absorbé en agrégat)', () => {
    const container = buildOverlay();
    container.innerHTML = '';
    expect(restoreOverlayFocus(container, { kind: 'massif', id: 'massif-1' })).toBe(false);
    expect(restoreOverlayFocus(container, null)).toBe(false);
  });
});
