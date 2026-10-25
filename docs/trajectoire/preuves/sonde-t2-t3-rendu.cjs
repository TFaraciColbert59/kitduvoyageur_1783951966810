// Gate T3 (bis) : le Chip d en-tete porte une icone "LKDV", donc son
// textContent est "LKDV<n> a ton echelle" et non "<n> a ton echelle".
// On tolere le prefixe, et on exige les DEUX preuves concordantes :
//   - le compteur d en-tete
//   - au moins une trace portant reellement le badge vert
const { chromium } = require('playwright');

const ZONE_IDS = ['run', 'journee', 'raid', 'expedition', 'monde'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto('http://localhost:4028/trajectoire', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const chips = page.locator('[role="group"][aria-label*="chelle"] button');
  const nb = await chips.count();
  const parZone = {};

  for (let i = 0; i < nb; i++) {
    const libelle = (await chips.nth(i).innerText()).trim();
    await chips.nth(i).click();
    await page.waitForTimeout(800);
    parZone[ZONE_IDS[i]] = await page.evaluate(() => {
      const head = document.querySelector('#tj-h-traces')?.closest('.tj-card__head');
      const chipHead = head ? Array.from(head.querySelectorAll('span'))
        .map((e) => (e.textContent || '').trim())
        .find((t) => /(\d+).*chelle$/.test(t)) : null;
      const badges = Array.from(document.querySelectorAll('.tj-trace .tj-chip, .tj-trace span'))
        .map((e) => (e.textContent || '').trim())
        .filter((t) => /^.*chelle$/.test(t) && t !== chipHead);
      const traces = Array.from(document.querySelectorAll('.tj-trace')).map((t) => ({
        qui: (t.querySelector('.tj-trace__who b') || {}).textContent || '?',
        echelle: (t.querySelector('.tj-trace__who span') || {}).textContent || '',
        badge: /chelle/.test(t.textContent || ''),
        dim: (t.className || '').includes('tj-trace--dim'),
      }));
      return {
        compteur_en_tete: chipHead,
        compteur_n: chipHead ? parseInt((chipHead.match(/(\d+)/) || [0, 0])[1], 10) : null,
        nb_badges_trace: badges.length,
        traces,
      };
    });
    parZone[ZONE_IDS[i]].libelle_puce = libelle;
  }

  const gate = ['journee', 'raid', 'expedition'].map((z) => {
    const d = parZone[z];
    const concordant = d.compteur_n === d.nb_badges_trace;
    return {
      zone: z,
      compteur_en_tete: d.compteur_n,
      badges_reellement_affiches: d.nb_badges_trace,
      traces: d.traces.filter((t) => t.badge).map((t) => t.qui + ' / ' + t.echelle),
      concordant: concordant,
      passe: d.compteur_n >= 1 && d.nb_badges_trace >= 1 && concordant,
    };
  });

  console.log(JSON.stringify({
    par_zone: parZone,
    T3_gate_3_zones: gate,
    T3_passe: gate.every((g) => g.passe),
    erreurs_console_provenance: errs.filter((e) => /provenance|bug bloquant/i.test(e)),
    erreurs_console_toutes: errs,
  }, null, 2));
  await browser.close();
})();