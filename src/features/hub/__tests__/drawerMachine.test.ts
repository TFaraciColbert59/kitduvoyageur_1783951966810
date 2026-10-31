import { describe, expect, it } from 'vitest';
import {
  HUB_CANONICAL_SEGMENTS,
  HUB_SEGMENT_ALIASES,
} from '../registry/hubSectionRegistry';
import { DrawerNavigationMachine } from '../state/drawerMachine';

describe('DrawerNavigationMachine (L3-1)', () => {
  it('initialise par défaut à l état CLOSED', () => {
    const machine = new DrawerNavigationMachine();
    expect(machine.getState()).toEqual({ type: 'CLOSED' });
  });

  it('ouvre chacun des 19 segments canoniques et résout le bon drawerId', () => {
    const machine = new DrawerNavigationMachine();

    for (const segment of HUB_CANONICAL_SEGMENTS) {
      machine.openDrawer(segment);

      if (segment === '') {
        expect(machine.getState()).toEqual({ type: 'CLOSED' });
      } else {
        expect(machine.getState()).toEqual({
          type: 'DRAWER_OPEN',
          drawerId: segment,
        });
      }
    }
  });

  it('résout fidèlement tous les alias historiques vers leurs tiroirs canoniques', () => {
    const machine = new DrawerNavigationMachine();

    for (const [alias, canonical] of Object.entries(HUB_SEGMENT_ALIASES)) {
      machine.openDrawer(alias);
      expect(machine.getState()).toEqual({
        type: 'DRAWER_OPEN',
        drawerId: canonical,
      });
    }
  });

  it('gère l ouverture et la fermeture d un sous-drawer', () => {
    const machine = new DrawerNavigationMachine();
    machine.openDrawer('personnaliser');

    expect(machine.getState()).toEqual({
      type: 'DRAWER_OPEN',
      drawerId: 'personnaliser',
    });

    machine.openSubDrawer('pockets');
    expect(machine.getState()).toEqual({
      type: 'SUB_DRAWER_OPEN',
      drawerId: 'personnaliser',
      subDrawerId: 'pockets',
    });

    machine.closeSubDrawer();
    expect(machine.getState()).toEqual({
      type: 'DRAWER_OPEN',
      drawerId: 'personnaliser',
    });
  });

  describe('Hiérarchie Popstate (Retour arrière sans quitter /hub)', () => {
    it('ferme le sous-drawer vers le drawer parent sur popstate', () => {
      const machine = new DrawerNavigationMachine();
      machine.openDrawer('personnaliser');
      machine.openSubDrawer('materials');

      const res = machine.handlePopState();
      expect(res.handled).toBe(true);
      expect(machine.getState()).toEqual({
        type: 'DRAWER_OPEN',
        drawerId: 'personnaliser',
      });
    });

    it('ferme le drawer vers CLOSED sans quitter /hub sur popstate', () => {
      const machine = new DrawerNavigationMachine();
      machine.openDrawer('inventaire');

      const res = machine.handlePopState();
      expect(res.handled).toBe(true);
      expect(machine.getState()).toEqual({ type: 'CLOSED' });
    });

    it('revient au mode STUDIO si le drawer avait été ouvert depuis le Studio', () => {
      const machine = new DrawerNavigationMachine();
      machine.enterStudio();
      expect(machine.getState()).toEqual({ type: 'STUDIO', activeDrawer: undefined });

      machine.openDrawer('inventaire', true);
      expect(machine.getState()).toEqual({
        type: 'DRAWER_OPEN',
        drawerId: 'inventaire',
      });

      const res = machine.handlePopState();
      expect(res.handled).toBe(true);
      expect(machine.getState()).toEqual({ type: 'STUDIO' });
    });

    it('ferme le Studio vers CLOSED sur popstate', () => {
      const machine = new DrawerNavigationMachine();
      machine.enterStudio();

      const res = machine.handlePopState();
      expect(res.handled).toBe(true);
      expect(machine.getState()).toEqual({ type: 'CLOSED' });
    });

    it('laisse passer l événement historique (handled = false) lorsque l état est CLOSED', () => {
      const machine = new DrawerNavigationMachine();
      expect(machine.getState()).toEqual({ type: 'CLOSED' });

      const res = machine.handlePopState();
      expect(res.handled).toBe(false);
      expect(res.state).toEqual({ type: 'CLOSED' });
    });
  });

  describe('ScrollCache', () => {
    it('enregistre et restaure les positions de scroll pour chaque tiroir', () => {
      const machine = new DrawerNavigationMachine();

      machine.saveScrollPosition('inventaire', 350);
      machine.saveScrollPosition('statistiques', 120);

      expect(machine.getScrollPosition('inventaire')).toBe(350);
      expect(machine.getScrollPosition('statistiques')).toBe(120);
      expect(machine.getScrollPosition('inconnu')).toBe(0);

      machine.clearScrollCache();
      expect(machine.getScrollPosition('inventaire')).toBe(0);
    });
  });
});
