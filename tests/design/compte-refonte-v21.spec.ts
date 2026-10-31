import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

/** Dernière déclaration du sélecteur : celle qui gagne dans la cascade. */
const lastRuleBody = (css: string, pattern: RegExp) => {
  const rules = [...css.matchAll(pattern)];
  return rules.length ? rules[rules.length - 1][1] : '';
};

describe('Compte iOS 27 v21 — surface de scroll et sélecteur exact', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('1. La feuille est plein bord, le corps garde 12 px et le bas dégagé', () => {
    const sheet = lastRuleBody(source, /\.phone \.sheet\s*\{([^}]*)\}/g);
    expect(sheet).toMatch(/padding:\s*0\s*!important/);
    expect(sheet).not.toContain('16px');

    const body = lastRuleBody(source, /\.phone \.sheet \.sh-b\s*\{([^}]*)\}/g);
    expect(body).toMatch(
      /padding:\s*4px 12px calc\(20px \+ env\(safe-area-inset-bottom\)\)\s*!important/
    );
    expect(source).not.toContain('padding: 4px 2px 24px');
    expect(source).toMatch(/\.phone \.sheet \.sh-f\s*\{[^}]*padding-bottom/);
  });

  it('2. La lentille repose à 4/4, se lève à -6 au pressing, sans scale', () => {
    const lens = lastRuleBody(source, /\.phone \.sheet \.sel-lens\s*\{([^}]*)\}/g);
    expect(lens).toMatch(/top:\s*4px\s*!important/);
    expect(lens).toMatch(/bottom:\s*4px\s*!important/);
    expect(lens).toMatch(/height:\s*auto\s*!important/);
    expect(lens).toMatch(/transform:\s*translateX\(calc\(var\(--i, 0\) \* 100%\)\)\s*!important/);
    expect(lens).not.toContain('scale');
    expect(lens).toMatch(/linear-gradient\(180deg, rgba\(255,255,255,\.62\), rgba\(255,255,255,\.26\)\)/);

    const pressBlocks = [
      ...source.matchAll(
        /\.phone \.sheet \.flow\.pressing \.sel-lens,\s*\.phone \.sheet \.segc\.pressing \.sel-lens,\s*\.phone \.sheet \.reseau-toggle\.pressing \.sel-lens\s*\{([^}]*)\}/g
      ),
    ];
    const pressing = pressBlocks[pressBlocks.length - 1];
    expect(pressing).toBeDefined();
    expect(pressing[1]).toMatch(/top:\s*-6px\s*!important/);
    expect(pressing[1]).toMatch(/bottom:\s*-6px\s*!important/);

    expect(source).not.toContain('scale(1.16)');
    expect(runtime).not.toContain('scale(1.16)');
    expect(runtime).toMatch(/`translateX\(\$\{nearest \* 100\}%\)`/);
    expect(runtime).toContain('baseTransform');
    expect(runtime).toContain('baseTransition');
  });

  it('3. Le retour sorties vers grille part du bord ou d’un geste fort', () => {
    expect(runtime).toContain('ig-swipe-back');
    expect(runtime).toContain("st.edge && dx < -SWIPE_MIN");
    expect(runtime).toContain('edge: edge');
    expect(runtime).not.toContain("if (S.igTab === 1 && target.closest('.voyage-card'))");
    expect(source).toContain('.ig-swipe-back');
  });
});
