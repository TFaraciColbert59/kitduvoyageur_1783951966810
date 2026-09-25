import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { captureStatusForRoute, getAuditCredentials } from './audit/contrast_audit_core.mjs';
import { redactDiagnosticText, redactRuntimeValue } from './audit/audit_runtime.mjs';

const outDir = path.resolve('screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Nettoyer les fichiers test préliminaires
for (const file of fs.readdirSync(outDir)) {
  if (file.startsWith('test_')) {
    try { fs.unlinkSync(path.join(outDir, file)); } catch {}
  }
}

// Récupérer les cookies de session pour y-demo
async function getAuthCookie() {
  try {
    const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
    if (!fs.existsSync(envPath)) throw new Error('configuration Supabase absente');
    const raw = fs.readFileSync(envPath, 'utf8');
    const url = raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
    const anonKey = raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (!url || !anonKey) throw new Error('configuration Supabase absente');

    let savedCookies = [];
    const sb = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => savedCookies,
        setAll: (cookies) => { savedCookies = cookies; },
      },
    });
    const { email, password } = getAuditCredentials();
    const result = await sb.auth.signInWithPassword({ email, password });
    if (result?.error) throw new Error(result.error.message);
    const authCookie = savedCookies.find((cookie) => /auth-token/i.test(cookie.name));
    if (!authCookie || typeof authCookie.value !== 'string' || authCookie.value === '') {
      throw new Error('cookie de session absent');
    }
    return {
      verified: true,
      cookie: {
        name: authCookie.name,
        value: authCookie.value,
        domain: 'localhost',
        path: '/',
      },
    };
  } catch (err) {
    const message = redactDiagnosticText(err instanceof Error ? err.message : err);
    console.warn('[capture] Authentification non vérifiée:', message || 'échec non renseigné');
    return { verified: false, cookie: null, error: message || 'Authentification non vérifiée' };
  }
}

// Cookie d'aventure active
function getAdventureCookie(slug = 'y-long-group') {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify({ nature: 'sortie', id: slug, slug, title: slug })).toString('base64url'),
    domain: 'localhost',
    path: '/',
  };
}

const PROTECTED_ROUTE_PREFIXES = [
  '/hub',
  '/compte',
  '/profil',
  '/progression',
  '/fidelite',
  '/recompenses',
  '/messagerie',
  '/voyages',
  '/carnets',
  '/carnet',
  '/preparer-sentier',
  '/nouveau-groupe',
  '/rejoindre',
  '/admin',
];

function routeRequiresAuth(route) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => (
    route.path === prefix
    || route.path.startsWith(`${prefix}/`)
    || route.path.startsWith(`${prefix}?`)
  ));
}

// Liste exhaustive de toutes les routes de l'application
const ALL_ROUTES = [
  // ── 1. Pages Principales & Découverte ─────────────────────────────────────
  { id: 'accueil', path: '/', label: 'Accueil / Vitrine', cat: 'Général' },
  { id: 'hub', path: '/hub', label: 'Hub Cockpit Voyage', cat: 'Hub' },
  { id: 'hub-nouveau', path: '/hub/nouveau', label: 'Hub — Créer Voyage', cat: 'Hub' },
  { id: 'hub-itineraire', path: '/hub/itineraire', label: 'Hub — Itinéraire', cat: 'Hub' },
  { id: 'hub-budget', path: '/hub/budget', label: 'Hub — Budget & Dépenses', cat: 'Hub' },
  { id: 'hub-groupe', path: '/hub/groupe', label: 'Hub — Équipage & Rôles', cat: 'Hub' },
  { id: 'hub-securite', path: '/hub/securite', label: 'Hub — Sécurité & Checkpoints', cat: 'Hub' },
  { id: 'hub-materiel', path: '/hub/materiel', label: 'Hub — Matériel & Inventaire', cat: 'Hub' },
  { id: 'hub-documents', path: '/hub/documents', label: 'Hub — Documents', cat: 'Hub' },
  { id: 'explorer', path: '/explorer', label: 'Explorer / Recherche Sentiers', cat: 'Exploration' },
  { id: 'carte-interactive', path: '/carte-interactive', label: 'Carte Interactive (Leaflet/MapLibre)', cat: 'Exploration' },
  { id: 'randonnee-active', path: '/randonnee-active', label: 'Randonnée Active / En cours', cat: 'Exploration' },
  { id: 'rapport-expedition', path: '/rapport-expedition', label: 'Rapport d’Expédition', cat: 'Exploration' },

  // ── 2. Matériel, Kits & Configurateur IA ─────────────────────────────────
  { id: 'materiel', path: '/materiel', label: 'Gestionnaire Matériel (Liquid Glass)', cat: 'Équipement' },
  { id: 'kits', path: '/kits', label: 'Catalogue des Kits Outdoor', cat: 'Équipement' },
  { id: 'kit-islande', path: '/kits/islande-trek', label: 'Kit Détail — Islande Trek', cat: 'Équipement' },
  { id: 'kit-gr20', path: '/kits/gr20-corse', label: 'Kit Détail — GR20 Corse', cat: 'Équipement' },
  { id: 'kit-vanlife', path: '/kits/vanlife-europe', label: 'Kit Détail — Vanlife Europe', cat: 'Équipement' },
  { id: 'kit-partage', path: '/k/demo-token', label: 'Kit Partagé — Vue Publique /k/', cat: 'Équipement' },
  { id: 'ai-configurator', path: '/ai-configurator', label: 'Configurateur IA de Pack', cat: 'Équipement' },
  { id: 'copilote', path: '/copilote', label: 'Copilote IA Voyageur', cat: 'Équipement' },

  // ── 3. Boutique, Vente & Checkout ─────────────────────────────────────────
  { id: 'boutique', path: '/boutique', label: 'Boutique Outdoor', cat: 'E-commerce' },
  { id: 'produit-detail', path: '/produit/sac-a-dos-de-randonnee-categorie-bigbuy', label: 'Fiche Produit BigBuy', cat: 'E-commerce' },
  { id: 'occasion', path: '/occasion', label: 'Bourse au Matériel d’Occasion', cat: 'E-commerce' },
  { id: 'location', path: '/location', label: 'Location de Matériel', cat: 'E-commerce' },
  { id: 'panier', path: '/panier', label: 'Panier d’Achat', cat: 'E-commerce' },
  { id: 'checkout', path: '/checkout', label: 'Tunnel de Paiement Stripe', cat: 'E-commerce' },
  { id: 'abonnements', path: '/abonnements', label: 'Abonnements & Forfaits Club', cat: 'E-commerce' },

  // ── 4. Destinations, Pays & Lieux ─────────────────────────────────────────
  { id: 'pays-fr', path: '/pays/fr', label: 'Destination Pays — France', cat: 'Destinations' },
  { id: 'pays-is', path: '/pays/is', label: 'Destination Pays — Islande', cat: 'Destinations' },
  { id: 'pays-jp', path: '/pays/jp', label: 'Destination Pays — Japon', cat: 'Destinations' },
  { id: 'lieux', path: '/lieux', label: 'Index des Lieux & Refuges', cat: 'Destinations' },
  { id: 'lieu-detail', path: '/lieux/refuge-du-gouter-mont-blanc', label: 'Lieu Détail — Refuge du Goûter', cat: 'Destinations' },
  { id: 'preparer-randonnee', path: '/preparer-randonnee', label: 'Préparer Randonnée', cat: 'Destinations' },
  { id: 'preparer-sentier-apercu', path: '/preparer-sentier/apercu', label: 'Préparer Sentier — Aperçu', cat: 'Destinations' },
  { id: 'preparer-sentier-detail', path: '/preparer-sentier/refuge-du-gouter-mont-blanc', label: 'Préparer Sentier — Fiche Sentier', cat: 'Destinations' },

  // ── 5. Communauté, Carnets, Clubs & Social ───────────────────────────────
  { id: 'communaute', path: '/communaute', label: 'Communauté LKDV — Flux Social', cat: 'Communauté' },
  { id: 'communaute-publier', path: '/communaute/publier', label: 'Publier dans la Communauté', cat: 'Communauté' },
  { id: 'communaute-pro', path: '/communaute-pro', label: 'Espace Communauté Pro', cat: 'Communauté' },
  { id: 'feed', path: '/feed', label: 'Flux d’Actualité Aventure', cat: 'Communauté' },
  { id: 'carnets', path: '/carnets', label: 'Carnets de Voyage — Galerie', cat: 'Communauté' },
  { id: 'carnet-nouveau', path: '/carnets/nouveau', label: 'Créer un Nouveau Carnet', cat: 'Communauté' },
  { id: 'carnet-detail', path: '/carnets/f21439a3-4daf-42ed-a778-1fa3fffa8f61', label: 'Carnet Détail', cat: 'Communauté' },
  { id: 'clubs', path: '/clubs', label: 'Clubs & Communautés d’Aventuriers', cat: 'Communauté' },
  { id: 'club-nouveau', path: '/clubs/nouveau', label: 'Créer un Club', cat: 'Communauté' },
  { id: 'club-detail', path: '/clubs/b2000012-0000-0000-0000-000000000005', label: 'Club Détail — Alpinistes Débutants', cat: 'Communauté' },
  { id: 'nouveau-groupe', path: '/nouveau-groupe', label: 'Créer un Nouveau Groupe', cat: 'Communauté' },
  { id: 'entraide', path: '/entraide', label: 'Entraide & SOS Voyageurs', cat: 'Communauté' },
  { id: 'evenements', path: '/evenements', label: 'Événements & Meetups Outdoor', cat: 'Communauté' },
  { id: 'avis', path: '/avis', label: 'Avis & Retours d’Expérience', cat: 'Communauté' },
  { id: 'publier', path: '/publier', label: 'Portail Publier', cat: 'Communauté' },

  // ── 6. Outils & Calculateurs Randonnée ────────────────────────────────────
  { id: 'outils', path: '/outils', label: 'Boîte à Outils du Voyageur', cat: 'Outils' },
  { id: 'outil-poids-sac', path: '/outils/poids-sac', label: 'Outil — Simulateur Poids du Sac', cat: 'Outils' },
  { id: 'outil-budget', path: '/outils/budget-voyage', label: 'Outil — Simulateur Budget Voyage', cat: 'Outils' },
  { id: 'outil-convertisseur', path: '/outils/convertisseur', label: 'Outil — Convertisseur Devises & Unités', cat: 'Outils' },
  { id: 'outil-checklist', path: '/outils/checklist', label: 'Outil — Checklist Dynamique', cat: 'Outils' },
  { id: 'outil-tailles', path: '/outils/tailles', label: 'Outil — Guide des Tailles & Sacs', cat: 'Outils' },
  { id: 'outil-fuseaux', path: '/outils/fuseaux', label: 'Outil — Horloges & Fuseaux', cat: 'Outils' },
  { id: 'outil-boussole', path: '/outils/boussole', label: 'Outil — Boussole & Orientation', cat: 'Outils' },
  { id: 'outil-chronometre', path: '/outils/chronometre', label: 'Outil — Chronomètre & Rythme', cat: 'Outils' },
  { id: 'outil-rations', path: '/outils/rations', label: 'Outil — Calculateur de Rations', cat: 'Outils' },
  { id: 'carbone', path: '/carbone', label: 'Calculateur Empreinte Carbone', cat: 'Outils' },

  // ── 7. Compte Utilisateur, Gamification & Messagerie ───────────────────────
  { id: 'compte', path: '/compte', label: 'Mon Compte & Cockpit Profil', cat: 'Utilisateur' },
  { id: 'compte-modifier', path: '/compte/modifier', label: 'Modifier Mon Profil', cat: 'Utilisateur' },
  { id: 'compte-user-redirect', path: '/compte/622c9c69-2b19-425c-be5f-d47d470461d8', label: 'Compte Redirection ID', cat: 'Utilisateur' },
  { id: 'profil-public', path: '/profil', label: 'Mon Profil Public', cat: 'Utilisateur' },
  { id: 'profil-detail', path: '/profil/622c9c69-2b19-425c-be5f-d47d470461d8', label: 'Profil Public — Voyageur Y', cat: 'Utilisateur' },
  { id: 'progression', path: '/progression', label: 'Progression & Niveaux d’Aventurier', cat: 'Utilisateur' },
  { id: 'fidelite', path: '/fidelite', label: 'Programme Fidélité & Badges', cat: 'Utilisateur' },
  { id: 'recompenses', path: '/recompenses', label: 'Récompenses Débloquées', cat: 'Utilisateur' },
  { id: 'messagerie', path: '/messagerie', label: 'Messagerie & Chats Sécurisés', cat: 'Utilisateur' },
  { id: 'connexion', path: '/connexion', label: 'Page Connexion', cat: 'Utilisateur' },
  { id: 'inscription', path: '/inscription', label: 'Page Inscription', cat: 'Utilisateur' },

  // ── 8. Voyages Partagés & Coéquipiers ──────────────────────────────────────
  { id: 'voyage-y-long-group', path: '/voyages/y-long-group', label: 'Voyage — TMB Itinérance Groupe', cat: 'Voyages' },
  { id: 'voyage-section-itineraire', path: '/voyages/y-long-group/itineraire', label: 'Voyage — Section Itinéraire', cat: 'Voyages' },
  { id: 'voyage-section-budget', path: '/voyages/y-long-group/budget', label: 'Voyage — Section Budget & Comptes', cat: 'Voyages' },
  { id: 'voyage-section-groupe', path: '/voyages/y-long-group/groupe', label: 'Voyage — Section Coéquipiers', cat: 'Voyages' },
  { id: 'voyage-section-securite', path: '/voyages/y-long-group/securite', label: 'Voyage — Section Sécurité', cat: 'Voyages' },
  { id: 'rejoindre-voyage', path: '/rejoindre/y-long-group', label: 'Page Rejoindre un Voyage', cat: 'Voyages' },

  // ── 9. Guides, Blog & Contenu ─────────────────────────────────────────────
  { id: 'guides', path: '/guides', label: 'Guides Pratiques & Conseils', cat: 'Contenu' },
  { id: 'guide-detail', path: '/guides/checklist-sac-a-dos-trek-nepal', label: 'Guide Détail — Trek Népal', cat: 'Contenu' },
  { id: 'blog', path: '/blog', label: 'Blog du Voyageur', cat: 'Contenu' },
  { id: 'manifeste', path: '/manifeste', label: 'Manifeste & Vision LKDV', cat: 'Contenu' },
  { id: 'experts', path: '/experts', label: 'Experts & Guides de Montagne', cat: 'Contenu' },
  { id: 'ambassadeurs', path: '/ambassadeurs', label: 'Programme Ambassadeurs', cat: 'Contenu' },
  { id: 'createurs', path: '/createurs', label: 'Portail Créateurs de Contenu', cat: 'Contenu' },
  { id: 'pro', path: '/pro', label: 'Espace Professionnels', cat: 'Contenu' },
  { id: 'faq', path: '/faq', label: 'Foire Aux Questions (FAQ)', cat: 'Contenu' },
  { id: 'contact', path: '/contact', label: 'Formulaire de Contact', cat: 'Contenu' },

  // ── 10. Administration & Développement ───────────────────────────────────
  { id: 'admin', path: '/admin', label: 'Dashboard Administration', cat: 'Admin' },
  { id: 'admin-produits', path: '/admin/produits', label: 'Admin — Gestion Catalogue Produits', cat: 'Admin' },
  { id: 'dev-glass', path: '/dev/glass', label: 'Showcase Liquid Glass & UI Tokens', cat: 'Design System' },
  { id: 'dev-style', path: '/dev/style', label: 'Guide de Styles & Composants', cat: 'Design System' },

  // ── 11. Juridique, Offline & Système ─────────────────────────────────────
  { id: 'mentions-legales', path: '/mentions-legales', label: 'Mentions Légales', cat: 'Légal' },
  { id: 'cgv', path: '/cgv', label: 'Conditions Générales de Vente (CGV)', cat: 'Légal' },
  { id: 'cgu', path: '/cgu', label: 'Conditions Générales d’Utilisation (CGU)', cat: 'Légal' },
  { id: 'politique-confidentialite', path: '/politique-confidentialite', label: 'Politique de Confidentialité', cat: 'Légal' },
  { id: 'cookies', path: '/cookies', label: 'Gestion des Cookies & Données', cat: 'Légal' },
  { id: 'hors-ligne', path: '/hors-ligne', label: 'Page Mode Hors-Ligne (PWA)', cat: 'Système' },
  { id: 'page-404', path: '/page-introuvable-404', label: 'Page 404 (Introuvable)', cat: 'Système' },
];

async function captureAllPages() {
  console.log(`=======================================================`);
  console.log(`📸 LANCEMENT CAPTURE VISUELLE DE TOUTES LES PAGES (${ALL_ROUTES.length} PAGES)`);
  console.log(`=======================================================\n`);

  const authState = await getAuthCookie();
  const authCookie = authState.cookie;
  const authVerified = authState.verified;
  const adventureCookie = getAdventureCookie();

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'fr-FR',
  });

  // Ajouter les cookies
  const cookiesToAdd = [adventureCookie];
  if (authCookie) cookiesToAdd.push(authCookie);
  await context.addCookies(cookiesToAdd);

  const page = await context.newPage();

  // Injecter consent et neutraliser état offline
  await page.addInitScript(() => {
    localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
    );
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.addEventListener('offline', (e) => e.stopImmediatePropagation(), true);
  });

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < ALL_ROUTES.length; i++) {
    const r = ALL_ROUTES[i];
    const indexStr = String(i + 1).padStart(3, '0');
    const filename = `${indexStr}_${r.id}.png`;
    const fullPath = path.join(outDir, filename);
    const targetUrl = `http://localhost:4000${r.path}`;
    const requiresAuth = routeRequiresAuth(r);

    process.stdout.write(`[${i + 1}/${ALL_ROUTES.length}] ${r.label} (${r.path}) ... `);
    const itemStart = Date.now();

    if (requiresAuth && !authVerified) {
      const message = 'Authentification non vérifiée';
      results.push({
        ...r,
        index: i + 1,
        filename: null,
        status: captureStatusForRoute({ authVerified, requiresAuth }),
        duration: '0.0',
        error: message,
        authVerified: false,
        requiresAuth: true,
      });
      console.log(`⚠️ ${message}`);
      continue;
    }

    try {
      // 1. Navigation
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // 2. Attente de chargement 100%
      // Présence structurelle
      await page.waitForSelector('main, .max-w-4xl, [role="main"], body', { timeout: 12000 }).catch(() => {});

      // Disparition des loaders & skeletons
      await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 6000 }).catch(() => {});
      await page.waitForSelector('[class*="animate-pulse"]', { state: 'hidden', timeout: 6000 }).catch(() => {});
      await page.waitForSelector('[aria-busy="true"]', { state: 'hidden', timeout: 6000 }).catch(() => {});

      // Polices
      await Promise.race([
        page.evaluate(() => document.fonts.ready),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {});

      // Images complètes
      await Promise.race([
        page.evaluate(() =>
          Promise.all(
            Array.from(document.images)
              .filter((img) => !img.complete)
              .map(
                (img) =>
                  new Promise((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                  })
              )
          )
        ),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]).catch(() => {});

      // 3. Masquage overlay dev Next.js, neutralisation scrollbars et transitions
      await page.addStyleTag({
        content: `
          nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          * { scrollbar-width: none !important; }
          *, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; }
        `,
      });

      // Pause de stabilisation d'hydratation
      await page.waitForTimeout(700);

      // 4. Capture d'écran 100% pleine page
      await page.screenshot({
        path: fullPath,
        fullPage: true,
      });

      const stat = fs.statSync(fullPath);
      const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1);
      const sizeKo = Math.round(stat.size / 1024);

      const status = captureStatusForRoute({ authVerified, requiresAuth });
      const marker = status === 'OK' ? '✓ OK' : `⚠ ${status}`;
      console.log(`${marker} (${sizeKo} Ko, ${elapsed}s)`);
      results.push({
        ...r,
        index: i + 1,
        filename,
        fileSize: stat.size,
        status,
        duration: elapsed,
        authVerified,
        requiresAuth,
      });
    } catch (err) {
      const message = redactDiagnosticText(err instanceof Error ? err.message : err);
      console.log(`⚠️ ERREUR: ${message}`);
      try {
        await page.screenshot({ path: fullPath, fullPage: false });
        const stat = fs.statSync(fullPath);
        results.push({
          ...r,
          index: i + 1,
          filename,
          fileSize: stat.size,
          status: 'PARTIAL / NOT VERIFIED',
          duration: ((Date.now() - itemStart) / 1000).toFixed(1),
          error: message,
          authVerified,
          requiresAuth,
        });
      } catch {
        results.push({
          ...r,
          index: i + 1,
          filename: null,
          status: 'PARTIAL / NOT VERIFIED',
          error: message,
          authVerified,
          requiresAuth,
        });
      }
    }
  }

  await browser.close();

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const verificationStatus = authVerified && results.every((result) => result.status === 'OK')
    ? 'OK'
    : 'PARTIAL / NOT VERIFIED';
  console.log(`\n=======================================================`);
  console.log(`🎉 TOUTES LES CAPTURES SONT TERMINÉES EN ${totalTime}s !`);
  console.log(`Total capturé: ${results.filter((r) => r.filename).length}/${ALL_ROUTES.length}`);
  console.log(`Statut de campagne: ${verificationStatus}`);
  console.log(`Dossier: ${outDir}`);
  console.log(`=======================================================\n`);

  generateGalleryHtml(results, totalTime, verificationStatus);
  if (verificationStatus !== 'OK') process.exitCode = 1;
  return { results, verificationStatus };
}

function generateGalleryHtml(results, totalTime, verificationStatus) {
  const categories = [...new Set(results.map((r) => r.cat))];
  const totalScreenshots = results.filter((r) => r.filename).length;
  const totalSizeMo = (results.reduce((acc, r) => acc + (r.fileSize || 0), 0) / (1024 * 1024)).toFixed(1);

  const sectionsHtml = categories
    .map((cat) => {
      const items = results.filter((r) => r.cat === cat && r.filename);
      const cards = items
        .map((item) => {
          const ko = Math.round((item.fileSize || 0) / 1024);
          return `
        <div class="card" data-cat="${item.cat}" data-title="${item.label.toLowerCase()}" data-path="${item.path.toLowerCase()}">
          <div class="card-header">
            <span class="badge">#${String(item.index).padStart(3, '0')}</span>
            <span class="category-pill">${item.cat}</span>
            <span class="file-size">${ko} Ko</span>
          </div>
          <a href="${item.filename}" target="_blank" class="img-wrap" title="Agrandir ${item.label}">
            <img src="${item.filename}" loading="lazy" alt="${item.label}">
            <div class="overlay">🔍 Plein Écran</div>
          </a>
          <div class="card-body">
            <h3 class="title">${item.label}</h3>
            <div class="path-bar">
              <code>${item.path}</code>
              <a href="http://localhost:4000${item.path}" target="_blank" class="open-link" title="Ouvrir dans l'app locale">↗</a>
            </div>
          </div>
        </div>`;
        })
        .join('\n');

      return `
      <section class="category-section" id="cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
        <div class="cat-header">
          <h2>${cat}</h2>
          <span class="cat-count">${items.length} page(s)</span>
        </div>
        <div class="cards-grid">
          ${cards}
        </div>
      </section>`;
    })
    .join('\n');

  const navFilters = categories
    .map(
      (c) => `<button class="filter-btn" data-filter="${c}">${c}</button>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LKDV — Galerie Complète des Visuels de l'App (100% des Pages)</title>
  <style>
    :root {
      --bg: #0C0F0E;
      --surface: #141A17;
      --surface-elevated: #1B2420;
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(52, 199, 89, 0.3);
      --text: #F5F7F5;
      --text-muted: #8F9E95;
      --accent: #34C759;
      --accent-glow: rgba(52, 199, 89, 0.15);
      --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 0;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    header {
      background: rgba(20, 26, 23, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 20px 32px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .tag {
      background: var(--accent-glow);
      color: var(--accent);
      border: 1px solid var(--border-accent);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .stats-bar {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .stats-bar strong {
      color: var(--text);
      font-weight: 600;
    }
    .controls {
      display: flex;
      gap: 12px;
      margin-top: 18px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-input {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      color: #fff;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 14px;
      width: 280px;
      outline: none;
      transition: all 0.2s ease;
    }
    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .filter-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-btn:hover {
      background: var(--surface-elevated);
      color: #fff;
    }
    .filter-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      font-weight: 600;
    }
    main {
      padding: 32px;
      max-width: 1800px;
      margin: 0 auto;
    }
    .cat-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .cat-header h2 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .cat-count {
      color: var(--text-muted);
      font-size: 13px;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 12px 30px rgba(0,0,0,0.5);
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .badge {
      font-family: ui-monospace, monospace;
      font-weight: 700;
      color: var(--accent);
    }
    .category-pill {
      background: rgba(255, 255, 255, 0.06);
      padding: 2px 8px;
      border-radius: 6px;
      color: var(--text-muted);
    }
    .file-size {
      margin-left: auto;
      color: var(--text-muted);
      font-family: ui-monospace, monospace;
      font-size: 11px;
    }
    .img-wrap {
      position: relative;
      display: block;
      height: 380px;
      background: #000;
      overflow: hidden;
      cursor: zoom-in;
    }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      transition: transform 0.3s ease;
    }
    .img-wrap:hover img {
      transform: scale(1.02);
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
      color: #fff;
      font-weight: 600;
      font-size: 14px;
      backdrop-filter: blur(2px);
    }
    .img-wrap:hover .overlay {
      opacity: 1;
    }
    .card-body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: auto;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .path-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .path-bar code {
      background: rgba(0, 0, 0, 0.3);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--accent);
      font-family: ui-monospace, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .open-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
    }
    .open-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.15);
    }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <div class="logo-badge">
        <h1>Le Kit du Voyageur — Galerie Visuelle 100%</h1>
        <span class="tag">Statut : ${verificationStatus}</span>
      </div>
      <div class="stats-bar">
        <span><strong>${totalScreenshots}</strong> pages capturées</span>
        <span>Poids total : <strong>${totalSizeMo} Mo</strong></span>
        <span>Résolution : <strong>1440px Pleine Page</strong></span>
        <span>Durée : <strong>${totalTime}s</strong></span>
      </div>
    </div>
    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="Filtrer une page, une route (/hub, /pays)...">
      <div class="filters">
        <button class="filter-btn active" data-filter="all">Tous (${totalScreenshots})</button>
        ${navFilters}
      </div>
    </div>
  </header>

  <main>
    ${sectionsHtml}
  </main>

  <script>
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.card');
    const sections = document.querySelectorAll('.category-section');

    function filterCards() {
      const q = searchInput.value.toLowerCase().trim();
      const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

      sections.forEach(sec => {
        let visibleCount = 0;
        const secCards = sec.querySelectorAll('.card');
        secCards.forEach(c => {
          const cat = c.dataset.cat;
          const title = c.dataset.title;
          const p = c.dataset.path;

          const matchCat = activeFilter === 'all' || cat === activeFilter;
          const matchQuery = !q || title.includes(q) || p.includes(q) || cat.toLowerCase().includes(q);

          if (matchCat && matchQuery) {
            c.style.display = 'flex';
            visibleCount++;
          } else {
            c.style.display = 'none';
          }
        });

        sec.style.display = visibleCount > 0 ? 'block' : 'none';
      });
    }

    searchInput.addEventListener('input', filterCards);

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterCards();
      });
    });
  </script>
</body>
</html>`;

  const htmlPath = path.join(outDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✓ Galerie HTML générée : ${htmlPath}`);

  // Générer aussi un JSON de manifeste pour outillage ultérieur
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = results.map((result) => ({ ...result, campaignStatus: verificationStatus }));
  fs.writeFileSync(manifestPath, JSON.stringify(redactRuntimeValue(manifest), null, 2), 'utf8');
  console.log(`✓ Manifeste JSON généré : ${manifestPath}`);
}

captureAllPages().catch((error) => {
  console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
