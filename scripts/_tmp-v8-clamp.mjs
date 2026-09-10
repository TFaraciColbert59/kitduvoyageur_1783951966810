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
const { data: trip } = await sb.from('trips').select('id,slug,title,start_date').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([...authCookies, sortie]);
const page = await context.newPage();
await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
await page.goto('http://localhost:4000/hub/budget', { waitUntil: 'networkidle', timeout: 60000 });
await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
await page.waitForTimeout(1500);

const TITLE = `Clamp test ${Date.now()}`;

// Ajoute une dépense HORS plage (avant le départ du voyage)
await page.locator('button', { hasText: 'Ajouter une dépense' }).first().click({ force: true });
await page.waitForTimeout(600);
await page.locator('input[name="title"]').fill(TITLE);
await page.locator('input[name="amount"]').fill('7.77');
await page.locator('input[name="expenseDate"]').fill('2026-09-01');
await page.locator('button[type="submit"]', { hasText: 'Valider la dépense' }).first().click({ force: true });
await page.waitForTimeout(1800);

// Ouvre le drawer du jour J1 (2026-09-07) : la dépense clampée doit y apparaître
await page.locator('section[aria-label="Jour par jour"] li button:visible').first().click({ force: true });
await page.waitForTimeout(800);
const result = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return {
    title: dialog?.querySelector('h2')?.textContent?.trim() ?? null,
    text: (dialog?.innerText ?? '').replace(/\n+/g, ' | ').slice(0, 240),
  };
});
console.log('drawer:', JSON.stringify(result));
const visible = result.text.includes('Clamp test');
console.log('clamped expense visible in day drawer:', visible);
await page.screenshot({ path: 'docs/h-captures/v8-budget-clamp-drawer.png' });

// Cleanup
const { data: created } = await sb
  .from('trip_expenses')
  .select('id')
  .eq('trip_id', trip.id)
  .eq('title', TITLE)
  .maybeSingle();
if (created) {
  await sb.from('trip_expenses').delete().eq('id', created.id);
  console.log('cleanup ok');
}
await context.close();
await browser.close();
process.exit(0);
