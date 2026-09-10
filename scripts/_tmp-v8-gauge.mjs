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
await page.goto('http://localhost:4000/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
await page.waitForTimeout(1600);
const info = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label^="Ce qui manque"]');
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), label: btn.getAttribute('aria-label') };
});
console.log(JSON.stringify(info));
if (info) {
  await page.screenshot({
    path: 'docs/h-captures/v8-gauge-closeup.png',
    clip: { x: Math.max(0, info.x - 80), y: Math.max(0, info.y - 40), width: 140, height: info.h + 80 },
  });
}
await context.close();
await browser.close();
process.exit(0);
