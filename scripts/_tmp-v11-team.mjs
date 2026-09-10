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
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
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
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
  });
  await page.goto(base + '/hub/groupe', { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2600);
  return { context, page };
}

async function closeDialog(page) {
  const close = page.locator('[role="dialog"] button[aria-label="Fermer"]').first();
  if (await close.count()) {
    await close.click({ force: true });
    await page.waitForTimeout(500);
  }
}

try {
  /* ── MOBILE 390 ─────────────────────────────────────────── */
  const mobile = await open(390, 844);
  results.mobile = await mobile.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    const text = document.body.innerText;
    return {
      hero: visible('section[aria-label="Équipe du voyage"]').length === 1,
      equipiersRail: visible('section[aria-label="Équipiers du voyage"] li').length,
      carnetRail: visible('section[aria-label="Carnet d\'équipage"] li').length,
      dogsRail: visible('section[aria-label="Compagnons canins"] li').length,
      iceButtons: visible('button[aria-label^="Fiche médicale de"]').length,
      packSwitch: visible('button[role="switch"][aria-label*="porte le sac"]').length,
      legacyHidden: !text.includes('PARTICIPANTS HUMAINS'),
    };
  });
  await mobile.page.screenshot({ path: `${outDir}/v11-team-390.png`, fullPage: true });
  results.axeMobile = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);

  /* ── Tiroir équipiers & invitation ──────────────────────── */
  await mobile.page
    .locator('section[aria-label="Équipiers du voyage"] button', { hasText: 'Gérer' })
    .first()
    .click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.membersDrawer = await mobile.page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      title: (dialog?.textContent ?? '').includes('Équipiers & invitation'),
      inviteInput: !!dialog?.querySelector('input[name="identifier"]'),
    };
  });
  await closeDialog(mobile.page);

  /* ── Tiroir carnet : ajout puis retrait ─────────────────── */
  await mobile.page
    .locator('section[aria-label="Carnet d\'équipage"] button', { hasText: 'Gérer' })
    .first()
    .click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.carnetDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes("Carnet d'équipage")
  );
  await mobile.page.locator('[role="dialog"] input[aria-label="Prénom du nouvel équipier"]').fill('V11 Test');
  await mobile.page
    .locator('[role="dialog"] button', { hasText: 'Ajouter au carnet' })
    .click({ force: true });
  await mobile.page.waitForTimeout(800);
  results.addedHuman = await mobile.page.evaluate(() =>
    JSON.parse(localStorage.getItem('lkdv_participants_state_v1') || '{"humans":[]}').humans.some(
      (h) => h.publicData?.firstName === 'V11 Test'
    )
  );
  await mobile.page
    .locator('[role="dialog"] button[aria-label="Retirer V11 Test du carnet"]')
    .click({ force: true });
  await mobile.page.waitForTimeout(700);
  await mobile.page.getByRole('button', { name: 'Retirer', exact: true }).click({ force: true });
  await mobile.page.waitForTimeout(800);
  results.removedHuman = await mobile.page.evaluate(
    () =>
      !JSON.parse(localStorage.getItem('lkdv_participants_state_v1') || '{"humans":[]}').humans.some(
        (h) => h.publicData?.firstName === 'V11 Test'
      )
  );
  await closeDialog(mobile.page);

  /* ── Chien : bascule du sac ─────────────────────────────── */
  const dogSwitch = mobile.page.locator('section[aria-label="Compagnons canins"] button[role="switch"]').first();
  if (await dogSwitch.count()) {
    const before = await mobile.page.evaluate(
      () => JSON.parse(localStorage.getItem('lkdv_participants_state_v1') || '{"dogs":[]}').dogs[0]?.isCarryingPack
    );
    await dogSwitch.click({ force: true });
    await mobile.page.waitForTimeout(700);
    const after = await mobile.page.evaluate(
      () => JSON.parse(localStorage.getItem('lkdv_participants_state_v1') || '{"dogs":[]}').dogs[0]?.isCarryingPack
    );
    results.dogToggle = { before: before ?? null, after: after ?? null, changed: before !== after };
  }

  /* ── Fiche médicale (Glass Break verrouillé) ────────────── */
  await mobile.page.locator('button[aria-label^="Fiche médicale de"]').first().click({ force: true });
  await mobile.page.waitForTimeout(800);
  results.medical = await mobile.page.evaluate(() =>
    document.body.innerText.includes('Données Médicales & ICE Verrouillées')
  );
  await mobile.page.locator('button[aria-label="Fermer"]').first().click({ force: true });
  await mobile.page.waitForTimeout(500);

  /* ── Tiroir chiens ──────────────────────────────────────── */
  await mobile.page
    .locator('section[aria-label="Compagnons canins"] button', { hasText: 'Gérer' })
    .first()
    .click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.dogsDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Compagnons canins')
  );
  await closeDialog(mobile.page);
  await mobile.context.close();

  /* ── TABLETTE 768 ───────────────────────────────────────── */
  const tablet = await open(768, 1024);
  results.tablet = await tablet.page.evaluate(() => ({
    mobileExperience: document.body.innerText.includes('ÉQUIPE DU VOYAGE'),
  }));
  await tablet.page.screenshot({ path: `${outDir}/v11-team-768.png`, fullPage: true });
  await tablet.context.close();

  /* ── DESKTOP 1440 : vue legacy inchangée ────────────────── */
  const desktop = await open(1440, 900);
  results.desktop = await desktop.page.evaluate(() => {
    const text = document.body.innerText;
    const mobileHero = Array.from(document.querySelectorAll('section')).some(
      (el) => el.getAttribute('aria-label') === 'Équipe du voyage' && el.getBoundingClientRect().height > 0
    );
    return {
      legacyTeam: text.includes('Inviter un voyageur') && text.includes('PARTICIPANTS HUMAINS'),
      mobileHeroVisible: mobileHero,
    };
  });
  await desktop.page.screenshot({ path: `${outDir}/v11-team-1440.png` });
  await desktop.context.close();
} finally {
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
