import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
p.on('request',r=>{if(r.url().includes('demo-login'))console.log('REQ',r.method(),r.url())});
p.on('response',r=>{if(r.url().includes('demo-login'))console.log('RES',r.status(),r.url())});
await p.goto(base+'/connexion',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1500);
const btn=p.getByRole('button',{name:'Connexion démo'});console.log('count',await btn.count(),'disabled',await btn.isDisabled().catch(()=>null));
await btn.click();await p.waitForTimeout(5000);
console.log('text',(await btn.textContent()),'url',p.url(),'alert',await p.locator('[role=alert]').allTextContents());
await b.close();
