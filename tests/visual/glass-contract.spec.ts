/**
 * Contrat de verre - un seul fichier, deux runners.
 *
 * POURQUOI ce fichier est double.
 * Les assertions qui font sa valeur (backdrop-filter, cible 44 px, focus,
 * media queries) se mesurent sur une PAGE VIVANTE : sans navigateur elles ne
 * s'executent pas. Tant que sa seule porte d'entree etait `npm run test:glass`,
 * le contraste de l'action principale etait tenu par CHANCE, jamais par
 * contrat : ce fichier etait orphelin de `npm test`.
 *
 * La branche Vitest ci-dessous est le garde-fou HERMETIQUE : elle lit les
 * jetons reellement utilises par l'action principale, recompose les aplats
 * translucides, et compare le contraste CALCULE a un SEUIL. Ni navigateur, ni
 * serveur, ni reseau : elle tourne a chaque `npm test`.
 *
 * La branche Playwright est reprise telle quelle : elle garde la valeur de
 * rendu reel que seul un navigateur sait mesurer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { test, expect } from '@playwright/test';

/**
 * Detection du runner, SANS navigateur et SANS `import.meta` : Playwright
 * compile ce fichier en CommonJS, ou `import.meta` n'existe pas. `process.env`
 * suffit - Vitest pose `VITEST=true`, Playwright ne pose jamais cette variable.
 */
const SOUS_VITEST =
  process.env.VITEST === 'true' ||
  typeof (globalThis as { __vitest_worker__?: unknown }).__vitest_worker__ !== 'undefined';

/* ==========================================================================
   BOITE A OUTILS DE MESURE - fonctions pures, sans framework ni etat partage.
   Les deux runners s'en servent : le contraste se calcule une seule fois.
   ========================================================================== */

/** WCAG 2.2 : 4,5:1 pour le texte normal, 7:1 au niveau AAA. */
const SEUIL_AA = 4.5;
const SEUIL_AAA = 7;

type Rvb = readonly [number, number, number];
type Aplat = { readonly rgb: Rvb; readonly alpha: number };
type BlocCss = { readonly selecteur: string; readonly corps: string };

/** Les commentaires CSS contiennent des accolades (`(0,1,0)`) : on les retire AVANT de decouper. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Decoupe le CSS en paires selecteur/corps. Les regles placees dans un
 * `@media` ressortent comme des blocs de premier niveau : sans effet ici, les
 * jetons surveilles ne sont reecrits par aucun media query.
 */
function blocsCss(css: string): readonly BlocCss[] {
  const sortie: BlocCss[] = [];
  const motif = /([^{}]+)\{([^{}]*)\}/g;
  let rencontre: RegExpExecArray | null;
  while ((rencontre = motif.exec(sansCommentaires(css))) !== null) {
    sortie.push({ selecteur: rencontre[1].trim().replace(/\s+/g, ' '), corps: rencontre[2] });
  }
  return sortie;
}

/**
 * Seuls les blocs de RACINE portent les jetons d'un theme. Une regle de classe
 * comme `.button-primary:disabled` (tokens.css) reassigne `--g3-bg` sur une
 * variante desactivee : la lire comme un jeton de theme ferait mesurer le
 * bouton DESACTIVE en croyant mesurer le bouton actif.
 */
function estSelecteurDeTheme(selecteur: string): boolean {
  return selecteur
    .split(',')
    .map(part => part.trim())
    .every(part => part === ':root' || part === 'html' || part.endsWith('.dark') || part === "[data-theme='dark']");
}

/**
 * Jetons effectifs d'un theme, lus dans l'ordre de la feuille : a specificite
 * egale, c'est la derniere declaration qui parle - exactement comme le
 * navigateur. Un theme est sombre des que son selecteur mentionne `.dark`.
 */
function jetonsTheme(blocs: readonly BlocCss[], sombre: boolean): Readonly<Record<string, string>> {
  const cumul: Record<string, string> = {};
  for (const bloc of blocs) {
    if (!estSelecteurDeTheme(bloc.selecteur)) continue;
    if (bloc.selecteur.includes('.dark') !== sombre) continue;
    for (const declaration of bloc.corps.split(';')) {
      const separateur = declaration.indexOf(':');
      if (separateur === -1) continue;
      const nom = declaration.slice(0, separateur).trim();
      if (nom.startsWith('--')) cumul[nom] = declaration.slice(separateur + 1).trim();
    }
  }
  return cumul;
}

/** Lecture fail-fast : un jeton absent est un defaut de produit, jamais un test vert. */
function jeton(jetons: Readonly<Record<string, string>>, nom: string): string {
  const valeur = jetons[nom];
  if (valeur === undefined) throw new Error(`jeton absent de la feuille de jetons: ${nom}`);
  return valeur;
}

function versAplat(brut: string): Aplat {
  const texte = brut.trim();
  const codeHexa = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(texte);
  if (codeHexa) {
    const corps = codeHexa[1].length === 3
      ? codeHexa[1].split('').map(caractere => caractere + caractere).join('')
      : codeHexa[1];
    return {
      rgb: [
        parseInt(corps.slice(0, 2), 16),
        parseInt(corps.slice(2, 4), 16),
        parseInt(corps.slice(4, 6), 16),
      ],
      alpha: 1,
    };
  }
  const fonctionnel = /^rgba?\(([^)]+)\)$/i.exec(texte);
  if (fonctionnel) {
    const canaux = fonctionnel[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const illisibles = canaux.slice(0, 3).some(canal => Number.isNaN(canal));
    if (canaux.length < 3 || illisibles) throw new Error(`couleur non resolvable: ${texte}`);
    return { rgb: [canaux[0], canaux[1], canaux[2]], alpha: canaux[3] === undefined ? 1 : canaux[3] };
  }
  throw new Error(`couleur non supportee par le contrat: ${texte}`);
}

/** Composition alpha sur un substrat opaque : ce que l'oeil voit reellement. */
function composer(haut: Aplat, substrat: Rvb): Rvb {
  const alpha = haut.alpha;
  return [
    Math.round(haut.rgb[0] * alpha + substrat[0] * (1 - alpha)),
    Math.round(haut.rgb[1] * alpha + substrat[1] * (1 - alpha)),
    Math.round(haut.rgb[2] * alpha + substrat[2] * (1 - alpha)),
  ];
}

function luminance(rvb: Rvb): number {
  const canal = (valeur: number): number => {
    const srgb = valeur / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rvb[0]) + 0.7152 * canal(rvb[1]) + 0.0722 * canal(rvb[2]);
}

function contraste(premier: Rvb, second: Rvb): number {
  const [clair, sombre] = [luminance(premier), luminance(second)].sort((a, b) => b - a);
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Mesure un couple texte/fond, l'aplat de fond etant compose sur l'aplat de
 * carte du meme theme. Regle du contrat : le substrat retenu est l'aplat
 * opaque de carte, car c'est le cas le plus defavorable pour le texte qu'il
 * supporte - clair, il est le plus clair ; sombre, le plus sombre.
 */
function contrasteSurCarte(jetons: Readonly<Record<string, string>>, nomTexte: string, nomFond: string): number {
  const carte = versAplat(jeton(jetons, '--card-tint-solid')).rgb;
  const fond = composer(versAplat(jeton(jetons, nomFond)), carte);
  return contraste(composer(versAplat(jeton(jetons, nomTexte)), fond), fond);
}

/* ==========================================================================
   BRANCHE VITEST - le contrat ejecutable a chaque `npm test`.
   ========================================================================== */
function enregistrerContratVitest({ describe, it, expect }: typeof import('vitest')): void {
  const feuilleJetons = blocsCss(readFileSync(join(__dirname, '..', '..', 'src', 'styles', 'tokens.css'), 'utf8'));
  const feuilleVerre = blocsCss(readFileSync(join(__dirname, '..', '..', 'src', 'styles', 'liquid-glass.css'), 'utf8'));

  const CLAIR = jetonsTheme(feuilleJetons, false);
  const SOMBRE = jetonsTheme(feuilleJetons, true);

  /** Les deux themes, dans un tuple immuable : chaque test les parcourt sans muter quoi que ce soit. */
  const THEMES = [
    { nom: 'clair', jetons: CLAIR },
    { nom: 'sombre', jetons: SOMBRE },
  ] as const;

  /** Message d'echec en francais, avec la mesure : un seuil sans nombre ne se corrige pas. */
  const lire = (ratio: number): string => `${ratio.toFixed(2).replace('.', ',')}:1`;

  describe('contrat de verre - action principale (P5.2)', () => {
    // P5.2. Le CTA " Creer mon parcours " a un contraste faible sur le verre
    // clair ; la cible annoncee est 4,5:1, et la mesure au navigateur le
    // placent tres au-dessus. On verrouille ici le SEUIL AAA (7:1) et non la
    // mesure : la valeur " 10,48:1 " doit rester une observation, pas un
    // contrat. Une retouche qui eclaircit l'accent fait rougir le test.
    it.each(THEMES)('l accent d action tient AAA en theme $nom', ({ jetons }) => {
      const ratio = contrasteSurCarte(jetons, '--lkv-on-action', '--lkv-action');
      expect(
        ratio,
        `accent ${jeton(jetons, '--lkv-action')} sur texte ${jeton(jetons, '--lkv-on-action')} = ${lire(ratio)}, seuil ${SEUIL_AAA}:1`,
      ).toBeGreaterThanOrEqual(SEUIL_AAA);
    });

    // Le materiau G3 est l'aplat reel du bouton primaire en verre : sa couleur
    // est translucide, il ne faut donc PAS mesurer l'alpha nu - il faut le
    // composer sur la carte, sinon on surestime le contraste.
    it.each(THEMES)('le bouton primaire en verre (G3) tient AAA en theme $nom', ({ jetons }) => {
      const ratio = contrasteSurCarte(jetons, '--g3-text', '--g3-bg');
      expect(
        ratio,
        `texte ${jeton(jetons, '--g3-text')} sur remplissage ${jeton(jetons, '--g3-bg')} = ${lire(ratio)}, seuil ${SEUIL_AAA}:1`,
      ).toBeGreaterThanOrEqual(SEUIL_AAA);
    });

    // Le repli opaque est ce que voit un utilisateur en mode accesibilite ou
    // effets reduits : c'est la que la lisibilite ne peut pas bergantung du
    // flou d'arriere-plan.
    it.each(THEMES)('le repli opaque garde un texte lisible en theme $nom', ({ jetons }) => {
      const ratio = contrasteSurCarte(jetons, '--lkv-text-primary', '--card-tint-solid');
      expect(
        ratio,
        `texte ${jeton(jetons, '--lkv-text-primary')} sur ${jeton(jetons, '--card-tint-solid')} = ${lire(ratio)}, seuil ${SEUIL_AA}:1`,
      ).toBeGreaterThanOrEqual(SEUIL_AA);
    });

    // Le texte secondaire du verre est pose a 74 % d'opacite : mesure sur son
    // alpha brut, il passerait le seuil alors qu'une retouche de teinte le
    // ferait tomber sous la barre. Il doit etre compose, lui aussi.
    it.each(THEMES)('le texte secondaire du verre compose reste AA en theme $nom', ({ jetons }) => {
      const ratio = contrasteSurCarte(jetons, '--glass-text-secondary', '--card-tint-solid');
      expect(
        ratio,
        `secondaire ${jeton(jetons, '--glass-text-secondary')} sur ${jeton(jetons, '--card-tint-solid')} = ${lire(ratio)}, seuil ${SEUIL_AA}:1`,
      ).toBeGreaterThanOrEqual(SEUIL_AA);
    });

    // Piege N3 : `--prep-glass-blur: var(--prep-glass-blur)` est du CSS invalide
    // qui ne signale rien - les animations cessent et les tests restent verts.
    // Un jeton surveille qui se reference lui-meme doit donc etre refuse.
    it('aucun jeton surveille ne se reference lui-meme', () => {
      const surveilles = ['--lkv-action', '--lkv-on-action', '--g3-bg', '--g3-text', '--card-tint-solid', '--glass-text-secondary'];
      const autoReferences: string[] = [];
      for (const { nom, jetons } of THEMES) {
        for (const cle of surveilles) {
          if (jeton(jetons, cle) === `var(${cle})`) autoReferences.push(`${cle} (${nom})`);
        }
      }
      expect(autoReferences, 'jetons qui se reference eux-memes').toEqual([]);
    });

    // La cible tactile de 44 px est une contrainte materielle, pas une
    // convention : elle se lit dans le jeton, donc elle se garde ici.
    it('la cible tactile minimale vaut au moins 44 px', () => {
      const brut = jeton(CLAIR, '--lkv-touch-min');
      const pixels = Number.parseFloat(brut);
      expect(Number.isNaN(pixels), `--lkv-touch-min illisible: ${brut}`).toBe(false);
      expect(pixels, `--lkv-touch-min vaut ${brut}`).toBeGreaterThanOrEqual(44);
    });

    // Un focus qui ne repose que sur une ombre disparait des que le systeme
    // desactive les ombres : le contour doit etre declare explicitement.
    it('le focus visible est declare par un contour, pas par une ombre', () => {
      const contours = feuilleVerre
        .filter(bloc => bloc.selecteur.includes(':focus-visible'))
        .flatMap(bloc => bloc.corps.match(/outline\s*:\s*([^;]+)/g) ?? []);
      expect(contours.length, 'aucune regle :focus-visible ne declare de contour').toBeGreaterThan(0);
      expect(contours.filter(valeur => valeur.includes('none')), 'contours a `none`').toEqual([]);
    });
  });
}

/**
 * Pont SYNCHRONE vers Vitest - et cette synchronicite dicte tout le
 * montage. Vitest collecte ses tests pendant l'evaluation du module : une
 * promesse non resolue arrive trop tard ("No test suite found"), et un
 * `import ... from 'vitest'` statique explose cote Playwright, qui compile
 * ce fichier en CommonJS ou require("vitest") est refuse. On charge donc
 * l'entree ESM de Vitest par require(esm) : synchrone pour Vitest, simple
 * litteral pour Playwright qui n'entre jamais dans cette branche. Le chemin
 * passe par le sous-chemin "vitest/package.json" EXPORTE publiquement, on ne
 * suppose donc aucun emplacement interne du paquet.
 */
if (SOUS_VITEST) {
  const charger = createRequire(__filename);
  const entreeVitest = charger.resolve('vitest/package.json').replace(/package\.json$/, 'dist/index.js');
  enregistrerContratVitest(charger(entreeVitest));
} else {
  /* ========================================================================
     BRANCHE PLAYWRIGHT - reprise telle quelle : elle garde la valeur de
     rendu reel que seul un navigateur sait mesurer (backdrop-filter, cible 44 px,
     focus, media queries). Lancer avec : npm run test:glass
     ======================================================================== */
  const css = ['src/styles/tokens.css', 'src/styles/liquid-glass.css'].map(path => readFileSync(path, 'utf8')).join('\n');

  test.beforeEach(async ({ page }) => {
    await page.setContent(`<style>${css}</style><main>
      <article class="glass" data-glass-variant="base" style="padding:20px">
        <h1>Voyage</h1><p>Contenu lisible</p><div class="glass" data-glass-variant="base">Surface interne</div>
        <button class="glass-capsule-btn sm">Choisir</button>
      </article>
      <button class="glass interactive" data-glass-variant="interactive">Action</button>
      <article class="glass" data-glass-variant="overlay">Panneau</article>
    </main>`);
  });

  test('nested surfaces never add another backdrop', async ({ page }) => {
    await expect(page.locator('.glass .glass')).toHaveCSS('backdrop-filter', 'none');
    await expect(page.locator('.glass .glass-capsule-btn')).toHaveCSS('backdrop-filter', 'none');
  });

  test('compact glass controls still have a 44px touch target', async ({ page }) => {
    const bounds = await page.getByRole('button', { name: 'Choisir' }).boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  });

  test('low effects mode removes every glass blur and preserves solid fill', async ({ page }) => {
    await page.locator('html').evaluate(el => el.setAttribute('data-glass-effects', 'reduced'));
    for (const surface of await page.locator('.glass, .glass-capsule-btn').all()) {
      await expect(surface).toHaveCSS('backdrop-filter', 'none');
    }
    // Direction P5 : le repli opaque clair est blanc (surface de carte #FFFFFF).
    await expect(page.locator('article.glass').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('reduced motion suppresses press transforms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const action = page.getByRole('button', { name: 'Action', exact: true });
    await action.hover();
    await page.mouse.down();
    await expect(action).toHaveCSS('transform', 'none');
    await page.mouse.up();
  });

  test('focus remains visible without relying on a shadow', async ({ page }) => {
    await page.keyboard.press('Tab');
    const outline = await page.getByRole('button', { name: 'Choisir' }).evaluate(el => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('opaque accessibility mode preserves primary-action contrast', async ({ page }) => {
    await page.getByRole('button', { name: 'Choisir' }).evaluate(el => el.classList.add('primary'));
    await page.emulateMedia({ contrast: 'more' });
    const action = page.getByRole('button', { name: 'Choisir' });
    // Direction P5 : action #226148, contenu blanc (contraste mesuré 7,31:1).
    await expect(action).toHaveCSS('background-color', 'rgb(34, 97, 72)');
    await expect(action).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('article.glass').first()).toHaveCSS('backdrop-filter', 'none');
  });

  test('glass content retains AA contrast over the rich backdrop; opaque fallback restores dark text', async ({ page }) => {
    const samples = await page.locator('article.glass').first().evaluate(el => {
      const style = getComputedStyle(el);
      return { fill: style.backgroundColor, primary: style.color, secondary: style.getPropertyValue('--glass-text-secondary') };
    });
    const parse = (value: string) => value.startsWith('#')
      ? value.slice(1).match(/.{2}/g)!.map(x => parseInt(x, 16))
      : value.match(/[\d.]+/g)!.map(Number);
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const fill = parse(samples.fill);
    // Direction P5 : la toile applicative est claire (#F5F7F3) — le contraste
    // du verre se mesure composé sur ce fond, plus sur l'ancienne marbrure sombre.
    const backdrop = [245, 247, 243];
    const background = fill.slice(0, 3).map((v, i) => v * (fill[3] ?? 1) + backdrop[i] * (1 - (fill[3] ?? 1)));
    const compositeOver = (top: number[]) => top.slice(0, 3).map((v, i) => v * (top[3] ?? 1) + background[i] * (1 - (top[3] ?? 1)));
    for (const foreground of [samples.primary, samples.secondary.trim()]) {
      const values = [luminance(background), luminance(compositeOver(parse(foreground)))].sort((a, b) => b - a);
      expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
    }
    await page.locator('html').evaluate(el => el.setAttribute('data-glass-effects', 'reduced'));
    await expect(page.locator('article.glass').first()).toHaveCSS('color', 'rgb(23, 43, 36)');
  });

  test('explicit dark surfaces use readable foregrounds', async ({ page }) => {
    await page.locator('html').evaluate(el => el.classList.add('dark'));
    await expect(page.locator('article.glass').first()).toHaveCSS('color', 'rgb(241, 245, 241)');
  });

  test('canonical surfaces preserve fixed panel positioning and pill geometry', async ({ page }) => {
    await page.addStyleTag({ content: '.fixed { position: fixed; }' });
    await page.locator('article.glass').last().evaluate(el => el.classList.add('fixed'));
    await expect(page.locator('article.glass').last()).toHaveCSS('position', 'fixed');
    await page.getByRole('button', { name: 'Action', exact: true }).evaluate(el => el.setAttribute('data-glass-shape', 'pill'));
    await expect(page.getByRole('button', { name: 'Action', exact: true })).toHaveCSS('border-radius', '9999px');
  });
}
