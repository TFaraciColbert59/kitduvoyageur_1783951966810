// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applySetNationality,
  applySheetModalState,
  nextSheetFocus,
  resolveNationality,
} from '../../src/components/compte/compte-liquid-glass-v8-runtime.js';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

function mountDrawerDom() {
  document.body.innerHTML = `
    <div id="phone">
      <div class="status" aria-hidden="true"><span>9:41</span></div>
      <div class="island"></div>
      <section class="top" id="top"><button id="opener">Profil</button></section>
      <section class="mapzone" aria-label="Carte">
        <button id="map-control">Zoom</button>
      </section>
      <nav class="tabbar" id="tabbar"><button id="tab">Carte</button></nav>
      <div class="home"></div>
      <div class="sw-wrap" id="sw" data-det="closed">
        <div class="scrim"></div>
        <section class="sheet" id="sheet" role="dialog" aria-label="Profil">
          <button id="sheet-close">Fermer</button>
          <button id="sheet-next">Suivant</button>
        </section>
      </div>
      <div class="popv" id="popv"><button id="popv-button">Affichage</button></div>
    </div>
  `;
  const get = (id: string) => document.getElementById(id) as HTMLElement;
  return {
    sheet: get('sheet'),
    top: get('top'),
    mapzone: document.querySelector('.mapzone') as HTMLElement,
    tabbar: get('tabbar'),
    home: document.querySelector('.home') as HTMLElement,
    status: document.querySelector('.status') as HTMLElement,
    island: document.querySelector('.island') as HTMLElement,
    popv: get('popv'),
    opener: get('opener'),
    close: get('sheet-close'),
    next: get('sheet-next'),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Drawer Profil — modalité, inertie et focus', () => {
  it('pose aria-modal=true, inertit la page derrière #sheet puis restaure tout', () => {
    const dom = mountDrawerDom();
    // Une inertie/aria-hidden préexistante ne doit jamais être écrasée.
    dom.home.setAttribute('inert', '');

    applySheetModalState(dom.sheet, true);

    expect(dom.sheet.getAttribute('aria-modal')).toBe('true');
    for (const target of [dom.top, dom.mapzone, dom.tabbar, dom.home, dom.island]) {
      expect(target.hasAttribute('inert')).toBe(true);
      expect(target.getAttribute('aria-hidden')).toBe('true');
    }
    // Le statut est déjà aria-hidden : on conserve sa valeur exacte.
    expect(dom.status.getAttribute('aria-hidden')).toBe('true');
    // Les autres dialogues (menus, popovers) ne sont pas la page derrière.
    expect(dom.popv.hasAttribute('inert')).toBe(false);
    expect(dom.popv.hasAttribute('aria-hidden')).toBe(false);
    // La feuille elle-même reste interactive.
    expect(dom.sheet.hasAttribute('inert')).toBe(false);

    applySheetModalState(dom.sheet, false);

    expect(dom.sheet.hasAttribute('aria-modal')).toBe(false);
    for (const target of [dom.top, dom.mapzone, dom.tabbar, dom.island]) {
      expect(target.hasAttribute('inert')).toBe(false);
      expect(target.hasAttribute('aria-hidden')).toBe(false);
    }
    expect(dom.home.hasAttribute('inert')).toBe(true);
    expect(dom.home.hasAttribute('aria-hidden')).toBe(false);
    expect(dom.status.getAttribute('aria-hidden')).toBe('true');
  });

  it('fait cycler Tab/Shift+Tab aux bornes de #sheet', () => {
    const dom = mountDrawerDom();

    expect(nextSheetFocus(dom.sheet, dom.close, true)).toBe(dom.next);
    expect(nextSheetFocus(dom.sheet, dom.next, false)).toBe(dom.close);
    expect(nextSheetFocus(dom.sheet, dom.close, false)).toBeNull();
    expect(nextSheetFocus(dom.sheet, dom.next, true)).toBeNull();
    expect(nextSheetFocus(dom.sheet, dom.sheet, false)).toBe(dom.close);
    expect(nextSheetFocus(dom.sheet, dom.sheet, true)).toBe(dom.next);
    expect(nextSheetFocus(dom.sheet, dom.opener, false)).toBeNull();
    expect(nextSheetFocus(dom.sheet, dom.opener, true)).toBeNull();
  });

  it('renvoie la feuille quand aucun élément n’est focusable', () => {
    const dom = mountDrawerDom();
    dom.sheet.innerHTML = '';
    expect(nextSheetFocus(dom.sheet, null, false)).toBe(dom.sheet);
    expect(nextSheetFocus(dom.sheet, null, true)).toBe(dom.sheet);
  });

  it('câble la modalité, le piège de focus et la restauration dans le runtime', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    expect(runtime).toContain('applySheetModalState');
    expect(runtime).toContain('nextSheetFocus');
    expect(runtime).toContain(
      'applySheetModalState(sheetEl, !!(S.sh && S.sh.det !== "closed"))'
    );
    expect(runtime).toContain('document.addEventListener("keydown", onSheetKeyDown, true)');
    expect(runtime).toContain('nextSheetFocus(sheetEl, document.activeElement, e.shiftKey)');
    expect(runtime).toContain('if (e.key !== "Tab") return;');
    // La restauration du focus à la fermeture reste portée par l'ouvreur.
    expect(runtime).toContain('opener.focus({ preventScroll: true })');
  });
});

describe('Nationalité exacte — setnat', () => {
  it('remplace la multi-sélection par une nationalité unique', () => {
    const plan = applySetNationality(
      {
        nats: ['France', 'Italie'],
        nationality: 'France',
        profileNationality: 'Italie',
      },
      'Italie'
    );

    expect(plan).toEqual({
      value: 'Italie',
      changed: true,
      nats: ['Italie'],
      nationality: 'Italie',
      profileNationality: 'Italie',
    });
  });

  it('est idempotente quand l’état est déjà exactement la valeur demandée', () => {
    const current = {
      nats: ['Italie'],
      nationality: 'Italie',
      profileNationality: 'Italie',
    };
    const plan = applySetNationality(current, 'Italie');

    expect(plan).toEqual({
      value: 'Italie',
      changed: false,
      nats: ['Italie'],
      nationality: 'Italie',
      profileNationality: 'Italie',
    });
    // Une seconde application ne redéclenche rien.
    expect(applySetNationality(current, 'Italie')?.changed).toBe(false);
  });

  it('rejette les valeurs vides ou inconnues', () => {
    for (const unknown of [
      'Atlantide',
      'italie',
      ' Italie ',
      '',
      '   ',
      null,
      undefined,
      42,
      {},
      [],
    ]) {
      expect(resolveNationality(unknown)).toBeNull();
      expect(applySetNationality({ nats: ['France'], nationality: 'France' }, unknown)).toBeNull();
    }
  });

  it('câble setnat sans modifier le comportement de nat', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    expect(runtime).toContain('if (a === "setnat")');
    expect(runtime).toContain('doMut("setnat", plan.value, meta)');
    expect(runtime).toContain('S.traveller.nats = [plan.value]');
    expect(runtime).toContain('S.profile.nationality = plan.value');
    expect(runtime).toContain(
      'nat: v => { S.traveller.nationality = v; return "Nationalité : " + v; }'
    );
  });
});

describe('Échap imbriqué — les feuilles possèdent la touche', () => {
  it('ProfileSettingsSheet écoute en capture et coupe la propagation immédiatement', () => {
    const source = read('src/components/compte/drawer/ProfileSettingsSheet.tsx');
    expect(source).toContain("document.addEventListener('keydown', onKeyDown, true)");
    expect(source).toContain("document.removeEventListener('keydown', onKeyDown, true)");
    expect(source).toContain('event.stopImmediatePropagation()');
    expect(source).toContain("act('setnat'");
    expect(source).not.toContain("applyIdentity('nat'");
  });

  it('InvitationsSheet conserve le même contrat', () => {
    const source = read('src/components/compte/drawer/InvitationsSheet.tsx');
    expect(source).toContain("document.addEventListener('keydown', onKeyDown, true)");
    expect(source).toContain('event.stopImmediatePropagation()');
  });
});
