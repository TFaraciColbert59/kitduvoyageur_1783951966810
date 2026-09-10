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
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: '0e393749-c9b9-42b9-9678-22067b570f43', slug: 'tour-mont-blanc-refuge', title: 'Tour du Mont-Blanc — version refuges' }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = [];

async function check(name, viewport, path, expect) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto('http://localhost:4000' + path, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(900);
  const titleBtn = page.locator('h1 button:visible').first();
  const hasTitle = await titleBtn.count();
  let opened = false;
  if (hasTitle && expect === 'open') {
    await titleBtn.click({ force: true });
    await page.waitForTimeout(900);
    const dialog = page.locator('[role="dialog"]:visible');
    opened = (await dialog.count()) > 0;
  }
  const pill = page.locator('button:visible', { hasText: 'Tour du Mont-Blanc' });
  const pillVisible = (await pill.count()) > 0 && (await pill.first().isVisible().catch(() => false));
  results.push({ name, hasTitle, opened, pillVisible });
  await context.close();
}

await check('mobile-390-root-title-opens-sheet', { width: 390, height: 844 }, '/hub', 'open');
await check('tablet-768-root-title-opens-dialog', { width: 768, height: 1024 }, '/hub', 'open');
await check('mobile-390-section-shows-pill', { width: 390, height: 844 }, '/hub/itineraire', 'none');
await check('desktop-1440-root-loads', { width: 1440, height: 900 }, '/hub', 'none');

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
