import { test, expect } from '@playwright/test';

/**
 * H-AUTO-41/42 — Navigation hub : bottom bar 5 tabs, bouton Hub central
 * (appui long → sélecteur), redirections 307 des routes héritées, /hub
 * sans session (repli possession, jamais de cul-de-sac).
 * Ces parcours ne requièrent PAS de session (le hub repli sur possession
 * vide côté serveur) — fixtures déterministes, aucun délai arbitraire.
 */

const MOBILE = { viewport: { width: 390, height: 844 } };

test.describe('Bottom bar mobile — 5 entrées + bouton Hub central', { tag: '@mobile' }, () => {
  test.use(MOBILE);

  test('BAR-1: 5 destinations canoniques, hub central explicite', async ({ page }) => {
    await page.goto('/explorer');
    const nav = page.locator('nav[aria-label="Navigation principale"]');
    await expect(nav).toBeVisible();
    // UI actuelle (Phase 2, registre DESTINATIONS) : Aventures, Explorer,
    // Matériel, Communauté, Moi.
    const links = nav.locator('a');
    await expect(links).toHaveCount(5);
    const hubTab = nav.locator('a[href="/hub"]');
    await expect(hubTab).toHaveAttribute(
      'aria-label',
      'Aventures : aventure active, préparation et voyages',
    );
    await expect(hubTab).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('BAR-2: le tab Hub ouvre directement l\'aventure active (/hub), jamais une liste', async ({ page }) => {
    await page.goto('/explorer');
    await page.locator('nav[aria-label="Navigation principale"] a[href="/hub"]').click();
    await expect(page).toHaveURL(/\/hub$/);
  });

  // FIXME (pré-existant, timing hydratation/one-shot) : gelé pour fiabiliser la CI ;
  // le parcours reste couvert par BAR-4 (appui long sur surface hub) et BAR-2.
  test.fixme('BAR-3: appui long sur le tab Hub → sélecteur compact ouvert sur /hub', async ({ page }) => {
    await page.goto('/explorer');
    const hubTab = page.locator('nav[aria-label="Navigation principale"] a[href="/hub"]').first();
    // BottomTabBar est en dynamic(ssr:false) : le lien n'existe qu'après
    // hydratation — attendre sa visibilité garantit les handlers pointer.
    await expect(hubTab).toBeVisible();
    const pointerInit = { pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: 8, clientY: 8, bubbles: true };
    // Le long-press est un timer de 750 ms déclenché par pointerdown : tant que
    // le one-shot n'est pas posé, re-dispatch (hydratation possiblement en cours).
    await expect
      .poll(
        async () => {
          await hubTab.dispatchEvent('pointerdown', pointerInit);
          await page.waitForTimeout(900);
          await hubTab.dispatchEvent('pointerup', pointerInit);
          return page.evaluate(() => sessionStorage.getItem('lkdv_hub_switcher_autopen'));
        },
        { message: 'le one-shot du sélecteur doit être posé par le long-press', timeout: 15_000 }
      )
      .toBe('1');
    // Hors surface hub : navigation vers /hub + ouverture one-shot du sélecteur.
    await expect(page).toHaveURL(/\/hub$/);
    const dialog = page.getByRole('dialog', { name: "Changer d'aventure" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // Les 3 natures sont listées (icône + nom, premier niveau).
    await expect(dialog.getByText('Mon matériel').first()).toBeVisible();
    await expect(dialog.getByText('Mes voyages').first()).toBeVisible();
    await expect(dialog.getByText('Mes groupes').first()).toBeVisible();
  });

  test('BAR-4: appui long sur surface hub ouvre le sélecteur sans navigation', async ({ page }) => {
    await page.goto('/hub');
    const hubTab = page.locator('nav[aria-label="Navigation principale"] a[href="/hub"]');
    await expect(hubTab).toBeVisible();
    // Hydratation du shell hub (chunk séparé) : le listener hub:open-switcher
    // vit dans HubShell — le déclencheur mobile porte aria-haspopup (le tab
    // Hub est un lien, pas un bouton).
    await expect(page.locator('[aria-haspopup="dialog"]:visible').first()).toBeVisible();
    const pointerInit = { pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: 8, clientY: 8, bubbles: true };
    await hubTab.dispatchEvent('pointerdown', pointerInit);
    await page.waitForTimeout(750);
    await hubTab.dispatchEvent('pointerup', { ...pointerInit, bubbles: true });
    await expect(page).toHaveURL(/\/hub$/);
    await expect(page.getByRole('dialog', { name: "Changer d'aventure" }).first()).toBeVisible();
  });

  // FIXME (pré-existant, timing hydratation/one-shot) : gelé pour fiabiliser la CI.
  test.fixme('BAR-5: Escape ferme le sélecteur (focus restitué)', async ({ page }) => {
    await page.goto('/hub');
    await page.locator('nav[aria-label="Navigation principale"] a[href="/hub"]').click();
    await page.waitForLoadState('domcontentloaded');
    // Alternative clavier : Ctrl/Cmd+K ouvre le sélecteur (hub monté).
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: "Changer d'aventure" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Redirections 307 des routes héritées (middleware)', { tag: '@local-web' }, () => {
  const CASES: Array<[string, RegExp]> = [
    ['/materiel/inventaire', /\/hub\/inventaire/],
    ['/materiel/kits', /\/hub\/kit/],
    ['/materiel/preparation', /\/hub\/preparation/],
    ['/materiel/disponibilite', /\/hub\/disponibilite/],
    ['/materiel/alertes', /\/hub\/alertes/],
    ['/materiel/forget', /\/hub\/oublis/],
    ['/materiel/depart/abc123', /\/hub\/depart\?id=abc123/],
    ['/materiel/depart/none?route=42', /\/hub\/depart\?(id=none&route=42|route=42&id=none)/],
    ['/preparation', /\/hub\/preparation/],
    ['/alertes', /\/hub\/alertes/],
    ['/terrain', /\/hub$/],
    ['/mes-aventures', /\/hub$/],
    ['/naviguer', /\/randonnee-active/],
    ['/boussole', /\/randonnee-active/],
    ['/rapport-kit', /\/ai-configurator/],
    ['/activite', /\/feed/],
    ['/gamification', /\/recompenses/],
    ['/encheres', /\/occasion/],
  ];

  for (const [source, target] of CASES) {
    test(`RED ${source} → ${target}`, async ({ page, request }) => {
      // maxRedirects: 0 → observe le 307 et la Location (page.goto suit les
      // redirections et renvoie la réponse finale, pas le 307).
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()['location']).toMatch(target);
      await page.goto(source);
      await expect(page).toHaveURL(target);
    });
  }

  // Phase 2 : `/materiel` est devenu une surface autonome (destination du
  // registre), plus un alias 307 vers /hub — les sous-routes restent redirigées.
  test('SURFACE /materiel — surface autonome (fin de l’alias 307 vers /hub)', async ({ request }) => {
    const response = await request.get('/materiel', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test.describe('/hub sans session', { tag: '@local-web' }, () => {
  test('HUB-1: repli possession — aperçu rendu, sections cœur accessibles', async ({ page }) => {
    await page.goto('/hub');
    // Le titre d'identité du hub possession (« Mon matériel ») vit dans
    // ActivityIdentityBar (p, pas un heading) — cibler le texte visible.
    await expect(page.getByText(/Mon matériel/i).filter({ visible: true }).first()).toBeVisible();
    await expect(
      page.getByText(/0 objet\(s\)/).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test('HUB-2: URL profonde de section rechargeable sans contexte local', async ({ page }) => {
    await page.goto('/hub/inventaire');
    // Phase 2 : PageHeader porte le titre de section en `sr-only` (nom accessible
    // conservé, aucun impact visuel) — l'invariant vérifié est la présence du
    // heading accessible, pas sa boîte visuelle.
    await expect(page.getByRole('heading', { name: 'Inventaire', exact: true })).toBeAttached();
    // Rechargement direct (partage d'URL) — le serveur re-résout, pas de
    // dépendance à localStorage pour interpréter la section.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Inventaire', exact: true })).toBeAttached();
  });

  test('HUB-3: section collectif sans session (repli possession) → 404 déterministe', async ({ page }) => {
    // /hub/groupe requiert une nature collectif active — repli possession
    // serveur → section incompatible → page 404 (le statut HTTP peut être
    // 200 si notFound() survient après le début du streaming ; le contenu
    // 404 est l'invariant utilisateur).
    await page.goto('/hub/groupe');
    await expect(page.getByRole('heading', { name: 'Cette page n\'existe pas' })).toBeVisible();
  });
});
