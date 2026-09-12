import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * T9 — Socle animations live (§4.5) : bus realtime, reveal, compteur,
 * squelettes pré-formés. Les composants sont rendus en markup statique
 * (pattern tests/materiel/mobile-vital-alert.spec.ts) ; framer-motion est
 * réel sauf `useReducedMotion`, piloté par le harnais de test.
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
  ACTIVITY_ARRIVAL_EVENT,
  countArrivals,
  createArrivalState,
  derivePreparationPhase,
  isActivityArrival,
  recordActivityArrival,
  type ActivityArrivalCounts,
} from '@/features/hub/components/live/useActivityLiveArrivals';
import {
  ArrivalReveal,
  arrivalDelay,
  arrivalInitial,
} from '@/features/hub/components/live/ArrivalReveal';
import {
  AnimatedNumber,
  formatAnimatedNumber,
} from '@/features/hub/components/live/AnimatedNumber';
import { ActivitySectionSkeleton } from '@/features/hub/components/live/ActivitySectionSkeleton';
import ActivityLiveBridge from '@/features/hub/components/live/ActivityLiveBridge';

function counts(partial: Partial<ActivityArrivalCounts>): ActivityArrivalCounts {
  return { steps: 0, moments: 0, affiliation: 0, kit: 0, ...partial };
}

/** Garde-fou source (env node sans DOM) pour les invariants d'effet. */
function readLiveSource(file: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'hub', 'components', 'live', file),
    'utf8'
  );
}

beforeEach(() => {
  motionControl.reduced = false;
});

describe('derivePreparationPhase — seuils exacts', () => {
  it('waiting tant qu’aucune arrivée n’est enregistrée', () => {
    expect(derivePreparationPhase(counts({}))).toBe('waiting');
  });

  it('itinerary dès la première étape', () => {
    expect(derivePreparationPhase(counts({ steps: 1 }))).toBe('itinerary');
  });

  it('moments dès le premier POI (étapes déjà là)', () => {
    expect(derivePreparationPhase(counts({ steps: 2, moments: 1 }))).toBe('moments');
  });

  it('affiliation dès la première dépense (étapes + POI déjà là)', () => {
    expect(derivePreparationPhase(counts({ steps: 2, moments: 1, affiliation: 3 }))).toBe(
      'affiliation'
    );
  });

  it('done quand les quatre bassins ont au moins une arrivée', () => {
    expect(derivePreparationPhase(counts({ steps: 1, moments: 1, affiliation: 1, kit: 1 }))).toBe(
      'done'
    );
  });

  it('kit en cas d’arrivée hors ordre (kit avant affiliation)', () => {
    expect(derivePreparationPhase(counts({ steps: 1, moments: 1, kit: 1 }))).toBe('kit');
  });
});

describe('bus d’arrivées — comptage et déduplication', () => {
  it('countArrivals mappe les tables réelles vers les bassins du rail', () => {
    const result = countArrivals([
      { table: 'trip_steps', id: 's1' },
      { table: 'trip_steps', id: 's2' },
      { table: 'trip_pois', id: 'p1' },
      { table: 'trip_expenses', id: 'e1' },
      { table: 'trip_items', id: 'i1' },
      { table: 'trip_checklist_items', id: 'c1' },
      { table: 'trip_notes', id: 'n1' },
    ]);

    expect(result).toEqual({ steps: 2, moments: 1, affiliation: 1, kit: 2 });
  });

  it('ignore un id déjà vu (non ré-émis : même état, pas de doublon)', () => {
    const initial = createArrivalState();
    const once = recordActivityArrival(initial, { table: 'trip_steps', id: 's1' });
    const twice = recordActivityArrival(once, { table: 'trip_steps', id: 's1' });

    expect(once.arrivals).toHaveLength(1);
    expect(twice).toBe(once);
    expect(twice.arrivals).toHaveLength(1);
  });

  it('accepte le même id sur une autre table (clé table:id)', () => {
    const once = recordActivityArrival(createArrivalState(), { table: 'trip_steps', id: 'x1' });
    const cross = recordActivityArrival(once, { table: 'trip_pois', id: 'x1' });

    expect(cross.arrivals).toHaveLength(2);
  });

  it('isActivityArrival rejette les détails malformés', () => {
    expect(isActivityArrival({ table: 'trip_steps', id: 's1' })).toBe(true);
    expect(isActivityArrival({ table: 'trip_steps' })).toBe(false);
    expect(isActivityArrival({ table: '', id: '' })).toBe(false);
    expect(isActivityArrival(null)).toBe(false);
    expect(isActivityArrival('trip_steps')).toBe(false);
  });

  it('expose le nom d’événement du bus window', () => {
    expect(ACTIVITY_ARRIVAL_EVENT).toBe('lkdv:activity-arrival');
  });
});

describe('ActivityLiveBridge', () => {
  it('ne rend rien (composant invisible monté dans le hub)', () => {
    const html = renderToStaticMarkup(React.createElement(ActivityLiveBridge, { tripId: 't1' }));
    expect(html).toBe('');
  });

  it('garde d’entrée : aucun canal ni forward tant qu’aucun trip actif', () => {
    const source = readLiveSource('ActivityLiveBridge.tsx');
    const guard = /if\s*\(!tripId\)\s*return;/.exec(source);

    expect(guard).not.toBeNull();
    const channelIndex = source.indexOf("supabase.channel('hub-live-bridge')");
    const forwardIndex = source.indexOf('const forward =');
    expect(channelIndex).toBeGreaterThan(guard!.index);
    expect(forwardIndex).toBeGreaterThan(guard!.index);
    // Le filtre trip_id est désormais inconditionnel dans la portée gardée.
    expect(source).not.toMatch(/tripId\s*\?[^\n]*undefined/);
  });
});

describe('ArrivalReveal — reveal canonique', () => {
  it('porte data-arrival et démarre sur l’offset canonique (opacity 0, y 8)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ArrivalReveal, {
        index: 0,
        children: React.createElement('span', null, 'Étape J1'),
      })
    );

    expect(html).toContain('data-arrival');
    expect(html).toContain('Étape J1');
    expect(html).toMatch(/opacity:\s*0/);
    expect(html).toMatch(/translateY\(8px\)/);
  });

  it('applique le stagger plafonné à 0,3 s', () => {
    expect(arrivalDelay(0, false)).toBe(0);
    expect(arrivalDelay(1, false)).toBeCloseTo(0.04);
    expect(arrivalDelay(100, false)).toBe(0.3);
    expect(arrivalDelay(-2, false)).toBe(0);
  });

  it('n’anime qu’une fois : initial=false après le premier cycle', () => {
    expect(arrivalInitial(false, false)).toEqual({ opacity: 0, y: 8 });
    expect(arrivalInitial(true, false)).toBe(false);
  });

  it('useReducedMotion → aucun offset ni délai', () => {
    motionControl.reduced = true;
    const html = renderToStaticMarkup(
      React.createElement(ArrivalReveal, {
        index: 5,
        children: React.createElement('span', null, 'Étape J2'),
      })
    );

    expect(arrivalInitial(false, true)).toBe(false);
    expect(arrivalDelay(5, true)).toBe(0);
    expect(html).not.toMatch(/translateY\(8px\)/);
  });
});

describe('AnimatedNumber — compteur tabulaire', () => {
  it('rend la valeur initiale en chiffres tabulaires', () => {
    const html = renderToStaticMarkup(React.createElement(AnimatedNumber, { value: 42 }));

    expect(html).toContain('tabular-nums');
    expect(html).toContain('>42<');
  });

  it('respecte decimals', () => {
    expect(formatAnimatedNumber(3.14159, 2)).toBe('3.14');
    const html = renderToStaticMarkup(
      React.createElement(AnimatedNumber, { value: 3.14159, decimals: 2 })
    );

    expect(html).toContain('>3.14<');
  });

  it('reduced-motion → valeur statique', () => {
    motionControl.reduced = true;
    const html = renderToStaticMarkup(React.createElement(AnimatedNumber, { value: 7 }));

    expect(html).toContain('tabular-nums');
    expect(html).toContain('>7<');
  });

  it('enfants constants : le JSX ne rend jamais la prop value en direct (anti-flash)', () => {
    const source = readLiveSource('AnimatedNumber.tsx');

    // Valeur initiale capturée une seule fois (useState) et rendue telle quelle.
    expect(source).toMatch(/const \[initialText\] = useState\(/);
    expect(source).toMatch(/\{initialText\}/);
    expect(source).not.toMatch(/\{formatAnimatedNumber\(value/);
  });
});

describe('ActivitySectionSkeleton — dimensions exactes, zéro CLS', () => {
  const variants = ['timeline', 'moments', 'affiliate', 'kit'] as const;
  const expectedItems: Record<(typeof variants)[number], number> = {
    timeline: 3,
    moments: 3,
    affiliate: 2,
    kit: 2,
  };

  for (const variant of variants) {
    it(`variante ${variant} : aria-hidden, shimmer CSS et ${expectedItems[variant]} éléments`, () => {
      const html = renderToStaticMarkup(React.createElement(ActivitySectionSkeleton, { variant }));

      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(`data-skeleton="${variant}"`);
      expect(html).toContain('motion-reduce:animate-none');
      expect((html.match(/data-skeleton-item/g) ?? []).length).toBe(expectedItems[variant]);
    });
  }
});
