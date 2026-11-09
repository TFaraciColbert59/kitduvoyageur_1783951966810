// @ts-check
//
// Banc d'images du Kit Studio : il photographie la VRAIE page de l'application
// (`/kit-studio?debug=1`), avec son vrai tiroir (composants de `src/features/kit-studio/ui/`,
// CSS `kit-studio.css` + `cards/cards.css`). Il ne dessine aucun tiroir lui-meme : un faux tiroir
// ne prouve rien sur le produit et trompe celui qui juge les captures.
//
// Les gestes passent par l'interface (clics sur les capsules, les cartes, la poignee, la pastille
// a trois points). Seuls l'orbite de la camera et la vue decomposee, qui sont des gestes tactiles
// de la scene, appellent l'API de la scene reelle. Le crochet `window.__kitStudioDebug`
// n'existe qu'en mode demonstration (`?debug=1`).
//
// Usage :
//   node scripts/kit-studio/record-walkthrough.mjs [--url=<url>]
//   KIT_STUDIO_URL=<url> node scripts/kit-studio/record-walkthrough.mjs
// Defaut : http://127.0.0.1:3100/kit-studio?debug=1 (serveur de dev : `npx next dev -p 3100`).
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const rootDir = process.cwd();
const capturesDir = path.join(rootDir, 'docs', 'kit-studio', 'captures');
if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length);
const STUDIO_URL = urlArg || process.env.KIT_STUDIO_URL || 'http://127.0.0.1:3100/kit-studio?debug=1';
if (!/[?&]debug=1(&|$)/.test(STUDIO_URL)) {
  console.error('L\'URL doit porter ?debug=1 : le crochet du banc n\'existe qu\'en mode demonstration.');
  process.exit(1);
}

// Le controle de cadrage vit a cote du moteur (source unique des seuils) ; il est en TypeScript
// pur, sans dependance, donc on le transpile a la volee plutot que de dupliquer ses seuils ici.
const controleSrc = esbuild.buildSync({
  entryPoints: [path.join(rootDir, 'src', 'features', 'kit-studio', 'scene', 'framingCheck.ts')],
  bundle: true,
  format: 'esm',
  write: false,
}).outputFiles[0].text;
const { framingFailure, describeRect } = await import(
  'data:text/javascript;base64,' + Buffer.from(controleSrc).toString('base64')
);

/** Captures dont un controle est non conforme ; le script sort en erreur s'il y en a. */
const cadrageEchecs = [];

/** Libelles accessibles du vrai tiroir (`ui/strings.ts`). */
const LIBELLE = {
  contenu: 'Contenu du sac',
  apparence: 'Apparence du sac',
  corps: 'Corps',
  modules: 'Modules',
  coloris: 'Coloris',
  fermer: 'Fermer le tiroir',
  rouvrir: 'Rouvrir le tiroir',
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  page.on('console', (msg) => {
    // Le WebSocket de rechargement a chaud du serveur de developpement n'est pas une erreur du produit.
    if (msg.type() === 'error' && !/webpack-hmr/.test(msg.text())) console.log('BROWSER ERROR LOG:', msg.text());
  });
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err));

  /** Etat de la scene reelle (crochet de debogage de la page de demonstration). */
  const info = () =>
    page.evaluate(() => {
      const i = window['__kitStudioDebug']?.scene?.()?.info?.();
      return {
        rect: i?.view?.subjectRect ?? null,
        etat: i?.bagModel?.status ?? 'inconnu',
        modele: i?.bagModel?.modelId ?? null,
        motif: i?.bagModel?.reason ?? null,
      };
    });

  /**
   * Le sac procedural s'affiche pendant le chargement ; il n'a ni la taille ni la forme du
   * maillage reel. Capturer avant la bascule produit une image qui ne represente pas le produit.
   * On attend donc l'etat 'glb' lui-meme : 'loading' porte deja le modelId, il ne suffit pas.
   */
  async function attendreSac() {
    try {
      await page.waitForFunction(
        () => window['__kitStudioDebug']?.scene?.()?.info?.().bagModel?.status === 'glb',
        undefined,
        { timeout: 60000 },
      );
    } catch {
      throw new Error("Le sac n'est jamais apparu a l'ecran : capture impossible. Etat : " + JSON.stringify(await info()));
    }
    await page.waitForTimeout(500);
  }

  /**
   * Les vignettes du vrai tiroir se rendent une par une, et celles des corps attendent leur
   * maillage. Photographier avant produit des pictogrammes de repli ou des cartes vides.
   * `minimum` : nombre de vignettes 3D attendues (un tiroir sans vignette ne prouve rien).
   */
  async function attendreVignettes(minimum) {
    try {
      await page.waitForFunction(
        (min) => {
          const t = [...document.querySelectorAll('.ks-dock .ks-thumb')];
          return t.length >= min && t.every((e) => e.getAttribute('data-state') === 'ready');
        },
        minimum,
        { timeout: 45000 },
      );
    } catch {
      const etats = await page.evaluate(() =>
        [...document.querySelectorAll('.ks-dock .ks-thumb')].map((e) => e.getAttribute('data-state')),
      );
      throw new Error('Vignettes du tiroir jamais rendues (attendu >= ' + minimum + ') : ' + JSON.stringify(etats));
    }
    await page.waitForTimeout(250);
  }

  /** Clic sur un bouton de capsule du vrai tiroir, par son nom accessible. */
  async function capsule(nom) {
    await page.locator('.ks-dock [role="radio"], .ks-dock [role="tab"]').and(page.getByLabel(nom, { exact: true })).click();
    await page.waitForTimeout(250);
  }

  /** Clic sur une carte du vrai tiroir, par son identifiant de carte. */
  async function carte(id) {
    const c = page.locator('.ks-dock [data-card-id="' + id + '"]');
    await c.scrollIntoViewIfNeeded();
    await c.click();
    await page.waitForTimeout(300);
  }

  /** Mode Apparence, categorie donnee : c'est la que les corps et le coloris se choisissent. */
  async function apparence(categorie) {
    const mode = page.locator('.ks-dock [role="radio"][aria-label="' + LIBELLE.apparence + '"]');
    if ((await mode.getAttribute('aria-checked')) !== 'true') await mode.click();
    await page.waitForTimeout(200);
    await capsule(categorie);
  }

  async function contenu() {
    const mode = page.locator('.ks-dock [role="radio"][aria-label="' + LIBELLE.contenu + '"]');
    if ((await mode.getAttribute('aria-checked')) !== 'true') await mode.click();
    await page.waitForTimeout(300);
  }

  /**
   * Verifie qu'a l'emplacement annonce du sac, l'image contient bien un objet : une part
   * suffisante de pixels s'ecarte de la couleur du fond, relevee dans un coin vide de la vue.
   */
  async function verifierPixels(fichier, rect) {
    if (!rect) return null;
    const meta = await sharp(fichier).metadata();
    const L = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!L || !H) return 'image illisible';

    const fond = await sharp(fichier)
      .extract({ left: 4, top: Math.round(H * 0.3), width: 24, height: 24 })
      .stats();
    const ref = fond.channels.slice(0, 3).map((c) => c.mean);

    const x = Math.max(0, Math.round(rect.x0 * L));
    const y = Math.max(0, Math.round(rect.y0 * H));
    const w = Math.min(L - x, Math.round((rect.x1 - rect.x0) * L));
    const h = Math.min(H - y, Math.round((rect.y1 - rect.y0) * H));
    if (w < 8 || h < 8) return 'rectangle du sujet trop petit pour etre verifie';

    const { data, info: meta2 } = await sharp(fichier)
      .extract({ left: x, top: y, width: w, height: h })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const canaux = meta2.channels;
    let dessines = 0;
    const total = meta2.width * meta2.height;
    for (let i = 0; i < total; i++) {
      const o = i * canaux;
      const ecart =
        Math.abs(data[o] - ref[0]) + Math.abs(data[o + 1] - ref[1]) + Math.abs(data[o + 2] - ref[2]);
      if (ecart > 24) dessines += 1;
    }
    const part = dessines / total;
    // Un sac remplit largement son rectangle ; en dessous d'un tiers, la scene est vide ou
    // l'objet annonce n'est pas celui qui est dessine.
    return part < 0.33
      ? `rien de dessine a l'emplacement du sac (${Math.round(part * 100)} % de pixels)`
      : null;
  }

  /**
   * Controle sur le vrai tiroir : s'il est annonce ouvert, il doit etre visible a l'ecran et porter
   * ses capsules ; ferme, il doit etre hors champ et la pastille a trois points doit etre la.
   * Un banc qui photographie un tiroir absent ne prouve rien sur lui.
   */
  async function verifierTiroir(attendu) {
    const v = await page.evaluate(() => {
      const dock = document.querySelector('.ks-dock');
      const r = dock?.getBoundingClientRect();
      return {
        present: !!dock,
        ouvert: dock?.getAttribute('data-open') === 'true',
        haut: r ? r.top : null,
        hauteurFenetre: window.innerHeight,
        capsules: document.querySelectorAll('.ks-dock .ks-caps').length,
        pastille: !!document.querySelector('.ks-dock-reopen'),
        faux: !!document.getElementById('dock-rail') || !!document.querySelector('.dock-cell'),
      };
    });
    if (!v.present || v.faux) return 'le vrai tiroir est absent';
    if (attendu === 'ouvert') {
      if (!v.ouvert || v.haut == null || v.haut >= v.hauteurFenetre - 40) return 'tiroir annonce ouvert mais hors champ';
      if (v.capsules < 2) return 'le tiroir ouvert ne porte pas ses deux capsules (mode, familles)';
      if (v.pastille) return 'tiroir ouvert mais la pastille de reouverture est affichee';
    } else {
      if (v.ouvert) return 'tiroir annonce ferme mais encore ouvert';
      if (!v.pastille) return 'tiroir ferme sans pastille a trois points';
    }
    return null;
  }

  /**
   * Capture une image et verifie que le sac tient dans le cadre. `minHaut` abaisse le seuil de
   * hauteur pour les vues ou le sujet est legitimement plus petit (decomposition, porteur).
   */
  async function shoot(nom, tiroir, minHaut = undefined) {
    const vu = await info();
    const rect = vu.rect;
    // Un cliche pris sur le sac procedural ne montre pas le produit : il ne prouve rien.
    let raison = vu.etat === 'glb' ? null : 'maillage absent (etat : ' + vu.etat + ', modele : ' + vu.modele + ', motif : ' + vu.motif + ')';
    if (!raison) raison = framingFailure(rect);
    if (raison && minHaut !== undefined && rect && (rect.y1 - rect.y0) * 100 >= minHaut && /trop petit/.test(raison)) {
      raison = null;
    }
    if (!raison) raison = await verifierTiroir(tiroir);
    const fichier = path.join(capturesDir, nom);
    await page.screenshot({ path: fichier });

    // Controle sur l'image, pas sur l'etat du moteur. C'est la lecon du premier garde-fou : il
    // declarait les treize vues conformes pendant que l'ecran montrait une doublure grossiere,
    // parce qu'il interrogeait la scene au lieu de regarder ce qui etait dessine.
    if (!raison) raison = await verifierPixels(fichier, rect);
    console.log('  ' + nom.padEnd(34) + describeRect(rect).padEnd(52) + (raison ? 'ECHEC : ' + raison : 'ok'));
    if (raison) cadrageEchecs.push({ nom, raison });
  }

  /** Les pixels du rail de cartes (bande basse du tiroir) : sert a prouver que les vignettes changent. */
  async function empreinteRail(fichier) {
    const box = await page.locator('.ks-dock .ks-card').first().boundingBox();
    const meta = await sharp(fichier).metadata();
    const k = (meta.width ?? 786) / 393;
    const y = box ? Math.max(0, Math.round((box.y - 4) * k)) : Math.round((meta.height ?? 1704) * 0.7);
    const { data } = await sharp(fichier)
      .extract({ left: 0, top: y, width: meta.width ?? 786, height: Math.min(Math.round(150 * k), (meta.height ?? 1704) - y) })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return data;
  }

  /** Ecart moyen par canal entre deux empreintes de meme taille. */
  function ecartMoyen(a, b) {
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    return s / n;
  }

  console.log('Ouverture de la vraie page du studio : ' + STUDIO_URL + ' (iPhone 16 Pro, 393x852)...');
  await page.goto(STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // L'indicateur du serveur de developpement n'est pas le produit : on le masque dans l'image.
  await page.addStyleTag({ content: 'nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }' });
  await page.waitForFunction(() => !!window['__kitStudioDebug'], undefined, { timeout: 120000 });
  await page.waitForSelector('.ks-dock[data-open="true"]', { timeout: 60000 });
  await attendreSac();
  await page.waitForTimeout(1200);

  // 1. Etat initial : tiroir ouvert en mode Contenu, avec ses cartes
  console.log('Capture 1 : vue initiale, tiroir ouvert (mode Contenu)...');
  await shoot('walkthrough-01-initial.png', 'ouvert');

  // 2. Orbite de la camera (geste de la scene : on appelle la scene reelle)
  console.log('Orbite de la camera autour du sac...');
  await page.evaluate(() => window['__kitStudioDebug'].scene().setZone('front'));
  await page.waitForTimeout(700);
  await shoot('walkthrough-02-orbit-45deg.png', 'ouvert');

  await page.evaluate(() => window['__kitStudioDebug'].scene().setZone('sides'));
  await page.waitForTimeout(700);
  await shoot('walkthrough-03-orbit-90deg.png', 'ouvert');

  await page.evaluate(() => window['__kitStudioDebug'].scene().setZone('back'));
  await page.waitForTimeout(700);
  await shoot('walkthrough-04-orbit-180deg.png', 'ouvert');

  await page.evaluate(() => window['__kitStudioDebug'].scene().recenter());
  await page.waitForTimeout(600);

  // 3. Changement de corps par le tiroir : Apparence > Corps, 45 L -> 15 L puis 80 L
  console.log('Corps 45 L -> 15 L (carte du tiroir, onglet Corps)...');
  // Le kit de demonstration monte par defaut un couvercle, une poche frontale et des poches
  // laterales : ils occupent plus de points d'attache que n'en offre le 15 L, et le vrai tiroir
  // refuse alors ce corps (« Plus de place »). Une personne les retirerait d'abord ; le banc le
  // fait par le store reel (crochet de debogage) puis laisse la carte decider, sans la forcer.
  await page.evaluate(() => {
    const store = window['__kitStudioDebug'].kit.getState();
    for (const m of ['lid', 'front', 'sides', 'hipp']) store.setMod(m, false);
  });
  await apparence(LIBELLE.corps);
  await attendreVignettes(5);
  await carte('lkdv-one-15');
  await attendreSac();
  await attendreVignettes(5);
  await shoot('walkthrough-05-body-15L.png', 'ouvert');

  console.log('Corps 15 L -> 80 L...');
  await carte('lkdv-one-80');
  await attendreSac();
  await attendreVignettes(5);
  await shoot('walkthrough-06-body-80L.png', 'ouvert');

  await carte('lkdv-one-45');
  await attendreSac();

  // 4. Coloris : on choisit le coloris dans l'onglet Coloris, puis on revient sur l'onglet Corps
  // pour que les vignettes des corps du vrai tiroir montrent le coloris choisi.
  console.log('Coloris : Foret -> Sauge (carte du tiroir, onglet Coloris)...');
  await capsule(LIBELLE.coloris);
  await attendreVignettes(1);
  await carte('sauge');
  await capsule(LIBELLE.corps);
  await attendreVignettes(5);
  await page.waitForTimeout(500);
  await shoot('walkthrough-07-color-sauge.png', 'ouvert');
  const empreinteSauge = await empreinteRail(path.join(capturesDir, 'walkthrough-07-color-sauge.png'));

  console.log('Coloris : Sauge -> Pierre...');
  await capsule(LIBELLE.coloris);
  await attendreVignettes(1);
  await carte('pierre');
  await capsule(LIBELLE.corps);
  await attendreVignettes(5);
  await page.waitForTimeout(500);
  await shoot('walkthrough-08-color-pierre.png', 'ouvert');
  const empreintePierre = await empreinteRail(path.join(capturesDir, 'walkthrough-08-color-pierre.png'));
  // Les vignettes du tiroir doivent suivre le coloris : deux coloris, deux rails differents.
  const ecart = ecartMoyen(empreinteSauge, empreintePierre);
  const suivi = ecart > 1.5;
  console.log('  vignettes du tiroir Sauge -> Pierre : ecart moyen ' + ecart.toFixed(2) + ' ' + (suivi ? 'ok' : 'ECHEC'));
  if (!suivi) {
    cadrageEchecs.push({ nom: 'walkthrough-08-color-pierre.png', raison: 'les vignettes des corps ne changent pas avec le coloris (ecart ' + ecart.toFixed(2) + ')' });
  }

  // 5. Modules : onglet Modules du tiroir
  console.log('Module M04 Poche multifonction (carte du tiroir, onglet Modules)...');
  await capsule(LIBELLE.modules);
  await attendreVignettes(1);
  await carte('lkdv-m04');
  await page.waitForTimeout(600);
  await shoot('walkthrough-09-attach-m04.png', 'ouvert');

  console.log('Module M13 Porte-piolets (maillage publie)...');
  await carte('lkdv-m13');
  await page.waitForTimeout(600);
  await shoot('walkthrough-10-attach-m13.png', 'ouvert');

  // 6. Fermeture : on revient en mode Contenu, puis la poignee du vrai tiroir le ferme
  console.log('Tiroir : mode Contenu, puis fermeture par la poignee...');
  await contenu();
  await attendreVignettes(0);
  await page.getByRole('button', { name: LIBELLE.fermer, exact: true }).click();
  await page.waitForSelector('.ks-dock[data-open="false"]', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(900);
  await shoot('walkthrough-11-drawer-closed.png', 'ferme');

  // 7. Reouverture par la vraie pastille a trois points
  console.log('Pastille a trois points : le tiroir se rouvre...');
  await page.getByRole('button', { name: LIBELLE.rouvrir, exact: true }).click();
  await page.waitForSelector('.ks-dock[data-open="true"]', { timeout: 10000 });
  await page.waitForTimeout(1400);
  await attendreVignettes(0);
  await shoot('walkthrough-12-drawer-reopened.png', 'ouvert');

  // 8. Vue decomposee (geste de la scene : on appelle la scene reelle)
  console.log('Vue decomposee (ex = 1.0) : l\'enveloppe couvre tout le nuage...');
  await page.evaluate(() => window['__kitStudioDebug'].scene().setExploded(1.0));
  await page.waitForTimeout(900);
  // En decomposition, le sac partage volontairement le cadre avec tout le kit : il y est plus
  // petit qu'ailleurs, et le plancher de lisibilite ne s'y applique pas.
  await shoot('walkthrough-13-exploded.png', 'ouvert', 20);

  await browser.close();
  console.log('Walkthrough capture complete! All 13 frames saved to ' + capturesDir);

  if (cadrageEchecs.length) {
    console.error('\nControle non conforme sur ' + cadrageEchecs.length + ' capture(s) :');
    for (const e of cadrageEchecs) console.error('  - ' + e.nom + ' : ' + e.raison);
    throw new Error("Un parcours dont une etape ne montre pas le sac et le vrai tiroir n'est pas livrable.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
