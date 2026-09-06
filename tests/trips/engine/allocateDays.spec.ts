import { describe, it, expect } from 'vitest';
import { allocateDays } from '@/features/trips/engine/allocateDays';
import type { CountryInput } from '@/features/trips/engine/types';

describe('allocateDays — Répartition déterministe des jours par pays (TDD)', () => {
  it('TEST-ALLOC-01: Renvoie un tableau vide si aucun pays fourni', () => {
    const res = allocateDays([], 14);
    expect(res).toEqual([]);
  });

  it('TEST-ALLOC-02: 1 seul pays reçoit 100% des jours', () => {
    const countries: CountryInput[] = [{ country_code: 'FR' }];
    const res = allocateDays(countries, 14);
    expect(res).toHaveLength(1);
    expect(res[0].country_code).toBe('FR');
    expect(res[0].allocated_days).toBe(14);
    expect(res[0].start_day).toBe(1);
    expect(res[0].end_day).toBe(14);
  });

  it('TEST-ALLOC-03: Invariant strict de somme des jours pour 1, 2, 3, 5 pays et durées 3, 7, 14, 30, 90', () => {
    const countrySets: CountryInput[][] = [
      [{ country_code: 'FR' }],
      [{ country_code: 'FR' }, { country_code: 'ES' }],
      [{ country_code: 'FR' }, { country_code: 'CH' }, { country_code: 'IT' }],
      [
        { country_code: 'NP' },
        { country_code: 'IN' },
        { country_code: 'BT' },
        { country_code: 'TH' },
        { country_code: 'VN' },
      ],
    ];
    const durations = [3, 7, 14, 21, 30, 90, 120];

    for (const countries of countrySets) {
      for (const duration of durations) {
        const res = allocateDays(countries, duration);
        const sum = res.reduce((acc, c) => acc + c.allocated_days, 0);
        expect(sum).toBe(duration);

        // Vérification du chaînage continu des jours sans trou ni superposition pour les pays ayant des jours
        let currentDay = 1;
        for (const item of res) {
          if (item.allocated_days > 0) {
            expect(item.start_day).toBe(currentDay);
            expect(item.end_day).toBe(currentDay + item.allocated_days - 1);
            currentDay = item.end_day + 1;
          } else {
            expect(item.start_day).toBe(0);
            expect(item.end_day).toBe(0);
          }
        }
        expect(currentDay - 1).toBe(duration);
      }
    }
  });

  it('TEST-ALLOC-04: Plancher de 2 jours par pays respecté si la durée le permet', () => {
    const countries: CountryInput[] = [
      { country_code: 'FR' },
      { country_code: 'IT' },
      { country_code: 'CH' },
    ];
    // 3 pays, 6 jours -> minimum 2 jours chacun
    const res = allocateDays(countries, 6);
    expect(res).toHaveLength(3);
    expect(res.every((c) => c.allocated_days >= 2)).toBe(true);
    expect(res[0].allocated_days).toBe(2);
    expect(res[1].allocated_days).toBe(2);
    expect(res[2].allocated_days).toBe(2);
  });

  it('TEST-ALLOC-05: Répartition proportionnelle aux poids avec méthode du plus grand reste', () => {
    const countries: CountryInput[] = [
      { country_code: 'FR', weight: 3 }, // 60%
      { country_code: 'CH', weight: 2 }, // 40%
    ];
    // 10 jours : 60% de 10 = 6, 40% de 10 = 4
    const res = allocateDays(countries, 10);
    expect(res[0].allocated_days).toBe(6);
    expect(res[1].allocated_days).toBe(4);
    expect(res[0].allocated_days + res[1].allocated_days).toBe(10);
  });

  it('TEST-ALLOC-06: Cas dégénéré où la durée totale est inférieure à 2 x pays', () => {
    const countries: CountryInput[] = [
      { country_code: 'FR' },
      { country_code: 'IT' },
      { country_code: 'ES' },
    ];
    // 2 jours pour 3 pays : ne crash pas, somme égale à 2
    const res = allocateDays(countries, 2);
    const sum = res.reduce((acc, c) => acc + c.allocated_days, 0);
    expect(sum).toBe(2);
  });

  it('TEST-ALLOC-07: Déterminisme bit à bit sur 100 exécutions consécutives', () => {
    const countries: CountryInput[] = [
      { country_code: 'NP', weight: 4 },
      { country_code: 'PE', weight: 3 },
      { country_code: 'IS', weight: 2 },
    ];
    const firstRun = JSON.stringify(allocateDays(countries, 23));
    for (let i = 0; i < 100; i++) {
      const nextRun = JSON.stringify(allocateDays(countries, 23));
      expect(nextRun).toBe(firstRun);
    }
  });
});
