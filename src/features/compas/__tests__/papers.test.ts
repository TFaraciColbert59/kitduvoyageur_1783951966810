import { describe, expect, it } from 'vitest';
import { keepAiNote, travelPapers } from '../engine/papers';

describe('travelPapers — papiers, monnaie et prises pour un voyageur français', () => {
  it('Portugal : carte d’identité, euro, prises européennes', () => {
    const p = travelPapers('PT', 'Portugal');
    expect(p.papers).toBe('carte');
    expect(p.euro).toBe(true);
    expect(p.notes).toEqual(['Papiers : carte d’identité ou passeport en cours de validité, sans visa (Portugal).']);
  });

  it('France et outre-mer : rien à dire', () => {
    expect(travelPapers('FR', 'France').notes).toEqual([]);
    expect(travelPapers('RE', 'La Réunion').papers).toBe('domestique');
  });

  it('visa connu : passeport et formalité nommée', () => {
    expect(travelPapers('NP', 'Népal').notes[0]).toBe(
      'Papiers : passeport + visa népalais (30 jours) + permis de trek TIMS, conditions à vérifier sur France Diplomatie avant de partir.'
    );
  });

  it('hors d’Europe sans formalité connue : passeport, à vérifier', () => {
    const p = travelPapers('PE', 'Pérou');
    expect(p.papers).toBe('passeport');
    expect(p.notes[0]).toBe('Papiers : passeport (Pérou), conditions d’entrée à vérifier sur France Diplomatie avant de partir.');
  });

  it('Maroc : passeport même tout près', () => {
    expect(travelPapers('MA', 'Maroc').papers).toBe('passeport');
  });

  it('Europe hors liste sûre (Turquie) : rien d’affirmé, à vérifier', () => {
    const p = travelPapers('TR', 'Turquie');
    expect(p.papers).toBe('a_verifier');
    expect(p.notes[0]).toBe('Papiers : conditions d’entrée (Turquie) à vérifier sur France Diplomatie avant de partir.');
  });

  it('prises différentes : adaptateur annoncé (Royaume-Uni, Irlande, États-Unis)', () => {
    expect(travelPapers('GB', 'Royaume-Uni').notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande').notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('US', 'États-Unis').notes).toContain('Prises de type A/B : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande').euro).toBe(true);
  });

  it('pays inconnu : rien d’affirmé', () => {
    expect(travelPapers(null, null)).toMatchObject({ papers: null, euro: null, notes: [] });
  });
});

describe('keepAiNote — l’IA ne parle ni papiers, ni change en zone euro, ni prises connues', () => {
  it('Portugal : passeport, change et adaptateur écartés, le reste gardé', () => {
    const pt = travelPapers('PT', 'Portugal');
    expect(keepAiNote('Pense à ton passeport valide pour le Portugal.', pt)).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', pt)).toBe(false);
    expect(keepAiNote('Change tes euros en escudos au bureau de change.', pt)).toBe(false);
    expect(keepAiNote('Réserve les nuits de juillet en avance : la côte est très fréquentée.', pt)).toBe(true);
  });

  it('hors zone euro : le change reste un conseil possible', () => {
    const ma = travelPapers('MA', 'Maroc');
    expect(keepAiNote('Retire des dirhams sur place : la monnaie locale ne s’exporte pas.', ma)).toBe(true);
    expect(keepAiNote('Un visa est nécessaire pour le Maroc.', ma)).toBe(false);
  });

  it('les papiers sont toujours dits par la règle, même en France', () => {
    expect(keepAiNote('Prends ta carte d’identité.', travelPapers('FR', 'France'))).toBe(false);
  });

  it('« change » au sens courant n’est pas écarté', () => {
    expect(keepAiNote('Prévois des vêtements de rechange pour le soir.', travelPapers('PT', 'Portugal'))).toBe(true);
  });

  it('pays inconnu : l’IA n’est pas filtrée', () => {
    expect(keepAiNote('Pense à ton passeport.', travelPapers(null, null))).toBe(true);
  });
});
