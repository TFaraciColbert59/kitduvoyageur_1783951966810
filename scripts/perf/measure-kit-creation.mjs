#!/usr/bin/env node
/**
 * Mesure de la création de kit (`persistPreparation`) — avant / après.
 *
 * 1. Analyse STATIQUE du source (`createTripFromAutogenIntent.ts`) :
 *    nombre d'appels DB attendus dans `persistPreparation` (+ helpers), appels
 *    à `buildAutogenPreparation`, boucles d'inserts unitaires.
 * 2. Mesure LIVE (service-role) : un voyage brouillon marqué `[PERF TEST]` est
 *    créé puis supprimé, et la séquence réelle d'écritures du kit est exécutée
 *    N fois (poids, items, dépenses, checklist) pour mesurer la durée.
 *
 * Usage :
 *   node scripts/perf/measure-kit-creation.mjs --mode=before|after [--runs=3] [--static-only]
 *   [--out=docs/catalogue/kit-perf.txt]
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = 'src/features/trips/server/createTripFromAutogenIntent.ts';
const MARKER = '[PERF TEST] kit-creation — ne pas conserver';

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(resolve(REPO_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_0-9]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

function extractFunctionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return '';
  const rest = source.slice(start + 1);
  const nextDeclaration = rest.match(/\n(?:export\s+)?(?:async\s+)?function\s+\w+/);
  const end = nextDeclaration ? start + 1 + nextDeclaration.index : source.length;
  return source.slice(start, end);
}

function staticAnalysis() {
  const source = readFileSync(resolve(REPO_ROOT, SOURCE), 'utf8');
  const body = extractFunctionBody(source, 'persistPreparation');
  const ownedBody = extractFunctionBody(source, 'loadOwnedItems');
  const catalogueBody = extractFunctionBody(source, 'loadKitCatalogue');
  const directFrom = (body.match(/await\s+[\w$]+\s*\.\s*from\s*\(/g) ?? []).length;
  const ownedFrom = (ownedBody.match(/await\s+[\w$]+\s*\.\s*from\s*\(/g) ?? []).length;
  const catalogueFrom = (catalogueBody.match(/await\s+[\w$]+\s*\.\s*from\s*\(/g) ?? []).length;
  const helperInvocations = (
    body.match(/load(?:OwnedItems|KitCatalogue)\s*\(/g) ?? []
  ).length;
  const parallelBatches = (body.match(/Promise\.all\s*\(/g) ?? []).length;
  const preparationCalls = (source.match(/buildAutogenPreparation\s*\(\s*\{/g) ?? []).length;
  const perRowAwaits = (body.match(/for\s*\([^)]*\)\s*\{[\s\S]*?await\s+[\w$]+\s*\.\s*from/g) ?? []).length;
  return {
    mode: catalogueBody ? 'after' : 'before',
    directDbAwaitsInPersistPreparation: directFrom,
    helperDbAwaits: helperInvocations,
    helperRoundTrips: ownedFrom + catalogueFrom,
    parallelBatches,
    sequentialAwaits: directFrom + helperInvocations - parallelBatches,
    totalDbRoundTrips: directFrom + ownedFrom + catalogueFrom,
    preparationComputations: preparationCalls,
    perRowAwaitedFromLoops: perRowAwaits,
  };
}

async function timedStep(label, operation, timings) {
  const startedAt = performance.now();
  const result = await operation;
  const durationMs = performance.now() - startedAt;
  timings.push({ label, durationMs: Math.round(durationMs * 100) / 100 });
  return result;
}

async function liveMeasurement(supabase, mode, runs) {
  const { data: tripRow } = await supabase.from('trips').select('user_id').limit(1).maybeSingle();
  let userId = tripRow?.user_id ?? null;
  if (!userId) {
    const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    userId = profile?.id ?? null;
  }
  if (!userId) {
    return { skipped: true, reason: 'aucun user_id disponible (trips/profiles vides)' };
  }

  const scratchSlug = `perf-test-kit-${Date.now()}`;
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({ slug: scratchSlug, title: MARKER, user_id: userId, status: 'draft', visibility: 'private' })
    .select('id')
    .single();
  if (tripError || !trip) {
    return { skipped: true, reason: `création du voyage scratch impossible: ${tripError?.message}` };
  }
  const tripId = trip.id;

  const results = [];
  try {
    for (let run = 1; run <= runs; run++) {
      const timings = [];
      const kitId = randomUUID();

      if (mode === 'after') {
        await timedStep(
          'select (inventaire ∥ catalogue)',
          Promise.all([
            supabase.from('product_ownership').select('id').limit(5),
            supabase.from('shop_products').select('id, slug, name, weight_g, price_eur').limit(5),
          ]),
          timings
        );
      } else {
        await timedStep(
          'select inventaire',
          supabase.from('product_ownership').select('id').limit(5),
          timings
        );
      }

      await timedStep(
        'insert materiel_kits',
        supabase
          .from('materiel_kits')
          .insert({ id: kitId, user_id: userId, name: `Kit perf ${run}`, total_weight_g: 3000, is_public: false, is_trashed: false })
          .select('id')
          .single(),
        timings
      );

      await timedStep(
        'insert materiel_kit_items (batch)',
        supabase.from('materiel_kit_items').insert(
          Array.from({ length: 5 }, (_, index) => ({
            kit_id: kitId,
            user_id: userId,
            name: `Item perf ${run}-${index}`,
            category: 'misc',
            weight_g: 100 + index,
            quantity: 1,
            is_checked: false,
            ownership: 'personal',
            priority: 'recommended',
            is_vital: false,
          }))
        ),
        timings
      );

      await timedStep(
        'insert trip_items (batch)',
        supabase.from('trip_items').insert(
          Array.from({ length: 5 }, (_, index) => ({
            trip_id: tripId,
            item_name: `Item perf ${run}-${index}`,
            category: 'misc',
            quantity: 1,
            weight_grams: 100 + index,
            is_packed: false,
            status: 'missing',
            source: 'contextual_kit',
            priority: 'recommended',
            is_vital: false,
            is_worn: false,
            is_consumable: false,
            purchase_state: 'needed',
            ownership: 'personal',
          }))
        ),
        timings
      );

      await timedStep(
        'insert trip_expenses (batch)',
        supabase.from('trip_expenses').insert([
          {
            trip_id: tripId,
            payer_id: userId,
            title: `Budget perf ${run}`,
            amount: 100,
            currency: 'EUR',
            category: 'budget_prev',
            expense_date: new Date().toISOString().slice(0, 10),
            split_type: 'equal',
            is_planned: true,
          },
        ]),
        timings
      );

      await timedStep(
        'insert trip_checklist_items (batch)',
        supabase.from('trip_checklist_items').insert(
          Array.from({ length: 2 }, (_, index) => ({
            trip_id: tripId,
            label: `Check perf ${run}-${index}`,
            due_offset_days: index,
            done: false,
            position: index,
          }))
        ),
        timings
      );

      await supabase.from('materiel_kit_items').delete().eq('kit_id', kitId);
      await supabase.from('materiel_kits').delete().eq('id', kitId);
      await supabase.from('trip_items').delete().eq('trip_id', tripId);
      await supabase.from('trip_expenses').delete().eq('trip_id', tripId);
      await supabase.from('trip_checklist_items').delete().eq('trip_id', tripId);

      results.push({
        run,
        totalMs: Math.round(timings.reduce((sum, entry) => sum + entry.durationMs, 0) * 100) / 100,
        timings,
      });
    }
  } finally {
    await supabase.from('trips').delete().eq('id', tripId);
  }

  const totals = results.map((entry) => entry.totalMs);
  return {
    skipped: false,
    runs: results.length,
    roundTripsPerRun: mode === 'after' ? 7 : 6,
    minMs: Math.min(...totals),
    avgMs: Math.round((totals.reduce((sum, value) => sum + value, 0) / totals.length) * 100) / 100,
    maxMs: Math.max(...totals),
    details: results,
  };
}

async function main() {
  const requestedMode = argValue('mode', null);
  const staticOnly = process.argv.includes('--static-only');
  const runs = Number(argValue('runs', '3'));
  const outPath = argValue('out', 'docs/catalogue/kit-perf.txt');

  const analysis = staticAnalysis();
  const mode = requestedMode ?? analysis.mode;
  if (requestedMode && requestedMode !== analysis.mode) {
    console.warn(
      `[measure-kit-creation] mode demandé « ${requestedMode} » ≠ source détecté « ${analysis.mode} »`
    );
  }

  let live = { skipped: true, reason: '--static-only' };
  if (!staticOnly) {
    const env = loadEnvLocal();
    const require = createRequire(`${REPO_ROOT}/package.json`);
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    live = await liveMeasurement(supabase, mode, runs);
  }

  const label = mode === 'after' ? 'APRÈS' : 'AVANT';
  const lines = [
    `===== ${label} (${new Date().toISOString()}) =====`,
    `Source       : ${SOURCE}`,
    `Mode         : ${mode}`,
    '',
    '-- Analyse statique persistPreparation --',
    `Appels DB directs (from/await)          : ${analysis.directDbAwaitsInPersistPreparation}`,
    `Appels helpers (loadOwnedItems/…)       : ${analysis.helperDbAwaits}`,
    `Aller-retours DB des helpers            : ${analysis.helperRoundTrips}`,
    `Points d'attente séquentiels            : ${analysis.sequentialAwaits}`,
    `Aller-retours DB total (persist+helpers): ${analysis.totalDbRoundTrips}`,
    `Calculs buildAutogenPreparation         : ${analysis.preparationComputations}`,
    `Boucles for avec await from (anti-batch): ${analysis.perRowAwaitedFromLoops}`,
    '',
    '-- Mesure live (voyage scratch supprimé) --',
    JSON.stringify(live, null, 2),
    '',
  ];
  const text = lines.join('\n');
  console.log(text);
  if (!staticOnly) {
    const target = resolve(REPO_ROOT, outPath);
    mkdirSync(dirname(target), { recursive: true });
    if (process.argv.includes('--append')) appendFileSync(target, `\n${text}\n`, 'utf8');
    else writeFileSync(target, `${text}\n`, 'utf8');
    console.log(`Mesure écrite : ${target}`);
  }
}

main().catch((error) => {
  console.error('[measure-kit-creation] échec:', error);
  process.exitCode = 1;
});
