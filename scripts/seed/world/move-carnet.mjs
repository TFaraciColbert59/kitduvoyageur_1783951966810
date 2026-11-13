import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const id='2abb71a9-93cf-4cee-9714-0c5e854b0bb3';
const { data } = await db.from('carnets').select('id,title,author_id').eq('author_id',id);
console.log(data);
if (data?.length) { const { error } = await db.from('carnets').update({author_id:'d5451f35-db9f-4575-9114-6d3b79550bbc'}).eq('id',data[0].id); console.log(error?.message||'moved'); }
