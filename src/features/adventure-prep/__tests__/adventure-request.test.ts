import { describe, it, expect } from 'vitest';
import {
  blockersBeforeSave,
  buildAdventureGenerateRequest,
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