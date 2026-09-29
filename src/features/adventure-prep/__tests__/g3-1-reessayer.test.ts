import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * G3.1 (suite) - L ACTION « Réessayer » NE TOMBE PAS SOUS LE SEUIL.
 *
 * LE DEFAUT, reel et mesure : la campagne navigateur 393x852 sur un draft
 * genere (`--seed qa-local/p53-draft.json`) laissait UN seul echec sur
 * 190 elements mesures, et le meme sur les 4 largeurs - donc un element
 * deterministe, pas du bruit d antialiasing :
 *
 *   bouton « Réessayer »  worst 4,50:1   seuil 4,5:1   VERDICT FAIL
 *   encre    rgb(169, 230, 198)   (--prep-ink-accent-strong)
 *   fond     rgb(92, 92, 92)      (NOTICE_BOX, melange --lkv-warning-dark)
 *
 * L accent fort tient 5,02:1 sur le PANNEAU DU TIROIR, ce que dit la
 * feuille de style. La plaque d avertissement est un autre fond : le meme
 * accent y descend juste sous le seuil. Un jeton verifie sur une surface ne
 * vaut pas verification sur l autre - c est exactement ce que la mesure au
 * pixel attrape, et que la lecture du code laisse passer.
 *
 * Le correctif porte l ACTION, pas le jeton : l accent reste l accent partout
 * ailleurs. Ici le fond est ambre, donc l encre de TEXTE passe en blanc plein
 * (`--prep-ink-full`), deja declare pour cela dans la couche de tokens.
 */

const SHELL = readFileSync(
  join(__dirname, '..', 'components', 'AdventurePrepShell.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

/** La declaration d une constante de style, commentaires retires. */
function declaration(nom: string): string {
  // On retire les commentaires AVANT de chercher la fin : une regleRelevee
  // dans un commentaire porterait des accolades et tronquerait la lecture.
  const vivant = SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\r\n/g, '\n');
  const i = vivant.indexOf(`const ${nom}: React.CSSProperties = {`);
  if (i < 0) throw new Error(`declaration absente : ${nom}`);
  const fin = vivant.indexOf('\n};', i);
  return vivant.slice(i, fin);
}

describe("G3.1 - l action Réessayer tient le seuil sur la plaque d avertissement", () => {
  it('REESSAYER-01: le bouton ne porte plus l accent, trop juste sur ce fond', () => {
    const action = declaration('NOTICE_ACTION');
    // L accent fort est mesure a 4,50:1 sur cette plaque : juste SOUS 4,5.
    // Interdire explicitement vaut mieux qu escompter un arrondi reussi.
    expect(action).not.toMatch(/color:\s*['"]?var\(--prep-ink-accent-strong\)['"]?/);
    expect(action).toMatch(/color:\s*['"]?var\(--prep-ink-full\)['"]?/);
  });

  it('REESSAYER-02: la bordure reste l accent - elle est un trait, pas du texte', () => {
    // Le contrat de la feuille : `--prep-ink-accent` pour les traits,
    // `--prep-ink-accent-strong` pour le texte pose. On ne casse pas le trait.
    const action = declaration('NOTICE_ACTION');
    expect(action).toMatch(/border:[^;]*var\(--lkv-action\)/);
  });

  it('REESSAYER-03: le fond d avertissement n a pas ete repeint pour faire passer', () => {
    // Changer le fond aurait tenu le seuil tout aussi vite, mais l avertissement
    // doit rester l avertissement : on corrige l encre, pas la surface.
    expect(declaration('NOTICE_BOX')).toMatch(/--lkv-warning-dark/);
  });

  it('REESSAYER-04: le libelle du bouton n a pas disparu avec le defaut', () => {
    expect(SHELL).toContain('Réessayer');
  });
});
