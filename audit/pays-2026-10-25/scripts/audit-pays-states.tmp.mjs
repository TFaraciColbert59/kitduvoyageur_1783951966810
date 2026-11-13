import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/Users/fr168256/lkdv/audit/pays-2026-10-25/avant';
const BASE = 'http://127.0.0.1:4000';
const browser = await chromium.launch();

// 1. Desktop 1440 — pleines pages par section
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);
  try { const b = page.getByRole('button', { name: /Refuser/i }).first(); if (await b.isVisible({ timeout: 2500 })) await b.click(); } catch {}
  for (const s of ['presentation', 'pratique', 'communaute']) {
    await page.locator(`text=${s === 'presentation' ? 'Présentation' : s === 'pratique' ? 'Pratique & Données' : 'Communauté'}`).first().click({ timeout: 5000 }).catch(async () => {
      await page.evaluate((sec) => window.dispatchEvent(new CustomEvent('pays-detail-tab-change', { detail: sec })), s);
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/desktop-${s}-1440-full.png`, fullPage: true });
    console.log('desktop', s, await page.evaluate(() => document.documentElement.scrollHeight));
  }
  await ctx.close();
}

// 2. État de chargement mobile (réseau bridé)
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1200, downloadThroughput: 40 * 1024, uploadThroughput: 20 * 1024 });
  page.goto(BASE + '/pays/fr', { waitUntil: 'commit', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/etat-chargement-430.png` });
  console.log('loading shot ok');
  await ctx.close();
}

// 3. État invité desktop (pas de session) déjà capturé ; état erreur 404 slug inconnu
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + '/pays/zz', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/etat-404-430.png` });
  console.log('404 status', resp?.status());
  await ctx.close();
}
await browser.close();
