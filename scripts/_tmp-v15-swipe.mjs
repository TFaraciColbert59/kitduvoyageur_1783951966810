import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';

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
const { data: trip } = await sb
  .from('trips')
  .select('id,slug,title')
  .eq('slug', 'tour-mont-blanc-refuge')
  .maybeSingle();

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const results = {};

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

const browser = await chromium.launch();

async function open(width, height, url, options = {}) {
  const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false }));
  const sortie = {
    name: 'lkv_active_adventure',
    value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
  };
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    hasTouch: width < 1024,
    isMobile: width < 1024,
    ...(options.userAgent ? { userAgent: options.userAgent } : {}),
  });
  await context.addCookies([...authCookies, sortie]);
  await context.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
    const mkTouch = (target, x, y) => new Touch({ identifier: 1, target, clientX: x, clientY: y });
    window.__lkdvSwipe = (dx, dy = 0, selector = 'body') => {
      const el = document.querySelector(selector) || document.body;
      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + rect.width / 2, 20), window.innerWidth - 20);
      const y = Math.min(Math.max(rect.top + Math.min(rect.height / 2, 120), 20), window.innerHeight - 20);
      el.dispatchEvent(
        new TouchEvent('touchstart', { touches: [mkTouch(el, x, y)], changedTouches: [mkTouch(el, x, y)], bubbles: true, cancelable: true })
      );
      el.dispatchEvent(
        new TouchEvent('touchend', { touches: [], changedTouches: [mkTouch(el, x + dx, y + dy)], bubbles: true, cancelable: true })
      );
    };
  });
  const page = await context.newPage();
  await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2600);
  return { context, page };
}

try {
  /* ── HUB ROOT : carte jusqu'en bas + card au-dessus de la tab bar ── */
  const hub = await open(390, 844, '/hub');
  results.layout = await hub.page.evaluate(() => {
    const scrollHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, 500);
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);
    const section = Array.from(document.querySelectorAll('section')).find((el) =>
      ["Départ de l’expédition", "Étape du jour", "Bilan de l'expédition"].some((label) =>
        (el.getAttribute('aria-label') ?? '').startsWith(label.slice(0, 12))
      )
    );
    const panel = section?.querySelector('.glass');
    const sectionRect = section?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    return {
      found: !!section,
      scrollHeight: Math.round(scrollHeight),
      viewport: window.innerHeight,
      noVerticalScroll: scrollHeight <= window.innerHeight + 2 && scrollY === 0,
      sectionBottom: sectionRect ? Math.round(sectionRect.bottom) : null,
      sectionHeight: sectionRect ? Math.round(sectionRect.height) : null,
      panelBottom: panelRect ? Math.round(panelRect.bottom) : null,
      panelAboveNav: panelRect ? panelRect.bottom <= window.innerHeight - 50 : false,
      mapReachesBottom: sectionRect ? sectionRect.bottom >= window.innerHeight - 4 : false,
    };
  });
  results.axeHub = blockingInfo(
    (await new AxeBuilder({ page: hub.page }).disableRules(['color-contrast']).analyze()).violations
  );
  await hub.page.screenshot({ path: `${outDir}/v15-hub-map-bottom-390.png`, fullPage: true });

  /* ── SWIPE : racine → itinéraire → suivante, retour ── */
  await hub.page.evaluate(() => window.__lkdvSwipe(140, 0));
  await hub.page.waitForTimeout(1800);
  results.swipeFromRoot = hub.page.url();

  await hub.page.evaluate(() => window.__lkdvSwipe(140, 0));
  await hub.page.waitForTimeout(1800);
  results.swipeNext = hub.page.url();

  await hub.page.evaluate(() => window.__lkdvSwipe(-140, 0));
  await hub.page.waitForTimeout(1800);
  results.swipeBack = hub.page.url();

  /* ── Carte ignorée : un swipe sur la carte ne navigue pas ── */
  await hub.page.goto(base + '/hub', { waitUntil: 'networkidle' });
  await hub.page.waitForTimeout(2200);
  const before = hub.page.url();
  await hub.page.evaluate(() => window.__lkdvSwipe(150, 0, '.leaflet-container'));
  await hub.page.waitForTimeout(1200);
  results.swipeOnMapIgnored = { before, after: hub.page.url(), unchanged: before === hub.page.url() };

  /* ── Swipe vertical : ne navigue pas ── */
  await hub.page.goto(base + '/hub', { waitUntil: 'networkidle' });
  await hub.page.waitForTimeout(2000);
  const beforeVertical = hub.page.url();
  await hub.page.evaluate(() => window.__lkdvSwipe(20, 120));
  await hub.page.waitForTimeout(900);
  results.swipeVerticalIgnored = { unchanged: beforeVertical === hub.page.url() };

  await hub.context.close();

  /* ── DESKTOP : aucun geste, page stable ── */
  const desktop = await open(1440, 900, '/hub');
  results.desktop = await desktop.page.evaluate(() => ({
    hubMenu: document.body.innerText.includes('PROCHAINE ACTION') || document.body.innerText.includes('Prochaine action'),
  }));
  await desktop.context.close();
} catch (err) {
  results.fatal = err instanceof Error ? err.message : String(err);
} finally {
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
