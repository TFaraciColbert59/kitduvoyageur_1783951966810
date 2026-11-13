import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const today = new Date().toISOString().slice(0,10);
const { data } = await db.from('events').select('id,title,event_date,status').lt('event_date', today);
for (const e of data||[]) await db.from('events').update({status:'past'}).eq('id',e.id);
console.log('past', (data||[]).length, (data||[]).slice(0,4).map(e=>e.title+':'+e.event_date));
