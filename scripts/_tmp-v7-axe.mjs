import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
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
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = [];
for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto('http://localhost:4000/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      nodes: v.nodes.slice(0, 6).map((n) => ({
        target: n.target.join(' '),
        summary: (n.failureSummary ?? '').slice(0, 160),
        html: (n.html ?? '').slice(0, 160),
      })),
    }));
}

const base = await new AxeBuilder({ page }).analyze();
results.push({ width, surface: 'gear', blocking: blockingInfo(base.violations) });
if (width === 390) {
  const trigger = page.locator('button[aria-label^="Ce qui manque"]:visible').first();
  if (await trigger.count()) {
    await trigger.click({ force: true });
    await page.waitForTimeout(900);
    const drawer = await new AxeBuilder({ page }).analyze();
    results.push({ width, surface: 'gear-missing-drawer', blocking: blockingInfo(drawer.violations) });
  }
}
  await context.close();
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
