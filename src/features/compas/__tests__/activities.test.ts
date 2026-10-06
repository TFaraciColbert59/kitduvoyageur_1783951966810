import { describe, expect, it } from 'vitest';
import { COMPAS_ACTIVITIES, parseIntentRules } from '../engine/intent';
import { gearForActivity, keepRuleForActivity, nightsPrefFor } from '../engine/autofill';
import { generateTripContextualKit } from '@/features/trips/engine/contextualKitEngine';
import { activityLabel } from '../engine/format';
import { ACTIVITY_META } from '../components/CompasOuFlows';

const TODAY = '2026-10-05';
const activityOf = (text: string) =>
  parseIntentRules(text, TODAY).find((a) => a.type === 'set_activity') as
    | { type: 'set_activity'; activity: string }
    | undefined;

describe('Tout type de sortie : activités reconnues dans « Dis-le »', () => {
  it.each([
    ['une semaine de vélo en Bretagne', 'cycling'],
    ['bikepacking dans le Jura', 'cycling'],
    ['5 jours de ski de rando à Chamonix', 'ski'],
    ['alpinisme au Mont Rose', 'mountaineering'],
    ['week-end escalade à Fontainebleau', 'climbing'],
    ['via ferrata dans les Écrins', 'climbing'],
    ['kayak dans les gorges de l’Ardèche', 'water'],
    ['10 jours en van en Écosse', 'vanlife'],
    ['city trip à Lisbonne', 'citytrip'],
    ['une semaine à la plage en Crète', 'beach'],
    ['3 jours de rando dans le Vercors', 'hiking'],
  ])('« %s » → %s', (text, expected) => {
    expect(activityOf(text)?.activity).toBe(expected);
  });

  it('chaque activité a un libellé français, une icône et une aide', () => {
    for (const a of COMPAS_ACTIVITIES) {
      expect(activityLabel(a)).not.toMatch(/^[a-z]/);
      expect(ACTIVITY_META[a].icon).toBeTruthy();
      expect(ACTIVITY_META[a].hint).toBeTruthy();
    }
  });
});

describe('Matériel et nuits selon l’activité', () => {
  it('le hors-piste exige DVA, pelle, sonde ; l’alpinisme crampons et piolet', () => {
    const vital = (a: string) => gearForActivity(a).filter((g) => g.vital).map((g) => g.key);
    expect(vital('ski')).toEqual(expect.arrayContaining(['avalanche-transceiver', 'avalanche-shovel', 'avalanche-probe']));
    expect(vital('mountaineering')).toEqual(expect.arrayContaining(['crampons', 'ice-axe', 'harness']));
    expect(vital('water')).toContain('life-jacket');
    expect(vital('cycling')).toContain('bike-helmet');
    expect(gearForActivity('hiking')).toEqual([]);
  });

  it('ville, plage et van : pas de bâtons ni de tente des règles montagne', () => {
    expect(keepRuleForActivity('trekking-poles', 'citytrip')).toBe(false);
    expect(keepRuleForActivity('first-aid', 'beach')).toBe(true);
    expect(keepRuleForActivity('tent-2p', 'vanlife')).toBe(false);
    expect(keepRuleForActivity('crampons', 'mountaineering')).toBe(true);
  });

  it('dort sous un toit par défaut en ville, à la plage, en van, au ski ; la préférence dite prime', () => {
    expect(nightsPrefFor('citytrip', null)).toBe('hebergement');
    expect(nightsPrefFor('ski', 'mixte')).toBe('hebergement');
    expect(nightsPrefFor('ski', 'refuge')).toBe('refuge');
    expect(nightsPrefFor('mountaineering', null)).toBeNull();
  });
});

describe('Kit d’une sortie courte et froid de saison selon le lieu', () => {
  it('quelques heures sans nuit : ni kit de réparation ni thermos', () => {
    expect(keepRuleForActivity('repair-kit', 'hiking', true)).toBe(false);
    expect(keepRuleForActivity('thermos', 'hiking', true)).toBe(false);
    expect(keepRuleForActivity('first-aid', 'hiking', true)).toBe(true);
    expect(keepRuleForActivity('repair-kit', 'hiking')).toBe(true);
  });
  it('gants : pas aux Calanques en octobre, oui dans les Vosges en octobre ou à Marseille en janvier', () => {
    const gloves = (latitude: number, seasonMonth: number, countryCode = 'FR') =>
      [...generateTripContextualKit({ countryCode, activity: 'hiking', durationDays: 1, seasonMonth, latitude }).vitalGaps,
       ...generateTripContextualKit({ countryCode, activity: 'hiking', durationDays: 1, seasonMonth, latitude }).recommendedGaps]
        .some((g) => g.key === 'cold-gloves');
    expect(gloves(43.21, 10)).toBe(false);
    expect(gloves(48.0, 10)).toBe(true);
    expect(gloves(43.21, 1)).toBe(true);
    // Hémisphère sud : juillet est l'hiver en Patagonie, janvier l'été.
    expect(gloves(-50.9, 7, 'AR')).toBe(true);
    expect(gloves(-33.9, 1, 'ZA')).toBe(false);
  });
});
