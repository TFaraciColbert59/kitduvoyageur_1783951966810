import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import {
  attachPageDiagnostics,
  invalidateAuditReportDirectory,
  invalidateAuditReports,
  redactDiagnosticText,
  redactRuntimeValue,
  writeAuditErrorReport,
} from './audit_runtime.mjs';
import { getAuditCredentials } from './credentials.mjs';
import {
  assertRenderedAuditSettings,
  readRenderedAuditSettings,
} from './measure_contrast_v2.mjs';

const BASE_URL = 'http://localhost:3000';
const screensDir = path.resolve('audit', 'screens');
const a11yDir = path.resolve('audit', 'a11y');
const errorReportPath = path.join(a11yDir, 'capture-section4-error.json');

invalidateAuditReports([
  path.join(screensDir, 'manifest.json'),
  path.join(a11yDir, 'summary.json'),
  errorReportPath,
]);
invalidateAuditReportDirectory(a11yDir, (name) => name.endsWith('.json'));
fs.mkdirSync(screensDir, { recursive: true });
fs.mkdirSync(a11yDir, { recursive: true });

// Récupérer les cookies de session pour y-demo
async function getAuthCookie() {
  const credentials = getAuditCredentials();
  const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
  if (!fs.existsSync(envPath)) throw new Error('Configuration Supabase absente pour la capture audit');
  const raw = fs.readFileSync(envPath, 'utf8');
  const url = raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const anonKey = raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
  if (!url || !anonKey) throw new Error('Configuration Supabase absente pour la capture audit');

  let savedCookies = [];
  const sb = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => savedCookies,
      setAll: (cs) => { savedCookies = cs; },
    },
  });

  const { data, error } = await sb.auth.signInWithPassword(credentials);
  if (error || !data?.user || savedCookies.length === 0) {
    throw new Error('Authentification audit impossible');
  }
  return {
    name: savedCookies[0].name,
    value: savedCookies[0].value,
    domain: 'localhost',
    path: '/',
  };
}

function getAdventureCookie(slug = 'y-long-group') {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify({ nature: 'sortie', id: slug, slug, title: slug })).toString('base64url'),
    domain: 'localhost',
    path: '/',
  };
}

// 79 routes canoniques de l'application
const ROUTES = [
  // Hub & Découverte
  { id: 'accueil', path: '/', label: 'Accueil' },
  { id: 'hub', path: '/hub', label: 'Hub Cockpit' },
  { id: 'hub-nouveau', path: '/hub/nouveau', label: 'Hub Nouveau' },
  { id: 'hub-itineraire', path: '/hub/itineraire', label: 'Hub Itinéraire' },
  { id: 'hub-budget', path: '/hub/budget', label: 'Hub Budget' },
  { id: 'hub-groupe', path: '/hub/groupe', label: 'Hub Équipage' },
  { id: 'hub-securite', path: '/hub/securite', label: 'Hub Sécurité' },
  { id: 'hub-materiel', path: '/hub/materiel', label: 'Hub Matériel' },
  { id: 'hub-documents', path: '/hub/documents', label: 'Hub Documents' },
  // Exploration & Randonnée
  { id: 'explorer', path: '/explorer', label: 'Explorer Sentiers' },
  { id: 'carte-interactive', path: '/carte-interactive', label: 'Carte Interactive' },
  { id: 'randonnee-active', path: '/randonnee-active', label: 'Randonnée Active' },
  { id: 'rapport-expedition', path: '/rapport-expedition', label: 'Rapport Expédition' },
  // Équipement & Kits
  { id: 'materiel', path: '/materiel', label: 'Matériel' },
  { id: 'kits', path: '/kits', label: 'Catalogue Kits' },
  { id: 'kit-islande', path: '/kits/islande-trek', label: 'Kit Islande' },
  { id: 'kit-gr20', path: '/kits/gr20-corse', label: 'Kit GR20' },
  { id: 'kit-vanlife', path: '/kits/vanlife-europe', label: 'Kit Vanlife' },
  { id: 'ai-configurator', path: '/ai-configurator', label: 'Configurateur IA' },
  { id: 'copilote', path: '/copilote', label: 'Copilote IA' },
  // Commerce & Paiement
  { id: 'boutique', path: '/boutique', label: 'Boutique' },
  { id: 'produit-detail', path: '/produit/sac-a-dos-de-randonnee-categorie-bigbuy', label: 'Produit BigBuy' },
  { id: 'occasion', path: '/occasion', label: 'Occasion' },
  { id: 'location', path: '/location', label: 'Location' },
  { id: 'panier', path: '/panier', label: 'Panier' },
  { id: 'checkout', path: '/checkout', label: 'Tunnel Checkout' },
  { id: 'abonnements', path: '/abonnements', label: 'Abonnements' },
  // Lieux & Pays
  { id: 'pays-fr', path: '/pays/fr', label: 'Pays France' },
  { id: 'pays-is', path: '/pays/is', label: 'Pays Islande' },
  { id: 'lieux', path: '/lieux', label: 'Lieux' },
  { id: 'preparer-randonnee', path: '/preparer-randonnee', label: 'Préparer Randonnée' },
  // Communauté & Réseau
  { id: 'communaute', path: '/communaute', label: 'Communauté' },
  { id: 'communaute-publier', path: '/communaute/publier', label: 'Publier' },
  { id: 'communaute-pro', path: '/communaute-pro', label: 'Communauté Pro' },
  { id: 'feed', path: '/feed', label: 'Fil Actualités' },
  { id: 'carnets', path: '/carnets', label: 'Carnets' },
  { id: 'clubs', path: '/clubs', label: 'Clubs' },
  { id: 'entraide', path: '/entraide', label: 'Entraide' },
  { id: 'evenements', path: '/evenements', label: 'Événements' },
  { id: 'avis', path: '/avis', label: 'Avis Randonneurs' },
  // Outils
  { id: 'outils', path: '/outils', label: 'Hub Outils' },
  { id: 'outil-poids-sac', path: '/outils/poids-sac', label: 'Outil Poids' },
  { id: 'outil-budget', path: '/outils/budget', label: 'Outil Budget' },
  { id: 'outil-convertisseur', path: '/outils/convertisseur', label: 'Convertisseur' },
  { id: 'outil-checklist', path: '/outils/checklist', label: 'Checklist' },
  { id: 'carbone', path: '/carbone', label: 'Empreinte Carbone' },
  // Compte & Profil
  { id: 'compte', path: '/compte', label: 'Compte Voyageur' },
  { id: 'compte-modifier', path: '/compte/modifier', label: 'Modifier Profil' },
  { id: 'profil-public', path: '/profil', label: 'Profil Public' },
  { id: 'progression', path: '/progression', label: 'Progression' },
  { id: 'fidelite', path: '/fidelite', label: 'Fidélité' },
  { id: 'recompenses', path: '/recompenses', label: 'Récompenses' },
  { id: 'messagerie', path: '/messagerie', label: 'Messagerie' },
  { id: 'connexion', path: '/connexion', label: 'Connexion' },
  { id: 'inscription', path: '/inscription', label: 'Inscription' },
  // Système & Légal
  { id: 'guides', path: '/guides', label: 'Guides' },
  { id: 'blog', path: '/blog', label: 'Blog' },
  { id: 'manifeste', path: '/manifeste', label: 'Manifeste' },
  { id: 'faq', path: '/faq', label: 'FAQ' },
  { id: 'contact', path: '/contact', label: 'Contact' },
  { id: 'admin', path: '/admin', label: 'Administration' },
  { id: 'admin-produits', path: '/admin/produits', label: 'Admin Produits' },
  { id: 'dev-glass', path: '/dev/glass', label: 'Showcase Glass' },
  { id: 'dev-style', path: '/dev/style', label: 'Showcase Style' },
  { id: 'mentions-legales', path: '/mentions-legales', label: 'Mentions Légales' },
  { id: 'cgv', path: '/cgv', label: 'CGV' },
  { id: 'cgu', path: '/cgu', label: 'CGU' },
  { id: 'cookies', path: '/cookies', label: 'Politique Cookies' },
  { id: 'hors-ligne', path: '/hors-ligne', label: 'Mode Hors-Ligne' },
  { id: 'page-404', path: '/route-inexistante-pour-tester-404', label: 'Erreur 404' },
];

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1440x900', width: 1440, height: 900 },
];

async function run() {
  console.log('🚀 Lancement de la campagne de captures Section 4 & A11y (Référence Avant)...');
  const authCookie = await getAuthCookie();
  const advCookie = getAdventureCookie();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const manifest = [];
  const a11ySummary = {};
  const errors = [];

  for (const r of ROUTES) {
    const routeDir = path.join(screensDir, r.id);
    fs.mkdirSync(routeDir, { recursive: true });

    console.log(`\n📸 [Route] ${r.label} (${r.path}) -> audit/screens/${r.id}/`);

    // 1. Audit A11Y avec Axe-core (sur viewport mobile de référence)
    let a11yCtx;
    let diagnostics;
    try {
      a11yCtx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        locale: 'fr-FR',
      });
      if (authCookie) await a11yCtx.addCookies([authCookie, advCookie]);
      const a11yPage = await a11yCtx.newPage();
      diagnostics = attachPageDiagnostics(a11yPage);

      await a11yPage.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await a11yPage.waitForTimeout(1000);

      const axeResults = await new AxeBuilder({ page: a11yPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      diagnostics.assertClean();

      const a11yFilePath = path.join(a11yDir, `${r.id}.json`);
      fs.writeFileSync(a11yFilePath, JSON.stringify(redactRuntimeValue({
        route: r.path,
        id: r.id,
        timestamp: new Date().toISOString(),
        violationsCount: axeResults.violations.length,
        violations: axeResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        })),
      }), null, 2));

      a11ySummary[r.id] = {
        violationsCount: axeResults.violations.length,
        impacts: axeResults.violations.reduce((acc, v) => {
          acc[v.impact || 'other'] = (acc[v.impact || 'other'] || 0) + 1;
          return acc;
        }, {}),
      };
    } catch (err) {
      const message = redactDiagnosticText(err instanceof Error ? err.message : err);
      errors.push({ route: r.id, stage: 'a11y', message });
      a11ySummary[r.id] = { error: message };
    } finally {
      diagnostics?.dispose();
      await a11yCtx?.close().catch(() => {});
    }

    // 2. Captures multi-viewports & thèmes (Section 4)
    for (const vp of VIEWPORTS) {
      for (const theme of ['dark', 'light']) {
        const shotFilename = `${vp.name}-${theme}-default.png`;
        const shotPath = path.join(routeDir, shotFilename);

        let captureCtx;
        let diagnostics;
        try {
          captureCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            colorScheme: theme,
            locale: 'fr-FR',
          });

          const cookiesToSet = [advCookie];
          if (authCookie) cookiesToSet.push(authCookie);
          await captureCtx.addCookies(cookiesToSet);

          const page = await captureCtx.newPage();
          diagnostics = attachPageDiagnostics(page);

          // Bootstrap theme & cookie consent
          await page.addInitScript((t) => {
            localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }));
            localStorage.setItem('lkdv_theme', t);
          }, theme);

          await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(600);
          const rendered = await readRenderedAuditSettings(page);
          assertRenderedAuditSettings({
            requestedTheme: theme,
            requestedIntensity: 0.5,
            actualTheme: rendered.theme,
            actualIntensity: rendered.intensity,
          });

          // Capture viewport exact d'abord (fullPage: false conformément à la section 4)
          await page.screenshot({ path: shotPath, fullPage: false });
          diagnostics.assertClean();

          manifest.push({
            routeId: r.id,
            path: r.path,
            viewport: vp.name,
            theme,
            state: 'default',
            file: `audit/screens/${r.id}/${shotFilename}`,
          });
        } catch (err) {
          const message = redactDiagnosticText(err instanceof Error ? err.message : err);
          errors.push({ route: r.id, stage: `${vp.name}-${theme}`, message });
          console.warn(`  ⚠️ Erreur capture ${r.id} (${vp.name} ${theme}): ${message}`);
        } finally {
          diagnostics?.dispose();
          await captureCtx?.close().catch(() => {});
        }
      }
    }

    // 3. Variations d'intensité de verre (0, 0.5, 1) sur routes clés
    if (['hub', 'explorer', 'materiel', 'boutique', 'compte'].includes(r.id)) {
      for (const intensity of [0, 0.5, 1]) {
        const shotFilename = `390x844-dark-intensity-${intensity}.png`;
        const shotPath = path.join(routeDir, shotFilename);
        let intensityCtx;
        let diagnostics;
        try {
          intensityCtx = await browser.newContext({
            viewport: { width: 390, height: 844 },
            colorScheme: 'dark',
            locale: 'fr-FR',
          });
          if (authCookie) await intensityCtx.addCookies([authCookie, advCookie]);
          const page = await intensityCtx.newPage();
          diagnostics = attachPageDiagnostics(page);
          await page.addInitScript((i) => {
            localStorage.setItem('lkdv_glass_intensity', String(i));
          }, intensity);

          await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(600);
          const rendered = await readRenderedAuditSettings(page);
          assertRenderedAuditSettings({
            requestedTheme: 'dark',
            requestedIntensity: intensity,
            actualTheme: rendered.theme,
            actualIntensity: rendered.intensity,
          });
          await page.screenshot({ path: shotPath, fullPage: false });
          diagnostics.assertClean();

          manifest.push({
            routeId: r.id,
            path: r.path,
            viewport: '390x844',
            theme: 'dark',
            state: `intensity-${intensity}`,
            file: `audit/screens/${r.id}/${shotFilename}`,
          });
        } catch (err) {
          const message = redactDiagnosticText(err instanceof Error ? err.message : err);
          errors.push({ route: r.id, stage: `intensity-${intensity}`, message });
          console.warn(`  ⚠️ Erreur intensité ${intensity} sur ${r.id}: ${message}`);
        } finally {
          diagnostics?.dispose();
          await intensityCtx?.close().catch(() => {});
        }
      }
    }
  }

  await browser.close();

  // Écriture du manifest général
  fs.writeFileSync(path.join(screensDir, 'manifest.json'), JSON.stringify(redactRuntimeValue({
    totalCaptures: manifest.length,
    timestamp: new Date().toISOString(),
    manifest,
  }), null, 2));

  fs.writeFileSync(path.join(a11yDir, 'summary.json'), JSON.stringify(redactRuntimeValue(a11ySummary), null, 2));

  if (errors.length > 0) {
    const error = new Error(`Campagne Section 4 terminée avec ${errors.length} erreur(s)`);
    writeAuditErrorReport(errorReportPath, error, { errors });
    throw error;
  }
  console.log(`\n✅ Campagne Section 4 terminée avec succès : ${manifest.length} captures enregistrées dans audit/screens/ et audits A11y dans audit/a11y/`);
}

run().catch((e) => {
  console.error('Fatal error during Section 4 captures:', redactDiagnosticText(e instanceof Error ? e.message : e));
  process.exit(1);
});
