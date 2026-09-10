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
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'y-exped-solo').maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const solo = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([...authCookies, solo]);
const page = await context.newPage();
await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
await page.goto('http://localhost:4000/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);
const result = await page.evaluate(() => {
  const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
  const gearSections = document.querySelectorAll('section[aria-label="Équipement du sac"]');
  const members = document.querySelectorAll('section[aria-label="Ressources par sac"]');
  return {
    memberSection: visible('section[aria-label="Ressources par sac"]').length,
    cards: visible('section[aria-label="Équipement du sac"] li button').length,
    trigger: visible('button[aria-label^="Ce qui manque"]').length,
    gearInDom: gearSections.length,
    gearFirstHeight: gearSections[0] ? Math.round(gearSections[0].getBoundingClientRect().height) : null,
    membersInDom: members.length,
    shimmers: document.querySelectorAll('.animate-shimmer, [class*="shimmer"]').length,
    mainLen: (document.querySelector('main')?.innerHTML ?? '').length,
  };
});
await page.screenshot({ path: 'docs/h-captures/v7-gear-solo-390.png', fullPage: true });
console.log(JSON.stringify(result, null, 2));
await context.close();
await browser.close();
process.exit(0);
