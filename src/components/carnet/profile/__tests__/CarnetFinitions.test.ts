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

/** Règle trouvée par un fragment de sélecteur (listes multi-lignes). */
function ruleFrom(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`sélecteur absent : ${marker}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('Anatomie du drawer — lot A', () => {
  /* 1 — poignée 42 × 5 ; 6 px et .32 sous le doigt, en 120 ms. */
  it('poignée 42 × 5 qui s’épaissit à 6 px / .32 en 120 ms', () => {
    const bar = rule('.ckp-grabber span {');
    expect(bar).toMatch(/width:\s*42px/);
    expect(bar).toMatch(/height:\s*5px/);
    expect(bar).toMatch(/transition:\s*height 120ms ease, background-color 120ms ease/);
    const press = ruleFrom(".ckp-grabber[data-press='true']");
    expect(press).toMatch(/height:\s*6px/);
    expect(press).toMatch(/background:\s*rgba\(23, 43, 36, \.32\)/);
    expect(ruleFrom('.ckp-grabber:active span')).toMatch(/height:\s*6px/);
  });

  /* 2 — rayon du châssis en haut (24), bas refermé à 16 ; la carte ne bouge pas. */
  it('rayon 24 en haut et 16 en bas, la carte garde 24 partout', () => {
    expect(rule('.ckp-card.ckp-card--drawer {')).toMatch(/border-radius:\s*24px 24px 16px 16px/);
    expect(rule('.ckp-card {')).toMatch(/border-radius:\s*24px;/);
    /* L'ombre héritée épouse la courbe : la carte garde ses trois lames, aucune
       ombre n'est redessinée pour le bas de la feuille. */
    const card = rule('.ckp-card {');
    expect(card).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, \.95\)/);
    expect(card).toMatch(/inset 0 -1px 1px rgba\(255, 255, 255, \.4\)/);
    expect(card).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.12\)/);
  });

  /* 3 — liseré de 1 px sur l'arc supérieur seulement, clippé par un masque. */
  it('liseré 1 px sur l’arc supérieur, masqué à 26 px', () => {
    const edge = rule('.ckp-card--drawer::before {');
    expect(edge).toMatch(/box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, \.9\)/);
    expect(edge).toMatch(/border-radius:\s*24px 24px 0 0/);
    expect(edge).toMatch(/mask-image:\s*linear-gradient\(180deg, #000 0 18px, transparent 26px\)/);
    expect(edge).toMatch(/height:\s*26px/);
  });

  /* 4 — voile de coupe : blur 12, hairline .06, fondu de 160 ms. */
  it('voile de coupe : blur 12, hairline .06, opacité 160 ms', () => {
    const cut = rule('.ckp-drawer-cut {');
    expect(cut).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(cut).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
    expect(cut).toMatch(/transition:\s*opacity 160ms/);
    expect(rule(".ckp-drawer-cut[data-on='true'] {")).toMatch(/opacity:\s*1/);
  });

  /* 5 — zone de retour tactile : 12 px en bas, curseur grab, aucun geste. */
  it('zone tactile de 12 px en bas de feuille, curseur grab', () => {
    const grip = rule('.ckp-drawer-grip {');
    expect(grip).toMatch(/bottom:\s*0/);
    expect(grip).toMatch(/height:\s*12px/);
    expect(grip).toMatch(/cursor:\s*grab/);
    expect(grip).toMatch(/background:\s*transparent/);
  });

  /* 6 — élévation : 0 -2px 10px .14 → 0 -10px 34px .16 en 200 ms, puis stable. */
  it('élévation 200 ms puis stable, les trois lames du Compte intactes', () => {
    const sheet = rule('.ckp-card.ckp-card--drawer {');
    expect(sheet).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, \.95\)/);
    expect(sheet).toMatch(/inset 0 -1px 1px rgba\(255, 255, 255, \.4\)/);
    expect(sheet).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.12\)/);
    expect(sheet).toMatch(/0 -10px 34px rgba\(23, 43, 36, \.16\)/);
    expect(sheet).toMatch(/ckp-drawer-lift 200ms cubic-bezier\(\.22, 1, \.36, 1\) both/);
    const lift = css.slice(css.indexOf('@keyframes ckp-drawer-lift'));
    expect(lift).toMatch(/0 -2px 10px rgba\(23, 43, 36, \.14\)/);
    /* Une seule fois : aucune animation en boucle, aucune durée de série. */
    expect(lift.slice(0, lift.indexOf('.ckp-card--drawer::before'))).not.toMatch(/infinite/);
  });

  /* 7 — scrim gradué .10 au centre → .28 sous la feuille. */
  it('scrim gradué de .10 à .28', () => {
    const scrim = rule('.ckp-scrim {');
    expect(scrim).toMatch(/linear-gradient\(/);
    expect(scrim).toMatch(/rgba\(10, 20, 14, \.10\) 0%/);
    expect(scrim).toMatch(/rgba\(10, 20, 14, \.10\) 50%/);
    expect(scrim).toMatch(/rgba\(10, 20, 14, \.28\) 100%/);
    expect(scrim).toMatch(/pointer-events:\s*none/);
  });

  /* 8 — croix de 36 px, en absolu, jamais conditionnée à un état. */
  it('croix de fermeture 36 px toujours visible', () => {
    const close = rule('.ckp-drawer-close {');
    expect(close).toMatch(/width:\s*36px/);
    expect(close).toMatch(/height:\s*36px/);
    expect(close).toMatch(/position:\s*absolute/);
    expect(close).toMatch(/display:\s*grid/);
    expect(close).not.toMatch(/opacity:\s*0/);
    expect(close).not.toMatch(/visibility:\s*hidden/);
    expect(close).not.toMatch(/display:\s*none/);
    expect(css).not.toMatch(/\.ckp-drawer-close\[data-/);
  });
});

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
  it('rythme 12 / 20 posé par `gap`, marges internes de 16 px', () => {
    expect(rule('.ckp-group {')).toMatch(/gap:\s*12px/);
    expect(rule('.ckp-pane-body {')).toMatch(/gap:\s*20px/);
    expect(rule('.ckp-pane-share,\n.ckp-likes,\n.ckp-manage {')).toMatch(/gap:\s*20px/);
    expect(rule('.ckp-drawer-body {')).toMatch(/padding:\s*16px 16px 64px/);
    expect(rule('.ckp-stats {')).toMatch(/padding:\s*0/);
  });

  /* 6 / 7 / 8 — 24 px avant la première donnée, 20 px entre blocs, 64 en bas. */
  it('20 px sous le sous-sélecteur, 20 px entre blocs, 64 px de réserve basse', () => {
    expect(rule('.ckp-stats-seg {')).toMatch(/margin:\s*0 0 20px/);
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
  it('champ 48 px sans cadre, valeurs à droite dans 120 px', () => {
    const field = rule('.ckp-field {');
    expect(field).toMatch(/height:\s*48px/);
    expect(field).toMatch(/border:\s*0/);
    expect(field).toMatch(/border-radius:\s*0/);
    expect(field).toMatch(/background:\s*none/);
    expect(field).toMatch(/box-shadow:\s*none/);
    expect(field).toMatch(/padding:\s*0/);
    const label = rule('.ckp-field-label {');
    expect(label).toMatch(/font:\s*500 13px\/1\.42/);
    expect(label).toMatch(/color:\s*#6B7A70/);
    expect(label).toMatch(/max-width:\s*46%/);
    expect(label).toMatch(/text-overflow:\s*ellipsis/);
    expect(label).toMatch(/text-transform:\s*none/);
  });

  /* 16 / 24 — colonne de valeurs fixe de 120 px, alignée à droite. */
  it('colonne de valeurs 120 px, 13/500 tabulaire, alignée à droite', () => {
    const value = rule('.ckp-field-value {');
    expect(value).toMatch(/width:\s*120px/);
    expect(value).toMatch(/text-align:\s*right/);
    expect(value).toMatch(/font:\s*500 13px\/1\.15/);
    expect(value).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(value).toMatch(/color:\s*#172B24/);
  });

  /* 17 / 19 — hairline 0,5 px inset, jamais sur la première ligne du groupe. */
  it('filet 0,5 px inséré de 16 px, uniquement entre deux lignes', () => {
    /* Plus aucune bordure pleine : le filet est un pseudo-élément posé entre
       deux lignes, donc jamais en tête ni en pied de groupe. */
    /* Seul le voile de coupe du lot A garde un filet de bord : les lignes de
       données n'en portent plus aucune. */
    const flat = [...css.matchAll(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/g)];
    expect(flat).toHaveLength(1);
    expect(css).toContain('.ckp-drawer-cut');
    const hairline = rule('.ckp-field + .ckp-field::before,\n.ckp-liker + .ckp-liker::before');
    expect(hairline).toMatch(/left:\s*16px/);
    expect(hairline).toMatch(/right:\s*16px/);
    expect(hairline).toMatch(/height:\s*\.5px/);
    expect(hairline).toMatch(/background:\s*rgba\(23, 43, 36, \.06\)/);
  });

  /* 21 — icône de 16 px, 22 — aucun chevron. */
  it('icône 16 px dans le champ, aucun chevron peint', () => {
    expect(rule('.ckp-field-icon > span {')).toMatch(/width:\s*16px/);
    expect(rule('.ckp-field-icon > span {')).toMatch(/height:\s*16px/);
    const additions = css.slice(css.indexOf('Anatomie des drawers et sous-drawers'));
    expect(additions).not.toMatch(/chevron/);
  });

  /* 40 — erreur : bordure 1 px #C13B34, aucun bandeau. */
  it('erreur : liseré de 1 px #C13B34 sur le champ', () => {
    expect(rule('.ckp-field {')).toMatch(/border:\s*0/);
    expect(rule(".ckp-field[data-error='true'] {")).toMatch(/box-shadow:\s*inset 0 0 0 1px #C13B34/);
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

describe('Typographie — lot B', () => {
  /* 9 — trois niveaux et rien d'autre : 20/700, 13/500, 11/500. */
  it('trois niveaux : titre 20/700, texte et valeur 13/500, méta 11/500', () => {
    expect(rule('.ckp-pane-head b {')).toMatch(/font:\s*700 20px\/1\.15/);
    expect(rule('.ckp-field-value {')).toMatch(/font:\s*500 13px\/1\.15/);
    expect(rule('.ckp-liker-txt b {')).toMatch(/font:\s*500 13px\/1\.15/);
    expect(rule('.ckp-comment-name {')).toMatch(/font:\s*500 13px\/1\.15/);
    expect(rule('.ckp-field-label {')).toMatch(/font:\s*500 13px\/1\.42/);
    expect(rule('.ckp-comment-text {')).toMatch(/font:\s*500 13px\/1\.42/);
    expect(rule('.ckp-comment-meta {')).toMatch(/font:\s*500 11px\/1\.42/);
    expect(rule('.ckp-day-meta {')).toMatch(/font:\s*500 11px\/1\.42/);
  });

  /* 10 — tout chiffre est tabulaire, sur les quatre surfaces qui en portent. */
  it('tabular-nums posé sur la carte, la feuille, les volets et les pages', () => {
    const base = rule('.ckp-card, .ckp-card--drawer, .ckp-pane, .ckp-page, .ckp-screen-header {');
    expect(base).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  /* 11 — l'unité est accolée : 4 px du chiffre, 14/500, #6B7A70. */
  it('unité accolée à 4 px, 14/500 #6B7A70', () => {
    expect(rule('.ckp-hero-num {')).toMatch(/gap:\s*4px/);
    const unit = rule('.ckp-hero-unit {');
    expect(unit).toMatch(/font:\s*500 14px\/1/);
    expect(unit).toMatch(/color:\s*#6B7A70/);
  });

  /* 13 — interlignage : 1,42 pour les textes, 1,15 pour les valeurs. */
  it('interlignage 1,42 (textes) et 1,15 (valeurs)', () => {
    for (const selector of ['.ckp-comment-text {', '.ckp-story {', '.ckp-text {', '.ckp-field-label {']) {
      expect(rule(selector)).toMatch(/\/1\.42/);
    }
    for (const selector of ['.ckp-field-value {', '.ckp-liker-value {', '.ckp-day-nums b {', '.ckp-day-title {']) {
      expect(rule(selector)).toMatch(/\/1\.15/);
    }
  });

  /* 14 — métadonnées à #6B7A70, jamais #8A968D pour du texte lisible. */
  it('métadonnées à #6B7A70', () => {
    for (const selector of [
      '.ckp-comment-handle {',
      '.ckp-day-meta {',
      '.ckp-moment-list li {',
      '.ckp-elev-axis span {',
      '.ckp-pane-meta {',
      '.ckp-kit-detail {',
      '.ckp-dayinfo-day {',
    ]) {
      expect(rule(selector)).toMatch(/color:\s*#6B7A70/);
    }
  });

  /* 15 — un lieu long s'ellipse au milieu : coupe à gauche, colonne intacte. */
  it('ellipse au milieu : direction RTL, valeur toujours à droite', () => {
    const mid = rule('.ckp-field--mid .ckp-field-value {');
    expect(mid).toMatch(/direction:\s*rtl/);
    expect(mid).toMatch(/text-align:\s*right/);
  });

  /* 16 — un seul accent : plus aucune couleur hors jetons dans la feuille. */
  it('une seule couleur d’accent : aucune valeur hors jetons', () => {
    const tokens = ['#172b24', '#17402c', '#56665d', '#6b7a70', '#8a968d', '#c13b34', '#b4bdb6'];
    /* Exceptions nommées : la lentille (`#fff`), la surface opaque du
       `prefers-reduced-transparency` (#F4F7F3, lot E), le canvas de repli du
       Compte (#cfd6c8), le dégradé de la pastille de couverture (#123726,
       #2e5c40) et les masques (`#000`). */
    const allowed = new Set([...tokens, '#fff', '#ffffff', '#f4f7f3', '#cfd6c8', '#123726', '#2e5c40', '#000', '#000000']);
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const normalize = (value: string) => {
      const lower = value.toLowerCase();
      return lower.length === 4 ? `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}` : lower;
    };
    const offenders = hex.map(normalize).filter((value) => !allowed.has(value));
    expect(offenders).toEqual([]);
  });
});

describe('Rythme — lot C', () => {
  /* 17 — l'échelle est 4 / 8 / 12 / 20 / 32 : plus aucun 7 / 14 / 24 / 56 dans
     un espacement (les rayons et les tailles de la carte ne bougent pas). */
  it('échelle 4 / 8 / 12 / 20 / 32 : plus aucun 7 / 14 / 24 / 56', () => {
    expect(rule('.ckp-card-scroll {')).toMatch(/gap:\s*8px/);
    expect(rule('.ckp-card-scroll {')).toMatch(/padding:\s*8px 12px 64px/);
    expect(rule('.ckp-day-pane {')).toMatch(/gap:\s*8px/);
    expect(rule('.ckp-comment {')).toMatch(/padding:\s*12px 0/);
    expect(rule('.ckp-liker {')).toMatch(/gap:\s*12px/);
    const spacing = [...css.matchAll(/>\s*[^;{}]*\b(?:gap|margin|padding)[^;{}]*?\b(7|14|24|56)px/g)].map((hit) => hit[0]);
    expect(spacing).toEqual([]);
  });

  /* 18 — toute ligne de donnée mesure 48 px, la colonne de valeurs 120 px. */
  it('lignes de 48 px, colonne de valeurs fixe de 120 px', () => {
    expect(rule('.ckp-field {')).toMatch(/height:\s*48px/);
    expect(rule('.ckp-liker {')).toMatch(/min-height:\s*48px/);
    expect(rule('.ckp-day-head {')).toMatch(/min-height:\s*48px/);
    expect(rule('.ckp-row {')).toMatch(/min-height:\s*48px/);
    expect(rule('.ckp-field-value {')).toMatch(/width:\s*120px/);
    expect(rule('.ckp-liker-value {')).toMatch(/width:\s*120px/);
    /* 60 + 8 + 60 = 128 px de colonne de valeurs pour la ligne de jour. */
    expect(rule('.ckp-day-nums {')).toMatch(/grid-template-columns:\s*repeat\(2, 60px\)/);
  });

  /* 20 / 21 — trois lignes par groupe, 20 px d'air, filet seulement entre deux. */
  it('groupes de trois lignes, 20 px d’air, filet seulement entre deux lignes', () => {
    expect(rule('.ckp-list-group + .ckp-list-group {')).toMatch(/margin-top:\s*20px/);
    expect(rule('.ckp-list-group {')).toMatch(/display:\s*flex/);
    for (const selector of ['.ckp-likers {', '.ckp-comments-list {', '.ckp-daylist {', '.ckp-kit-list {']) {
      expect(rule(selector)).toMatch(/flex-direction:\s*column/);
    }
  });

  /* 22 / 23 — marges internes de 16 px, réserve basse de 64 px. */
  it('marges internes 16 px et réserve basse 64 px', () => {
    expect(rule('.ckp-drawer-body {')).toMatch(/padding:\s*16px 16px 64px/);
    expect(rule('.ckp-page-pad--dense {')).toMatch(/padding:\s*0 0 64px/);
  });

  /* 24 — aucun cadre : ni champ, ni rangée, ni bloc encadré. */
  it('aucun cadre : champ et rangée sans fond, sans ombre, sans rayon', () => {
    for (const selector of ['.ckp-field {', '.ckp-row {']) {
      const block = rule(selector);
      expect(block).toMatch(/background:\s*none/);
      expect(block).toMatch(/box-shadow:\s*none/);
      expect(block).toMatch(/border-radius:\s*0/);
    }
    expect(css).not.toMatch(/\.ckp-species \{[^}]*background/);
  });
});
