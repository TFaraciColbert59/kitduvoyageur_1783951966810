// Compas — passage de validation en ligne (P2, docs/compas/ETAT.md).
//
// Chaque demande est préparée sur un déploiement (preview Vercel) comme le
// ferait une personne sur son téléphone : connexion démo, phrase « Dis-le »
// saisie dans le Compas vide (CompasStart), création de l'aventure, phrase
// comprise et appliquée dans le tiroir Où, attente de l'issue, capture.
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
const phrases = JSON.parse(fs.readFileSync(phrasesFile, 'utf8'));
const outDir =
  outArg ?? path.join('proof/compas', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
const SPACING_MS = 125_000;
fs.mkdirSync(outDir, { recursive: true });
const log = (o) => fs.appendFileSync(path.join(outDir, 'results.jsonl'), JSON.stringify(o) + '\n');

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {}
);
// Le cadre de référence des captures du projet : 393 × 852, densité 2, tactile.
const context = await browser.newContext({
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

await page.goto(`${base}/connexion?next=/compas`, {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
});
await page.getByRole('button', { name: 'Connexion démo' }).click({ timeout: 60_000 });
// Le chemin, pas l'URL entière (« /connexion?next=%2Fcompas » contient « compas »).
await page.waitForURL((u) => u.pathname.startsWith('/compas'), { timeout: 90_000 });
console.info('connecté');

for (const [i, say] of phrases.entries()) {
  const t0 = Date.now();
  const slug = String(i + 1).padStart(2, '0');
  try {
    await page.goto(`${base}/compas?nouvelle=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (new URL(page.url()).pathname.startsWith('/connexion')) throw new Error('session perdue');
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    const cookies = page.getByRole('button', { name: 'Refuser' });
    if (await cookies.isVisible().catch(() => false)) await cookies.click().catch(() => undefined);
    // Compas vide : un seul champ « Dis-le », envoyé par Entrée (pas de bouton).
    const box = page.locator('#cp-start-say');
    await box.waitFor({ timeout: 60_000 });
    // La saisie ne tient qu'une fois la page interactive (hydratation) : on vérifie.
    for (let k = 0; k < 5 && (await box.inputValue().catch(() => '')) !== say; k += 1) {
      await box.fill('');
      await box.pressSequentially(say, { delay: 10 });
      await page.waitForTimeout(1500);
    }
    await box.press('Enter');
    // L'aventure créée, la page quitte `?nouvelle=1` et ouvre le Compas complet.
    await page.waitForURL(
      (u) => u.pathname.startsWith('/compas') && !u.searchParams.has('nouvelle'),
      {
        timeout: 90_000,
      }
    );
    // La phrase est comprise dans le tiroir Où puis appliquée d'office (îlot
    // « N changements appliqués »), ou rien n'est à appliquer, ou une erreur.
    await page
      .locator('.cp-island, .cp-disle__out, [role="alert"]')
      .filter({ hasText: /appliqué|Rien de précis|Action impossible|Connexion perdue|n’a pas pu/ })
      .first()
      .waitFor({ timeout: 330_000 });
    await page.waitForTimeout(2000);
    const outcome = page.locator('.cp-island, .cp-disle__out, [role="alert"]');
    const head = (await outcome.allInnerTexts().catch(() => [])).join('\n').slice(0, 600);
    await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: false });
    log({ i: i + 1, say, url: page.url(), seconds: Math.round((Date.now() - t0) / 1000), head });
    console.info(slug, Math.round((Date.now() - t0) / 1000), 's', say);
  } catch (e) {
    await page.screenshot({ path: path.join(outDir, `${slug}-erreur.png`) }).catch(() => undefined);
    log({
      i: i + 1,
      say,
      url: page.url(),
      seconds: Math.round((Date.now() - t0) / 1000),
      error: String(e).slice(0, 300),
    });
    console.warn(slug, 'ERREUR', String(e).slice(0, 160));
  }
  const wait = SPACING_MS - (Date.now() - t0);
  if (i < phrases.length - 1 && wait > 0) await page.waitForTimeout(wait);
}
await browser.close();
