import type { CountryInput, CountryAllocation } from './types';

/**
 * Répartition déterministe de N jours sur P pays ordonnés.
 * Applique la méthode du plus grand reste (Largest Remainder Method)
 * avec un plancher de 2 jours par pays quand la durée le permet.
 *
 * Invariant garanti : somme(allocated_days) === totalDays
 */
export function allocateDays(
  countries: CountryInput[],
  totalDays: number
): CountryAllocation[] {
  if (!countries || countries.length === 0 || totalDays <= 0) {
    return [];
  }

  const p = countries.length;

  // Cas 1 pays : reçoit 100% des jours
  if (p === 1) {
    return [
      {
        country_code: countries[0].country_code,
        country_name: countries[0].country_name,
        allocated_days: totalDays,
        start_day: 1,
        end_day: totalDays,
      },
    ];
  }

  // Détermination du plancher par pays
  let baseDaysPerCountry = 2;
  if (totalDays < 2 * p) {
    baseDaysPerCountry = totalDays >= p ? 1 : 0;
  }

  const allocated: number[] = new Array(p).fill(baseDaysPerCountry);

  // Cas extrême où totalDays < p (ex: 2 jours pour 3 pays)
  if (baseDaysPerCountry === 0) {
    for (let i = 0; i < totalDays; i++) {
      allocated[i] = 1;
    }
  } else {
    // Calcul des jours restants à ventiler
    const baseTotal = baseDaysPerCountry * p;
    const remainingDays = totalDays - baseTotal;

    if (remainingDays > 0) {
      // Calcul de la somme des poids
      const weights = countries.map((c) => (c.weight && c.weight > 0 ? c.weight : 1));
      const totalWeight = weights.reduce((acc, w) => acc + w, 0);

      // Quotas décimaux et fractions
      const integers: number[] = [];
      const remainders: { index: number; remainder: number }[] = [];

      for (let i = 0; i < p; i++) {
        const quota = (remainingDays * weights[i]) / totalWeight;
        const intPart = Math.floor(quota);
        const rem = quota - intPart;

        integers.push(intPart);
        remainders.push({ index: i, remainder: rem });
      }

      // Somme déjà attribuée via la partie entière
      const sumInt = integers.reduce((acc, val) => acc + val, 0);
      let surplus = remainingDays - sumInt;

      // Tri stable des restes par ordre décroissant (bris d'égalité déterministe par index)
      remainders.sort((a, b) => {
        if (b.remainder !== a.remainder) {
          return b.remainder - a.remainder;
        }
        return a.index - b.index;
      });

      // Distribution des jours résiduels du plus grand reste
      for (let i = 0; i < surplus; i++) {
        const countryIdx = remainders[i].index;
        integers[countryIdx] += 1;
      }

      for (let i = 0; i < p; i++) {
        allocated[i] += integers[i];
      }
    }
  }

  // Construction des allocations avec chaînage continu des jours
  const result: CountryAllocation[] = [];
  let currentStart = 1;

  for (let i = 0; i < p; i++) {
    const days = allocated[i];
    if (days > 0) {
      const endDay = currentStart + days - 1;
      result.push({
        country_code: countries[i].country_code,
        country_name: countries[i].country_name,
        allocated_days: days,
        start_day: currentStart,
        end_day: endDay,
      });
      currentStart = endDay + 1;
    } else {
      result.push({
        country_code: countries[i].country_code,
        country_name: countries[i].country_name,
        allocated_days: 0,
        start_day: 0,
        end_day: 0,
      });
    }
  }

  return result;
}
