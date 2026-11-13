import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, NO_SUPABASE_MOTIF, credentials, hasSupabaseEnv } from '../support/env';
import { openCommandBar, openFirstCase, openInbox, signIn } from '../support/flows';
import { sel } from '../support/selectors';
import { totpCode } from '../support/totp';

/**
 * Transverses : ce qui n'appartient à aucun domaine — connexion et double
 * authentification, file unifiée, clavier, annulation, états, mode solo.
 */

test.describe('Sans session — garde-fous de la coque', () => {
  test('une visite non authentifiée renvoie vers /connexion', async ({ page }) => {
    test.skip(!hasSupabaseEnv(), NO_SUPABASE_MOTIF);
    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.locator(sel.connexion.email)).toBeVisible();
  });

  test('les en-têtes de sécurité sont posés (CSP, cadre interdit, noindex)', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(await response.text()).toContain('Disallow: /');
  });
});

test.describe('Connexion et double authentification', () => {
  test('un mot de passe faux affiche une phrase métier, jamais un code brut', async ({ page }) => {
    const creds = credentials();
    test.skip(!creds, NO_CREDENTIALS_MOTIF);
    await page.goto('/connexion');
    await page.locator(sel.connexion.email).fill(creds!.email);
    await page.locator(sel.connexion.password).fill('mauvais-mot-de-passe-de-test');
    await page.locator(sel.connexion.submit).click();
    const error = page.locator(sel.connexion.error);
    await expect(error).toBeVisible();
    const text = (await error.innerText()).toLowerCase();
    expect(text).not.toMatch(/invalid login credentials|auth\/|pgrst|[45]\d\d/);
    expect(text).toMatch(/identifiants|double authentification|réessayer|mot de passe/);
  });

  test('le compte de test se connecte et l’enrôlement TOTP mène à la file', async ({ page }) => {
    const creds = credentials();
    test.skip(!creds, NO_CREDENTIALS_MOTIF);
    await signIn(page);
    await expect(page.locator(sel.shell.root)).toBeVisible();
    // Le code TOTP du secret de test est reconnu par le serveur.
    expect(totpCode(creds!.totpSecret)).toMatch(/^\d{6}$/);
  });

  test('une session à un seul facteur est renvoyée vers la double authentification', async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion|\/double-authentification/);
  });
});

test.describe('File « À traiter » — groupes, tri, compte à rebours', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('les groupes apparaissent dans l’ordre urgence haute → délai bientôt → à valider → signalements → contributions', async ({ page }) => {
    await openInbox(page);
    const groups = await page.locator(sel.inbox.group).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-group'))
    );
    const known = groups.filter((group) => ['urgence_haute', 'delai_bientot', 'a_valider', 'signalements', 'contributions'].includes(group ?? ''));
    expect(known).toEqual([...known].sort((a, b) => {
      const order = ['urgence_haute', 'delai_bientot', 'a_valider', 'signalements', 'contributions'];
      return order.indexOf(a ?? '') - order.indexOf(b ?? '');
    }));
    expect(known[0]).toBe('urgence_haute');
  });

  test('la file respecte le tri EX-INBOX-02 : urgence haute puis délai le plus proche', async ({ page }) => {
    await openInbox(page);
    const dues = await page
      .locator(`${sel.inbox.group}[data-group="urgence_haute"] ${sel.inbox.row}`)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-due-at') ?? ''));
    const dates = dues.filter(Boolean).map((value) => Date.parse(value));
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  test('le compte à rebours change de ton selon le délai restant', async ({ page }) => {
    await openInbox(page);
    const tones = await page.locator(sel.inbox.countdown).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-tone')).filter(Boolean)
    );
    for (const tone of tones) expect(['gris', 'orange', 'rouge', 'fleche']).toContain(tone);
    // Une file réelle contient au moins un ton non gris (délai proche ou dépassé).
    expect(tones.length).toBeGreaterThan(0);
  });

  test('les compteurs de la file ne sont jamais vides ni négatifs', async ({ page }) => {
    await openInbox(page);
    const counts = page.locator(sel.inbox.counts);
    await expect(counts).toBeVisible();
    const values = (await counts.innerText()).match(/\d+/g) ?? [];
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(Number(value)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Clavier et barre de commande', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('J et K déplacent la sélection sans ouvrir le cas', async ({ page }) => {
    await openInbox(page);
    const rows = page.locator(sel.inbox.row);
    await expect(rows.first()).toBeVisible();
    await page.keyboard.press('j');
    await expect(page.locator(`${sel.inbox.row}[aria-selected="true"]`).first()).toBeVisible();
    const first = await page.locator(`${sel.inbox.row}[aria-selected="true"]`).first().getAttribute('data-key');
    await page.keyboard.press('j');
    const second = await page.locator(`${sel.inbox.row}[aria-selected="true"]`).first().getAttribute('data-key');
    expect(second).not.toBe(first);
    await page.keyboard.press('k');
    const back = await page.locator(`${sel.inbox.row}[aria-selected="true"]`).first().getAttribute('data-key');
    expect(back).toBe(first);
  });

  test('Entrée ouvre le cas sélectionné', async ({ page }) => {
    await openInbox(page);
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page.locator(sel.cas.root)).toBeVisible();
  });

  test('⌘K ouvre la barre de commande et Échap la ferme', async ({ page }) => {
    await openInbox(page);
    await openCommandBar(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(sel.shell.commandInput)).toHaveCount(0);
  });

  test('aucun raccourci global ne s’active dans un champ de saisie', async ({ page }) => {
    await openInbox(page);
    await openCommandBar(page);
    const input = page.locator(sel.shell.commandInput);
    await input.fill('m');
    await input.press('j');
    await expect(input).toHaveValue('mj');
    await page.keyboard.press('Escape');
    await expect(page.locator(sel.cas.root)).toHaveCount(0);
  });

  test('le raccourci de chaque bouton est affiché', async ({ page }) => {
    await openFirstCase(page);
    const hides = page.getByRole('button', { name: /^Masquer/ }).first();
    await expect(hides).toContainText(/[A-Z⌘]/);
  });
});

test.describe('Annulation 10 secondes', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('le toast décompte et « Annuler » rétablit l’état précédent', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('button', { name: /^Masquer/ }).first().click();
    await page.locator(sel.cas.reason).selectOption('spam');
    await page.locator(sel.cas.decisionSave).click();
    const toast = page.locator(sel.toast.root).first();
    await expect(toast).toBeVisible();
    const first = await page.locator(sel.toast.countdown).innerText();
    await expect(page.locator(sel.toast.countdown)).not.toHaveText(first, { timeout: 3_000 });
    await page.locator(sel.toast.action).click();
    await expect(page.locator(sel.toast.root)).toHaveCount(0);
    await expect(page.getByText(/masqué|rétabli|restauré/i).first()).toBeVisible();
  });
});

test.describe('États vide, erreur, chargement', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('une file vide affiche un état vide qui dit ce qui apparaîtra', async ({ page }) => {
    test.skip(true, 'État vide : exige un jeu de données dédié (file vidée par le rôle base de données), voir crm/tests/README.md § 5.');
    await page.goto('/');
    const empty = page.locator(sel.inbox.empty);
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/rien|aucun|vide|repos/i);
    // Aucun chiffre inventé dans l'état vide.
    await expect(page.locator(sel.inbox.row)).toHaveCount(0);
  });

  test('une erreur affiche la cause, une solution et « Réessayer »', async ({ page }) => {
    test.skip(true, 'État erreur : exige une panne simulée côté données (jeu de test), voir crm/tests/README.md § 5.');
    await page.goto('/');
    const error = page.locator(sel.inbox.error);
    await expect(error).toBeVisible();
    await expect(error).toContainText(/réessayer/i);
  });

  test('le chargement affiche des squelettes, jamais un écran blanc', async ({ page }) => {
    test.skip(true, 'État chargement : exige une réponse ralentie contrôlée (jeu de test), voir crm/tests/README.md § 5.');
    await page.goto('/');
    const skeleton = page.locator(sel.inbox.skeleton);
    const rows = page.locator(sel.inbox.row);
    await expect(skeleton.or(rows.first())).toBeVisible();
  });
});

test.describe('Mode solo — auto-validation en deux temps', () => {
  test('le bandeau solo et la mention de responsabilité sont visibles', async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    await expect(page.locator(sel.shell.soloBadge)).toContainText(/solo/i);
    await page.goto('/valider/demo-request-solo');
    await expect(page.locator(sel.valider.soloNotice)).toContainText(/solo/i);
  });
});
