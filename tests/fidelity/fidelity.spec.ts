import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freezeClock, installCommunityV2Mock, waitForHydration } from '../e2e/communaute-v2.fixtures';
import { diffImages, type Rect } from './lib/diff';
import { compareMeasures, readMeasure } from './lib/measure';
import { playSteps } from './lib/steps';
import type { FidelityResult, MeasureResult, Scenario } from './lib/types';
import { SCENARIOS } from './scenarios';

/**
 * Banc de fidélité : pour chaque scénario × projet (taille × thème), capture de
 * l'app (build fixtures) et de la maquette (fichier), diff pixel hors masques
 * (seuil maxDiffPixelRatio 0,02), mesures DOM, sortie JSON par scénario dans
 * `tests/fidelity/out/<projet>/`. Le banc mesure, il ne corrige rien : par défaut
 * un écart ne fait pas échouer le test (FIDELITY_STRICT=1 le fait échouer).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolvePath(HERE, '../..');
const OUT = join(HERE, 'out');
const THRESHOLD = 0.02;
const ONLY = process.env.FIDELITY_ONLY ? new RegExp(process.env.FIDELITY_ONLY) : null;
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' });

async function frameBox(page: Page, selector: string | undefined): Promise<Rect> {
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  const full = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  if (!selector) return full;
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector);
  if (!box || box.w < 10 || box.h < 10) return full;
  // Le cliché ne sort jamais de la fenêtre.
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  return { x, y, w: Math.min(viewport.width - x, Math.round(box.w)), h: Math.min(viewport.height - y, Math.round(box.h)) };
}

async function maskRects(page: Page, selectors: string[], frame: Rect): Promise<Rect[]> {
  if (!selectors.length) return [];
  const rects = await page.evaluate((sels) => {
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      });
    }
    return out;
  }, selectors);
  return rects.map((r) => ({ x: r.x - frame.x, y: r.y - frame.y, w: r.w, h: r.h }));
}

async function openApp(ctx: BrowserContext, scenario: Scenario, baseURL: string): Promise<Page> {
  const page = await ctx.newPage();
  await installCommunityV2Mock(page, { role: scenario.app.session, appOrigin: baseURL, ...scenario.app.mock });
  await page.addInitScript((value) => localStorage.setItem('lkdv_cookie_consent', value), CONSENT);
  await freezeClock(page);
  await page.goto(scenario.app.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => undefined);
  if (scenario.app.hydrate) {
    await page.locator(scenario.app.hydrate).first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForHydration(page, scenario.app.hydrate);
  } else {
    await page.waitForTimeout(1_500);
  }
  await playSteps(page, scenario.app.steps, 'app');
  await page.waitForTimeout(700);
  return page;
}

async function openMaquette(ctx: BrowserContext, scenario: Scenario): Promise<Page> {
  const page = await ctx.newPage();
  await page.route(/^https?:/, (route) => route.abort());
  const url = `file://${join(REPO, scenario.maquette.file)}${scenario.maquette.hash ? `#${scenario.maquette.hash}` : ''}`;
  await page.goto(url, { waitUntil: 'load' });
  // Entrée de la maquette : l'écran de chargement simulé se retire seul.
  await page
    .waitForFunction(() => {
      const phone = document.querySelector<HTMLElement>('#phone');
      return !phone || phone.dataset.boot !== 'loading';
    }, undefined, { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1_200);
  await playSteps(page, scenario.maquette.steps, 'maquette');
  await page.waitForTimeout(900);
  return page;
}

async function newContext(browser: Browser, browserUse: { viewport: { width: number; height: number }; colorScheme: 'light' | 'dark' }): Promise<BrowserContext> {
  return browser.newContext({
    viewport: browserUse.viewport,
    colorScheme: browserUse.colorScheme,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
  });
}

const scenarios = SCENARIOS.filter((s) => !ONLY || ONLY.test(s.id));

for (const scenario of scenarios) {
  test(`${scenario.id}`, async ({ browser, baseURL }, testInfo) => {
    const started = Date.now();
    const project = testInfo.project.name;
    const use = testInfo.project.use as { viewport: { width: number; height: number }; colorScheme: 'light' | 'dark' };
    const dir = join(OUT, project);
    mkdirSync(dir, { recursive: true });

    const base: FidelityResult = {
      scenario: scenario.id,
      surface: scenario.surface,
      ecran: scenario.ecran,
      etat: scenario.etat,
      role: scenario.role,
      project,
      viewport: use.viewport,
      theme: use.colorScheme === 'dark' ? 'sombre' : 'clair',
      status: 'erreur',
      masques: scenario.masques,
      durationMs: 0,
    };
    const write = (result: FidelityResult) => {
      result.durationMs = Date.now() - started;
      writeFileSync(join(dir, `${scenario.id}.json`), JSON.stringify(result, null, 2));
    };

    if (scenario.nonAtteignable) {
      const why = [scenario.nonAtteignable.app && `app : ${scenario.nonAtteignable.app}`, scenario.nonAtteignable.maquette && `maquette : ${scenario.nonAtteignable.maquette}`]
        .filter(Boolean)
        .join(' ; ');
      write({ ...base, status: 'non-atteignable', reason: why });
      return;
    }

    let strictFailure: string | null = null;
    const appCtx = await newContext(browser, use);
    const maqCtx = await newContext(browser, use);
    try {
      let appPage: Page;
      let maqPage: Page;
      try {
        appPage = await openApp(appCtx, scenario, baseURL as string);
      } catch (error) {
        write({ ...base, status: 'non-atteignable', reason: `app : ${String(error).split('\n')[0].slice(0, 300)}` });
        return;
      }
      try {
        maqPage = await openMaquette(maqCtx, scenario);
      } catch (error) {
        write({ ...base, status: 'non-atteignable', reason: `maquette : ${String(error).split('\n')[0].slice(0, 300)}` });
        return;
      }

      const appFrameSel = use.viewport.width >= 768 && scenario.app.frameWide ? scenario.app.frameWide : scenario.app.frame;
      const maqFrameSel = scenario.maquette.frame;
      const appFrame = await frameBox(appPage, appFrameSel);
      const maqFrame = await frameBox(maqPage, maqFrameSel);

      const masks = [
        ...(await maskRects(appPage, scenario.masques.app, appFrame)),
        ...(await maskRects(maqPage, scenario.masques.maquette, maqFrame)),
      ];

      const shotOptions = { animations: 'disabled', caret: 'hide' } as const;
      const appPng = await appPage.screenshot({ ...shotOptions, clip: { x: appFrame.x, y: appFrame.y, width: appFrame.w, height: appFrame.h } });
      const maqPng = await maqPage.screenshot({ ...shotOptions, clip: { x: maqFrame.x, y: maqFrame.y, width: maqFrame.w, height: maqFrame.h } });

      const outcome = diffImages(appPng, maqPng, masks);
      const files = { app: `${scenario.id}.app.png`, maquette: `${scenario.id}.maquette.png`, diff: `${scenario.id}.diff.png` };
      writeFileSync(join(dir, files.app), appPng);
      writeFileSync(join(dir, files.maquette), maqPng);
      writeFileSync(join(dir, files.diff), outcome.diffPng);

      const results: MeasureResult[] = [];
      for (const spec of scenario.mesures) {
        const props = spec.props ?? [];
        const app = await readMeasure(appPage, spec.app, appFrameSel ?? null, props);
        const maq = await readMeasure(maqPage, spec.maquette, maqFrameSel, props);
        // Origine du cadre : si le cadre est la fenêtre, les rects sont déjà relatifs.
        results.push(...compareMeasures(spec, app, maq));
      }
      const okCount = results.filter((r) => r.ok).length;

      const pixelOk = outcome.ratio <= THRESHOLD;
      const result: FidelityResult = {
        ...base,
        status: pixelOk && okCount === results.length ? 'ok' : 'ecart',
        pixel: {
          compared: outcome.compared,
          appFrame: { w: appFrame.w, h: appFrame.h },
          maquetteFrame: { w: maqFrame.w, h: maqFrame.h },
          diffPixels: outcome.diffPixels,
          maskedPixels: outcome.maskedPixels,
          totalPixels: outcome.totalPixels,
          ratio: Math.round(outcome.ratio * 100000) / 100000,
          threshold: THRESHOLD,
          ok: pixelOk,
          hotspots: outcome.hotspots,
        },
        measures: { total: results.length, ok: okCount, results },
        files,
        durationMs: 0,
      };
      write(result);
      if (process.env.FIDELITY_STRICT === '1' && result.status !== 'ok') {
        strictFailure = `${scenario.id} : écart (pixels ${(outcome.ratio * 100).toFixed(1)} %, mesures ${okCount}/${results.length})`;
      }
    } catch (error) {
      write({ ...base, status: 'erreur', reason: String(error).split('\n')[0].slice(0, 400) });
    } finally {
      await appCtx.close();
      await maqCtx.close();
    }
    if (strictFailure) throw new Error(strictFailure);
  });
}
