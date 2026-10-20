import { canonicalCountryName } from './countryNames';

/**
 * Le pays dit dans la phrase, hors du lieu lui-même : « trek 4 jours dans les Tatras en Pologne » → « Pologne »,
 * « 5 jours en Norvège, Lofoten, en juin » → « Norvège ». Un pays se reconnaît après « en », « au », « aux », « in »,
 * une virgule, ou en tête de phrase. Un lieu qui est lui-même un pays n'en reçoit pas. Constat C-012 : sans cela,
 * la recherche du lieu choisissait le pays au hasard (Tatras en Slovaquie).
 */
export function saidCountryFor(sentence: string, place: string): string | null {
  if (canonicalCountryName(place)) return null;
  const words = sentence
    .replace(/[.;!?]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const placeWords = new Set(place.toLowerCase().split(/\s+/));
  for (let n = 3; n >= 1; n -= 1) {
    for (let i = 0; i + n <= words.length; i += 1) {
      const gram = words.slice(i, i + n);
      const text = gram.join(' ').replace(/,$/, '');
      if (gram.every((w) => placeWords.has(w.toLowerCase().replace(/,$/, '')))) continue;
      const country = canonicalCountryName(text);
      if (!country) continue;
      const before = (words[i - 1] ?? '').toLowerCase();
      const afterComma = /,$/.test(words[i - 1] ?? '');
      if (i === 0 || afterComma || ['en', 'au', 'aux', 'in', 'de', 'du', 'des', "d'"].includes(before)) return country;
    }
  }
  return null;
}

/**
 * Le lieu précis dit juste après un pays et une virgule (« en Norvège, Lofoten, en juin » → « Lofoten »), si la
 * destination lue est ce pays. Un mois, un mot d'activité ou un pays n'est jamais ce lieu.
 */
export function saidPlaceAfterCountry(sentence: string, country: string): string | null {
  if (!canonicalCountryName(country)) return null;
  // Le pays tel qu'il est écrit dans la phrase, suivi d'une virgule puis d'un nom propre.
  const idx = sentence.toLowerCase().indexOf(country.toLowerCase());
  if (idx < 0) return null;
  const m = /^\s*,\s*(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*)/u.exec(sentence.slice(idx + country.length));
  if (!m) return null;
  const name = m[1].trim();
  const plain = name.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  if (canonicalCountryName(name)) return null;
  if (/^(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)$/.test(plain)) return null;
  return name;
}
