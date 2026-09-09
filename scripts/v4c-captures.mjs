// Hub V4c — Captures de validation du hub prescriptif (fil d'action, bento
// par phase, rail contextuel, « Plus de sections », SOS). Auth démo Y via
// Supabase + cookie lkv_active_adventure (base64url, schéma adventureSchema).
import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = process.env.LKDV_BASE || 'http://localhost:4000';
const outDir = 'docs/h-captures';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!url || !anonKey) {
  console.error('Config Supabase absente (.env/.env.local)');
  process.exit(1);
}

let savedCookies = [];
const sb = createServerClient(url, anonKey, {
  cookies: {
    getAll: () => savedCookies,
    setAll: (cs) => { savedCookies = cs; },
  },
});
const { data: authData, error: authError } = await sb.auth.signInWithPassword({
  email: 'y-demo@lekitduvoyageur.fr',
  password: 'Ydemo!2026',
});
if (authError || !authData?.user) {
  console.error('Auth démo KO:', authError?.message);
  process.exit(1);
}
console.log('Auth OK:', authData.user.email);

// Première sortie du compte démo (pour le cookie d'aventure active).
const { data: tripRow } = await sb
  .from('trips')
  .select('id, slug, title, user_id')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
const sortie = tripRow || null;
console.log('Trip démo:', sortie ? `${sortie.title} (${sortie.slug})` : 'aucun');

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const adventureCookie = sortie
  ? { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: sortie.id, slug: sortie.slug, title: sortie.title }), domain: 'localhost', path: '/', httpOnly: true }
  : null;

const authCookies = savedCookies.map((c) => ({
  name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true,
}));

const browser = await chromium.launch();
const results = [];

async function capture(name, { path, viewport, clickText, fullPage = false, clock = '2026-06-01T09:00:00Z' }) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await context.addCookies(authCookies);
  if (adventureCookie) await context.addCookies([adventureCookie]);
  const page = await context.newPage();
  await page.addInitScript(
    ([key]) => { localStorage.setItem(key, JSON.stringify({ analytics: false, marketing: false, version: '1' })); },
    ['lkdv_cookie_consent'],
  );
  // Masque l'overlay dev Next (hors production) pour des captures propres.
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({
      content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }',
    });
  } catch (e) {
    results.push({ name, status: 'ERR', msg: String(e).slice(0, 140) });
    await context.close();
    return;
  }
  if (clickText) {
    await page.getByText(clickText, { exact: false }).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
  }
  const shot = `${outDir}/${name}.png`;
  await page.screenshot({ path: shot, fullPage });
  results.push({ name, status: 'ok', shot });
  await context.close();
}

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

await capture('v4c-hub-possession-desktop', { path: '/hub', viewport: desktop });
if (sortie) {
  await capture('v5e-hub-sortie-desktop', { path: '/hub', viewport: desktop });
  await capture('v5e-hub-sortie-mobile', { path: '/hub', viewport: mobile, fullPage: true });
  await capture('v4c-hub-sortie-mobile', { path: '/hub', viewport: mobile, fullPage: true });
  await capture('v4c-hub-sortie-mobile-live-sos', { path: '/hub?phase=live', viewport: mobile });
  await capture('v4c-hub-sortie-mobile-plus-sections', { path: '/hub', viewport: mobile, clickText: 'Plus de sections' });
  await capture('v4c-rail-contextuel-budget', { path: '/hub/budget', viewport: desktop });
  await capture('v4c-rail-contextuel-securite', { path: '/hub/securite', viewport: desktop });
}

fs.writeFileSync(`${outDir}/v4c-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
