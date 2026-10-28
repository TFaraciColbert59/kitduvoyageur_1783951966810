// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dailyBarHeights,
  documentedShare,
  elevationProfile,
  seriesValues,
  splitThirds,
  splitUnit,
} from '../statsGeometry';

/**
 * Les 50 retouches des drawers et sous-drawers (28 oct. 2026) sont des formes
 * peintes par la feuille : on lit la feuille servie et on vérifie les valeurs
 * au dixième de pixel. Les captures 430 × 932 (docs/audit/carnet-2026-10-28)
 * restent la preuve visuelle ; ce fichier empêche la dérive silencieuse.
 */
const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/carnet-profile.css'), 'utf8');

function rule(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('Anatomie de la feuille', () => {
  /* 1 — le contenu commence 16 px sous la poignée, plus 60 px de vide. */
  it('poignée 42 × 5 à 8 px du bord, 13 px de haut, corps à 16 px dessous', () => {
    const box = rule('.ckp-grabber {');
    expect(box).toMatch(/height:\s*13px/);
    expect(box).toMatch(/padding:\s*8px 0 0/);
    const bar = rule('.ckp-grabber span {');
    expect(bar).toMatch(/width:\s*42px/);
    expect(bar).toMatch(/height:\s*5px/);
    expect(bar).toMatch(/border-radius:\s*999px/);
    expect(bar).toMatch(/background:\s*rgba\(23, 43, 36, \.18\)/);
    expect(rule('.ckp-drawer-body {')).toMatch(/padding:\s*16px 16px 64px/);
  });

  /* 2 — hauteur adaptative au contenu + réserve, plafond 503 px. */
  it('hauteur adaptative, plafond 503 px, corps défilant', () => {
    const sheet = rule('.ckp-card.ckp-card--drawer {');
    expect(sheet).toMatch(/height:\s*auto/);
    expect(sheet).toMatch(/flex:\s*0 0 auto/);
    expect(sheet).toMatch(/max-height:\s*min\(100%, 503px\)/);
  });

  /* 3 / 4 / 5 — rythme 12 / 20 / 32, marges 16, une seule ligne de base. */
  it('rythme vertical 12 / 20 / 32 et marges internes de 16 px', () => {
    expect(rule('.ckp-group {')).toMatch(/gap:\s*12px/);
    expect(rule('.ckp-pane-body > * + \*,\n.ckp-pane-share > * + \*,\n.ckp-likes > * + \*,\n.ckp-manage > * + \* {')).toMatch(
      /margin-top:\s*20px/,
    );
    expect(rule('.ckp-drawer-body {')).toMatch(/padding:\s*16px 16px 64px/);
    expect(rule('.ckp-stats {')).toMatch(/padding:\s*0/);
  });

  /* 6 / 7 / 8 — 24 px avant la première donnée, 20 px entre blocs, 64 en bas. */
  it('24 px avant le bloc héros, 20 px entre blocs, 64 px de réserve basse', () => {
    expect(rule('.ckp-pane-body > .ckp-hero {')).toMatch(/margin-top:\s*24px/);
    expect(rule('.ckp-elev {')).toMatch(/margin:\s*20px 0 0/);
    expect(rule('.ckp-drawer-body {')).toMatch(/padding:\s*16px 16px 64px/);
  });

  /* 7 — aucune section encadrée : ni titre, ni carte, ni rangée de réglage. */
  it('ne garde aucune section encadrée ni titre de volet', () => {
    expect(css).not.toMatch(/\.ckp-manage-section/);
    expect(css).not.toMatch(/\.ckp-section-head/);
    expect(css).not.toMatch(/\.ckp-set\b/);
    expect(css).not.toMatch(/\.ckp-share-row/);
    expect(css).not.toMatch(/\.ckp-stat-block-title/);
    expect(css).not.toMatch(/\.ckp-stat-context/);
  });
});

describe('Chiffre héros', () => {
  /* 9 / 10 / 48 / 50 — 40/700 tabulaire, unité 14/500 accolée. */
  it('chiffre 40/700 tabulaire, -1 px, interligne 1 ; unité 14/500', () => {
    const num = rule('.ckp-hero-num {');
    expect(num).toMatch(/font:\s*700 40px\/1/);
    expect(num).toMatch(/letter-spacing:\s*-1px/);
    expect(num).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(num).toMatch(/color:\s*#17402C/);
    const unit = rule('.ckp-hero-unit {');
    expect(unit).toMatch(/font:\s*500 14px\/1/);
    expect(unit).toMatch(/color:\s*#6B7A70/);
  });

  /* 11 / 24 — valeur absente : `—` en #B4BDB6, jamais un zéro. */
  it('valeur absente : tiret en #B4BDB6', () => {
    expect(rule('.ckp-hero-num[data-missing=\'true\'] {')).toMatch(/color:\s*#B4BDB6/);
    expect(rule('.ckp-field.is-missing .ckp-field-value {')).toMatch(/color:\s*#B4BDB6/);
  });

  /* 12 — barre de 6 px sur sa piste, 12 px sous le chiffre. */
  it('barre de 6 px, piste .08, remplissage #17402C', () => {
    const bar = rule('.ckp-hero-bar {');
    expect(bar).toMatch(/height:\s*6px/);
    expect(bar).toMatch(/margin-top:\s*12px/);
    expect(bar).toMatch(/background:\s*rgba\(23, 43, 36, \.08\)/);
    const fill = rule('.ckp-hero-bar i {');
    expect(fill).toMatch(/height:\s*6px/);
    expect(fill).toMatch(/background:\s*#17402C/);
  });

  /* 13 — trois sous-valeurs 12/600 tabulaires, sans libellé long. */
  it('trois sous-valeurs 12/600 tabulaires', () => {
    const sub = rule('.ckp-hero-sub {');
    expect(sub).toMatch(/font:\s*600 12px/);
    expect(sub).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(sub).toMatch(/gap:\s*16px/);
  });
});

describe('Champs de donnée', () => {
  /* 15 / 23 / 26 — champ de 48 px, rayon 12, fond blanc .55, placeholder 46 %. */
  it('champ 48 px, rayon 12, fond rgba(255,255,255,.55)', () => {
    const field = rule('.ckp-field {');
    expect(field).toMatch(/height:\s*48px/);
    expect(field).toMatch(/border-radius:\s*12px/);
    expect(field).toMatch(/background:\s*rgba\(255, 255, 255, \.55\)/);
    expect(field).toMatch(/padding:\s*0 12px/);
    const label = rule('.ckp-field-label {');
    expect(label).toMatch(/font:\s*500 12px/);
    expect(label).toMatch(/color:\s*#8A968D/);
    expect(label).toMatch(/max-width:\s*46%/);
    expect(label).toMatch(/text-overflow:\s*ellipsis/);
    expect(label).toMatch(/text-transform:\s*none/);
  });

  /* 16 / 24 — colonne de valeurs fixe de 120 px, alignée à droite. */
  it('colonne de valeurs 120 px, 13/600 tabulaire, alignée à droite', () => {
    const value = rule('.ckp-field-value {');
    expect(value).toMatch(/width:\s*120px/);
    expect(value).toMatch(/text-align:\s*right/);
    expect(value).toMatch(/font:\s*600 13px/);
    expect(value).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(value).toMatch(/color:\s*#172B24/);
  });

  /* 17 / 19 — hairline 0,5 px inset, jamais sur la première ligne du groupe. */
  it('hairline 0,5 px sur les listes, pas sur la première ligne', () => {
    expect(rule('.ckp-liker {')).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
    expect(rule('.ckp-likers > .ckp-liker:first-child {')).toMatch(/border-top:\s*0/);
    expect(rule('.ckp-day {')).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
    expect(rule('.ckp-day:first-child {')).toMatch(/border-top:\s*0/);
  });

  /* 21 — icône de 16 px, 22 — aucun chevron. */
  it('icône 16 px dans le champ, aucun chevron peint', () => {
    expect(rule('.ckp-field-icon > span {')).toMatch(/width:\s*16px/);
    expect(rule('.ckp-field-icon > span {')).toMatch(/height:\s*16px/);
    const additions = css.slice(css.indexOf('Anatomie des drawers et sous-drawers'));
    expect(additions).not.toMatch(/chevron/);
  });

  /* 40 — erreur : bordure 1 px #C13B34, aucun bandeau. */
  it('erreur : bordure de 1 px #C13B34 sur le champ', () => {
    expect(rule('.ckp-field {')).toMatch(/border:\s*1px solid transparent/);
    expect(rule('.ckp-field[data-error=\'true\'] {')).toMatch(/border-color:\s*#C13B34/);
  });
});

describe('Sous-sélecteur et capsule', () => {
  /* 29 / 30 / 32 — 30 px non flottant, lentille 41,5 × 25, 3 × 41,5 + 5. */
  it('sous-sélecteur 30 px, lentille 41,5 × 25, largeur 3 × 41,5 + 5', () => {
    const sub = rule('.ckp-sub {');
    expect(sub).toMatch(/height:\s*30px/);
    expect(sub).toMatch(/padding:\s*2\.5px/);
    expect(sub).not.toMatch(/position:\s*absolute/);
    expect(sub).not.toMatch(/position:\s*fixed/);
    expect(rule('.ckp-sub--icons {')).toMatch(/width:\s*calc\(var\(--n, 3\) \* 41\.5px \+ 5px\)/);
    const lens = rule('.ckp-sub > .ckp-th {');
    expect(lens).toMatch(/width:\s*41\.5px/);
    expect(lens).toMatch(/height:\s*25px/);
    expect(lens).toMatch(/translateX\(calc\(var\(--i, 0\) \* 41\.5px\)\)/);
    expect(3 * 41.5 + 5).toBe(129.5);
  });

  /* 34 / 36 — capsule à 12 px des bords, ombre de pose. */
  it('capsule du drawer à 12 px des bords bas et droit, ombre 0 2px 8px', () => {
    const foot = rule('.ckp-drawer-foot {');
    expect(foot).toMatch(/position:\s*absolute/);
    expect(foot).toMatch(/right:\s*12px/);
    expect(foot).toMatch(/bottom:\s*12px/);
    expect(foot).toMatch(/height:\s*30px/);
    expect(rule('.ckp-drawer-foot .ckp-capsule {')).toMatch(/0 2px 8px rgba\(23, 43, 36, \.10\)/);
    /* Le pas de la capsule de la carte ne bouge pas : 41,5 × n + 5. */
    expect(rule('.ckp-drawer-foot .ckp-capsule {')).toMatch(
      /width:\s*calc\(var\(--n, 2\) \* 41\.5px \+ 5px\)/,
    );
  });

  /* 35 — voile de 24 px, blanc .72 → transparent, en fin de course. */
  it('voile de fin de course : 24 px, blanc .72 vers transparent', () => {
    const veil = rule('.ckp-drawer-veil {');
    expect(veil).toMatch(/height:\s*24px/);
    expect(veil).toMatch(/rgba\(255, 255, 255, 0\), rgba\(255, 255, 255, \.72\)/);
    expect(veil).toMatch(/transition:\s*opacity 160ms/);
    expect(rule(".ckp-drawer-veil[data-on='true'] {")).toMatch(/opacity:\s*1/);
  });
});

describe('États', () => {
  /* 38 — squelette : 5 lignes de 48 px + bloc héros de 40 px, shimmer 1,4 s. */
  it('squelette : lignes 48 px, héros 40 px, shimmer de 1,4 s', () => {
    expect(rule('.ckp-load-bar--row {')).toMatch(/height:\s*48px/);
    expect(rule('.ckp-load-bar--hero {')).toMatch(/height:\s*40px/);
    expect(rule('.ckp-load-bar::after {')).toMatch(/animation:\s*ckp-shimmer 1\.4s/);
    expect(rule('.ckp-load {')).toMatch(/gap:\s*12px/);
  });

  /* 39 — état vide : glyphe 32 px à 30 %, tiret, aucune phrase. */
  it('état vide : glyphe 32 px à 30 %, tiret en #B4BDB6', () => {
    expect(rule('.ckp-empty-glyph > span {')).toMatch(/width:\s*32px/);
    expect(rule('.ckp-empty-glyph {')).toMatch(/opacity:\s*\.3/);
    expect(rule('.ckp-empty-dash {')).toMatch(/color:\s*#B4BDB6/);
  });

  /* 42 — transition d'état en fondu de 160 ms. */
  it('fondu d’état de 160 ms', () => {
    expect(rule('.ckp-comments-list {')).toMatch(/transition:\s*opacity 160ms/);
    expect(rule('.ckp-load {')).toMatch(/ckp-fade-in 160ms/);
  });
});

describe('Mouvement', () => {
  /* 43 — entrée du drawer : 12 px + fondu, 220 ms. */
  it('entrée du drawer : translateY(12px) + fondu, 220 ms', () => {
    const keyframes = css.slice(css.indexOf('@keyframes ckp-drawer-in'));
    expect(keyframes).toMatch(/translateY\(12px\)/);
    expect(rule('.ckp-card.ckp-card--drawer {')).toMatch(/ckp-drawer-in 220ms cubic-bezier\(\.22, 1, \.36, 1\)/);
  });

  /* 44 — changement de sous-onglet : fondu + 8 px, 180 ms. */
  it('changement de sous-onglet : fondu + 8 px sur 180 ms', () => {
    expect(rule(".ckp-hero[data-animate='true'] {")).toMatch(/ckp-hero-in 180ms/);
    const keyframes = css.slice(css.indexOf('@keyframes ckp-hero-in'));
    expect(keyframes).toMatch(/translateY\(8px\)/);
  });

  /* 45 — rouleau 400 ms, une seule fois. */
  it('rouleau des valeurs : 400 ms', () => {
    expect(rule('.ckp-roll.is-rolling > b {')).toMatch(/ckp-roll 400ms/);
  });

  /* 46 — mouvement réduit : aucune translation, fondu de 120 ms. */
  it('mouvement réduit : aucune translation, fondu de 120 ms', () => {
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.ckp-roll\.is-rolling > b\s*\{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.ckp-hero\[data-animate='true'\]\s*\{\s*animation:\s*ckp-fade-in 120ms/);
    expect(reduced).toMatch(/\.ckp-hero-bar i\s*\{\s*transition:\s*none/);
    /* Le fondu de 160 ms du drawer reste la règle des mouvements réduits. */
    expect(css).toMatch(/\.ckp-card--drawer\s*\{\s*animation:\s*ckp-fade-in 160ms linear both/);
  });
});

describe('Typographie et contraste', () => {
  /* 47 — métadonnées à #6B7A70, jamais #8A968D pour du texte lisible. */
  it('métadonnées à #6B7A70 en 11/500', () => {
    expect(rule('.ckp-comment-meta {')).toMatch(/color:\s*#6B7A70/);
    expect(rule('.ckp-comment-meta {')).toMatch(/font:\s*500 11px/);
    expect(rule('.ckp-liker-txt small {')).toMatch(/color:\s*#6B7A70/);
    expect(rule('.ckp-liker-txt small {')).toMatch(/font:\s*500 11px/);
  });

  /* 48 — chiffres tabulaires partout. */
  it('chiffres tabulaires sur toutes les valeurs', () => {
    for (const selector of ['.ckp-hero-num {', '.ckp-hero-sub {', '.ckp-field-value {', '.ckp-liker-value {']) {
      expect(rule(selector)).toMatch(/font-variant-numeric:\s*tabular-nums/);
    }
  });

  /* 49 — aucune capitale, aucun letter-spacing large sur les placeholders. */
  it('placeholders sans capitale ni letter-spacing', () => {
    const label = rule('.ckp-field-label {');
    expect(label).toMatch(/text-transform:\s*none/);
    expect(label).toMatch(/letter-spacing:\s*0/);
  });

  /* 50 — une seule couleur d'accent : #17402C. */
  it('une seule couleur d’accent, valeurs en #172B24', () => {
    expect(rule('.ckp-hero-bar i {')).toMatch(/#17402C/);
    expect(rule('.ckp-field-value {')).toMatch(/color:\s*#172B24/);
    expect(rule('.ckp-sub button[aria-pressed=\'true\'] {')).toMatch(/color:\s*#17402C/);
  });

  /* Le contrôle de jetons porte sur les valeurs ajoutées par cette refonte. */
  it('aucune couleur littérale hors des jetons autorisés', () => {
    /* #B4BDB6 est imposé par la retouche 24 (le `—` absent) ; #fff est la
       lentille du sélecteur, déjà en place depuis le Compte. */
    const tokens = new Set(['#172B24', '#17402C', '#56665D', '#6B7A70', '#8A968D', '#C13B34', '#B4BDB6']);
    const additions = css.slice(css.indexOf('Anatomie des drawers et sous-drawers'));
    const hex = additions.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const offenders = hex
      .filter((value) => !['#fff', '#ffffff'].includes(value.toLowerCase()))
      .filter((value) => {
        const long =
          value.length === 4
            ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
            : value;
        return ![...tokens].some((token) => token.toLowerCase() === long.toLowerCase());
      });
    expect(offenders).toEqual([]);
  });
});

describe('Géométrie des séries', () => {
  it('rend null sans valeur réelle', () => {
    expect(elevationProfile([null, null])).toBeNull();
    expect(splitThirds([null, 0])).toBeNull();
    expect(dailyBarHeights([null])).toEqual([]);
    expect(seriesValues([null, 0, 12, -3])).toEqual([12]);
  });

  it('aire fermée, point culminant et barres proportionnelles', () => {
    const profile = elevationProfile([100, null, 300], 374, 72, 9);
    expect(profile).toBeTruthy();
    if (!profile) return;
    expect(profile.points).toHaveLength(2);
    expect(profile.summit.value).toBe(300);
    expect(profile.area.endsWith('Z')).toBe(true);
    expect(profile.line.startsWith('M')).toBe(true);
    expect(dailyBarHeights([10, null, 20], 16)).toEqual([8, null, 16]);
    expect(splitThirds([1, 1, 1])).toEqual([1, 1, 1]);
    expect(splitThirds([null, 4, 0, 6, 2, 8])).toEqual([4, 6, 10]);
  });

  it('sépare la valeur de son unité sans perdre l’espace fine', () => {
    expect(splitUnit('106,4 km')).toEqual({ value: '106,4', unit: 'km' });
    expect(splitUnit('2\u202f002 m')).toEqual({ value: '2\u202f002', unit: 'm' });
    expect(splitUnit(null)).toEqual({ value: '—', unit: '' });
  });

  /* 12 — la part documentée est la seule progression mesurable. */
  it('part documentée : jours renseignés sur jours du carnet', () => {
    expect(documentedShare([12.4, null, 14.2])).toBeCloseTo(2 / 3, 6);
    expect(documentedShare([1, 1, 1])).toBe(1);
    expect(documentedShare([null, null])).toBe(0);
    expect(documentedShare([])).toBe(0);
  });
});
