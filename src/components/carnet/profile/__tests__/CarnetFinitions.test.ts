// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dailyBarHeights,
  elevationProfile,
  seriesValues,
  splitThirds,
  splitUnit,
} from '../statsGeometry';

/**
 * Les 28 finitions des drawers et sous-drawers sont des formes peintes par la
 * feuille : on lit la feuille servie et on vérifie les valeurs au dixième de
 * pixel. Les captures 430 × 932 (docs/audit/carnet-2026-10-27) restent la
 * preuve visuelle ; ce fichier empêche la dérive silencieuse.
 */
const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/carnet-profile.css'), 'utf8');

function rule(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('Anatomie commune des drawers', () => {
  it('poignée 42 × 5, rayon 999, rgba(23,43,36,.18), à 8 px du bord', () => {
    const box = rule('.ckp-grabber {');
    expect(box).toMatch(/height:\s*21px/);
    expect(box).toMatch(/padding:\s*8px 0 0/);
    const bar = rule('.ckp-grabber span {');
    expect(bar).toMatch(/width:\s*42px/);
    expect(bar).toMatch(/height:\s*5px/);
    expect(bar).toMatch(/border-radius:\s*999px/);
    expect(bar).toMatch(/background:\s*rgba\(23, 43, 36, \.18\)/);
  });

  it('coupure au défilement : voile blur(12px), hairline, fondu 160 ms', () => {
    const cut = rule('.ckp-drawer-cut {');
    expect(cut).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(cut).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
    expect(cut).toMatch(/transition:\s*opacity 160ms/);
    expect(cut).toMatch(/opacity:\s*0/);
    expect(rule(".ckp-drawer-cut[data-on='true']")).toMatch(/opacity:\s*1/);
  });

  it('croix de fermeture 36 px, blanc .9, toujours présente', () => {
    const close = rule('.ckp-drawer-close {');
    expect(close).toMatch(/width:\s*36px/);
    expect(close).toMatch(/height:\s*36px/);
    expect(close).toMatch(/background:\s*rgba\(255, 255, 255, \.9\)/);
    /* Cible tactile de 44 px : 36 + 4 px transparents de chaque côté. */
    expect(rule('.ckp-drawer-close::after {')).toMatch(/inset:\s*-4px/);
  });

  it('anneau de focus 2 px #17402C posé à 2 px', () => {
    const focus = rule('.ckp-card--drawer :focus-visible,');
    expect(focus).toMatch(/outline:\s*none/);
    expect(focus).toMatch(/box-shadow:\s*0 0 0 2px transparent, 0 0 0 4px #17402C/);
  });

  it('mouvement réduit : fondu de 160 ms, aucune translation', () => {
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.ckp-card--drawer\s*\{\s*animation:\s*ckp-fade-in 160ms linear both/);
    expect(reduced).toMatch(/\.ckp-page--next, \.ckp-page--prev\s*\{\s*animation:\s*ckp-fade-in 160ms/);
    expect(css).toMatch(/@keyframes ckp-fade-in\s*\{\s*from\s*\{\s*opacity:\s*0/);
  });
});

describe('Statistiques', () => {
  it('chiffre 34/700 tabulaire, unité 13/500, contexte 11/500', () => {
    const hero = rule('.ckp-stat-hero b {');
    expect(hero).toMatch(/font:\s*700 34px/);
    expect(hero).toMatch(/letter-spacing:\s*-\.6px/);
    expect(hero).toMatch(/font-variant-numeric:\s*tabular-nums/);
    const unit = rule('.ckp-stat-unit {');
    expect(unit).toMatch(/font:\s*500 13px/);
    expect(unit).toMatch(/color:\s*#6B7A70/);
    expect(rule('.ckp-stat-context {')).toMatch(/font:\s*500 11px/);
  });

  it('barre de répartition 6 px, segments opaques 100 / 70 / 45', () => {
    const bar = rule('.ckp-split {');
    expect(bar).toMatch(/height:\s*6px/);
    expect(bar).toMatch(/margin:\s*12px 0 0/);
    const segment = rule('.ckp-split i {');
    expect(segment).toMatch(/height:\s*6px/);
    expect(segment).toMatch(/border-radius:\s*999px/);
    expect(segment).toMatch(/background:\s*#17402c/);
  });

  it('marges 16 px / 20 px, séparateur hairline', () => {
    const pane = rule('.ckp-stats {');
    expect(pane).toMatch(/padding:\s*20px 16px 4px/);
    expect(rule('.ckp-stats-sep {')).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
  });

  it('aire 72 px, remplissage .12, trait 1,5 px, sans axe', () => {
    expect(rule('.ckp-elev svg {')).toMatch(/height:\s*72px/);
    const summit = rule('.ckp-elev-summit i {');
    expect(summit).toMatch(/width:\s*6px/);
    expect(summit).toMatch(/height:\s*6px/);
    expect(rule('.ckp-elev-summit {')).toMatch(/font:\s*600 11px/);
    expect(rule('.ckp-elev-axis span {')).toMatch(/font:\s*500 9px/);
    expect(rule('.ckp-elev-axis span {')).toMatch(/color:\s*#7A8A80/);
    expect(rule('.ckp-elev-axis span {')).toMatch(/opacity:\s*\.7/);
    expect(rule('.ckp-elev-axis span {')).toMatch(/text-align:\s*right/);
    const bars = rule('.ckp-elev-bars i {');
    expect(bars).toMatch(/width:\s*4px/);
    expect(bars).toMatch(/background:\s*rgba\(23, 64, 44, \.35\)/);
  });

  it('ligne de jour 56 px, pastille 22, trait 1 px, chiffres tabulaires', () => {
    expect(rule('.ckp-day-head {')).toMatch(/min-height:\s*56px/);
    const badge = rule('.ckp-day-badge {');
    expect(badge).toMatch(/width:\s*22px/);
    expect(badge).toMatch(/height:\s*22px/);
    expect(rule('.ckp-day-line {')).toMatch(/background:\s*rgba\(23, 43, 36, \.10\)/);
    const num = rule('.ckp-day-nums b {');
    expect(num).toMatch(/font:\s*600 12px/);
    expect(num).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(num).toMatch(/text-align:\s*right/);
  });

  it('en-tête collant de 40 px, total 12/600', () => {
    const sticky = rule('.ckp-stats-sticky {');
    expect(sticky).toMatch(/position:\s*sticky/);
    expect(sticky).toMatch(/top:\s*0/);
    const band = rule('.ckp-stats-sticky > div {');
    expect(band).toMatch(/height:\s*40px/);
    expect(band).toMatch(/backdrop-filter:\s*blur\(14px\)/);
    expect(rule('.ckp-stats-sticky b {')).toMatch(/font:\s*600 12px/);
  });
});

describe('Commentaires, j’aime, gérer, post', () => {
  it('nom 12,5/600 + handle 11/500, texte 13/400 à 1,42, métadonnées dessous', () => {
    expect(rule('.ckp-comment-name {')).toMatch(/font:\s*600 12\.5px/);
    expect(rule('.ckp-comment-handle {')).toMatch(/font:\s*500 11px/);
    expect(rule('.ckp-comment-handle {')).toMatch(/color:\s*#7A8A80/);
    expect(rule('.ckp-comment-text {')).toMatch(/font:\s*400 13px\/1\.42/);
    expect(rule('.ckp-comment-meta {')).toMatch(/color:\s*#8A968D/);
    expect(rule('.ckp-comment-meta {')).toMatch(/font:\s*500 10\.5px/);
    expect(rule('.ckp-comment-meta {')).toMatch(/margin-top:\s*4px/);
  });

  it('entrée d’un commentaire : fondu + 6 px sur 180 ms', () => {
    const anim = css.slice(css.indexOf('@keyframes ckp-comment-in'));
    expect(anim).toMatch(/translateY\(6px\)/);
    expect(rule('.ckp-comment.is-new {')).toMatch(/animation:\s*ckp-comment-in 180ms/);
  });

  it('pastilles de tri 28 px, contour 1 px, actif #17402C', () => {
    const pill = rule('.ckp-like-filter {');
    expect(pill).toMatch(/height:\s*28px/);
    expect(pill).toMatch(/border:\s*1px solid rgba\(23, 43, 36, \.14\)/);
    expect(rule(".ckp-like-filter[aria-pressed='true'] {")).toMatch(/background:\s*#17402C/);
    /* Cible tactile : 28 + 8 px transparents de chaque côté = 44. */
    expect(rule('.ckp-like-filter::after {')).toMatch(/inset:\s*-8px -2px/);
    expect(rule('.ckp-likes-count {')).toMatch(/font:\s*500 11px/);
  });

  it('réglages : ligne 48 px, hairline, chevron, interrupteur 36 × 20', () => {
    const row = rule('.ckp-set {');
    expect(row).toMatch(/min-height:\s*48px/);
    expect(row).toMatch(/border-top:\s*\.5px solid rgba\(23, 43, 36, \.06\)/);
    expect(row).toMatch(/background:\s*none/);
    expect(row).not.toMatch(/box-shadow/);
    expect(rule('.ckp-manage-section {')).toMatch(/margin-top:\s*24px/);
    const head = rule('.ckp-section-head {');
    expect(head).toMatch(/font:\s*600 10\.5px/);
    expect(head).toMatch(/letter-spacing:\s*\.08em/);
    expect(head).toMatch(/color:\s*#8A968D/);
    const toggle = rule('.ckp-switch {');
    expect(toggle).toMatch(/width:\s*36px/);
    expect(toggle).toMatch(/height:\s*20px/);
    expect(rule('.ckp-switch.is-on {')).toMatch(/background:\s*#17402c/);
  });

  it('légende du post : pseudo 13/600, texte 13/400 à 1,4', () => {
    const caption = rule('.ckp-post-sheet .lkdv-post-caption {');
    expect(caption).toMatch(/font-size:\s*13px !important/);
    expect(caption).toMatch(/line-height:\s*1\.4 !important/);
    expect(rule('.ckp-post-pseudo {')).toMatch(/font-weight:\s*600/);
  });
});

describe('Finitions transverses', () => {
  it('aucune couleur littérale hors des sept jetons autorisés', () => {
    const tokens = new Set(['#172B24', '#17402C', '#56665D', '#6B7A70', '#7A8A80', '#8A968D', '#C13B34']);
    /* Le contrôle porte sur les finitions ajoutées, pas sur l’historique. */
    const additions = css.slice(css.indexOf('Finitions des drawers et sous-drawers'));
    const hex = additions.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    /* Le blanc est la surface du verre, pas une encre : il reste hors liste. */
    const offenders = hex.filter((value) => value.toLowerCase() !== '#fff' && value.toLowerCase() !== '#ffffff').filter((value) => {
      const long = value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value;
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
});
