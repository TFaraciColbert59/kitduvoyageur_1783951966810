import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
let savedCookies = [];
const sb = createServerClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const { data: group } = await sb.from('travel_groups').select('id,name').limit(1).maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const cookieFor = (p) => ({ name: 'lkv_active_adventure', value: b64(p), domain: 'localhost', path: '/', httpOnly: true });
const sortie = cookieFor({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title });
const possession = cookieFor({ nature: 'possession' });
const collectif = group ? cookieFor({ nature: 'collectif', kind: 'groupe', id: group.id, title: group.name }) : null;

const browser = await chromium.launch();
const routes = [
  { path: '/hub', cookie: sortie },
  { path: '/hub/kit-voyage', cookie: sortie },
  { path: '/hub/itineraire', cookie: sortie },
  { path: '/hub/checklist', cookie: sortie },
  { path: '/hub/budget', cookie: sortie },
  { path: '/hub/equipage', cookie: sortie },
  { path: '/hub/securite', cookie: sortie },
  { path: '/hub/journal', cookie: sortie },
  { path: '/hub/documents', cookie: sortie },
  { path: '/hub/export', cookie: sortie },
  { path: '/hub', cookie: possession },
  { path: '/hub/inventaire', cookie: possession },
  { path: '/hub/kit', cookie: possession },
  { path: '/hub/depart', cookie: possession },
  { path: '/hub', cookie: collectif ?? possession },
];

for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push((e.stack ?? e.message).slice(0, 500)));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && text.includes('Rendered more hooks')) errors.push(text.slice(0, 1500));
  });
  for (const route of routes) {
    await context.clearCookies();
    await context.addCookies([...authCookies, route.cookie]);
    errors.length = 0;
    try {
      await page.goto('http://localhost:4000' + route.path, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1600);
    } catch (e) {
      errors.push('NAV ' + String(e).slice(0, 120));
    }
    if (errors.length) {
      console.log(`HOOKS ERROR @ ${width} ${route.path}`);
      console.log(errors[0]);
    }
  }
  await context.close();
}
console.log('crawl done');
await browser.close();
process.exit(0);
