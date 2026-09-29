import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M5.1 — PAS de Scroll-Triggered Storytelling dans le preparateur.
 *
 * LE RISQUE, et pourquoi ce test existe : le patron « storytelling au scroll »
 * — un bloc qui se revele, se dilate ou change d'image quand il entre dans le
 * viewport — est le reflexe le plus courant quand on veut « raconter » un
 * parcours. Il est ici explicitement exclu : `/prepare` est un ecran de SAISIE
 * DENSE. La personne y entre pour choisir, corriger, completer. Un element qui
 * n'apparait qu'au scroll est un element absent du premier regard, donc une
 * information qu'elle croit manquante.
 *
 * UNE PRECISION QUI COMPTE, et qu'il faut avoir mesuree avant d'ecrire ce
 * test : `IntersectionObserver` n'est PAS interdit en soi. `PrepAddStepRail.tsx`
 * s'en sert pour le DEFILEMENT INFINI du rail de lieux : la sentinelle arrive
 * en vue, la page suivante se charge. C'est de la pagination, pas une
 * animation — le contenu ne change pas d'apparence, il s'AJOUTE. C'est
 * exactement le comportement demande par le besoin « jalousie ».
 *
 * Ce qui est interdit, c'est l'autre usage : un observateur qui allume, revele,
 * translate ou re-classe un element selon sa POSITION dans le viewport. On le
 * distingue par sa seule reponse : un observateur de pagination ne fait qu'un
 * `setPage(p + 1)`. Tout ce qu'il fait d'autre releve du storytelling. Ce test
 * verifie donc que CHAQUE observateur du perimetre ne sert qu'a ca.
 *
 * Meme logique pour `sticky` : c'est le seul moyen, en CSS pur, de faire
 * dependre l'affichage d'une position de scroll.
 *
 * PERIMETRE : composants et hooks de ce feature, hors fichiers possedes par
 * d'autres agents — une borne, pas un oubli.
 */

const POSSEDES_PAR_AUTRES = new Set([
  'AdventurePrepShell.tsx',
  'ItineraryStep.tsx',
  'PrepSetupSheets.tsx',
]);

function nomDe(chemin: string): string {
  return chemin.substring(chemin.lastIndexOf(String.fromCharCode(92)) + 1);
}

function fichiersDuFeature(dossier: string): readonly { chemin: string; texte: string }[] {
  return readdirSync(dossier)
    .map((n) => join(dossier, n))
    .filter((c) => statSync(c).isFile() && /[.]tsx?$/.test(c))
    .map((c) => ({ chemin: c, texte: readFileSync(c, 'utf8') }));
}

const PERIMETRE = [
  ...fichiersDuFeature(join(__dirname, '..', 'components')),
  ...fichiersDuFeature(join(__dirname, '..', 'hooks')),
].filter((f) => !POSSEDES_PAR_AUTRES.has(nomDe(f.chemin)));

/** Le bloc de CHAQUE observateur du perimetre. */
function observateurs(texte: string): readonly string[] {
  const blocs: string[] = [];
  const clef = 'new IntersectionObserver(';
  let i = texte.indexOf(clef);
  while (i !== -1) {
    let profondeur = 0;
    let j = i + clef.length - 1;
    for (; j < texte.length; j += 1) {
      if (texte[j] === '(') profondeur += 1;
      else if (texte[j] === ')') { profondeur -= 1; if (profondeur === 0) break; }
    }
    blocs.push(texte.slice(i, j + 1));
    i = texte.indexOf(clef, j);
  }
  return blocs;
}

describe('M5.1 — aucun affichage ne depend de la position de scroll', () => {
  it('M5-01: chaque IntersectionObserver ne sert qu a charger une page de plus', () => {
    // Un observateur de pagination change UN nombre de page. Un observateur de
    // storytelling change l'etat VISIBLE d'un element. On autorise donc le
    // premier et on refuse tout ce qui reagit a l'entree dans le viewport.
    const INTERDIT = [
      'setVisible', 'setReveal', 'setShown', 'setActive', 'setInView',
      'opacity', 'transform', 'classList', 'animate', 'scrollY', 'getBoundingClientRect',
    ];
    const coupables = PERIMETRE.flatMap((f) =>
      observateurs(f.texte).flatMap((bloc) =>
        INTERDIT.filter((mot) => bloc.includes(mot)).map((mot) => `${nomDe(f.chemin)} : ${mot}`),
      ),
    );
    expect(coupables).toEqual([]);
  });

  it('M5-02: le seul observateur du perimetre EST bien la pagination du rail', () => {
    // Contre-temoin. Sans lui, M5-01 passerait sur un perimetre vide. Ce test
    // verifie au contraire que l'observateur autorise existe et fait bien le
    // travail de pagination — donc qu'on n'a pas interdit une vraie fonctionnalite.
    const blocs = PERIMETRE.flatMap((f) => observateurs(f.texte).map((b) => ({ f, b })));
    expect(blocs.length).toBe(1);
    expect(nomDe(blocs[0].f.chemin)).toBe('PrepAddStepRail.tsx');
    expect(blocs[0].b).toContain('setPage');
    expect(blocs[0].b).toContain('isIntersecting');
  });

  it('M5-03: aucune position sticky dans les styles inline', () => {
    const STICKY = /(?:position[ ]*:[ ]*["']sticky["'])/;
    const coupables = PERIMETRE.filter((f) => STICKY.test(f.texte)).map((f) => nomDe(f.chemin));
    expect(coupables).toEqual([]);
  });

  it('M5-04: aucun composant n ecoute l evenement scroll', () => {
    // Le scroll n'est pas interdit — le programme est vertical, on ne peut
    // pas le supprimer. Ce qui est interdit, c'est de s'en servir comme source
    // d'affichage.
    const ecoute = PERIMETRE
      .filter((f) => /addEventListener[(]["']scroll["']/.test(f.texte))
      .map((f) => nomDe(f.chemin));
    expect(ecoute).toEqual([]);
  });

  it('M5-05: le perimetre mesure est bien reel (garde du test lui-meme)', () => {
    // Un perimetre vide ferait passer M5-01, M5-03 et M5-04 sans rien verifier.
    expect(PERIMETRE.length).toBeGreaterThan(10);
    expect(PERIMETRE.some((f) => nomDe(f.chemin) === 'useDaySwipe.ts')).toBe(true);
  });
});
