import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const GROUP = '00000000-0000-4000-8000-000000000001';

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
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false }));
let collectif;
if (process.argv[5] === 'sortie') {
  const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
  collectif = {
    name: 'lkv_active_adventure',
    value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
  };
} else {
  collectif = {
    name: 'lkv_active_adventure',
    value: b64({ nature: 'collectif', id: GROUP, title: 'Tour des Écrins — Équipée' }),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
  };
}

const browser = await chromium.launch();
const width = Number(process.argv[2] || 390);
const height = Number(process.argv[3] || 844);
const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([...authCookies, collectif]);
const page = await context.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text().slice(0, 300)));
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)));
await page.goto(base + (process.argv[4] || '/hub/groupe'), { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('URL:', page.url());
console.log('COOKIES:', (await context.cookies()).map((c) => `${c.name}(${c.httpOnly ? 'ho' : 'js'})`).join(', '));
const diag = await page.evaluate(() => {
  const test = (() => {
    document.cookie = '__sb_test__=1; Path=/; SameSite=None; Secure';
    const ok = document.cookie.includes('__sb_test__');
    document.cookie = '__sb_test__=; Max-Age=0; Path=/';
    return ok;
  })();
  return {
    canUseCookies: test,
    docCookies: document.cookie.split(';').map((c) => c.trim().split('=')[0]).filter(Boolean),
    lsKeys: Object.keys(localStorage).slice(0, 10),
    authCookieReadable: document.cookie.includes('auth-token'),
  };
});
console.log('DIAG:', JSON.stringify(diag));
const text = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('BODY:', text);
await page.screenshot({ path: 'docs/h-captures/v9-debug-390.png', fullPage: true });
await browser.close();
process.exit(0);
