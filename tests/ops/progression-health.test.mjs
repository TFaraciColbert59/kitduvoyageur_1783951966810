import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProgressionHealth } from '../../scripts/ops/progression_outbox_health.mjs';

const NOW = Date.parse('2026-10-10T12:00:00Z');
function database({ counts = {}, age = 0, error = false, missingDate = false } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return { select(columns, options) {
        if (options?.head) return { eq(field, status) {
          calls.push({ table, status, exact: options.count });
          return Promise.resolve({ count: counts[`${table}/${status}`] ?? 0, error });
        } };
        return { in() { return { order() { return { limit(limit) {
          calls.push({ table, limit });
          return Promise.resolve({ data: missingDate ? [] : [{ created_at: new Date(NOW - age).toISOString() }], error });
        } }; } }; } };
      } };
    },
  };
}
test('une file vide est saine sans lire de lignes', async () => {
  const db = database(); const result = await readProgressionHealth(db, NOW);
  assert.equal(result.ok, true); assert.equal(result.oldestPendingMinutes, 0);
  assert.equal(db.calls.length, 6); assert.ok(db.calls.every(call => call.exact === 'exact'));
});
test('dead au-delà de la limite REST de 1000 est détecté par comptage exact', async () => {
  const db = database({ counts: { 'progression_outbox/pending': 1500, 'progression_outbox/dead': 1 } });
  const result = await readProgressionHealth(db, NOW);
  assert.equal(result.pending, 1500); assert.equal(result.dead, 1); assert.equal(result.ok, false);
  assert.equal(db.calls.filter(call => call.limit === 1).length, 1);
});
test('15 minutes et une milliseconde sont dégradées, sans arrondi permissif', async () => {
  const counts = { 'progression_outbox/failed': 1 };
  assert.equal((await readProgressionHealth(database({ counts, age: 15 * 60000 }), NOW)).ok, true);
  assert.equal((await readProgressionHealth(database({ counts, age: 15 * 60000 + 1 }), NOW)).ok, false);
});
test('classement en retard à 30 minutes et une milliseconde est dégradé', async () => {
  const result = await readProgressionHealth(database({ counts: { 'leaderboard_refresh_queue/pending': 9 }, age: 30 * 60000 + 1 }), NOW);
  assert.equal(result.ok, false); assert.equal(result.leaderboard.pending, 9);
});
test('erreur de lecture ou date manquante ne deviennent pas un état sain', async () => {
  await assert.rejects(() => readProgressionHealth(database({ error: true }), NOW), /indisponible/);
  await assert.rejects(() => readProgressionHealth(database({ counts: { 'progression_outbox/pending': 1 }, missingDate: true }), NOW), /indisponible/);
});

test('classement dead reste dégradé même sans backlog en attente', async () => {
  const result = await readProgressionHealth(database({ counts: { 'leaderboard_refresh_queue/dead': 1 } }), NOW);
  assert.equal(result.ok, false); assert.equal(result.leaderboard.dead, 1);
});
