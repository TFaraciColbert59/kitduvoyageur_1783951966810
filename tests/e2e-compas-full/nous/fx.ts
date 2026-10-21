import type { Locator, Page } from '@playwright/test';
import { test as base, expect, capture, type Account } from '../_lib/fixtures';
import type { Cover } from '../_lib/coverage';
import { detailsButton, flowTab, openStep, sheet, type Etape } from '../_lib/compas';

/**
 * Fixtures et aides du lot Nous + Kit.
 *
 * Par défaut : exactement les fixtures du banc (un espace d'essai neuf par worker, une
 * aventure réellement préparée). Option de mise au point `COMPAS_REUSE_STATE=<fichier
 * storageState>` : réutilise un espace d'essai déjà créé et déjà préparé (la création de
 * comptes anonymes est limitée par IP : « réessaie dans une heure »), sans lancer de
 * nouvelle préparation. Aucun jeton n'est écrit ici : le fichier est lu sur disque.
 */
const reuse = process.env.COMPAS_REUSE_STATE;

export const test = (reuse
  ? base.extend<
      object,
      { account: Account; preparedTrip: { ok: boolean; outcome: 'prête'; seconds: number; text: string; waitedMs: number } }
    >({
      account: [
        async ({}, provide) => {
          await provide({ mode: 'essai', statePath: reuse, key: 'reutilise' });
        },
        { scope: 'worker' },
      ],
      preparedTrip: [
        async ({}, provide) => {
          await provide({ ok: true, outcome: 'prête', seconds: 0, text: 'espace réutilisé', waitedMs: 0 });
        },
        { scope: 'worker' },
      ],
    })
  : base) as typeof base;

export { expect, capture };

/* ---------- Identifiants d'inventaire (rattachement explicite, règle d'or respectée) ---------- */

/** `C('CompasCards.tsx::KitRow::…')` → identifiant complet de l'inventaire. */
export const C = (suffix: string) => `src/features/compas/components/${suffix}`;

/** Un nom unique par passage : le même espace peut être rejoué sans collision. */
export const uniq = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}`;

/* ---------- Navigation ---------- */

/** Ouvre une étape et laisse l'hydratation se terminer (un toucher trop tôt est perdu). */
export async function openAt(page: Page, etape: Etape) {
  await openStep(page, etape);
  await expect(page.locator('.compas .cp-steps')).toBeVisible();
  await page.waitForTimeout(900);
}

/** Ouvre l'étape, son tiroir par ≡ (avec reprise si le toucher est perdu), puis un onglet. */
export async function openSheet(page: Page, etape: Etape, tab?: string) {
  await openAt(page, etape);
  await expect(async () => {
    if (!(await sheet(page).isVisible())) await detailsButton(page, etape).click();
    await expect(sheet(page)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  if (tab) await selectTab(page, tab);
}

/** Onglet du tiroir d'étape, par un simple toucher (hors couverture). */
export async function selectTab(page: Page, tab: string) {
  await flowTab(page, tab).click();
  await expect(flowTab(page, tab)).toHaveAttribute('aria-pressed', 'true');
}

export async function closeSheet(page: Page) {
  await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(0);
}

export async function backSheet(page: Page) {
  await sheet(page).getByRole('button', { name: 'Retour', exact: true }).click();
}

/** Bouton d'un tiroir par son texte (les icônes ajoutent leur nom : on filtre sur le texte). */
export const sbtn = (page: Page, text: RegExp | string) =>
  sheet(page).locator('button').filter({ hasText: typeof text === 'string' ? new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) : text });

/** Segment (onglet interne) d'un tiroir : « Fiche », « Boutique »… dans le groupe `.cp-seg`. */
export const seg = (scope: Locator, text: string) =>
  scope.locator('.cp-seg button').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\wÀ-ÿ])`) });

export const toast = (page: Page) => page.locator('.cp-island');

export const num = (s: string | null | undefined) => {
  const m = (s ?? '').replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/* ---------- Lignes d'objets (liste paginée par 5) ---------- */

export const rowsNamed = (page: Page, name: string) =>
  sheet(page)
    .locator('div.cp-row')
    .filter({ has: page.locator('button.cp-row__main') })
    .filter({ hasText: name });

/** Retrouve la ligne d'un objet en parcourant les pages de la liste du tiroir. */
export async function findRow(page: Page, name: string): Promise<Locator> {
  const prev = sheet(page).getByRole('button', { name: 'Page précédente' });
  for (let i = 0; i < 30 && (await prev.count()) && (await prev.isEnabled()); i += 1) await prev.click();
  const next = sheet(page).getByRole('button', { name: 'Page suivante' });
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(150);
    if (await rowsNamed(page, name).count()) return rowsNamed(page, name).first();
    if (!(await next.count()) || !(await next.isEnabled())) break;
    await next.click();
  }
  throw new Error(`[banc] objet « ${name} » introuvable dans la liste du tiroir`);
}

/** Ajoute un objet libre au kit depuis un onglet liste (« Tout »), hors couverture. */
export async function addFreeItem(page: Page, name: string, o: { vital?: boolean; consumable?: boolean; qty?: number; weight?: number } = {}) {
  await sheet(page).getByRole('button', { name: /Ajouter au kit/ }).click();
  await seg(sheet(page), 'Autre').click();
  const form = sheet(page).locator('form');
  await form.locator('input[name="itemName"]').fill(name);
  if (o.weight) await form.locator('input[name="weightGrams"]').fill(String(o.weight));
  if (o.vital) await form.locator('input[name="isVital"]').check();
  if (o.consumable) await form.locator('input[name="isConsumable"]').check();
  if (o.qty) await form.locator('input[name="quantity"]').fill(String(o.qty));
  await form.locator('button[type="submit"]').click();
  await expect(toast(page)).toContainText('ajouté au kit');
  await backSheet(page);
  await expect(async () => {
    await findRow(page, name);
  }).toPass({ timeout: 20_000 });
}

/** Retire un objet du kit par sa fiche (« Retirer du kit » puis confirmation), hors couverture. */
export async function removeItem(page: Page, name: string) {
  const row = await findRow(page, name);
  await row.locator('button.cp-row__main').click();
  await sbtn(page, 'Retirer du kit').click();
  await sbtn(page, 'Confirmer le retrait').click();
  await expect(sheet(page).locator('.cp-row__main').first()).toBeVisible();
  await expect(rowsNamed(page, name)).toHaveCount(0);
}

/**
 * Comme `cover.click`, mais avec le geste précisé (position, force…) : passe par la même
 * méthode privée de `Cover` (décrire → agir → vérifier l'EFFET → enregistrer).
 */
export function coverAct(
  cover: Cover,
  target: Locator,
  action: string,
  effet: string,
  act: () => Promise<unknown>,
  verify: () => Promise<unknown>,
  opts: { control?: string } = {},
  gesture?: string
) {
  return (cover as unknown as { run: (...a: unknown[]) => Promise<void> }).run(target, action, effet, act, verify, opts, gesture);
}

/**
 * Ouvre la fiche du premier objet de la page qui est relié à un produit de la boutique
 * (« Produit choisi ») ; le tiroir doit être sur une liste d'objets. Échoue s'il n'y en a aucun.
 */
export async function openItemWithProduct(page: Page) {
  const rows = sheet(page).locator('div.cp-row').filter({ has: page.locator('button.cp-row__main') });
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    await rows.nth(i).locator('button.cp-row__main').click();
    await expect(sheet(page).locator('dl.cp-kv')).toBeVisible();
    if (await sheet(page).locator('dl.cp-kv dt', { hasText: 'Produit choisi' }).count()) return;
    await backSheet(page);
    await expect(rows.first()).toBeVisible();
  }
  throw new Error('[banc] aucun objet de la liste n’est relié à un produit de la boutique (« Produit choisi »)');
}
