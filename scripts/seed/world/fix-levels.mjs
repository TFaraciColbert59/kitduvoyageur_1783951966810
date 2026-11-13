import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: profiles } = await db.from('user_profiles').select('id,level,xp,handle').or('email.like.%@voyageurs.lkdv.app,email.eq.demo@lkdv.app');
let n=0;
for (const p of profiles||[]) {
  const lvl=Math.min(8,Math.max(1,Math.round((p.level||1)/5)+1));
  const xp=(lvl-1)*500+((p.xp||0)%500);
  const { error } = await db.from('user_profiles').update({level:lvl,xp}).eq('id',p.id);
  if (!error) n++;
}
console.log('profils corrigés', n);
