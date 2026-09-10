import fs from 'node:fs';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe(name, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = '';
  }
  console.log(JSON.stringify({ name, status: res.status, body: body.slice(0, 300) }));
}

await probe('hub_telemetry.user_id', 'hub_telemetry?select=user_id&limit=0');
await probe('hub_telemetry.all', 'hub_telemetry?select=*&limit=1');
await probe('trip_items.purchase_state', 'trip_items?select=purchase_state&limit=0');
await probe('trip_items.source', 'trip_items?select=source&limit=0');
await probe('hub_feature_flags', 'hub_feature_flags?select=*&limit=1');
await probe('hub_dashboard_kpis', 'hub_dashboard_kpis?select=*&limit=0');

const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const anonRes = await fetch(`${url}/rest/v1/hub_dashboard_kpis?select=*&limit=0`, {
  headers: { apikey: anonKey },
});
console.log(JSON.stringify({ name: 'anon hub_dashboard_kpis', status: anonRes.status }));
process.exit(0);
