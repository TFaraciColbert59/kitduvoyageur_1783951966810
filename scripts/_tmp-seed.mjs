// Seed TEMPORAIRE (captures) : géolocalise les 3 premières étapes du voyage
// démo pour rendre carte + météo visibles, puis restore. Usage:
//   node scripts/_tmp-seed.mjs seed | restore
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const mode = process.argv[2] ?? 'seed';
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
let sc = [];
const sb = createServerClient(url, key, { cookies: { getAll: () => sc, setAll: (c) => { sc = c; } } });
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });

const { data: trip } = await sb.from('trips').select('id,slug').order('created_at', { ascending: false }).limit(1).maybeSingle();
const { data: steps } = await sb.from('trip_steps').select('id,day_number,order_index').eq('trip_id', trip.id).order('day_number').order('order_index');

if (mode === 'seed') {
  const coords = [
    { lat: 45.9237, lng: 6.8694 }, // Chamonix
    { lat: 45.9977, lng: 6.7906 }, // Les Houches / col de Voza
    { lat: 45.9319, lng: 6.7920 }, // Traversée Bionnassay
  ];
  for (let i = 0; i < Math.min(3, steps.length); i++) {
    const { error } = await sb.from('trip_steps')
      .update({ latitude: coords[i].lat, longitude: coords[i].lng })
      .eq('id', steps[i].id);
    if (error) { console.error('seed KO', error.message); process.exit(1); }
  }
  console.log(`Seed OK: ${Math.min(3, steps.length)} étapes géolocalisées sur ${trip.slug}`);
} else {
  for (const s of steps.slice(0, 3)) {
    const { error } = await sb.from('trip_steps').update({ latitude: null, longitude: null }).eq('id', s.id);
    if (error) { console.error('restore KO', error.message); process.exit(1); }
  }
  console.log(`Restore OK: coordonnées remises à null sur ${trip.slug}`);
}
