// Alimente le rail « vie de la communauté » (lkv_events) avec des événements
// réels produits par le seed : voyages, carnets, équipages.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { uuidv5 } from './lib/ids.mjs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const manifest = JSON.parse(fs.readFileSync('scripts/seed/world/.manifest/world-v1.manifest.json','utf8'));
const tripIds = (manifest.entities.trips||[]).map(e=>e.id);
const carnetIds = (manifest.entities.carnets||[]).map(e=>e.id);
const { data: trips } = await db.from('trips').select('id,title,slug,user_id,status,created_at,destination_name').in('id',tripIds.slice(0,200));
const { data: carnets } = await db.from('carnets').select('id,title,author_id,created_at').in('id',carnetIds.slice(0,200));
const events=[];
for (const t of trips||[]) {
  events.push({ id: uuidv5('live:trip.created:'+t.id), event_type:'trip.created', actor_id:t.user_id, entity_type:'trip', entity_id:t.id, metadata:{title:t.title,slug:t.slug,destination:t.destination_name}, visibility:'public', crew_id:null, created_at:t.created_at });
  if (t.status==='completed') events.push({ id: uuidv5('live:trip.completed:'+t.id), event_type:'trip.completed', actor_id:t.user_id, entity_type:'trip', entity_id:t.id, metadata:{tripTitle:t.title,totalKm:120,slug:t.slug}, visibility:'public', crew_id:null, created_at:t.created_at });
}
for (const c of carnets||[]) {
  events.push({ id: uuidv5('live:carnet.published:'+c.id), event_type:'carnet.published', actor_id:c.author_id, entity_type:'carnet', entity_id:c.id, metadata:{title:c.title}, visibility:'public', crew_id:null, created_at:c.created_at });
}
let ok=0;
for (let i=0;i<events.length;i+=200) { const { error } = await db.from('lkv_events').upsert(events.slice(i,i+200), { onConflict:'id' }); if (error) console.log('ERR', error.message); else ok+=Math.min(200,events.length-i); }
console.log('lkv_events', ok);
