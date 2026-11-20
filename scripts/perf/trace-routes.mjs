#!/usr/bin/env node
/**
 * LKDV — Trace runner déterministe et réutilisable (R1 / M1–M7).
 *
 * Mesure les routes `src/app` sur un serveur `next start` (ou aperçu) via Playwright + CDP :
 * - Profil `mobile`  : 390x844 DPR 2, Slow 4G (RTT 150 ms, 1,6 Mbps ↓, 750 Kbps ↑), CPU ×4, SW bloqué
 * - Profil `desktop` : 1440x900 DPR 1, sans bridage réseau/CPU, SW bloqué
 * - Cache froid par passage (`browser.newContext()` neuf)
 * - Métriques : httpStatus, initialHttpStatus, redirectChain, finalPath, status, TTFB, FCP, LCP (+ élément),
 *   CLS, TBT, INP (sonde non-destructive + PerformanceObserver `event`), bootGoneMs, JS wire CDP & ResourceTiming.
 * - Mode `--tab-switch` : latence réelle de changement d'onglet via `FloatingLiquidTabBar`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Inventaire canonique des 46 routes `src/app` + variante `/kit-studio?debug=1`. */
export const DEFAULT_ROUTES = [
  // Tier 1 — Trafic élevé (10)
  { route: '/', path: '/', tier: 'high' },
  { route: '/hub', path: '/hub', tier: 'high' },
  { route: '/hub/[section]', path: '/hub/inventaire', tier: 'high' },
  { route: '/explorer', path: '/explorer', tier: 'high' },
  { route: '/communaute', path: '/communaute', tier: 'high' },
  { route: '/communaute/reels', path: '/communaute/reels', tier: 'high' },
  { route: '/messagerie', path: '/messagerie', tier: 'high' },
  { route: '/compte', path: '/compte', tier: 'high' },
  { route: '/compas', path: '/compas', tier: 'high' },
  { route: '/carnets', path: '/carnets', tier: 'high' },

  // Tier 2 — Trafic moyen (14 + variante debug Kit Studio)
  { route: '/carnets/[id]', path: '/carnets/00000000-0000-4000-8000-00000000a001', tier: 'medium' },
  { route: '/clubs/[id]', path: '/clubs/cl1', tier: 'medium' },
  { route: '/sorties/[id]', path: '/sorties/00000000-0000-4000-8000-00000000a001', tier: 'medium' },
  { route: '/profil/[id]', path: '/profil/tony_frc', tier: 'medium' },
  { route: '/kit-studio', path: '/kit-studio', tier: 'medium' },
  { route: '/kit-studio?debug=1', path: '/kit-studio?debug=1', tier: 'medium' },
  { route: '/compte/activites', path: '/compte/activites', tier: 'medium' },
  { route: '/compte/connecteurs', path: '/compte/connecteurs', tier: 'medium' },
  { route: '/compte/montres', path: '/compte/montres', tier: 'medium' },
  { route: '/compte/sensors', path: '/compte/sensors', tier: 'medium' },
  { route: '/compte/suivi-en-direct', path: '/compte/suivi-en-direct', tier: 'medium' },
  { route: '/panier', path: '/panier', tier: 'medium' },
  { route: '/checkout', path: '/checkout', tier: 'medium' },
  { route: '/live/[token]', path: '/live/sample-token', tier: 'medium' },
  { route: '/apercu/[token]', path: '/apercu/sample-token', tier: 'medium' },

  // Tier 3 — Trafic faible (22)
  { route: '/connexion', path: '/connexion', tier: 'low' },
  { route: '/connexion/nouveau-mot-de-passe', path: '/connexion/nouveau-mot-de-passe', tier: 'low' },
  { route: '/inscription', path: '/inscription', tier: 'low' },
  { route: '/contact', path: '/contact', tier: 'low' },
  { route: '/pro', path: '/pro', tier: 'low' },
  { route: '/manifeste', path: '/manifeste', tier: 'low' },
  { route: '/cgu', path: '/cgu', tier: 'low' },
  { route: '/cgv', path: '/cgv', tier: 'low' },
  { route: '/mentions-legales', path: '/mentions-legales', tier: 'low' },
  { route: '/politique-confidentialite', path: '/politique-confidentialite', tier: 'low' },
  { route: '/cookies', path: '/cookies', tier: 'low' },
  { route: '/accessibilite', path: '/accessibilite', tier: 'low' },
  { route: '/developpeurs', path: '/developpeurs', tier: 'low' },
  { route: '/admin', path: '/admin', tier: 'low' },
  { route: '/admin/produits', path: '/admin/produits', tier: 'low' },
  { route: '/admin/progression', path: '/admin/progression', tier: 'low' },
  { route: '/hub/nouveau', path: '/hub/nouveau', tier: 'low' },
  { route: '/carte-interactive', path: '/carte-interactive', tier: 'low' },
  { route: '/communaute/post/[id]', path: '/communaute/post/sample-post', tier: 'low' },
  { route: '/profil', path: '/profil', tier: 'low' },
  { route: '/recette-hub', path: '/recette-hub', tier: 'low' },
  { route: '/dev/carnet-v2', path: '/dev/carnet-v2', tier: 'low' },
];

const TAB_SWITCH_SEQUENCE = ['/hub', '/explorer', '/communaute', '/messagerie', '/compte', '/hub'];

function printHelp() {
  console.log(`Usage: node scripts/perf/trace-routes.mjs [options]

Options:
  --base-url <url>        URL de base du serveur (défaut: http://127.0.0.1:4028)
  --profile <mode>        mobile | desktop | both (défaut: both)
  --routes <csv>          Liste de routes séparées par des virgules
  --routes-file <path>    Fichier JSON (tableau de chaînes ou {route,path,tier}) ou texte ligne par ligne
  --storage-state <path>  Fichier Playwright storageState pour sessions authentifiées
  --out <path>            Chemin de sortie du rapport JSON complet
  --runs <n>              Nombre de passages mesurés par route (défaut: 3)
  --warmup <n>            Nombre de passages de préchauffage exclus des stats (défaut: 1)
  --headless <bool>       true | false (défaut: true)
  --tab-switch            Mesure les bascules d'onglet dans FloatingLiquidTabBar (contexte chaud)
  --chrome-path <path>    Binaire Chrome/Chromium explicite (sinon CHROME_PATH ou Google Chrome macOS)
  --timeout-ms <ms>       Timeout de navigation par passage (défaut: 45000)
  --help, -h              Affiche cette aide
`);
}

function parseArgs(argv) {
  const opts = {
    baseUrl: 'http://127.0.0.1:4028',
    profile: 'both',
    routesCsv: null,
    routesFile: null,
    storageState: null,
    out: null,
    runs: 3,
    warmup: 1,
    headless: true,
    tabSwitch: false,
    chromePath: null,
    timeoutMs: 45_000,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--tab-switch') {
      opts.tabSwitch = true;
      continue;
    }

    const eqIdx = arg.indexOf('=');
    const key = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
    const nextVal = () => {
      if (eqIdx >= 0) return arg.slice(eqIdx + 1);
      i += 1;
      return argv[i];
    };

    switch (key) {
      case '--base-url':
        opts.baseUrl = nextVal().replace(/\/+$/, '');
        break;
      case '--profile':
        opts.profile = nextVal();
        break;
      case '--routes':
        opts.routesCsv = nextVal();
        break;
      case '--routes-file':
        opts.routesFile = nextVal();
        break;
      case '--storage-state':
        opts.storageState = nextVal();
        break;
      case '--out':
        opts.out = nextVal();
        break;
      case '--runs':
        opts.runs = Math.max(1, Number(nextVal()));
        break;
      case '--warmup':
        opts.warmup = Math.max(0, Number(nextVal()));
        break;
      case '--headless': {
        const val = String(nextVal()).toLowerCase();
        opts.headless = val !== 'false' && val !== '0';
        break;
      }
      case '--chrome-path':
        opts.chromePath = nextVal();
        break;
      case '--timeout-ms':
        opts.timeoutMs = Math.max(1000, Number(nextVal()));
        break;
      default:
        throw new Error(`Option inconnue : ${arg}`);
    }
  }

  if (!['mobile', 'desktop', 'both'].includes(opts.profile)) {
    throw new Error(`Profil invalide "${opts.profile}" (attendu : mobile | desktop | both)`);
  }
  return opts;
}

function resolveRoutes(opts) {
  const byKey = new Map();
  for (const entry of DEFAULT_ROUTES) {
    byKey.set(entry.route, entry);
    byKey.set(entry.path, entry);
  }

  const normalizeItem = (item) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) return null;
      return byKey.get(trimmed) ?? { route: trimmed, path: trimmed, tier: 'custom' };
    }
    if (item && typeof item === 'object') {
      const p = String(item.path || item.route || '').trim();
      if (!p) return null;
      const base = byKey.get(item.route || p);
      return {
        route: String(item.route || base?.route || p),
        path: p,
        tier: String(item.tier || base?.tier || 'custom'),
      };
    }
    return null;
  };

  if (opts.routesFile) {
    const raw = fs.readFileSync(opts.routesFile, 'utf8').trim();
    if (raw.startsWith('[') || raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed.routes;
      return (list || []).map(normalizeItem).filter(Boolean);
    }
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map(normalizeItem)
      .filter(Boolean);
  }

  if (opts.routesCsv) {
    return opts.routesCsv
      .split(',')
      .map(normalizeItem)
      .filter(Boolean);
  }

  return DEFAULT_ROUTES;
}

function resolveChromeExecutable(explicitPath) {
  const candidates = [explicitPath, process.env.CHROME_PATH, DEFAULT_CHROME_PATH].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function getGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function quantile(values, q) {
  const sorted = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function roundStat(val, decimals = 0) {
  if (val == null || !Number.isFinite(val)) return null;
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function summarizeMetric(values, decimals = 0) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!clean.length) return { p50: null, p75: null };
  return {
    p50: roundStat(quantile(clean, 0.5), decimals),
    p75: roundStat(quantile(clean, 0.75), decimals),
  };
}

function getProfileConfig(profileName) {
  if (profileName === 'mobile') {
    return {
      name: 'mobile',
      throttle: true,
      contextOptions: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        serviceWorkers: 'block',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      },
    };
  }
  return {
    name: 'desktop',
    throttle: false,
    contextOptions: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      serviceWorkers: 'block',
    },
  };
}

const INIT_PERF_SCRIPT = () => {
  window.__lkdvPerf = {
    lcpMs: null,
    lcpElement: null,
    cls: 0,
    longTasks: [],
    maxEventDurationMs: null,
    hadBoot: false,
    bootGoneMs: null,
  };

  const watchBoot = () => {
    const boot = document.querySelector('.lkdv-boot');
    if (boot) window.__lkdvPerf.hadBoot = true;
    if (
      window.__lkdvPerf.hadBoot &&
      window.__lkdvPerf.bootGoneMs == null &&
      (!boot || boot.getAttribute('data-phase') === 'leaving')
    ) {
      window.__lkdvPerf.bootGoneMs = performance.now();
    }
  };
  new MutationObserver(watchBoot).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-phase'],
  });

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (window.__lkdvPerf.lcpMs == null || entry.startTime >= window.__lkdvPerf.lcpMs) {
          window.__lkdvPerf.lcpMs = entry.startTime;
          const el = entry.element;
          if (el) {
            const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
            const cls = typeof el.className === 'string' && el.className.trim()
              ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
              : '';
            const id = el.id ? `#${el.id}` : '';
            window.__lkdvPerf.lcpElement = `${tag}${id}${cls}`.slice(0, 80);
          }
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__lkdvPerf.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lkdvPerf.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const isInteraction =
          entry.interactionId > 0 ||
          entry.name === 'click' ||
          entry.name === 'pointerdown' ||
          entry.name === 'pointerup' ||
          entry.name === 'keydown';
        if (isInteraction) {
          window.__lkdvPerf.maxEventDurationMs =
            window.__lkdvPerf.maxEventDurationMs == null
              ? entry.duration
              : Math.max(window.__lkdvPerf.maxEventDurationMs, entry.duration);
        }
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {}
};

async function collectRedirectChain(response) {
  if (!response) return { initialHttpStatus: null, httpStatus: null, redirectChain: [] };
  const requests = [];
  let current = response.request();
  while (current) {
    requests.unshift(current);
    current = current.redirectedFrom();
  }
  const chain = [];
  for (let i = 0; i < requests.length - 1; i += 1) {
    const req = requests[i];
    const resp = await req.response().catch(() => null);
    const headers = resp ? resp.headers() : {};
    chain.push({
      url: req.url(),
      status: resp ? resp.status() : null,
      location: headers.location ?? null,
    });
  }
  const finalStatus = response.status();
  const initialStatus = chain.length > 0 && chain[0].status != null ? chain[0].status : finalStatus;
  return {
    initialHttpStatus: initialStatus,
    httpStatus: finalStatus,
    redirectChain: chain,
  };
}

function classifyOutcome({ error, requestedPath, finalPath, initialHttpStatus, httpStatus, redirectChain }) {
  if (error) {
    return { status: 'error', reason: error };
  }
  const reqPathname = new URL(requestedPath, 'http://127.0.0.1').pathname;
  if (
    finalPath === '/connexion' &&
    reqPathname !== '/connexion' &&
    reqPathname !== '/connexion/nouveau-mot-de-passe' &&
    reqPathname !== '/inscription'
  ) {
    const hops = redirectChain.map((h) => h.status).filter(Boolean).join('→') || String(initialHttpStatus);
    return { status: 'auth_blocked', reason: `Redirection ${hops} → ${finalPath} (session requise)` };
  }
  if (httpStatus === 404) {
    return { status: 'not_found', reason: 'HTTP 404 Not Found' };
  }
  if (httpStatus != null && httpStatus >= 500) {
    return { status: 'error', reason: `HTTP ${httpStatus}` };
  }
  if (finalPath !== reqPathname) {
    const hops = redirectChain.map((h) => h.status).filter(Boolean).join('→') || String(initialHttpStatus);
    return { status: 'redirect', reason: `Redirection ${hops} → ${finalPath}` };
  }
  return { status: 'measured', reason: null };
}

async function measureSingleRun({ browser, baseUrl, entry, profileCfg, storageState, timeoutMs, runIndex, isWarmup }) {
  const context = await browser.newContext({
    ...profileCfg.contextOptions,
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');

  const reqMeta = new Map();
  let jsWireBytesTotal = 0;
  let jsCdpFiles = 0;
  cdp.on('Network.requestWillBeSent', (ev) => {
    reqMeta.set(ev.requestId, {
      url: ev.request?.url || '',
      type: ev.type || '',
      isScript: ev.type === 'Script' || /\.m?js(\?|$)/i.test(ev.request?.url || ''),
    });
  });
  cdp.on('Network.responseReceived', (ev) => {
    const meta = reqMeta.get(ev.requestId) || { url: ev.response?.url || '', type: ev.type || '', isScript: false };
    const mime = String(ev.response?.mimeType || '').toLowerCase();
    if (
      ev.type === 'Script' ||
      mime.includes('javascript') ||
      mime.includes('ecmascript') ||
      /\.m?js(\?|$)/i.test(meta.url)
    ) {
      meta.isScript = true;
    }
    reqMeta.set(ev.requestId, meta);
  });
  cdp.on('Network.loadingFinished', (ev) => {
    const meta = reqMeta.get(ev.requestId);
    if (meta?.isScript && typeof ev.encodedDataLength === 'number') {
      jsWireBytesTotal += ev.encodedDataLength;
      jsCdpFiles += 1;
    }
  });

  if (profileCfg.throttle) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  await page.addInitScript(INIT_PERF_SCRIPT);

  const targetUrl = `${baseUrl}${entry.path}`;
  const t0 = Date.now();
  let response = null;
  let navError = null;
  let redirectInfo = { initialHttpStatus: null, httpStatus: null, redirectChain: [] };

  try {
    response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
    redirectInfo = await collectRedirectChain(response);
  } catch (err) {
    navError = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
  }

  const currentUrl = page.url();
  let finalPath = entry.path;
  try {
    finalPath = new URL(currentUrl).pathname;
  } catch {}

  const preliminaryOutcome = classifyOutcome({
    error: navError,
    requestedPath: entry.path,
    finalPath,
    initialHttpStatus: redirectInfo.initialHttpStatus,
    httpStatus: redirectInfo.httpStatus,
    redirectChain: redirectInfo.redirectChain,
  });

  // Attente de stabilisation uniquement sur les routes effectivement servies
  if (!navError && preliminaryOutcome.status === 'measured') {
    if (finalPath === '/explorer') {
      await page
        .waitForFunction(() => performance.getEntriesByName('map:interactive').length > 0, {
          timeout: profileCfg.throttle ? 15_000 : 6_000,
        })
        .catch(() => {});
      await page.waitForTimeout(profileCfg.throttle ? 1500 : 600);
    } else {
      await page.waitForTimeout(profileCfg.throttle ? 4500 : 1500);
    }

    // Sonde INP non-destructive : clic sur une zone neutre de <main> / <body> + léger défilement
    const probePoint = await page
      .evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const main = document.querySelector('main') || document.body;
        const rect = main ? main.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
        const candidates = [
          [Math.round(vw * 0.5), Math.round(Math.min(vh * 0.45, Math.max(80, rect.top + 80)))],
          [Math.round(vw * 0.15), Math.round(vh * 0.3)],
          [20, 120],
        ];
        for (const [x, y] of candidates) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest('a,button,input,textarea,select,label,[role="button"],[role="link"]')) {
            return { x, y };
          }
        }
        return null;
      })
      .catch(() => null);

    if (probePoint) {
      await page.mouse.click(probePoint.x, probePoint.y).catch(() => {});
    }
    await page.evaluate(() => window.scrollBy(0, 120)).catch(() => {});
    await page.waitForTimeout(250);
  }

  const metrics = await Promise.race([
    page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const fcpMs = fcp ? fcp.startTime : null;
      const ttfbMs = nav ? Math.max(0, nav.responseStart - nav.requestStart) : null;
      const dclMs = nav ? nav.domContentLoadedEventEnd : null;
      const loadMs = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : null;

      const perfState = window.__lkdvPerf || {};
      const longTasks = Array.isArray(perfState.longTasks) ? perfState.longTasks : [];
      let tbtMs = 0;
      let longTasksTotalMs = 0;
      for (const lt of longTasks) {
        longTasksTotalMs += lt.duration;
        if (fcpMs == null || lt.startTime + lt.duration > fcpMs) {
          tbtMs += Math.max(0, lt.duration - 50);
        }
      }

      const resources = performance.getEntriesByType('resource');
      const isJs = (r) => r.initiatorType === 'script' || /\.m?js(\?|$)/i.test(r.name);
      const jsResources = resources.filter(isJs);
      const initialCutoff = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : Infinity;
      const initialJs = jsResources.filter((r) => r.startTime <= initialCutoff);

      const jsInitialTransferBytes = initialJs.reduce(
        (sum, r) => sum + (r.transferSize || r.encodedBodySize || 0),
        0
      );
      const jsInitialDecodedBytes = initialJs.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
      const jsTotalDecodedBytes = jsResources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
      const jsStartEntry = performance.getEntriesByName('lkdv:js-start')[0];
      const mapFirstPaint = performance.getEntriesByName('map:first-paint')[0];
      const mapInteractive = performance.getEntriesByName('map:interactive')[0];

      return {
        ttfbMs,
        fcpMs,
        dclMs,
        loadMs,
        lcpMs: perfState.lcpMs ?? null,
        lcpElement: perfState.lcpElement ?? null,
        cls: perfState.cls ?? 0,
        tbtMs,
        longTasksCount: longTasks.length,
        longTasksTotalMs,
        inpMs: perfState.maxEventDurationMs ?? null,
        bootGoneMs: perfState.bootGoneMs ?? null,
        lkdvJsStartMs: jsStartEntry ? jsStartEntry.startTime : null,
        mapFirstPaintMs: mapFirstPaint ? mapFirstPaint.startTime : null,
        mapInteractiveMs: mapInteractive ? mapInteractive.startTime : null,
        jsInitialTransferBytes,
        jsInitialDecodedBytes,
        jsTotalDecodedBytes,
        jsResourceFileCount: initialJs.length,
        textLen: document.body ? (document.body.innerText || '').trim().length : 0,
      };
    }),
    new Promise((resolve) => setTimeout(() => resolve({ metricsTimeout: true }), 15_000)),
  ]).catch(() => ({ metricsError: true }));

  await cdp.detach().catch(() => {});
  await context.close();

  return {
    run: runIndex,
    warmup: isWarmup,
    wallMs: Date.now() - t0,
    initialHttpStatus: redirectInfo.initialHttpStatus,
    httpStatus: redirectInfo.httpStatus,
    redirectChain: redirectInfo.redirectChain,
    finalUrl: currentUrl,
    finalPath,
    status: preliminaryOutcome.status,
    reason: preliminaryOutcome.reason,
    consoleErrorsCount: consoleErrors.length,
    consoleErrorsSample: consoleErrors.slice(0, 5),
    pageErrorsCount: pageErrors.length,
    pageErrorsSample: pageErrors.slice(0, 5),
    ttfbMs: roundStat(metrics.ttfbMs, 1),
    fcpMs: roundStat(metrics.fcpMs, 1),
    dclMs: roundStat(metrics.dclMs, 1),
    loadMs: roundStat(metrics.loadMs, 1),
    lcpMs: roundStat(metrics.lcpMs, 1),
    lcpElement: metrics.lcpElement ?? null,
    cls: roundStat(metrics.cls, 4),
    tbtMs: roundStat(metrics.tbtMs, 1),
    longTasksCount: metrics.longTasksCount ?? null,
    inpMs: roundStat(metrics.inpMs, 1),
    bootGoneMs: roundStat(metrics.bootGoneMs, 1),
    lkdvJsStartMs: roundStat(metrics.lkdvJsStartMs, 1),
    mapFirstPaintMs: roundStat(metrics.mapFirstPaintMs, 1),
    mapInteractiveMs: roundStat(metrics.mapInteractiveMs, 1),
    jsInitialTransferKb: roundStat((metrics.jsInitialTransferBytes || 0) / 1024, 1),
    jsInitialDecodedKb: roundStat((metrics.jsInitialDecodedBytes || 0) / 1024, 1),
    jsTotalDecodedKb: roundStat((metrics.jsTotalDecodedBytes || 0) / 1024, 1),
    jsWireTotalKb: roundStat(jsWireBytesTotal / 1024, 1),
    jsFileCount: metrics.jsResourceFileCount ?? jsCdpFiles,
    textLen: metrics.textLen ?? 0,
  };
}

function summarizeRouteProfile(entry, profileName, runs) {
  const measuredRuns = runs.filter((r) => !r.warmup);
  const effectiveRuns = measuredRuns.length ? measuredRuns : runs;
  const last = effectiveRuns[effectiveRuns.length - 1] ?? runs[0];

  const okRuns = effectiveRuns.filter((r) => r.status === 'measured');
  const statRuns = okRuns.length ? okRuns : effectiveRuns;

  const summary = {
    ttfbMs: summarizeMetric(statRuns.map((r) => r.ttfbMs), 0),
    fcpMs: summarizeMetric(statRuns.map((r) => r.fcpMs), 0),
    lcpMs: summarizeMetric(statRuns.map((r) => r.lcpMs), 0),
    cls: {
      max: roundStat(Math.max(0, ...statRuns.map((r) => r.cls ?? 0)), 3),
      p50: roundStat(quantile(statRuns.map((r) => r.cls ?? 0), 0.5), 3),
    },
    tbtMs: summarizeMetric(statRuns.map((r) => r.tbtMs), 0),
    inpMs: summarizeMetric(statRuns.map((r) => r.inpMs), 0),
    bootGoneMs: summarizeMetric(statRuns.map((r) => r.bootGoneMs), 0),
    jsInitialTransferKb: roundStat(quantile(statRuns.map((r) => r.jsInitialTransferKb), 0.5), 1),
    jsInitialDecodedKb: roundStat(quantile(statRuns.map((r) => r.jsInitialDecodedKb), 0.5), 1),
    jsWireTotalKb: roundStat(quantile(statRuns.map((r) => r.jsWireTotalKb), 0.5), 1),
    jsFileCount: roundStat(quantile(statRuns.map((r) => r.jsFileCount), 0.5), 0),
    consoleErrorsMax: Math.max(0, ...effectiveRuns.map((r) => r.consoleErrorsCount || 0)),
    pageErrorsMax: Math.max(0, ...effectiveRuns.map((r) => r.pageErrorsCount || 0)),
    lcpElement: statRuns.find((r) => r.lcpElement)?.lcpElement ?? null,
  };

  return {
    route: entry.route,
    path: entry.path,
    profile: profileName,
    tier: entry.tier,
    initialHttpStatus: last?.initialHttpStatus ?? null,
    httpStatus: last?.httpStatus ?? null,
    finalPath: last?.finalPath ?? null,
    redirectChain: last?.redirectChain ?? [],
    status: last?.status ?? 'error',
    reason: last?.reason ?? null,
    summary,
    runs,
  };
}

async function measureTabSwitches({ browser, baseUrl, profileCfg, storageState, timeoutMs }) {
  const context = await browser.newContext({
    ...profileCfg.contextOptions,
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  if (profileCfg.throttle) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  let startUrl = `${baseUrl}/hub`;
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(profileCfg.throttle ? 2500 : 1200);

  let currentPath = new URL(page.url()).pathname;
  if (currentPath === '/connexion') {
    startUrl = `${baseUrl}/explorer`;
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(profileCfg.throttle ? 2500 : 1200);
    currentPath = new URL(page.url()).pathname;
  }

  const navVisible = await page
    .locator('nav[aria-label="Navigation principale"]')
    .isVisible()
    .catch(() => false);

  if (!navVisible) {
    await cdp.detach().catch(() => {});
    await context.close();
    return [
      {
        profile: profileCfg.name,
        status: 'skipped',
        reason: `FloatingLiquidTabBar non visible sur ${currentPath} (viewport ${profileCfg.contextOptions.viewport.width}px)`,
      },
    ];
  }

  const results = [];
  for (let idx = 1; idx < TAB_SWITCH_SEQUENCE.length; idx += 1) {
    const from = new URL(page.url()).pathname;
    const to = TAB_SWITCH_SEQUENCE[idx];
    if (from === to) continue;

    const link = page.locator(`nav[aria-label="Navigation principale"] a[href="${to}"]`).first();
    const visible = await link.isVisible().catch(() => false);
    if (!visible) {
      results.push({
        profile: profileCfg.name,
        from,
        to,
        status: 'skipped',
        reason: `Lien ${to} absent dans FloatingLiquidTabBar`,
      });
      continue;
    }

    const before = await page.evaluate(() => {
      window.__prevPageRoot = document.querySelector('[data-page-root]') || null;
      const jsBytes = performance
        .getEntriesByType('resource')
        .filter((r) => r.initiatorType === 'script' || /\.m?js(\?|$)/i.test(r.name))
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
      return { jsBytes, resCount: performance.getEntriesByType('resource').length };
    });

    const tClick = Date.now();
    let clickError = null;
    try {
      await link.click({ timeout: 10_000 });
    } catch (err) {
      clickError = err instanceof Error ? err.message.split('\n')[0].slice(0, 180) : String(err).slice(0, 180);
    }

    if (clickError) {
      results.push({
        profile: profileCfg.name,
        from,
        to,
        finalPath: from,
        status: 'skipped',
        reason: clickError,
        commitMs: null,
        paintMs: null,
        settledMs: null,
        remounted: null,
        jsDeltaKb: null,
        fpsP50: null,
      });
      break;
    }

    let committed = true;
    try {
      await page.waitForFunction((expected) => window.location.pathname === expected, to, {
        timeout: 15_000,
      });
    } catch {
      committed = false;
    }
    const commitMs = Date.now() - tClick;

    const afterPath = new URL(page.url()).pathname;
    if (!committed || afterPath !== to) {
      results.push({
        profile: profileCfg.name,
        from,
        to,
        finalPath: afterPath,
        status: afterPath === '/connexion' ? 'auth_blocked' : 'error',
        commitMs,
        paintMs: null,
        settledMs: null,
        remounted: null,
        jsDeltaKb: null,
        fpsP50: null,
      });
      break;
    }

    await page
      .evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      .catch(() => {});
    const paintMs = Date.now() - tClick;

    await page.waitForTimeout(profileCfg.throttle ? 1200 : 600);
    const settledMs = Date.now() - tClick;

    const after = await page.evaluate(async () => {
      const curRoot = document.querySelector('[data-page-root]') || null;
      const remounted = window.__prevPageRoot != null && curRoot != null ? curRoot !== window.__prevPageRoot : null;
      const jsBytes = performance
        .getEntriesByType('resource')
        .filter((r) => r.initiatorType === 'script' || /\.m?js(\?|$)/i.test(r.name))
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);

      // Échantillon rAF de 1 s (défilement léger simulé)
      window.scrollBy(0, 120);
      const deltas = await new Promise((resolve) => {
        const vals = [];
        let last = performance.now();
        const start = last;
        const step = (now) => {
          vals.push(now - last);
          last = now;
          if (now - start < 1000) requestAnimationFrame(step);
          else resolve(vals);
        };
        requestAnimationFrame(step);
      });
      const sorted = [...deltas].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 16.67;
      return {
        remounted,
        jsBytes,
        fpsP50: Math.round((1000 / p50) * 10) / 10,
      };
    });

    results.push({
      profile: profileCfg.name,
      from,
      to,
      finalPath: afterPath,
      status: 'measured',
      commitMs,
      paintMs,
      settledMs,
      remounted: after.remounted,
      jsDeltaKb: roundStat(Math.max(0, after.jsBytes - before.jsBytes) / 1024, 1),
      fpsP50: after.fpsP50,
    });
  }

  await cdp.detach().catch(() => {});
  await context.close();
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const routes = resolveRoutes(opts);
  const profiles = opts.profile === 'both' ? ['mobile', 'desktop'] : [opts.profile];
  const executablePath = resolveChromeExecutable(opts.chromePath);
  const launchOptions = {
    headless: opts.headless,
    ...(executablePath ? { executablePath } : {}),
  };

  const browser = await chromium.launch(launchOptions);
  const browserLabel = executablePath
    ? `${path.basename(executablePath)} (${browser.version()})`
    : `Playwright Chromium (${browser.version()})`;

  const routeResults = [];
  for (const profileName of profiles) {
    const profileCfg = getProfileConfig(profileName);
    console.info(`\n=== Profil ${profileName} (${routes.length} routes, warmup=${opts.warmup}, runs=${opts.runs}) ===`);
    for (const entry of routes) {
      const totalPasses = opts.warmup + opts.runs;
      const runs = [];
      let shortCircuitStatus = null;
      for (let pass = 0; pass < totalPasses; pass += 1) {
        const isWarmup = pass < opts.warmup;
        const runRes = await measureSingleRun({
          browser,
          baseUrl: opts.baseUrl,
          entry,
          profileCfg,
          storageState: opts.storageState,
          timeoutMs: opts.timeoutMs,
          runIndex: pass,
          isWarmup,
        });
        runs.push(runRes);
        // Si la route est bloquée par auth ou 404 dès le premier passage non-warmup (ou warmup),
        // inutile de multiplier les tentatives identiques si warmup=0/runs>1, mais si warmup=1
        // on garde au moins 1 passage non-warmup pour summary.
        if (!isWarmup && (runRes.status === 'auth_blocked' || runRes.status === 'not_found')) {
          shortCircuitStatus = runRes.status;
          break;
        }
      }
      const summarized = summarizeRouteProfile(entry, profileName, runs);
      routeResults.push(summarized);
      const s = summarized.summary;
      console.info(
        `[${profileName}] ${entry.route.padEnd(32)} | ${summarized.status.padEnd(12)} | ` +
          `HTTP ${String(summarized.initialHttpStatus ?? '?')}→${String(summarized.httpStatus ?? '?')} | ` +
          `TTFB ${s.ttfbMs.p50 ?? '—'}ms | FCP ${s.fcpMs.p50 ?? '—'}ms | LCP ${s.lcpMs.p50 ?? '—'}ms | ` +
          `TBT ${s.tbtMs.p50 ?? '—'}ms | CLS ${s.cls.max ?? '—'} | JS ${s.jsWireTotalKb ?? '—'}Ko` +
          (shortCircuitStatus ? ` (${shortCircuitStatus})` : '')
      );
    }
  }

  let tabSwitches = [];
  if (opts.tabSwitch) {
    for (const profileName of profiles) {
      const profileCfg = getProfileConfig(profileName);
      console.info(`\n=== Tab-Switch (${profileName}) ===`);
      const sw = await measureTabSwitches({
        browser,
        baseUrl: opts.baseUrl,
        profileCfg,
        storageState: opts.storageState,
        timeoutMs: opts.timeoutMs,
      });
      tabSwitches = tabSwitches.concat(sw);
      for (const item of sw) {
        console.info(
          `[tab:${item.profile}] ${item.from || '?'} -> ${item.to || '?'} | ${item.status} | ` +
            `commit=${item.commitMs ?? '—'}ms paint=${item.paintMs ?? '—'}ms settled=${item.settledMs ?? '—'}ms ` +
            `remount=${item.remounted ?? '—'} jsDelta=${item.jsDeltaKb ?? '—'}Ko fps=${item.fpsP50 ?? '—'}`
        );
      }
    }
  }

  await browser.close();

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      baseUrl: opts.baseUrl,
      gitSha: getGitSha(),
      browser: browserLabel,
      executablePath: executablePath || 'playwright-bundled',
      profiles,
      runs: opts.runs,
      warmup: opts.warmup,
      storageStateUsed: Boolean(opts.storageState),
    },
    routes: routeResults,
    tabSwitches,
  };

  if (opts.out) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`);
    console.info(`\nRapport JSON écrit : ${opts.out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
