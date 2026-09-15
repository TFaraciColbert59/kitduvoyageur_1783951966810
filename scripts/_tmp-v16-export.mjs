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
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const results = {};

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

const browser = await chromium.launch();

async function open(width, height) {
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
  });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
  });
  await page.goto(base + '/hub/export', { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2600);
  return { context, page };
}

try {
  const mobile = await open(390, 844);
  results.mobile = await mobile.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    const text = document.body.innerText;
    const synthesis = document.querySelector('section[aria-label="Synthèse du voyage"]');
    return {
      hero: visible('section[aria-label="Feuille de route à exporter"]').length === 1,
      gpxHref: document.querySelector('a[href$="/gpx"]')?.getAttribute('href') ?? null,
      pdfButton: visible('button').some((el) => (el.textContent ?? '').includes('PDF')),
      shareButton: text.includes('Partager la feuille de route'),
      programRows: visible('section[aria-label="Programme jour par jour"] li').length,
      synthesisCards: synthesis ? synthesis.querySelectorAll('a[href^="/hub/"]').length : 0,
      emergency: visible(`section[aria-label="Numéros d'urgence"] a`).length,
      programLink: document.querySelector('section[aria-label="Programme jour par jour"] a[href="/hub/itineraire"]') !== null,
    };
  });
  results.axeMobile = blockingInfo(
    (await new AxeBuilder({ page: mobile.page }).disableRules(['color-contrast']).analyze()).violations
  );
  await mobile.page.screenshot({ path: `${outDir}/v16-export-390.png`, fullPage: true });
  await mobile.context.close();

  const tablet = await open(768, 1024);
  results.tablet = await tablet.page.evaluate(() => ({
    mobileExperience: document.querySelector('section[aria-label="Feuille de route à exporter"]') !== null,
  }));
  await tablet.page.screenshot({ path: `${outDir}/v16-export-768.png`, fullPage: true });
  await tablet.context.close();

  const desktop = await open(1440, 900);
  results.desktop = await desktop.page.evaluate(() => {
    const text = document.body.innerText;
    const mobileHero = Array.from(document.querySelectorAll('section')).some(
      (el) => el.getAttribute('aria-label') === 'Feuille de route à exporter' && el.getBoundingClientRect().height > 0
    );
    return { legacy: text.includes('Genere par') && text.includes('Ref :'), mobileHeroVisible: mobileHero };
  });
  await desktop.page.screenshot({ path: `${outDir}/v16-export-1440.png` });
  await desktop.context.close();
} catch (err) {
  results.fatal = err instanceof Error ? err.message : String(err);
} finally {
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
