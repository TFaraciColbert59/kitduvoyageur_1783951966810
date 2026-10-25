import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BASE_URL, RUN_DIR } from './env';
import { ensureShareCookie, gotoRetry } from './net';
import { acquirePrepSlot } from './quota';

/**
 * Aides de navigation dans le Compas : ouvrir une étape, son tiroir, un onglet
 * de tiroir, régler les trois hauteurs, saisir « Dis-le », lancer une
 * préparation et attendre son issue, capturer. Les sélecteurs passent par les
 * rôles et noms accessibles (ceux de l'inventaire), les classes `cp-*` ne
 * servent qu'à délimiter une zone.
 */
export type Etape = 'ou' | 'nous' | 'resa' | 'verdict' | 'kit';
export type Detent = 'small' | 'medium' | 'large';
export const ETAPE_LABEL: Record<Etape, string> = { ou: 'Où', nous: 'Nous', resa: 'Résa', verdict: 'Verdict', kit: 'Kit' };
/** Nom du bouton ≡ de chaque étape (compas.screen.details*). */
export const DETAILS_LABEL: Record<Etape, string> = {
  ou: 'Détails : Préparer',
  nous: 'Détails : Nous',
  resa: 'Détails : Mes réservations',
  verdict: 'Détails : Verdict',
  kit: 'Détails : Kit',
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Connexion ---------- */

export type LoginMode = 'essai' | 'demo';

/**
 * Essai sans compte (un espace propre) dès qu'il est ouvert, sinon le compte
 * démo partagé. Retourne le mode réellement obtenu.
 */
export async function login(page: Page): Promise<LoginMode> {
  await ensureShareCookie(page);
  await gotoRetry(page, `${BASE_URL}/connexion?next=/compas`);
  const btn = page.getByRole('button', { name: /^(Essayer sans compte|Connexion démo)$/ }).first();
  await btn.waitFor({ timeout: 60_000 });
  const label = (await btn.innerText()).trim();
  await btn.click();
  // Le chemin, pas l'URL entière (« /connexion?next=%2Fcompas » contient « compas »).
  await page.waitForURL((u) => u.pathname.startsWith('/compas'), { timeout: 90_000 });
  return label.startsWith('Essayer') ? 'essai' : 'demo';
}

/* ---------- Ouvrir le Compas ---------- */

export async function openCompas(page: Page, query: { etape?: Etape; nouvelle?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (query.nouvelle) qs.set('nouvelle', '1');
  if (query.etape) qs.set('etape', query.etape);
  await gotoRetry(page, `${BASE_URL}/compas${qs.size ? `?${qs}` : ''}`);
  if (new URL(page.url()).pathname.startsWith('/connexion')) throw new Error('[banc] session perdue : la page renvoie à /connexion');
  await expect(page.locator('.compas').first()).toBeVisible({ timeout: 90_000 });
  // Hydratation : React répond quand le réseau se calme (la carte charge ensuite).
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
}

export const openStart = (page: Page) => openCompas(page, { nouvelle: true });
/** Ouvre directement une étape (`?etape=`) d'une aventure existante. */
export const openStep = (page: Page, etape: Etape) => openCompas(page, { etape });

/** Bouton de la capsule d'étapes (son nom peut finir par « , alerte : … »). */
export function stepButton(page: Page, etape: Etape): Locator {
  return page.locator('.compas .cp-steps').getByRole('button', { name: new RegExp(`^${esc(ETAPE_LABEL[etape])}\\s*(,|$)`) });
}

export async function expectStep(page: Page, etape: Etape) {
  await expect(stepButton(page, etape)).toHaveAttribute('aria-current', 'step');
}

/* ---------- Tiroirs (trois hauteurs) ---------- */

export const sheet = (page: Page) => page.locator('.cp-sheet[role="dialog"]').last();
export const detailsButton = (page: Page, etape: Etape) => page.getByRole('button', { name: DETAILS_LABEL[etape], exact: true });
export const grab = (page: Page) => sheet(page).locator('.cp-sheet__grab');

export async function detentOf(page: Page): Promise<Detent | null> {
  if (!(await sheet(page).isVisible().catch(() => false))) return null;
  return (await sheet(page).getAttribute('data-detent')) as Detent | null;
}

export async function expectDetent(page: Page, d: Detent | null) {
  if (d == null) await expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(0);
  else await expect(sheet(page)).toHaveAttribute('data-detent', d);
}

/** Ouvre le tiroir de l'étape courante par ≡ (sans le compter comme couvert : à faire via `cover`). */
export async function openDrawer(page: Page, etape: Etape) {
  await detailsButton(page, etape).click();
  await expect(sheet(page)).toBeVisible();
}

/** Onglet du tiroir (Activité, Parcours, Quand…). */
export const flowTab = (page: Page, label: string) =>
  sheet(page).locator('.cp-seg').first().getByRole('button', { name: label, exact: true });

/**
 * Amène le tiroir à la hauteur voulue par la poignée, au toucher
 * (petit → moyen → grand → moyen) ; `null` ferme.
 */
export async function setDetent(page: Page, target: Detent | null) {
  for (let i = 0; i < 4; i += 1) {
    const now = await detentOf(page);
    if (now === target) return;
    if (target == null) {
      await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
      continue;
    }
    await grab(page).click();
  }
  await expectDetent(page, target);
}

/** Glisse la poignée (vers le haut : agrandir ; vers le bas : réduire puis fermer). */
export async function dragGrab(page: Page, direction: 'up' | 'down') {
  const box = await grab(page).boundingBox();
  if (!box) throw new Error('[banc] poignée du tiroir introuvable');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + (direction === 'up' ? -60 : 60), { steps: 10 });
  await page.mouse.up();
}

/* ---------- Demande et préparation ---------- */

/** La zone « Ta demande » du Compas vide. */
export const requestBox = (page: Page) => page.getByRole('textbox', { name: 'Ta demande' });
export const prepareButton = (page: Page) => page.getByRole('button', { name: 'Préparer mon aventure' });
export const prepPanel = (page: Page) => page.getByRole('status', { name: 'Préparation de l’aventure' });

/**
 * Saisit la demande et attend que « Préparer » soit actif : la saisie ne tient
 * qu'une fois la page hydratée, d'où la reprise (comme validate-online.mjs).
 */
export async function typeRequest(page: Page, text: string) {
  const box = requestBox(page);
  await box.waitFor({ timeout: 60_000 });
  for (let k = 0; k < 5; k += 1) {
    await box.fill('');
    await box.pressSequentially(text, { delay: 10 });
    if (await prepareButton(page).isEnabled().catch(() => false)) return;
    await page.waitForTimeout(1500);
  }
  await expect(prepareButton(page)).toBeEnabled();
}

export type PrepOutcome = { outcome: 'prête' | 'interrompue' | 'arrêtée'; seconds: number; text: string; waitedMs: number };

/** Attend l'issue d'une préparation visible (jusqu'à 330 s, la limite serveur et sa marge). */
export async function waitPrepOutcome(page: Page, t0 = Date.now(), timeout = 340_000): Promise<Omit<PrepOutcome, 'waitedMs'>> {
  const panel = prepPanel(page);
  await panel.waitFor({ timeout: 90_000 });
  const heading = panel.getByRole('heading', { name: /Ton aventure est prête|Préparation interrompue|Préparation arrêtée/ });
  await heading.waitFor({ timeout });
  const h = (await heading.innerText()).trim();
  const outcome = h.includes('prête') ? 'prête' : h.includes('interrompue') ? 'interrompue' : 'arrêtée';
  return { outcome, seconds: Math.round((Date.now() - t0) / 1000), text: (await panel.innerText()).slice(0, 800) };
}

/**
 * Lance une préparation depuis le Compas vide, en respectant la file partagée
 * (6 / 10 min / personne). `key` : le compte qui prépare (fixture `account.key`).
 * Le délai du test est allongé du temps d'attente dans la file.
 */
export async function launchPreparation(page: Page, text: string, key: string, click?: () => Promise<void>): Promise<PrepOutcome> {
  let info: ReturnType<typeof test.info> | null = null;
  try {
    info = test.info();
  } catch {
    info = null; // appelé hors d'un test (fixture de worker)
  }
  const { waitedMs } = await acquirePrepSlot(key, (ms) => info?.setTimeout(info.timeout + ms + 1_000));
  const t0 = Date.now();
  await typeRequest(page, text);
  if (click) await click();
  else await prepareButton(page).click();
  const res = await waitPrepOutcome(page, t0);
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.appendFileSync(path.join(RUN_DIR, 'preparations.jsonl'), JSON.stringify({ key, request: text, waitedMs, ...res, at: new Date().toISOString() }) + '\n');
  return { ...res, waitedMs };
}

/* ---------- État observable ---------- */

/** L'IA du site est-elle allumée ? Observable sur le Compas vide (mention « Une IA peut t’aider… »). */
export async function aiState(page: Page): Promise<'allumée' | 'éteinte'> {
  return (await page.locator('.compas--start .cp-ai').count()) > 0 ? 'allumée' : 'éteinte';
}

/** Aucun défilement horizontal de la page (check-list §6). */
export async function expectNoHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'défilement horizontal de la page').toBeLessThanOrEqual(cw);
}

/* ---------- Captures ---------- */

export async function capture(page: Page, name: string) {
  const info = test.info();
  const slug = info.titlePath
    .slice(1)
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .slice(0, 80);
  const file = path.join(RUN_DIR, 'captures', `${slug}--${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  await info.attach(name, { path: file, contentType: 'image/png' });
  return file;
}
