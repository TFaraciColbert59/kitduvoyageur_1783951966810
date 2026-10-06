import { describe, expect, it } from 'vitest';
import {
  adaptationText,
  expectedKm,
  pickCatalogRoute,
  resolveProjectContext,
  scopeOf,
  type ContextInput,
} from '../engine/projectContext';
import { parseIntentRules, planApplication } from '../engine/intent';
import { planNights } from '../engine/autofill';
import { readCompasMeta } from '../engine/meta';

const base = (over: Partial<ContextInput> = {}): ContextInput => ({
  activity: 'hiking',
  days: 7,
  hours: null,
  partySize: 1,
  month: 7,
  project: null,
  profile: null,
  ...over,
});

const profile = {
  terrain: 'sentier' as const,
  autonomy: 'itinerance_longue' as const,
  priority: 'budget' as const,
  experience: 'debut' as const,
};

describe('Contexte projet : priorité et provenance', () => {
  it('le profil sert de départ, avec sa source', () => {
    const ctx = resolveProjectContext(base({ profile }));
    expect(ctx.level).toEqual({ value: 'debut', source: 'profil' });
    expect(ctx.autonomy.source).toBe('profil');
    expect(ctx.nights).toMatchObject({ value: 'bivouac', source: 'profil' });
    // Débutant sans rythme choisi : étapes plus courtes.
    expect(ctx.pace).toMatchObject({ value: 'tranquille', source: 'profil' });
  });

  it('le projet prime sur le profil', () => {
    const ctx = resolveProjectContext(
      base({ profile, project: { pace: 'soutenu', nights: 'refuge', level: 'aguerri', avoid: [], wishes: [] } })
    );
    expect(ctx.level).toEqual({ value: 'aguerri', source: 'projet' });
    expect(ctx.pace).toEqual({ value: 'soutenu', source: 'projet' });
    expect(ctx.nights).toEqual({ value: 'refuge', source: 'projet' });
  });

  it('la phrase en cours prime sur le projet', () => {
    const ctx = resolveProjectContext(
      base({ project: { pace: 'tranquille', nights: null, avoid: [], wishes: [] }, phrase: { pace: 'soutenu' } })
    );
    expect(ctx.pace).toEqual({ value: 'soutenu', source: 'phrase' });
  });

  it('sans rien de connu : des défauts, dits comme tels', () => {
    const ctx = resolveProjectContext(base());
    expect(ctx.pace).toEqual({ value: 'normal', source: 'defaut' });
    expect(ctx.nights.value).toBeNull();
    expect(ctx.level.value).toBeNull();
  });
});

describe('Contexte projet : adaptation au projet, jamais un preset', () => {
  it('« Je veux courir 1h » : pas de nuit, ni de sac de trek, ni de réservation', () => {
    const ctx = resolveProjectContext(base({ activity: 'running', days: 1, hours: 1, profile }));
    expect(ctx.scope).toBe('sortie');
    expect(ctx.modules).toEqual({ nights: false, transport: false, resa: false, fullPack: false });
    expect(ctx.nights.value).toBeNull();
    // L'itinérance habituelle n'a pas de sens pour une heure : adaptée et dite.
    expect(ctx.autonomy).toMatchObject({ value: 'journee', source: 'defaut' });
    expect(ctx.adaptations.map(adaptationText)[0]).toMatch(
      /^Habituellement tu préfères l’itinérance en autonomie, mais pour ce projet/
    );
  });

  it('profil budget (bivouac) en hiver en altitude : un toit, avec la raison', () => {
    const ctx = resolveProjectContext(base({ profile, month: 1, maxAltitudeM: 2200 }));
    expect(ctx.nights).toMatchObject({ value: 'refuge', source: 'defaut' });
    expect(ctx.adaptations).toEqual([
      expect.objectContaining({ field: 'nights', why: 'nuits d’hiver en altitude' }),
    ]);
  });

  it('un choix du projet n’est jamais adapté en silence', () => {
    const ctx = resolveProjectContext(
      base({ profile, month: 1, maxAltitudeM: 2200, project: { pace: 'normal', nights: 'bivouac', avoid: [], wishes: [] } })
    );
    expect(ctx.nights).toEqual({ value: 'bivouac', source: 'projet' });
    expect(ctx.adaptations).toEqual([]);
  });

  it('« dormir dehors 3 nuits » sur 7 jours : nuits mixtes', () => {
    const ctx = resolveProjectContext(base({ project: { pace: 'normal', nights: null, avoid: [], wishes: [], outdoorNights: 3 } }));
    expect(ctx.nights).toMatchObject({ value: 'mixte', source: 'projet' });
    expect(ctx.outdoorNights).toEqual({ value: 3, source: 'projet' });
  });

  it('une ville, une plage, un van dorment sous un toit par défaut', () => {
    expect(resolveProjectContext(base({ activity: 'citytrip' })).nights.value).toBe('hebergement');
  });

  it('le terrain habituel ne s’impose pas à une activité sans sentier', () => {
    expect(resolveProjectContext(base({ activity: 'beach', profile })).terrain.value).toBeNull();
    expect(resolveProjectContext(base({ activity: 'trekking', profile })).terrain.value).toBe('sentier');
  });

  it('portée : sortie, journée, séjour', () => {
    expect(scopeOf({ activity: 'hiking', days: 1, hours: 3 })).toBe('sortie');
    expect(scopeOf({ activity: 'hiking', days: 1, hours: null })).toBe('journee');
    expect(scopeOf({ activity: 'hiking', days: 7, hours: null })).toBe('sejour');
    expect(scopeOf({ activity: 'trail', days: null, hours: null })).toBe('sortie');
    // « trail de 25 km samedi » : un jour, sans heure dite.
    expect(scopeOf({ activity: 'trail', days: 1, hours: null })).toBe('sortie');
  });
});

describe('Distance attendue et parcours du catalogue', () => {
  it('une heure de course ≈ 9 km ; trail de 20 km dit : 20 km', () => {
    const run = resolveProjectContext(base({ activity: 'running', days: 1, hours: 1 }));
    expect(expectedKm(run, { hours: 1, days: 1, targetKm: null })).toBe(9);
    const trail = resolveProjectContext(base({ activity: 'trail', days: 1, hours: 3 }));
    expect(expectedKm(trail, { hours: 3, days: 1, targetKm: 20 })).toBe(20);
  });

  it('séjour : jours × étape selon rythme et niveau', () => {
    const ctx = resolveProjectContext(base({ days: 5, profile }));
    expect(expectedKm(ctx, { hours: null, days: 5, targetKm: null })).toBe(60);
  });

  it('le parcours qui épouse la distance, pas le premier venu', () => {
    const routes = [
      { route_id: 1, distance_km: 42, distance_from_m: 100 },
      { route_id: 2, distance_km: 11, distance_from_m: 900 },
      { route_id: 3, distance_km: 8, distance_from_m: 300 },
    ];
    expect(pickCatalogRoute(routes, 9)?.route_id).toBe(3);
    expect(pickCatalogRoute(routes, 100)).toBeNull();
    expect(pickCatalogRoute(routes, null)?.route_id).toBe(1);
  });
});

describe('Dis-le : demandes très courtes', () => {
  const today = '2026-10-06';
  it.each([
    ['7 jours en Allemagne', [{ type: 'set_duration', days: 7, hours: null }, { type: 'set_destination', place: 'Allemagne' }]],
    ['je veux dormir dehors 3 nuits', [{ type: 'set_outdoor_nights', nights: 3 }]],
    ['je veux rester sous 12 kg', [{ type: 'set_max_pack', kg: 12 }]],
    ['finalement je veux surtout de la montagne', [{ type: 'set_terrain', terrain: 'montagne' }]],
  ])('%s', (phrase, expected) => {
    expect(parseIntentRules(phrase, today)).toEqual(expected);
  });

  it('« Je veux courir 1h » : course, aujourd’hui, 1 h', () => {
    expect(parseIntentRules('Je veux courir 1h', today)).toEqual([
      { type: 'set_dates', start: today, end: null },
      { type: 'set_duration', days: null, hours: 1 },
      { type: 'set_activity', activity: 'running' },
    ]);
  });

  it('« trail de 20 km dimanche » : trail, dimanche, 20 km visés', () => {
    expect(parseIntentRules('trail de 20 km dimanche', today)).toEqual([
      { type: 'set_dates', start: '2026-10-11', end: null },
      { type: 'set_distance', km: 20 },
      { type: 'set_activity', activity: 'trail' },
    ]);
  });

  it('« randonnée 3h cet après-midi » : aujourd’hui', () => {
    expect(parseIntentRules('randonnée 3h cet après-midi', today)[0]).toEqual({
      type: 'set_dates',
      start: today,
      end: null,
    });
  });

  it('les contraintes deviennent des réglages du projet', () => {
    const ops = planApplication(
      [
        { type: 'set_outdoor_nights', nights: 3 },
        { type: 'set_max_pack', kg: 12 },
        { type: 'set_terrain', terrain: 'montagne' },
      ],
      {
        startDate: null,
        endDate: null,
        days: null,
        shortHours: null,
        preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
        hasRoute: false,
      }
    );
    expect(ops).toEqual([
      // Projet sans durée : 3 nuits dehors = 4 jours.
      { op: 'span', days: 4 },
      {
        op: 'prefs',
        preferences: { pace: 'normal', nights: null, avoid: [], wishes: [], outdoorNights: 3, maxPackKg: 12, terrain: 'montagne' },
      },
    ]);
  });

  it('les réglages du projet se relisent, une valeur illisible est ignorée', () => {
    const meta = readCompasMeta({
      compas: { prefs: { pace: 'normal', outdoorNights: 3, maxPackKg: 99, level: 'expert' } },
    });
    expect(meta.preferences).toMatchObject({ outdoorNights: 3, maxPackKg: null, level: null });
  });
});

describe('Nuits : « dormir dehors » prime', () => {
  it('3 nuits dehors sur 6 : d’abord là où aucun refuge n’est connu', () => {
    const plan = planNights({
      nights: 6,
      pref: 'mixte',
      autonomy: null,
      priority: null,
      maxAltitudeM: null,
      refugeNear: [true, false, true, false, true, false],
      outdoorNights: 3,
    });
    expect(plan.filter((n) => n.type === 'bivouac').map((n) => n.night)).toEqual([2, 4, 6]);
    expect(plan.filter((n) => n.type !== 'bivouac').every((n) => n.type === 'refuge')).toBe(true);
  });
});

describe('Nuits dehors sans durée : la durée s’en déduit', () => {
  const blank = {
    startDate: null,
    endDate: null,
    days: null,
    shortHours: null,
    preferences: { pace: 'normal' as const, nights: null, avoid: [], wishes: [] },
    hasRoute: false,
  };
  it('« 3 nuits sous tente en Ardèche » : 4 jours', () => {
    const ops = planApplication(parseIntentRules('3 nuits sous tente en Ardèche', '2026-10-06'), blank);
    expect(ops).toContainEqual({ op: 'span', days: 4 });
  });
  it('un projet de 7 jours garde sa durée', () => {
    const ops = planApplication([{ type: 'set_outdoor_nights', nights: 3 }], { ...blank, days: 7, startDate: '2027-07-01', endDate: '2027-07-07' });
    expect(ops.some((o) => o.op === 'span' || o.op === 'dates')).toBe(false);
  });
});
