import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  attachPageDiagnostics,
  ensurePrivateAuditDirectory,
  invalidateAuditReportDirectory,
  invalidateAuditReports,
  redactDiagnosticText,
  redactRuntimeValue,
  writeAuditErrorReport,
  writePrivateAuditFile,
} from './audit_runtime.mjs';
import {
  assertRenderedAuditSettings,
  getAuditBaseUrl,
} from './contrast_audit_core.mjs';
import {
  auditStorageStatePath,
  loadAuditStorageState,
  verifyCompteSession,
} from './create_test_session.mjs';
import {
  assessCurrentRouteNavigation,
  assertRouteNavigation,
  readRenderedAuditSettings,
  routeDiagnosticsOptions,
  routeExpectationFor,
} from './measure_contrast_v2.mjs';

const screensDir = path.resolve('audit', 'screens', 'section4');
const manifestPath = path.join(screensDir, 'manifest.json');
const a11yDir = path.resolve('audit', 'a11y', 'section4');
const errorReportPath = path.join(a11yDir, 'capture-section4-error.json');

function pathWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function fileDigest(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Artifact lié ou non régulier refusé');
  return { size: stat.size, sha256: createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') };
}

function getAdventureCookie(baseUrl, slug = 'y-long-group') {
   return {
     name: 'lkv_active_adventure',
     value: Buffer.from(JSON.stringify({ nature: 'sortie', id: slug, slug, title: slug })).toString('base64url'),
     domain: new URL(baseUrl).hostname,
     path: '/',
     secure: new URL(baseUrl).protocol === 'https:',
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
const INTENSITY_ROUTES = new Set(['hub', 'explorer', 'materiel', 'boutique', 'compte']);
const EXPECTED_CAPTURE_ROUTES = ROUTES.filter((route) => !routeExpectationFor(route.path));
const EXPECTED_CAPTURE_COUNT = EXPECTED_CAPTURE_ROUTES.length * VIEWPORTS.length * 2
  + EXPECTED_CAPTURE_ROUTES.filter((route) => INTENSITY_ROUTES.has(route.id)).length * 3;

async function waitForSection4DefaultState(page) {
  await page.waitForFunction(() => {
    const text = document.querySelector('main')?.innerText || '';
    return text.trim().length > 80 && !/Connexion requise|Chargement|Initialisation/i.test(text);
  }, undefined, { timeout: 10000 });
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    overlayOpen: [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')]
      .some((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.top < window.innerHeight
          && rect.right > 0 && rect.left < window.innerWidth
          && style.display !== 'none' && style.visibility !== 'hidden';
      }),
  }));
}

function recordWarnings(diagnostics, route, stage, warnings) {
  for (const warning of diagnostics?.warnings || []) {
    warnings.push({ route, stage, ...warning });
  }
}

async function run() {
  invalidateAuditReports([
     manifestPath,
     path.join(a11yDir, 'summary.json'),
    errorReportPath,
  ]);
   invalidateAuditReportDirectory(a11yDir, (name) => name.endsWith('.json'));
   ensurePrivateAuditDirectory(screensDir);
   ensurePrivateAuditDirectory(a11yDir);
  console.log('🚀 Lancement de la campagne de captures Section 4 & A11y (Référence Avant)...');
   const baseUrl = getAuditBaseUrl();
   const storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
   const advCookie = getAdventureCookie(baseUrl);

   const browser = await chromium.launch({
      headless: true,

  });
   let authVerified = false;

   try {
     const authContext = await browser.newContext({
       baseURL: baseUrl,
       viewport: { width: 390, height: 844 },
       colorScheme: 'dark',
       locale: 'fr-FR',
         storageState,
         serviceWorkers: 'block',
       });
     try {
       const authPage = await authContext.newPage();
       await verifyCompteSession(authPage, baseUrl, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });
       authVerified = true;
     } finally {
       await authContext.close();
     }
   } catch (error) {
     await browser.close();
     throw error;
   }

   const manifest = [];
   const a11ySummary = {};
   const a11yArtifacts = [];
   const runId = randomUUID();
   const errors = [];
   const warnings = [];

   for (const r of ROUTES) {
    const routeDir = path.join(screensDir, r.id);
    fs.mkdirSync(routeDir, { recursive: true });

    console.log(`\n📸 [Route] ${r.label} (${r.path}) -> audit/screens/section4/${r.id}/`);

    // 1. Audit A11Y avec Axe-core (sur viewport mobile de référence)
    let a11yCtx;
    let diagnostics;
    try {
      a11yCtx = await browser.newContext({
        viewport: { width: 390, height: 844 },
         colorScheme: 'dark',
         locale: 'fr-FR',
         storageState,
         serviceWorkers: 'block',
       });
       await a11yCtx.addCookies([advCookie]);
      const a11yPage = await a11yCtx.newPage();
      diagnostics = attachPageDiagnostics(a11yPage, routeDiagnosticsOptions(baseUrl, r.path));

        const navigation = await assertRouteNavigation(a11yPage, baseUrl, r.path);
       await a11yPage.waitForTimeout(1000);
       const settledNavigation = assessCurrentRouteNavigation(a11yPage, baseUrl, r.path, navigation.httpStatus);
       if (settledNavigation.finalPath !== navigation.finalPath
         || settledNavigation.expected !== navigation.expected
         || settledNavigation.status !== navigation.status) {
         throw new Error('La route a changé après le chargement initial');
       }

       const axeResults = navigation.expected
         ? { violations: [], incomplete: [] }
         : await new AxeBuilder({ page: a11yPage })
           .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
           .analyze();
       recordWarnings(diagnostics, r.id, 'a11y', warnings);
       diagnostics.assertClean();

      const a11yFilePath = path.join(a11yDir, `${r.id}.json`);
      writePrivateAuditFile(a11yFilePath, JSON.stringify(redactRuntimeValue({
          route: r.path,
          id: r.id,
          runId,
          expected: navigation.expected,
          measured: !navigation.expected,
          finalPath: navigation.finalPath,
          httpStatus: navigation.httpStatus,
          reason: navigation.reason,
          timestamp: new Date().toISOString(),
        violationsCount: axeResults.violations.length,
        violations: axeResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        })),
       }), null, 2));
       const a11yStat = fs.lstatSync(a11yFilePath);
       if (!a11yStat.isFile() || a11yStat.isSymbolicLink() || a11yStat.size <= 0) {
         throw new Error('Artifact A11y invalide');
       }
       a11yArtifacts.push({
         routeId: r.id,
         runId,
         file: path.relative(process.cwd(), a11yFilePath),
         sha256: createHash('sha256').update(fs.readFileSync(a11yFilePath)).digest('hex'),
         size: a11yStat.size,
       });

        a11ySummary[r.id] = {
          runId,
          expected: navigation.expected,
         measured: !navigation.expected,
         route: r.path,
         finalPath: navigation.finalPath,
         httpStatus: navigation.httpStatus,
         reason: navigation.reason,
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
             storageState,
         serviceWorkers: 'block',
           });

           await captureCtx.addCookies([advCookie]);

          const page = await captureCtx.newPage();
           diagnostics = attachPageDiagnostics(page, routeDiagnosticsOptions(baseUrl, r.path));

          // Bootstrap theme & cookie consent
          await page.addInitScript((t) => {
            localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }));
            localStorage.setItem('lkdv_theme', t);
          }, theme);

           const navigation = await assertRouteNavigation(page, baseUrl, r.path);
           await page.waitForTimeout(600);
           const settledNavigation = assessCurrentRouteNavigation(page, baseUrl, r.path, navigation.httpStatus);
             if (settledNavigation.finalPath !== navigation.finalPath
               || settledNavigation.expected !== navigation.expected
               || settledNavigation.status !== navigation.status) {
               throw new Error('La route a changé après le chargement initial');
             }
             recordWarnings(diagnostics, r.id, `${vp.name}-${theme}-navigation`, warnings);
             diagnostics.assertClean();
              if (navigation.expected) continue;
              const defaultState = await waitForSection4DefaultState(page);
              if (defaultState.scrollY !== 0 || defaultState.overlayOpen) {
                throw new Error('État de capture par défaut non canonical');
              }
              const rendered = await readRenderedAuditSettings(page);
           assertRenderedAuditSettings({
             requestedTheme: theme,
             requestedIntensity: 0.5,
             actualTheme: rendered.theme,
             actualIntensity: rendered.intensity,
           });
               const shotBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
              writePrivateAuditFile(shotPath, shotBuffer);
              const defaultArtifact = fileDigest(shotPath);
           const finalNavigation = assessCurrentRouteNavigation(page, baseUrl, r.path, navigation.httpStatus);
           if (finalNavigation.finalPath !== navigation.finalPath
             || finalNavigation.expected !== navigation.expected
             || finalNavigation.status !== navigation.status) {
             throw new Error('La route a changé pendant la capture');
           }
            recordWarnings(diagnostics, r.id, `${vp.name}-${theme}`, warnings);
           diagnostics.assertClean();

           manifest.push({
             routeId: r.id,
             path: r.path,
             viewport: vp.name,
            theme,
             state: 'default',
             measurementState: 'default',
             scrollY: defaultState.scrollY,
             overlayOpen: defaultState.overlayOpen,
             runId,
             size: defaultArtifact.size,
             sha256: defaultArtifact.sha256,
             file: `audit/screens/section4/${r.id}/${shotFilename}`,
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
     if (INTENSITY_ROUTES.has(r.id)) {
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
             storageState,
         serviceWorkers: 'block',
           });
           await intensityCtx.addCookies([advCookie]);
          const page = await intensityCtx.newPage();
           diagnostics = attachPageDiagnostics(page, routeDiagnosticsOptions(baseUrl, r.path));
          await page.addInitScript((i) => {
            localStorage.setItem('lkdv_glass_intensity', String(i));
           }, intensity);

            const navigation = await assertRouteNavigation(page, baseUrl, r.path);
            await page.waitForTimeout(600);
            const settledNavigation = assessCurrentRouteNavigation(page, baseUrl, r.path, navigation.httpStatus);
              if (settledNavigation.finalPath !== navigation.finalPath
                || settledNavigation.expected !== navigation.expected
                || settledNavigation.status !== navigation.status) {
                throw new Error('La route a changé après le chargement initial');
              }
              recordWarnings(diagnostics, r.id, `intensity-${intensity}-navigation`, warnings);
             diagnostics.assertClean();
              if (navigation.expected) continue;
              const intensityState = await waitForSection4DefaultState(page);
              if (intensityState.scrollY !== 0 || intensityState.overlayOpen) {
                throw new Error('État de capture intensité non canonical');
              }
              const rendered = await readRenderedAuditSettings(page);
           assertRenderedAuditSettings({
             requestedTheme: 'dark',
             requestedIntensity: intensity,
             actualTheme: rendered.theme,
              actualIntensity: rendered.intensity,
            });
                const shotBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
              writePrivateAuditFile(shotPath, shotBuffer);
              const intensityArtifact = fileDigest(shotPath);
            const finalNavigation = assessCurrentRouteNavigation(page, baseUrl, r.path, navigation.httpStatus);
            if (finalNavigation.finalPath !== navigation.finalPath
              || finalNavigation.expected !== navigation.expected
              || finalNavigation.status !== navigation.status) {
              throw new Error('La route a changé pendant la capture');
            }
            recordWarnings(diagnostics, r.id, `intensity-${intensity}`, warnings);
           diagnostics.assertClean();

           manifest.push({
             routeId: r.id,
             path: r.path,
             viewport: '390x844',
            theme: 'dark',
             state: `intensity-${intensity}`,
             measurementState: 'default',
             scrollY: intensityState.scrollY,
             overlayOpen: intensityState.overlayOpen,
             runId,
             size: intensityArtifact.size,
             sha256: intensityArtifact.sha256,
             file: `audit/screens/section4/${r.id}/${shotFilename}`,
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

    const expectedCaptureKeys = new Set(EXPECTED_CAPTURE_ROUTES.flatMap((route) => VIEWPORTS.flatMap((viewport) => [
      `${route.id}|${route.path}|${viewport.name}|dark|default|audit/screens/section4/${route.id}/${viewport.name}-dark-default.png`,
      `${route.id}|${route.path}|${viewport.name}|light|default|audit/screens/section4/${route.id}/${viewport.name}-light-default.png`,
    ]).concat(INTENSITY_ROUTES.has(route.id)
      ? [0, 0.5, 1].map((intensity) => `${route.id}|${route.path}|390x844|dark|intensity-${intensity}|audit/screens/section4/${route.id}/390x844-dark-intensity-${intensity}.png`)
      : [])));
    const actualCaptureKeys = manifest.map((capture) => (
      `${capture.routeId}|${capture.path}|${capture.viewport}|${capture.theme}|${capture.state}|${capture.file}`
    ));
    const actualCaptureKeySet = new Set(actualCaptureKeys);
     const captureFilesComplete = manifest.every((capture) => {
       const filePath = path.resolve(capture.file);
       if (!pathWithin(screensDir, filePath) || !fs.existsSync(filePath)) return false;
       const stat = fs.lstatSync(filePath);
       if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0
         || capture.runId !== runId
         || capture.measurementState !== 'default'
         || capture.scrollY !== 0
         || capture.overlayOpen !== false
         || stat.size !== capture.size) return false;
       const digest = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
       return digest === capture.sha256;
     });
    const manifestSetComplete = actualCaptureKeys.length === manifest.length
      && actualCaptureKeySet.size === actualCaptureKeys.length
      && actualCaptureKeySet.size === expectedCaptureKeys.size
      && [...expectedCaptureKeys].every((key) => actualCaptureKeySet.has(key))
      && captureFilesComplete;
   const expectedA11yRouteIds = new Set(ROUTES.map((route) => route.id));
   const actualA11yRouteIds = new Set(Object.keys(a11ySummary));
     const a11yRouteSetComplete = actualA11yRouteIds.size === expectedA11yRouteIds.size
       && [...expectedA11yRouteIds].every((routeId) => actualA11yRouteIds.has(routeId));
     const a11yEvidenceBound = ROUTES.every((route) => {
       const summary = a11ySummary[route.id];
       const expectation = routeExpectationFor(route.path);
       const expectedFinalPath = expectation?.finalPath || route.path;
       return Boolean(summary)
         && summary.runId === runId
         && summary.route === route.path
         && summary.expected === Boolean(expectation)
         && summary.measured === !expectation
         && summary.finalPath === expectedFinalPath
         && Number.isInteger(summary.httpStatus)
         && summary.httpStatus > 0
         && summary.reason === (expectation?.reason || null)
         && Number.isInteger(summary.violationsCount)
         && summary.violationsCount >= 0;
     });
      const a11yArtifactsComplete = a11yArtifacts.length === ROUTES.length
        && a11yArtifacts.every((artifact) => {
          const filePath = path.resolve(artifact.file);
          if (artifact.runId !== runId || !pathWithin(a11yDir, filePath) || !fs.existsSync(filePath)) return false;
          const stat = fs.lstatSync(filePath);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== artifact.size) return false;
          return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') === artifact.sha256;
        });
      const verificationStatus = errors.length === 0
     && warnings.length === 0
     && authVerified
       && manifestSetComplete
       && a11yRouteSetComplete
        && a11yEvidenceBound
        && a11yArtifactsComplete
        ? 'VERIFIED'
     : 'PARTIAL / NOT VERIFIED';

    if (verificationStatus !== 'VERIFIED') {
      const error = new Error(`Campagne Section 4 non vérifiée (${verificationStatus}); ${errors.length} erreur(s), ${warnings.length} warning(s), ${manifest.length}/${EXPECTED_CAPTURE_COUNT} capture(s)`);
      writeAuditErrorReport(errorReportPath, error, { errors, warnings, totalCaptures: manifest.length, expectedCaptureCount: EXPECTED_CAPTURE_COUNT });
      throw error;
    }

     writePrivateAuditFile(path.join(a11yDir, 'summary.json'), JSON.stringify(redactRuntimeValue({
       runId,
       verificationStatus,
       warnings,
       routes: a11ySummary,
     }), null, 2));

     writePrivateAuditFile(manifestPath, JSON.stringify(redactRuntimeValue({
       runId,
       verificationStatus,
       totalCaptures: manifest.length,
       expectedCaptureCount: EXPECTED_CAPTURE_COUNT,
       authVerified,
       manifestSetComplete,
       a11yRouteSetComplete,
       a11yEvidenceBound,
       a11yArtifactsComplete,
       timestamp: new Date().toISOString(),
       warnings,
       manifest,
       a11yArtifacts,
     }), null, 2));

  console.log(`\n✅ Campagne Section 4 terminée avec succès : ${manifest.length} captures enregistrées dans audit/screens/section4/ et audits A11y dans audit/a11y/section4/`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((e) => {
    console.error('Fatal error during Section 4 captures:', redactDiagnosticText(e instanceof Error ? e.message : e));
    process.exit(1);
  });
}
