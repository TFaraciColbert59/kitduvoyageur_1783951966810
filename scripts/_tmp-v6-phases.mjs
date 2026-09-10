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
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const cookieFor = (payload) => ({ name: 'lkv_active_adventure', value: b64(payload), domain: 'localhost', path: '/', httpOnly: true });

const cases = [
  { name: 'v6-hub-sortie-prepare-390', payload: { nature: 'sortie', id: '65157de2-0d33-443b-84a2-805b633b3af7', slug: 'bivouac-vercors', title: 'Bivouac dans le Hauts-Plateaux du Vercors' } },
  { name: 'v6-hub-sortie-recount-390', payload: { nature: 'sortie', id: '1af2d803-6d40-460f-8c50-3d911afb2a55', slug: 'y-exped-group', title: 'Y — Expédition Huayhuash (groupe)' } },
];

const browser = await chromium.launch();
for (const c of cases) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([...authCookies, cookieFor(c.payload)]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto('http://localhost:4000/hub', { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/h-captures/${c.name}.png`, fullPage: true });
  console.log('ok', c.name);
  await context.close();
}
await browser.close();
process.exit(0);
