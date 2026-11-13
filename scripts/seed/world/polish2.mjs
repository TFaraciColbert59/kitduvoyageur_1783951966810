import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lvl=(p)=>p>=7500?'Légende du Voyage':p>=3500?'Randonneur Expert':p>=1500?'Aventurier':p>=500?'Explorateur Confirmé':'Explorateur';
const { data: profiles } = await db.from('user_profiles').select('id,email').or('email.like.%@voyageurs.lkdv.app,email.eq.demo@lkdv.app');
const { data: hist } = await db.from('loyalty_history').select('user_id,points');
const sums=new Map(); for(const h of hist||[]) sums.set(h.user_id,(sums.get(h.user_id)||0)+Number(h.points||0));
let n=0;
for(const p of profiles||[]){ const s=sums.get(p.id)||0; await db.from('user_profiles').update({loyalty_points:s,loyalty_level:lvl(s)}).eq('id',p.id); n++; }
console.log('points fidélité recalés', n);
const { data: clubs } = await db.from('clubs').select('id');
const { data: members } = await db.from('club_members').select('club_id');
const counts=new Map(); for(const m of members||[]) counts.set(m.club_id,(counts.get(m.club_id)||0)+1);
let c=0;
for(const club of clubs||[]){ const total=counts.get(club.id)||0; await db.from('clubs').update({members_count:total,active_this_month:Math.round(total*0.72)}).eq('id',club.id); c++; }
console.log('compteurs clubs recalés', c);
