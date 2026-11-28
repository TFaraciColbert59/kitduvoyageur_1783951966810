#!/usr/bin/env node
/** axe-core sur les écrans de prévisualisation (design) et les écrans publics. */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.CRM_PREVIEW_URL || 'http://127.0.0.1:4200';
const pages = [
  ['/', 'main'], ['/cas/post_report/d1000000-0000-4000-8000-000000000002', 'cas'],
  ['/membres/d1200000-0000-4000-8000-000000000001', 'membre'],
  ['/valider/d1300000-0000-4000-8000-000000000001', 'valider'],
  ['/equipe', 'equipe'], ['/journal', 'journal'],
  ['/commandes/d1400000-0000-4000-8000-000000000001', 'commande'],
  ['/catalogue', 'catalogue'], ['/pole/CONF', 'pole'], ['/technique', 'technique'], ['/entrainement', 'entrainement'],
  ['/connexion', 'connexion'], ['/double-authentification', 'mfa'], ['/acces-refuse', 'acces-refuse']
];
const results = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 } });
for (const [url, name] of pages) {
  const page = await context.newPage();
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  results.push({ name, url, violations: scan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) });
  await page.close();
}
// SOS mobile
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await mobileContext.newPage();
await page.goto(BASE + '/sos/d1000000-0000-4000-8000-000000000001', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
results.push({ name: 'sos-mobile', url: '/sos/...', violations: scan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) });
await browser.close();
const out = path.resolve(process.cwd(), '../crm/bundle/etat/preuves/design/axe-design.json');
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const total = results.reduce((sum, r) => sum + r.violations.length, 0);
console.log(`axe: ${total} violations sur ${results.length} écrans`);
for (const r of results) if (r.violations.length) console.log(' ', r.name, JSON.stringify(r.violations));
