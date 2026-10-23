import { describe, expect, it } from 'vitest';
import {
  REST_AFTER_NIGHTS,
  acclimatisationNote,
  checkSummitDay,
  type SummitDayFinding,
} from '../engine/acclimatisation';

/**
 * Plan 4.5, reste « alpinisme sur base » : une course part d'une base (refuge,
 * village) vers un sommet qui n'est pas une étape. On dort à la base : le
 * dénivelé de la course n'est PAS un dénivelé de couchage (la règle des 500 m
 * ne s'y applique pas). Mais monter haut dans la journée sans acclimatation
 * reste un risque (« climb high, sleep low ») : une note prudente, un repère,
 * jamais un diagnostic. L'altitude du sommet vient de l'utilisateur : jamais devinée.
 */

describe('checkSummitDay — sommet atteint dans la journée depuis une base', () => {
  it('sommet haut, aucune nuit préalable au-dessus de 2 500 m : un repère', () => {
    const f = checkSummitDay({ baseM: 1035, summitM: 3842, nightsAbove2500: 0 });
    expect(f).toEqual({
      kind: 'summit',
      summitM: 3842,
      baseM: 1035,
      dayGainM: 2807,
      nightsAbove2500: 0,
    });
  });

  it('base inconnue : la note reste possible, sans dénivelé inventé', () => {
    const f = checkSummitDay({ baseM: null, summitM: 3842, nightsAbove2500: 0 });
    expect(f).toEqual({
      kind: 'summit',
      summitM: 3842,
      baseM: null,
      dayGainM: null,
      nightsAbove2500: 0,
    });
  });

  it('CAS LIMITE — sommet inconnu : aucune note (jamais deviné)', () => {
    expect(checkSummitDay({ baseM: 1035, summitM: null, nightsAbove2500: 0 })).toBeNull();
    expect(checkSummitDay({ baseM: 1035, summitM: undefined, nightsAbove2500: 0 })).toBeNull();
    expect(checkSummitDay({ baseM: 1035, summitM: Number.NaN, nightsAbove2500: 0 })).toBeNull();
    expect(
      checkSummitDay({ baseM: 1035, summitM: Number.POSITIVE_INFINITY, nightsAbove2500: 0 })
    ).toBeNull();
  });

  it('CAS LIMITE — nuits déjà passées inconnues : aucune note (on ne suppose pas « sans acclimatation »)', () => {
    expect(checkSummitDay({ baseM: 1035, summitM: 3842, nightsAbove2500: null })).toBeNull();
    expect(checkSummitDay({ baseM: 1035, summitM: 3842, nightsAbove2500: Number.NaN })).toBeNull();
    expect(checkSummitDay({ baseM: 1035, summitM: 3842, nightsAbove2500: -1 })).toBeNull();
  });

  it('CONTRE-EXEMPLE — sommet sous 2 500 m : rien', () => {
    expect(checkSummitDay({ baseM: 800, summitM: 2499, nightsAbove2500: 0 })).toBeNull();
    expect(checkSummitDay({ baseM: null, summitM: 1800, nightsAbove2500: 0 })).toBeNull();
  });

  it('2 500 m pile : la règle s’applique (« au-dessus de 2 500 m » inclut le seuil, comme pour les nuits)', () => {
    expect(checkSummitDay({ baseM: 1500, summitM: 2500, nightsAbove2500: 0 })).not.toBeNull();
  });

  it('CONTRE-EXEMPLE — acclimaté : après assez de nuits au-dessus de 2 500 m, aucune note', () => {
    expect(
      checkSummitDay({ baseM: 2800, summitM: 4200, nightsAbove2500: REST_AFTER_NIGHTS })
    ).toBeNull();
    expect(
      checkSummitDay({ baseM: 2800, summitM: 4200, nightsAbove2500: REST_AFTER_NIGHTS + 5 })
    ).toBeNull();
  });

  it('acclimatation partielle (moins de nuits que le repère) : la note reste, nombre de nuits dit', () => {
    const f = checkSummitDay({
      baseM: 2800,
      summitM: 4200,
      nightsAbove2500: REST_AFTER_NIGHTS - 1,
    });
    expect(f?.nightsAbove2500).toBe(REST_AFTER_NIGHTS - 1);
  });

  it('CAS LIMITE — sommet pas plus haut que la base : pas une montée, rien', () => {
    expect(checkSummitDay({ baseM: 3000, summitM: 3000, nightsAbove2500: 0 })).toBeNull();
    expect(checkSummitDay({ baseM: 3200, summitM: 3000, nightsAbove2500: 0 })).toBeNull();
  });

  it('base non finie : traitée comme inconnue, jamais comme 0 m', () => {
    const f = checkSummitDay({ baseM: Number.NaN, summitM: 3842, nightsAbove2500: 0 });
    expect(f?.baseM).toBeNull();
    expect(f?.dayGainM).toBeNull();
  });

  it('CAS LIMITE — altitude de sommet impossible sur Terre (> 8 849 m ou ≤ 0) : refusée, aucune note', () => {
    expect(checkSummitDay({ baseM: 1000, summitM: 12000, nightsAbove2500: 0 })).toBeNull();
    expect(checkSummitDay({ baseM: null, summitM: -5, nightsAbove2500: 0 })).toBeNull();
  });
});

describe('acclimatisationNote — avec un jour de sommet', () => {
  const summit = checkSummitDay({
    baseM: 1035,
    summitM: 3842,
    nightsAbove2500: 0,
  }) as SummitDayFinding;

  it('sans sommet donné, le résultat est STRICTEMENT celui d’avant', () => {
    const inputs = [
      { maxAltitudeM: null, findings: [] },
      { maxAltitudeM: 1800, findings: [] },
      { maxAltitudeM: 3400, findings: [] },
      {
        maxAltitudeM: 3400,
        findings: [{ kind: 'gain' as const, day: 2, fromM: 1200, toM: 3400, gainM: 2200 }],
      },
    ];
    for (const i of inputs) {
      expect(acclimatisationNote({ ...i, summits: [] })).toBe(acclimatisationNote(i));
      expect(acclimatisationNote({ ...i, summits: undefined })).toBe(acclimatisationNote(i));
    }
  });

  it('base basse (étapes sous 2 500 m) + sommet haut : une note, alors qu’avant il n’y en avait aucune', () => {
    expect(acclimatisationNote({ maxAltitudeM: 1035, findings: [] })).toBeNull();
    const note = acclimatisationNote({ maxAltitudeM: 1035, findings: [], summits: [summit] })!;
    expect(note).toMatch(/sommet à 3 840 m environ/i);
    expect(note).toMatch(/altitude que tu as donnée/);
    expect(note).toMatch(/base à 1 040 m environ/);
    // Le dénivelé de la course n'est pas un dénivelé de couchage : ni « à revoir », ni « +2 800 m de couchage ».
    expect(note).toMatch(/pas un dénivelé de couchage/);
    expect(note).not.toMatch(/de couchage\)/);
    expect(note).not.toMatch(/À revoir/);
    expect(note).toMatch(/aucune nuit au-dessus de 2 500 m avant/);
    expect(note).toMatch(/monter haut, dormir bas/);
    expect(note).toMatch(/UIAA/);
  });

  it('prudente : un repère, jamais un diagnostic', () => {
    const note = acclimatisationNote({ maxAltitudeM: 1035, findings: [], summits: [summit] })!;
    expect(note).toMatch(/repère/i);
    expect(note).toMatch(/médecin/);
    expect(note).not.toMatch(
      /tu (as|auras|vas avoir) (le )?mal (aigu )?des montagnes|diagnostic|dangereux pour toi/i
    );
    // La phrase de prudence reste la dernière.
    expect(note.trim().endsWith('avant de partir.')).toBe(true);
  });

  it('base inconnue : dite inconnue, aucun chiffre inventé', () => {
    const f = checkSummitDay({ baseM: null, summitM: 3842, nightsAbove2500: 0 })!;
    const note = acclimatisationNote({ maxAltitudeM: null, findings: [], summits: [f] })!;
    expect(note).toMatch(/base d’altitude inconnue/);
    expect(note).not.toMatch(/base à \d/);
  });

  it('nuits déjà passées en altitude, mais moins que le repère : dites en nombre', () => {
    const f = checkSummitDay({ baseM: 2800, summitM: 4200, nightsAbove2500: 1 })!;
    const note = acclimatisationNote({ maxAltitudeM: 2800, findings: [], summits: [f] })!;
    expect(note).toMatch(/une seule nuit au-dessus de 2 500 m avant/);
    // Le contrôle des nuits (étapes à 2 800 m) reste en tête, inchangé.
    expect(
      note.startsWith(
        acclimatisationNote({ maxAltitudeM: 2800, findings: [] })!.split(' Au moindre')[0]
      )
    ).toBe(true);
  });

  it('les sommets nuls (non jugés) ne produisent rien', () => {
    expect(acclimatisationNote({ maxAltitudeM: 1035, findings: [], summits: [] })).toBeNull();
  });

  it('même entrée → même note', () => {
    const a = acclimatisationNote({ maxAltitudeM: 1035, findings: [], summits: [summit] });
    const b = acclimatisationNote({ maxAltitudeM: 1035, findings: [], summits: [{ ...summit }] });
    expect(a).toBe(b);
  });
});
