import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M4.1 / M4.2 / M5.2 — le VERT est le seul accent ; aucun orange n entre.
 *
 * LE DEFAUT RENCONTRE, etait reel et muet :
 *   DepartureStep.tsx, DestinationStep.tsx et PrepInviteScreen.tsx lisaient
 *   `var(--f-body)`, `var(--f-sec)`, `var(--green-tint)`, `var(--green-ink)`,
 *   `var(--ink-2)`, `var(--line)`… AUCUNE feuille .css du depot ne definit ces
 *   jetons. Une variable CSS non definie ne rend aucune couleur : la
 *   substitution echoue SILENCIEUSEMENT et la propriete retombe sur sa valeur
 *   heritee. Un titre perdait sa taille, un bandeau perdait son accent vert, et
 *   aucun signal n arrivait — une couleur qui n arrive pas ne se voit pas.
 *
 *   design-tokens-p017.test.ts VERIFIE deja ce contrat, mais sur les .css
 *   SEULEMENT : ses deux lectures balaient `entry.endsWith('.css')`. Les
 *   composants .tsx lui echappaient entierement. Ces tests ferment donc la
 *   meme classe de defaut, de l autre cote du mur.
 *
 * CE QUE CES TESTS PROUVENT : un composant du perimetre non possede ne
 * peut plus referencer un jeton de couleur non defini, ni ecrire une couleur
 * en dur. Ce sont les deux seules facons, cote composant, d introduire un hue
 * hors palette.
 *
 * CE QU ILS NE PROUVENT PAS, et le disent : la feuille
 * `adventure-prep.css` a un AUTRE proprietaire, vivant ; ce fichier ne la
 * touche pas. Et AdventurePrepShell.tsx, ItineraryStep.tsx et
 * PrepSetupSheets.tsx appartiennent a d autres agents : ils sont EXCLUS de
 * la liste, pas oublies. Leurs jetons morts sont signales separement.
 *
 * M5.2 (palette « Aurora UI ») et M4.1 relevent de la MEME garde : un seul
 * test, un seul serment. Les cocher separement promettrait deux fois la
 * meme preuve.
 */

/** Les fichiers que cet agent possede, et SEULEMENT eux. */
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

/** Toutes les declarations de jetons du depot : ce que le navigateur connait. */
function jetonsDeclares(): Set<string> {
  const declares = new Set<string>();
  const parcourir = (dossier: string): void => {
    for (const nom of readdirSync(dossier)) {
      if (nom === 'node_modules' || nom === '.next' || nom === '.git') continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) { parcourir(chemin); continue; }
      if (!chemin.endsWith('.css')) continue;
      for (const m of readFileSync(chemin, 'utf8').matchAll(/(--[A-Za-z0-9_-]+)[ ]*:/g)) {
        declares.add(m[1]);
      }
    }
  };
  parcourir(join(__dirname, '..', '..', '..'));
  return declares;
}

describe('M4.1 / M5.2 — aucun jeton de couleur mort dans le perimetre', () => {
  it('M4-01: plus aucun composant ne reference un jeton --amber-*', () => {
    const detail = PERIMETRE.flatMap((f) =>
      [...f.texte.matchAll(/--amber[A-Za-z0-9_-]*/g)].map((m) => `${nomDe(f.chemin)} : ${m[0]}`),
    );
    expect(detail).toEqual([]);
  });

  it('M4-02: chaque jeton reference par un composant EXISTE dans une feuille', () => {
    const declares = jetonsDeclares();
    const orphelins = PERIMETRE.flatMap((f) =>
      [...f.texte.matchAll(/var[(](--[A-Za-z0-9_-]+)/g)]
        .map((m) => m[1])
        .filter((nom) => !declares.has(nom))
        .map((nom) => `${nomDe(f.chemin)} : ${nom}`),
    );
    expect([...new Set(orphelins)]).toEqual([]);
  });

  it('M4-03: chaque ton d alerte passe par le jeton de MARQUE', () => {
    // Garde positive ET exhaustive : le correctif ne doit pas avoir supprime
    // l'accent, il doit l'avoir branche sur la palette reelle. On compte donc
    // le nombre EXACT d'occurrences attendues — sans cela, en supprimer une seule
    // laisserait `length > 0` vrai et le test ne mordrait pas.
    const attendu = PERIMETRE.flatMap((f) =>
      [...f.texte.matchAll(/var[(]--lkv-warning[)]/g)].map(() => nomDe(f.chemin)),
    );
    expect(attendu.length).toBe(4);
    expect(attendu.filter((n) => n === 'DepartureStep.tsx').length).toBe(3);
    expect(attendu.filter((n) => n === 'PrepGearSheets.tsx').length).toBe(1);
  });

  it('M4-05: le perimetre mesure est bien reel (garde du test lui-meme)', () => {
    // Un perimetre vide ferait passer M4-01 et M4-02 sans rien verifier.
    expect(PERIMETRE.length).toBeGreaterThan(10);
    expect(PERIMETRE.some((f) => nomDe(f.chemin) === 'DepartureStep.tsx')).toBe(true);
  });
});

describe('M4.2 — une seule teinte d accent, le reste en niveaux de verre', () => {
  it('M4-04: aucun composant n ecrit une couleur en dur dans un style inline', () => {
    const ECRITE = /(?:color|backgroundColor|background)[ ]*:[ ]*['"`]#[0-9a-fA-F]{3,8}/;
    const coupables = PERIMETRE.filter((f) => ECRITE.test(f.texte)).map((f) => nomDe(f.chemin));
    expect(coupables).toEqual([]);
  });
});
