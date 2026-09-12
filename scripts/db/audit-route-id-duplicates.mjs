#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const PAGE_SIZE = 1000;

async function fetchTripsWithRouteId() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('trips')
      .select('id, user_id, metadata')
      .not('metadata->>route_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

try {
  const rows = await fetchTripsWithRouteId();
  const byPair = new Map();
  for (const row of rows) {
    const routeId = row.metadata?.route_id;
    if (routeId === null || routeId === undefined) continue;
    const pairKey = `${row.user_id}::${routeId}`;
    const group = byPair.get(pairKey) ?? { user_id: row.user_id, route_id: routeId, trip_ids: [] };
    group.trip_ids.push(row.id);
    byPair.set(pairKey, group);
  }
  const duplicates = [...byPair.values()].filter((group) => group.trip_ids.length > 1);
  console.log(JSON.stringify({ duplicates, count: duplicates.length }, null, 2));
} catch (error) {
  console.error(`Audit failed: ${error.message ?? error}`);
  process.exit(1);
}
