import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrepCrumb } from '../components/PrepCrumb';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, PrepStepId } from '../types';

/*
 * L1.4 - Le fil d etapes est en PASTILLES DE VERRE, actif visible, sans
 * debordement.
 *
 * Deux choses sont verrouillees, et les deux tombent si on touche la recette :
 *
 *  1. la GEOMETRIE de la pastille (coins ronds, verre flou, bord) est lue
 *     dans la feuille de style, parce qu elle ne se voit pas dans le HTML
 *     statique ;
 *  2. l ETAT de l etape courante reste deduisible SANS la couleur - meme
 *     exigence que CR-02. On verifie donc que l etape active se distingue des
 *     deux autres par son remplissage, son epaisseur de bordure et sa
 *     graisse, et pas par une teinte.
 */

const CSS_PATH = join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css');
const CRUMB_PATH = join(process.cwd(), 'src/features/adventure-prep/components/PrepCrumb.tsx');
const css = readFileSync(CSS_PATH, 'utf8');

/** Echappement d un selecteur pour une source de regexp. */
function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (ch) => '\\' + ch);
}

/**
 * Le corps d une regle, selecteur donne.
 *
 * Volontairement ecrit sans template literal imbrique : un `${...}` dans un
 * caractere de classe de regexp casse silencieusement l echappement, et le
 * symptome est « regle introuvable » sur les selecteurs a attribut — c est-a-dire
 * exactement ceux qui portent l etat. Le test aurait alors passe pour une
 * absence de regle.
 */
function regle(selecteur: string): string {
  const source = '(^|\\})\\s*' + escapeRe(selecteur) + '\\s*(?:,[^{]*)?\\{([^}]*)\\}';
  const found = new RegExp(source, 'm').exec(css);
  expect(found, 'regle introuvable : ' + selecteur).not.toBeNull();
  return (found?.[2] ?? '').trim();
}

function crumb(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepCrumb, { step, draft }));
}

/**
 * Un draft ou les trois etats sont presents ET distincts : etape 1 atteinte,
 * etape 2 en cours, etape 3 encore sans contenu. Sans cela on ne peut pas
 * comparer le remplissage du verrouille a celui de l actif.
 */
function draftTroisEtats(): AdventurePrepDraft {
  return fullDraft({ completedSteps: ['destination'] });
}

describe('L1.4 - geometrie de la pastille de verre', () => {
  it('L1.4-01: la pastille a des coins ronds, pas un rectangle', () => {
    expect(regle('.prep-crumb__label')).toContain('border-radius: var(--lkv-radius-full)');
  });

  it('L1.4-02: la pastille est en verre flou, pas un aplat', () => {
    const corps = regle('.prep-crumb__label');
    expect(corps).toMatch(/backdrop-filter:\s*blur\(/);
    expect(corps).toContain('-webkit-backdrop-filter: blur(');
    // Le verre suppose une surface reellement translucide : un remplissage
    // pose par le composant, pas une couleur pleine ecrite en dur.
    expect(corps).toContain('var(--crumb-fill');
  });

  it('L1.4-03: la pastille a un bord, pas seulement une couleur de texte', () => {
    expect(regle('.prep-crumb__label')).toMatch(/border:\s*1px solid var\(--crumb-edge/);
  });

  it('L1.4-04: le composant ne decide aucune couleur, il ne pose que des variables', () => {
    // H6 : une couleur codee en dur dans un composant ne se retraite pas toute
    // seule. Le composant nomme l etat, la feuille de style fait le verre.
    const source = readFileSync(CRUMB_PATH, 'utf8');
    const debut = source.indexOf('const SEGMENT_LOOK');
    const look = source.slice(debut, source.indexOf('};', debut));
    expect(look).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    // rgb(), rgba(), rgb() moderne et hsl() : toute couleur litterale est
    // refusee, pas seulement le hex.
    expect(look).not.toMatch(/rgba?\(|hsla?\(|oklch\(/);
    expect(look).not.toMatch(/\b(white|black)\b/i);
    for (const v of ['--crumb-ink', '--crumb-edge', '--crumb-fill', '--crumb-sheen']) {
      expect(look).toContain(v);
    }
    // Et le reflet de bord vient d un token, lui aussi partage (P5.1).
    expect(look).toContain('var(--prep-sheen-top');
  });
});

describe('L1.4 - etat actif visible SANS la couleur', () => {
  it('L1.4-05: les trois etats ont trois remplissages distincts', () => {
    const html = crumb('itinerary', draftTroisEtats());
    expect([...html.matchAll(/data-state="([a-z]+)"/g)].map((m) => m[1])).toEqual([
      'done',
      'active',
      'locked',
    ]);
    const fills = [...html.matchAll(/--crumb-fill:\s*([^;"]+)/g)].map((m) => m[1].trim());
    expect(fills).toHaveLength(3);
    expect(new Set(fills).size).toBe(3);
    // Le verrouille est le seul a n etre pas verre du tout.
    expect(fills[2]).toBe('transparent');
  });

  it('L1.4-06: l etape courante porte aria-current ET une bordure plus epaisse', () => {
    expect(crumb('itinerary', draftTroisEtats())).toContain('aria-current="step"');
    // L epaisseur est la seconde voie de lecture, sans la couleur.
    expect(regle(".prep-crumb__label[data-current='true']")).toContain('border-width: 1.5px');
  });

  it('L1.4-07: la graisse distingue l actif du verrouille', () => {
    const poids = [...crumb('itinerary', draftTroisEtats()).matchAll(/font-weight:\s*(\d+)/g)].map(
      (m) => Number(m[1]),
    );
    expect(poids).toHaveLength(3);
    // verrouille 560 < atteint 640 < actif 720 : un ordre, donc une lecture
    // possible meme en niveaux de gris.
    expect(poids[2]).toBeLessThan(poids[0]);
    expect(poids[0]).toBeLessThan(poids[1]);
  });

  it('L1.4-08: une etape verrouillee se distingue par un bord en pointilles', () => {
    expect(regle(".prep-crumb__label[data-locked='true']")).toContain('border-style: dashed');
  });
});

describe('L1.4 - aucun debordement', () => {
  it('L1.4-09: la pastille se raccourcit au lieu de pousser le rail', () => {
    const corps = regle('.prep-crumb__label');
    expect(corps).toContain('max-width: 100%');
    expect(corps).toContain('overflow: hidden');
    expect(corps).toContain('text-overflow: ellipsis');
    expect(corps).toContain('white-space: nowrap');
  });

  it('L1.4-10: la pastille peut retrecir dans le rail (0 1 auto, jamais 0 0 auto)', () => {
    // 0 0 auto est ce qui fit deborder le rail sur un ecran etroit ; c est le
    // point exact que la consigne « sans debordement » demande de verrouiller.
    expect(regle('.prep-crumb__item')).toContain('flex: 0 1 auto');
    expect(regle('.prep-crumb__item')).toContain('min-width: 0');
    expect(regle('.prep-crumb')).toContain('min-width: 0');
  });

  it('L1.4-11: le separateur est un trait de verre, pas un glyphe de texte', () => {
    // Un glyphe a une hauteur de ligne : il faisait sauter la hauteur du rail
    // d une etape a l autre. Le trait, lui, ne pese rien.
    const sep = regle('.prep-crumb__sep');
    expect(sep).toContain('height: 1px');
    // Aucun `font-size: 0` ici : etouffer un glyphe par une taille ecrite en
    // dur serait une valeur inventee. Le glyphe a ete retire a la source, dans
    // LES DEUX appelants du separateur.
    expect(sep).not.toMatch(/font-size:\s*0/);
    expect(sep).toContain('line-height: 0');
    const shell = readFileSync(
      join(process.cwd(), 'src/features/adventure-prep/components/AdventurePrepShell.tsx'),
      'utf8',
    );
    expect(shell.slice(shell.indexOf('function PrepGateRail'))).not.toContain('\u00b7');
    expect(sep).toContain('flex: 0 0 auto');
    expect(sep).toContain('overflow: hidden');
    expect(sep).toContain('width: 10px');
    // Et le HTML ne porte plus aucun « · » : le separateur reste decoratif,
    // muet, et independant de la typo de l appelant qui construit le meme
    // rail (AdventurePrepShell) - la recette est identique des deux cotes.
    expect(crumb('itinerary', draftTroisEtats())).not.toContain('\u00b7');
  });

  it('L1.4-12: la pastille est bornee en hauteur et ne fait pas grandir le rail', () => {
    expect(regle('.prep-crumb__label')).toContain('min-height: 26px');
    expect(regle('.prep-crumb__label')).toContain('line-height: 18px');
  });

  it('L1.4-13: le rail reste un <ol> nomme de trois elements, separateurs compris', () => {
    // La pastille a change de matiere, pas de structure : l ordre des etapes
    // reste annonce, et les deux separateurs restent decoratifs (CR-07).
    const html = crumb('itinerary', draftTroisEtats());
    expect(html).toContain('<ol');
    expect(html).toContain('aria-label="\u00c9tapes de la pr\u00e9paration"');
    expect([...html.matchAll(/class="prep-crumb__item"/g)]).toHaveLength(3);
    expect([...html.matchAll(/aria-hidden="true"/g)]).toHaveLength(2);
  });
});
