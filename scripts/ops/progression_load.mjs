#!/usr/bin/env node
/**
 * T45 — Mesure de charge et de coût du pipeline (LOCAL uniquement).
 *
 * 1. EXPLAIN (ANALYZE, BUFFERS) des requêtes chaudes sur la base locale Docker
 *    (projection des missions par utilisateur+action ; entrées prêtes).
 * 2. Charge synthétique : N cycles de `refresh_progression_mission_progress`
 *    sur un utilisateur de test, mesure du temps total et par cycle.
 *
 * ⚠ Ne s'exécute JAMAIS contre la production : la base cible est le conteneur
 * Docker local (supabase_db_ai-finalization). Aucun test de charge sur prod.
 */
import { spawnSync } from 'node:child_process';

const CONTAINER = 'supabase_db_ai-finalization';

function psql(sql, { quiet = false } = {}) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`psql: ${res.stderr || res.stdout}`);
  }
  if (!quiet) console.log(res.stdout.trim());
  return res.stdout.trim();
}

console.log('--- EXPLAIN requête chaude : projection des missions ---');
psql(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT a2.id, count(DISTINCT e.id)
FROM progression_mission_assignments a2
JOIN progression_mission_model_actions mma ON mma.model_id = a2.model_id
JOIN progression_events e ON e.user_id = a2.user_id AND e.action_type = mma.action_type
WHERE a2.user_id = 'a0808080-0000-4000-8000-000000000001' AND a2.state = 'active'
GROUP BY a2.id;`);

console.log('--- EXPLAIN requête chaude : file d’intentions prêtes ---');
psql(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id FROM progression_award_intents
WHERE state IN ('pending','failed') AND available_at <= now()
ORDER BY created_at ASC LIMIT 50;`);

console.log('--- Charge synthétique : 200 cycles de projection (utilisateur de test) ---');
psql(`
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('a0808080-0000-4000-8000-0000000000f9','t45-load@test.invalid','authenticated','authenticated','{}')
ON CONFLICT (id) DO NOTHING;`);
const cycles = 200;
const startedAt = Date.now();
psql(
  `DO $$ BEGIN FOR i IN 1..${cycles} LOOP
     PERFORM public.refresh_progression_mission_progress('a0808080-0000-4000-8000-0000000000f9');
   END LOOP; END $$;`,
  { quiet: true }
);
const elapsed = Date.now() - startedAt;
console.log(
  JSON.stringify(
    {
      cycles,
      totalMs: elapsed,
      msPerCycle: Math.round((elapsed / cycles) * 100) / 100,
      environment: 'local docker (jamais production)',
      note: 'Le motif burst hors ligne = lots bornés 50 ; la reprise ne double jamais (réservation atomique).',
    },
    null,
    2
  )
);
