import { describe, it, expect } from 'vitest';
import {
  canCreateItinerary,
  canSwapEnds,
  groupValueLabel,
  initialsOf,
  MAX_AVATARS,
  missingFields,
  missingSummary,
  participantAvatars,
  placeParts,
  ROUTE_SHAPE_OPTIONS,
  shortDateLabel,
} from '../engine/destinationModel';
import { emptyDraft } from '../engine/emptyDraft';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const A_VERIFIER = 'À vérifier';

describe('missingFields — ce qu’il reste à saisir', () => {
  it('DM-01: ne signale rien quand tout est saisi', () => {
    expect(missingFields(fullDraft())).toEqual([]);
  });

  it('DM-02: liste les champs dans l’ordre de l’écran', () => {
    const draft = emptyDraft();
    expect(missingFields(draft).map((field) => field.key)).toEqual([
      'activity',
      'origin',
      'startDate',
      'duration',
    ]);
  });

  it('DM-03: n’exige pas d’arrivée sur une boucle', () => {
    const draft = fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } });
    expect(missingFields(draft).map((field) => field.key)).not.toContain('destination');
  });

  it('DM-04: exige une arrivée distincte en aller simple', () => {
    const draft = fullDraft({
      calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, returnDate: null },
      route: { origin: CHAMONIX, destination: null, shape: 'aller_simple' },
    });
    expect(missingFields(draft).map((field) => field.key)).toContain('destination');
  });

  it('DM-05: une durée nulle ou négative compte comme manquante', () => {
    const zero = fullDraft({
      calendar: { startDate: '2026-07-11', durationDays: 0, durationIsSuggested: false, returnDate: null },
    });
    const negative = fullDraft({
      calendar: { startDate: '2026-07-11', durationDays: -3, durationIsSuggested: false, returnDate: null },
    });
    expect(missingFields(zero).map((f) => f.key)).toContain('duration');
    expect(missingFields(negative).map((f) => f.key)).toContain('duration');
  });
});

describe('canCreateItinerary — la generations a un sens', () => {
  it('DM-06: vrai des que les champs bloquants sont la', () => {
    expect(canCreateItinerary(fullDraft())).toBe(true);
  });

  it('DM-07: faux sans depart', () => {
    const draft = fullDraft({ route: { origin: null, destination: ARGENTIERE, shape: 'aller_simple' } });
    expect(canCreateItinerary(draft)).toBe(false);
  });

  it('DM-08: faux sans duree', () => {
    const draft = fullDraft({
      calendar: { startDate: '2026-07-11', durationDays: null, durationIsSuggested: false, returnDate: null },
    });
    expect(canCreateItinerary(draft)).toBe(false);
  });

  it('DM-09: la date manquante n’empêche PAS de générer', () => {
    const draft = fullDraft({
      calendar: { startDate: null, durationDays: 3, durationIsSuggested: false, returnDate: null },
    });
    expect(canCreateItinerary(draft)).toBe(true);
    expect(missingFields(draft).map((f) => f.key)).toContain('startDate');
  });
});

describe('missingSummary — la ligne d’alerte', () => {
  it('DM-10: énumère les libellés, sans compteur', () => {
    const draft = fullDraft({
      calendar: { startDate: null, durationDays: null, durationIsSuggested: false, returnDate: null },
    });
    expect(missingSummary(draft)).toBe('Il manque : date, temps disponible');
  });

  it('DM-11: disparaît quand plus rien ne manque', () => {
    expect(missingSummary(fullDraft())).toBeNull();
  });
});

describe('placeParts — « Trélon · Place Jean Jaurès »', () => {
  it('DM-12: sépare la commune du détail géocodé', () => {
    const parts = placeParts({
      id: 'p',
      name: 'Trélon, Place Jean Jaurès',
      country: 'France',
      lat: 50.2,
      lon: 3.8,
    });
    expect(parts).toEqual({ primary: 'Trélon', secondary: 'Place Jean Jaurès' });
  });

  it('DM-13: retombe sur le pays quand le libellé est nu', () => {
    expect(placeParts(CHAMONIX)).toEqual({ primary: 'Chamonix', secondary: 'France' });
  });

  it('DM-14: n’ajoute rien quand le libellé se suffit', () => {
    expect(placeParts({ ...CHAMONIX, name: 'Chamonix', country: 'Chamonix' })).toEqual({
      primary: 'Chamonix',
      secondary: null,
    });
  });

  it('DM-15: aucun lieu ne vaut pas un lieu', () => {
    expect(placeParts(null)).toBeNull();
  });

  it('DM-16: un nom vide ne devient pas une chaîne vide', () => {
    expect(placeParts({ ...CHAMONIX, name: '   ' })).toEqual({ primary: A_VERIFIER, secondary: null });
  });
});

describe('shortDateLabel — « Sam. 17 oct. »', () => {
  it('DM-17: abrège jour de semaine et mois', () => {
    expect(shortDateLabel('2026-10-17')).toBe('Sam. 17 oct.');
  });

  it('DM-18: une date absente reste à vérifier', () => {
    expect(shortDateLabel(null)).toBe(A_VERIFIER);
  });

  it('DM-19: une date illisible reste à vérifier, jamais « Invalid Date »', () => {
    expect(shortDateLabel('pas-une-date')).toBe(A_VERIFIER);
  });
});

describe('groupValueLabel — « 4 adultes »', () => {
  it('DM-20: compte les adultes quand il n’y a pas d’enfant', () => {
    expect(groupValueLabel({ mode: 'groupe', adults: 4, children: 0, hasPets: false, knownMembers: [] })).toBe(
      '4 adultes',
    );
  });

  it('DM-21: distingue les enfants quand il y en a', () => {
    expect(groupValueLabel({ mode: 'groupe', adults: 3, children: 1, hasPets: false, knownMembers: [] })).toBe(
      '4 personnes · 3 adultes · 1 enfant',
    );
  });

  it('DM-22: en solo, n’invente pas de groupe', () => {
    expect(groupValueLabel({ mode: 'solo', adults: 1, children: 0, hasPets: false, knownMembers: [] })).toBe(
      'Seul·e',
    );
  });
});

describe('participantAvatars — initiales et honnêteté', () => {
  it('DM-23: une initiale par participant connu', () => {
    const avatars = participantAvatars({
      mode: 'groupe',
      adults: 4,
      children: 0,
      hasPets: false,
      knownMembers: ['Camille', 'Léo', 'Inès', 'Karim'],
    });
    expect(avatars.map((a) => a.initials)).toEqual(['C', 'L', 'I', 'K']);
  });

  it('DM-24: complète avec « +N » plutôt qu’avec des prénoms inventés', () => {
    const avatars = participantAvatars({
      mode: 'groupe',
      adults: 4,
      children: 0,
      hasPets: false,
      knownMembers: ['Camille', 'Léo'],
    });
    expect(avatars.map((a) => a.initials)).toEqual(['C', 'L', '+2']);
  });

  it('DM-25: n’invente aucun prénom quand personne n’est connu', () => {
    const avatars = participantAvatars({
      mode: 'groupe',
      adults: 3,
      children: 0,
      hasPets: false,
      knownMembers: [],
    });
    expect(avatars.map((a) => a.initials)).toEqual(['+3']);
  });

  it('DM-26: la couleur d’une personne ne change pas d’un appel à l’autre', () => {
    const group = { mode: 'groupe', adults: 2, children: 0, hasPets: false, knownMembers: ['Camille'] } as const;
    const first = participantAvatars(group);
    const second = participantAvatars(group);
    expect(first[0].tone).toBe(second[0].tone);
  });

  it('DM-27: n’affiche jamais plus de MAX_AVATARS pastilles', () => {
    const avatars = participantAvatars({
      mode: 'groupe',
      adults: 9,
      children: 0,
      hasPets: false,
      knownMembers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    });
    expect(avatars.length).toBeLessThanOrEqual(MAX_AVATARS + 1);
  });

  it('DM-28: les initiales prennent en compte les prénoms composés', () => {
    expect(initialsOf('Marie Claire')).toBe('MC');
    expect(initialsOf('Jean-Pierre')).toBe('JP');
    expect(initialsOf('Léo')).toBe('L');
  });
});

describe('route shape — boucle contre aller simple', () => {
  it('DM-29: les deux formes sont proposées, en boucle d’abord', () => {
    expect(ROUTE_SHAPE_OPTIONS.map((o) => o.shape)).toEqual(['boucle', 'aller_simple']);
  });

  it('DM-30: on n’inverse qu’un aller simple complet', () => {
    expect(canSwapEnds(fullDraft())).toBe(true);
    expect(canSwapEnds(fullDraft({ route: { ...fullDraft().route, shape: 'boucle' } }))).toBe(false);
    expect(
      canSwapEnds(fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'aller_simple' } })),
    ).toBe(false);
  });
});

describe('invariant — aucune invention', () => {
  it('DM-31: un brouillon vide n’affiche aucun jour ni euro', () => {
    const draft: AdventurePrepDraft = emptyDraft();
    const rendered = [missingSummary(draft), groupValueLabel(draft.group), shortDateLabel(draft.calendar.startDate)]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
    expect(rendered).not.toMatch(/\d+\s*€/);
    expect(rendered).not.toMatch(/\d+\s*km\b/i);
  });
});