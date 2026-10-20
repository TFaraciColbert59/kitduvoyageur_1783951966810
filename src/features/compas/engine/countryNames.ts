/**
 * Un pays dit dans une autre langue → son nom français (« Peru », « Perú », « Грузии », « 日本 », « Germany »).
 * Noms par `Intl.DisplayNames` (CLDR : jamais traduits par nous), toutes écritures. Sert à chercher le pays
 * sur la carte sous le nom qu'elle connaît en français (constat C-015), sans aucun appel réseau.
 *
 * Volontairement muet sur « Georgia » : le pays et l'État américain portent ce nom en anglais.
 */

const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'tr', 'ru', 'uk', 'zh', 'ja', 'ko', 'ar', 'el'];
const AMBIGUOUS = new Set(['georgia']);

const latin = (s: string) => /\p{Script=Latin}/u.test(s);

function key(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

interface Entry {
  fr: string;
  keys: string[];
}
let table: Map<string, Entry> | null = null;
let entries: Entry[] = [];

function build(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  const names = LANGS.map((l) => {
    try {
      return new Intl.DisplayNames([l], { type: 'region' });
    } catch {
      return null;
    }
  });
  const fr = names[0];
  if (!fr) return map;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of A) {
    for (const b of A) {
      const code = `${a}${b}`;
      let frName: string | undefined;
      try {
        frName = fr.of(code);
      } catch {
        continue;
      }
      if (!frName || frName === code) continue;
      const entry: Entry = { fr: frName, keys: [] };
      for (const n of names) {
        let name: string | undefined;
        try {
          name = n?.of(code);
        } catch {
          continue;
        }
        if (!name || name === code) continue;
        const k = key(name);
        if (!k || AMBIGUOUS.has(k)) continue;
        if (!map.has(k)) map.set(k, entry);
        entry.keys.push(k);
      }
      entries.push(entry);
    }
  }
  return map;
}

/** Le nom français du pays dit, ou null (pas un pays, ou ambigu). */
export function canonicalCountryName(query: string): string | null {
  const q = query.trim();
  if (q.length < (latin(q) ? 3 : 2) || q.length > 40) return null;
  table ??= build();
  const k = key(q);
  if (!k || AMBIGUOUS.has(k)) return null;
  const exact = table.get(k);
  if (exact) return exact.fr;
  // Écriture non latine : une forme grammaticale du nom (« Грузии » pour « Грузия ») commence pareil sur 5 lettres.
  if (!latin(q) && k.length >= 5) {
    let best: Entry | null = null;
    for (const e of entries) {
      for (const ek of e.keys) {
        if (latin(ek) || ek.length < 5) continue;
        let i = 0;
        while (i < k.length && i < ek.length && k[i] === ek[i]) i += 1;
        if (i >= 5 && i >= Math.min(k.length, ek.length) - 1) best = e;
      }
    }
    if (best) return best.fr;
  }
  return null;
}

/**
 * Régions et villes très demandées, dites dans une autre langue, sous leur nom français (liste fermée, pas une
 * traduction de tout : la carte, elle, ne connaît pas toujours ces noms).
 */
const PLACE_ALIASES: Record<string, string> = {
  sudtirol: 'Haut-Adige', altoadige: 'Haut-Adige', tirol: 'Tyrol', tirolo: 'Tyrol', toskana: 'Toscane', toscana: 'Toscane',
  bayern: 'Bavière', baviera: 'Bavière', sardegna: 'Sardaigne', cerdena: 'Sardaigne', sizilien: 'Sicile', sicilia: 'Sicile',
  sicilien: 'Sicile', kreta: 'Crète', creta: 'Crète', alps: 'Alpes', alpen: 'Alpes', alpi: 'Alpes', dolomiten: 'Dolomites',
  dolomiti: 'Dolomites', provenza: 'Provence', bretana: 'Bretagne', bretagna: 'Bretagne', andalucia: 'Andalousie',
  andalusien: 'Andalousie', cataluna: 'Catalogne', katalonien: 'Catalogne', piemonte: 'Piémont', tokio: 'Tokyo', kioto: 'Kyoto',
  mailand: 'Milan', milano: 'Milan', venedig: 'Venise', venezia: 'Venise', florenz: 'Florence', firenze: 'Florence', rom: 'Rome',
  roma: 'Rome', wien: 'Vienne', praga: 'Prague', lisboa: 'Lisbonne', sevilla: 'Séville', napoli: 'Naples', neapel: 'Naples',
  mallorca: 'Majorque', schweizeralpen: 'Alpes suisses', himalaya: 'Himalaya',
};

/** Pays (toute langue) ou région / ville courante dite dans une autre langue → nom français ; sinon null. */
export function canonicalPlaceName(query: string): string | null {
  return canonicalCountryName(query) ?? PLACE_ALIASES[key(query)] ?? null;
}
