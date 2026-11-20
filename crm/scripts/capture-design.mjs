#!/usr/bin/env node
/**
 * Captures de design (maquette ↔ écrans réels) en mode prévisualisation.
 * Prérequis : `next dev` sur 4200 avec CRM_DESIGN_PREVIEW=1 et NEXT_PUBLIC_CRM_DESIGN_PREVIEW=1.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.CRM_PREVIEW_URL || 'http://127.0.0.1:4200';
const OUT = path.resolve(process.cwd(), '../crm/bundle/etat/preuves/design');
mkdirSync(OUT, { recursive: true });
const manifest = [];

const CAS = '/cas/post_report/d1000000-0000-4000-8000-000000000002';
const MEMBRE = '/membres/d1200000-0000-4000-8000-000000000001';
const VALIDER = '/valider/d1300000-0000-4000-8000-000000000001';
const SOS = '/sos/d1000000-0000-4000-8000-000000000001';
const COMMANDE = '/commandes/d1400000-0000-4000-8000-000000000001';

const shots = [
  { name: '01-main', url: '/' },
  { name: '02-moderation', url: CAS },
  { name: '03-moderation-motif', url: CAS, act: async (p) => {
      await p.selectOption('#decision-reason', { index: 3 });
      await p.fill('#decision-precision', 'Propos répétés sous deux carnets, déjà rappelé le 12 octobre.').catch(() => {});
    } },
  { name: '04-moderation-menu', url: CAS, act: async (p) => { await p.getByRole('button', { name: 'Plus d’actions' }).click(); } },
  { name: '05-moderation-drawer', url: CAS, act: async (p) => {
      await p.getByRole('button', { name: 'Plus d’actions' }).click();
      await p.waitForTimeout(300);
      await p.getByRole('button', { name: 'Supprimer le commentaire' }).click();
    } },
  { name: '06-membre', url: MEMBRE },
  { name: '07-membre-pii', url: MEMBRE, act: async (p) => { await p.getByRole('button', { name: /Afficher/i }).first().click(); } },
  { name: '08-membre-drawer', url: MEMBRE, act: async (p) => { await p.getByRole('button', { name: 'Suspendre' }).first().click(); } },
  { name: '09-valider', url: VALIDER },
  { name: '10-valider-saisie', url: VALIDER, act: async (p) => {
      await p.locator('#approval-confirmation').fill('89,90 €');
    } },
  { name: '11-equipe', url: '/equipe' },
  { name: '12-equipe-arret', url: '/equipe', act: async (p) => { await p.getByRole('button', { name: /^Arrêter/ }).first().click(); } },
  { name: '13-journal', url: '/journal' },
  { name: '14-commande', url: '/', act: async (p) => { await p.keyboard.press('Control+k'); await p.waitForTimeout(400); } },
  { name: '15-commande-drawer', url: '/', act: async (p) => {
      await p.keyboard.press('Control+k');
      await p.waitForTimeout(400);
      await p.keyboard.type('masquer');
      await p.waitForTimeout(400);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(500);
    } },
  { name: '16-sos-mobile', url: SOS, width: 390, height: 844 },
  { name: '17-connexion', url: '/connexion' },
  { name: '18-connexion-mobile', url: '/connexion', width: 390, height: 844 },
  { name: '19-mfa', url: '/double-authentification' },
  { name: '20-acces-refuse', url: '/acces-refuse' },
  { name: '21-catalogue', url: '/catalogue' },
  { name: '22-pole-confiance', url: '/pole/CONF' },
  { name: '23-commande-fiche', url: COMMANDE },
  { name: '24-technique', url: '/technique' },
  { name: '25-entrainement', url: '/entrainement' }
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width ?? 1440, height: shot.height ?? 1040 }, deviceScaleFactor: 1 });
  page.on('pageerror', () => {});
  try {
    await page.goto(BASE + shot.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    if (shot.act) { await shot.act(page); await page.waitForTimeout(600); }
    const file = `${shot.name}-${shot.width ?? 1440}x${shot.height ?? 1040}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    manifest.push({ name: shot.name, url: shot.url, file, width: shot.width ?? 1440, height: shot.height ?? 1040 });
    console.log('OK', file);
  } catch (error) {
    console.log('FAIL', shot.name, String(error).slice(0, 200));
    manifest.push({ name: shot.name, url: shot.url, error: String(error).slice(0, 300) });
  }
  await page.close();
}
await browser.close();
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), shots: manifest }, null, 2));
console.log('manifest', manifest.length);
