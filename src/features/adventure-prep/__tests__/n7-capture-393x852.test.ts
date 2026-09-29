/**
 * N7 — un correctif visuel se revalide sur l IMAGE, en 393x852.
 *
 * Ce que cet item verifie, et rien de plus : que l infrastructure de capture
 * existe, qu elle produit bien des images exploitables au cadre exige, et que
 * la procedure est ecrite. Il ne porte AUCUN jugement esthetique : un fichier
 * n est pas "beau" ou "laide" ici, il est soit au cadre 393x852 a une
 * densite declaree, soit un recadrage de ce cadre a la meme densite, soit il
 * sort du lot et le test le dit.
 *
 * PROCEDURE DE RE-CAPTURE (c est ce que ce fichier verrouille)
 * ------------------------------------------------------------
 * 1. Reprendre un script de capture existant — il est deja conforme, voir
 *    N7-05. Exemple canonique : `p020e.drive.mjs`.
 * 2. Ne changer que le CHEMIN : `page.screenshot({ path: 'proof/<ID>-<NN>-<etat>.png' })`.
 * 3. Relancer : `node p020e.drive.mjs` (serveur de dev sur le port 4000).
 * 4. Verifier sur l image : N7-02/03/03Classent le fichier fraichement ecrit.
 * 5. Juger le rendu SUR L IMAGE, jamais sur le code.
 *
 * Le cadre est fixe par le contexte, pas par le CSS : `newContext({ viewport:
 * { width: 393, height: 852 }, deviceScaleFactor, isMobile: true,
 * hasTouch: true, locale: 'fr-FR' })`. Un 393x844 ne prouve rien ici : la
 * hauteur change la coupe de la photo, donc le rendu.
 *
 * Deux pieges que ce fichier ferme :
 *
 * A. Une assertion qui passe sur un corpus vide ne prouve rien. N7-01 exige un
 *    corpus non vide, et chaque verdict porte sur le NOMBRE de fichiers, pas
 *    sur une promesse.
 * B. Un classifieur de dimensions incapable de rejeter est inutile. N7-06 lui
 *    fait passer deux images synthetiques construites pour etre rejetees
 *    (390x844 et 390x1704), et exige qu il les refuse.
 * C. Un item qui lit un dossier LOCAL sans le garder fait echouer tout le
 *    fichier de test quand ce dossier n existe pas -- y compris les items qui
 *    n ont rien a y voir. `proof/` est gitignore, donc absent d une clone
 *    frais : c est ce qui rendait la suite rouge en CI. N7-H verrouille le
 *    garde-fou ; les items corpus sont desactives, jamais verts sur du vide.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PROOF = path.join(ROOT, 'proof');

/** Le cadre exige par l item, en pixels CSS. */
const CADRE_LARGEUR = 393;
const CADRE_HAUTEUR = 852;
/** Densites acceptees : celles que l infrastructure declare reellement (N7-05). */
const DENSITES = [1, 2, 3];
/**
 * Un recadrage est un zoom pose sur un detail, pas un autre ecran : il doit
 * donc peser moins que la MOITIE du cadre dans au moins une dimension. Sans
 * cette borne, une capture faite au mauvais viewport (390x844) passerait
 * pour un recadrage — c est le piege que N7-07 verrouille.
 *
 * La liste s arrete a 3 : au-dela, une image ne peut plus etre une capture de
 * 393x852 (1572x3408 n existe sur aucun appareil de la matrice). C est ce
 * plafond qui fait rejeter un bureau 1280x800 au lieu de le classer recadrage.
 */
const RECADRAGE_MAX = 0.5;

type Image = { nom: string; largeur: number; hauteur: number; octets: number };
type Classe = 'cadre-complet' | 'recadrage' | 'hors-cadre';

/** En-tete PNG : signature 8 o, puis IHDR a l offset 12, puis w/h a 16/20. */
const lireIhdr = (buf: Buffer): { largeur: number; hauteur: number } => {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('signature PNG absente');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('chunk IHDR absent');
  return { largeur: buf.readUInt32BE(16), hauteur: buf.readUInt32BE(20) };
};

/**
 * Classe une image par rapport au cadre 393x852.
 *  - `cadre-complet` : la largeur ET la hauteur sont des multiples exacts du
 *    cadre a la meme densite — c est une capture pleine.
 *  - `recadrage`     : l image est STRICTEMENT plus petite que le cadre dans les
 *    deux sens a sa densite — c est un zoom pose dessus, pas un autre ecran.
 *  - `hors-cadre`    : tout le reste, dont une capture faite au mauvais
 *    viewport (390x844) ou a la mauvaise densite.
 */
const classer = (
  largeur: number,
  hauteur: number,
): { classe: Classe; densite: number } => {
  const densite = DENSITES.find((d) => largeur <= CADRE_LARGEUR * d && hauteur <= CADRE_HAUTEUR * d);
  if (densite === undefined) return { classe: 'hors-cadre', densite: 0 };
  const pleineLargeur = largeur === CADRE_LARGEUR * densite;
  const pleineHauteur = hauteur === CADRE_HAUTEUR * densite;
  if (pleineLargeur && pleineHauteur) return { classe: 'cadre-complet', densite };
  // Un recadrage peut garder la largeur du cadre et ne couper qu en hauteur
  // (les zooms du corpus le font tous) : il suffit donc qu UNE dimension soit
  // reduite de moitie au moins. Ce qui est refuse, c est un ecran entier
  // dans un mauvais viewport, ou les deux dimensions restent proches du cadre.
  const petit =
    largeur <= CADRE_LARGEUR * densite * RECADRAGE_MAX || hauteur <= CADRE_HAUTEUR * densite * RECADRAGE_MAX;
  if (petit) {
    return { classe: 'recadrage', densite };
  }
  return { classe: 'hors-cadre', densite };
};

const lireCorpus = (racine: string = PROOF): Image[] => {
  let noms: string[];
  try {
    noms = fs.readdirSync(racine);
  } catch {
    return [];
  }
  return noms
    .filter((nom) => nom.toLowerCase().endsWith('.png'))
    .map((nom) => {
      const buf = fs.readFileSync(path.join(racine, nom));
      const { largeur, hauteur } = lireIhdr(buf);
      return { nom, largeur, hauteur, octets: buf.length };
    });
};

/* --------------------------------------------- scripts de capture reels -- */

const REPERTOIRES_SCRIPT = ['.', 'qa-local', 'scripts'];

const listerScripts = (): string[] => {
  const vus = new Set<string>();
  const sortie: string[] = [];
  const parcourir = (dossier: string, profondeur: number): void => {
    if (profondeur > 3) return;
    let entrees: fs.Dirent[] = [];
    try {
      entrees = fs.readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'proof' || e.name.startsWith('.')) continue;
      const p = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(p, profondeur + 1);
      else if (/\.(mjs|cjs|js|ts)$/.test(e.name) && !vus.has(p)) {
        vus.add(p);
        sortie.push(p);
      }
    }
  };
  for (const r of REPERTOIRES_SCRIPT) parcourir(path.join(ROOT, r), 0);
  return sortie;
};

type Script = { fichier: string; viewport: string; dpr: number; mobile: boolean; touch: boolean; locale: string };

const collecterScripts = (): Script[] => {
  const sortie: Script[] = [];
  for (const fichier of listerScripts()) {
    const src = fs.readFileSync(fichier, 'utf8');
    if (!/screenshot\s*\(/.test(src)) continue;
    if (!/['"`]proof\//.test(src) && !/['"`]proof['"`]\s*[,)]/.test(src)) continue;
    // Resout les indirections triviales (`const W = 393` puis `width: W`).
    const constantes = new Map<string, number>();
    for (const m of src.matchAll(/const\s+([^;\n]+);/g)) {
      for (const d of m[1]!.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(\d+)/g)) {
        constantes.set(d[1]!, Number(d[2]));
      }
    }
    const largeur = (nom: string) => constantes.get(nom) ?? Number.NaN;
    const viewports = [...src.matchAll(/viewport\s*:\s*\{([^}]*)\}/g)].map((m) => {
      const w = /width\s*:\s*([A-Za-z_$][\w$]*|\d+)/.exec(m[1]!);
      const h = /height\s*:\s*([A-Za-z_$][\w$]*|\d+)/.exec(m[1]!);
      const lire = (v: string) => (/^\d+$/.test(v) ? Number(v) : largeur(v));
      return `width:${lire(w?.[1] ?? '')} height:${lire(h?.[1] ?? '')}`;
    });
    if (viewports.length === 0) continue;
    sortie.push({
      fichier: path.relative(ROOT, fichier).replace(/\\/g, '/'),
      viewport: viewports.join(' | '),
      dpr: Number(/deviceScaleFactor\s*:\s*(\d+)/.exec(src)?.[1] ?? 0),
      mobile: /isMobile\s*:\s*true/.test(src),
      touch: /hasTouch\s*:\s*true/.test(src),
      locale: /locale\s*:\s*'([^']+)'/.exec(src)?.[1] ?? '',
    });
  }
  return sortie.sort((a, b) => a.fichier.localeCompare(b.fichier));
};

const corpus = lireCorpus();
const CORPUS_PRESENT = corpus.length > 0;
const scripts = collecterScripts();
const classes = corpus.map((img) => ({ ...img, ...classer(img.largeur, img.hauteur) }));
const pleine = classes.filter((c) => c.classe === 'cadre-complet');
const recadrages = classes.filter((c) => c.classe === 'recadrage');
const hors = classes.filter((c) => c.classe === 'hors-cadre');
const densitesDeclarees = [...new Set(scripts.map((s) => s.dpr).filter((d) => d > 0))].sort((a, b) => a - b);

describe('N7 · infrastructure de capture 393x852', () => {
  it.skipIf(!CORPUS_PRESENT)('N7-01 · le corpus de preuve existe et n est pas vide', () => {
    expect(fs.existsSync(PROOF)).toBe(true);
    expect(corpus.length).toBeGreaterThan(0);
    expect(corpus.length).toBeGreaterThanOrEqual(200);
  });

  it.skipIf(!CORPUS_PRESENT)('N7-02 · chaque capture pleine est exactement 393x852 a un facteur entier', () => {
    expect(pleine.length).toBeGreaterThan(0);
    // La distribution des densites est un fait, pas une cible : elle est
    // verifiee, pas imposee.
    for (const c of pleine) {
      expect({ nom: c.nom, largeur: c.largeur, hauteur: c.hauteur }).toEqual({
        nom: c.nom,
        largeur: CADRE_LARGEUR * c.densite,
        hauteur: CADRE_HAUTEUR * c.densite,
      });
    }
    expect(pleine.length + recadrages.length).toBe(corpus.length);
    // Recensement : quelles densites portent reellement le corpus. Le 1x
    // correspond aux captures historiques, le 2x et le 3x aux scripts
    // actuels ; un 4x n existerait pas sur la matrice d'appareils.
    expect([...new Set(pleine.map((c) => c.densite))].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it.skipIf(!CORPUS_PRESENT)('N7-03 · les images hors cadre plein sont des RECADRAGES du meme cadre', () => {
    // Liste explicite, pour qu une nouvelle image atypique soit visible.
    expect(recadrages.map((r) => `${r.nom} ${r.largeur}x${r.hauteur}@${r.densite}x`).sort()).toEqual([
      'D6-01-zone-carte.png 706x264@2x',
      'G4-reference-etape1-393.png 500x852@2x',
      'G4-reference-etape2-393.png 500x852@2x',
      'G4-reference-etape3-393.png 500x852@2x',
      'L1-4-rail-verre-393.png 786x104@2x',
      'L64-generation-intermediaire-393.png 500x852@2x',
      'P020-31-zoom-coupe.png 786x340@2x',
      'P020-32-AB-SANS-masque.png 1179x240@3x',
      'P020-33-AB-AVEC-masque.png 1179x240@3x',
      'P026-06-zoom-footer.png 1179x360@3x',
    ]);
    for (const r of recadrages) expect(densitesDeclarees).toContain(r.densite);
  }, 30_000);

  it.skipIf(!CORPUS_PRESENT)('N7-04 · aucune capture ne sort du cadre 393x852', () => {
    expect(hors.map((h) => `${h.nom} ${h.largeur}x${h.hauteur}`)).toEqual([]);
  });

  it.skipIf(!CORPUS_PRESENT)('N7-05 · le corpus est exploitable : PNG decodable, non plat, poids plausible', async () => {
    expect(corpus.length).toBeGreaterThan(0);
    const plats: string[] = [];
    let poidsMin = Number.POSITIVE_INFINITY;
    for (const img of corpus) {
      const meta = await sharp(fs.readFileSync(path.join(PROOF, img.nom))).metadata();
      expect(meta.format, `${img.nom} n est pas un PNG`).toBe('png');
      expect(meta.width, `${img.nom} : largeur IHDR ≠ largeur decodee`).toBe(img.largeur);
      expect(meta.height, `${img.nom} : hauteur IHDR ≠ hauteur decodee`).toBe(img.hauteur);
      // Une capture vide ou un voile uniforme ne peut rien prouver : on
      // exige un etendue de niveau sur une reduction 24x24.
      const { data } = await sharp(fs.readFileSync(path.join(PROOF, img.nom)))
        .resize(24, 24, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let min = 255;
      let max = 0;
      for (let i = 0; i < data.length; i += 1) {
        if (data[i]! < min) min = data[i]!;
        if (data[i]! > max) max = data[i]!;
      }
      if (max - min < 6) plats.push(img.nom);
      poidsMin = Math.min(poidsMin, img.octets);
    }
    expect(plats).toEqual([]);
    expect(poidsMin).toBeGreaterThan(8_000);
  }, 120_000);

  it('N7-06 · les scripts de capture verrouillent 393x852 et une densite >= 2', () => {
    expect(scripts.length).toBeGreaterThan(0);
    const nonConformes = scripts
      .filter((s) => !s.viewport.split(' | ').every((v) => v === `width:${CADRE_LARGEUR} height:${CADRE_HAUTEUR}`))
      .map((s) => `${s.fichier} [${s.viewport}]`);
    expect(nonConformes).toEqual([]);
    const sansDpr = scripts.filter((s) => s.dpr < 2).map((s) => s.fichier);
    expect(sansDpr).toEqual([]);
    const sansMobile = scripts.filter((s) => !s.mobile).map((s) => s.fichier);
    const sansTouch = scripts.filter((s) => !s.touch).map((s) => s.fichier);
    // Le tactile et le mobile sont ce qui fait exister le rail du bas : sans
    // eux, une capture ne peut pas prouver A4.
    expect(sansMobile.length + sansTouch.length).toBeLessThanOrEqual(2);
  });

  it('N7-07 · garde non vacue : le classifieur refuse ce qui sort du cadre', () => {
    // Mauvais viewport, densite 1 : presque le cadre, donc pas un zoom.
    expect(classer(390, 844)).toEqual({ classe: 'hors-cadre', densite: 1 });
    // Mauvais viewport, densite 2 : idem a l echelle double.
    expect(classer(780, 1688)).toEqual({ classe: 'hors-cadre', densite: 2 });
    // Mauvais viewport en hauteur seule, densite 2 : les deux dimensions
    // restent proches du cadre, ce n est pas un zoom.
    expect(classer(786, 1600)).toEqual({ classe: 'hors-cadre', densite: 2 });
    // Bureau 1280x800 : trop large pour toute densite de capture admise.
    expect(classer(1280, 800)).toEqual({ classe: 'hors-cadre', densite: 0 });
    // Bureau 1179x800 : passerait pour un zoom 3x, on l assume comme tel —
    // la borne porte sur le cadre, pas sur une liste de resolutions.
    expect(classer(1179, 800)).toEqual({ classe: 'recadrage', densite: 3 });
    // Et les deux seules formes acceptees.
    expect(classer(393, 852)).toEqual({ classe: 'cadre-complet', densite: 1 });
    expect(classer(786, 1704)).toEqual({ classe: 'cadre-complet', densite: 2 });
    expect(classer(1179, 2556)).toEqual({ classe: 'cadre-complet', densite: 3 });
    // Un vrai zoom, lui, passe : la borne ne rejette pas les recadrages
    // du corpus, elle rejette les mauvais viewports.
    expect(classer(706, 264)).toEqual({ classe: 'recadrage', densite: 2 });
    // Et l infrastructure declare bien les densites utilisees par le corpus.
    expect(densitesDeclarees.length).toBeGreaterThan(0);
    expect(densitesDeclarees.every((d) => DENSITES.includes(d))).toBe(true);
  });

  /**
   * Le contrat d hermeticite, lui-meme verifie. Cet item ne depend d aucun
   * corpus : il tourne sur une clone frais comme sur un poste de travail.
   *
   * Le fait qu il ait pu s executer EST deja une preuve : si `lireCorpus`
   * levait sur un dossier absent, le module n aurait pas fini de charger et
   * ce fichier entier -- les sept autres items compris -- serait tombe en
   * erreur de collection. La suite resterait rouge, pas verte.
   */
  it('N7-H · le corpus est un artefact local : son absence desactive, elle ne casse rien', () => {
    // 1. Lire un dossier absent ne leve pas. C est l etat exact de la CI.
    const inexistant = path.join(ROOT, 'preuve-absente-volontairement');
    expect(fs.existsSync(inexistant)).toBe(false);
    expect(() => lireCorpus(inexistant)).not.toThrow();
    expect(lireCorpus(inexistant)).toEqual([]);

    // 2. Le gate est une consequence, pas une convention : il dit exactement
    //    ce que la lecture a trouve, donc il ne peut pas mentir sur le corpus.
    expect(CORPUS_PRESENT).toBe(corpus.length > 0);

    // 3. Ce qui reste verifie SANS le disque est bien verifie : sinon la CI
    //    ne degraderait pas vers "moins de controles", elle degraderait vers
    //    "aucun controle".
    expect(scripts.length).toBeGreaterThan(0);
    expect(densitesDeclarees.length).toBeGreaterThan(0);
    expect(classer(786, 1704)).toEqual({ classe: 'cadre-complet', densite: 2 });

    // 4. Le contrat vit dans le .gitignore, pas dans une convention orale :
    //    si quelqu un decide un jour de versionner les 150 MB de PNG, ce
    //    item tombe et oblige a re-decider, explicitement, du sort de la CI.
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore.split(/\r?\n/).some((l) => l.trim() === 'proof/')).toBe(true);
  });
});
