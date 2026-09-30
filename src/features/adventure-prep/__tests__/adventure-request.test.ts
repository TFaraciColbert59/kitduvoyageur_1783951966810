import { describe, it, expect } from 'vitest';
import {
  ACCEPTED_PLAN_SCHEMA_VERSION,
  blockersBeforeSave,
  buildAcceptedPlan,
  buildAdventureGenerateRequest,
  draftDurationDays,
  draftParticipantsCount,
  draftCoordinates,
  draftText,
  draftWeatherDays,
} from '../adventureRequest';
import { emptyDraft } from '../engine/emptyDraft';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

describe('blockersBeforeSave — ce qui interdit d’enregistrer', () => {
  it('AR-01: ne signale aucun bloqueur sur un brouillon complet', () => {
    expect(blockersBeforeSave(fullDraft())).toEqual([]);
  });

  it('AR-02: signale activité, lieu et date manquants, sans rien inventer', () => {
    const blockers = blockersBeforeSave(emptyDraft());
    expect(blockers).toContain('activité');
    expect(blockers).toContain('lieu de départ');
    expect(blockers).toContain('date');
  });

  it('AR-03: signale uniquement le champ réellement absent', () => {
    const draft = fullDraft({
      calendar: { ...fullDraft().calendar, startDate: '' },
    });
    expect(blockersBeforeSave(draft)).toEqual(['date']);
  });
});

describe('draftCoordinates — uniquement les coordonnées réelles', () => {
  it('AR-10: aller simple renvoie les deux extrémités', () => {
    expect(draftCoordinates(fullDraft())).toEqual([
      { lat: CHAMONIX.lat, lng: CHAMONIX.lon },
      { lat: ARGENTIERE.lat, lng: ARGENTIERE.lon },
    ]);
  });

  it('AR-11: boucle renvoie un point unique, jamais une arrivée inventée', () => {
    const draft = fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } });
    expect(draftCoordinates(draft)).toEqual({ lat: CHAMONIX.lat, lng: CHAMONIX.lon });
  });

  it('AR-12: brouillon sans lieu ne renvoie aucune coordonnée', () => {
    expect(draftCoordinates(emptyDraft())).toBeUndefined();
  });

  it('AR-13: extrémités confondues ne produisent pas de doublon', () => {
    const draft = fullDraft({
      route: { origin: CHAMONIX, destination: CHAMONIX, shape: 'aller_simple' },
    });
    expect(draftCoordinates(draft)).toEqual({ lat: CHAMONIX.lat, lng: CHAMONIX.lon });
  });
});

describe('draftWeatherDays — borne à la plage acceptée par la route', () => {
  it('AR-20: renvoie la durée réelle', () => {
    expect(draftWeatherDays(fullDraft())).toBe(3);
  });

  it('AR-21: borne à 7 jours', () => {
    const draft = fullDraft({
      calendar: { ...fullDraft().calendar, durationDays: 21 },
    });
    expect(draftWeatherDays(draft)).toBe(7);
  });

  it('AR-22: durée absente ou incohérente ne devient pas 1', () => {
    const base = fullDraft().calendar;
    expect(draftWeatherDays(fullDraft({ calendar: { ...base, durationDays: 0 } }))).toBeUndefined();
    expect(
      draftWeatherDays(
        fullDraft({ calendar: { ...base, durationDays: Number.NaN } }),
      ),
    ).toBeUndefined();
  });
});

describe('draftText — ne cite que ce qui est saisi', () => {
  it('AR-30: reprend activité, lieux, date et budget réels', () => {
    const text = draftText(fullDraft());
    expect(text).toContain('Chamonix');
    expect(text).toContain('Argentière');
    expect(text).toContain('2026-07-11');
    expect(text).toContain('90 EUR');
  });

  it('AR-31: n’invente pas d’arrivée absente', () => {
    const draft = fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } });
    const text = draftText(draft);
    expect(text).toContain('en boucle');
    expect(text).not.toContain('Argentière');
  });

  it('AR-32: budget non choisi ne devient pas un montant', () => {
    const draft = fullDraft({
      preferences: { ...fullDraft().preferences, budgetPerPerson: null },
    });
    expect(draftText(draft)).not.toContain('EUR');
  });
});

describe('buildAdventureGenerateRequest — charge utile de la route', () => {
  it('AR-40: produit une requête valide à partir d’un brouillon complet', () => {
    const request = buildAdventureGenerateRequest(fullDraft());
    expect(request.text.length).toBeGreaterThanOrEqual(10);
    expect(request.weatherDays).toBe(3);
    expect(Array.isArray(request.coordinates)).toBe(true);
  });

  it('AR-41: omet les clés absentes plutôt que de les poser à zero', () => {
    const request = buildAdventureGenerateRequest(emptyDraft());
    expect(request).not.toHaveProperty('coordinates');
    expect(request).not.toHaveProperty('weatherDays');
  });

  it('AR-42: brouillon quasi vide produit un texte recevable, pas une chaîne vide', () => {
    const draft: AdventurePrepDraft = emptyDraft();
    const request = buildAdventureGenerateRequest(draft);
    expect(request.text.length).toBeGreaterThanOrEqual(10);
  });
});
describe('Chantier P0 — la durée du voyage n’est pas l’horizon météo', () => {
  const monthLong = () =>
    fullDraft({ calendar: { ...fullDraft().calendar, durationDays: 30 } });

  it('AR-50: un voyage de 30 jours reste un voyage de 30 jours', () => {
    expect(draftDurationDays(monthLong())).toBe(30);
  });

  it('AR-51: la phrase annonce la vraie durée, jamais « sur 7 jours »', () => {
    const text = draftText(monthLong());
    expect(text).toContain('sur 30 jours');
    expect(text).not.toContain('sur 7 jours');
  });

  it('AR-52: seule la météo reste bornée à 7 jours', () => {
    const request = buildAdventureGenerateRequest(monthLong());
    expect(request.weatherDays).toBe(7);
    expect(request.acceptedPlan?.calendar.durationDays).toBe(30);
  });
});

describe('Chantier P0 — le plan accepté voyage intact', () => {
  it('AR-60: le snapshot porte version de contrat, groupe et préférences', () => {
    const plan = buildAcceptedPlan(fullDraft());
    expect(plan.schemaVersion).toBe(ACCEPTED_PLAN_SCHEMA_VERSION);
    expect(plan.group.knownMembers).toEqual(['Camille']);
    expect(plan.preferences.budgetPerPerson).toBe(90);
    expect(plan.route.destination?.name).toBe('Argentière');
  });

  it('AR-61: le sac garde affectations et état préparé, sans inventer de poids', () => {
    const base = fullDraft();
    const draft = fullDraft({
      gear: [
        {
          id: 'trousse',
          name: 'Trousse de secours',
          category: 'safety',
          quantity: 1,
          vital: true,
          requiredFor: ['a_pied'],
          ownerId: 'camille',
          weightGrams: 250,
          packed: false,
        },
      ],
      packedGearIds: ['trousse'],
    });
    const plan = buildAcceptedPlan(draft);
    const trousse = plan.gear.find((item) => item.id === 'trousse');
    expect(trousse).toMatchObject({ ownerId: 'camille', weightGrams: 250, packed: true });
    const eau = plan.gear.find((item) => item.id === 'eau');
    expect(eau?.weightGrams).toBeNull();
    expect(eau?.packed).toBe(false);
    expect(base.packedGearIds).toEqual([]);
  });

  it('AR-62: les étapes gardées sont transmises telles quelles', () => {
    const steps = [
      {
        id: 's1', day: 1, order: 0, kind: 'nuit' as const, title: 'Refuge', placeName: 'Refuge',
        startTime: '18:00', durationMin: null, reason: null,
        price: { amount: null, currency: 'EUR' as const, state: 'a_reserver' as const },
        state: 'a_reserver' as const, kept: true, icon: 'bed', lat: 45.9, lon: 6.9,
      },
    ];
    const draft = fullDraft({
      itinerary: {
        days: 3, steps, totals: { distanceKm: null, movingMin: null, elevGainM: null, elevLossM: null },
        perDay: [], metricsContext: 'terrain',
        budgetPerPerson: { amount: null, currency: 'EUR', state: 'a_reserver' },
        activityCount: 1, contingencies: [],
      },
    });
    const plan = buildAcceptedPlan(draft);
    expect(plan.itinerary?.steps[0]).toEqual(steps[0]);
    expect(plan.itinerary?.days).toBe(3);
  });

  it('AR-63: l’effectif vient du groupe réel, au moins une personne', () => {
    expect(draftParticipantsCount(fullDraft())).toBe(2);
    expect(draftParticipantsCount(emptyDraft())).toBe(1);
    expect(buildAdventureGenerateRequest(fullDraft()).participantsCount).toBe(2);
  });

  it('AR-64: même brouillon, même snapshot (sauvegarde idempotente)', () => {
    expect(buildAcceptedPlan(fullDraft())).toEqual(buildAcceptedPlan(fullDraft()));
  });
});
