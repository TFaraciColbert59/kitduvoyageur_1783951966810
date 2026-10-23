import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PLAN-100 6.4 « Textes natifs traduits » : lecture statique des traductions FR et EN des textes
 * natifs visibles (iOS `InfoPlist.strings`, Android `values-fr` / `values-en`). Ces tests ne
 * prouvent PAS ce qu'affiche un appareil (dialogue système, nom sous l'icône) : il faut un iPhone
 * et un Android réels. Ils prouvent la syntaxe, que le français est le texte d'origine à la
 * lettre, et que l'anglais couvre les mêmes clés sans français oublié.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const plist = read('ios/App/App/Info.plist');
function plistString(key: string): string | null {
  const m = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1] : null;
}

/** Un fichier `.strings` : uniquement des lignes `"clé" = "valeur";` (commentaires et lignes vides admis). */
function parseStrings(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^\s*"([A-Za-z0-9_~-]+)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;\s*$/);
    if (!m) throw new Error(`ligne .strings invalide : ${line}`);
    if (m[1] in out) throw new Error(`clé en double : ${m[1]}`);
    out[m[1]] = m[2];
  }
  return out;
}

/** Les `<string name="…">valeur</string>` d'un `strings.xml`. */
function androidStrings(rel: string): Record<string, { value: string; translatable: boolean }> {
  const xml = read(rel);
  expect(xml.trimStart().startsWith('<?xml')).toBe(true);
  const out: Record<string, { value: string; translatable: boolean }> = {};
  for (const m of xml.matchAll(/<string\s+name="([^"]+)"([^>]*)>([^<]*)<\/string>/g)) {
    out[m[1]] = { value: m[3], translatable: !/translatable="false"/.test(m[2]) };
  }
  return out;
}

const FRENCH_WORDS = /\b(ta|ton|tes|position|jamais|voyage|trajet|départ|sans|elle|est|accord)\b/i;

describe('iOS : InfoPlist.strings en français et en anglais', () => {
  const fr = parseStrings(read('ios/App/App/fr.lproj/InfoPlist.strings'));
  const en = parseStrings(read('ios/App/App/en.lproj/InfoPlist.strings'));

  it('les mêmes clés, toutes présentes dans Info.plist', () => {
    expect(Object.keys(fr).sort()).toEqual([
      'CFBundleDisplayName',
      'NSLocationWhenInUseUsageDescription',
    ]);
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const k of Object.keys(fr)) expect(plistString(k)).toBeTruthy();
  });

  it('le français est le texte d’origine, à la lettre', () => {
    for (const [k, v] of Object.entries(fr)) expect(v).toBe(plistString(k));
  });

  it('l’anglais dit la même chose, sans français oublié, assez court pour le dialogue', () => {
    const t = en.NSLocationWhenInUseUsageDescription;
    expect(t).not.toMatch(FRENCH_WORDS);
    expect(t).toMatch(/your location/);
    expect(t).toMatch(/never in the background/);
    expect(t).toMatch(/without tracking/);
    expect(t).toMatch(/about 1 km/);
    expect(t).toMatch(/without your consent/);
    expect(t.length).toBeLessThanOrEqual(360);
    // Le nom de l'app est une marque : il ne se traduit pas.
    expect(en.CFBundleDisplayName).toBe(plistString('CFBundleDisplayName'));
  });
});

describe('Android : values-fr et values-en', () => {
  const base = androidStrings('android/app/src/main/res/values/strings.xml');
  const fr = androidStrings('android/app/src/main/res/values-fr/strings.xml');
  const en = androidStrings('android/app/src/main/res/values-en/strings.xml');
  const visible = Object.keys(base)
    .filter((k) => base[k].translatable)
    .sort();

  it('seuls les textes visibles sont traduits ; identifiants et schéma d’URL non traduisibles', () => {
    expect(visible).toEqual(['app_name', 'title_activity_main']);
    expect(base.package_name.translatable).toBe(false);
    expect(base.custom_url_scheme.translatable).toBe(false);
    expect(Object.keys(fr).sort()).toEqual(visible);
    expect(Object.keys(en).sort()).toEqual(visible);
  });

  it('valeurs par défaut inchangées ; français identique ; le nom (une marque) reste le même en anglais', () => {
    expect(base.app_name.value).toBe('Le Kit du Voyageur');
    expect(base.package_name.value).toBe('com.lekitduvoyageur.app');
    for (const k of visible) {
      expect(fr[k].value).toBe(base[k].value);
      expect(en[k].value).toBe(base[k].value);
    }
  });
});

/**
 * ES / DE / IT (PLAN-100 6.4) : mêmes clés que le français, registre de politesse (usted / Sie /
 * Lei), ni français ni anglais oubliés. Les `.lproj` iOS ne sont embarqués qu'une fois ajoutés au
 * projet Xcode (à faire dans Xcode : le `.pbxproj` n'est pas modifié ici). Ces tests lisent les
 * fichiers ; ils ne prouvent pas ce qu'affiche un appareil.
 */
const NEW_NATIVE = {
  es: {
    words: [/su ubicación/, /nunca en segundo plano/, /sin seguimiento/, /aproximadamente 1 km/, /sin su consentimiento/],
    informal: /(?<![\p{L}])(tú|tu|tus|te|ti|contigo|tienes|puedes)(?![\p{L}])/iu,
  },
  de: {
    words: [/Ihren Standort/, /niemals im Hintergrund/, /ohne Verfolgung/, /etwa 1 km/, /ohne Ihre Zustimmung/],
    informal: /(?<![\p{L}])(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)(?![\p{L}])/iu,
  },
  it: {
    words: [/la Sua posizione/, /mai in secondo piano/, /senza tracciamento/, /circa 1 km/, /senza il Suo consenso/],
    informal: /(?<![\p{L}])(tu|tuo|tua|tuoi|tue|ti|puoi|vuoi|hai)(?![\p{L}])/iu,
  },
} as const;

/** Mots-outils français et anglais, frontières Unicode (« está » n'est pas « est »). */
const FRENCH_RESIDUE_U =
  /(?<![\p{L}])(ta|ton|tes|jamais|voyage|trajet|départ|sans|elle|est|accord|vous|votre)(?![\p{L}])/iu;
const ENGLISH_RESIDUE_U = /(?<![\p{L}])(the|and|your|you|is|never|without|location|only)(?![\p{L}])/iu;
/** La marque est exclue des heuristiques : « Le Kit du Voyageur » reste en français partout. */
const withoutBrand = (s: string) => s.split('Le Kit du Voyageur').join(' ');

describe('iOS : InfoPlist.strings en espagnol, allemand et italien', () => {
  const fr = parseStrings(read('ios/App/App/fr.lproj/InfoPlist.strings'));
  for (const [lang, rules] of Object.entries(NEW_NATIVE)) {
    const strings = parseStrings(read(`ios/App/App/${lang}.lproj/InfoPlist.strings`));

    it(`${lang} : les mêmes clés que le français, la marque inchangée`, () => {
      expect(Object.keys(strings).sort()).toEqual(Object.keys(fr).sort());
      expect(strings.CFBundleDisplayName).toBe(plistString('CFBundleDisplayName'));
    });

    it(`${lang} : dit la même chose, au registre de politesse, sans français ni anglais oublié`, () => {
      const t = strings.NSLocationWhenInUseUsageDescription;
      for (const w of rules.words) expect(t).toMatch(w);
      const prose = withoutBrand(t);
      expect(prose).not.toMatch(FRENCH_RESIDUE_U);
      expect(prose).not.toMatch(ENGLISH_RESIDUE_U);
      expect(prose).not.toMatch(rules.informal);
      expect(t).not.toBe(fr.NSLocationWhenInUseUsageDescription);
      expect(t).not.toContain("'");
      expect(t.length).toBeLessThanOrEqual(400);
    });
  }

  it('les heuristiques détectent vraiment', () => {
    expect(FRENCH_RESIDUE_U.test('jamais en arrière-plan')).toBe(true);
    expect(FRENCH_RESIDUE_U.test('la app está abierta')).toBe(false);
    expect(ENGLISH_RESIDUE_U.test('your location')).toBe(true);
    expect(NEW_NATIVE.de.informal.test('deinen Standort')).toBe(true);
    expect(NEW_NATIVE.de.informal.test('Ihren Standort')).toBe(false);
    expect(NEW_NATIVE.es.informal.test('tu ubicación')).toBe(true);
    expect(NEW_NATIVE.es.informal.test('su ubicación')).toBe(false);
    expect(NEW_NATIVE.it.informal.test('la tua posizione')).toBe(true);
    expect(NEW_NATIVE.it.informal.test('la Sua posizione')).toBe(false);
  });
});

describe('Android : values-es, values-de et values-it', () => {
  const base = androidStrings('android/app/src/main/res/values/strings.xml');
  const visible = Object.keys(base)
    .filter((k) => base[k].translatable)
    .sort();
  for (const lang of Object.keys(NEW_NATIVE)) {
    it(`${lang} : seuls les textes visibles, identiques (le nom est une marque)`, () => {
      const strings = androidStrings(`android/app/src/main/res/values-${lang}/strings.xml`);
      expect(Object.keys(strings).sort()).toEqual(visible);
      for (const k of visible) expect(strings[k].value).toBe(base[k].value);
    });
  }
});
