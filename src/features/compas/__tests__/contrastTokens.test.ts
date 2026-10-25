import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Phase 5.2 (PLAN-100) — contraste WCAG 2.2 AA des jetons du Compas.
 *
 * jsdom ne mesure pas les couleurs rendues : ce verrou calcule, à partir des
 * VRAIS jetons de `tokens.css` (thème clair, seul thème de `/compas`), le
 * rapport de contraste des couples texte / fond OPAQUES que le Compas emploie.
 * Il ne remplace pas la mesure au pixel sur le verre (`npm run test:a11y`,
 * `docs/compas/ACCESSIBILITE.md`) : il empêche qu'un jeton repasse sous le seuil
 * sans que personne ne le voie. Seuils : 4,5:1 (texte), 3:1 (composant d'interface
 * ou grand texte).
 */

const ROOT = join(__dirname, '..', '..', '..', '..');
const TOKENS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ' '
);

// Jetons du thème clair : le premier bloc `:root` qui les déclare l'emporte,
// le bloc sombre (`--lkv-primary: #7FC49A`) vient plus loin et n'est pas lu.
function declared(name: string): string | undefined {
  const m = new RegExp(`${name.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`).exec(TOKENS);
  return m?.[1].trim();
}

function resolve(name: string, depth = 0): string {
  const raw = declared(name);
  if (!raw) throw new Error(`jeton introuvable : ${name}`);
  const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(raw);
  if (ref) {
    if (depth > 6) throw new Error(`boucle de jetons : ${name}`);
    return resolve(ref[1], depth + 1);
  }
  return raw;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`couleur non hexadécimale : ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg: string, bg: string): number {
  const a = luminance(rgb(resolve(fg)));
  const b = luminance(rgb(resolve(bg)));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['--lkv-surface', '--lkv-surface-paper', '--lkv-stone-50'] as const;

describe('Compas : contraste des jetons (thème clair)', () => {
  it('la formule vaut 21:1 pour noir sur blanc et 1:1 pour une couleur sur elle-même', () => {
    expect(ratio('--lkv-surface-paper', '--lkv-surface-paper')).toBeCloseTo(1, 5);
    // #FFFFFF / #06120C est presque noir : nettement au-dessus de 15:1.
    expect(ratio('--lkv-surface-paper', '--lkv-forest-950')).toBeGreaterThan(15);
  });

  it.each([
    '--lkv-text-primary',
    '--lkv-text-secondary',
    '--lkv-text-muted',
    '--lkv-text-subtle',
    '--lkv-ink-900',
    '--lkv-ink-700',
    '--lkv-ink-500',
  ])('le texte %s tient 4,5:1 sur chaque surface claire', (token) => {
    for (const surface of SURFACES) {
      expect(ratio(token, surface), `${token} sur ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['--lkv-sage-700', '--lkv-amber-800', '--lkv-brick-600', '--lkv-sky-600'])(
    'la couleur d’état %s (texte des pastilles) tient 4,5:1 sur le papier',
    (token) => {
      expect(ratio(token, '--lkv-surface-paper'), token).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('le texte sur les boutons pleins et sur l’îlot sombre tient 4,5:1', () => {
    expect(ratio('--lkv-on-primary', '--lkv-primary')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('--lkv-on-action', '--lkv-primary')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('--lkv-on-dark', '--lkv-ink-900')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('--lkv-on-dark-muted', '--lkv-ink-900')).toBeGreaterThanOrEqual(4.5);
  });

  it('l’accent du focus (outline 2 px, --cp-accent = sage-500) tient 3:1 sur le papier', () => {
    expect(ratio('--lkv-sage-500', '--lkv-surface-paper')).toBeGreaterThanOrEqual(3);
  });
});
