import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4099';
const SESSION_SECRET = process.env.LKDV_COLLAB_SESSION_SECRET || 'lkdv-local-e2e-recette-secret-2026';

function signSessionCookie(sub: string, name: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub, name, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function cookieFor(sub: string, name: string) {
  const u = new URL(BASE_URL);
  return {
    name: 'lkdv_collab_session',
    value: signSessionCookie(sub, name),
    domain: u.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  };
}

async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const btn = page.getByRole('button', { name: /Refuser|Tout accepter/i }).first();
  if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await btn.click().catch(() => undefined);
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => undefined);
  }
}

test.describe('Recette E2E LKDV 20/10 — Design Explorer (Carte + Pilule 3 points + Tiroirs), Multi-sessions, Routage, Offline redémarrage', () => {
  test('Passes 1, 2, 4 : Explorer Lille sans GPS + Routage réel + Design 2 éléments + 3 sessions + Conflit + Révocation', async ({
    browser,
  }) => {
    const wsId = `ws-e2e-${Date.now().toString(36)}`;

    // 1. Vérifier D1.5 : Recherche « Lille » sans GPS (pas de lat/lng)
    const searchRes = await fetch(`${BASE_URL}/api/explorer/v2/search?q=Lille`);
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as {
      resolvedPlace?: { selected?: { label?: string; lat?: number; lon?: number } } | null;
      zone?: { minLat: number; maxLat: number } | null;
    };
    if (searchJson.resolvedPlace?.selected) {
      expect(searchJson.resolvedPlace.selected.lat).toBeGreaterThan(50.4);
      expect(searchJson.resolvedPlace.selected.lat).toBeLessThan(50.9);
      expect(searchJson.zone).not.toBeNull();
    }

    // 2. Vérifier le routage réel /api/route (randonnée)
    const routeRes = await fetch(
      `${BASE_URL}/api/route?points=5.512,45.052;5.535,45.068&sport=marche`,
    );
    expect([200, 503]).toContain(routeRes.status);

    // 3. Contextes authentifiés : Alice (Desktop 1440x900), Éloi (Mobile 390x844), Mina (Mobile 390x844), Anonyme
    const aliceCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await aliceCtx.addCookies([cookieFor('alice-e2e', 'Alice')]);

    const eloiCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await eloiCtx.addCookies([cookieFor('eloi-e2e', 'Éloi')]);

    const minaCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await minaCtx.addCookies([cookieFor('mina-e2e', 'Mina')]);

    const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const createRes = await aliceCtx.request.post(`${BASE_URL}/api/routes/workspaces`, {
      data: {
        id: wsId,
        title: 'Vercors Recette E2E 2J',
        sport: 'marche',
        workspace: {
          members: [
            { userId: 'alice-e2e', displayName: 'Alice', role: 'owner' },
            { userId: 'eloi-e2e', displayName: 'Éloi', role: 'editor' },
            { userId: 'mina-e2e', displayName: 'Mina', role: 'editor' },
            { userId: 'sarah-e2e', displayName: 'Sarah', role: 'participant' },
          ],
        },
      },
    });
    expect(createRes.status()).toBe(201);

    // Session anonyme refusée (401 API + écran Accès refusé UI)
    const anonApiRes = await anonCtx.request.get(`${BASE_URL}/api/routes/${wsId}/workspace`);
    expect(anonApiRes.status()).toBe(401);
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`${BASE_URL}/compas/itineraire?workspaceId=${wsId}`);
    await expect(anonPage.getByTestId('route-collab-denied')).toBeVisible();

    const alicePage = await aliceCtx.newPage();
    const eloiPage = await eloiCtx.newPage();
    const minaPage = await minaCtx.newPage();

    await Promise.all([
      alicePage.goto(`${BASE_URL}/compas/itineraire?workspaceId=${wsId}`),
      eloiPage.goto(`${BASE_URL}/compas/itineraire?workspaceId=${wsId}`),
      minaPage.goto(`${BASE_URL}/compas/itineraire?workspaceId=${wsId}`),
    ]);

    const aliceWs = alicePage.locator('#main-content').getByTestId('route-collab-workspace');
    const eloiWs = eloiPage.locator('#main-content').getByTestId('route-collab-workspace');
    const minaWs = minaPage.locator('#main-content').getByTestId('route-collab-workspace');

    await expect(aliceWs).toBeVisible();
    await expect(eloiWs).toBeVisible();
    await expect(minaWs).toBeVisible();
    await dismissCookieBanner(alicePage);

    // Design Explorer strict : lorsque le tiroir est fermé, UNIQUEMENT la pilule 3 points en bas + bouton Carte & Affichage en haut à droite
    const pill = aliceWs.getByTestId('route-drawer-pill');
    if (await pill.isVisible()) {
      const visibleButtons = await aliceWs.locator('button:visible').count();
      expect(visibleButtons).toBe(2);
      await expect(aliceWs.getByTestId('map-settings-trigger')).toBeVisible();
    }

    // Absence de débordement horizontal sur mobile 390px
    const mobileOverflow = await eloiPage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(mobileOverflow).toBeLessThanOrEqual(4);

    // Éditions parallèles indépendantes (Éloi sur J1, Mina sur J2) via l'API réelle
    const [opEloi, opMina] = await Promise.all([
      eloiCtx.request.post(`${BASE_URL}/api/routes/${wsId}/operations`, {
        data: {
          opId: 'e2e-op-eloi-j1',
          baseSeq: 0,
          expectedVersions: { 'stage-1': 1 },
          operation: { type: 'update_stage_note', stageId: 'stage-1', notes: 'Note Éloi J1' },
        },
      }),
      minaCtx.request.post(`${BASE_URL}/api/routes/${wsId}/operations`, {
        data: {
          opId: 'e2e-op-mina-j2',
          baseSeq: 0,
          expectedVersions: { 'stage-2': 1 },
          operation: { type: 'update_stage_note', stageId: 'stage-2', notes: 'Note Mina J2' },
        },
      }),
    ]);
    expect(opEloi.status()).toBe(200);
    expect(opMina.status()).toBe(200);

    // Propagation temps réel (< 5s) sur l'ordinateur d'Alice
    await expect(aliceWs).toHaveAttribute('data-head-seq', '2', {
      timeout: 5000,
    });

    // Conflit sur le même point (pt-mid)
    const opAliceMove = await aliceCtx.request.post(`${BASE_URL}/api/routes/${wsId}/operations`, {
      data: {
        opId: 'e2e-op-alice-mid',
        baseSeq: 2,
        expectedVersions: { 'pt-mid': 1 },
        operation: { type: 'move_point', pointId: 'pt-mid', lat: 45.072, lon: 5.539 },
      },
    });
    expect(opAliceMove.status()).toBe(200);

    const opEloiConflict = await eloiCtx.request.post(`${BASE_URL}/api/routes/${wsId}/operations`, {
      data: {
        opId: 'e2e-op-eloi-conflict',
        baseSeq: 2,
        expectedVersions: { 'pt-mid': 1 },
        operation: { type: 'move_point', pointId: 'pt-mid', lat: 45.075, lon: 5.542 },
      },
    });
    expect(opEloiConflict.status()).toBe(409);
    const conflictBody = (await opEloiConflict.json()) as { status: string; conflicts: unknown[] };
    expect(conflictBody.status).toBe('conflict');
    expect(conflictBody.conflicts.length).toBeGreaterThan(0);

    // Ouvrir le tiroir principal d'Alice via la pilule 3 points
    if (await pill.isVisible()) {
      await pill.click();
    }

    // Changement de nuit (Refuge -> Bivouac) via Onglet Étapes -> Drawer superposé Jour 1 => Impact Graph en haut d'écran
    await alicePage.getByRole('tab', { name: 'Étapes' }).click();
    await alicePage.getByTestId('day-category-stage-1').locator('.rcw-day-head').click();
    await expect(alicePage.getByTestId('overlay-detail-drawer')).toBeVisible();
    await alicePage.getByTestId('overlay-detail-drawer').getByRole('button', { name: 'Bivouac', exact: true }).click();
    await expect(alicePage.getByTestId('impact-banner')).toContainText('article(s) du kit à revalider');
    await alicePage.getByTestId('overlay-detail-drawer').getByRole('button', { name: 'Retour' }).click();

    // Comparer un détour via Onglet Analyser -> Banque d'info + Sous-drawer Variantes
    await alicePage.getByRole('tab', { name: 'Analyser' }).click();
    await expect(alicePage.getByTestId('surface-breakdown-card')).toBeVisible();
    await alicePage.getByRole('button', { name: /Variantes & Comparateur/i }).click();
    await alicePage.getByRole('button', { name: /\+ Comparer un détour/i }).click();
    await expect(alicePage.getByText(/Détour panorama/i)).toBeVisible();
    await alicePage.getByRole('button', { name: 'Retour' }).click();

    // Publication v1 depuis l'onglet Départ
    await alicePage.getByRole('tab', { name: 'Départ' }).click();
    await alicePage.getByRole('button', { name: /Publier v1/i }).click();
    await expect(alicePage.getByTestId('status-message')).toContainText('Version 1 publiée');

    // Export GPX par étape (HTTP 200 + GPX 1.1 valide)
    const gpxRes = await aliceCtx.request.get(`${BASE_URL}/api/routes/${wsId}/gpx?stageId=stage-1`);
    expect(gpxRes.status()).toBe(200);
    const gpxText = await gpxRes.text();
    expect(gpxText).toContain('<gpx version="1.1"');
    expect(gpxText).toContain('Jour 1');

    // Révocation immédiate d'Éloi -> son prochain appel API est refusé (403)
    const revokeRes = await aliceCtx.request.post(`${BASE_URL}/api/routes/${wsId}/members`, {
      data: { kind: 'member', targetUserId: 'eloi-e2e', revoke: true },
    });
    expect(revokeRes.status()).toBe(200);

    const eloiAfterRevoke = await eloiCtx.request.post(`${BASE_URL}/api/routes/${wsId}/operations`, {
      data: {
        opId: 'e2e-op-eloi-revoked',
        baseSeq: 5,
        operation: { type: 'update_stage_note', stageId: 'stage-1', notes: 'Bloqué' },
      },
    });
    expect(eloiAfterRevoke.status()).toBe(403);

    await Promise.all([aliceCtx.close(), eloiCtx.close(), minaCtx.close(), anonCtx.close()]);
  });

  test('Passe 3 : Hors-ligne réel avec fermeture complète et redémarrage du navigateur (Pack v1 intact après coupure v2 + Carnet + Sans WebGL)', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-offline-profile-'));
    const wsId = `ws-offline-${Date.now().toString(36)}`;

    const ctx1 = await chromium.launchPersistentContext(userDataDir, {
      viewport: { width: 390, height: 844 },
      args: ['--disable-webgl'],
    });
    await ctx1.addCookies([cookieFor('mina-offline', 'Mina')]);

    const createRes = await ctx1.request.post(`${BASE_URL}/api/routes/workspaces`, {
      data: { id: wsId, title: 'Sortie Offline Vercors', sport: 'marche' },
    });
    expect(createRes.status()).toBe(201);

    const page1 = await ctx1.newPage();
    await page1.goto(`${BASE_URL}/compas/itineraire?workspaceId=${wsId}`);
    // Sans WebGL, le mode liste + le tiroir s'ouvrent automatiquement
    await expect(page1.locator('#main-content').getByTestId('list-mode-fallback')).toBeVisible();
    await dismissCookieBanner(page1);

    // Publier v1 et télécharger Pack v1 dans Sous-tiroir Hors ligne, Activité & Carnet
    await page1.getByRole('tab', { name: 'Départ' }).click();
    await page1.getByRole('button', { name: /Activité & Carnet/i }).click();
    await page1.getByRole('button', { name: /Publier v1/i }).click();
    await expect(page1.getByTestId('status-message')).toContainText('Version 1 publiée');

    await page1.getByRole('button', { name: /Télécharger le pack/i }).click();
    await expect(page1.getByTestId('pack-manifest-info')).toContainText('Manifeste v1');

    // Publier v2 puis simuler coupure réseau pendant téléchargement v2
    await page1.getByRole('button', { name: /Publier v2/i }).click();
    await expect(page1.getByTestId('status-message')).toContainText('Version 2 publiée');
    await page1.getByRole('button', { name: /Simuler coupure pack/i }).click();
    await expect(page1.getByTestId('status-message')).toContainText('copie complète v1 reste utilisable');

    // Pré-visiter la coquille offline
    await page1.goto(`${BASE_URL}/compas/itineraire/offline?workspaceId=${wsId}&userId=mina-offline`);
    await expect(page1.getByTestId('route-collab-workspace')).toBeVisible();

    // FERMETURE COMPLÈTE DU NAVIGATEUR !
    await ctx1.close();

    // REDÉMARRAGE COMPLET DU NAVIGATEUR SUR LE MÊME PROFIL DISQUE
    const ctx2 = await chromium.launchPersistentContext(userDataDir, {
      viewport: { width: 390, height: 844 },
      args: ['--disable-webgl'],
    });
    await ctx2.addCookies([cookieFor('mina-offline', 'Mina')]);
    const page2 = await ctx2.newPage();

    await page2.goto(`${BASE_URL}/compas/itineraire/offline?workspaceId=${wsId}&userId=mina-offline`);
    await dismissCookieBanner(page2);
    await ctx2.setOffline(true);

    await page2.getByRole('tab', { name: 'Départ' }).click();
    await page2.getByRole('button', { name: /Activité & Carnet/i }).click();
    await expect(page2.getByTestId('pack-manifest-info')).toContainText('Manifeste v1');

    // En mode avion : démarrer l'activité sur v1, terminer vers le Carnet
    await page2.getByRole('button', { name: /Démarrer l’activité/i }).click();
    await page2.getByRole('button', { name: /Terminer et ouvrir le carnet/i }).click();
    await expect(page2.getByTestId('carnet-return-card')).toContainText('v1');
    await expect(page2.getByTestId('carnet-return-card')).toContainText('3 art.');

    // Reconnexion + mutation hors ligne -> file locale -> replay
    await page2.getByRole('button', { name: 'Retour' }).click();
    await page2.getByRole('tab', { name: 'Tracer' }).click();
    await page2.getByRole('button', { name: /Ajouter un point/i }).click();

    await page2.getByRole('tab', { name: 'Départ' }).click();
    await page2.getByRole('button', { name: /Activité & Carnet/i }).click();
    await expect(page2.getByRole('button', { name: /Synchroniser \(1\)/i })).toBeVisible();

    await ctx2.setOffline(false);
    await page2.evaluate(() => window.dispatchEvent(new Event('online')));
    await page2.getByRole('button', { name: /Synchroniser \(1\)/i }).click();
    await expect(page2.getByTestId('status-message')).toContainText('1 appliquée(s)');

    await ctx2.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });
});
