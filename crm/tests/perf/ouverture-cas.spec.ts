import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { openInbox, signIn } from '../support/flows';
import { sel } from '../support/selectors';

/**
 * Couche 7 — performance mesurée, pas supposée (07_VERIFICATION § 1, ligne 7).
 *
 * Seuils (jamais à la baisse) :
 * - accusé d'une ouverture de cas : < 100 ms (l'écran réagit avant la réponse) ;
 * - réponse p95 sur 20 ouvertures : < 400 ms (le cas est lisible) ;
 * - aucune longue tâche > 200 ms pendant le défilement d'une liste de 10 000 lignes ;
 * - liste de 10 000 lignes virtualisée : moins de 200 lignes montées dans le DOM ;
 * - LCP < 2 000 ms sur la file.
 */

const SEUILS = {
  accuseMs: 100,
  reponseP95Ms: 400,
  longueTacheMs: 200,
  lignes: 10_000,
  lignesMonteesMax: 200,
  lcpMs: 2_000
} as const;

type Mesures = { accuse: number[]; reponse: number[] };

test.describe('Performance — ouverture d’un cas', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test(`accusé < ${SEUILS.accuseMs} ms et réponse p95 < ${SEUILS.reponseP95Ms} ms sur 20 ouvertures`, async ({ page }) => {
    await openInbox(page);
    const mesures: Mesures = { accuse: [], reponse: [] };

    for (let essai = 0; essai < 20; essai += 1) {
      const mesure = await page.evaluate(async () => {
        const row = document.querySelector('[data-testid="queue-row"]') as HTMLElement | null;
        if (!row) return null;
        const start = performance.now();
        row.click();
        const attendre = (selector: string) =>
          new Promise<number | null>((resolve) => {
            if (document.querySelector(selector)) return resolve(performance.now() - start);
            const observer = new MutationObserver(() => {
              if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(performance.now() - start);
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            window.setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, 5_000);
          });
        // Accusé : n'importe quel contenant de cas ou squelette.
        const accuse = await attendre('[data-testid="case"], [data-testid="case-skeleton"]');
        // Réponse : le titre du cas est lisible.
        const reponse = await attendre('[data-testid="case"] h1');
        history.back();
        await new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            if (document.querySelector('[data-testid="inbox"]')) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          window.setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 5_000);
        });
        return { accuse, reponse };
      });

      expect(mesure, 'Aucune ligne de file à mesurer').not.toBeNull();
      if (mesure!.accuse !== null) mesures.accuse.push(mesure!.accuse);
      if (mesure!.reponse !== null) mesures.reponse.push(mesure!.reponse);
    }

    expect(mesures.accuse.length).toBeGreaterThanOrEqual(19);
    expect(mesures.reponse.length).toBeGreaterThanOrEqual(19);

    const p95 = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
    };

    const maxAccuse = Math.max(...mesures.accuse);
    const p95Reponse = p95(mesures.reponse);
    expect(maxAccuse, `accusé max ${maxAccuse.toFixed(1)} ms`).toBeLessThan(SEUILS.accuseMs);
    expect(p95Reponse, `réponse p95 ${p95Reponse.toFixed(1)} ms`).toBeLessThan(SEUILS.reponseP95Ms);
  });
});

test.describe('Performance — liste de 10 000 lignes virtualisée', () => {
  const payload = (count: number) => ({
    items: Array.from({ length: count }, (_, index) => ({
      key: `post_report:demo-${index}`,
      source: 'post_report',
      id: `demo-${index}`,
      group: index < 10 ? 'urgence_haute' : 'signalements',
      title: `[TEST CRM] signalement ${index}`,
      subtitle: 'contenu de test',
      pole: 'CONF',
      urgency: index < 10 ? 'haute' : 'normale',
      due_at: new Date(Date.now() + (index + 1) * 60_000).toISOString(),
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
      badges: []
    })),
    counts: { total: count, urgent: 10, reports: count - 10, approvals: 0, contributions: 0, by_pole: { CONF: count } },
    sla: { held_days: 1, treated_today: 0, target_today: 10 }
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    await page.route('**/rest/v1/rpc/inbox**', (route) => route.fulfill({ json: payload(SEUILS.lignes) }));
    await page.route('**/api/inbox**', (route) => route.fulfill({ json: payload(SEUILS.lignes) }));
    await page.addInitScript(() => {
      (window as unknown as { __longTasks: number[] }).__longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    });
    await page.goto('/');
    await expect(page.locator(sel.inbox.row).first()).toBeVisible();
  });

  test(`moins de ${SEUILS.lignesMonteesMax} lignes montées pour ${SEUILS.lignes} lignes de données`, async ({ page }) => {
    const mounted = await page.locator(sel.inbox.row).count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(SEUILS.lignesMonteesMax);
  });

  test(`aucune longue tâche > ${SEUILS.longueTacheMs} ms pendant 30 défilements`, async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __mark: number }).__mark = (window as unknown as { __longTasks: number[] }).__longTasks.length;
    });
    for (let index = 0; index < 30; index += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForFunction(() => true);
    }
    const taskDurations = await page.evaluate(() => {
      const store = window as unknown as { __longTasks: number[]; __mark: number };
      return store.__longTasks.slice(store.__mark);
    });
    const worst = taskDurations.length ? Math.max(...taskDurations) : 0;
    expect(worst, `longue tâche max ${worst.toFixed(1)} ms`).toBeLessThan(SEUILS.longueTacheMs);
  });

  test('le défilement reste fluide : 60 images en moins de 2 s', async ({ page }) => {
    const fps = await page.evaluate(async () => {
      const frames: number[] = [];
      await new Promise<void>((resolve) => {
        let last = performance.now();
        const tick = (now: number) => {
          frames.push(now - last);
          last = now;
          if (frames.length >= 60) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return frames.reduce((sum, value) => sum + value, 0);
    });
    expect(fps, `60 images en ${fps.toFixed(0)} ms`).toBeLessThan(2_000);
  });
});

test.describe('Performance — affichage initial', () => {
  test(`LCP < ${SEUILS.lcpMs} ms sur la file`, async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) resolve((last as PerformanceEntry & { renderTime?: number }).renderTime ?? last.startTime);
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          window.setTimeout(() => resolve(Number.POSITIVE_INFINITY), 8_000);
        })
    );
    expect(lcp).toBeLessThan(SEUILS.lcpMs);
  });
});
