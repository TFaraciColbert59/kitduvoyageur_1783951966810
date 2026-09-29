import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'adventure-prep.css'), 'utf8');
const tokens = readFileSync(join(here, '..', '..', '..', 'styles', 'tokens.css'), 'utf8');

/**
 * P0.20 — le pied collant / la coupe AN9 rendait le dernier bloc invisible.
 *
 * LA MESURE, qui tranche le ticket (et que ces tests verrouillent) :
 *
 *   .prep-body    top 60   bottom 528   clientHeight 468   maxScroll 181
 *   .prep-footer  top 528  bottom 593   position: relative
 *
 *   bodyBottom === footerTop === 528  ->  le pied ne RECOUVRE rien.
 *
 * Le pied est un FRERE flex sous le scrollport, pas une couche au-dessus. La
 * coupe est celle du scrollport : c'est le principe meme d'un port defilant,
 * pas un defaut de mise en page. Le dire « defaut » serait denier la mesure.
 *
 * LE RESIDU ASSUME, et la decision qui le ferme : au repos, le dernier bloc
 * reste BISECTE par la ligne de coupe. C'est ce que fait tout port defilant
 * dont le contenu depasse : le contenu est plus grand que la fenetre.
 *
 *   pastille « Duree proposee · modifiable »  top 507.4  bottom 547  (h 39.6)
 *   => 20.6 px visibles au repos (52 %), et 39.6 / 39.6 = 100 % apres
 *      40 px de defilement.
 *
 * 40 px suffisent. Le contenu est donc ATTEIGNABLE, et c'est la seule question
 * qui vaille : un contenu qu'on ne peut pas faire entrer dans la fenetre est
 * un contenu perdu, un contenu qu'on peut faire remonter n'en est pas un.
 *
 * Degonfler automatiquement au changement d'etat serait un changement de
 * COMPORTEMENT d'interface, pas une reparation : la personne perdrait sa
 * position de lecture a chaque re-rendu. Volontairement non fait, et dit ici.
 *
 * Ces tests ne{refaer} pas une mise en page. Ils verrouillent les TROIS
 * invariants qui rendent le residu acceptable, et qui interdisENT qu'un jour il
 * cesse de l'etre :
 *   1. le pied n'est JAMAIS en couche (donc il ne peut pas recouvrir) ;
 *   2. la zone defile VRAIMENT (donc 40 px suffisent toujours) ;
 *   3. la reserve basse fait que le dernier bloc n'est jamais PERDU — il
 *      s'arrete au-dessus de la zone estompee, meme a fond de course.
 * Perdre l'un des trois, ce serait retrouver le vrai defaut.
 */
describe('P0.20 — le pied ne recouvre rien : le residu est un port defilant', () => {
  /**
  /**
   * La regle CANONIQUE du selecteur, hors surcharge conditionnelle.
   *
   * `.prep-footer` est pose plusieurs fois : le materiau de verre, la barre
   * d action reelle, et — sous `@media (max-height: 500px)` — un
   * `position: sticky` de secours pour les claviers ouverts. Prendre la
   * premiere ou la derniere revient a mesurer le mauvais bloc.
   *
   * On selectionne donc la regle par son CONTENU : elle est la seule a poser
   * `flex: 0 0 auto` (pied) ou `flex: 1 1 auto` (corps). La surcharge
   * conditionnelle ne les porte pas, donc elle est ecartee d office.
   */
  function regle(sel: string): string {
    const echappe = sel.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const re = new RegExp(echappe + String.raw`\s*\{([^}]*)\}`, 'g');
    const blocs = [...css.matchAll(re)].map((m) => m[1] ?? '');
    return blocs.find((b) => /flex:\s*[01]\s+0\s+auto/.test(b)) ?? blocs[0] ?? '';
  }

  function jeton(nom: string): number {
    const m = css.match(new RegExp(nom + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px'));
    if (!m) throw new Error(nom + ' absent');
    return Number(m[1]);
  }

  function jetonTokens(nom: string): number {
    const m = tokens.match(new RegExp(nom + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px'));
    if (!m) throw new Error(nom + ' absent de tokens.css');
    return Number(m[1]);
  }

  const pied = regle('.prep-footer');
  const corps = regle('.prep-body');

  it('INVARIANT 1 — le pied est un frere du scrollport, jamais une couche', () => {
    // C est LA mesure qui dement le ticket : position: relative. Un `fixed`,
    // un `absolute` ou un `sticky` reposant sur le corps remettrait la
    // superposition au monde, et le bandeau de la coupe serait de nouveau
    // fonctionnel.
    expect(pied).toMatch(/position:\s*relative/);
    expect(pied).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
  });

  it('INVARIANT 1 bis — il est aussi ITON ET non comprime, donc hors du flux', () => {
    // `flex: 0 0 auto` : le pied garde sa hauteur exacte et ne rogne jamais le
    // scrollport. C est ce qui garantit bodyBottom === footerTop.
    expect(pied).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(corps).toMatch(/flex:\s*1\s+1\s+auto/);
  });

  it('INVARIANT 2 — le corps defile vraiment, sur un seul axe', () => {
    // Sans cela, les 40 px de defilement mesures n existeraient pas et le
    // dernier bloc serait reellement inaccessible.
    expect(corps).toMatch(/overflow-y:\s*auto/);
    // `min-height: 0` est indispensable dans une colonne flex : sans lui le
    // scrollport refuse de descendre sous la taille de son contenu et le
    // defilement disparait.
    expect(corps).toMatch(/min-height:\s*0/);
  });

  it('INVARIANT 2 bis — aucun enfant ne peut etre ecrase par le manque', () => {
    // Un bloc comprime a 0 px serait un contenu perdu : la reserve basse ne
    // servirait a rien si le flex pouvait labouffer.
    const enfants = regle('.prep-body > *');
    expect(enfants).toMatch(/flex-shrink:\s*0/);
  });

  it('INVARIANT 3 — la reserve basse couvre le fondu ET la respiration', () => {
    // A fond de course, le dernier bloc s'arrete AU-DESSUS de la zone estompee.
    // Sans cette reserve, le dernier bloc serait PERDU dans le fondu, et la
    // decision « port defilant » ne tiendrait plus : on aurait de la perte, pas
    // de la coupe.
    const padding = corps.match(/padding:\s*([^;]+);/)?.[1] ?? '';
    expect(padding).toContain('var(--prep-scroll-fade-h)');
    expect(padding).toContain('var(--space-6)');
    // La langue de verre (20 px) tient elle aussi dans la reserve du corps :
    // au-dela, elle ternirait le dernier bloc en permanence.
    expect(jeton('--prep-scroll-lip-h')).toBeLessThanOrEqual(jetonTokens('--space-6'));
  });

  it('le fondu porte une ligne entiere : 32 px > 20 px de langue', () => {
    // Ratio mesure : si le fondu etait plus court que la langue, la coupe
    // nette reapparaitrait entre les deux — le glyphe resterait tranche en
    // plein milieu, ce que AN9 ne voulait PAS dire.
    expect(jeton('--prep-scroll-fade-h')).toBeGreaterThanOrEqual(jeton('--prep-scroll-lip-h'));
  });
  it('DECISION — on ne degonfle pas automatiquement au changement d etat', () => {
    // Une correction automatique du defaut P0.20 introduirait un
    // comportement d'interface qui n existe pas : la personne perdrait sa
    // position de lecture a chaque re-rendu. La coupe d un port defilant est
    // un comportement ASSUME, a 40 px de distance.
    //
    // Ce test porte sur NOS deux blocs — corps et pied — et sur rien d
    // autre : scroll-behavior existe ailleurs dans la feuille pour un autre
    // chantier, et sa presence ici n aurait rien a voir avec le defaut P0.20.
    // Un defilement pilote ferait sauter la coupe a chaque re-rendu : la
    // personne perdrait sa position de lecture, ce qui est pire que la coupe.
    expect(corps).not.toMatch(/(?<!over)scroll-behavior/);
    expect(pied).not.toMatch(/scroll-behavior/);
  });
});
