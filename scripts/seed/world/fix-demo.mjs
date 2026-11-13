import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const DEMO='d5451f35-db9f-4575-9114-6d3b79550bbc';
const manifest = JSON.parse(fs.readFileSync('scripts/seed/world/.manifest/world-v1.manifest.json','utf8'));
const keptCarnets = new Set((manifest.entities.carnets||[]).filter(e=>e.persona==='lea-fontaine'||true).map(e=>e.id));
// On ne supprime que les carnets/voyages de la démo absents du manifeste (legacy).
const { data: demoCarnets } = await db.from('carnets').select('id,title').eq('author_id',DEMO);
const legacyCarnets = (demoCarnets||[]).filter(c=>!keptCarnets.has(c.id)).map(c=>c.id);
console.log('legacy carnets', legacyCarnets.length, (demoCarnets||[]).filter(c=>!keptCarnets.has(c.id)).map(c=>c.title));
const keptTrips = new Set((manifest.entities.trips||[]).map(e=>e.id));
const { data: demoTrips } = await db.from('trips').select('id,title,status').eq('user_id',DEMO);
const legacyTrips = (demoTrips||[]).filter(t=>!keptTrips.has(t.id)).map(t=>t.id);
console.log('legacy trips', legacyTrips.length, (demoTrips||[]).filter(t=>!keptTrips.has(t.id)).map(t=>t.title));
if (legacyCarnets.length) { const {error}=await db.from('carnets').delete().in('id',legacyCarnets); console.log('delete carnets', error?.message||'ok'); }
if (legacyTrips.length) { const {error}=await db.from('trips').delete().in('id',legacyTrips); console.log('delete trips', error?.message||'ok'); }
// Notifications démo : tout lire, puis laisser 12 non lues récentes.
const { data: notifs } = await db.from('notifications').select('id,created_at').eq('user_id',DEMO).order('created_at',{ascending:false});
const ids = (notifs||[]).map(n=>n.id);
for (let i=0;i<ids.length;i+=200) await db.from('notifications').update({read:true, read_at:new Date().toISOString()}).in('id',ids.slice(i,i+200));
const unread = ids.slice(0,12);
if (unread.length) await db.from('notifications').update({read:false, read_at:null}).in('id',unread);
console.log('notifications', ids.length, 'unread', unread.length);
