/**
 * Plan 4.11 : l'essentiel (sécurité) vient des règles, avec ou sans IA ; l'IA
 * n'ajoute que des suggestions facultatives, dites comme telles, et ne fait
 * jamais tomber un conseil essentiel de la liste.
 */
import { describe, expect, it } from 'vitest';
import { AI_SUGGESTION_PREFIX, aiSuggestion, essentialAdvice, orderNotes, repeatsRule, type AdviceInput } from '../engine/advice';

const base: AdviceInput = {
  activity: 'hiking',
  nights: [],
  maxAltitudeM: 800,
  party: 3,
  startDate: '2026-10-17',
  lat: 45.6,
  countryCode: 'FR',
};

describe('conseils essentiels par règles', () => {
  it('une balade en groupe, à basse altitude, sans nuit : rien à dire', () => {
    expect(essentialAdvice(base)).toEqual([]);
  });

  it('altitude au-dessus de 2 500 m : monter progressivement, redescendre aux signes', () => {
    const notes = essentialAdvice({ ...base, maxAltitudeM: 3200, activity: 'trekking' });
    expect(notes[0]).toMatch(/2 500 m/);
    expect(notes[0]).toMatch(/redescends/);
  });

  it('montagne en hiver : bulletin d’avalanche, le BERA en France, selon l’hémisphère', () => {
    expect(essentialAdvice({ ...base, activity: 'ski', startDate: '2027-02-10' }).join(' ')).toMatch(/BERA/);
    expect(essentialAdvice({ ...base, activity: 'ski', startDate: '2027-02-10', countryCode: 'CH' }).join(' ')).toMatch(
      /bulletin d’avalanche du massif/
    );
    // Février en Patagonie : l'été, pas d'avalanche à annoncer ; juillet : l'hiver.
    const south = { ...base, maxAltitudeM: 1800, lat: -50.9, countryCode: 'AR' };
    expect(essentialAdvice({ ...south, startDate: '2027-02-10' }).join(' ')).not.toMatch(/avalanche/);
    expect(essentialAdvice({ ...south, startDate: '2027-07-10' }).join(' ')).toMatch(/avalanche/);
  });

  it('montagne l’été : orages de l’après-midi', () => {
    expect(essentialAdvice({ ...base, maxAltitudeM: 2100, startDate: '2027-07-14' }).join(' ')).toMatch(/orages/);
  });

  it('seul·e : prévenir un proche ; 112 seulement là où il répond', () => {
    expect(essentialAdvice({ ...base, party: 1 }).join(' ')).toMatch(/112/);
    const nepal = essentialAdvice({ ...base, party: 1, countryCode: 'NP' }).join(' ');
    expect(nepal).not.toMatch(/112/);
    expect(nepal).toMatch(/numéro d’urgence du pays/);
    // Une visite de ville en solo n'appelle pas ce conseil.
    expect(essentialAdvice({ ...base, party: 1, activity: 'citytrip' })).toEqual([]);
  });

  it('refuges et bivouac : réserver, vérifier les règles du lieu, sans inventer d’horaire', () => {
    const notes = essentialAdvice({ ...base, nights: ['refuge', 'bivouac'] });
    expect(notes.some((n) => /refuge/.test(n))).toBe(true);
    const bivouac = notes.find((n) => /Bivouac/.test(n)) ?? '';
    expect(bivouac).toMatch(/vérifie les règles du lieu/);
    expect(bivouac).not.toMatch(/\d+ ?h/);
  });

  it('rivière : gilet et lâchers de barrage', () => {
    expect(essentialAdvice({ ...base, activity: 'water' }).join(' ')).toMatch(/lâchers de barrage/);
  });

  it('trois conseils au plus, le plus grave d’abord', () => {
    const notes = essentialAdvice({
      ...base,
      activity: 'mountaineering',
      maxAltitudeM: 4100,
      startDate: '2027-01-10',
      party: 1,
      nights: ['refuge', 'bivouac'],
    });
    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatch(/2 500 m/);
    expect(notes[1]).toMatch(/avalanche/);
  });
});

describe('suggestions de l’IA', () => {
  it('dites facultatives et venant de l’IA', () => {
    expect(aiSuggestion('Prévois une frontale de secours.')).toBe(`${AI_SUGGESTION_PREFIX}prévois une frontale de secours.`);
  });

  it('une suggestion qui redit un conseil des règles est écartée', () => {
    const rules = essentialAdvice({ ...base, maxAltitudeM: 3000, nights: ['refuge'] });
    expect(repeatsRule('Acclimate-toi par paliers au-dessus de 3 000 m.', rules)).toBe(true);
    expect(repeatsRule('Réserve les refuges dès maintenant, ils sont souvent complets.', rules)).toBe(true);
    expect(repeatsRule('Prends des bâtons pour la descente.', rules)).toBe(false);
    // Sans conseil des règles sur le sujet, l'IA peut en parler.
    expect(repeatsRule('Acclimate-toi par paliers.', [])).toBe(false);
  });

  it('l’essentiel d’abord : la troncature ne fait jamais tomber papiers ni sécurité', () => {
    const essential = ['Passeport valable 6 mois.', 'Au-dessus de 2 500 m, monte progressivement.'];
    const process = Array.from({ length: 10 }, (_, i) => `Étape ${i + 1} de la préparation.`);
    const out = orderNotes(essential, process, [aiSuggestion('Prends des bâtons.')]);
    expect(out).toHaveLength(8);
    expect(out.slice(0, 2)).toEqual(essential);
    expect(out.some((n) => n.startsWith(AI_SUGGESTION_PREFIX))).toBe(false);
    expect(orderNotes(essential, [], [aiSuggestion('Prends des bâtons.')]).at(-1)).toMatch(/^Suggestion de l’IA/);
  });
});
