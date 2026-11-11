// Compas — passage de validation en ligne (P2, docs/compas/ETAT.md).
//
// Chaque demande est préparée sur un déploiement (preview Vercel) comme le
// ferait une personne sur son téléphone : essai sans compte (ou connexion
// démo tant que l'essai n'est pas ouvert), phrase saisie dans
// « Où », « Préparer mon aventure », attente de l'issue, capture de l'écran.
// Les captures et le journal vont dans proof/ (non versionné, .gitignore) ;
// le contrôle se fait ensuite en base (voyages, étapes, kit, budget).
//
// Usage :
//   node scripts/compas/validate-online.mjs <baseUrl> <phrases.json> [dossier]
//   phrases.json : ["rando 5 jours en Sardaigne en juin", ...]
//   PLAYWRIGHT_CHROMIUM_PATH : exécutable Chromium à utiliser (facultatif).
//
// Les demandes sont espacées de 125 s : la limite est de 6 préparations par
// 10 minutes et par personne.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [base, phrasesFile, outArg] = process.argv.slice(2);
if (!base || !phrasesFile) {
  console.error(
    'Usage : node scripts/compas/validate-online.mjs <baseUrl> <phrases.json> [dossier]'
  );
  process.exit(2);
}
// Deux formes acceptées : ["phrase", …] (jeux de la phase 7) ou le jeu « demandes-or »
// { version, demandes: [{ id, phrase, … }] } (v6). DEMANDES_FROM / DEMANDES_TO (rangs à partir
// de 1, bornes comprises) ne jouent qu'une tranche : plusieurs passages se partagent le jeu.
const rawPhrases = JSON.parse(fs.readFileSync(phrasesFile, 'utf8'));
const allPhrases = (Array.isArray(rawPhrases) ? rawPhrases : rawPhrases.demandes).map((x, i) =>
  typeof x === 'string' ? { id: String(i + 1).padStart(2, '0'), say: x } : { id: x.id, say: x.phrase }
);
const from = Math.max(1, Number(process.env.DEMANDES_FROM) || 1);
const to = Math.min(allPhrases.length, Number(process.env.DEMANDES_TO) || allPhrases.length);
// DEMANDES_IDS="D024,D041" : ne joue que ces demandes (rejeu), dans l'ordre du jeu.
const only = (process.env.DEMANDES_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const phrases = only.length ? allPhrases.filter((p) => only.includes(p.id)) : allPhrases.slice(from - 1, to);
const outDir =
  outArg ?? path.join('proof/compas', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
// 6 préparations par 10 minutes et par personne : jamais moins de 100 s d'écart.
const SPACING_MS = Math.max(100_000, Number(process.env.COMPAS_SPACING_MS) || 125_000);
fs.mkdirSync(outDir, { recursive: true });
const log = (o) => fs.appendFileSync(path.join(outDir, 'results.jsonl'), JSON.stringify(o) + '\n');

// Derrière un mandataire de sortie (session cloud) : Chromium ne lit pas HTTPS_PROXY tout seul.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  ...(proxy ? { proxy: { server: proxy } } : {}),
});
// Le cadre de référence des captures du projet : 393 × 852, densité 2, tactile.
const context = await browser.newContext({
  // STORAGE_STATE : session d'un espace d'essai déjà créé (la création est limitée à 5 par heure et par adresse).
  ...(process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {}),
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  geolocation: { latitude: 45.8992, longitude: 6.1294 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
// Ce qui échoue côté réseau pendant une demande (actions serveur refusées, coupées ou en erreur) :
// rangé dans le journal, pour distinguer une panne du banc d'une panne du site.
let net = [];
page.on('requestfailed', (r) => {
  if (r.method() === 'POST') net.push({ t: Date.now(), kind: 'coupé', path: new URL(r.url()).pathname, why: r.failure()?.errorText ?? '' });
});
page.on('response', (r) => {
  if (r.status() >= 400 && r.request().method() === 'POST')
    net.push({ t: Date.now(), kind: String(r.status()), path: new URL(r.url()).pathname, why: r.headers()['x-vercel-error'] ?? '' });
});

// Aperçu protégé : VERCEL_SHARE=<jeton du lien partagé> pose le cookie d'accès avant tout.
if (process.env.VERCEL_SHARE) {
  await page.goto(`${base}/?_vercel_share=${process.env.VERCEL_SHARE}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
}
if (!process.env.STORAGE_STATE) {
  await page.goto(`${base}/connexion?next=/compas`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  // Essai sans compte (un espace propre à chaque passage) dès qu'il est ouvert ;
  // sinon le compte démo partagé.
  // COMPAS_DEMO=1 : la connexion démo seulement (l'essai sans compte est limité à 5 par heure et par adresse).
  // « Connexion démo » est un lien depuis la refonte de /connexion (#154) ; l'essai sans compte,
  // quand il est proposé, reste un bouton. Les deux formes sont acceptées.
  const entry = process.env.COMPAS_DEMO ? /^Connexion démo$/ : /^(Essayer sans compte|Connexion démo)$/;
  const link = page.getByRole('link', { name: entry }).first();
  const button = page.getByRole('button', { name: entry }).first();
  await button.or(link).first().waitFor({ timeout: 60_000 });
  if ((await button.count()) > 0) await button.click({ timeout: 60_000 });
  else {
    // Le lien est suivi par son adresse, dans un onglet à part : cliqué avant l'hydratation il ne
    // navigue pas, et suivi dans le même onglet il se fait doubler par la navigation de /connexion.
    // Les cookies de session valent pour tout le contexte.
    const href = await link.getAttribute('href');
    const tab = await context.newPage();
    await tab
      .goto(new URL(href ?? '/api/demo-login', base).toString(), { waitUntil: 'domcontentloaded', timeout: 90_000 })
      .catch((e) => console.warn('connexion démo :', String(e).split('\n')[0].slice(0, 160)));
    await tab.waitForURL((u) => !u.pathname.startsWith('/api/'), { timeout: 90_000 }).catch(() => undefined);
    await tab.close();
    await page.goto(`${base}/compas`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  }
  // Le chemin, pas l'URL entière (« /connexion?next=%2Fcompas » contient « compas »).
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'), { timeout: 90_000 });
}
console.info('connecté');

for (const [i, { id, say }] of phrases.entries()) {
  const t0 = Date.now();
  net = [];
  const slug = id;
  try {
    await page.goto(`${base}/compas?nouvelle=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (new URL(page.url()).pathname.startsWith('/connexion')) throw new Error('session perdue');
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    const cookies = page.getByRole('button', { name: 'Refuser' });
    if (await cookies.isVisible().catch(() => false)) await cookies.click().catch(() => undefined);
    // Écran v5 (`V5Start`) : un champ d'une ligne et un bouton « C'est parti » ; la préparation
    // part d'elle-même une fois le voyage créé. L'ancien écran (zone de texte et bouton
    // « Préparer mon aventure ») reste accepté.
    const v5Box = page.getByRole('textbox', { name: 'Ta destination, en une phrase' });
    const oldBox = page.locator('textarea').first();
    await v5Box.or(oldBox).first().waitFor({ timeout: 60_000 });
    const isV5 = (await v5Box.count()) > 0;
    const box = isV5 ? v5Box : oldBox;
    const go = isV5
      ? page.getByRole('button', { name: 'C’est parti' })
      : page.getByRole('button', { name: 'Préparer mon aventure' });
    // La saisie ne tient qu'une fois la page interactive (hydratation) : on vérifie.
    for (let k = 0; k < 5 && !(await go.isEnabled().catch(() => false)); k += 1) {
      await box.fill('');
      await box.pressSequentially(say, { delay: 10 });
      await page.waitForTimeout(1500);
    }
    await go.click({ timeout: 30_000 });
    const tStart = Date.now();
    const end = page.getByText(/Ton aventure est prête|Préparation interrompue|Préparation arrêtée|La préparation s’est arrêtée/).first();
    await end.waitFor({ timeout: 420_000 });
    const prepSeconds = Math.round((Date.now() - tStart) / 1000);
    const outcome = (await end.innerText().catch(() => '')).slice(0, 80);
    const head = (
      await (isV5 ? end.locator('xpath=ancestor::*[self::section or self::div][1]') : page.getByRole('status', { name: 'Préparation de l’aventure' }))
        .innerText()
        .catch(() => '')
    ).slice(0, 600);
    await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: false });
    log({ i: from + i, id, at: new Date(t0).toISOString(), say, url: page.url(), seconds: Math.round((Date.now() - t0) / 1000), prepSeconds, outcome, head, net: net.map((n) => ({ ...n, t: Math.round((n.t - t0) / 1000) })) });
    console.info(slug, Math.round((Date.now() - t0) / 1000), 's', say);
  } catch (e) {
    await page.screenshot({ path: path.join(outDir, `${slug}-erreur.png`) }).catch(() => undefined);
    log({
      i: from + i,
      id,
      at: new Date(t0).toISOString(),
      say,
      url: page.url(),
      seconds: Math.round((Date.now() - t0) / 1000),
      error: String(e).slice(0, 300),
      net: net.map((n) => ({ ...n, t: Math.round((n.t - t0) / 1000) })),
    });
    console.warn(slug, 'ERREUR', String(e).slice(0, 160));
  }
  const wait = SPACING_MS - (Date.now() - t0);
  if (i < phrases.length - 1 && wait > 0) await page.waitForTimeout(wait);
}
await browser.close();
