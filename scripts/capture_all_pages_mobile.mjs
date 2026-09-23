import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';

const outDir = path.resolve('screenshots_mobile');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Récupérer les cookies de session pour y-demo
async function getAuthCookie() {
  try {
    const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
    const raw = fs.readFileSync(envPath, 'utf8');
    const url = raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
    const anonKey = raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
    if (!url || !anonKey) return null;

    let savedCookies = [];
    const sb = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => savedCookies,
        setAll: (cs) => { savedCookies = cs; },
      },
    });

    await sb.auth.signInWithPassword({
      email: 'y-demo@lekitduvoyageur.fr',
      password: 'Ydemo!2026',
    });

    if (savedCookies.length > 0) {
      return {
        name: savedCookies[0].name,
        value: savedCookies[0].value,
        domain: 'localhost',
        path: '/',
      };
    }
  } catch (err) {
    console.warn('[capture-mobile] Auth démo:', err.message);
  }
  return null;
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

// Liste exhaustive des routes
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
  { id: 'carte-interactive', path: '/carte-interactive', label: 'Carte Interactive Mobile', cat: 'Exploration' },
  { id: 'randonnee-active', path: '/randonnee-active', label: 'Randonnée Active Mobile', cat: 'Exploration' },
  { id: 'rapport-expedition', path: '/rapport-expedition', label: 'Rapport d’Expédition', cat: 'Exploration' },

  // ── 2. Matériel, Kits & Configurateur IA ─────────────────────────────────
  { id: 'materiel', path: '/materiel', label: 'Gestionnaire Matériel Liquid Glass', cat: 'Équipement' },
  { id: 'kits', path: '/kits', label: 'Catalogue des Kits Outdoor', cat: 'Équipement' },
  { id: 'kit-islande', path: '/kits/islande-trek', label: 'Kit Détail — Islande Trek', cat: 'Équipement' },
  { id: 'kit-gr20', path: '/kits/gr20-corse', label: 'Kit Détail — GR20 Corse', cat: 'Équipement' },
  { id: 'kit-vanlife', path: '/kits/vanlife-europe', label: 'Kit Détail — Vanlife Europe', cat: 'Équipement' },
  { id: 'kit-partage', path: '/k/demo-token', label: 'Kit Partagé — Vue Mobile /k/', cat: 'Équipement' },
  { id: 'ai-configurator', path: '/ai-configurator', label: 'Configurateur IA Mobile', cat: 'Équipement' },
  { id: 'copilote', path: '/copilote', label: 'Copilote IA Voyageur Mobile', cat: 'Équipement' },

  // ── 3. Boutique, Vente & Checkout ─────────────────────────────────────────
  { id: 'boutique', path: '/boutique', label: 'Boutique Outdoor Mobile', cat: 'E-commerce' },
  { id: 'produit-detail', path: '/produit/sac-a-dos-de-randonnee-categorie-bigbuy', label: 'Fiche Produit Mobile', cat: 'E-commerce' },
  { id: 'occasion', path: '/occasion', label: 'Occasion Mobile', cat: 'E-commerce' },
  { id: 'location', path: '/location', label: 'Location Mobile', cat: 'E-commerce' },
  { id: 'panier', path: '/panier', label: 'Panier Mobile', cat: 'E-commerce' },
  { id: 'checkout', path: '/checkout', label: 'Paiement Stripe Mobile', cat: 'E-commerce' },
  { id: 'abonnements', path: '/abonnements', label: 'Abonnements Club Mobile', cat: 'E-commerce' },

  // ── 4. Destinations, Pays & Lieux ─────────────────────────────────────────
  { id: 'pays-fr', path: '/pays/fr', label: 'Destination Pays — France Mobile', cat: 'Destinations' },
  { id: 'pays-is', path: '/pays/is', label: 'Destination Pays — Islande Mobile', cat: 'Destinations' },
  { id: 'pays-jp', path: '/pays/jp', label: 'Destination Pays — Japon Mobile', cat: 'Destinations' },
  { id: 'lieux', path: '/lieux', label: 'Index des Lieux & Refuges', cat: 'Destinations' },
  { id: 'lieu-detail', path: '/lieux/refuge-du-gouter-mont-blanc', label: 'Lieu Détail — Refuge du Goûter', cat: 'Destinations' },
  { id: 'preparer-randonnee', path: '/preparer-randonnee', label: 'Préparer Randonnée Mobile', cat: 'Destinations' },
  { id: 'preparer-sentier-apercu', path: '/preparer-sentier/apercu', label: 'Préparer Sentier — Aperçu', cat: 'Destinations' },
  { id: 'preparer-sentier-detail', path: '/preparer-sentier/refuge-du-gouter-mont-blanc', label: 'Préparer Sentier — Fiche Sentier', cat: 'Destinations' },

  // ── 5. Communauté, Carnets, Clubs & Social ───────────────────────────────
  { id: 'communaute', path: '/communaute', label: 'Communauté — Flux Mobile', cat: 'Communauté' },
  { id: 'communaute-publier', path: '/communaute/publier', label: 'Publier dans la Communauté', cat: 'Communauté' },
  { id: 'communaute-pro', path: '/communaute-pro', label: 'Espace Communauté Pro', cat: 'Communauté' },
  { id: 'feed', path: '/feed', label: 'Feed Actualité Mobile', cat: 'Communauté' },
  { id: 'carnets', path: '/carnets', label: 'Carnets de Voyage Mobile', cat: 'Communauté' },
  { id: 'carnet-nouveau', path: '/carnets/nouveau', label: 'Nouveau Carnet Mobile', cat: 'Communauté' },
  { id: 'carnet-detail', path: '/carnets/f21439a3-4daf-42ed-a778-1fa3fffa8f61', label: 'Carnet Détail Mobile', cat: 'Communauté' },
  { id: 'clubs', path: '/clubs', label: 'Clubs d’Aventuriers Mobile', cat: 'Communauté' },
  { id: 'club-nouveau', path: '/clubs/nouveau', label: 'Créer un Club Mobile', cat: 'Communauté' },
  { id: 'club-detail', path: '/clubs/b2000012-0000-0000-0000-000000000005', label: 'Club Détail Mobile', cat: 'Communauté' },
  { id: 'nouveau-groupe', path: '/nouveau-groupe', label: 'Nouveau Groupe Mobile', cat: 'Communauté' },
  { id: 'entraide', path: '/entraide', label: 'Entraide & SOS Mobile', cat: 'Communauté' },
  { id: 'evenements', path: '/evenements', label: 'Événements Mobile', cat: 'Communauté' },
  { id: 'avis', path: '/avis', label: 'Avis Voyageurs Mobile', cat: 'Communauté' },
  { id: 'publier', path: '/publier', label: 'Portail Publier Mobile', cat: 'Communauté' },

  // ── 6. Outils & Calculateurs Randonnée ────────────────────────────────────
  { id: 'outils', path: '/outils', label: 'Boîte à Outils Mobile', cat: 'Outils' },
  { id: 'outil-poids-sac', path: '/outils/poids-sac', label: 'Simulateur Poids Sac Mobile', cat: 'Outils' },
  { id: 'outil-budget', path: '/outils/budget-voyage', label: 'Simulateur Budget Mobile', cat: 'Outils' },
  { id: 'outil-convertisseur', path: '/outils/convertisseur', label: 'Convertisseur Devises Mobile', cat: 'Outils' },
  { id: 'outil-checklist', path: '/outils/checklist', label: 'Checklist Dynamique Mobile', cat: 'Outils' },
  { id: 'outil-tailles', path: '/outils/tailles', label: 'Guide des Tailles Mobile', cat: 'Outils' },
  { id: 'outil-fuseaux', path: '/outils/fuseaux', label: 'Fuseaux Horaires Mobile', cat: 'Outils' },
  { id: 'outil-boussole', path: '/outils/boussole', label: 'Boussole Mobile', cat: 'Outils' },
  { id: 'outil-chronometre', path: '/outils/chronometre', label: 'Chronomètre Mobile', cat: 'Outils' },
  { id: 'outil-rations', path: '/outils/rations', label: 'Calculateur Rations Mobile', cat: 'Outils' },
  { id: 'carbone', path: '/carbone', label: 'Calculateur Carbone Mobile', cat: 'Outils' },

  // ── 7. Compte Utilisateur, Gamification & Messagerie ───────────────────────
  { id: 'compte', path: '/compte', label: 'Mon Compte Mobile', cat: 'Utilisateur' },
  { id: 'compte-modifier', path: '/compte/modifier', label: 'Modifier Profil Mobile', cat: 'Utilisateur' },
  { id: 'compte-user-redirect', path: '/compte/622c9c69-2b19-425c-be5f-d47d470461d8', label: 'Compte Redirection ID', cat: 'Utilisateur' },
  { id: 'profil-public', path: '/profil', label: 'Profil Public Mobile', cat: 'Utilisateur' },
  { id: 'profil-detail', path: '/profil/622c9c69-2b19-425c-be5f-d47d470461d8', label: 'Profil Détail Mobile', cat: 'Utilisateur' },
  { id: 'progression', path: '/progression', label: 'Progression & Niveaux Mobile', cat: 'Utilisateur' },
  { id: 'fidelite', path: '/fidelite', label: 'Fidélité & Badges Mobile', cat: 'Utilisateur' },
  { id: 'recompenses', path: '/recompenses', label: 'Récompenses Mobile', cat: 'Utilisateur' },
  { id: 'messagerie', path: '/messagerie', label: 'Messagerie Mobile', cat: 'Utilisateur' },
  { id: 'connexion', path: '/connexion', label: 'Connexion Mobile', cat: 'Utilisateur' },
  { id: 'inscription', path: '/inscription', label: 'Inscription Mobile', cat: 'Utilisateur' },

  // ── 8. Voyages Partagés & Coéquipiers ──────────────────────────────────────
  { id: 'voyage-y-long-group', path: '/voyages/y-long-group', label: 'Voyage TMB Groupe Mobile', cat: 'Voyages' },
  { id: 'voyage-section-itineraire', path: '/voyages/y-long-group/itineraire', label: 'Itinéraire Voyage Mobile', cat: 'Voyages' },
  { id: 'voyage-section-budget', path: '/voyages/y-long-group/budget', label: 'Budget Voyage Mobile', cat: 'Voyages' },
  { id: 'voyage-section-groupe', path: '/voyages/y-long-group/groupe', label: 'Équipage Voyage Mobile', cat: 'Voyages' },
  { id: 'voyage-section-securite', path: '/voyages/y-long-group/securite', label: 'Sécurité Voyage Mobile', cat: 'Voyages' },
  { id: 'rejoindre-voyage', path: '/rejoindre/y-long-group', label: 'Rejoindre Voyage Mobile', cat: 'Voyages' },

  // ── 9. Guides, Blog & Contenu ─────────────────────────────────────────────
  { id: 'guides', path: '/guides', label: 'Guides Pratiques Mobile', cat: 'Contenu' },
  { id: 'guide-detail', path: '/guides/checklist-sac-a-dos-trek-nepal', label: 'Guide Détail Mobile', cat: 'Contenu' },
  { id: 'blog', path: '/blog', label: 'Blog Outdoor Mobile', cat: 'Contenu' },
  { id: 'manifeste', path: '/manifeste', label: 'Manifeste LKDV Mobile', cat: 'Contenu' },
  { id: 'experts', path: '/experts', label: 'Experts & Guides Mobile', cat: 'Contenu' },
  { id: 'ambassadeurs', path: '/ambassadeurs', label: 'Ambassadeurs Mobile', cat: 'Contenu' },
  { id: 'createurs', path: '/createurs', label: 'Créateurs Mobile', cat: 'Contenu' },
  { id: 'pro', path: '/pro', label: 'Pro Mobile', cat: 'Contenu' },
  { id: 'faq', path: '/faq', label: 'FAQ Mobile', cat: 'Contenu' },
  { id: 'contact', path: '/contact', label: 'Contact Mobile', cat: 'Contenu' },

  // ── 10. Administration & Développement ───────────────────────────────────
  { id: 'admin', path: '/admin', label: 'Admin Dashboard Mobile', cat: 'Admin' },
  { id: 'admin-produits', path: '/admin/produits', label: 'Admin Produits Mobile', cat: 'Admin' },
  { id: 'dev-glass', path: '/dev/glass', label: 'Showcase Liquid Glass Mobile', cat: 'Design System' },
  { id: 'dev-style', path: '/dev/style', label: 'Style Guide Mobile', cat: 'Design System' },

  // ── 11. Juridique, Offline & Système ─────────────────────────────────────
  { id: 'mentions-legales', path: '/mentions-legales', label: 'Mentions Légales Mobile', cat: 'Légal' },
  { id: 'cgv', path: '/cgv', label: 'CGV Mobile', cat: 'Légal' },
  { id: 'cgu', path: '/cgu', label: 'CGU Mobile', cat: 'Légal' },
  { id: 'politique-confidentialite', path: '/politique-confidentialite', label: 'Confidentialité Mobile', cat: 'Légal' },
  { id: 'cookies', path: '/cookies', label: 'Cookies Mobile', cat: 'Légal' },
  { id: 'hors-ligne', path: '/hors-ligne', label: 'Mode Hors-Ligne Mobile', cat: 'Système' },
  { id: 'page-404', path: '/page-introuvable-404', label: 'Page 404 Mobile', cat: 'Système' },
];

async function captureAllPagesMobile() {
  console.log(`=======================================================`);
  console.log(`📱 CAPTURE VISUELLE MOBILE (iPhone 14/15/16 Pro) — ${ALL_ROUTES.length} PAGES`);
  console.log(`=======================================================\n`);

  const authCookie = await getAuthCookie();
  const adventureCookie = getAdventureCookie();

  const browser = await chromium.launch({
    headless: true,
  });

  // Emulation iPhone 14/15 Pro : 393 x 852 px, touch enabled, retina DPR=2
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    colorScheme: 'light',
    locale: 'fr-FR',
  });

  const cookiesToAdd = [adventureCookie];
  if (authCookie) cookiesToAdd.push(authCookie);
  await context.addCookies(cookiesToAdd);

  const page = await context.newPage();

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
    const filename = `${indexStr}_${r.id}_mobile.png`;
    const fullPath = path.join(outDir, filename);
    const targetUrl = `http://localhost:4000${r.path}`;

    process.stdout.write(`[${i + 1}/${ALL_ROUTES.length}] 📱 ${r.label} (${r.path}) ... `);
    const itemStart = Date.now();

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });

      await page.waitForSelector('main, .max-w-4xl, [role="main"], body', { timeout: 10000 }).catch(() => {});
      await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
      await page.waitForSelector('[class*="animate-pulse"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
      await page.waitForSelector('[aria-busy="true"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

      await Promise.race([
        page.evaluate(() => document.fonts.ready),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]).catch(() => {});

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
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {});

      // Masquage dev toast, scrollbars et transitions
      await page.addStyleTag({
        content: `
          nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          * { scrollbar-width: none !important; }
          *, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; }
        `,
      });

      await page.waitForTimeout(600);

      // Screenshot pleine page mobile
      await page.screenshot({
        path: fullPath,
        fullPage: true,
      });

      const stat = fs.statSync(fullPath);
      const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1);
      const sizeKo = Math.round(stat.size / 1024);

      console.log(`✓ OK (${sizeKo} Ko, ${elapsed}s)`);
      results.push({
        ...r,
        index: i + 1,
        filename,
        fileSize: stat.size,
        status: 'OK',
        duration: elapsed,
      });
    } catch (err) {
      console.log(`⚠️ ERREUR: ${err.message}`);
      try {
        await page.screenshot({ path: fullPath, fullPage: false });
        const stat = fs.statSync(fullPath);
        results.push({
          ...r,
          index: i + 1,
          filename,
          fileSize: stat.size,
          status: 'PARTIAL',
          duration: ((Date.now() - itemStart) / 1000).toFixed(1),
          error: err.message,
        });
      } catch (err2) {
        results.push({
          ...r,
          index: i + 1,
          filename: null,
          status: 'FAILED',
          error: err.message,
        });
      }
    }
  }

  await browser.close();

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=======================================================`);
  console.log(`🎉 TOUTES LES CAPTURES MOBILES SONT TERMINÉES EN ${totalTime}s !`);
  console.log(`Total capturé: ${results.filter((r) => r.status === 'OK' || r.status === 'PARTIAL').length}/${ALL_ROUTES.length}`);
  console.log(`Dossier: ${outDir}`);
  console.log(`=======================================================\n`);

  generateMobileGalleryHtml(results, totalTime);
}

function generateMobileGalleryHtml(results, totalTime) {
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
        <div class="mobile-card" data-cat="${item.cat}" data-title="${item.label.toLowerCase()}" data-path="${item.path.toLowerCase()}">
          <div class="mobile-frame">
            <div class="notch"></div>
            <a href="${item.filename}" target="_blank" class="img-link" title="Agrandir en taille réelle">
              <img src="${item.filename}" loading="lazy" alt="${item.label}">
              <div class="zoom-badge">🔍 Ouvrir</div>
            </a>
          </div>
          <div class="card-meta">
            <div class="top-row">
              <span class="idx">#${String(item.index).padStart(3, '0')}</span>
              <span class="size">${ko} Ko</span>
            </div>
            <h3 class="label">${item.label}</h3>
            <code>${item.path}</code>
          </div>
        </div>`;
        })
        .join('\n');

      return `
      <section class="category-block" id="cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
        <div class="category-header">
          <h2>${cat}</h2>
          <span class="count">${items.length} écran(s) mobile</span>
        </div>
        <div class="mobile-grid">
          ${cards}
        </div>
      </section>`;
    })
    .join('\n');

  const navFilters = categories
    .map((c) => `<button class="filter-btn" data-filter="${c}">${c}</button>`)
    .join('\n');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LKDV — Galerie Visuelle 100% Mobile (iPhone 14/15/16 Pro)</title>
  <style>
    :root {
      --bg: #090B0A;
      --card-bg: #121614;
      --border: rgba(255, 255, 255, 0.08);
      --accent: #34C759;
      --text: #F2F5F3;
      --text-sub: #7E8C83;
      --font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      -webkit-font-smoothing: antialiased;
    }
    header {
      background: rgba(18, 22, 20, 0.9);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 18px 28px;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .badge-ios {
      background: rgba(52, 199, 89, 0.15);
      color: var(--accent);
      border: 1px solid rgba(52, 199, 89, 0.35);
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .stats {
      display: flex;
      gap: 18px;
      font-size: 13px;
      color: var(--text-sub);
    }
    .stats strong { color: var(--text); }
    .toolbar {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-box {
      background: #1B211E;
      border: 1px solid var(--border);
      color: #fff;
      padding: 8px 14px;
      border-radius: 9px;
      font-size: 13px;
      width: 260px;
      outline: none;
    }
    .search-box:focus { border-color: var(--accent); }
    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text-sub);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
    }
    .filter-btn:hover { color: #fff; background: #1B211E; }
    .filter-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      font-weight: 600;
    }
    main {
      max-width: 1700px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .category-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin: 36px 0 20px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .category-header h2 { font-size: 18px; font-weight: 700; }
    .category-header .count { color: var(--text-sub); font-size: 12px; }
    .mobile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 28px 20px;
    }
    .mobile-card {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .mobile-frame {
      width: 280px;
      height: 520px;
      border: 6px solid #28302C;
      border-radius: 40px;
      background: #000;
      overflow: hidden;
      position: relative;
      box-shadow: 0 16px 36px rgba(0,0,0,0.6);
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .mobile-frame:hover {
      transform: translateY(-6px);
      border-color: #3D4A43;
      box-shadow: 0 22px 48px rgba(0,0,0,0.8);
    }
    .notch {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 72px;
      height: 18px;
      background: #000;
      border-radius: 12px;
      z-index: 10;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
    }
    .img-link {
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      cursor: zoom-in;
      position: relative;
    }
    .img-link img {
      width: 100%;
      display: block;
    }
    .zoom-badge {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 999px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .mobile-frame:hover .zoom-badge { opacity: 1; }
    .card-meta {
      width: 280px;
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-sub);
      font-family: ui-monospace, monospace;
    }
    .top-row .idx { color: var(--accent); font-weight: 700; }
    .label {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta code {
      font-size: 11px;
      color: var(--text-sub);
      font-family: ui-monospace, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <header>
    <div class="top-bar">
      <div class="brand">
        <h1>LKDV Mobile Showcase</h1>
        <span class="badge-ios">iPhone 14/15/16 Pro · 393 × 852</span>
      </div>
      <div class="stats">
        <span><strong>${totalScreenshots}</strong> écrans</span>
        <span>Poids : <strong>${totalSizeMo} Mo</strong></span>
        <span>Durée : <strong>${totalTime}s</strong></span>
      </div>
    </div>
    <div class="toolbar">
      <input type="text" id="searchBox" class="search-box" placeholder="Filtrer une page mobile (/hub, /materiel)...">
      <button class="filter-btn active" data-filter="all">Tous (${totalScreenshots})</button>
      ${navFilters}
    </div>
  </header>

  <main>
    ${sectionsHtml}
  </main>

  <script>
    const searchBox = document.getElementById('searchBox');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.mobile-card');
    const sections = document.querySelectorAll('.category-block');

    function filterAll() {
      const q = searchBox.value.toLowerCase().trim();
      const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

      sections.forEach(sec => {
        let visibleCount = 0;
        const secCards = sec.querySelectorAll('.mobile-card');
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

    searchBox.addEventListener('input', filterAll);

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterAll();
      });
    });
  </script>
</body>
</html>`;

  const htmlPath = path.join(outDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✓ Galerie Mobile HTML générée : ${htmlPath}`);

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`✓ Manifeste Mobile JSON généré : ${manifestPath}`);
}

captureAllPagesMobile().catch(console.error);
