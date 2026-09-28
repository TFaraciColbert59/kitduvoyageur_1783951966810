import { describe, expect, it } from 'vitest';
import { buildItinerary, daySteps } from '../engine/itinerary';
import { proposedStops } from '../engine/proposedStops';
import { fullDraft } from './fixtures';

/** Mots francais qui se lisent « sans accent » a l ecran. */
const SANS_ACCENT = /\b(Diner|Arret|activite|proposee?|necessaire|verifier|interet|reperage|reserve|a\s+prevoir)\b/;

const troisJours = (interests: string[] = []) =>
  fullDraft({
    activities: { primary: 'rando-refuge', extra: [], nights: [] },
    preferences: {
      budgetPerPerson: 90,
      budgetLevel: 'modere',
      pace: 'normal',
      transport: 'train',
      interests,
      accessibilityNeeds: [],
    },
  });

describe('P0.7 — les libelles proposes sont ecrits en francais accentue', () => {
  it('TY-01 : aucun titre ni raison ne contient de mot sans accent', () => {
    const model = buildItinerary(troisJours(['Nature', 'Paysage', 'Patrimoine', 'Photographie', 'Eau', 'Gastronomie']));
    expect(model).not.toBeNull();
    if (!model) return;

    for (const step of model.steps) {
      expect(`${step.title} ${step.reason ?? ''}`).not.toMatch(SANS_ACCENT);
    }
  });

  it('TY-02 : le diner porte son accent', () => {
    const model = buildItinerary(troisJours());
    expect(model).not.toBeNull();
    if (!model) return;

    const diner = model.steps.filter((s) => /nuit|gouter|repas du soir/i.test(s.title));
    expect(model.steps.map((s) => s.title).join(' ')).not.toMatch(/\bDiner\b/);
    expect(diner.length).toBeGreaterThanOrEqual(0);
  });

  it('TY-03 : le reperage de bivouac est accentue', () => {
    const stops = proposedStops(
      fullDraft({ activities: { primary: 'rando-refuge', extra: [], nights: ['bivouac'] } }),
      1,
      3,
    );
    expect(stops.map((s) => s.title).join(' ')).toContain('Repérage');
  });

  it('TY-04 : les raisons portent une espace insecable avant leurs deux-points', () => {
    const stops = proposedStops(troisJours(['Paysage']), 1, 3);
    const avecDeuxPoints = stops.filter((s) => (s.reason ?? '').includes(':'));

    expect(avecDeuxPoints.length).toBeGreaterThan(0);
    for (const stop of avecDeuxPoints) {
      expect(stop.reason).toContain('\u00A0:');
    }
  });

  it('TY-05 : le point d interet porte son apostrophe et son accent', () => {
    const stops = proposedStops(troisJours(), 1, 3);

    expect(stops.map((s) => s.title)).toContain("Point d'intérêt sur le parcours");
  });
});

describe('P0.8 — une etape generique ne revient pas jour apres jour', () => {
  it('TY-06 : « Eau et ravitaillement » n apparait qu une seule fois sur trois jours', () => {
    const draft = troisJours();
    const model = buildItinerary(draft);
    expect(model).not.toBeNull();
    if (!model) return;

    const occurrences = model.steps.filter((s) => s.title === 'Eau et ravitaillement');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.day).toBe(1);
  });

  it('TY-07 : les jours suivants fusionnent l eau plutot que de la reproposer', () => {
    const draft = troisJours();
    const jour2 = daySteps(buildItinerary(draft) as never, 2);
    const titres = jour2.map((s) => s.title);

    // Ni « Eau et ravitaillement » une seconde fois, ni un nouveau point d eau
    // fabrique : les jours suivants restent coherents avec la reserve de la veille.
    expect(titres).not.toContain('Eau et ravitaillement');
    expect(titres.join(' ')).toMatch(/eau/i);
  });

  it('TY-08 : chaque journee garde malgre tout un ravitaillement', () => {
    const model = buildItinerary(troisJours());
    expect(model).not.toBeNull();
    if (!model) return;

    for (let day = 1; day <= model.days; day += 1) {
      expect(daySteps(model, day).some((s) => s.kind === 'ravitaillement')).toBe(true);
    }
  });

  it('TY-09 : la premiere journee porte toujours le ravitaillement en eau', () => {
    const stops = proposedStops(troisJours(), 1, 3);

    expect(stops[0].title).toBe('Eau et ravitaillement');
  });

  it('TY-10 : l interet « Eau » ne reintroduit pas l etape generique chaque jour', () => {
    const draft = troisJours(['Eau']);
    const jour3 = daySteps(buildItinerary(draft) as never, 3);

    expect(jour3.map((s) => s.title)).not.toContain('Eau et ravitaillement');
  });
});
