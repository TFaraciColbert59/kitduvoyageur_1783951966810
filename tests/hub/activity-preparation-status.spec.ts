import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * T10 — Rail de préparation (§4.5) réduit à une barre silencieuse : seule la
 * barre `data-testid="preparation-progressbar"` est rendue (`scaleX(completed/6)`,
 * décorative, sans texte, libellé, liste ni `aria-live`) ; échec définitif
 * d'enrichissement = barre masquée. Les helpers purs de `preparationPhases`
 * restent couverts. Plus les gardes du reveal événementiel (`LiveArrivalReveal`)
 * et de l'aperçu dev interdit en prod.
 */
const motionControl = vi.hoisted(() => ({ reduced: false }));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => motionControl.reduced,
  };
});

import {
  ActivityPreparationStatus,
  PREPARATION_PHASES,
  RAIL_CHECK_SPRING,
  SUCCESS_HAPTIC_INTERVAL_MS,
  completedPhaseCount,
  fixtureCountsForPhase,
  preparationAnnouncement,
} from '@/features/hub/components/live/ActivityPreparationStatus';
import { LiveArrivalReveal } from '@/features/hub/components/live/LiveArrivalReveal';
import {
  ACTIVITY_ARRIVAL_EVENT,
  shouldRevealArrival,
} from '@/features/hub/components/live/useActivityLiveArrivals';
import { emitActivityArrival } from '@/features/hub/components/live/ActivityLiveBridge';

const ROOT = process.cwd();

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

function count(html: string, marker: string): number {
  return (html.match(new RegExp(marker, 'g')) ?? []).length;
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(p.split('\\').join('/'));
  }
  return acc;
}

beforeEach(() => {
  motionControl.reduced = false;
});

describe('rail de préparation — phases canoniques', () => {
  it('expose les 6 phases dans l’ordre du §4.5', () => {
    expect(PREPARATION_PHASES.map((phase) => phase.label)).toEqual([
      'Analyse',
      'Itinéraire',
      'Moments',
      'Transports & hébergements',
      'Kit',
      'Finitions',
    ]);
  });

  it('compte les phases terminées (done = les 6)', () => {
    expect(completedPhaseCount('waiting')).toBe(0);
    expect(completedPhaseCount('itinerary')).toBe(1);
    expect(completedPhaseCount('moments')).toBe(2);
    expect(completedPhaseCount('affiliation')).toBe(3);
    expect(completedPhaseCount('kit')).toBe(4);
    expect(completedPhaseCount('done')).toBe(6);
  });

  it('fixtures d’aperçu : compteurs cohérents par phase', () => {
    expect(fixtureCountsForPhase('waiting')).toEqual({ steps: 0, moments: 0, affiliation: 0, kit: 0 });
    expect(fixtureCountsForPhase('itinerary').steps).toBeGreaterThan(0);
    expect(fixtureCountsForPhase('moments').moments).toBeGreaterThan(0);
    expect(fixtureCountsForPhase('affiliation').affiliation).toBeGreaterThan(0);
    expect(fixtureCountsForPhase('kit').kit).toBeGreaterThan(0);
    expect(fixtureCountsForPhase('done')).toEqual(fixtureCountsForPhase('kit'));
  });
});

describe('annonce aria-live — texte des mises à jour', () => {
  const base = { steps: 0, moments: 0, affiliation: 0, kit: 0 };

  it('compte les étapes ajoutées (pluriel)', () => {
    expect(preparationAnnouncement('itinerary', { ...base, steps: 3 })).toBe('3 étapes ajoutées');
    expect(preparationAnnouncement('itinerary', { ...base, steps: 1 })).toBe('1 étape ajoutée');
  });

  it('compte les moments / transports / kit', () => {
    expect(preparationAnnouncement('moments', { ...base, steps: 3, moments: 2 })).toBe(
      '2 moments ajoutés'
    );
    expect(preparationAnnouncement('affiliation', { ...base, steps: 3, moments: 2, affiliation: 1 })).toBe(
      '1 transport & hébergement ajouté'
    );
    expect(preparationAnnouncement('kit', { ...base, steps: 3, moments: 2, affiliation: 1, kit: 4 })).toBe(
      '4 éléments de kit ajoutés'
    );
  });

  it('done → « Préparation prête », waiting → analyse en cours', () => {
    expect(preparationAnnouncement('done', fixtureCountsForPhase('done'))).toBe('Préparation prête');
    expect(preparationAnnouncement('waiting', base)).toBe('Analyse en cours');
  });

  it('fixture sans compteurs : repli « phase en cours » (jamais « 0 ajouté »)', () => {
    expect(preparationAnnouncement('moments', base)).toBe('Moments en cours');
    expect(preparationAnnouncement('kit', base)).toBe('Kit en cours');
  });
});

describe('markup du rail — barre silencieuse (task 2)', () => {
  function renderRail(
    props: React.ComponentProps<typeof ActivityPreparationStatus> = {}
  ): string {
    return renderToStaticMarkup(React.createElement(ActivityPreparationStatus, props));
  }

  function textContent(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  it('seule la barre testid est rendue : ni texte, ni phases, ni aria-live', () => {
    const html = renderRail({ phaseOverride: 'moments' });

    expect(html).toContain('data-testid="preparation-progressbar"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-phase="moments"');
    expect(html).toContain(`scaleX(${2 / 6})`);

    expect(html).not.toContain('/6');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('Améliorer');
    expect(html).not.toContain('data-rail-step');
    for (const label of PREPARATION_PHASES.map((definition) => definition.label)) {
      expect(html).not.toContain(label);
    }
    expect(textContent(html)).toBe('');
  });

  it('la barre suit la phase : waiting 0, moments 2/6, done 1 (aucune coche)', () => {
    expect(renderRail({ phaseOverride: 'waiting' })).toContain('scaleX(0)');
    expect(renderRail({ phaseOverride: 'moments' })).toContain(`scaleX(${2 / 6})`);

    const done = renderRail({ phaseOverride: 'done' });
    expect(done).toContain('scaleX(1)');
    expect(done).not.toContain('data-rail-check');
    expect(done).not.toContain('data-rail-current');
    expect(done).not.toContain('data-rail-pending');
    expect(done).not.toContain('Préparation prête');
  });

  it('compteurs serveur : phase réelle dès le premier paint (kit), barre 4/6', () => {
    const html = renderRail({
      preparation: {
        counts: { steps: 3, moments: 2, affiliation: 0, kit: 4 },
        enrichmentStatus: 'pending',
      },
      tripId: 'trip-1',
    });

    expect(html).toContain('data-phase="kit"');
    expect(html).toContain(`scaleX(${4 / 6})`);
    expect(textContent(html)).toBe('');
  });

  it('enrichissement serveur done : barre pleine même sans affiliation, sans texte', () => {
    const html = renderRail({
      preparation: {
        counts: { steps: 1, moments: 1, affiliation: 0, kit: 2 },
        enrichmentStatus: 'done',
      },
    });

    expect(html).toContain('data-phase="done"');
    expect(html).toContain('scaleX(1)');
    expect(textContent(html)).toBe('');
  });

  it('échec définitif : barre masquée, aucun texte ni « Améliorer »', () => {
    const html = renderRail({
      preparation: {
        counts: { steps: 1, moments: 0, affiliation: 0, kit: 0 },
        enrichmentStatus: 'failed',
      },
      tripId: 'trip-1',
    });

    expect(html).not.toContain('preparation-progressbar');
    expect(html).not.toContain('activity-preparation-status');
    expect(html).not.toContain('Améliorer');
    expect(html).not.toContain('Version essentielle');
    expect(textContent(html)).toBe('');
  });
});

describe('garde-fous source du rail', () => {
  const source = () =>
    readSource('src', 'features', 'hub', 'components', 'live', 'ActivityPreparationStatus.tsx');

  it('coche spring snappy 500/25 et anti-rafale 800 ms', () => {
    expect(RAIL_CHECK_SPRING).toEqual({ stiffness: 500, damping: 25 });
    expect(SUCCESS_HAPTIC_INTERVAL_MS).toBe(800);
    expect(source()).toContain('triggerHaptic(\'success\')');
  });

  it('portail IntersectionObserver + progression en transform uniquement', () => {
    const file = source();
    expect(file).toContain('IntersectionObserver');
    expect(file).toContain('scaleX(');
    // Jamais d'animation de largeur/hauteur.
    expect(file).not.toMatch(/animate[^\n]*\bwidth\b/);
  });

  it('barre silencieuse : aucun texte, liste, annonce ni relance dans la source', () => {
    const file = source();
    expect(file).not.toContain('aria-live');
    expect(file).not.toContain('<ol');
    expect(file).not.toContain('Améliorer');
    expect(file).not.toContain('AnimatedNumber');
    expect(file).not.toContain('data-rail-step');
    expect(file).not.toContain('data-rail-check');
  });

  it('le pont realtime T9 est monté une seule fois, au niveau de la surface hub', () => {
    const shell = readSource('src', 'features', 'hub', 'components', 'HubShell.tsx');
    expect(count(shell, '<ActivityLiveBridge')).toBe(1);
    expect(shell).toContain("adventure.nature === 'sortie' ? adventure.id : null");

    const menu = readSource('src', 'features', 'hub', 'components', 'menu', 'SortieMenu.tsx');
    expect(count(menu, '<ActivityLiveBridge')).toBe(0);

    const mobile = readSource(
      'src',
      'features',
      'hub',
      'components',
      'mobile',
      'MobileAdventureHub.tsx'
    );
    expect(mobile).not.toContain('ActivityLiveBridge');
  });
});

describe('LiveArrivalReveal — reveal des seuls ids du seen-set', () => {
  it('anime un id arrivé par le bus (offset canonique)', () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveArrivalReveal, {
        id: 's1',
        liveIds: new Set(['s1']),
        children: React.createElement('span', null, 'Étape live'),
      })
    );

    expect(html).toContain('Étape live');
    expect(html).toMatch(/translateY\(8px\)/);
  });

  it('rend statique un id hors seen-set (aucun offset)', () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveArrivalReveal, {
        id: 's2',
        liveIds: new Set(['s1']),
        children: React.createElement('span', null, 'Étape initiale'),
      })
    );

    expect(html).toContain('Étape initiale');
    expect(html).not.toMatch(/translateY\(8px\)/);
  });

  it('le portail IO n’anime que les arrivées reçues section visible', () => {
    const hook = readSource(
      'src',
      'features',
      'hub',
      'components',
      'live',
      'useLiveArrivalReveal.ts'
    );
    expect(hook).toContain('IntersectionObserver');
    expect(hook).toContain('rootMargin');
    expect(hook).toMatch(/if \(visibleRef\.current\)/);
  });
});

describe('aperçu dev — /preparer-sentier/apercu', () => {
  const previewPath = ['src', 'app', 'preparer-sentier', 'apercu', 'page.tsx'];

  it('rend notFound() en production (garde en tête de rendu)', () => {
    const source = readSource(...previewPath);
    expect(source).toMatch(/if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
    expect(source).toContain("from 'next/navigation'");
  });

  it('n’est jamais lié depuis l’UI de production du hub', () => {
    const files = [...collectFiles('src/features/hub'), ...collectFiles('src/app/hub')];
    const linked = files.filter((file) =>
      fs.readFileSync(path.join(ROOT, file), 'utf8').includes('preparer-sentier/apercu')
    );
    expect(linked).toEqual([]);
  });
});

describe('fix round 1 — reveals INSERT uniquement (UPDATE = écho local)', () => {
  it('shouldRevealArrival : INSERT oui, UPDATE non', () => {
    expect(shouldRevealArrival({ table: 'trip_steps', id: 's1', eventType: 'INSERT' })).toBe(true);
    expect(shouldRevealArrival({ table: 'trip_steps', id: 's1', eventType: 'UPDATE' })).toBe(false);
    expect(shouldRevealArrival({ table: 'trip_checklist_items', id: 'c1', eventType: 'UPDATE' })).toBe(
      false
    );
  });

  it('le portail de reveal filtre avant de consommer l’id (UPDATE ne bloque pas un INSERT futur)', () => {
    const hook = readSource(
      'src',
      'features',
      'hub',
      'components',
      'live',
      'useLiveArrivalReveal.ts'
    );
    const guard = hook.indexOf('if (!shouldRevealArrival(arrival)) continue;');
    const consumed = hook.indexOf('processedRef.current.add(arrival.id)');

    expect(guard).toBeGreaterThan(-1);
    expect(consumed).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(consumed);
  });

  it('le pont transporte eventType (payload realtime → bus window)', () => {
    const bridge = readSource(
      'src',
      'features',
      'hub',
      'components',
      'live',
      'ActivityLiveBridge.tsx'
    );
    expect(bridge).toContain('payload.eventType');
    expect(bridge).toMatch(/eventType === 'UPDATE' \? 'UPDATE' : 'INSERT'/);
    expect(bridge).toMatch(/emitActivityArrival\(payload\.table, String\(id\), eventType/);
    // Fix round final — le bassin est calculé depuis la ligne réelle.
    expect(bridge).toContain('bucketForRow(payload.table, row)');
    expect(bridge).toContain('payload.new');
  });

  it('emitActivityArrival publie { table, id, eventType } sur le bus', () => {
    const dispatch = vi.fn();
    class FakeCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    vi.stubGlobal('window', { dispatchEvent: dispatch });
    vi.stubGlobal('CustomEvent', FakeCustomEvent);

    try {
      emitActivityArrival('trip_checklist_items', 'c1', 'UPDATE');

      expect(dispatch).toHaveBeenCalledTimes(1);
      const event = dispatch.mock.calls[0][0] as { type: string; detail: unknown };
      expect(event.type).toBe(ACTIVITY_ARRIVAL_EVENT);
      expect(event.detail).toEqual({
        table: 'trip_checklist_items',
        id: 'c1',
        eventType: 'UPDATE',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('fix round 1 — wrapper à élément stable (aucun remount au reveal)', () => {
  it('live ou statique : même type d’élément racine, seul l’offset change', () => {
    const live = renderToStaticMarkup(
      React.createElement(LiveArrivalReveal, {
        id: 's1',
        liveIds: new Set(['s1']),
        children: React.createElement('span', null, 'Étape live'),
      })
    );
    const idle = renderToStaticMarkup(
      React.createElement(LiveArrivalReveal, {
        id: 's2',
        liveIds: new Set(['s1']),
        children: React.createElement('span', null, 'Étape statique'),
      })
    );

    expect(live.startsWith('<div')).toBe(true);
    expect(idle.startsWith('<div')).toBe(true);
    expect(live).toContain('data-arrival');
    expect(idle).toContain('data-arrival');
    expect(live).toMatch(/translateY\(8px\)/);
    expect(idle).not.toMatch(/translateY\(8px\)/);
  });

  it('le wrapper rend toujours ArrivalReveal (aucune bascule conditionnelle d’élément)', () => {
    const wrapper = readSource(
      'src',
      'features',
      'hub',
      'components',
      'live',
      'LiveArrivalReveal.tsx'
    );
    expect(wrapper).toContain('<ArrivalReveal active={live}');
    expect(wrapper).not.toMatch(/if \(!live\)/);
    expect(wrapper).not.toMatch(/return <div/);

    const reveal = readSource(
      'src',
      'features',
      'hub',
      'components',
      'live',
      'ArrivalReveal.tsx'
    );
    expect(reveal).toContain('<motion.div data-arrival=""');
    // L'animation porte sur des motion values : jamais de clé conditionnelle.
    expect(reveal).toContain('useMotionValue');
    expect(reveal).not.toMatch(/key=\{/);
  });
});

describe('fix round 1 — kit desktop virtualisé (>50 objets)', () => {
  const kitSource = () =>
    readSource('src', 'features', 'trips', 'components', 'TripKitView.tsx');

  it('accroche le portail de visibilité au parent scrollé du virtualiseur', () => {
    const source = kitSource();
    expect(source).toContain('const setScrollNode');
    expect(source).toMatch(/ref=\{setScrollNode\}/);
    expect(source).toContain('containerRef(node)');
  });

  it('enveloppe le contenu des rangées virtualisées sans toucher au wrapper mesuré', () => {
    const source = kitSource();
    const virtualStart = source.indexOf('function VirtualTripKitItemList');
    expect(virtualStart).toBeGreaterThan(-1);
    const block = source.slice(virtualStart);

    expect(block).toContain('<LiveArrivalReveal');
    // Le wrapper mesuré (position absolue) reste le parent : le reveal est
    // posé à l'intérieur, suivi de la rangée.
    expect(block).toMatch(/position: 'absolute'[\s\S]*?<LiveArrivalReveal[\s\S]*?<TripKitItemRow/);
  });

  it('la branche non virtualisée reste revealée', () => {
    const source = kitSource();
    const nonVirtual = source.slice(
      source.indexOf('<div ref={containerRef} className="divide-y divide-white/40">')
    );
    expect(nonVirtual).toContain('<LiveArrivalReveal');
  });
});
