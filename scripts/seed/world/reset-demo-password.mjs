// Réinitialise le mot de passe du compte démo, met à jour .env.local et le
// fichier d'identifiants. N'affiche jamais le secret.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const envPath='.env.local';
const env=Object.fromEntries(fs.readFileSync(envPath,'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL, anon=env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_ID='d5451f35-db9f-4575-9114-6d3b79550bbc';
const password='Lk'+crypto.randomBytes(9).toString('base64url')+'!7a';
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const { error }=await admin.auth.admin.updateUserById(DEMO_ID,{password,email_confirm:true});
if(error){console.error('update failed',error.message);process.exit(1);}
// Fichier d'identifiants
const credPath='scripts/seed/world/.manifest/world-v1.credentials.json';
const cred=JSON.parse(fs.readFileSync(credPath,'utf8'));
cred['lea-fontaine']={...(cred['lea-fontaine']||{}),email:'demo@lkdv.app',password,isDemo:true,userId:DEMO_ID};
fs.writeFileSync(credPath,JSON.stringify(cred,null,2),{mode:0o600}); fs.chmodSync(credPath,0o600);
// .env.local
let text=fs.readFileSync(envPath,'utf8');
const setVar=(k,v)=>{const re=new RegExp('^'+k+'=.*$','m'); text=re.test(text)?text.replace(re,k+'='+v):text.trimEnd()+'\n'+k+'='+v+'\n';};
setVar('DEMO_LOGIN_EMAIL','demo@lkdv.app'); setVar('DEMO_LOGIN_PASSWORD',password);
setVar('AUDIT_EMAIL','demo@lkdv.app'); setVar('AUDIT_PASSWORD',password);
fs.writeFileSync(envPath,text);
// Test réel
const user=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const { data, error: loginError }=await user.auth.signInWithPassword({email:'demo@lkdv.app',password});
if(loginError){console.error('login test failed',loginError.message);process.exit(1);}
console.log('OK — mot de passe réinitialisé et connexion testée.');
console.log('user:',data.user.id);
console.log('identifiants:',credPath);
console.log('variables mises à jour dans',envPath);
