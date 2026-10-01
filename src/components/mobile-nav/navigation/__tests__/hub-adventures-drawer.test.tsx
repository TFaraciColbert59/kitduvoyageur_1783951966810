import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  DRAWER_TITLE,
  DRAWER_SUBTITLE,
  DRAWER_LIST_HEADING,
  EMPTY_ADVENTURES_TITLE,
  EMPTY_ADVENTURES_HINT,
  PREPARE_ACTION,
  FREE_ACTION,
  drawerActions,
  isEmptyAdventures,
  countAdventures,
  adventureRows,
  consumeDrawerAutoOpen,
} from '../adventuresDrawerModel';
import { HubAdventuresDrawerContent } from '../HubAdventuresDrawer';
import type { AdventureGroups } from '@/features/hub/context/adventureLists';

const source = readFileSync(
  'src/components/mobile-nav/navigation/HubAdventuresDrawer.tsx',
  'utf8',
);
const hubShell = readFileSync('src/features/hub/components/HubShell.tsx', 'utf8');
const webNavigationBar = readFileSync(
  'src/components/mobile-nav/navigation/WebNavigationBar.tsx',
  'utf8',
);
const css = readFileSync(
  'src/components/mobile-nav/navigation/hubAdventuresDrawer.css',
  'utf8',
);

const emptyGroups: AdventureGroups = { possession: [], sorties: [], collectifs: [] };

const filledGroups: AdventureGroups = {
  possession: [{ nature: 'possession', itemsCount: 12, loansCount: 1, alertsCount: 0 }],
  sorties: [
    { nature: 'sortie', id: 't1', slug: 'premiere-sortie', title: 'Premi\u00e8re sortie' },
    { nature: 'sortie', id: 't2', slug: 'week-end', title: 'Week-end' },
  ],
  collectifs: [
    {
      nature: 'collectif',
      id: 'g1',
      title: 'Collectif',
      membersCount: 4,
      subtitle: '4 membre(s)',
      linkedTripSlug: null,
    },
  ],
};

const noop = () => undefined;
const getLastSection = () => null;

function content(groups: AdventureGroups = filledGroups): string {
  return renderToStaticMarkup(
    React.createElement(HubAdventuresDrawerContent, {
      groups,
      getLastSection,
      onNavigate: noop,
    }),
  );
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Tiroir « Tes aventures » — identite', () => {
  it('DR-01: le tiroir porte le titre de la maquette et dit comment il s’ouvre', () => {
    expect(DRAWER_TITLE).toBe('Tes aventures');
    expect(DRAWER_SUBTITLE).toBe('Ouvert par un appui long sur Hub.');
  });

  it('DR-02: le vide est explicite, sans inventer d’aventure', () => {
    expect(EMPTY_ADVENTURES_TITLE).toBe("Aucune aventure pour l'instant");
    expect(EMPTY_ADVENTURES_HINT).toBe(
      'Cr\u00e9e une activit\u00e9 ou un voyage : le prep de parcours, du mat\u00e9riel et du groupe.',
    );
  });
});

describe('Tiroir « Tes aventures » — actions', () => {
  it('DR-03: les deux actions existent, dans l’ordre, vers les bonnes routes', () => {
    const actions = drawerActions();
    expect(actions).toHaveLength(2);
    expect(actions[0].id).toBe('prepare');
    expect(actions[0].label).toBe('Pr\u00e9parer une activit\u00e9');
    expect(actions[0].href).toBe('/compas?nouvelle=1');
    expect(actions[1].id).toBe('libre');
    expect(actions[1].label).toBe('Partir librement');
    expect(actions[1].href).toBe('/partir-librement');
  });

  it('DR-04: les deux routes sont absolues et distinctes — aucune route morte', () => {
    for (const action of drawerActions()) {
      expect(action.href.startsWith('/')).toBe(true);
      expect(action.href).not.toBe('/hub');
    }
    expect(new Set(drawerActions().map((a) => a.href)).size).toBe(2);
  });

  it('DR-05: « Preparer une activite » est primaire, pas une action de fin de liste', () => {
    expect(PREPARE_ACTION.variant).toBe('primary');
    expect(FREE_ACTION.variant).toBe('secondary');
    expect(drawerActions()[0].id).toBe(PREPARE_ACTION.id);
  });

  it('DR-06: chaque action porte une description, la route reste le seul contrat', () => {
    for (const action of drawerActions()) {
      expect(action.description.length).toBeGreaterThan(8);
    }
  });
});

describe('Tiroir « Tes aventures » — les aventures existantes ne sont jamais retirees', () => {
  it('DR-07: les trois natures restent listables, meme sans aucune aventure', () => {
    expect(countAdventures(emptyGroups)).toBe(0);
    expect(isEmptyAdventures(emptyGroups)).toBe(true);
  });

  it('DR-07b: le materiel seul n est PAS une aventure — l etat vide reste honnete', () => {
    // groupAdventures pousse TOUJOURS une entree possession : si elle comptait,
    // l etat vide de la maquette ne s afficherait jamais.
    const materielSeul: AdventureGroups = {
      possession: filledGroups.possession,
      sorties: [],
      collectifs: [],
    };
    expect(countAdventures(materielSeul)).toBe(0);
    expect(isEmptyAdventures(materielSeul)).toBe(true);
    const text = visible(content(materielSeul));
    expect(text).toContain("Aucune aventure pour l'instant");
    expect(text).toContain('Pr\u00e9parer une activit\u00e9');
    expect(text).not.toContain('Mat\u00e9riel');
  });

  it('DR-08: le tiroir compte et expose toutes les natures presentes', () => {
    expect(isEmptyAdventures(filledGroups)).toBe(false);
    expect(countAdventures(filledGroups)).toBe(3);
    const rows = adventureRows(filledGroups, getLastSection);
    const natures = new Set(rows.map((r) => r.nature));
    expect(natures.has('possession')).toBe(true);
    expect(natures.has('sortie')).toBe(true);
    expect(natures.has('collectif')).toBe(true);
  });

  it('DR-09: une ligne porte toujours un titre et une URL resoluble', () => {
    for (const row of adventureRows(filledGroups, getLastSection)) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.href.startsWith('/hub')).toBe(true);
    }
  });
});

describe('Tiroir « Tes aventures » — signal d’ouverture hors hub', () => {
  it('DR-10: le signal one-shot se consomme une seule fois', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
    store.set('lkdv_hub_switcher_autopen', '1');
    expect(consumeDrawerAutoOpen(storage)).toBe(true);
    expect(consumeDrawerAutoOpen(storage)).toBe(false);
  });

  it('DR-11: un stockage hostile ne casse jamais le hub', () => {
    const hostile = {
      getItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(consumeDrawerAutoOpen(hostile)).toBe(false);
  });

  it('DR-12: une valeur inattendue n’ouvre pas le tiroir', () => {
    const store = new Map<string, string>([['lkdv_hub_switcher_autopen', 'oui']]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
    expect(consumeDrawerAutoOpen(storage)).toBe(false);
  });
});

describe('Tiroir « Tes aventures » — rendu', () => {
  it('DR-13: les deux actions sont rendues meme quand le tiroir est vide', () => {
    const text = visible(content(emptyGroups));
    expect(text).toContain('Pr\u00e9parer une activit\u00e9');
    expect(text).toContain('Partir librement');
    expect(text).toContain("Aucune aventure pour l'instant");
  });

  it('DR-14: l’action primaire est rendue AVANT la liste des aventures', () => {
    const text = visible(content());
    const prepareAt = text.indexOf('Pr\u00e9parer une activit\u00e9');
    const firstRowAt = text.indexOf('Premi\u00e8re sortie');
    expect(prepareAt).toBeGreaterThanOrEqual(0);
    expect(firstRowAt).toBeGreaterThanOrEqual(0);
    expect(prepareAt).toBeLessThan(firstRowAt);
  });

  it('DR-15: ce sont de vrais boutons — Entree et Espace fonctionnent sans code', () => {
    const html = content();
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('type="button"');
  });

  it('DR-16: l’icone d’une action est decorative, le libelle porte le sens', () => {
    const html = content();
    const primary = html.match(/<button[^>]*data-had-action="prepare"[^>]*>/)?.[0] ?? '';
    expect(primary).toContain('aria-label=');
    expect(html).toContain('aria-hidden="true"');
  });

  it('DR-17: la liste est annoncee comme telle (et pas comme du texte libre)', () => {
    const html = content();
    expect(html).toContain(DRAWER_LIST_HEADING);
    expect(html).toMatch(/aria-label="[^"]*aventure[^"]*"/i);
  });

  it('DR-18: le tiroir n’affiche aucun etat vide quand il y a des aventures', () => {
    const text = visible(content());
    expect(text).not.toContain("Aucune aventure pour l'instant");
    expect(text).toContain('Premi\u00e8re sortie');
    expect(text).toContain('Week-end');
  });
});

describe('Tiroir « Tes aventures » — contrat d’accessibilite et de matiere', () => {
  it('DR-19: le Sheet porte le titre, la description et se ferme au clic/Echap', () => {
    expect(source).toContain('title={DRAWER_TITLE}');
    expect(source).toContain('description={DRAWER_SUBTITLE}');
    expect(source).toContain('onOpenChange');
  });

  it('DR-20: focus piege et restitue par le dialog Radix du Sheet partage', () => {
    expect(source).toContain("from '@/components/ui/Sheet'");
  });

  it('DR-21: l’ouverture longue et le retour materiel pilotent le meme tiroir', () => {
    expect(source).toContain('hub:open-switcher');
    expect(source).toContain('hub:close-switcher');
    expect(source).toContain('hub:switcher-state');
  });

  it('DR-22: le tiroir se ferme au changement de route', () => {
    expect(source).toMatch(/usePathname/);
  });

  it('DR-23: aucun hexadecimal ni rgb()/hsl() dans le composant', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\s*\(/);
  });

  it('DR-24: la feuille de style est une feuille de tokens', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\s*\(/);
    expect(css).toMatch(/var\(--lkv-/);
  });

  it('DR-25: la zone tactile de l’action primaire respecte 44 px', () => {
    const block = css.slice(css.indexOf('.had-action'), css.indexOf('.had-action') + 1400);
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it('DR-26: le focus clavier est visible sur chaque action', () => {
    expect(css).toContain('.had-action:focus-visible');
  });
});

describe('Tiroir « Tes aventures » — non-regression du cablage existant', () => {
  it('DR-27: le hub monte le tiroir', () => {
    expect(hubShell).toContain('<HubAdventuresDrawer />');
  });

  it('DR-28: un seul dialogue a la fois — l’appui long n’ouvre plus l’ancien switcher', () => {
    expect(hubShell).not.toContain('setSwitcherSignal');
  });

  it('DR-29: l’etat ouvert reste publie pour le retour materiel Android', () => {
    expect(hubShell).toContain('hub:switcher-state');
    expect(hubShell).toContain('useAndroidHubBackNav');
  });

  it('DR-31: le focus est restitue au declencheur a la fermeture', () => {
    expect(webNavigationBar).toContain('hubTriggerRef');
    expect(webNavigationBar).toContain('hub:switcher-state');
    expect(webNavigationBar).toContain('trigger.focus()');
    expect(webNavigationBar).toContain('drawerWasOpen.current && !open');
  });

  it('DR-32: la restitution du focus vise le declencheur REEL, apres Radix', () => {
    // Un `pointerdown` quelconque memorise plus tot ferait restituer le focus
    // sur un element sans rapport : on ne retient que le lien Hub.
    expect(webNavigationBar).toContain(
      'const HUB_TRIGGER = \'nav[aria-label="Navigation principale"] a[href="/hub"]\';',
    );
    expect(webNavigationBar).toContain('if (hubTrigger) hubTriggerRef.current = hubTrigger;');
    // Radix rend le focus apres notre evenement d’etat : la restitution
    // doit donc passer en double requestAnimationFrame pour passer DERNIER.
    const restore = webNavigationBar.slice(
      webNavigationBar.indexOf('const restoreTriggerFocus'),
      webNavigationBar.indexOf('const onPointerDown'),
    );
    expect(restore).toContain('requestAnimationFrame');
    expect(restore).toContain('trigger.focus();');
    expect(restore).not.toContain('a[href], button, [tabindex]');
  });
  it('DR-33: la barre d’onglets sort de l’echelle visuelle pendant le dialogue', () => {
    // Sous le verre du Sheet (z 50) la barre (z 40) se devinait dans la
    // derniere ligne : le tiroir doit se lire comme une surface pleine.
    expect(source).toContain("export const OPEN_ATTRIBUTE = 'data-had-open';");
    expect(source).toContain('root.setAttribute(OPEN_ATTRIBUTE, ');
    expect(source).toContain('return () => root.removeAttribute(OPEN_ATTRIBUTE);');
    expect(css).toContain("html[data-had-open='true'] .lkv-nav-surface {");
    // `opacity` et non `visibility` : la barre doit rester focusable pour
    // que la restitution du focus dispose encore de sa cible.
    const start = css.indexOf("html[data-had-open='true'] .lkv-nav-surface {");
    const navRule = css.slice(start, start + 240);
    expect(navRule).toContain('opacity: 0;');
    expect(navRule).not.toContain('visibility: hidden');
    // Les deux actions lisent comme des surfaces pleines.
    expect(css).toMatch(/\.had-action--secondary \{[\s\S]{0,240}background: var\(--glass-bg-strong\)/);
  });
  it('DR-30: l’appui long sur Hub continue d’emettre le signal', () => {
    expect(webNavigationBar).toContain(
      "onLongPress={destination.id === 'adventures' ? openHubSwitcher",
    );
    expect(webNavigationBar).toContain('isHubSurfacePathname(pathname)');
    expect(webNavigationBar).toContain('opticalNavigation={opticalNavigation}');
  });
});