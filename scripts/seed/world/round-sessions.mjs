import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const manifest = JSON.parse(fs.readFileSync('scripts/seed/world/.manifest/world-v1.manifest.json','utf8'));
const ids=(manifest.entities.hike_sessions||[]).map(e=>e.id);
const { data } = await db.from('hike_sessions').select('id,distance_km').in('id',ids.slice(0,300));
let n=0;
for (const s of data||[]) { const r=Math.round(Number(s.distance_km)||0); if (r!==s.distance_km) { await db.from('hike_sessions').update({distance_km:r}).eq('id',s.id); n++; } }
console.log('sessions arrondies', n);
