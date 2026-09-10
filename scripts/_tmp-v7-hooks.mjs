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
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([...authCookies, sortie]);
const page = await context.newPage();
const allErrors = [];
page.on('pageerror', (e) => allErrors.push('PAGEERROR ' + (e.stack ?? e.message).slice(0, 4000)));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !text.includes('hydrated but some attributes')) {
    allErrors.push('CONSOLE ' + text.slice(0, 4000));
  }
});

async function step(name, fn) {
  const before = allErrors.length;
  await fn();
  await page.waitForTimeout(900);
  const fresh = allErrors.slice(before);
  console.log(`--- ${name}: ${fresh.length ? 'ERROR' : 'ok'}`);
  fresh.forEach((e) => console.log(e.slice(0, 2500)));
}

await page.goto('http://localhost:4000/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await step('open item panel + toggle packed', async () => {
  await page.locator('section[aria-label="Équipement du sac"] li button:visible').first().click();
  await page.waitForTimeout(700);
  const toggle = page.locator('[role="dialog"] button', { hasText: 'Marquer comme prêt' }).first();
  if (await toggle.count()) await toggle.click();
  await page.keyboard.press('Escape');
});
await step('voir plus d’idées', async () => {
  const more = page.locator('button', { hasText: 'Voir plus d’idées' }).first();
  if (await more.count()) await more.click();
});
await step('retirer un objet du sac', async () => {
  const trash = page.locator('button[aria-label="Retirer du sac"]:visible').last();
  if (await trash.count()) await trash.click();
});
await step('missing drawer advance', async () => {
  const trigger = page.locator('button[aria-label^="Ce qui manque"]:visible').first();
  if (await trigger.count()) {
    await trigger.click({ force: true });
    await page.waitForTimeout(700);
    const action = page.locator('[role="dialog"] ul li button').first();
    if (await action.count()) await action.click();
    await page.keyboard.press('Escape');
  }
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(1200);
await step('desktop resize', async () => {});

console.log('===== TOTAL ERRORS: ' + allErrors.length + ' =====');
console.log(allErrors.slice(0, 2).join('\n---\n') || 'no errors');
await page.screenshot({ path: 'docs/h-captures/v7-hooks-error.png' });
await context.close();
await browser.close();
process.exit(0);
