#!/usr/bin/env node
/*
 * Tournage LKDV, en lecture seule : captures 3×, tiroirs et gestes enregistrés,
 * sur l'app locale lancée depuis le dernier `main`.
 *
 * Usage (depuis la racine du dépôt, l'app tournant sur BASE_URL) :
 *   node video/presentation-complete/tools/capture/tournage.cjs verifier
 *   PWFILE=/hors-depot/mdp.txt node …/tournage.cjs connexion
 *   node …/tournage.cjs decouverte [route …]   → assets/shoot/decouverte/<route>/NN-*.png + carte.json
 *   node …/tournage.cjs plans [id …]            → assets/shoot/plans/<id>.png (+ découpes)
 *   node …/tournage.cjs gestes [id …]           → assets/shoot/gestes/<id>/ (images horodatées, meta.json, marks.json)
 *   node …/tournage.cjs tout                    → verifier, decouverte, plans, gestes
 *
 * Variables :
 *   BASE_URL     http://localhost:3000
 *   APP_DIR      dossier git de l'app servie (défaut : dossier courant). Doit être au dernier origin/main.
 *   SHOOT_DIR    défaut : video/presentation-complete/assets/shoot
 *   CHROME_PATH  navigateur à utiliser (sinon le Chromium de Playwright)
 *   SCALE=3      échelle des captures (393×852 → 1179×2556)
 *   REC_SCALE=2  échelle des enregistrements de gestes
 *   MAX1=24 MAX2=8  nombre maximal de déclencheurs explorés par page et par tiroir
 *   HEADFUL=1    voir le navigateur
 *   FORCE=1      tourner même si l'app n'est pas au dernier main (déconseillé)
 *
 * Sécurité : aucune écriture n'atteint la base.
 *   - Les requêtes Supabase PATCH/PUT/DELETE, les POST d'insertion et les RPC d'écriture sont bloqués.
 *   - Les actions serveur Next.js sont bloquées après le chargement de la page, sauf dans les étapes
 *     marquées `lecture` (tiroirs qui chargent leurs données par une action serveur).
 *   - La découverte ne clique jamais un bouton dont le nom évoque une écriture (liste INTERDIT),
 *     ni une case, un interrupteur, un champ, un lien externe ou un bouton d'envoi.
 *   - Tout ce qui est bloqué est écrit dans journal.txt.
 */
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..'); // video/presentation-complete
const SHOOT = process.env.SHOOT_DIR || path.join(ROOT, 'assets', 'shoot');
const STATE = process.env.LKDV_STATE || path.join(HERE, '.session', 'state.json');
const SCALE = Number(process.env.SCALE || 3);
const REC_SCALE = Number(process.env.REC_SCALE || 2);
const MAX1 = Number(process.env.MAX1 || 24);
const MAX2 = Number(process.env.MAX2 || 8);
const VIEW = { width: 393, height: 852 };

// ───────────────────────────── journal ─────────────────────────────
const LOG = [];
const log = (...a) => {
  const line = a.join(' ');
  LOG.push(new Date().toISOString().slice(11, 19) + ' ' + line);
  console.log(line);
};
const writeLog = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'journal.txt'), LOG.splice(0).join('\n') + '\n');
};
const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'x';

// ───────────────────────────── garde-fous ─────────────────────────────
// Noms de boutons jamais cliqués en découverte (une écriture, une sortie ou un appel).
const INTERDIT = new RegExp(
  [
    'publi', 'envoy', 'supprim', 'effac', 'retir', 'valid', 'confirm', 'enregistr', 'sauvegard',
    'pr[ée]par', 'r[ée]adapt', 'd[ée]marr', 'lancer', 'commencer', 'arr[êe]t', 'termin', '\\bsos\\b',
    'urgence', 'secours', 'appeler', 'signal', 'bloqu', 'quitter', 'd[ée]connex', 'payer', 'achet',
    'command', 'panier', 'ajout', 'cr[ée]er', 'nouvea', 'invit', 'rejoin', '\\bsuivre\\b', 'abonn',
    "j.aime", 'r[ée]agi', 'partag', 'r[ée]voq', 'accept', 'refus', 'archiv', 'dupliq', 'fork',
    'import', 'export', 't[ée]l[ée]charg', 'copier', 'g[ée]n[ée]rer', '\\bactiver\\b', 'd[ée]sactiv',
    'connecter', 'associer', 'r[ée]serv', 'inscri', 'particip', 'voter', '\\bnoter\\b', '\\bcommenter\\b',
    'r[ée]pondre', 'transf[ée]r', 'soumet', 'modifi', '[ée]diter', 'renomm', 'r[ée]initialis',
    '\\bvider\\b', 'coch', 'scann', 'cam[ée]ra', 'micro', 'mot de passe', 'e-mail', 'masquer',
    'retirer', 'quitter', 'oublier', 'd[ée]poser', 'poser un', 'marquer', 'synchronis', 'importer',
    'choisir cette', 'souscri', 'essai gratuit', 'essayer', 'checkout', 'devis', 'contacter',
  ].join('|'),
  'i'
);
// Pour un onglet (simple changement de vue), seuls les mots les plus dangereux restent interdits.
const INTERDIT_ONGLET = /(\bsos\b|supprim|publi|envoy|payer|achet|partager ma position)/i;
// RPC Supabase d'écriture : bloquées. Les autres (lectures) passent.
const RPC_ECRITURE =
  /(insert|create|add_|_add|update|upsert|set_|delete|remove|increment|record|log_|track|mark_|publish|send|join|leave|follow|like|react|invite|accept|decline|start|stop|end_|finali|claim|redeem|grant|revoke|toggle|save|submit|report|block|archive|restore|move|rename|reorder|assign|sync|touch|bump|register|enqueue|consume|award|earn|spend|purchase|checkout|pay|fork|vote|rate|upload|attach|detach|close|open_|reset|clear|seed|import|refresh_)/i;

/** Installe le filtre réseau sur un contexte. `etat.lecture` autorise les actions serveur. */
async function proteger(ctx, etat) {
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const m = req.method();
    const u = req.url();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (u.startsWith(BASE + '/_next/') || u.startsWith(BASE + '/__nextjs')) return route.continue();
    if (/supabase\.co/.test(u)) {
      if (/\/auth\/v1\/token/.test(u)) return route.continue(); // connexion et rafraîchissement de session
      const rpc = u.match(/\/rest\/v1\/rpc\/([\w]+)/);
      if (rpc && m === 'POST' && !RPC_ECRITURE.test(rpc[1])) return route.continue();
      log('  ⛔ bloqué (Supabase)', m, u.replace(/\?.*$/, ''));
      return route.abort('blockedbyclient');
    }
    const h = req.headers();
    if (h['next-action']) {
      if (etat.chargement || etat.lecture || process.env.ALLOW_ACTIONS === '1') {
        log('  · action serveur autorisée', etat.chargement ? '(chargement)' : '(lecture)', u.replace(BASE, ''));
        return route.continue();
      }
      log('  ⛔ bloqué (action serveur)', u.replace(BASE, ''));
      return route.abort('blockedbyclient');
    }
    if (/vercel-insights|vitals|googletagmanager|google-analytics|\/_vercel\//.test(u)) return route.abort('blockedbyclient');
    if (u.startsWith(BASE + '/api/')) {
      // Les POST internes connus sont des écritures (vues de story, engagement…) : bloqués hors étape `lecture`.
      if (etat.lecture) { log('  · API autorisée (lecture)', m, u.replace(BASE, '')); return route.continue(); }
      log('  ⛔ bloqué (API interne)', m, u.replace(BASE, ''));
      return route.abort('blockedbyclient');
    }
    log('  ⛔ bloqué (autre)', m, u);
    return route.abort('blockedbyclient');
  });
}

// ───────────────────────────── navigateur ─────────────────────────────
async function ouvrir({ scale = SCALE, etat = { chargement: true, lecture: false } } = {}) {
  const browser = await chromium.launch({
    headless: process.env.HEADFUL !== '1',
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars'],
  });
  const ctx = await browser.newContext({
    ...devices['iPhone 15 Pro'],
    viewport: VIEW,
    screen: VIEW,
    deviceScaleFactor: scale,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    ...(fs.existsSync(STATE) ? { storageState: STATE } : {}),
  });
  await proteger(ctx, etat);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { browser, ctx, page, etat };
}

const attendre = (page, ms) => page.waitForTimeout(ms);

/** Va sur une route, attend la fin du chargement, écarte la bannière cookies et l'overlay de dev. */
async function aller(page, etat, route, settle = 2500) {
  etat.chargement = true;
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  const refuser = page.getByRole('button', { name: /^Refuser/ });
  if (await refuser.count().catch(() => 0)) await refuser.first().click({ timeout: 3000 }).catch(() => {});
  await attendre(page, settle);
  etat.chargement = false;
  return page.url().replace(BASE, '');
}

async function capture(page, file, locator) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (locator) await locator.screenshot({ path: file, animations: 'allow' });
  else await page.screenshot({ path: file, animations: 'allow' });
}

/** Liste les éléments interactifs visibles (dans l'écran) avec un nom et un chemin CSS de secours. */
function lister(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth &&
        cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && cs.pointerEvents !== 'none';
    };
    const roleOf = (el) =>
      el.getAttribute('role') ||
      ({ A: el.hasAttribute('href') ? 'link' : '', BUTTON: 'button', SUMMARY: 'button', SELECT: 'combobox', TEXTAREA: 'textbox',
        INPUT: el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : el.type === 'range' ? 'slider' : el.type === 'submit' ? 'button' : 'textbox' })[el.tagName] || '';
    const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const cssPath = (el) => {
      const parts = [];
      while (el && el.nodeType === 1 && parts.length < 10) {
        let s = el.tagName.toLowerCase();
        if (el.id && !/^:r|radix|headlessui/.test(el.id)) { parts.unshift(s + '#' + CSS.escape(el.id)); break; }
        const p = el.parentElement;
        if (p) { const sib = [...p.children].filter((c) => c.tagName === el.tagName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')'; }
        parts.unshift(s);
        el = p;
      }
      return parts.join(' > ');
    };
    const sel = 'button,[role=button],[role=tab],a[href],summary,[aria-haspopup],[aria-expanded],[role=menuitem],[role=option],[role=switch],[role=checkbox],[role=radio],input,textarea,select';
    const seen = new Map();
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el)) continue;
      const role = roleOf(el);
      const name = nameOf(el);
      const key = role + '|' + name;
      const nth = seen.get(key) || 0;
      seen.set(key, nth + 1);
      const r = el.getBoundingClientRect();
      out.push({
        role, name, nth, tag: el.tagName.toLowerCase(), href: el.getAttribute('href') || '', type: el.getAttribute('type') || '',
        popup: el.getAttribute('aria-haspopup') || '', expanded: el.getAttribute('aria-expanded'), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        inNav: !!el.closest('nav[aria-label="Navigation principale"]'), inForm: !!el.closest('form'),
        inDialog: !!el.closest('[role=dialog],[aria-modal=true],[data-vaul-drawer]'),
        box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], css: cssPath(el),
      });
    }
    return out;
  });
}

/** Un élément listé est-il sûr à cliquer en découverte ? */
function sur(c) {
  if (c.disabled || c.inNav || !c.name) return false;
  if (['checkbox', 'switch', 'radio', 'textbox', 'combobox', 'slider', 'searchbox', 'spinbutton'].includes(c.role)) return false;
  if (c.type === 'submit' || (c.inForm && c.role !== 'tab')) return false;
  if (c.tag === 'a' && /^(https?:|mailto:|tel:|sms:|#?$)/.test(c.href) && !c.href.startsWith('/')) return false;
  if (c.role === 'tab') return !INTERDIT_ONGLET.test(c.name);
  return !INTERDIT.test(c.name);
}

/** Retrouve un élément listé après rechargement : par rôle et nom, sinon par chemin CSS. Renvoie null si absent. */
async function retrouver(page, c) {
  if (c.name && ['button', 'tab', 'link', 'menuitem', 'option'].includes(c.role)) {
    const byRole = page.getByRole(c.role, { name: c.name, exact: true });
    if ((await byRole.count().catch(() => 0)) > c.nth) return byRole.nth(c.nth);
  }
  const byCss = page.locator(c.css);
  return (await byCss.count().catch(() => 0)) ? byCss.first() : null;
}

/** Signature de l'état visible, pour savoir si un clic a ouvert quelque chose. */
function signature(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    dialogs: document.querySelectorAll('[role=dialog],[aria-modal=true],[data-vaul-drawer],[data-state=open]').length,
    texte: (document.body.innerText || '').length,
  }));
}

async function fermer(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await attendre(page, 500);
  for (const n of [/^Fermer/, /^Retour$/, /^Close$/]) {
    const b = page.getByRole('button', { name: n });
    if (await b.count().catch(() => 0)) { await b.last().click({ timeout: 2000 }).catch(() => {}); await attendre(page, 500); break; }
  }
}

// ───────────────────────────── vérification de la version ─────────────────────────────
function verifier() {
  const app = process.env.APP_DIR || process.cwd();
  const git = (...a) => execFileSync('git', ['-C', app, ...a], { encoding: 'utf8' }).trim();
  try { git('fetch', 'origin', 'main'); } catch (e) { log('⚠ git fetch origin main a échoué :', e.message.split('\n')[0]); }
  const head = git('rev-parse', 'HEAD');
  const main = git('rev-parse', 'origin/main');
  const date = git('log', '-1', '--format=%ci', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no', '--', 'src');
  const ok = head === main && !dirty;
  const txt = `app : ${app}\nHEAD : ${head} (${date})\norigin/main : ${main}\nsrc modifié localement : ${dirty ? 'OUI' : 'non'}\nverdict : ${ok ? 'OK, dernier main' : 'PAS le dernier main'}\nbase : ${BASE}\nle : ${new Date().toISOString()}\n`;
  fs.mkdirSync(SHOOT, { recursive: true });
  fs.writeFileSync(path.join(SHOOT, 'SOURCE.txt'), txt);
  log(txt.trim());
  if (!ok && process.env.FORCE !== '1') {
    console.error('\n✋ L\'app servie n\'est pas le dernier main. Faire `git checkout --detach origin/main` dans APP_DIR, relancer `next dev`, puis recommencer.');
    process.exit(2);
  }
  return head;
}

// ───────────────────────────── connexion ─────────────────────────────
async function connexion() {
  const pw = process.env.PWFILE ? fs.readFileSync(process.env.PWFILE, 'utf8').trim() : '';
  if (!pw) { console.error('PWFILE manquant (fichier hors dépôt contenant le mot de passe de demo@lkdv.app).'); process.exit(1); }
  if (fs.existsSync(STATE)) fs.unlinkSync(STATE);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const { browser, ctx, page, etat } = await ouvrir();
  etat.lecture = true; // la connexion passe par une action serveur
  await aller(page, etat, '/connexion', 3000);
  await page.locator('input[type=email]:visible').first().fill('demo@lkdv.app');
  await page.locator('input[type=password]:visible').first().fill(pw);
  await page.locator('input[type=password]:visible').first().press('Enter');
  await page.waitForURL((u) => !u.toString().includes('/connexion'), { timeout: 120000 }).catch(() => {});
  const url = page.url().replace(BASE, '');
  await ctx.storageState({ path: STATE });
  log(url.includes('/connexion') ? '✗ connexion refusée' : '✓ connecté → ' + url, '· session :', STATE);
  await browser.close();
}

// ───────────────────────────── découverte ─────────────────────────────
// Toutes les pages utiles au film (les pages légales, l'admin et les connexions sont écartées).
const ROUTES = [
  '/hub', '/explorer', '/compas', '/communaute', '/communaute/reels', '/carnets', '/messagerie', '/compte',
  '/compte/suivi-en-direct', '/compte/montres', '/compte/sensors', '/compte/activites', '/compte/connecteurs',
  '/kit-studio', '/clubs/cordee-des-alpes', '/pro', '/manifeste', '/profil',
  '/hub/inventaire', '/hub/kit', '/hub/preparation', '/hub/depart', '/hub/disponibilite', '/hub/alertes', '/hub/oublis',
  '/hub/itineraire', '/hub/kit-voyage', '/hub/groupe', '/hub/budget', '/hub/documents', '/hub/checklist', '/hub/securite',
  '/hub/journal', '/hub/export', '/hub/invitations', '/hub/voyages',
];

async function decouverte(routes) {
  const out = path.join(SHOOT, 'decouverte');
  const carteFile = path.join(out, 'carte.json');
  const carte = fs.existsSync(carteFile) ? JSON.parse(fs.readFileSync(carteFile, 'utf8')) : {};
  const { browser, page, etat } = await ouvrir();
  // Liens internes vus en chemin (carnet, sortie, profil…) : ajoutés à la file une fois.
  const file = [...routes];
  const vus = new Set();
  while (file.length) {
    const route = file.shift();
    if (vus.has(route)) continue;
    vus.add(route);
    const dir = path.join(out, slug(route));
    const noeud = { route, final: '', controles: [], enfants: [] };
    try {
      log('\n▶', route);
      noeud.final = await aller(page, etat, route, 3500);
      await capture(page, path.join(dir, '00-page.png'));
      await page.screenshot({ path: path.join(dir, '00-page-entiere.png'), fullPage: true }).catch(() => {});
      const base = await signature(page);
      const ctrl = await lister(page);
      noeud.controles = ctrl.map((c) => ({ role: c.role, name: c.name, href: c.href, popup: c.popup, expanded: c.expanded, sur: sur(c) }));
      for (const c of ctrl) {
        if (c.tag === 'a' && c.href.startsWith('/') && /^\/(carnets|clubs|sorties|profil|communaute\/post|live)\//.test(c.href) && !vus.has(c.href) && file.length < 60) {
          if (!file.includes(c.href) && [...vus, ...file].filter((r) => r.split('/')[1] === c.href.split('/')[1]).length < 4) file.push(c.href.split('?')[0]);
        }
      }
      const cibles = ctrl.filter(sur).filter((c) => !(c.tag === 'a' && c.href && c.href !== '#')).slice(0, MAX1);
      let k = 0;
      for (const c of cibles) {
        k += 1;
        const nom = String(k).padStart(2, '0') + '-' + slug(c.name);
        try {
          const el = await retrouver(page, c);
          if (!el) { log('  ? introuvable', c.role, c.name); continue; }
          await el.click({ timeout: 6000 });
          await attendre(page, 1800);
          const apres = await signature(page);
          const kind = apres.url !== base.url ? 'page' : apres.dialogs > base.dialogs ? 'tiroir' : Math.abs(apres.texte - base.texte) > 40 ? 'vue' : 'rien';
          const enfant = { nom: c.name, role: c.role, kind, url: apres.url, png: '', controles: [], enfants: [] };
          if (kind !== 'rien') {
            enfant.png = path.join(slug(route), nom + '.png');
            await capture(page, path.join(dir, nom + '.png'));
            log('  ✓', kind.padEnd(6), c.name);
            if (kind === 'tiroir' || kind === 'vue') {
              const inner = (await lister(page)).filter((x) => x.inDialog || kind === 'vue');
              enfant.controles = inner.map((x) => ({ role: x.role, name: x.name, sur: sur(x) }));
              // Seuls les tiroirs sont explorés un niveau plus bas (sous-tiroirs, onglets internes).
              const souscibles = kind !== 'tiroir' ? [] : inner.filter(sur).filter((x) => !/^(Fermer|Retour|Close)/.test(x.name) && x.name !== c.name && !(x.tag === 'a' && x.href && x.href !== '#')).slice(0, MAX2);
              let j = 0;
              for (const s of souscibles) {
                j += 1;
                const snom = nom + '-' + String(j).padStart(2, '0') + '-' + slug(s.name);
                try {
                  const se = await retrouver(page, s);
                  if (!se) continue;
                  await se.click({ timeout: 6000 });
                  await attendre(page, 1500);
                  await capture(page, path.join(dir, snom + '.png'));
                  enfant.enfants.push({ nom: s.name, role: s.role, png: path.join(slug(route), snom + '.png') });
                  log('    ✓', s.name);
                  // Revenir au tiroir parent : on recharge et on rouvre (état propre).
                  await aller(page, etat, route, 2500);
                  const re = await retrouver(page, c);
                  if (re) { await re.click({ timeout: 6000 }); await attendre(page, 1500); }
                } catch (e) { log('    ✗', s.name, e.message.split('\n')[0]); }
              }
            }
          } else log('  ·', 'rien  ', c.name);
          noeud.enfants.push(enfant);
          // Retour à l'état de base, sinon rechargement.
          await fermer(page);
          const now = await signature(page);
          if (now.url !== base.url || now.dialogs > base.dialogs) await aller(page, etat, route, 2500);
        } catch (e) {
          log('  ✗', c.name, e.message.split('\n')[0]);
          await aller(page, etat, route, 2500).catch(() => {});
        }
      }
    } catch (e) {
      log('✗ page', route, e.message.split('\n')[0]);
    }
    carte[route] = noeud;
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(carteFile, JSON.stringify(carte, null, 1));
    writeLog(out);
  }
  await browser.close();
}

// ───────────────────────────── plans choisis ─────────────────────────────
// Étapes : 'clic:Nom' (bouton, onglet ou lien au nom exact, puis approché), 'texte:Texte visible',
// 'sel:css', 'taper:css|texte' (sans jamais valider), 'defiler:px', 'attendre:ms', 'echap',
// 'lecture' (autorise les actions serveur pour la suite du plan : tiroir qui charge ses données).
// `crops` : découpes à 3× d'éléments réels, { nom: 'css' | 'role:nom' }.
const PLANS = [
  { id: 'explorer-globe', route: '/explorer', settle: 9000 },
  { id: 'explorer-menu', route: '/explorer', settle: 9000, steps: ['clic:Ouvrir le menu Explorer'] },
  { id: 'explorer-calques', route: '/explorer', settle: 9000, steps: ['clic:Calques de la carte'] },
  { id: 'explorer-fond', route: '/explorer', settle: 9000, steps: ['clic:Style du fond de carte'] },
  { id: 'explorer-recherche', route: '/explorer', settle: 9000, steps: ['clic:Rechercher un lieu ou un parcours', 'attendre:800', 'taper:input:visible|Vercors'] },
  { id: 'compas', route: '/compas', settle: 5000 },
  { id: 'compas-verifs', route: '/compas', settle: 5000, steps: ['lecture', 'clic:Vérifs'] },
  { id: 'compas-aprevoir', route: '/compas', settle: 5000, steps: ['lecture', 'clic:À prévoir'] },
  { id: 'compas-budget', route: '/compas', settle: 5000, steps: ['lecture', 'clic:Budget'] },
  { id: 'compas-sac', route: '/compas', settle: 5000, steps: ['lecture', 'clic:Sac'] },
  { id: 'compas-solo', route: '/compas', settle: 5000, steps: ['lecture', 'clic:Solo'] },
  { id: 'hub', route: '/hub', settle: 5000 },
  { id: 'communaute', route: '/communaute', settle: 5000 },
  { id: 'communaute-creer', route: '/communaute', settle: 5000, steps: ['clic:Créer'] },
  { id: 'communaute-creer-carnet', route: '/communaute', settle: 5000, steps: ['clic:Créer', 'attendre:900', 'clic:Carnet'] },
  { id: 'reels', route: '/communaute/reels', settle: 6000 },
  { id: 'carnets', route: '/carnets', settle: 5000 },
  { id: 'carnets-suivis', route: '/carnets', settle: 5000, steps: ['clic:Suivis'] },
  { id: 'carnets-monde', route: '/carnets', settle: 5000, steps: ['clic:Monde'] },
  { id: 'carnets-miens', route: '/carnets', settle: 5000, steps: ['clic:Les miens'] },
  { id: 'club', route: '/clubs/cordee-des-alpes', settle: 6000 },
  { id: 'messagerie', route: '/messagerie', settle: 5000 },
  { id: 'compte', route: '/compte', settle: 6000 },
  { id: 'compte-empreinte', route: '/compte', settle: 6000, steps: ['lecture', 'clic:Personnaliser la carte d’empreinte'] },
  { id: 'suivi-en-direct', route: '/compte/suivi-en-direct', settle: 4000 },
  { id: 'suivi-contacts', route: '/compte/suivi-en-direct', settle: 4000, steps: ['clic:Contacts'] },
  { id: 'suivi-montre', route: '/compte/suivi-en-direct', settle: 4000, steps: ['clic:Montre'] },
  { id: 'montres', route: '/compte/montres', settle: 4000 },
  { id: 'sensors', route: '/compte/sensors', settle: 4000 },
  { id: 'activites', route: '/compte/activites', settle: 4000 },
  { id: 'kit-studio', route: '/kit-studio', settle: 9000 },
  { id: 'pro', route: '/pro', settle: 4000 },
  { id: 'manifeste', route: '/manifeste', settle: 4000 },
];

async function trouver(page, nom) {
  const exact = [
    page.getByRole('button', { name: nom, exact: true }),
    page.getByRole('tab', { name: nom, exact: true }),
    page.getByRole('link', { name: nom, exact: true }),
  ];
  for (const t of exact) if (await t.count().catch(() => 0)) return t.first();
  for (const t of [page.getByRole('button', { name: nom }), page.getByRole('tab', { name: nom }), page.getByLabel(nom), page.getByText(nom, { exact: true })]) {
    if (await t.count().catch(() => 0)) return t.first();
  }
  return null;
}

async function etape(page, etat, s, marks, t0) {
  const [op, ...rest] = s.split(':');
  const arg = rest.join(':');
  const mark = (label, box) => marks && marks.push({ label, t: (Date.now() - t0) / 1000, box });
  if (op === 'lecture') { etat.lecture = true; return; }
  if (op === 'attendre') return attendre(page, Number(arg));
  if (op === 'echap') { mark('echap'); return page.keyboard.press('Escape'); }
  if (op === 'defiler') { mark('defiler:' + arg); return page.mouse.wheel(0, Number(arg)); }
  if (op === 'taper') {
    const [css, ...txt] = arg.split('|');
    const el = page.locator(css).first();
    const b = await el.boundingBox().catch(() => null);
    mark('tap', b);
    await el.click({ timeout: 8000 });
    // Jamais d'Entrée : on tape sans valider.
    for (const ch of txt.join('|')) { await page.keyboard.type(ch); await attendre(page, 45); }
    return;
  }
  let el = null;
  if (op === 'clic') el = await trouver(page, arg);
  else if (op === 'texte') el = page.getByText(arg, { exact: true }).first();
  else if (op === 'sel') el = page.locator(arg).first();
  if (!el || !(await el.count().catch(() => 0))) throw new Error('introuvable : ' + s);
  const name = (await el.getAttribute('aria-label').catch(() => null)) || (await el.innerText().catch(() => '')) || arg;
  if (op !== 'sel' && INTERDIT.test(name) && !/^(Créer|Carnet)$/.test(arg)) throw new Error('refusé par la liste INTERDIT : ' + name);
  const b = await el.boundingBox().catch(() => null);
  mark(s, b);
  await el.click({ timeout: 8000 });
}

async function plans(ids) {
  const out = path.join(SHOOT, 'plans');
  const liste = ids.length ? PLANS.filter((p) => ids.includes(p.id)) : PLANS;
  const { browser, page, etat } = await ouvrir();
  for (const p of liste) {
    try {
      etat.lecture = false;
      await aller(page, etat, p.route, p.settle || 3000);
      for (const s of p.steps || []) { await etape(page, etat, s); await attendre(page, 1200); }
      await attendre(page, p.after || 1800);
      await capture(page, path.join(out, p.id + '.png'));
      for (const [nom, cible] of Object.entries(p.crops || {})) {
        const loc = cible.startsWith('role:') ? page.getByRole(cible.split(':')[1], { name: cible.split(':').slice(2).join(':') }).first() : page.locator(cible).first();
        await capture(page, path.join(out, 'decoupes', p.id + '-' + nom + '.png'), loc).catch((e) => log('  ✗ découpe', nom, e.message.split('\n')[0]));
      }
      log('✓', p.id);
    } catch (e) {
      log('✗', p.id, e.message.split('\n')[0]);
    }
    writeLog(out);
  }
  await browser.close();
}

// ───────────────────────────── gestes enregistrés ─────────────────────────────
// Enregistrement en screencast CDP (images JPEG horodatées) ; chaque geste est noté dans marks.json
// avec son instant et sa boîte (pour poser le curseur et caler le son au montage).
async function glisser(page, cdp, x1, y1, x2, y2, ms = 450) {
  const n = Math.max(6, Math.round(ms / 16));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * e, y: y1 + (y2 - y1) * e }] });
    await attendre(page, ms / n);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const GESTES = {
  'explorer-globe': { route: '/explorer', settle: 9000, run: async (g) => { await g.glisser(300, 380, 90, 400, 700); await g.pause(700); await g.glisser(90, 420, 320, 380, 800); await g.pause(900); } },
  'explorer-tiroir': { route: '/explorer', settle: 9000, run: async (g) => { await g.glisser(196, 790, 196, 480, 600); await g.pause(1200); await g.glisser(196, 470, 196, 160, 600); await g.pause(1200); await g.glisser(196, 170, 196, 780, 600); await g.pause(800); } },
  'explorer-fonds': { route: '/explorer', settle: 9000, run: async (g) => { await g.clic('Style du fond de carte'); await g.pause(1400); for (const n of ['Satellite', 'Relief', 'Plan']) { await g.clic(n).catch(() => {}); await g.pause(1300); } } },
  'explorer-menu': { route: '/explorer', settle: 9000, run: async (g) => { await g.clic('Ouvrir le menu Explorer'); await g.pause(1600); await g.echap(); await g.pause(600); await g.clic('Calques de la carte'); await g.pause(1600); } },
  'compas-tiroirs': { route: '/compas', settle: 5000, lecture: true, run: async (g) => { for (const n of ['Vérifs', 'À prévoir', 'Budget', 'Sac']) { await g.clic(n); await g.pause(1500); await g.echap(); await g.pause(700); } } },
  'hub-tuiles': { route: '/hub', settle: 5000, lecture: true, run: async (g) => { for (const n of ['Météo', 'Budget', 'Étapes', 'Carnet', 'Kits', 'Paperasse', 'Groupe', 'Carte']) { await g.clicTexte(n); await g.pause(1400); await g.echap(); await g.pause(600); } } },
  'communaute-fil': { route: '/communaute', settle: 5000, run: async (g) => { await g.glisser(196, 700, 196, 260, 500); await g.pause(900); await g.glisser(196, 700, 196, 260, 500); await g.pause(900); await g.glisser(196, 260, 196, 700, 500); await g.pause(700); } },
  'communaute-creer': { route: '/communaute', settle: 5000, run: async (g) => { await g.clic('Créer'); await g.pause(1400); await g.clic('Carnet'); await g.pause(1800); } },
  'carnets-onglets': { route: '/carnets', settle: 5000, run: async (g) => { for (const n of ['Suivis', 'Monde', 'Les miens', 'En route']) { await g.clic(n); await g.pause(1300); } } },
  'kit-studio-sac': { route: '/kit-studio', settle: 9000, run: async (g) => { await g.glisser(110, 420, 300, 420, 900); await g.pause(500); await g.glisser(300, 420, 80, 420, 1100); await g.pause(800); } },
  'suivi-onglets': { route: '/compte/suivi-en-direct', settle: 4000, run: async (g) => { for (const n of ['Contacts', 'Montre', 'Partage']) { await g.clic(n); await g.pause(1300); } } },
  'compte-defile': { route: '/compte', settle: 6000, run: async (g) => { await g.glisser(196, 700, 196, 300, 600); await g.pause(1000); await g.glisser(196, 300, 196, 700, 600); await g.pause(800); } },
  'messagerie-defile': { route: '/messagerie', settle: 5000, run: async (g) => { await g.glisser(196, 700, 196, 320, 600); await g.pause(1000); await g.clic('Demandes').catch(() => {}); await g.pause(1200); } },
};

async function gestes(ids) {
  const out = path.join(SHOOT, 'gestes');
  const liste = ids.length ? ids : Object.keys(GESTES);
  const { browser, ctx, page, etat } = await ouvrir({ scale: REC_SCALE });
  for (const id of liste) {
    const G = GESTES[id];
    if (!G) { log('? geste inconnu', id); continue; }
    const dir = path.join(out, id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    let cdp = null;
    let rec = false;
    try {
      etat.lecture = !!G.lecture;
      await aller(page, etat, G.route, G.settle || 3000);
      cdp = await ctx.newCDPSession(page);
      const meta = [];
      const marks = [];
      let n = 0;
      rec = true;
      cdp.on('Page.screencastFrame', async (f) => {
        if (rec) {
          const fn = 'f' + String(n++).padStart(5, '0') + '.jpg';
          fs.writeFileSync(path.join(dir, fn), Buffer.from(f.data, 'base64'));
          meta.push([fn, f.metadata.timestamp]);
        }
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VIEW.width * REC_SCALE, maxHeight: VIEW.height * REC_SCALE, everyNthFrame: 1 });
      await attendre(page, 900);
      const t0 = Date.now();
      const mark = (label, box) => marks.push({ label, t: (Date.now() - t0) / 1000, box });
      const g = {
        pause: (ms) => attendre(page, ms),
        echap: async () => { mark('echap'); await page.keyboard.press('Escape'); },
        glisser: async (x1, y1, x2, y2, ms) => { mark(`glisser ${x1},${y1}→${x2},${y2}`, [x1, y1, x2, y2]); await glisser(page, cdp, x1, y1, x2, y2, ms); },
        clic: async (nom) => {
          const el = await trouver(page, nom);
          if (!el) throw new Error('introuvable : ' + nom);
          const b = await el.boundingBox();
          mark('clic ' + nom, b && [b.x, b.y, b.width, b.height]);
          await el.click({ timeout: 8000 });
        },
        clicTexte: async (txt) => {
          const el = page.getByText(txt, { exact: true }).first();
          const b = await el.boundingBox();
          mark('clic ' + txt, b && [b.x, b.y, b.width, b.height]);
          await el.click({ timeout: 8000 });
        },
      };
      let erreur = null;
      try { await G.run(g); } catch (e) { erreur = e; }
      await attendre(page, 700);
      rec = false;
      await cdp.send('Page.stopScreencast').catch(() => {});
      const wall0 = meta.length ? meta[0][1] : 0;
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
      fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify({ t0_ms: t0, premier_cadre_s: wall0, erreur: erreur ? erreur.message.split('\n')[0] : null, marks }, null, 1));
      log(erreur ? '✗' : '✓', id, meta.length, 'images,', marks.length, 'gestes', erreur ? '· ' + erreur.message.split('\n')[0] : '');
    } catch (e) {
      log('✗', id, e.message.split('\n')[0]);
    } finally {
      rec = false;
      if (cdp) { await cdp.send('Page.stopScreencast').catch(() => {}); await cdp.detach().catch(() => {}); }
    }
    writeLog(out);
  }
  await browser.close();
}

// ───────────────────────────── point d'entrée ─────────────────────────────
(async () => {
  const [cmd = 'aide', ...args] = process.argv.slice(2);
  if (cmd === 'verifier') return void verifier();
  if (cmd === 'connexion') return connexion();
  if (!['decouverte', 'plans', 'gestes', 'tout'].includes(cmd)) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }
  verifier();
  if (!fs.existsSync(STATE)) { console.error('Pas de session : lancer d\'abord `connexion` avec PWFILE.'); process.exit(1); }
  if (cmd === 'decouverte' || cmd === 'tout') await decouverte(cmd === 'tout' || !args.length ? ROUTES : args);
  if (cmd === 'plans' || cmd === 'tout') await plans(cmd === 'tout' ? [] : args);
  if (cmd === 'gestes' || cmd === 'tout') await gestes(cmd === 'tout' ? [] : args);
})().catch((e) => { console.error(e); process.exit(1); });
