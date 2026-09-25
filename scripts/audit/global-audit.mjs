/**
 * Programme Qualité & Grande Échelle — Lot A : audit global read-only.
 *
 * Captures plein écran de toutes les routes du périmètre (hors 16 pages
 * marketing/légal) sur 3 devices, en passes anonyme puis connectée,
 * avec collecte : statut HTTP, pageerrors, erreurs console, liens internes.
 *
 * Sorties :
 *   docs/audit-global/captures/<device>/<route>.png
 *   docs/audit-global/findings.json
 *
 * Usage : node scripts/audit/global-audit.mjs [--anon-only] [--auth-only]
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { auditModeRequiresAuth, auditVerificationStatus, buildAuditCoverage, getAuditCredentials } from './contrast_audit_core.mjs';
import { redactDiagnosticText, redactRuntimeValue } from './audit_runtime.mjs';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:4000';
const OUT_DIR = 'docs/audit-global';
const CAPTURES_DIR = path.join(OUT_DIR, 'captures');
const args = process.argv.slice(2);
const ANON_ONLY = args.includes('--anon-only');
const AUTH_ONLY = args.includes('--auth-only');

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;

async function fixture(table, column) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from(table).select(column).limit(1);
    if (error || !data?.[0]) return null;
    return data[0][column];
  } catch {
    return null;
  }
}

const fixtures = {
  trailId: (await fixture('hiking_routes', 'id')) ?? 375,
  productSlug: await fixture('shop_products', 'slug'),
  kitSlug: await fixture('kits', 'slug'),
  clubSlug: await fixture('clubs', 'slug'),
  carnetId: await fixture('carnets', 'id'),
  tripSlug: await fixture('trips', 'slug'),
  groupId: await fixture('travel_groups', 'id'),
  lieuSlug: await fixture('places', 'slug'),
  profileId: await fixture('public_profiles', 'id'),
};

const ROUTE_DEFINITIONS = [
  // Commerce
  { name: 'home', path: '/', auth: false },
  { name: 'boutique', path: '/boutique', auth: false },
  { name: 'produit', path: fixtures.productSlug ? `/produit/${fixtures.productSlug}` : null, expectedPath: '/produit/:productSlug', auth: false },
  { name: 'panier', path: '/panier', auth: false },
  { name: 'checkout', path: '/checkout', auth: false },
  { name: 'kits', path: '/kits', auth: false },
  { name: 'kit-detail', path: fixtures.kitSlug ? `/kits/${fixtures.kitSlug}` : null, expectedPath: '/kits/:kitSlug', auth: false },
  { name: 'occasion', path: '/occasion', auth: false },
  { name: 'location', path: '/location', auth: false },
  { name: 'abonnements', path: '/abonnements', auth: false },
  // Découverte
  { name: 'explorer', path: '/explorer', auth: false },
  { name: 'carte-interactive', path: '/carte-interactive', auth: false },
  { name: 'pays-fr', path: '/pays/fr', auth: false },
  { name: 'lieux', path: '/lieux', auth: false },
  { name: 'lieu-detail', path: fixtures.lieuSlug ? `/lieux/${fixtures.lieuSlug}` : null, expectedPath: '/lieux/:lieuSlug', auth: false },
  { name: 'evenements', path: '/evenements', auth: false },
  { name: 'outils', path: '/outils', auth: false },
  { name: 'hors-ligne', path: '/hors-ligne', auth: false },
  { name: 'recompenses', path: '/recompenses', auth: false },
  { name: 'fidelite', path: '/fidelite', auth: false },
  { name: 'preparer-randonnee', path: '/preparer-randonnee', auth: false },
  { name: 'ai-configurator', path: '/ai-configurator', auth: false },
  { name: 'carbone', path: '/carbone', auth: false },
  { name: 'copilote', path: '/copilote', auth: false },
  // Communauté / clubs
  { name: 'communaute', path: '/communaute', auth: false },
  { name: 'clubs', path: '/clubs', auth: false },
  { name: 'club-detail', path: fixtures.clubSlug ? `/clubs/${fixtures.clubSlug}` : null, expectedPath: '/clubs/:clubSlug', auth: false },
  { name: 'feed', path: '/feed', auth: false },
  { name: 'entraide', path: '/entraide', auth: false },
  // Auth (formulaires anonymes)
  { name: 'connexion', path: '/connexion', auth: false },
  { name: 'inscription', path: '/inscription', auth: false },
  // Connecté
  { name: 'hub', path: '/hub', auth: true },
  { name: 'compte', path: '/compte', auth: true },
  { name: 'compte-modifier', path: '/compte/modifier', auth: true },
  { name: 'profil', path: '/profil', auth: true },
  { name: 'profil-public', path: fixtures.profileId ? `/profil/${fixtures.profileId}` : null, expectedPath: '/profil/:profileId', auth: true },
  { name: 'carnets', path: '/carnets', auth: true },
  { name: 'carnet-detail', path: fixtures.carnetId ? `/carnets/${fixtures.carnetId}` : null, expectedPath: '/carnets/:carnetId', auth: true },
  { name: 'carnet-nouveau', path: '/carnets/nouveau', auth: true },
  { name: 'voyage-detail', path: fixtures.tripSlug ? `/voyages/${fixtures.tripSlug}` : null, expectedPath: '/voyages/:tripSlug', auth: true },
  { name: 'preparer-sentier', path: fixtures.trailId ? `/preparer-sentier/${fixtures.trailId}` : null, expectedPath: '/preparer-sentier/:trailId', auth: true },
  { name: 'messagerie', path: '/messagerie', auth: true },
  { name: 'randonnee-active', path: '/randonnee-active', auth: true },
  { name: 'rapport-expedition', path: '/rapport-expedition', auth: true },
  { name: 'publier', path: '/publier', auth: true },
  { name: 'communaute-publier', path: '/communaute/publier', auth: true },
  { name: 'admin-refus', path: '/admin', auth: true },
];

const ROUTES = ROUTE_DEFINITIONS.filter((route) => route.path);

const DEVICES = [
  { id: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, scaleFactor: 1 },
  { id: 'iphone', viewport: { width: 430, height: 932 }, isMobile: true, scaleFactor: 3 },
  { id: 'ipad', viewport: { width: 834, height: 1194 }, isMobile: true, scaleFactor: 2 },
];

const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /favicon/i,
  /_vercel\/insights/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
];

function isNoise(text) {
  return IGNORED_CONSOLE.some((rx) => rx.test(text));
}

const findings = [];
const linkChecks = new Map();

async function login(page) {
  const { email: auditEmail, password: auditPassword } = getAuditCredentials();
  await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(800);
  const email = page.locator('input[type="email"]:visible').first();
  const password = page.locator('input[type="password"]:visible').first();
  await email.fill(auditEmail, { timeout: 15_000 });
  await password.fill(auditPassword, { timeout: 15_000 });
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30_000 }).catch(() => {}),
    page.locator('button[type="submit"]:visible').first().click({ timeout: 15_000 }),
  ]);
  await page.waitForTimeout(1800);
}

async function captureRoute(context, device, route, authed) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requestErrors = [];
  page.on('pageerror', (error) => pageErrors.push(redactDiagnosticText(error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = redactDiagnosticText(message.text());
      if (!isNoise(text)) consoleErrors.push(text.slice(0, 300));
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'requestfailed';
    requestErrors.push(redactDiagnosticText(`${request.method()} ${request.url()} ${failure}`));
  });

  const record = {
    route: route.name,
    path: route.path,
    device: device.id,
    authed,
    status: null,
    finalUrl: null,
    pageErrors,
    consoleErrors,
    requestErrors,
    screenshot: null,
  };

  try {
    const response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    record.status = response?.status() ?? null;
    await page.waitForTimeout(1800);
    record.finalUrl = page.url();

    if (!ANON_ONLY || authed) {
      const dir = path.join(CAPTURES_DIR, device.id);
      fs.mkdirSync(dir, { recursive: true });
      const suffix = authed ? '-auth' : '';
      const file = path.join(dir, `${route.name}${suffix}.png`);
      await page.screenshot({ path: file, fullPage: true, timeout: 30_000 });
      record.screenshot = path.relative(process.cwd(), file).replace(/\\/g, '/');
    }

    // Échantillon de liens internes (anon, desktop uniquement, max 8/page)
    if (!authed && device.id === 'desktop') {
      const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
        Array.from(new Set(anchors.map((a) => a.getAttribute('href')))).slice(0, 8)
      );
      for (const href of hrefs) {
        if (!href || href.startsWith('/api') || linkChecks.has(href)) continue;
        linkChecks.set(href, 'pending');
      }
    }
  } catch (error) {
    record.pageErrors.push(`AUDIT: ${redactDiagnosticText(error?.message || error)}`);
  } finally {
    await page.close().catch(() => {});
  }

  findings.push(record);
  const marker = record.pageErrors.length > 0 || record.consoleErrors.length > 0 || record.requestErrors.length > 0 ? '⚠' : '✓';
  console.log(
    `${marker} [${device.id}${authed ? '/auth' : ''}] ${route.name} (${record.status ?? 'ERR'})` +
      (record.pageErrors.length ? ` pageerrors=${record.pageErrors.length}` : '') +
      (record.consoleErrors.length ? ` console=${record.consoleErrors.length}` : '')
  );
}

const browser = await chromium.launch();
try {
  for (const device of DEVICES) {
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.scaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.isMobile,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      permissions: [],
    });

    if (!AUTH_ONLY) {
      for (const route of ROUTES.filter((r) => !r.auth)) {
        await captureRoute(context, device, route, false);
      }
    }
    if (!ANON_ONLY) {
      let loginOk = true;
      try {
        await login(context.pages()[0] ?? (await context.newPage()));
      } catch (error) {
        loginOk = false;
        findings.push({
          route: 'AUDIT-LOGIN',
          path: '/connexion',
          device: device.id,
          authed: true,
          status: null,
          finalUrl: null,
          pageErrors: [`LOGIN FAILED: ${redactDiagnosticText(error?.message || error)}`],
          consoleErrors: [],
          requestErrors: [],
          screenshot: null,
        });
        console.log(`✗ [${device.id}] login impossible — routes connectées ignorées`);
      }
      if (loginOk) {
        for (const route of ROUTES.filter((r) => r.auth)) {
          await captureRoute(context, device, route, true);
        }
      }
    }

    await context.close();
  }

  // Vérification des liens internes collectés (anonyme)
  if (linkChecks.size > 0 && !AUTH_ONLY) {
    const request = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    for (const [href, _] of linkChecks) {
      try {
        const response = await request.request.get(`${BASE}${href}`, { timeout: 20_000, maxRedirects: 5 });
        linkChecks.set(href, response.status());
      } catch {
        linkChecks.set(href, 'ERR');
      }
    }
    await request.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const coverage = buildAuditCoverage(ROUTE_DEFINITIONS, findings);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  fixtures,
  expectedRoutes: coverage.expectedRoutes,
  missingRoutes: coverage.missingRoutes,
  coverageComplete: coverage.coverageComplete,
  routeCount: coverage.expectedRoutes.length,
  runnableRouteCount: ROUTES.length,
  deviceCount: DEVICES.length,
  captures: findings.filter((f) => f.screenshot).length,
  issues: findings.filter((f) => f.pageErrors.length > 0
    || f.consoleErrors.length > 0
    || f.requestErrors?.length > 0
    || (f.status && f.status >= 400)),
  consoleNoise: findings.filter((f) => f.consoleErrors.length > 0),
  brokenLinks: Object.fromEntries([...linkChecks].filter(([, status]) => status === 'ERR' || (typeof status === 'number' && status >= 400))),
  findings,
};
const authFailure = findings.some((finding) => finding.route === 'AUDIT-LOGIN');
const verificationStatus = auditVerificationStatus({
  liveVerified: report.issues.length === 0
    && (!auditModeRequiresAuth(args) || !authFailure),
  coverageComplete: coverage.coverageComplete,
  errors: [
    ...report.issues.map((finding) => finding.pageErrors?.[0]).filter(Boolean),
    ...Object.keys(report.brokenLinks),
  ],
});
report.verificationStatus = verificationStatus;
fs.writeFileSync(path.join(OUT_DIR, 'findings.json'), JSON.stringify(redactRuntimeValue(report), null, 2));

const critical = report.issues.filter((f) => !(f.route === 'admin-refus' && (f.status === 403 || f.status === 307 || f.status === 302)));
console.log('\n=== SYNTHèse ===');
console.log(`captures: ${report.captures} | routes: ${ROUTES.length} | devices: ${DEVICES.length}`);
console.log(`statut: ${verificationStatus}`);
console.log(`routes en erreur (hors /admin): ${critical.length}`);
for (const issue of critical) {
  console.log(`  - [${issue.device}${issue.authed ? '/auth' : ''}] ${issue.route} status=${issue.status} ${issue.pageErrors[0] ?? ''}`);
}
console.log(`console errors (échantillon): ${report.consoleNoise.length} routes`);
for (const noise of report.consoleNoise.slice(0, 10)) {
  console.log(`  - [${noise.device}] ${noise.route}: ${noise.consoleErrors[0]}`);
}
for (const issue of report.issues.filter((f) => f.requestErrors?.length)) {
  console.log(`  - [${issue.device}] ${issue.route}: ${issue.requestErrors[0]}`);
}
console.log(`liens cassés: ${Object.keys(report.brokenLinks).length}`);
for (const [href, status] of Object.entries(report.brokenLinks)) {
  console.log(`  - ${href} → ${status}`);
}
if (verificationStatus !== 'VERIFIED' || critical.length > 0 || Object.keys(report.brokenLinks).length > 0) {
  process.exitCode = 1;
}
