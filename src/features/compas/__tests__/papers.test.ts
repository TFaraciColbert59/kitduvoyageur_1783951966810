import { describe, expect, it } from 'vitest';
import { entryRequirementIn, type EntryRequirement, type EntryTable } from '../engine/entry';
import {
  abroadForReader,
  isPapersNote,
  isPlugsNote,
  keepAiNote,
  notesForReader,
  papersFactsFor,
  readerPapersNotes,
  readerPlugsNotes,
  sharedNotes,
  sharedPapersNotes,
  sharedRules,
  travelPapers,
  type PapersFacts,
} from '../engine/papers';
import { UNKNOWN_TRAVELLER, type TravellerContext } from '../engine/traveller';
import { entryRequirement } from '../server/entryRequirements';

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

/**
 * PLAN-100 4.2 : la ligne « Papiers » d'une nationalité connue vient de la table
 * passeport × destination (travelrequirements.info v1.3.0) quand elle a une ligne
 * confirmée ; sinon la ligne des règles d'avant (carte d'identité, France Diplomatie,
 * service officiel du pays).
 */
describe('travelPapers — la table passeport × destination (4.2)', () => {
  const FR_DIPLO = 'à confirmer sur France Diplomatie avant de partir.';
  const OFFICIAL = 'à confirmer auprès du service officiel de ton pays avant de partir.';
  const papersLine = (r: ReturnType<typeof travelPapers>) => r.notes.find((n) => n.startsWith('Papiers')) ?? '';
  const real = (p: string, d: string) => entryRequirement(p, d);

  describe('ressortissant français', () => {
    it('Vietnam : l’exemption de 45 jours remplace l’ancien e-visa, avec la date de vérification', () => {
      const r = travelPapers('VN', 'Vietnam', FR, true, real('FR', 'VN'));
      expect(r.papers).toBe('passeport');
      expect(papersLine(r)).toBe(
        `Papiers : passeport valide, sans visa jusqu’à 45 jours (Vietnam) ; vérifié le 7 octobre 2026, ${FR_DIPLO}`
      );
      expect(r.notes.join(' ')).not.toMatch(/e-visa/);
    });

    it('États-Unis : l’autorisation électronique avant le départ (ESTA), séjour et date de la table', () => {
      const r = travelPapers('US', 'États-Unis', FR, true, real('FR', 'US'));
      expect(r.papers).toBe('visa');
      expect(papersLine(r)).toBe(
        `Papiers : passeport valide, autorisation électronique (ETA/ESTA) à obtenir avant le départ, séjour jusqu’à 90 jours (États-Unis) ; vérifié le 3 octobre 2026, ${FR_DIPLO}`
      );
      expect(r.notes).toContain('Prises de type A/B : adaptateur à prévoir.');
    });

    it('Népal : visa à l’arrivée ; Inde : e-visa ; Iran : visa à demander', () => {
      expect(papersLine(travelPapers('NP', 'Népal', FR, true, real('FR', 'NP')))).toBe(
        `Papiers : passeport valide, visa à l’arrivée (Népal) ; vérifié le 3 octobre 2026, ${FR_DIPLO}`
      );
      expect(papersLine(travelPapers('IN', 'Inde', FR, true, real('FR', 'IN')))).toMatch(
        /^Papiers : passeport valide, e-visa à demander en ligne avant le départ \(Inde\) ; vérifié le \d+(er)? \w+ 2026, à confirmer sur France Diplomatie/
      );
      const ir = travelPapers('IR', 'Iran', FR, true, real('FR', 'IR'));
      expect(ir.papers).toBe('visa');
      expect(papersLine(ir)).toBe(
        `Papiers : passeport valide, visa à demander avant le départ (ambassade ou consulat) (Iran) ; vérifié le 9 octobre 2026, ${FR_DIPLO}`
      );
    });

    it('Turquie (liste « à vérifier » d’avant) : la table la remplace, 90 jours par période de 180', () => {
      const r = travelPapers('TR', 'Turquie', FR, true, real('FR', 'TR'));
      expect(r.papers).toBe('passeport');
      expect(papersLine(r)).toBe(
        `Papiers : passeport valide, sans visa jusqu’à 90 jours par période de 180 jours (Turquie) ; vérifié le 3 octobre 2026, ${FR_DIPLO}`
      );
    });

    it('la carte d’identité en Europe : la table ne la dit pas, la liste interne garde la main', () => {
      for (const cc of ['PT', 'ES', 'CH', 'AL', 'RS', 'MC'])
        expect(papersLine(travelPapers(cc, cc, FR, true, real('FR', cc))), cc).toBe(
          `Papiers : carte d’identité ou passeport en cours de validité, sans visa (${cc}).`
        );
      expect(travelPapers('PT', 'Portugal', FR, true, real('FR', 'PT')).papers).toBe('carte');
    });

    it('France et outre-mer, ou départ déjà dans le pays : rien, même avec une ligne de table', () => {
      expect(travelPapers('FR', 'France', FR, true, real('FR', 'FR'))).toMatchObject({ papers: 'domestique', notes: [] });
      expect(travelPapers('VN', 'Vietnam', FR, false, real('FR', 'VN'))).toMatchObject({ papers: 'sur_place', notes: [] });
    });

    it('« non confirmé » ou pas de ligne : les règles d’avant, texte pour texte', () => {
      const afghanistan = real('FR', 'AF');
      expect(afghanistan?.kind).toBe('non_confirme');
      expect(papersLine(travelPapers('AF', 'Afghanistan', FR, true, afghanistan))).toBe(
        'Papiers : passeport (Afghanistan), conditions d’entrée à vérifier sur France Diplomatie avant de partir.'
      );
      // Népal sans ligne de table : le visa et le permis TIMS du barème, comme avant.
      expect(papersLine(travelPapers('NP', 'Népal', FR, true, null))).toBe(
        'Papiers : passeport + visa népalais (30 jours) + permis de trek TIMS, conditions à vérifier sur France Diplomatie avant de partir.'
      );
      // Gibraltar n'est pas dans le jeu : la liste « Europe à vérifier » reste.
      expect(real('FR', 'GI')).toBeNull();
      const gi = travelPapers('GI', 'Gibraltar', FR, true, real('FR', 'GI'));
      expect(gi.papers).toBe('a_verifier');
      expect(papersLine(gi)).toBe('Papiers : conditions d’entrée (Gibraltar) à vérifier sur France Diplomatie avant de partir.');
    });
  });

  describe('autre nationalité connue', () => {
    it('Allemand au Népal : la ligne de la table, jamais France Diplomatie', () => {
      const r = travelPapers('NP', 'Népal', DE, true, real('DE', 'NP'));
      expect(papersLine(r)).toBe(`Papiers : passeport valide, visa à l’arrivée (Népal) ; vérifié le 3 octobre 2026, ${OFFICIAL}`);
      expect(r.notes.join(' ')).not.toContain('France Diplomatie');
      expect(r.papers).toBe('visa');
    });

    it('Allemand au Portugal : libre circulation, sans carte d’identité affirmée', () => {
      const r = travelPapers('PT', 'Portugal', DE, true, real('DE', 'PT'));
      expect(r.papers).toBe('libre_circulation');
      expect(papersLine(r)).toBe(
        `Papiers : libre circulation, sans visa (Portugal) ; vérifié le 8 octobre 2026, ${OFFICIAL}`
      );
    });

    it('Américain en Turquie, au Royaume-Uni : sans visa 90 jours ; autorisation 180 jours par entrée', () => {
      expect(papersLine(travelPapers('TR', 'Turquie', US, true, real('US', 'TR')))).toBe(
        `Papiers : passeport valide, sans visa jusqu’à 90 jours par période de 180 jours (Turquie) ; vérifié le 3 octobre 2026, ${OFFICIAL}`
      );
      expect(papersLine(travelPapers('GB', 'Royaume-Uni', US, true, real('US', 'GB')))).toMatch(
        /^Papiers : passeport valide, autorisation électronique \(ETA\/ESTA\) à obtenir avant le départ, séjour jusqu’à 180 jours par entrée \(Royaume-Uni\)/
      );
    });

    it('titre spécial et entrée interdite sont dits, et laissent « à vérifier »', () => {
      const cn = travelPapers('CN', 'Chine', who({ nationality: 'HK' }), true, real('HK', 'CN'));
      expect(cn.papers).toBe('visa');
      expect(papersLine(cn)).toMatch(/^Papiers : passeport valide, permis d’entrée spécifique à obtenir avant le départ \(Chine\)/);
      const us = travelPapers('US', 'États-Unis', who({ nationality: 'IR' }), true, real('IR', 'US'));
      expect(us.papers).toBe('a_verifier');
      expect(papersLine(us)).toBe(
        `Papiers : entrée interdite aux détenteurs de ton passeport (États-Unis) ; vérifié le 3 octobre 2026, ${OFFICIAL}`
      );
    });

    it('« non confirmé » ou pas de ligne : la ligne générique d’avant', () => {
      expect(real('DE', 'DJ')?.kind).toBe('non_confirme');
      expect(travelPapers('DJ', 'Djibouti', DE, true, real('DE', 'DJ')).notes).toEqual([GENERIC('Djibouti')]);
      expect(travelPapers('RE', 'La Réunion', DE, true, real('DE', 'RE')).notes).toEqual([GENERIC('La Réunion')]);
      expect(travelPapers('NP', 'Népal', DE, true, null).notes).toEqual([GENERIC('Népal')]);
      expect(travelPapers('NP', 'Népal', DE).notes).toEqual([GENERIC('Népal')]);
    });

    it('une ligne qui date d’un jour inconnu ne casse pas la phrase', () => {
      const odd = { kind: 'sans_visa', maxStayDays: 30, stayWindow: null, verified: 'plus tard' } as EntryRequirement;
      expect(papersLine(travelPapers('MA', 'Maroc', DE, true, odd))).toBe(
        `Papiers : passeport valide, sans visa jusqu’à 30 jours (Maroc), ${OFFICIAL}`
      );
    });
  });

  describe('la table ne dit rien sans nationalité ni frontière', () => {
    it('nationalité inconnue : la ligne honnête, même si on lui passe une ligne', () => {
      expect(travelPapers('VN', 'Vietnam', NONE, true, real('FR', 'VN')).notes).toEqual([GENERIC('Vietnam')]);
    });

    it('dans son propre pays, ou déjà sur place : rien de la table', () => {
      const own = real('US', 'US');
      expect(own?.kind).toBe('libre_circulation');
      const home = travelPapers('US', 'États-Unis', US, null, own);
      expect(home.papers).toBe('domestique');
      expect(home.notes.filter((n) => n.startsWith('Papiers'))).toEqual([]);
      const back = who({ nationality: 'US', residenceCountry: 'FR' });
      expect(travelPapers('US', 'États-Unis', back, true, own).notes).toContain(GENERIC('États-Unis'));
      expect(travelPapers('VN', 'Vietnam', DE, false, real('DE', 'VN'))).toMatchObject({ papers: 'sur_place', notes: [] });
    });

    it('les conseils de l’IA sur les papiers restent écartés, table ou non', () => {
      const r = travelPapers('VN', 'Vietnam', FR, true, real('FR', 'VN'));
      expect(keepAiNote('Un e-visa est nécessaire pour le Vietnam.', r)).toBe(false);
      expect(keepAiNote('Prévois de la monnaie en liquide pour les marchés.', r)).toBe(true);
    });
  });

  describe('sur une table de test', () => {
    const table: EntryTable = { ZZ: [['evisa', 30, null, '2026-10-01', 'FR DE']] };
    it('la même ligne pour deux nationalités, seul le service officiel change', () => {
      const fr = travelPapers('ZZ', 'Zedland', FR, true, entryRequirementIn(table, 'FR', 'ZZ'));
      const de = travelPapers('ZZ', 'Zedland', DE, true, entryRequirementIn(table, 'DE', 'ZZ'));
      expect(papersLine(fr)).toBe(
        'Papiers : passeport valide, e-visa à demander en ligne avant le départ, séjour jusqu’à 30 jours (Zedland) ; vérifié le 1er octobre 2026, à confirmer sur France Diplomatie avant de partir.'
      );
      expect(papersLine(de)).toBe(papersLine(fr).replace('sur France Diplomatie', 'auprès du service officiel de ton pays'));
    });
  });
});

/**
 * PLAN-100 4.2 « keepAiNote ne retire plus les conseils justes pour un non-Français » :
 * les papiers sont décidés par la règle (la table pour une nationalité connue), donc le
 * conseil de l'IA sur les papiers est toujours écarté ; le change et les prises, eux,
 * ne sont écartés que si la règle les dit déjà vrais pour CETTE personne.
 */
describe('keepAiNote — un non-Français garde ses conseils justes', () => {
  const MONEY = 'Retire de la monnaie locale avant de quitter l’aéroport, les distributeurs sont rares.';
  const MONEY_EUR = 'Passe au bureau de change avant le départ : tes dollars n’ont pas cours au Portugal.';
  const PLUG = 'Prévois un adaptateur de prise pour tes chargeurs.';
  const TIP = 'Vérifie les vaccins recommandés pour cette région.';

  it('Allemand (euro) : le change reste un conseil possible hors zone euro, et les conseils de saison sont gardés', () => {
    const ma = travelPapers('MA', 'Maroc', DE, true, entryRequirement('DE', 'MA'));
    expect(keepAiNote(MONEY, ma)).toBe(true);
    expect(keepAiNote(TIP, ma)).toBe(true);
    // Zone euro et même monnaie : la règle le sait, le conseil double.
    expect(keepAiNote(MONEY_EUR, travelPapers('PT', 'Portugal', DE, true, entryRequirement('DE', 'PT')))).toBe(false);
  });

  it('Américain (dollar) au Portugal : le change est gardé, l’adaptateur aussi (la règle ne sait pas)', () => {
    const pt = travelPapers('PT', 'Portugal', US, true, entryRequirement('US', 'PT'));
    expect(keepAiNote(MONEY_EUR, pt)).toBe(true);
    expect(keepAiNote(PLUG, pt)).toBe(true);
  });

  it('Américain au Royaume-Uni : la règle dit déjà le type de prise, l’adaptateur de l’IA est écarté', () => {
    const gb = travelPapers('GB', 'Royaume-Uni', US, true, entryRequirement('US', 'GB'));
    expect(gb.notes).toContain('Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.');
    expect(keepAiNote(PLUG, gb)).toBe(false);
  });

  it('les papiers restent à la règle pour toute nationalité, avec ou sans ligne de table', () => {
    for (const entry of [entryRequirement('DE', 'NP'), null]) {
      const np = travelPapers('NP', 'Népal', DE, true, entry);
      expect(keepAiNote('Il te faut un visa à l’arrivée, prévois 50 dollars en liquide.', np)).toBe(false);
      expect(keepAiNote('Vérifie la validité de ton passeport.', np)).toBe(false);
    }
  });
});

/**
 * VIE PRIVÉE : la ligne « Papiers » dépend de la nationalité, donc le voyage ne garde que la
 * ligne sans nationalité ; celle de la personne qui regarde se rend à la lecture
 * (`papersPrivacy.test.ts` éprouve le chemin entier, ici les règles).
 */
describe('la ligne « Papiers » sur le voyage et pour chaque lecteur', () => {
  const find = (p: string, d: string) => entryRequirement(p, d);
  const MA: PapersFacts = { countryCode: 'MA', country: 'Maroc', abroad: true };
  const GB_LINE =
    'Papiers : passeport valide, sans visa jusqu’à 90 jours (Maroc) ; vérifié le 3 octobre 2026, à confirmer auprès du service officiel de ton pays avant de partir.';
  const DE_LINE =
    'Papiers : passeport valide, sans visa (Maroc) ; vérifié le 3 octobre 2026, à confirmer auprès du service officiel de ton pays avant de partir.';
  // Une note qui ne dépend de personne : elle ne bouge jamais (la ligne « Prises » a ses propres tests plus bas).
  const PLUGS = 'Matériel conseillé non compté au budget : 12 € à la boutique si tu ne l’as pas (facultatif).';

  it('sharedPapersNotes : la ligne d’une nationalité inconnue, jamais la table ni France Diplomatie', () => {
    expect(sharedPapersNotes('MA', 'Maroc', true)).toEqual([GENERIC('Maroc')]);
    expect(sharedPapersNotes('PT', 'Portugal', null)).toEqual([GENERIC('Portugal')]);
    expect(sharedPapersNotes('PT', null, true)).toEqual([GENERIC('PT')]);
    // Aucune frontière, ou pas de pays : rien à ranger. Les prises n'en font pas partie.
    expect(sharedPapersNotes('MA', 'Maroc', false)).toEqual([]);
    expect(sharedPapersNotes(null, null, true)).toEqual([]);
    expect(sharedPapersNotes('GB', 'Royaume-Uni', false)).toEqual([]);
    expect(sharedPapersNotes('GB', 'Royaume-Uni', true).every(isPapersNote)).toBe(true);
  });

  it('readerPapersNotes : la ligne du passeport du lecteur, la table lue pour lui seul', () => {
    expect(readerPapersNotes('MA', 'Maroc', who({ nationality: 'GB' }), true, find)).toEqual([GB_LINE]);
    expect(readerPapersNotes('MA', 'Maroc', who({ nationality: 'DE' }), true, find)).toEqual([DE_LINE]);
    expect(readerPapersNotes('MA', 'Maroc', FR, true, find)[0]).toMatch(/France Diplomatie avant de partir\.$/);
    expect(readerPapersNotes('MA', 'Maroc', NONE, true, find)).toEqual([GENERIC('Maroc')]);
    // Son propre pays : un citoyen y entre de droit.
    expect(readerPapersNotes('MA', 'Maroc', who({ nationality: 'MA' }), null, find)).toEqual([]);
    expect(readerPapersNotes('MA', 'Maroc', who({ nationality: 'GB' }), false, find)).toEqual([]);
  });

  it('notesForReader : seule la ligne « Papiers » change, à sa place', () => {
    const stored = ['Itinéraire gardé.', GENERIC('Maroc'), PLUGS, 'Emporte de l’eau.'];
    expect(notesForReader(stored, MA, who({ nationality: 'GB' }), find)).toEqual(['Itinéraire gardé.', GB_LINE, PLUGS, 'Emporte de l’eau.']);
    expect(notesForReader(stored, MA, who({ nationality: 'DE' }), find)).toEqual(['Itinéraire gardé.', DE_LINE, PLUGS, 'Emporte de l’eau.']);
    expect(notesForReader(stored, MA, NONE, find)).toEqual(stored);
  });

  it('notesForReader : un lecteur qui n’a aucune formalité (son pays) ne voit plus la ligne ; sans ligne rangée, rien n’est ajouté', () => {
    const stored = ['Itinéraire gardé.', GENERIC('Maroc')];
    expect(notesForReader(stored, { ...MA, abroad: null }, who({ nationality: 'MA' }), find)).toEqual(['Itinéraire gardé.']);
    const noLine = ['Itinéraire gardé.', PLUGS];
    expect(notesForReader(noLine, MA, who({ nationality: 'GB' }), find)).toBe(noLine);
    expect(notesForReader([], MA, who({ nationality: 'GB' }), find)).toEqual([]);
  });

  it('notesForReader : une ligne rangée par l’ancienne version (celle d’un autre passeport) n’est jamais rendue telle quelle', () => {
    const legacy = ['Itinéraire gardé.', GB_LINE, PLUGS];
    expect(notesForReader(legacy, MA, who({ nationality: 'DE' }), find)).toEqual(['Itinéraire gardé.', DE_LINE, PLUGS]);
    expect(notesForReader(legacy, MA, NONE, find)).toEqual(['Itinéraire gardé.', GENERIC('Maroc'), PLUGS]);
    // Sans le pays, la ligne est retirée plutôt que devinée.
    expect(notesForReader(legacy, null, who({ nationality: 'DE' }), find)).toEqual(['Itinéraire gardé.', PLUGS]);
  });
});

/**
 * VIE PRIVÉE (lot Z1) : la ligne « Prises » dépend des appareils de la personne (sa résidence,
 * ou sa nationalité française sans résidence dite) : « adaptateur à prévoir » trahit des
 * appareils de France. Le voyage ne garde que la ligne SANS profil ; celle du lecteur se rend
 * à la lecture, comme la ligne « Papiers ».
 */
describe('la ligne « Prises » sur le voyage et pour chaque lecteur', () => {
  const find = (p: string, d: string) => entryRequirement(p, d);
  const GB: PapersFacts = { countryCode: 'GB', country: 'Royaume-Uni', abroad: true };
  const NEUTRAL_G = 'Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.';
  const ADAPTER_G = 'Prises de type G : adaptateur à prévoir.';
  const FR_HOME = who({ residenceCountry: 'FR' });
  const FR_BY_PASSPORT = who({ nationality: 'FR' });
  const US_RESIDENT = who({ nationality: 'US', residenceCountry: 'US' });

  it('isPlugsNote : toute ligne « Prises » des règles, et elle seule', () => {
    expect(isPlugsNote(NEUTRAL_G)).toBe(true);
    expect(isPlugsNote(ADAPTER_G)).toBe(true);
    expect(isPlugsNote(GENERIC('Maroc'))).toBe(false);
    expect(isPlugsNote('Prends des prises multiples.')).toBe(false);
  });

  it('sharedNotes : papiers et prises SANS profil, la même ligne pour tous', () => {
    expect(sharedNotes('GB', 'Royaume-Uni', true)).toEqual([GENERIC('Royaume-Uni'), NEUTRAL_G]);
    expect(sharedNotes('GB', 'Royaume-Uni', null)).toEqual([GENERIC('Royaume-Uni'), NEUTRAL_G]);
    // Départ déjà dans le pays : plus de papiers, mais le fait du pays pour les prises reste.
    expect(sharedNotes('GB', 'Royaume-Uni', false)).toEqual([NEUTRAL_G]);
    // Pays sans prise différente : aucune ligne « Prises ».
    expect(sharedNotes('PT', 'Portugal', true)).toEqual([GENERIC('Portugal')]);
    expect(sharedNotes(null, null, true)).toEqual([]);
    for (const n of sharedNotes('US', 'États-Unis', true)) expect(n).not.toMatch(/adaptateur|France Diplomatie/);
  });

  it('sharedPapersNotes reste la seule ligne « Papiers » de sharedNotes', () => {
    expect(sharedNotes('GB', 'Royaume-Uni', true).filter(isPapersNote)).toEqual(sharedPapersNotes('GB', 'Royaume-Uni', true));
  });

  it('readerPlugsNotes : appareils de France (résidence, ou passeport français sans résidence) → adaptateur ; sinon le fait du pays', () => {
    expect(readerPlugsNotes('GB', 'Royaume-Uni', FR_HOME)).toEqual([ADAPTER_G]);
    expect(readerPlugsNotes('GB', 'Royaume-Uni', FR_BY_PASSPORT)).toEqual([ADAPTER_G]);
    expect(readerPlugsNotes('GB', 'Royaume-Uni', US_RESIDENT)).toEqual([NEUTRAL_G]);
    expect(readerPlugsNotes('GB', 'Royaume-Uni', NONE)).toEqual([NEUTRAL_G]);
    // Française résidant au Royaume-Uni : ses appareils ne sont pas ceux de France.
    expect(readerPlugsNotes('IE', 'Irlande', who({ nationality: 'FR', residenceCountry: 'GB' }))).toEqual([
      'Prises de type G (Irlande) : vérifie que tes chargeurs s’y branchent.',
    ]);
    // Aucune prise différente : rien, pour personne.
    expect(readerPlugsNotes('PT', 'Portugal', FR_HOME)).toEqual([]);
    expect(readerPlugsNotes('PT', 'Portugal', US_RESIDENT)).toEqual([]);
  });

  it('notesForReader : la ligne « Prises » du lecteur remplace la ligne rangée, à sa place', () => {
    const stored = ['Itinéraire gardé.', GENERIC('Royaume-Uni'), NEUTRAL_G, 'Emporte de l’eau.'];
    expect(notesForReader(stored, GB, FR_HOME, find)).toEqual([
      'Itinéraire gardé.',
      readerPapersNotes('GB', 'Royaume-Uni', FR_HOME, true, find)[0],
      ADAPTER_G,
      'Emporte de l’eau.',
    ]);
    expect(notesForReader(stored, GB, US_RESIDENT, find)[2]).toBe(NEUTRAL_G);
    expect(notesForReader(stored, GB, NONE, find)).toEqual(stored);
  });

  it('notesForReader : sans ligne « Papiers » rangée (aucune frontière), la ligne « Prises » est tout de même rendue au lecteur', () => {
    const stored = ['Itinéraire gardé.', NEUTRAL_G];
    expect(notesForReader(stored, { ...GB, abroad: false }, FR_HOME, find)).toEqual(['Itinéraire gardé.', ADAPTER_G]);
    expect(notesForReader(stored, { ...GB, abroad: false }, NONE, find)).toEqual(stored);
  });

  it('notesForReader : une ligne « Prises » rangée avant ce correctif (appareils de France) n’est jamais rendue telle quelle', () => {
    const legacy = ['Itinéraire gardé.', GENERIC('Royaume-Uni'), ADAPTER_G];
    expect(notesForReader(legacy, GB, NONE, find)).toEqual(['Itinéraire gardé.', GENERIC('Royaume-Uni'), NEUTRAL_G]);
    expect(notesForReader(legacy, GB, US_RESIDENT, find)[2]).toBe(NEUTRAL_G);
    // Sans le pays, la ligne est retirée plutôt que devinée.
    expect(notesForReader(legacy, null, US_RESIDENT, find)).toEqual(['Itinéraire gardé.']);
  });

  it('papersFactsFor : le pays dès que le code est valide, même sans aucune ligne « Papiers »', () => {
    expect(papersFactsFor('gb', 'Royaume-Uni', false)).toEqual({ countryCode: 'GB', country: 'Royaume-Uni', abroad: false });
    expect(papersFactsFor('PT', null, null)).toEqual({ countryCode: 'PT', country: null, abroad: null });
    expect(papersFactsFor(null, 'Rien', true)).toBeNull();
    expect(papersFactsFor('Portugal', 'Portugal', true)).toBeNull();
    expect(papersFactsFor('', null, true)).toBeNull();
  });
});

/**
 * VIE PRIVÉE (lot Z1) : un conseil de l'IA rangé sur le voyage est filtré avec les règles du
 * lanceur dans `keepAiNote` (change selon sa devise, prises selon sa résidence) : sa PRÉSENCE
 * trahirait ces champs. Le filtre qui précède le rangement n'a donc aucun profil.
 */
describe('sharedRules — le filtre des conseils de l’IA rangés, sans profil', () => {
  const MONEY_EUR = 'Passe au bureau de change avant le départ : tes francs suisses n’ont pas cours au Portugal.';
  const MONEY_LOCAL = 'Retire de la monnaie locale avant de quitter l’aéroport, les distributeurs sont rares.';
  const PLUG = 'Prévois un adaptateur de prise pour tes chargeurs.';
  const TIP = 'Réserve tes nuits de juillet à l’avance : la côte est très fréquentée.';

  it('zone euro : le change est écarté pour tous (la devise du lanceur ne décide plus), les conseils justes sont gardés', () => {
    const pt = sharedRules('PT', 'Portugal', true);
    expect(pt).toMatchObject({ papers: 'a_verifier', euro: true, sameMoney: null });
    expect(keepAiNote(MONEY_EUR, pt)).toBe(false);
    expect(keepAiNote(TIP, pt)).toBe(true);
    // Un lanceur à la devise connue autre que l'euro garderait ce conseil avec SES règles : c'est la fuite.
    expect(keepAiNote(MONEY_EUR, travelPapers('PT', 'Portugal', who({ currency: 'CHF' })))).toBe(true);
  });

  it('hors zone euro : le change reste un conseil possible, pour tous', () => {
    expect(keepAiNote(MONEY_LOCAL, sharedRules('MA', 'Maroc', true))).toBe(true);
  });

  it('prises : un conseil d’adaptateur n’est jamais rangé (chaque lecteur lit sa ligne), même là où la règle se tait', () => {
    for (const cc of ['GB', 'US', 'PT', 'MA', 'JP'])
      expect(keepAiNote(PLUG, sharedRules(cc, cc, true)), cc).toBe(false);
    // Avec les règles d'une personne aux appareils inconnus, le Portugal laisserait passer ce conseil.
    expect(keepAiNote(PLUG, travelPapers('PT', 'Portugal', NONE))).toBe(true);
  });

  it('les papiers restent à la règle, quel que soit le départ', () => {
    for (const abroad of [true, false, null])
      expect(keepAiNote('Pense à ton passeport valide.', sharedRules('NP', 'Népal', abroad)), String(abroad)).toBe(false);
  });

  it('pays inconnu : l’IA n’est pas filtrée, comme avant', () => {
    expect(keepAiNote(PLUG, sharedRules(null, null, true))).toBe(true);
    expect(keepAiNote('Pense à ton passeport.', sharedRules('Portugal', null, true))).toBe(true);
  });

  it('les mêmes lignes que celles qui se rangent : les règles du voyage, pas celles d’une personne', () => {
    expect(sharedRules('GB', 'Royaume-Uni', null).notes).toEqual(sharedNotes('GB', 'Royaume-Uni', null));
  });
});

/**
 * « À l'étranger » (le pays du départ comparé à la destination) : un fait du voyage seulement si le départ
 * est DIT dans la demande. Pris au domicile ou à la position du lanceur, il ne vaut que pour lui (PR #91).
 */
describe('« à l’étranger » : le départ du lanceur n’est connu que de lui', () => {
  const find = (p: string, d: string) => entryRequirement(p, d);
  const base: PapersFacts = { countryCode: 'MA', country: 'Maroc', abroad: false };
  const fromHome: PapersFacts = { ...base, abroadFrom: 'domicile', launchedBy: 'u1' };
  const fromGps: PapersFacts = { ...base, abroadFrom: 'gps', launchedBy: 'u1' };
  const said: PapersFacts = { ...base, abroadFrom: 'dit' };
  const FR_LINE =
    'Papiers : passeport valide, sans visa (Maroc) ; vérifié le 3 octobre 2026, à confirmer sur France Diplomatie avant de partir.';
  const PLUGS = 'Matériel conseillé non compté au budget : 12 € à la boutique si tu ne l’as pas (facultatif).';

  it('papersFactsFor : la source et le lanceur se rangent pour un départ à soi, pas pour un départ dit ni sans départ', () => {
    expect(papersFactsFor('ma', 'Maroc', false, { from: 'domicile', by: 'u1' })).toEqual(fromHome);
    expect(papersFactsFor('ma', 'Maroc', false, { from: 'gps', by: 'u1' })).toEqual(fromGps);
    expect(papersFactsFor('ma', 'Maroc', false, { from: 'dit', by: 'u1' })).toEqual(said);
    expect(papersFactsFor('ma', 'Maroc', null, { from: null, by: 'u1' })).toEqual({ countryCode: 'MA', country: 'Maroc', abroad: null });
    expect(papersFactsFor('Portugal', 'Portugal', true, { from: 'domicile', by: 'u1' })).toBeNull();
  });

  it('abroadForReader : le lanceur le sait, tout autre lecteur l’ignore, un départ dit vaut pour tous', () => {
    for (const facts of [fromHome, fromGps]) {
      expect(abroadForReader(facts, 'u1')).toBe(false);
      expect(abroadForReader({ ...facts, abroad: true }, 'u1')).toBe(true);
      for (const viewer of ['u2', null, undefined, ''])
        expect(abroadForReader({ ...facts, abroad: true }, viewer), String(viewer)).toBeNull();
      expect(abroadForReader({ ...facts, abroad: false }, 'u2')).toBeNull();
    }
    for (const viewer of ['u1', 'u2', null]) expect(abroadForReader(said, viewer)).toBe(false);
    expect(abroadForReader({ ...fromHome, abroad: null }, 'u1')).toBeNull();
  });

  it('abroadForReader : sans lanceur rangé, personne ne le sait (un domicile sans lanceur n’est à personne)', () => {
    expect(abroadForReader({ ...base, abroadFrom: 'domicile' }, 'u1')).toBeNull();
  });

  it('abroadForReader : un voyage rangé avant la source garde son comportement d’avant (valeur pour tous)', () => {
    expect(abroadForReader(base, 'u2')).toBe(false);
    expect(abroadForReader({ ...base, abroad: true }, null)).toBe(true);
  });

  it('notesForReader : le lanceur vivait dans le pays visité (aucune ligne rangée) ; un autre lecteur reçoit SA ligne, en tête', () => {
    const stored = ['Itinéraire gardé.', PLUGS];
    // Le lanceur : aucune frontière, rien n'est ajouté.
    expect(notesForReader(stored, fromHome, who({ nationality: 'GB' }), find, 'u1')).toBe(stored);
    // Un collaborateur français, un anonyme, quelqu'un sans profil : la frontière est possible pour eux.
    expect(notesForReader(stored, fromHome, FR, find, 'u2')).toEqual([FR_LINE, ...stored]);
    expect(notesForReader(stored, fromHome, NONE, find, null)).toEqual([GENERIC('Maroc'), ...stored]);
    // Même ligne que si le lanceur avait habité à l'étranger (rien ne dit où il habite) : rangée en tête par
    // la préparation (`essential` commence par les lignes « Papiers »), elle est remplacée à sa place.
    const away = [GENERIC('Maroc'), 'Itinéraire gardé.', PLUGS];
    expect(notesForReader(away, { ...fromHome, abroad: true }, FR, find, 'u2')).toEqual([FR_LINE, 'Itinéraire gardé.', PLUGS]);
  });

  it('notesForReader : un départ dit ou un voyage d’avant (ni source ni lanceur) : aucune ligne ajoutée', () => {
    const stored = ['Itinéraire gardé.', PLUGS];
    expect(notesForReader(stored, said, FR, find, 'u2')).toBe(stored);
    expect(notesForReader(stored, base, FR, find, 'u2')).toBe(stored);
  });

  it('notesForReader : sans pays rangé (facts nul), rien n’est inventé', () => {
    const stored = ['Itinéraire gardé.'];
    expect(notesForReader(stored, null, FR, find, 'u2')).toBe(stored);
  });
});
