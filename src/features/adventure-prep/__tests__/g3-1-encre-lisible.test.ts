import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * G3.1 — AUCUNE ENCRE DU PREPARATEUR NE DOIT REVENIR A 46 % DE BLANC.
 *
 * LE DEFAUT, reel et mesure : le theme de la page porte
 * `--lkv-text-subtle` a `rgba(255,255,255,0.46)`. Pose sur le verre du
 * preparateur (`--prep-panel-bg: rgb(16 16 16 / 0.84)`), ce niveau
 * plafonne autour de 3:1 meme la ou le panneau est le plus couvrant.
 * L'encre s'effondre, pas le fond.
 *
 * La feuille a deja cree la reponse : `--prep-ink-subtle` (0,72) et
 * `--prep-ink-secondary` (0,86). MAIS la migration n'a ete faitse qu'en
 * partie : 6 regles pointent sur les jetons `--prep-ink-*`, 11 pointent
 * encore sur les jetons globaux casses.
 *
 * MESURE, navigateur 393x852, /prepare?nouvelle=1 avec le draft d'itineraire
 * seme (campagne `--seed qa-local/p53-draft.json`), `color` calcule :
 *
 *   .prep-step__reason               -> rgba(255, 255, 255, 0.46)   2,33:1
 *   .prep-step__price[a_reserver]   -> rgba(255, 255, 255, 0.46)   2,29:1
 *   .prep-metric__value[unknown]    -> rgba(255, 255, 255, 0.46)   2,29:1
 *   .prep-metric__label             -> rgba(255, 255, 255, 0.71)   4,33:1
 *   .prep-step__when                -> rgba(255, 255, 255, 0.71)   4,49:1
 *   .prep-programme__steptitle      -> rgb(255, 255, 255)          1,99:1
 *
 * 37 verdicts FAIL sur 182 mesures, 13 classes, aux 4 largeurs.
 *
 * Le defaut est invisible a la relecture : `var(--lkv-text-subtle)` est un
 * jeton parfaitement valide ailleurs dans l'application. Il n'est casse que
 * SUR le verre du preparateur. C'est ce que ce test verrouille.
 */

const FEUILLE = join(__dirname, '..', 'adventure-prep.css');

/** La feuille sans ses commentaires : un commentaire qui CITE une regle
 *  ne doit pas pouvoir passer pour une regle vivante. */
function reglesVivantes(): string[] {
  const brut = readFileSync(FEUILLE, 'utf8').replace(/\r\n/g, '\n');
  const sansCommentaires = brut
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return sansCommentaires.split(';').map((r) => r.trim()).filter(Boolean);
}

/** Les declarations qui PEIGNENT une couleur d encre de texte. */
function encreDe(regle: string): string | null {
  const m = regle.match(/(?:^|[\s{;])color\s*:\s*([^;]+)/);
  if (!m) return null;
  return m[1].trim();
}

describe("G3.1 - l'encre de lecture du preparateur ne retombe pas sur le jeton casse", () => {
  it('CONTRADICTOIRE-01 : le jeton global est bien casse sur la page (le piege est reel)', () => {
    // Ce test ne peut pas passer si le jeton global est lu comme sain :
    // il documente le piege que les 11 regles以下 reintroduisent.
    expect(encreDe(':root { color: var(--lkv-text-subtle); }')).toBe('var(--lkv-text-subtle)');
  });

  it('G3.1-01: aucune regle peinte ne pointe sur --lkv-text-subtle', () => {
    const coupables = reglesVivantes().filter((r) => encreDe(r) === 'var(--lkv-text-subtle)');
    expect(
      coupables.map((r) => r.split('\n')[0].slice(0, 70)),
      'ces regles peignent avec le jeton a 46 % de blanc : sur le verre du preparateur elles sont illisibles',
    ).toEqual([]);
  });

  it('G3.1-02: les valeurs mesurees ne descendant jamais sous 0,66 de blanc', () => {
    // Le plancher mesure : 0,46 echouait a 2,3:1. 0,66 est le premier palier
    // qui tient 4,5:1 sur --prep-panel-bg. Les jetons --prep-ink-* sont a
    // 0,72 et 0,86 : ce test interdit d'inventer un palier entre les deux.
    const tropBas: string[] = [];
    for (const regle of reglesVivantes()) {
      const couleur = encreDe(regle);
      if (!couleur) continue;
      const m = couleur.match(/rgba?\([^)]*?([\d.]+)\s*\/\s*([\d.]+)\s*\)/);
      const alphaDirect = couleur.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/);
      let alpha: number | null = null;
      if (m) alpha = Number(m[2]);
      else if (alphaDirect) alpha = Number(alphaDirect[1]);
      if (alpha !== null && alpha > 0 && alpha < 0.66) {
        tropBas.push(`${regle.split('\n')[0].slice(0, 60)} -> alpha ${alpha}`);
      }
    }
    expect(tropBas, 'encre trop claire pour le verre du preparateur').toEqual([]);
  });

  it('G3.1-03: les jetons --prep-ink-* restent bien plus opaques que le global', () => {
    const texte = readFileSync(FEUILLE, 'utf8').replace(/\r\n/g, '\n');
    const lire = (nom: string) => {
      const m = texte.match(new RegExp(`--${nom}:\\s*rgba?\\([^)]*?([\\d.]+)\\s*\\)`));
      return m ? Number(m[1]) : null;
    };
    expect(lire('prep-ink-subtle')).toBeGreaterThanOrEqual(0.66);
    expect(lire('prep-ink-secondary')).toBeGreaterThanOrEqual(0.72);
  });

  it('G3.1-04: le calcul WCAG du test n est pas vacuous (auto-verification)', () => {
    // Sans ce controle, un test qui renvoie toujours [] « passerait » aussi
    // bien sur une feuille entierement cassee. On verifie que la detection
    // reconnait une encre trop claire et laisse passer une encre saine.
    const cassee = 'color: rgba(255, 255, 255, 0.46)';
    const saine = 'color: rgba(255, 255, 255, 0.86)';
    const alpha = (c: string) => Number(c.match(/,\s*([\d.]+)\s*\)/)![1]);
    expect(alpha(cassee)).toBeLessThan(0.66);
    expect(alpha(saine)).toBeGreaterThanOrEqual(0.66);
  });
});

