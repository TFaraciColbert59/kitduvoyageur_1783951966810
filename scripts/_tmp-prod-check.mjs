import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
}
const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
let saved = [];
const sb = createServerClient(url, anonKey, { cookies: { getAll: () => saved, setAll: (cs) => { saved = cs; } } });
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: tripRow } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const domain = 'www.koosmoweb.fr';
const authCookies = saved.map((c) => ({ name: c.name, value: c.value, domain, path: '/', httpOnly: true }));
const adv = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: tripRow.id, slug: tripRow.slug, title: tripRow.title }), domain, path: '/', httpOnly: true };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([...authCookies, adv]);
const page = await context.newPage();
const adRequests = [];
page.on('request', (r) => { if (r.url().includes('tpembars')) adRequests.push(r.url()); });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
let status = null;
try {
  const resp = await page.goto('https://www.koosmoweb.fr/hub', { waitUntil: 'networkidle', timeout: 90000 });
  status = resp?.status();
} catch (e) { console.log('GOTO ERR:', String(e).slice(0, 160)); }
await page.waitForTimeout(3000);
const probe = await page.evaluate(() => ({
  hasError: /Application error|Configuration Supabase manquante/i.test(document.body.innerText),
  hasHubContent: /déroulé|Activités|planificateur|itinéraire/i.test(document.body.innerText),
  textSnippet: document.body.innerText.slice(0, 200),
}));
console.log(JSON.stringify({ status, ...probe, adRequests: adRequests.slice(0, 3), consoleErrors: consoleErrors.slice(0, 4) }, null, 2));
await page.screenshot({ path: 'docs/h-captures/prod-hub.png' });
await browser.close();
process.exit(0);
