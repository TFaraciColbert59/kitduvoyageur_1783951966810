import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const manifest = JSON.parse(fs.readFileSync('scripts/seed/world/.manifest/world-v1.manifest.json','utf8'));
const curated = new Set((manifest.entities.clubs||[]).map(e=>e.id));
const { data: clubs } = await db.from('clubs').select('id,name,privacy,members_count');
const legacy = (clubs||[]).filter(c=>!curated.has(c.id));
for (const c of legacy) await db.from('clubs').update({privacy:'secret'}).eq('id',c.id);
console.log('clubs masqués', legacy.length, legacy.slice(0,5).map(c=>c.name));
// Arrondir les distances des activités pour éviter les sommes flottantes (339.59999…).
const ids = (manifest.entities.activities||[]).map(e=>e.id);
const { data: acts } = await db.from('activities').select('id,distance_km').in('id',ids.slice(0,500));
let n=0;
for (const a of acts||[]) { const r=Math.round(Number(a.distance_km)||0); if (r!==a.distance_km) { await db.from('activities').update({distance_km:r}).eq('id',a.id); n++; } }
console.log('activités arrondies', n);
