/**
 * Chrome haut du preparateur : le libelle qui cede, les trois boutons retires,
 * le scroller de jour reserve a l etape 2, et le message de blocage garde tel
 * quel.
 *
 * Chaque test MORD. Reintroduire l un des defauts decrits le fait rougir.
 *
 *  - L0.3 : le libelle de ligne et la valeur se CHEVAUCHENT. `flex: 1 1 auto`
 *    sans `overflow: hidden` ne suffit pas : un element flex qui retrecit
 *    deborde de sa boite et vient se peindre sur son voisin. Mesure : ligne
 *    « Participants », le texte passait sur « 3 personnes · 1 ad… ».
 *  - L1.1 / L1.2 / L1.3 : plus aucun bouton retour, fermer ni filtres en tete.
 *    Capacites retirees mais toujours atteignables hors flux visible.
 *  - L2.7 : le scroller de journee ne doit pas exister sur l etape 1, qui n a
 *    aucune journee a faire defiler.
 *  - L2.11 : le message « Il manque : … » fonctionne ; on le garde tel quel, on
 *    verrouille donc la formulation exacte pour qu elle n derive pas.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { prepBlockerSummary } from '../components/AdventurePrepShell';
import { stepOneMissing, stepOneProfileIdFor, stepOneReadySummary } from '../components/stepOneProfile';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, PrepStepId } from '../types';

const CSS = readFileSync(
  join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css'),
  'utf8'
);
const SHELL = readFileSync(
  join(process.cwd(), 'src/features/adventure-prep/components/AdventurePrepShell.tsx'),
  'utf8'
);
const DEST = readFileSync(
  join(process.cwd(), 'src/features/adventure-prep/components/DestinationStep.tsx'),
  'utf8'
);

function escapeRe(value: string): string {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, (ch) => '\\' + ch);
}

/** Le corps d une regle, selecteur donne. */
function regle(css: string, selecteur: string): string {
  const source = '(^|\\})\\s*' + escapeRe(selecteur) + '\\s*(?:,[^{]*)?\\{([^}]*)\\}';
  const found = new RegExp(source, 'm').exec(css);
  expect(found, 'regle introuvable : ' + selecteur).not.toBeNull();
  return (found?.[2] ?? '').trim();
}

/**
 * La balise d OUVERTURE du libelle de ligne, exactement.
 *
 * Volontairement pas une fenetre autour du `className` : une fenetre de
 * quelques lignes attrapait aussi la balise voisine, qui porte elle un style
 * inline legitime — le test passait pour une preuve et ne prouvait rien.
 */
function baliseLabel(source: string): string {
  const trouvee = /<span\s+className="prep-block__label"[^>]*>/.exec(source);
  expect(trouvee, 'le libelle de ligne n est plus rendu').not.toBeNull();
  return trouvee?.[0] ?? '';
}

/* ------------------------------------------------------------------ */
/* L0.3 - le libelle cede de la place, il ne REPASSE pas dessus      */
/* ------------------------------------------------------------------ */

describe('L0.3 - le libelle de ligne ne chevauche plus la valeur', () => {
  it('L0.3-01: le libelle est le SEUL element de la ligne qui cede', () => {
    const corps = regle(CSS, '.prep-block__label');
    expect(corps, 'flex: 1 1 auto fait deborder le texte sur la valeur').toMatch(
      /flex:\s*0 1 auto/
    );
    expect(corps).not.toMatch(/flex:\s*1 1 auto/);
  });

  it('L0.3-02: la regle porte les quatre garde-fous du retrecissement', () => {
    const corps = regle(CSS, '.prep-block__label');
    // Sans ces quatre, `flex: 0 1 auto` seul laisse deborder : le defaut
    // d origine ne venait pas du flex seul mais du flex sans confinement.
    expect(corps).toMatch(/min-width:\s*0/);
    expect(corps).toMatch(/overflow:\s*hidden/);
    expect(corps).toMatch(/text-overflow:\s*ellipsis/);
    expect(corps).toMatch(/white-space:\s*nowrap/);
  });

  it('L0.3-03: le libelle ne porte plus de style en ligne', () => {
    // La regle vit dans la feuille de style : une variable CSS custom posee
    // dans le TSX sans declaration CSS viole P0.17, et un `style=` inline
    // sort de la cascade — le correctif serait invisible de la recette.
    expect(baliseLabel(DEST), 'le libelle porte un style en ligne').not.toMatch(/\sstyle=/);
    expect(DEST).not.toMatch(/LABEL_STYLE/);
  });

  it('L0.3-04: la valeur et les avatars ne cedent pas a la place du libelle', () => {
    // Le libelle se raccourcit seul : la valeur doit garder sa place, sinon on
    // aurait deplace le chevauchement au lieu de le supprimer.
    // **Corrige le 2026-09-29** : ce test lisait `const STACK_STYLE` dans le TSX,
    // donc exigeait un style en ligne que L0.3-03 interdit deux tests plus
    // haut, dans le meme fichier. La regle se lit dans la feuille, comme
    // L0.3-02 le fait deja pour le libelle.
    const pile = regle(CSS, '.prep-block__stack');
    expect(pile, 'la valeur ne tient plus sa place').toMatch(/flex:\s*0\s+0\s+auto/);
    // Contre-exemple : une pile reductrice se ferait couper la valeur.
    expect(pile).not.toMatch(/flex:\s*0\s+1\s+auto/);
    // Les avatars non plus ne doivent pas rogner la place de la valeur.
    expect(regle(CSS, '.prep-avatars')).toMatch(/flex:\s*0\s+0\s+auto/);
    // Et elle reste collee au libelle, pas dispersee par la mise en page.
    expect(DEST).toContain('className="prep-block__stack"');
    expect(DEST).not.toMatch(/STACK_STYLE/);
  });
});

/* ------------------------------------------------------------------ */
/* L1.1 / L1.2 / L1.3 - plus aucun bouton de chrome en tete           */
/* ------------------------------------------------------------------ */

describe('L1.1-L1.3 - le bandeau haut ne porte plus de bouton', () => {
  const sources: ReadonlyArray<readonly [string, string]> = [
    ['AdventurePrepShell', SHELL],
    ['DestinationStep', DEST],
  ];

  it('L1.1-03: aucun glyphe de retour dans le chrome du cadre', () => {
    // Le chevron de retour revient des qu une libellisation d icone ou un
    // retour arriere est reecrit.
    for (const [nom, source] of sources) {
      expect(source, 'glyphe de retour dans ' + nom).not.toContain('‹');
    }
  });

  it('L1.2-03: aucun glyphe de fermeture dans le chrome du cadre', () => {
    // La croix recouvrait « En avant ! » sur 393 px.
    for (const [nom, source] of sources) {
      expect(source, 'glyphe de fermeture dans ' + nom).not.toContain('✕');
    }
  });

  it('L1.3-03: aucun glyphe de filtre dans le chrome du cadre', () => {
    for (const [nom, source] of sources) {
      expect(source, 'glyphe de filtre dans ' + nom).not.toContain('▽');
    }
  });

  it('L1.1-04 / L1.2-04 / L1.3-04: plus aucun composant ne pose ces classes', () => {
    for (const [nom, source] of sources) {
      expect(source, nom + ' repose la classe du bouton retire').not.toContain(
        'prep-nav__icon'
      );
    }
  });

  it('L1.1-05: la feuille de style ne porte plus la recette du bouton retire', () => {
    // Le code mort : aucun composant ne pose plus `.prep-nav__icon`, donc la
    // recette ne sert plus rien et expose une surface de retouche.
    expect(CSS).not.toContain('.prep-nav__icon');
  });

  it('L1.2-05: la recette de la croix ne revit pas sous un autre nom', () => {
    // Un retrait propre ne laisse pas un bouton de fermeture renomme.
    expect(SHELL).not.toMatch(/className="[^"]*prep-(?:nav|btn|icon)__close/);
    expect(SHELL).not.toMatch(/className="[^"]*__cross/);
  });
});

/* ------------------------------------------------------------------ */
/* L2.7 - le scroller de journee est reserve a l etape 2              */
/* ------------------------------------------------------------------ */

describe('L2.7 - le scroller de journee reste absent de l etape 1', () => {
  it('L2.7-01: le cadre ne publie le rail que sur un ecran qui affiche des jours', () => {
    expect(SHELL).toMatch(
      /usePrepDayFocusPublisher\(\s*draft,\s*step\s*!==\s*'destination'\s*\)/
    );
  });

  it('L2.7-02: le predicat porte bien sur l etape 1 nommee', () => {
    // `step !== 'departure'` ne conviendrait pas : la premiere condition ferme
    // l etape 1, la seconde laisserait le rail mort sur la creation.
    const at = SHELL.indexOf('usePrepDayFocusPublisher(');
    expect(at).toBeGreaterThanOrEqual(0);
    const appel = SHELL.slice(at, at + 120);
    expect(appel).toContain("'destination'");
    expect(appel).not.toContain("'departure'");
  });
});

/* ------------------------------------------------------------------ */
/* L2.11 - le message de blocage, garde tel quel                      */
/* ------------------------------------------------------------------ */

describe('L2.11 - « Il manque : … » reste exactement ce qu il est', () => {
  /**
   * ARBITRAGE A (2026-09-29) : ce qui bloque, c est `activity` — et rien
   * d autre. La date, l arrivee ET le depart ne bloquent jamais : l IA les
   * tranche, et le moteur part desormais sans origine (B4). Un brouillon
   * « sans depart » n est donc PAS un brouillon bloque.
   *
   * Les fixtures ci-dessous gardent neanmoins un vrai manque (l intention) :
   * sinon le resume serait vide et L2.11 ne prouverait plus rien. C est la
   * meme raison qui faisait utiliser `sansDepart` avant.
   */
  const sansDepart = (): AdventurePrepDraft => {
    const d = fullDraft();
    return { ...d, route: { ...d.route, origin: null } };
  };
  const sansDepartNiActivite = (): AdventurePrepDraft => {
    const d = sansDepart();
    return {
      ...d,
      activities: { ...d.activities, primary: null },
      pickerDismissed: false,
    } as AdventurePrepDraft;
  };

  it('L2.11-01: le libelle garde sa ponctuation francaise exacte', () => {
    // ARBITRAGE A : le depart seul ne bloque plus. On epreuve donc la
    // ponctuation sur la ligne de complements, qui le nomme elle-meme.
    const ready = stepOneReadySummary(sansDepart(), stepOneProfileIdFor(sansDepart().activities));
    expect(ready, 'le depart n est plus annonce du tout').not.toBeNull();
    expect(ready).toContain('lieu de départ');
    // Espace insecable avant les deux-points, aucun apres : la formulation
    // d« L’IA complètera : lieu de départ » est la meme que celle du manque.
    expect(ready).toMatch(/^L’IA complètera : [^ ]/);
    expect(ready).not.toMatch(/complètera:/);
    expect(ready).not.toMatch(/complètera : {2,}/);

    // Et la ligne du MANQUE garde la meme ponctuation, ou elle existe encore :
    // le contrat de la formulation ne depend pas du champ manquant.
    const resume = prepBlockerSummary(sansDepartNiActivite(), 'destination');
    expect(resume, 'la fixture ne bloque plus : le test ne prouve plus rien').not.toBeNull();
    expect(resume).toMatch(/^Il manque : [^ ]/);
    expect(resume).not.toMatch(/Il manque:/);
    expect(resume).not.toMatch(/Il manque : {2,}/);
    expect(resume).toContain('lieu de départ');
  });

  it('L2.11-02: la liste vient de la MEME source que l etape 1', () => {
    // ARBITRAGE A : sur `sansDepart()` il n y a plus de bloqueur, donc plus de
    // ligne « Il manque ». La source reste la meme, et elle se lit desormais
    // dans les complements — avec le depart nomme, sinon la preuve est vide.
    const vide = sansDepart();
    const { blocking, optional } = stepOneMissing(vide, stepOneProfileIdFor(vide.activities));
    expect(blocking, 'le depart ne doit plus bloquer').toEqual([]);
    expect(optional.join(', '), 'le depart doit rester annonce').toContain('lieu de départ');
    expect(prepBlockerSummary(vide, 'destination')).toBeNull();
    expect(stepOneReadySummary(vide, stepOneProfileIdFor(vide.activities))).toBe(
      'L’IA complètera : ' + optional.join(', ')
    );

    // Et la, ou ca bloque encore, le cadre recopie la source, champ compris.
    const dur = sansDepartNiActivite();
    const attendu = stepOneMissing(dur, stepOneProfileIdFor(dur.activities)).blocking.join(', ');
    expect(attendu, 'la fixture ne bloque plus : le test ne prouve plus rien').not.toBe('');
    expect(attendu).toContain('lieu de départ');
    expect(prepBlockerSummary(dur, 'destination')).toBe('Il manque : ' + attendu);
  });

  it('L2.11-03: un manque de plus, aucun manque repete', () => {
    // ARBITRAGE A : le depart seul ne bloque plus (un seul manque = plus de
    // ligne du tout). Pour mesurer un AJOUT de manque, il faut deux niveaux
    // reels : rien qui bloque, puis l intention qui manque en plus du depart.
    const un = sansDepart();
    const deux = sansDepartNiActivite();
    const a = prepBlockerSummary(un, 'destination') ?? '';
    const b = prepBlockerSummary(deux, 'destination') ?? '';
    expect(a, 'un seul manque ne doit plus rien afficher').toBe('');
    // La seconde, elle, nomme le depart : sans ce controle, le comptage
    // ci-dessous pourrait nombrer n'importe quoi.
    expect(b).toContain('lieu de départ');
    // L ordre suit `ENGINE_BLOCKING`, pas l ordre d apparition : ajouter un
    // manque NE DOIT PAS prependre. On exige donc l inclusion des items, pas
    // un prefixe — un prefixe passerait aussi sur une liste reecrite a
    // l identique, ce qui ne prouverait rien.
    const items = (s: string) =>
      s
        .slice('Il manque : '.length)
        .split(', ')
        .filter(Boolean);
    const manquants = items(a);
    for (const item of manquants) {
      expect(items(b), '« ' + item + ' » a disparu du resume').toContain(item);
    }
    expect(items(b).length, 'le resume ne compte pas les deux bloqueurs').toBe(2);
    expect(b, 'le resume ne nomme pas le depart').toContain('lieu de départ');
    expect(new Set(items(b)).size, 'un manque est repete').toBe(items(b).length);
    // Et l affichage suit exactement la source, separateur compris.
    expect(b).toBe(
      'Il manque : ' +
        stepOneMissing(deux, stepOneProfileIdFor(deux.activities)).blocking.join(', ')
    );
  });

  it('L2.11-04: hors de l etape 1, le cadre se tait', () => {
    const vide = sansDepartNiActivite();
    for (const step of ['departure', 'itinerary', 'generate'] as PrepStepId[]) {
      expect(prepBlockerSummary(vide, step), 'le cadre parle sur ' + step).toBeNull();
    }
  });

  it('L2.11-05: rien ne manque, aucun message', () => {
    expect(prepBlockerSummary(fullDraft(), 'destination')).toBeNull();
  });
});