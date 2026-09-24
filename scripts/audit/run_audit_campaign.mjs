import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createServerClient } from '@supabase/ssr';

const BASE_URL = 'http://localhost:3000';
const screensDir = path.resolve('audit', 'screens');
const a11yDir = path.resolve('audit', 'a11y');

fs.mkdirSync(screensDir, { recursive: true });
fs.mkdirSync(a11yDir, { recursive: true });

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
    // Auth démo fallback
  }
  return null;
}

function getAdventureCookie(slug = 'y-long-group') {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify({ nature: 'sortie', id: slug, slug, title: slug })).toString('base64url'),
    domain: 'localhost',
    path: '/',
  };
}

// 70 routes canoniques
const ROUTES = [
  { id: 'accueil', path: '/', label: 'Accueil' },
  { id: 'hub', path: '/hub', label: 'Hub Cockpit' },
  { id: 'hub-nouveau', path: '/hub/nouveau', label: 'Hub Nouveau' },
  { id: 'hub-itineraire', path: '/hub/itineraire', label: 'Hub Itinéraire' },
  { id: 'hub-budget', path: '/hub/budget', label: 'Hub Budget' },
  { id: 'hub-groupe', path: '/hub/groupe', label: 'Hub Équipage' },
  { id: 'hub-securite', path: '/hub/securite', label: 'Hub Sécurité' },
  { id: 'hub-materiel', path: '/hub/materiel', label: 'Hub Matériel' },
  { id: 'hub-documents', path: '/hub/documents', label: 'Hub Documents' },
  { id: 'explorer', path: '/explorer', label: 'Explorer' },
  { id: 'carte-interactive', path: '/carte-interactive', label: 'Carte Interactive' },
  { id: 'randonnee-active', path: '/randonnee-active', label: 'Randonnée Active' },
  { id: 'rapport-expedition', path: '/rapport-expedition', label: 'Rapport Expédition' },
  { id: 'materiel', path: '/materiel', label: 'Matériel' },
  { id: 'kits', path: '/kits', label: 'Catalogue Kits' },
  { id: 'kit-islande', path: '/kits/islande-trek', label: 'Kit Islande' },
  { id: 'kit-gr20', path: '/kits/gr20-corse', label: 'Kit GR20' },
  { id: 'kit-vanlife', path: '/kits/vanlife-europe', label: 'Kit Vanlife' },
  { id: 'ai-configurator', path: '/ai-configurator', label: 'Configurateur IA' },
  { id: 'copilote', path: '/copilote', label: 'Copilote IA' },
  { id: 'boutique', path: '/boutique', label: 'Boutique' },
  { id: 'produit-detail', path: '/produit/sac-a-dos-de-randonnee-categorie-bigbuy', label: 'Fiche Produit' },
  { id: 'occasion', path: '/occasion', label: 'Occasion' },
  { id: 'location', path: '/location', label: 'Location' },
  { id: 'panier', path: '/panier', label: 'Panier' },
  { id: 'checkout', path: '/checkout', label: 'Checkout' },
  { id: 'abonnements', path: '/abonnements', label: 'Abonnements' },
  { id: 'pays-fr', path: '/pays/fr', label: 'Pays France' },
  { id: 'pays-is', path: '/pays/is', label: 'Pays Islande' },
  { id: 'lieux', path: '/lieux', label: 'Lieux' },
  { id: 'preparer-randonnee', path: '/preparer-randonnee', label: 'Préparer Randonnée' },
  { id: 'communaute', path: '/communaute', label: 'Communauté' },
  { id: 'communaute-publier', path: '/communaute/publier', label: 'Publier' },
  { id: 'communaute-pro', path: '/communaute-pro', label: 'Communauté Pro' },
  { id: 'feed', path: '/feed', label: 'Fil Actualités' },
  { id: 'carnets', path: '/carnets', label: 'Carnets' },
  { id: 'clubs', path: '/clubs', label: 'Clubs' },
  { id: 'entraide', path: '/entraide', label: 'Entraide' },
  { id: 'evenements', path: '/evenements', label: 'Événements' },
  { id: 'avis', path: '/avis', label: 'Avis' },
  { id: 'outils', path: '/outils', label: 'Hub Outils' },
  { id: 'outil-poids-sac', path: '/outils/poids-sac', label: 'Outil Poids' },
  { id: 'outil-budget', path: '/outils/budget', label: 'Outil Budget' },
  { id: 'outil-convertisseur', path: '/outils/convertisseur', label: 'Convertisseur' },
  { id: 'outil-checklist', path: '/outils/checklist', label: 'Checklist' },
  { id: 'carbone', path: '/carbone', label: 'Carbone' },
  { id: 'compte', path: '/compte', label: 'Compte' },
  { id: 'compte-modifier', path: '/compte/modifier', label: 'Modifier Profil' },
  { id: 'profil-public', path: '/profil', label: 'Profil Public' },
  { id: 'progression', path: '/progression', label: 'Progression' },
  { id: 'fidelite', path: '/fidelite', label: 'Fidélité' },
  { id: 'recompenses', path: '/recompenses', label: 'Récompenses' },
  { id: 'messagerie', path: '/messagerie', label: 'Messagerie' },
  { id: 'connexion', path: '/connexion', label: 'Connexion' },
  { id: 'inscription', path: '/inscription', label: 'Inscription' },
  { id: 'guides', path: '/guides', label: 'Guides' },
  { id: 'blog', path: '/blog', label: 'Blog' },
  { id: 'manifeste', path: '/manifeste', label: 'Manifeste' },
  { id: 'faq', path: '/faq', label: 'FAQ' },
  { id: 'contact', path: '/contact', label: 'Contact' },
  { id: 'admin', path: '/admin', label: 'Admin' },
  { id: 'admin-produits', path: '/admin/produits', label: 'Admin Produits' },
  { id: 'dev-glass', path: '/dev/glass', label: 'Showcase Glass' },
  { id: 'dev-style', path: '/dev/style', label: 'Showcase Style' },
  { id: 'mentions-legales', path: '/mentions-legales', label: 'Mentions Légales' },
  { id: 'cgv', path: '/cgv', label: 'CGV' },
  { id: 'cgu', path: '/cgu', label: 'CGU' },
  { id: 'cookies', path: '/cookies', label: 'Cookies' },
  { id: 'hors-ligne', path: '/hors-ligne', label: 'Hors-Ligne' },
  { id: 'page-404', path: '/route-inexistante-pour-tester-404', label: '404' },
];

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1440x900', width: 1440, height: 900 },
];

function srgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function analyzeContrast(imageBuffer, textElements, width, height) {
  const { data, info } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const issues = [];

  for (const el of textElements) {
    const { x, y, width: elW, height: elH, color, text, selector, isLarge } = el;
    if (elW <= 0 || elH <= 0 || x + elW < 0 || y + elH < 0 || x >= width || y >= height) continue;

    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgbMatch) continue;
    const textR = parseInt(rgbMatch[1], 10);
    const textG = parseInt(rgbMatch[2], 10);
    const textB = parseInt(rgbMatch[3], 10);
    const textLum = relativeLuminance(textR, textG, textB);

    // Échantillonner 9 points dans la bounding box
    const samplePoints = [
      { px: x + 2, py: y + 2 },
      { px: x + elW / 2, py: y + 2 },
      { px: x + elW - 2, py: y + 2 },
      { px: x + 2, py: y + elH / 2 },
      { px: x + elW / 2, py: y + elH / 2 },
      { px: x + elW - 2, py: y + elH / 2 },
      { px: x + 2, py: y + elH - 2 },
      { px: x + elW / 2, py: y + elH - 2 },
      { px: x + elW - 2, py: y + elH - 2 },
    ];

    let worstRatio = 21;
    let worstBg = null;

    for (const pt of samplePoints) {
      const clampX = Math.min(Math.max(Math.floor(pt.px), 0), width - 1);
      const clampY = Math.min(Math.max(Math.floor(pt.py), 0), height - 1);
      const idx = (clampY * width + clampX) * channels;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const bgLum = relativeLuminance(r, g, b);
      const ratio = contrastRatio(textLum, bgLum);

      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstBg = `rgb(${r}, ${g}, ${b})`;
      }
    }

    const minRatio = isLarge ? 3.0 : 4.5;
    if (worstRatio < minRatio) {
      issues.push({
        selector,
        text: text.slice(0, 40),
        textColor: `rgb(${textR}, ${textG}, ${textB})`,
        worstBg,
        ratio: worstRatio.toFixed(2),
        minRatio,
      });
    }
  }

  return issues;
}

async function run() {
  console.log('🚀 Lancement de la campagne de captures, Axe A11y et Mesure de Contraste...');
  const authCookie = await getAuthCookie();
  const advCookie = getAdventureCookie();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const manifest = [];
  const a11ySummary = {};
  const contrastIssuesByRoute = {};
  let totalScreenshots = 0;
  let totalTextsAnalyzed = 0;

  for (const r of ROUTES) {
    const routeDir = path.join(screensDir, r.id);
    fs.mkdirSync(routeDir, { recursive: true });

    console.log(`\n📸 [Route] ${r.label} (${r.path})`);

    // 1. Audit Axe-core sur mobile
    try {
      const a11yCtx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        locale: 'fr-FR',
      });
      if (authCookie) await a11yCtx.addCookies([authCookie, advCookie]);
      else await a11yCtx.addCookies([advCookie]);

      const a11yPage = await a11yCtx.newPage();
      await a11yPage.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await a11yPage.waitForTimeout(600);

      const axeResults = await new AxeBuilder({ page: a11yPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const seriousCount = axeResults.violations.filter(v => v.impact === 'serious').length;
      const criticalCount = axeResults.violations.filter(v => v.impact === 'critical').length;

      fs.writeFileSync(path.join(a11yDir, `${r.id}.json`), JSON.stringify({
        route: r.path,
        id: r.id,
        timestamp: new Date().toISOString(),
        violationsCount: axeResults.violations.length,
        seriousCount,
        criticalCount,
        violations: axeResults.violations,
      }, null, 2));

      a11ySummary[r.id] = {
        label: r.label,
        path: r.path,
        totalViolations: axeResults.violations.length,
        serious: seriousCount,
        critical: criticalCount,
      };

      await a11yCtx.close();
    } catch (err) {
      console.warn(`  ⚠️ A11y error on ${r.id}:`, err.message);
      a11ySummary[r.id] = { label: r.label, path: r.path, totalViolations: 0, serious: 0, critical: 0, error: err.message };
    }

    // 2. Captures par Viewport et Thème
    for (const vp of VIEWPORTS) {
      for (const theme of ['dark', 'light']) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
          locale: 'fr-FR',
        });
        const cookies = [advCookie];
        if (authCookie) cookies.push(authCookie);
        await ctx.addCookies(cookies);

        const page = await ctx.newPage();

        await page.addInitScript((t) => {
          localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }));
          document.documentElement.setAttribute('data-theme', t);
          if (t === 'dark') document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }, theme);

        try {
          await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(500);

          // État 1: DEFAULT
          const defaultName = `${vp.name}-${theme}-default.png`;
          const defaultPath = path.join(routeDir, defaultName);
          const defaultBuf = await page.screenshot({ path: defaultPath, fullPage: false });
          totalScreenshots++;
          manifest.push({ route: r.id, file: defaultName });

          // Mesure du contraste pire-pixel sur mobile dark default
          if (vp.name === '390x844' && theme === 'dark') {
            const textNodes = await page.evaluate(() => {
              const nodes = [];
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
              let el;
              while ((el = walker.nextNode())) {
                const tag = el.tagName.toLowerCase();
                if (['script', 'style', 'svg', 'path', 'noscript'].includes(tag)) continue;
                if (!['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'li', 'td', 'th'].includes(tag)) continue;

                const text = el.innerText?.trim();
                if (!text || text.length === 0) continue;
                // Ignorer si enfants contiennent eux-mêmes du texte (pour éviter double compte)
                if (el.children.length > 0 && Array.from(el.children).some(c => c.innerText?.trim()?.length > 0)) continue;

                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) continue;

                const fontSize = parseFloat(style.fontSize) || 16;
                const fontWeight = parseInt(style.fontWeight, 10) || 400;
                const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

                let sel = tag;
                if (el.id) sel += `#${el.id}`;
                else if (el.className && typeof el.className === 'string') {
                  const firstCls = el.className.split(' ').filter(c => c && !c.includes(':'))[0];
                  if (firstCls) sel += `.${firstCls}`;
                }

                nodes.push({
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  color: style.color,
                  text: text.slice(0, 50),
                  selector: sel,
                  isLarge,
                });
              }
              return nodes;
            });

            totalTextsAnalyzed += textNodes.length;
            const routeIssues = await analyzeContrast(defaultBuf, textNodes, vp.width, vp.height);
            if (routeIssues.length > 0) {
              contrastIssuesByRoute[r.id] = routeIssues;
            }
          }

          // État 2: SCROLL-END
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(300);
          const scrollName = `${vp.name}-${theme}-scroll-end.png`;
          const scrollPath = path.join(routeDir, scrollName);
          await page.screenshot({ path: scrollPath, fullPage: false });
          totalScreenshots++;
          manifest.push({ route: r.id, file: scrollName });

          // État 3: MODALES (si modal trigger disponible ou sur pages spécifiques)
          const modalTrigger = await page.$('button[aria-haspopup="dialog"], [data-search-trigger], button[aria-expanded="false"]');
          if (modalTrigger) {
            try {
              await modalTrigger.click({ timeout: 1000 });
              await page.waitForTimeout(300);
              const modalName = `${vp.name}-${theme}-modal.png`;
              const modalPath = path.join(routeDir, modalName);
              await page.screenshot({ path: modalPath, fullPage: false });
              totalScreenshots++;
              manifest.push({ route: r.id, file: modalName });
            } catch {
              // ignore si le clic modal n'a pas pu être déclenché
            }
          }
        } catch (err) {
          console.warn(`  ⚠️ Screenshot error ${r.id} (${vp.name} ${theme}):`, err.message);
        } finally {
          await ctx.close();
        }
      }
    }
  }

  await browser.close();

  // Écriture du manifest
  fs.writeFileSync(path.join(screensDir, 'manifest.json'), JSON.stringify({
    totalCaptures: totalScreenshots,
    timestamp: new Date().toISOString(),
    manifest,
  }, null, 2));

  // Écriture de la synthèse a11y
  fs.writeFileSync(path.join(a11yDir, 'summary.json'), JSON.stringify(a11ySummary, null, 2));

  // Écriture de audit/CONTRASTE.md
  let contrasteMd = `# Audit de Contraste Mesuré (Pire Ratio sur Captures Réelles)\n\n`;
  contrasteMd += `**Date :** ${new Date().toISOString()}  \n`;
  contrasteMd += `**Méthodologie :** Échantillonnage pixel par pixel sous chaque nœud texte dans sa boîte englobante (9 points de test par texte) sur les captures mobiles réelles.\n\n`;
  contrasteMd += `**Total nœuds texte analysés :** ${totalTextsAnalyzed}  \n`;

  const routesWithIssues = Object.keys(contrastIssuesByRoute);
  const totalIssues = Object.values(contrastIssuesByRoute).reduce((sum, list) => sum + list.length, 0);

  contrasteMd += `**Total textes sous le seuil WCAG (< 4.5:1 ou < 3.0:1 pour texte large) :** ${totalIssues}  \n`;
  const complianceRate = totalTextsAnalyzed > 0 ? (((totalTextsAnalyzed - totalIssues) / totalTextsAnalyzed) * 100).toFixed(1) : 100;
  contrasteMd += `**Taux de conformité contraste mesuré :** ${complianceRate}%\n\n---\n\n`;

  contrasteMd += `## Tableau des Textes Présentant un Ratio < 4.5:1\n\n`;
  contrasteMd += `| Route | Sélecteur | Aperçu Texte | Couleur Texte | Fond Pire Pixel | Ratio Mesuré | Seuil Requis |\n`;
  contrasteMd += `|:---|:---|:---|:---|:---|:---:|:---:|\n`;

  if (routesWithIssues.length === 0) {
    contrasteMd += `| - | - | *Aucun texte sous le seuil* | - | - | - | - |\n`;
  } else {
    for (const [routeId, issues] of Object.entries(contrastIssuesByRoute)) {
      for (const issue of issues) {
        contrasteMd += `| \`${routeId}\` | \`${issue.selector}\` | ${issue.text.replace(/\|/g, '/')} | \`${issue.textColor}\` | \`${issue.worstBg}\` | **${issue.ratio}:1** | ${issue.minRatio}:1 |\n`;
      }
    }
  }

  fs.writeFileSync(path.resolve('audit', 'CONTRASTE.md'), contrasteMd);

  console.log(`\n🎉 Campagne terminée avec succès :`);
  console.log(`- ${totalScreenshots} PNG capturés dans audit/screens/`);
  console.log(`- ${ROUTES.length} rapports d'accessibilité créés dans audit/a11y/`);
  console.log(`- audit/CONTRASTE.md généré avec ${totalTextsAnalyzed} textes inspectés et ${totalIssues} écarts répertoriés.`);
}

run().catch((e) => {
  console.error('Fatal error in campaign runner:', e);
  process.exit(1);
});
