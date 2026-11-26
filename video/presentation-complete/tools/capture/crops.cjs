// Découpe de vrais composants de l'app (captures d'éléments, ×3). Lecture seule : on ouvre, on photographie, on ne valide rien.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2]; const ST = process.argv[3]; const B = 'http://localhost:3000';
(async () => {
  const b = await chromium.launch();
  const mk = async (logged) => { const c = await b.newContext({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, locale: 'fr-FR', ...(logged ? { storageState: ST } : {}) }); return c.newPage(); };
  const prep = async (p, url) => {
    await p.goto(B + url, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(2500);
    await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await p.getByRole('button', { name: 'Refuser' }).first().click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(600);
  };
  const shot = async (p, loc, name) => { try { const l = loc.first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }); await p.waitForTimeout(500); await l.screenshot({ path: `${OUT}/${name}.png` }); console.log('ok', name); } catch (e) { console.log('KO', name, e.message.split('\n')[0]); } };
  // carnet v2 (banc de démonstration, vrai composant)
  let p = await mk(false);
  await prep(p, '/dev/carnet-v2?tiroir=fil');
  const fil = [['rencontre-marc', /^Rencontre 14:20/], ['rencontre-gardienne', /^Rencontre 10:20/], ['pokedex-bouquetin', /^Pokédex 09:05/], ['pokedex-edelweiss', /^Pokédex 09:30 Chalet/],
               ['nuit-pigeonnier', /^Refuge Soir Refuge du Pigeonnier/], ['nuit-muzelle', /^Bivouac Soir/], ['performance-j1', /^Performance Étape La Bérarde/], ['incident', /^Incident 11:40/], ['kit-filtre', /^Kit 11:02/]];
  for (const [n, re] of fil) await shot(p, p.getByRole('button', { name: re }), n);
  await p.close();
  for (const [t, n] of [['chiffres', 'carnet-chiffres'], ['equipage', 'carnet-equipage'], ['route', 'carnet-pokedex'], ['sac', 'carnet-sac']]) {
    p = await mk(false); await prep(p, '/dev/carnet-v2?tiroir=' + t);
    await shot(p, p.locator('[role=dialog], [data-vaul-drawer], .lkdv-sheet, section').filter({ hasText: /./ }).last(), n + '-tiroir');
    await p.screenshot({ path: `${OUT}/${n}-ecran.png` }); await p.close();
  }
  // Compas : la vraie pastille de préparation (voyage existant du compte de démo)
  p = await mk(true); await prep(p, '/compas');
  await shot(p, p.getByText('Je prépare ton aventure', { exact: false }).locator('xpath=ancestor::*[self::div or self::section][1]'), 'compas-prepare');
  await shot(p, p.getByText('Je prépare ton aventure', { exact: false }).locator('xpath=ancestor::*[self::div or self::section][2]'), 'compas-prepare-2');
  await p.close();
  // Cordée des Alpes : vraies lignes de membres
  p = await mk(true); await prep(p, '/clubs/cordee-des-alpes');
  await p.getByRole('button', { name: /Espaces du club/ }).first().click(); await p.waitForTimeout(3500);
  for (const [n, re] of [['membre-camille', /^Camille Vidal/], ['membre-genevieve', /^Geneviève Aubert/], ['membre-jeanluc', /^Jean-Luc Perrin/]]) await shot(p, p.getByRole('button', { name: re }), n);
  await p.close();
  // Explorer : le vrai panneau des couches et fonds
  p = await mk(true); await prep(p, '/explorer');
  await p.getByRole('button', { name: 'Calques de la carte' }).click(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/explorer-couches-ecran.png` });
  await shot(p, p.getByText('Fond de carte', { exact: true }).locator('xpath=ancestor::*[self::div or self::section][2]'), 'explorer-fond-de-carte');
  await p.close();
  await b.close();
})();
