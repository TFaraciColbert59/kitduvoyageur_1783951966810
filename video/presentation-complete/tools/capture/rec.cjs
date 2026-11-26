// Enregistre de vrais gestes dans l'app locale (screencast CDP, images JPEG horodatées). Rien n'est validé ni publié.
const { chromium, devices } = require('playwright');
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const which = process.argv[3]; const B = 'http://localhost:3000';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'fr-FR', storageState: process.argv[4] });
  const p = await ctx.newPage();
  const go = async (r) => { await p.goto(B + r, { waitUntil: 'domcontentloaded', timeout: 240000 }); await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(3500); };
  const dir = path.join(OUT, which); fs.mkdirSync(dir, { recursive: true });
  let cdp, n = 0, rec = false; const meta = []; const marks = []; const mark = (l) => marks.push([l, Date.now() / 1000]);
  const start = async () => {
    cdp = await ctx.newCDPSession(p);
    cdp.on('Page.screencastFrame', async (f) => { if (rec) { const fn = `f${String(n++).padStart(5, '0')}.jpg`; fs.writeFileSync(path.join(dir, fn), Buffer.from(f.data, 'base64')); meta.push([fn, f.metadata.timestamp]); } await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 786, maxHeight: 1704, everyNthFrame: 1 });
    rec = true;
  };
  const stop = async () => { rec = false; await cdp.send('Page.stopScreencast'); fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta)); fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(marks)); console.log(which, meta.length, 'images'); };
  const W = (ms) => p.waitForTimeout(ms);
  const tap = async (name) => { for (const t of [p.getByRole('button', { name, exact: true }), p.getByRole('tab', { name }), p.getByRole('button', { name }), p.getByLabel(name)]) { if (await t.count()) { await t.first().click({ timeout: 8000 }); return; } } console.log('introuvable', name); };
  // Gestes au tempo : une action tous les 500 ms (un temps à 120 BPM), instants notés dans marks.json.
  const beatWait = async (t0, k) => { const due = t0 + k * 500; const d = due - Date.now(); if (d > 0) await W(d); };
  if (which === 'explorer') {
    await go('/explorer'); await start(); await W(1000);
    const t0 = Date.now(); mark('tiroir');
    await p.getByRole('button', { name: 'Ouvrir le menu Explorer' }).click();
    await beatWait(t0, 4); await stop();
  } else if (which === 'compas') {
    await go('/compas?nouvelle=1'); await start(); await W(900);
    const inp = p.locator('input:visible, textarea:visible').first(); await inp.click(); await W(400);
    const words = ['5 jours', ' dans les Alpes,', ' rando,', ' via ferrata', ' et kayak'];
    const t0 = Date.now();
    for (let k = 0; k < words.length; k++) { await beatWait(t0, k); mark('mot' + k); await p.keyboard.type(words[k], { delay: 12 }); }
    await beatWait(t0, words.length + 1); await stop();   // on ne valide pas : aucune aventure n'est créée
  } else if (which === 'club') {
    await go('/clubs/cordee-des-alpes'); await start(); await W(900);
    const t0 = Date.now();
    mark('espaces'); await p.getByRole('button', { name: /Espaces du club/ }).first().click();
    await beatWait(t0, 2); mark('membres'); await tap('Membres et cordée du club');
    await beatWait(t0, 3); mark('sorties'); await tap('Sorties programmées, agenda et météo');
    await beatWait(t0, 5); await stop();
  }
  await b.close();
})();
