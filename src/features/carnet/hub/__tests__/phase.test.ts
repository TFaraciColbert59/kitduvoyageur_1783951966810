import { describe, expect, it } from 'vitest';
import { carnetDayCurrent, carnetDaysTotal, carnetJourney, carnetPhase } from '../phase';

/**
 * Phase et compteurs de jours : la date décide (fuseau Europe/Paris), comme la
 * pilule de la fiche Carnet v2. En juillet, Paris est à UTC+2.
 */
describe('phase du carnet', () => {
  it('« préparation » avant le départ', () => {
    expect(carnetPhase('2026-07-13', '2026-07-16', new Date('2026-07-12T12:00:00Z'))).toBe(
      'preparation',
    );
  });

  it('« en route » le jour du départ, dès 00 h 30 heure de Paris', () => {
    // 2026-07-12T22:30:00Z = 13/07 00:30 à Paris.
    expect(carnetPhase('2026-07-13', '2026-07-16', new Date('2026-07-12T22:30:00Z'))).toBe(
      'en_route',
    );
  });

  it('« en route » le dernier jour, à 23 h 30 heure de Paris', () => {
    // 2026-07-16T21:30:00Z = 16/07 23:30 à Paris.
    expect(carnetPhase('2026-07-13', '2026-07-16', new Date('2026-07-16T21:30:00Z'))).toBe(
      'en_route',
    );
  });

  it('« rentré » le lendemain de la fin (dès 00 h 30 heure de Paris)', () => {
    // 2026-07-16T22:30:00Z = 17/07 00:30 à Paris.
    expect(carnetPhase('2026-07-13', '2026-07-16', new Date('2026-07-16T22:30:00Z'))).toBe(
      'rentre',
    );
  });

  it('sans date de départ : « préparation » (aucune date inventée)', () => {
    expect(carnetPhase(null, '2026-07-16', new Date('2026-07-20T12:00:00Z'))).toBe('preparation');
    expect(carnetPhase('n’importe quoi', null, new Date('2026-07-20T12:00:00Z'))).toBe(
      'preparation',
    );
  });

  it('sans date de fin et départ passé : « en route », sans « rentré » constatable', () => {
    expect(carnetPhase('2026-07-13', null, new Date('2026-08-01T12:00:00Z'))).toBe('en_route');
  });

  it('accepte une colonne `timestamptz` en la tronquant au jour', () => {
    expect(carnetPhase('2026-07-13T00:00:00+00:00', '2026-07-16', new Date('2026-07-14T12:00:00Z'))).toBe(
      'en_route',
    );
  });
});

describe('jours du carnet', () => {
  it('la durée inclut le départ et l’arrivée', () => {
    expect(carnetDaysTotal('2026-07-13', '2026-07-16')).toBe(4);
    expect(carnetDaysTotal('2026-07-13', '2026-07-13')).toBe(1);
  });

  it('durée inconnue sans les deux dates (ou dates inversées)', () => {
    expect(carnetDaysTotal('2026-07-13', null)).toBeNull();
    expect(carnetDaysTotal(null, '2026-07-16')).toBeNull();
    expect(carnetDaysTotal('2026-07-16', '2026-07-13')).toBeNull();
  });

  it('jour courant : 1 le jour du départ, borné à la durée le jour de fin', () => {
    expect(carnetDayCurrent('2026-07-13', '2026-07-16', new Date('2026-07-12T22:30:00Z'))).toBe(1);
    expect(carnetDayCurrent('2026-07-13', '2026-07-16', new Date('2026-07-15T09:00:00Z'))).toBe(3);
    expect(carnetDayCurrent('2026-07-13', '2026-07-16', new Date('2026-07-16T21:30:00Z'))).toBe(4);
  });

  it('jour courant : null avant le départ, sans borne haute sans date de fin', () => {
    expect(carnetDayCurrent('2026-07-13', '2026-07-16', new Date('2026-07-01T09:00:00Z'))).toBeNull();
    expect(carnetDayCurrent('2026-07-13', null, new Date('2026-07-20T09:00:00Z'))).toBe(8);
  });
});

describe('carnetJourney', () => {
  it('le jour courant n’est renseigné qu’en route', () => {
    const enRoute = carnetJourney('2026-07-13', '2026-07-16', new Date('2026-07-14T09:00:00Z'));
    expect(enRoute).toEqual({ phase: 'en_route', daysTotal: 4, dayCurrent: 2 });

    const rentre = carnetJourney('2026-07-13', '2026-07-16', new Date('2026-07-20T09:00:00Z'));
    expect(rentre).toEqual({ phase: 'rentre', daysTotal: 4, dayCurrent: null });

    const preparation = carnetJourney('2026-07-13', '2026-07-16', new Date('2026-07-01T09:00:00Z'));
    expect(preparation).toEqual({ phase: 'preparation', daysTotal: 4, dayCurrent: null });
  });
});
