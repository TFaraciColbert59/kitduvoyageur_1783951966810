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
