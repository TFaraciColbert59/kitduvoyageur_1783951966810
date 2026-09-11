import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

/**
 * A13 (S9) — Certification E2E du parcours complet, sans fixture.
 *
 * Parcours : phrase → génération (3 candidats + comparaison) → sélection
 * matérialisée → ETA P50/P90 → cockpit (tracking GPS simulé + recalcul) →
 * pack offline → file hors-ligne rejouée à la reconnexion (idempotente) →
 * session/retour d'expérience → cockpit monté visible.
 *
 * Environnement : projet Supabase de **test** uniquement, variables injectées
 * par `.env.local` (ou par l'environnement, qui prime). Le test est ignoré si
 * URL/clés de test manquent ; il ne touche jamais la production.
 *
 * Aucune fixture en base : l'utilisateur est créé via l'API admin réelle, le
 * plan via `POST /api/adventure/generate`, la session via les APIs réelles ;
 * tout est supprimé en fin de test (suppression de l'utilisateur, cascades
 * `auth.users`) même en cas d'échec.
 */

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const HAS_TEST_PROJECT = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

interface AdminHeaders {
  apikey: string;
  Authorization: string;
}

function adminHeaders(): AdminHeaders {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

/** Empreinte SHA-256 stable : clé d'idempotence `kind:entityId:hash`. */
function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

test.describe('A13 — certification parcours bout-en-bout (S9)', () => {
  test('TEST-A13-E2E-01: phrase → plan → sélection → cockpit → offline → reconnexion → retour', async ({
    page,
    request,
  }) => {
    test.skip(
      !HAS_TEST_PROJECT,
      'Projet Supabase de test requis : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY.'
    );
    test.setTimeout(180_000);

    const email = `a13-e2e-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    const password = `E2e-${randomUUID()}-Aa1!`;
    let userId: string | null = null;

    try {
      // 1. Utilisateur réel via l'API admin (aucune fixture).
      const createUser = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
        headers: adminHeaders(),
        data: {
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: 'A13 E2E' },
        },
      });
      expect(createUser.ok(), `création utilisateur: ${createUser.status()}`).toBe(true);
      userId = ((await createUser.json()) as { id: string }).id;
      expect(userId).toBeTruthy();

      // 2. Session réelle par l'écran de connexion (cookies @supabase/ssr).
      await page.goto('/connexion', { waitUntil: 'domcontentloaded' });
      const loginForm = page.locator('main form:visible').first();
      await loginForm.locator('#email').fill(email);
      await loginForm.locator('#password').fill(password);
      await loginForm.locator('button[type="submit"]').click();
      await expect
        .poll(
          async () => (await page.context().cookies()).some((cookie) => /-auth-token/.test(cookie.name)),
          { message: 'session Supabase attendue après connexion', timeout: 30_000 }
        )
        .toBe(true);

      // 3. Phrase → génération des trois candidats + comparaison.
      const generateResponse = await page.request.post('/api/adventure/generate', {
        headers: { 'Idempotency-Key': `a13-e2e-${randomUUID()}` },
        data: { text: 'Week-end de randonnée de 2 jours dans les Vosges avec bivouac' },
      });
      expect(generateResponse.status(), await generateResponse.text()).toBe(201);
      const generated = (await generateResponse.json()) as {
        planId: string;
        version: number;
        candidatePlans: unknown[];
        candidateComparison: {
          sharedRoute: boolean;
          sharedDates: boolean;
          sharedAccommodations: boolean;
          rows: {
            candidateId: string;
            durationP50Seconds: number | null;
            durationP90Seconds: number | null;
          }[];
        };
      };
      expect(generated.planId).toMatch(/^[0-9a-f-]{36}$/);
      expect(generated.candidatePlans).toHaveLength(3);
      expect(generated.candidateComparison.rows).toHaveLength(3);
      expect(generated.candidateComparison.sharedRoute).toBe(true);
      expect(generated.candidateComparison.sharedDates).toBe(true);
      expect(generated.candidateComparison.sharedAccommodations).toBe(true);

      // 4. ETA : P50 ≤ P90 pour chacun des trois candidats.
      for (const row of generated.candidateComparison.rows) {
        expect(typeof row.durationP50Seconds).toBe('number');
        expect(typeof row.durationP90Seconds).toBe('number');
        expect(row.durationP50Seconds as number).toBeGreaterThan(0);
        expect(row.durationP50Seconds as number).toBeLessThanOrEqual(
          row.durationP90Seconds as number
        );
      }

      // 5. Sélection → matérialisation d'une version supérieure.
      const selectResponse = await page.request.post(`/api/adventure/${generated.planId}/select`, {
        data: { candidateId: generated.candidateComparison.rows[0].candidateId },
      });
      expect(selectResponse.status(), await selectResponse.text()).toBe(200);
      const selected = (await selectResponse.json()) as { version: number };
      expect(selected.version).toBeGreaterThan(generated.version);

      const planResponse = await page.request.get(`/api/adventure/${generated.planId}`);
      expect(planResponse.status()).toBe(200);
      const stored = (await planResponse.json()) as { version: { version: number } };
      expect(stored.version.version).toBe(selected.version);

      // 6. Cockpit : tracking GPS simulé → recalcul réel (déplacement ≥ 250 m).
      const startedAt = new Date(Date.now() - 3_600_000).toISOString();
      const endedAt = new Date().toISOString();
      const positionsTimed = [
        { lat: 48.0, lng: 7.0, timestamp: new Date(Date.now() - 600_000).toISOString() },
        { lat: 48.01, lng: 7.01, timestamp: new Date().toISOString() },
      ];
      const cockpitResponse = await page.request.post(
        `/api/adventure/${generated.planId}/cockpit`,
        {
          data: {
            positions: positionsTimed,
            recalcState: { lastPosition: { lat: 48.0, lng: 7.0 }, lastRecalcAt: null },
          },
        }
      );
      expect(cockpitResponse.status(), await cockpitResponse.text()).toBe(200);
      const cockpit = (await cockpitResponse.json()) as {
        recalc: { shouldRecalculate: boolean; reasons: string[] };
        planVersion: number | null;
      };
      expect(cockpit.recalc.shouldRecalculate).toBe(true);
      expect(cockpit.recalc.reasons).toContain('position_250m');
      expect(cockpit.planVersion).toBe(selected.version);

      // 7. Pack offline récupérable (prêt pour la coupure réseau).
      const packResponse = await page.request.get(`/api/adventure/${generated.planId}/offline-pack`);
      expect(packResponse.status(), await packResponse.text()).toBe(200);
      const packBody = (await packResponse.json()) as {
        pack: { adventureId: string; version: number; plan: { id: string } } | null;
      };
      expect(packBody.pack).not.toBeNull();
      expect(packBody.pack?.adventureId).toBe(generated.planId);
      expect(packBody.pack?.plan.id).toBe(generated.planId);

      // 8. Coupure → reconnexion : file hors-ligne rejouée via l'API réelle,
      //    puis rejouée une seconde fois (idempotence stricte).
      const sessionEntityId = randomUUID();
      const operationPayload = {
        startedAt,
        endedAt,
        distanceKm: 6.2,
        durationSeconds: 5400,
        positionsTimed,
      };
      const operation = {
        id: sessionEntityId,
        store: 'offline_sessions_queue',
        kind: 'hike_session',
        entityId: sessionEntityId,
        payload: operationPayload,
        idempotencyKey: `hike_session:${sessionEntityId}:${sha256(operationPayload)}`,
        createdAt: endedAt,
        attempts: 0,
      };
      const firstSync = await page.request.post('/api/adventure/offline/sync', {
        data: { operations: [operation] },
      });
      expect(firstSync.status(), await firstSync.text()).toBe(200);
      const firstReport = (await firstSync.json()) as {
        results: { status: string }[];
        applied: number;
      };
      expect(firstReport.results[0].status).toBe('applied');
      expect(firstReport.applied).toBe(1);

      const replaySync = await page.request.post('/api/adventure/offline/sync', {
        data: { operations: [operation] },
      });
      expect(replaySync.status()).toBe(200);
      const replayReport = (await replaySync.json()) as {
        results: { status: string }[];
        duplicates: number;
      };
      expect(replayReport.results[0].status).toBe('duplicate');
      expect(replayReport.duplicates).toBe(1);

      // 9. Retour d'expérience : session réelle listée (idempotente).
      const sessionResponse = await page.request.post('/api/hike-sessions', {
        data: {
          startedAt,
          endedAt,
          distanceKm: operationPayload.distanceKm,
          durationSeconds: operationPayload.durationSeconds,
          positions: [],
          positionsTimed,
          poiEvents: [],
        },
      });
      expect(sessionResponse.status(), await sessionResponse.text()).toBe(200);
      const session = (await sessionResponse.json()) as { sessionId: string };
      expect(session.sessionId).toBeTruthy();

      const listResponse = await page.request.get('/api/hike-sessions');
      expect(listResponse.status()).toBe(200);
      const sessions = (await listResponse.json()) as { id: string }[];
      expect(sessions.some((entry) => entry.id === session.sessionId)).toBe(true);

      // 10. Cockpit monté et visible sur la randonnée active (S5).
      await page.goto(`/randonnee-active?adventureId=${generated.planId}`, {
        waitUntil: 'domcontentloaded',
      });
      const cockpitButton = page.getByRole('button', { name: /Ouvrir le cockpit/ });
      await expect(cockpitButton).toBeVisible({ timeout: 30_000 });
      await cockpitButton.click();
      await expect(page.getByRole('dialog', { name: 'Cockpit aventure' })).toBeVisible();
    } finally {
      // Nettoyage réel : suppression de l'utilisateur ⇒ cascades A1→A13.
      if (userId) {
        const cleanup = await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          headers: adminHeaders(),
        });
        expect(cleanup.ok(), `nettoyage utilisateur: ${cleanup.status()}`).toBe(true);
      }
    }
  });
});
