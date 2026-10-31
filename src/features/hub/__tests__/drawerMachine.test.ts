import { describe, expect, it } from 'vitest';
import { hubSectionRegistry } from '../registry/hubSectionRegistry';
import {
  DrawerNavigationMachine,
  HUB_DRAWER_ALIASES,
  STUDIO_DRAWERS,
  parseHubUrlState,
  resolveHubDestination,
  serializeHubUrlState,
} from '../state/drawerMachine';

describe('DrawerNavigationMachine (L3-1 / B-01 / B-05 / B-06)', () => {
  it('vérifie que hubSectionRegistry contient exactement les 19 entrées canoniques intactes', () => {
    expect(hubSectionRegistry).toHaveLength(19);
  });

  it('paramétré sur les 19 entrées de hubSectionRegistry : résout chacune vers le bon état ou redirection Compas', () => {
    const machine = new DrawerNavigationMachine();

    for (const entry of hubSectionRegistry) {
      const resolved = machine.openDrawer(entry.segment);
      expect(resolved).not.toBeNull();

      if (entry.segment === '') {
        expect(resolved?.kind).toBe('root');
        expect(machine.getState()).toEqual({ type: 'CLOSED' });
        expect(machine.toUrl()).toBe('/hub');
      } else if (entry.id === 'preparation') {
        expect(resolved?.kind).toBe('redirect');
        expect(machine.getState()).toEqual({
          type: 'CLOSED',
          redirectHref: '/compas?etape=kit',
        });
        expect(machine.toUrl()).toBe('/compas?etape=kit');
      } else {
        expect(resolved?.kind).toBe('drawer');
        expect(machine.getState()).toEqual({
          type: 'DRAWER_OPEN',
          drawerId: entry.segment,
          sectionId: entry.id,
        });
        expect(machine.toUrl()).toBe(`/hub/${entry.segment}`);
      }
    }
  });

  it('résout fidèlement tous les alias historiques vers leurs tiroirs canoniques de hubSectionRegistry', () => {
    const machine = new DrawerNavigationMachine();

    for (const [alias, canonical] of Object.entries(HUB_DRAWER_ALIASES)) {
      machine.openDrawer(alias);
      if (canonical === '') {
        expect(machine.getState()).toEqual({ type: 'CLOSED' });
      } else {
        const expectedDef = hubSectionRegistry.find((d) => d.segment === canonical)!;
        expect(machine.getState()).toEqual({
          type: 'DRAWER_OPEN',
          drawerId: canonical,
          sectionId: expectedDef.id,
        });
      }
    }
  });

  it('rejette proprement un segment inconnu en revenant à CLOSED sans crash', () => {
    const machine = new DrawerNavigationMachine();
    machine.openDrawer('inventaire');
    const resolved = machine.openDrawer('segment-inexistant-xyz');
    expect(resolved).toBeNull();
    expect(machine.getState()).toEqual({ type: 'CLOSED' });
  });

  it('synchronise bidirectionnellement URL <-> état pour /hub/<segment>, ?drawer=<segment> et ?studio=1&drawer=<studioDrawer>', () => {
    expect(parseHubUrlState('/hub/checklist')).toEqual({
      type: 'DRAWER_OPEN',
      drawerId: 'checklist',
      sectionId: 'checklist',
    });

    expect(parseHubUrlState('/hub', '?drawer=securite')).toEqual({
      type: 'DRAWER_OPEN',
      drawerId: 'securite',
      sectionId: 'safety',
    });

    for (const studioDrawer of STUDIO_DRAWERS) {
      const parsed = parseHubUrlState('/hub', `?studio=1&kit=kit-1&drawer=${studioDrawer}`);
      expect(parsed).toEqual({
        type: 'STUDIO',
        activeDrawer: studioDrawer,
        subDrawerId: undefined,
        kitId: 'kit-1',
      });
      expect(serializeHubUrlState(parsed)).toBe(
        `/hub?studio=1&kit=kit-1&drawer=${studioDrawer}`
      );
    }
  });

  describe('Hiérarchie Popstate (B-05 : sous-drawer -> drawer -> Studio -> fermé sans quitter /hub)', () => {
    it('déroule toute la pile Studio : sous-tiroir Studio -> tiroir Studio -> Studio nu -> Camp CLOSED -> navigateur', () => {
      const machine = new DrawerNavigationMachine();
      machine.enterStudio('personnaliser', 'kit-42');
      machine.openSubDrawer('materials');

      expect(machine.getState()).toEqual({
        type: 'STUDIO',
        activeDrawer: 'personnaliser',
        subDrawerId: 'materials',
        kitId: 'kit-42',
      });

      // 1er retour : ferme le sous-tiroir
      const r1 = machine.handlePopState();
      expect(r1.handled).toBe(true);
      expect(machine.getState()).toEqual({
        type: 'STUDIO',
        activeDrawer: 'personnaliser',
        subDrawerId: undefined,
        kitId: 'kit-42',
      });

      // 2e retour : ferme le tiroir Studio, reste dans le Studio 3D
      const r2 = machine.handlePopState();
      expect(r2.handled).toBe(true);
      expect(machine.getState()).toEqual({
        type: 'STUDIO',
        activeDrawer: undefined,
        subDrawerId: undefined,
        kitId: 'kit-42',
      });

      // 3e retour : quitte le Studio et revient au Camp (/hub)
      const r3 = machine.handlePopState();
      expect(r3.handled).toBe(true);
      expect(machine.getState()).toEqual({ type: 'CLOSED' });

      // 4e retour : laisse le navigateur gérer l'historique hors /hub
      const r4 = machine.handlePopState();
      expect(r4.handled).toBe(false);
    });

    it('déroule la pile HUB : sous-tiroir HUB -> tiroir HUB -> Studio (si ouvert depuis Studio) -> CLOSED', () => {
      const machine = new DrawerNavigationMachine();
      machine.enterStudio('inventaire', 'kit-9');
      machine.openDrawer('depart', true);
      machine.openSubDrawer('meteo-depart');

      expect(machine.getState()).toEqual({
        type: 'SUB_DRAWER_OPEN',
        drawerId: 'depart',
        sectionId: 'depart',
        subDrawerId: 'meteo-depart',
      });

      const r1 = machine.handlePopState();
      expect(r1.handled).toBe(true);
      expect(machine.getState()).toEqual({
        type: 'DRAWER_OPEN',
        drawerId: 'depart',
        sectionId: 'depart',
      });

      const r2 = machine.handlePopState();
      expect(r2.handled).toBe(true);
      expect(machine.getState()).toEqual({
        type: 'STUDIO',
        activeDrawer: 'inventaire',
        kitId: 'kit-9',
      });
    });
  });

  describe('ScrollCache', () => {
    it('enregistre et restaure les positions de scroll positives pour chaque tiroir', () => {
      const machine = new DrawerNavigationMachine();
      machine.saveScrollPosition('inventaire', 350);
      machine.saveScrollPosition('checklist', -20);

      expect(machine.getScrollPosition('inventaire')).toBe(350);
      expect(machine.getScrollPosition('checklist')).toBe(0);
      expect(machine.getScrollPosition('inconnu')).toBe(0);

      machine.clearScrollCache();
      expect(machine.getScrollPosition('inventaire')).toBe(0);
    });
  });

  it('resolveHubDestination reconnaît les 19 IDs aussi bien que les 19 segments', () => {
    for (const def of hubSectionRegistry) {
      expect(resolveHubDestination(def.id)).not.toBeNull();
      expect(resolveHubDestination(def.segment)).not.toBeNull();
    }
  });
});
