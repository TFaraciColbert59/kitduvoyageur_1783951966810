import { describe, expect, it } from 'vitest';
import {
  S,
  alertsText,
  dayText,
  eur,
  kgText,
  orderCta,
  pageText,
  pct,
  pillLabel,
  readyText,
  tileLabel,
} from '../ui/strings';

/** Collecte toutes les chaînes produites : valeurs de S, et sorties des fonctions avec des arguments types. */
function collect(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (typeof node === 'function') out.push(...samples(node as (...x: unknown[]) => unknown));
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(S);
  out.push(
    pct(40),
    eur(1250),
    kgText(0.82),
    kgText(10.3),
    orderCta(0, 0),
    orderCta(1, 89),
    orderCta(3, 1240),
    readyText(80),
    alertsText(1),
    alertsText(2),
    dayText(2, 5),
    pageText(1, 3),
    tileLabel('Duvet', '820 g', 'sur toi'),
    pillLabel(10.3, 2),
    pillLabel(0.5, 0),
  );
  return out;
}

function samples(fn: (...x: unknown[]) => unknown): string[] {
  const args: unknown[][] = [
    [1, 3],
    [2, 5],
    [1],
  ];
  const res: string[] = [];
  for (const a of args) {
    try {
      const v = fn(...a);
      if (typeof v === 'string') res.push(v);
    } catch {
      /* signature non compatible : ignorée */
    }
  }
  return res;
}

const FORBIDDEN = [/\brang\b/i, /\brangs\b/i, /\bgrades?\b/i, /\bclassement/i, /\bgènes?\b/i, /\bgénétique/i, /\bADN\b/];

describe('strings', () => {
  const all = collect();

  it('les chaînes sont non vides', () => {
    expect(all.length).toBeGreaterThan(50);
    for (const s of all) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('% et € sont précédés d’une espace insécable (U+00A0), jamais d’une espace normale', () => {
    for (const s of all) {
      for (const sym of ['%', '€']) {
        let i = s.indexOf(sym);
        while (i !== -1) {
          expect(s[i - 1], `« ${sym} » mal espacé dans « ${s} »`).toBe(' ');
          i = s.indexOf(sym, i + 1);
        }
      }
    }
  });

  it('aucun « : » n’est précédé d’une espace normale (U+0020)', () => {
    for (const s of all) {
      for (let i = s.indexOf(':'); i !== -1; i = s.indexOf(':', i + 1)) {
        expect(s[i - 1], `« : » mal espacé dans « ${s} »`).not.toBe(' ');
      }
    }
  });

  it('aucun mot interdit (rang, grade, classement, gène, ADN)', () => {
    for (const s of all) for (const re of FORBIDDEN) expect(s, `« ${re} » trouvé`).not.toMatch(re);
  });
});
