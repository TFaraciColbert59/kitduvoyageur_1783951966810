import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
await db.from('carnets').update({author_id:'2abb71a9-93cf-4cee-9714-0c5e854b0bb3'}).eq('id','6c91d266-88c2-5b6f-9953-555a0bc345bf');
await db.from('carnets').update({visibility:'public'}).eq('author_id','6e111ce2-0fa4-4e3a-8f24-87b03c632588');
console.log('restored');
