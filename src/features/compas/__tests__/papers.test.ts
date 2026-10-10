import { describe, expect, it } from 'vitest';
import { keepAiNote, travelPapers } from '../engine/papers';
import { UNKNOWN_TRAVELLER, type TravellerContext } from '../engine/traveller';

const who = (over: Partial<TravellerContext>): TravellerContext => ({ ...UNKNOWN_TRAVELLER, ...over });
const FR = who({ nationality: 'FR' });
const DE = who({ nationality: 'DE', residenceCountry: 'DE', currency: 'EUR' });
const US = who({ nationality: 'US', residenceCountry: 'US', currency: 'USD' });
const NONE = UNKNOWN_TRAVELLER;
const GENERIC = (where: string) =>
  `Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`;

describe('travelPapers — ressortissant français : les règles d’avant le profil, inchangées', () => {
  it('Portugal : carte d’identité, euro, prises européennes', () => {
    const p = travelPapers('PT', 'Portugal', FR);
    expect(p.papers).toBe('carte');
    expect(p.euro).toBe(true);
    expect(p.plugs).toBe('compatibles');
    expect(p.notes).toEqual(['Papiers : carte d’identité ou passeport en cours de validité, sans visa (Portugal).']);
  });

  it('France et outre-mer : rien à dire', () => {
    expect(travelPapers('FR', 'France', FR).notes).toEqual([]);
    expect(travelPapers('RE', 'La Réunion', FR).papers).toBe('domestique');
  });

  it('visa connu : passeport et formalité nommée', () => {
    expect(travelPapers('NP', 'Népal', FR).notes[0]).toBe(
      'Papiers : passeport + visa népalais (30 jours) + permis de trek TIMS, conditions à vérifier sur France Diplomatie avant de partir.'
    );
  });

  it('hors d’Europe sans formalité connue : passeport, à vérifier', () => {
    const p = travelPapers('PE', 'Pérou', FR);
    expect(p.papers).toBe('passeport');
    expect(p.notes[0]).toBe('Papiers : passeport (Pérou), conditions d’entrée à vérifier sur France Diplomatie avant de partir.');
  });

  it('Maroc : passeport même tout près', () => {
    expect(travelPapers('MA', 'Maroc', FR).papers).toBe('passeport');
  });

  it('Europe hors liste sûre (Turquie) : rien d’affirmé, à vérifier', () => {
    const p = travelPapers('TR', 'Turquie', FR);
    expect(p.papers).toBe('a_verifier');
    expect(p.notes[0]).toBe('Papiers : conditions d’entrée (Turquie) à vérifier sur France Diplomatie avant de partir.');
  });

  it('prises différentes : adaptateur annoncé (Royaume-Uni, Irlande, États-Unis)', () => {
    expect(travelPapers('GB', 'Royaume-Uni', FR).notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande', FR).notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('US', 'États-Unis', FR).notes).toContain('Prises de type A/B : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande', FR).euro).toBe(true);
  });

  it('pays inconnu : rien d’affirmé', () => {
    expect(travelPapers(null, null, FR)).toMatchObject({ papers: null, euro: null, plugs: null, notes: [] });
  });
});

describe('travelPapers — nationalité inconnue : rien d’affirmé', () => {
  it('Népal : une ligne honnête, ni passeport, ni visa, ni France Diplomatie', () => {
    const p = travelPapers('NP', 'Népal', NONE);
    expect(p.papers).toBe('a_verifier');
    expect(p.notes).toEqual([GENERIC('Népal')]);
  });

  it('Portugal : aucune carte d’identité ni « sans visa » affirmés', () => {
    expect(travelPapers('PT', 'Portugal', NONE).notes).toEqual([GENERIC('Portugal')]);
  });

  it('France sans départ connu : la même ligne, jamais « rien à dire » supposé', () => {
    expect(travelPapers('FR', 'France', NONE).notes).toEqual([GENERIC('France')]);
  });

  it('départ déjà dans le pays : aucune frontière, rien à dire, et les papiers restent à la règle', () => {
    const p = travelPapers('FR', 'France', NONE, false);
    expect(p).toMatchObject({ papers: 'sur_place', notes: [] });
    expect(keepAiNote('Prends ta carte d’identité.', p)).toBe(false);
  });

  it('« France Diplomatie » n’apparaît jamais', () => {
    for (const cc of ['NP', 'PE', 'TR', 'MA', 'PT', 'US', 'FR'])
      expect(travelPapers(cc, cc, NONE).notes.join(' '), cc).not.toContain('France Diplomatie');
  });

  it('prises : le type du pays, un fait ; jamais « adaptateur à prévoir »', () => {
    const gb = travelPapers('GB', 'Royaume-Uni', NONE);
    expect(gb.notes).toContain('Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.');
    expect(gb.notes.join(' ')).not.toContain('adaptateur');
    expect(travelPapers('PT', 'Portugal', NONE).plugs).toBeNull();
  });
});

describe('travelPapers — autre nationalité connue : aucune règle « ressortissant français »', () => {
  it('Allemand au Népal : la ligne générique', () => {
    expect(travelPapers('NP', 'Népal', DE).notes).toEqual([GENERIC('Népal')]);
  });

  it('dans son propre pays : rien à dire', () => {
    expect(travelPapers('DE', 'Allemagne', DE)).toMatchObject({ papers: 'domestique', notes: [], sameMoney: true });
  });

  it('revenir dans son pays depuis l’étranger franchit une frontière : la ligne générique (US, domicile en France)', () => {
    const us = who({ nationality: 'US', residenceCountry: 'FR' });
    expect(travelPapers('US', 'États-Unis', us, true).notes).toContain(GENERIC('États-Unis'));
    expect(travelPapers('US', 'États-Unis', us, true).papers).toBe('a_verifier');
    // Départ déjà dans le pays, ou départ inconnu : rien à dire.
    for (const abroad of [false, null]) {
      const r = travelPapers('US', 'États-Unis', us, abroad);
      expect(r.papers).toBe('domestique');
      expect(r.notes.filter((n) => n.startsWith('Papiers'))).toEqual([]);
    }
  });

  it('Français résidant au Portugal pour un voyage au Portugal : aucune frontière, aucune ligne de papiers', () => {
    const fr = who({ nationality: 'FR', residenceCountry: 'PT' });
    const r = travelPapers('PT', 'Portugal', fr, false);
    expect(r.papers).toBe('sur_place');
    expect(r.notes.filter((n) => n.startsWith('Papiers'))).toEqual([]);
    // Frontière franchie ou départ inconnu : les papiers français, comme avant.
    expect(travelPapers('PT', 'Portugal', fr, true).notes[0]).toMatch(/^Papiers : carte d’identité/);
    expect(travelPapers('PT', 'Portugal', fr, null).notes[0]).toMatch(/^Papiers : carte d’identité/);
  });

  it('nationalité américaine, résidence en France : l’adaptateur vers le Royaume-Uni est dit', () => {
    expect(travelPapers('GB', 'Royaume-Uni', who({ nationality: 'US', residenceCountry: 'FR' })).notes).toEqual([
      GENERIC('Royaume-Uni'),
      'Prises de type G : adaptateur à prévoir.',
    ]);
  });

  it('Française résidant au Royaume-Uni : papiers français, prises sans affirmation', () => {
    expect(travelPapers('IE', 'Irlande', who({ nationality: 'FR', residenceCountry: 'GB' })).notes).toEqual([
      'Papiers : carte d’identité ou passeport en cours de validité, sans visa (Irlande).',
      'Prises de type G (Irlande) : vérifie que tes chargeurs s’y branchent.',
    ]);
  });
});

describe('keepAiNote — l’IA ne double ni ne contredit une règle', () => {
  it('Portugal, Français : passeport, change et adaptateur écartés, le reste gardé', () => {
    const pt = travelPapers('PT', 'Portugal', FR);
    expect(keepAiNote('Pense à ton passeport valide pour le Portugal.', pt)).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', pt)).toBe(false);
    expect(keepAiNote('Change tes euros en escudos au bureau de change.', pt)).toBe(false);
    expect(keepAiNote('Réserve les nuits de juillet en avance : la côte est très fréquentée.', pt)).toBe(true);
  });

  it('hors zone euro : le change reste un conseil possible', () => {
    const ma = travelPapers('MA', 'Maroc', FR);
    expect(keepAiNote('Retire des dirhams sur place : la monnaie locale ne s’exporte pas.', ma)).toBe(true);
    expect(keepAiNote('Un visa est nécessaire pour le Maroc.', ma)).toBe(false);
  });

  it('les papiers sont toujours dits par la règle, même en France', () => {
    expect(keepAiNote('Prends ta carte d’identité.', travelPapers('FR', 'France', FR))).toBe(false);
  });

  it('« change » au sens courant n’est pas écarté', () => {
    expect(keepAiNote('Prévois des vêtements de rechange pour le soir.', travelPapers('PT', 'Portugal', FR))).toBe(true);
  });

  it('pays inconnu : l’IA n’est pas filtrée', () => {
    expect(keepAiNote('Pense à ton passeport.', travelPapers(null, null, NONE))).toBe(true);
  });

  it('nationalité inconnue : les papiers restent à la règle', () => {
    expect(keepAiNote('Pense à ton passeport.', travelPapers('NP', 'Népal', NONE))).toBe(false);
  });

  it('zone euro, devise connue autre que l’euro : le conseil de change est gardé', () => {
    const note = 'Passe au bureau de change avant le départ : tes francs suisses n’ont pas cours au Portugal.';
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', who({ currency: 'CHF' })))).toBe(true);
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', who({ currency: 'EUR' })))).toBe(false);
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', NONE))).toBe(false);
  });

  it('prises : écartées quand la règle en parle ou les sait compatibles, gardées quand elle ne sait pas', () => {
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('GB', 'Royaume-Uni', NONE))).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('PT', 'Portugal', FR))).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('PT', 'Portugal', US))).toBe(true);
  });
});
