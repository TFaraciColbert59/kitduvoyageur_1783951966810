/**
 * Le curseur d'echelle : mathematique pure + contrat ARIA.
 *
 * Aucun navigateur n'est requis : la logique de deplacement est isolee dans
 * rulerMath.ts, et ScaleRuler n'est verifie que sur ses attributs d'accessibilite.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  H_MAX,
  H_MIN,
  ZONES,
  hoursFromT,
  tAtZoneMiddle,
  tForZone,
  zoneForT,
} from '@/features/trajectoire/domain/scaleAxis';
import { ScaleRuler } from '@/features/trajectoire/ui/ScaleRuler';
import {
  ARROW_STEP,
  RULER_TICKS,
  rulerKeyAction,
  tFromPointer,
  tickPercent,
} from '@/features/trajectoire/ui/rulerMath';

function move(key: string, t: number): number {
  const action = rulerKeyAction(key, t);
  if (action.type !== 'set') throw new Error(`${key} should move the cursor`);
  return action.t;
}

describe('rulerMath - contrat clavier WAI-ARIA', () => {
  it('traite les quatre fleches comme un pas borne', () => {
    const start = tForZone('expedition');
    expect(move('ArrowRight', start)).toBeCloseTo(Math.min(1, start + ARROW_STEP), 10);
    expect(move('ArrowUp', start)).toBeCloseTo(Math.min(1, start + ARROW_STEP), 10);
    expect(move('ArrowLeft', start)).toBeCloseTo(Math.max(0, start - ARROW_STEP), 10);
    expect(move('ArrowDown', start)).toBeCloseTo(Math.max(0, start - ARROW_STEP), 10);
  });

  it('ne depasse jamais les bornes 1 h - 720 h', () => {
    expect(hoursFromT(move('ArrowRight', 1))).toBe(H_MAX);
    expect(hoursFromT(move('ArrowLeft', 0))).toBe(H_MIN);
  });

  it('Home et End vont aux extremites absolues', () => {
    expect(hoursFromT(move('Home', 0.4))).toBe(H_MIN);
    expect(hoursFromT(move('End', 0.4))).toBe(H_MAX);
  });

  it('Page Up et Page Down sautent d une zone entiere', () => {
    const start = tAtZoneMiddle('journee');
    const next = zoneForT(move('PageUp', start));
    const prev = zoneForT(move('PageDown', move('PageUp', start)));
    expect(next.id).not.toBe('journee');
    expect(prev.id).toBe('journee');
  });

  it('Page Up sature sur la derniere zone, Page Down sur la premiere', () => {
    expect(zoneForT(move('PageUp', tAtZoneMiddle('monde'))).id).toBe('monde');
    expect(zoneForT(move('PageDown', tAtZoneMiddle('run'))).id).toBe('run');
  });

  it('laisse le navigateur gerer les touches non gerees (tabulation)', () => {
    expect(rulerKeyAction('Tab', 0.4)).toEqual({ type: 'none' });
    expect(rulerKeyAction('a', 0.4)).toEqual({ type: 'none' });
  });

  it('convertit un pointeur en position, avec bords bornes', () => {
    expect(tFromPointer(0, 0, 400)).toBe(0);
    expect(tFromPointer(400, 0, 400)).toBe(1);
    expect(tFromPointer(200, 0, 400)).toBeCloseTo(0.5, 10);
    expect(tFromPointer(-80, 0, 400)).toBe(0);
    expect(tFromPointer(9999, 0, 400)).toBe(1);
    expect(tFromPointer(10, 0, 0)).toBe(0);
  });
});

describe('rulerMath - graduations', () => {
  it('pose 7 reperes croissants du plus petit au plus grand', () => {
    expect(RULER_TICKS).toHaveLength(7);
    const percents = RULER_TICKS.map((tick) => tickPercent(tick.hours));
    for (let i = 1; i < percents.length; i += 1) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1]);
    }
    expect(percents[0]).toBeCloseTo(0, 6);
    expect(percents[percents.length - 1]).toBeCloseTo(100, 6);
  });

  it('chaque zone du moteur est atteignable par un clic de puce', () => {
    for (const zone of ZONES) {
      expect(zoneForT(tAtZoneMiddle(zone.id)).id).toBe(zone.id);
    }
  });
});

describe('ScaleRuler - rendu accessible', () => {
  it('expose le contrat ARIA slider complet', () => {
    const t = tForZone('expedition');
    const html = renderToStaticMarkup(
      <ScaleRuler t={t} hours={120} zoneLabel="Expédition" onChange={() => {}} />
    );

    expect(html).toContain('role="slider"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(`aria-valuemin="${H_MIN}"`);
    expect(html).toContain(`aria-valuemax="${H_MAX}"`);
    expect(html).toContain('aria-valuenow="120"');
    // aria-valuetext porte l'echelle ET la zone : c'est ce que lit l'ecran.
    // La duree passe par `describeDuration`, donc « 120 heures (5 jours) » et
    // non ? 1 heures ? : l'ecran lit la meme chose que l'affichage visuel.
    expect(html).toContain('aria-valuetext="120 heures (5 jours), Expédition"');
    expect(html).toContain('aria-orientation="horizontal"');
  });

  it('reste atteignable au clavier et expose une cible tactile de 44 px', () => {
    const html = renderToStaticMarkup(
      <ScaleRuler t={0.5} hours={24} zoneLabel="Journée" onChange={() => {}} />
    );
    expect(html).toContain('tabindex="0"');
    // La piste porte la hauteur tactile ; le CSS la fixe a --lkv-touch-min.
    expect(html).toContain('tj-ruler__track');
    expect(html).toContain('tj-ruler__thumb');
  });
});
