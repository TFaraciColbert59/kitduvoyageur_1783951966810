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
//
// Connexion, dans cet ordre : STORAGE_STATE (session déjà créée) ; sinon, si
// NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont connues (variables
// ou .env.local), une session d'essai anonyme créée par Supabase et posée en cookie
// (le bouton « Essayer sans compte » a quitté la page de connexion le 30 oct.) ;
// sinon les boutons de /connexion. Écran : l'accueil v5 (« Où veux-tu aller ? »,
// îlot de préparation) ou l'ancien (?v5=0, zone de texte et « Préparer mon aventure »).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';

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

// Aperçu protégé : VERCEL_SHARE=<jeton du lien partagé> pose le cookie d'accès avant tout.
if (process.env.VERCEL_SHARE) {
  await page.goto(`${base}/?_vercel_share=${process.env.VERCEL_SHARE}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
}
/** Variables publiques Supabase : environnement, sinon .env.local du dépôt. */
function supabasePublicEnv() {
  const env = { ...process.env };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
        const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.+)$/);
        if (m && !env[m[1]]) env[m[1]] = m[2].trim();
      }
    } catch {
      // pas de .env.local : on passera par les boutons de /connexion
    }
  }
  return env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
    : null;
}

/**
 * Session d'essai anonyme : les cookies sont ceux que pose @supabase/ssr. Le client garde la
 * session pour relire, sous la RLS de cette personne, le voyage créé par chaque phrase.
 */
async function anonymousSession(supa) {
  const jar = new Map();
  const client = createServerClient(supa.url, supa.key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`session d'essai refusée : ${error.status ?? ''} ${error.message}`);
  console.info('essai anonyme', data.user?.id);
  fs.writeFileSync(
    path.join(outDir, 'session.json'),
    JSON.stringify({ user: data.user?.id ?? null, base, at: new Date().toISOString() }, null, 1)
  );
  const { hostname, protocol } = new URL(base);
  const cookies = [...jar].map(([name, value]) => ({
    name,
    value,
    domain: hostname,
    path: '/',
    httpOnly: false,
    secure: protocol === 'https:',
    sameSite: 'Lax',
  }));
  return { client, cookies };
}

/** Le dernier voyage de la personne, tel qu'il est rangé en base (lieu, pays, dates, ancre). */
async function latestTrip(client) {
  const { data, error } = await client
    .from('trips')
    .select('id, title, destination_name, destination_country_code, start_date, end_date, party_size, metadata')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return { error: error?.message ?? 'aucun voyage' };
  const t = data[0];
  const anchor = t.metadata?.compas?.anchor ?? null;
  return {
    id: t.id,
    title: t.title,
    destination: t.destination_name,
    country: t.destination_country_code,
    start: t.start_date,
    end: t.end_date,
    party: t.party_size,
    anchor: anchor
      ? { name: anchor.name ?? null, lat: anchor.lat ?? null, lon: anchor.lon ?? null, osmTag: anchor.osmTag ?? null }
      : null,
  };
}

const supa = process.env.STORAGE_STATE || process.env.COMPAS_DEMO ? null : supabasePublicEnv();
let reader = null;
if (supa) {
  const session = await anonymousSession(supa);
  reader = session.client;
  await context.addCookies(session.cookies);
} else if (!process.env.STORAGE_STATE) {
  await page.goto(`${base}/connexion?next=/compas`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  // Essai sans compte (un espace propre à chaque passage) dès qu'il est ouvert ;
  // sinon le compte démo partagé.
  // COMPAS_DEMO=1 : la connexion démo seulement (l'essai sans compte est limité à 5 par heure et par adresse).
  await page
    .getByRole('button', { name: process.env.COMPAS_DEMO ? /^Connexion démo$/ : /^(Essayer sans compte|Connexion démo)$/ })
    .first()
    .click({ timeout: 60_000 });
  // Le chemin, pas l'URL entière (« /connexion?next=%2Fcompas » contient « compas »).
  await page.waitForURL((u) => u.pathname.startsWith('/compas'), { timeout: 90_000 });
}
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
    // Écran v5 (champ « Ta destination, en une phrase » + « C’est parti ») ou ancien écran.
    const v5Box = page.getByRole('textbox', { name: 'Ta destination, en une phrase' });
    const oldBox = page.locator('textarea').first();
    await v5Box.or(oldBox).first().waitFor({ timeout: 60_000 });
    const v5 = await v5Box.isVisible().catch(() => false);
    const box = v5 ? v5Box : oldBox;
    // La saisie ne tient qu'une fois la page interactive (hydratation) : on vérifie.
    const go = v5
      ? page.getByRole('button', { name: 'C’est parti' })
      : page.getByRole('button', { name: 'Préparer mon aventure' });
    for (let k = 0; k < 5 && !(await go.isEnabled().catch(() => false)); k += 1) {
      await box.fill('');
      await box.pressSequentially(say, { delay: 10 });
      await page.waitForTimeout(1500);
    }
    await go.click({ timeout: 30_000 });
    const outcome = /Ton aventure est prête|Préparation interrompue|Préparation arrêtée|La préparation s’est arrêtée/;
    let head = '';
    if (v5) {
      // L'aventure est créée, la page se recharge sur /compas et l'îlot montre la préparation.
      await page.waitForURL((u) => u.pathname === '/compas' && !u.searchParams.has('nouvelle'), { timeout: 90_000 });
      const end = page.getByText(outcome).first();
      await end.waitFor({ timeout: 330_000 });
      head = (await end.locator('xpath=ancestor::*[self::section or self::div][1]').innerText().catch(() => ''))
        .slice(0, 600);
      if (!head) head = (await end.innerText().catch(() => '')).slice(0, 600);
    } else {
      const status = page.getByRole('status', { name: 'Préparation de l’aventure' });
      await status.waitFor({ timeout: 90_000 });
      await page.getByText(outcome).first().waitFor({ timeout: 330_000 });
      head = (await status.innerText().catch(() => '')).slice(0, 600);
    }
    await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: false });
    const trip = reader ? await latestTrip(reader).catch((e) => ({ error: String(e).slice(0, 200) })) : undefined;
    log({ i: i + 1, say, url: page.url(), seconds: Math.round((Date.now() - t0) / 1000), head, ...(trip ? { trip } : {}) });
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
