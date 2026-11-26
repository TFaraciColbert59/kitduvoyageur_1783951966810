// LKDV — « Une phrase, une aventure ». 20 s, 9:16, 122,3 BPM (piste « Mountains », Mixkit).
// Une seule forme, jamais coupée : point de lumière → fenêtre sur la montagne → champ du Compas → bandeau
// « Je prépare ton aventure… » → écran du Hub (les tuiles en jaillissent) → bouton « Démarrer le voyage »
// → DROP plein cadre → carte du carnet → plein cadre → carte Suivi en direct → plein cadre → point → logo.
// Tout est une fonction pure du temps : draw(t). Ressorts en réponse indicielle fermée.
(function () {
  const B = 0.4908, b = (n) => n * B, D = 20.0;
  const clamp = (v, a = 0, z = 1) => Math.max(a, Math.min(z, v));
  function stepR(tau, sp) {
    if (tau <= 0) return 0;
    const w = sp.w, z = sp.z;
    if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
  }
  class Track {
    constructor(v0) { this.v0 = v0; this.cur = v0; this.ev = []; }
    to(t, v, sp) { if (v !== this.cur) { this.ev.push([t, v - this.cur, sp]); this.cur = v; } return this; }
    at(t) { let v = this.v0; for (const e of this.ev) v += e[1] * stepR(t - e[0], e[2]); return v; }
  }
  const SH = { w: 15, z: 0.82 }, FAST = { w: 24, z: 0.9 }, CAM = { w: 12, z: 1 }, POP = { w: 20, z: 0.72 };
  function vis(t, tin, tout, dOut = 0.12, sp = { w: 26, z: 1 }) {
    const e = stepR(t - tin, sp), x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
    return { o: e * (1 - xo), bl: (1 - e) * 12 + xo * 12, dy: (1 - e) * 18 - xo * 12, e };
  }
  const $ = (id) => document.getElementById(id);

  // ---------------- la forme
  const S = { x: new Track(540), y: new Track(960), w: new Track(26), h: new Track(26), r: new Track(13) };
  function shape(t, x, y, w, h, r, sp = SH) { S.x.to(t, x, sp); S.y.to(t, y, sp); S.w.to(t, w, sp); S.h.to(t, h, sp); S.r.to(t, r, sp); }
  shape(0.04, 540, 960, 900, 1560, 72, { w: 13, z: 0.8 });          // le point s'ouvre en fenêtre
  shape(b(4) - 0.12, 540, 1060, 980, 769, 50);                      // le champ du Compas
  shape(b(10) + 0.08, 540, 1000, 900, 190, 95);                     // le bandeau « Je prépare ton aventure… »
  shape(b(12) - 0.14, 540, 1010, 600, 1301, 64);                    // l'écran du Hub
  shape(b(13) - 0.05, 540, 1010, 440, 954, 50);                     // il recule, les tuiles jaillissent
  shape(b(17.6), 540, 1010, 600, 1301, 64);
  shape(b(18) - 0.12, 540, 1000, 980, 201, 50);                     // le bouton « Démarrer le voyage »
  shape(b(20), 540, 960, 1200, 2140, 0, FAST);                      // DROP : plein cadre
  shape(b(24) - 0.12, 540, 1180, 940, 523, 56);                     // le carnet
  shape(b(26) - 0.06, 540, 960, 1200, 2140, 0, FAST);
  shape(b(28) - 0.12, 540, 1130, 940, 328, 50);                     // Suivi en direct
  shape(b(30) - 0.06, 540, 960, 1200, 2140, 0, FAST);
  shape(b(34) - 0.1, 540, 800, 28, 28, 14, { w: 14, z: 0.9 });     // retour au point
  // couleur de fond de la forme (r, g, b)
  const BG = [new Track(208), new Track(160), new Track(112)];
  function bg(t, c, sp = FAST) { BG.forEach((tr, i) => tr.to(t, c[i], sp)); }
  bg(0.1, [10, 15, 12]); bg(b(10) + 0.08, [0, 0, 0]); bg(b(12) - 0.1, [233, 238, 234]); bg(b(18) - 0.1, [250, 250, 249]);
  bg(b(20), [10, 15, 12]); bg(b(24) - 0.1, [250, 250, 249]); bg(b(26) - 0.06, [10, 15, 12]); bg(b(28) - 0.1, [240, 243, 240]);
  bg(b(30) - 0.06, [10, 15, 12]); bg(b(34) - 0.1, [208, 160, 112]);

  // ---------------- couches de contenu (dans la forme) : [id, entrée, sortie, entrée sèche ?]
  const LAYERS = [
    ['L_j01', 0.0, b(1), true], ['L_j17', b(1), b(2), true], ['L_g12a', b(2), b(3), true], ['L_a02a', b(3), b(4) - 0.02, true],
    ['L_compas', b(4) - 0.02, b(10) + 0.05], ['L_prep', b(10) + 0.12, b(12) - 0.1], ['L_hub', b(12) - 0.08, b(18) - 0.1],
    ['L_etapes', b(18) - 0.06, b(20) - 0.02], ['L_dawn', b(20), b(24) + 0.1, true], ['L_carnet', b(24) + 0.06, b(26) - 0.1],
    ['L_night', b(26), b(28) + 0.1, true], ['L_beacon', b(28) + 0.06, b(30) - 0.1], ['L_mother', b(30), b(32), true], ['L_refuge', b(32), b(34) + 0.12, true],
  ];
  const PUNCH = [0, b(1), b(2), b(3), b(20), b(26), b(30), b(32)];

  // ---------------- textes (hors forme) : [id, entrée, sortie]
  const TEXTS = [
    ['T_w1', 0.06, b(1)], ['T_w2', b(1), b(2)], ['T_w3', b(2), b(3)], ['T_w4', b(3), b(4)],
    ['T_ceye', b(4.3), b(10) - 0.05], ['T_chead', b(4.6), b(10) - 0.05],
    ['T_phead', b(10.4), b(12) - 0.05],
    ['T_heye', b(12.4), b(17.8)], ['T_hhead', b(12.7), b(17.8)],
    ['T_pret', b(18.3), b(20) - 0.02],
    ['T_toi', b(20.9), b(24) - 0.1],
    ['T_keye', b(24.2), b(26) - 0.1],
    ['T_ens', b(26.4), b(28) - 0.1],
    ['T_bhead1', b(28.2), b(30) - 0.1], ['T_bhead2', b(28.5), b(30) - 0.1],
    ['T_pren', b(32.3), b(34) - 0.1],
    ['T_brand', b(36), null], ['T_tag', b(37), null],
  ];

  // ---------------- curseur « Toi »
  const CX = new Track(560), CY = new Track(1500), CS = new Track(0);
  CS.to(b(4.6), 1, POP); CX.to(b(4.6), 150, CAM); CY.to(b(4.6), 965, CAM);
  // il suit la fin des mots tapés
  [[b(5), 330], [b(6), 520], [b(7), 760], [b(8), 900], [b(8.6), 930]].forEach(([t, x]) => CX.to(t, x, CAM));
  CX.to(b(9.4), 916, CAM); CY.to(b(9.4), 906, CAM);
  CS.to(b(10.5), 0, FAST);
  CX.to(b(17.4), 640, CAM); CY.to(b(17.4), 1500, CAM); CS.to(b(17.9), 1, POP);
  CX.to(b(18) - 0.05, 741, CAM); CY.to(b(18) - 0.05, 986, CAM);
  CS.to(b(20) + 0.25, 0, FAST);
  const CLICKS = [b(10)], HOLD0 = b(18.5), HOLD1 = b(20);

  // ---------------- tuiles du Hub
  const TB = { meteo: [37, 24, 584, 376], budget: [598, 24, 1143, 376], carte: [37, 390, 677, 1483], etapes: [690, 390, 1143, 1483],
    carnet: [37, 1497, 584, 1762], kits: [598, 1497, 1142, 1762], paperasse: [37, 1776, 1142, 1984], groupe: [37, 1998, 1142, 2284] };
  const TD = { meteo: [175, 470, 300, -4], budget: [905, 470, 300, 4], carte: [168, 870, 228, 3], etapes: [912, 870, 168, -3],
    carnet: [175, 1260, 300, -3], kits: [905, 1260, 300, 3], paperasse: [540, 1590, 520, 1.5], groupe: [540, 1750, 520, -1.5] };
  const TORD = ['meteo', 'budget', 'carte', 'etapes', 'carnet', 'kits', 'paperasse', 'groupe'];
  const HS = 440 / 393, HL = 540 - 220, HT = 1010 - 477;   // écran du Hub réduit
  const TILE = {};
  TORD.forEach((n, k) => {
    const [x0, y0, x1, y1] = TB[n], [dx, dy, dw, rot] = TD[n];
    const sx = HL + (x0 + x1) / 6 * HS, sy = HT + (y0 + y1) / 6 * HS, cw = (x1 - x0) / 3 * HS;
    const tOut = b(13) + k * B / 2, tIn = b(17.4) + k * B / 8;
    const tr = { x: new Track(sx), y: new Track(sy), s: new Track(cw / dw), r: new Track(0), o: new Track(0) };
    tr.o.to(tOut, 1, { w: 40, z: 1 }); tr.x.to(tOut, dx, SH); tr.y.to(tOut, dy, SH); tr.s.to(tOut, 1, SH); tr.r.to(tOut, rot, SH);
    tr.x.to(tIn, sx, FAST); tr.y.to(tIn, sy, FAST); tr.s.to(tIn, cw / dw, FAST); tr.r.to(tIn, 0, FAST); tr.o.to(tIn + 0.18, 0, { w: 40, z: 1 });
    TILE[n] = { tr, dw };
  });

  // ---------------- compteurs du carnet (chiffres réels : 4 jours, 72 km, +4 520 m D+)
  const ODO = [['O1', 4, b(24.3)], ['O2', 72, b(24.55)], ['O3', 4520, b(24.8)]];
  const fmt = (n, big) => big ? '+' + Math.floor(n / 1000) + ' ' + String(n % 1000).padStart(3, '0') : String(n);

  // ---------------- carte Rencontre, point, anneau, logo
  const RC = { y: new Track(1820), r: new Track(8), s: new Track(0.85), o: new Track(0) };
  RC.o.to(b(32.4), 1, { w: 30, z: 1 }); RC.y.to(b(32.4), 1450, POP); RC.r.to(b(32.4), -2.5, POP); RC.s.to(b(32.4), 1, POP);
  RC.y.to(b(34) - 0.1, 800, FAST); RC.s.to(b(34) - 0.1, 0.05, FAST); RC.o.to(b(34) + 0.12, 0, { w: 40, z: 1 });
  const CANV = new Track(0); CANV.to(b(34), 1, { w: 8, z: 1 });            // pierre → forêt profonde
  const RING = new Track(0); RING.to(b(34.6), 1, { w: 10, z: 0.95 });
  const LOGO = new Track(0); LOGO.to(b(35.2), 1, { w: 12, z: 0.85 });

  function setVis(el, v, extraT = '') {
    el.style.opacity = v.o.toFixed(4);
    el.style.filter = v.bl > 0.05 ? `blur(${v.bl.toFixed(2)}px)` : 'none';
    el.style.transform = `translateY(${v.dy.toFixed(2)}px) ${extraT}`;
  }

  function draw(t) {
    // fond : pierre → forêt profonde
    const c = CANV.at(t);
    $('canvas').style.opacity = (1 - c).toFixed(4); $('canvas2').style.opacity = c.toFixed(4);
    // la forme
    const x = S.x.at(t), y = S.y.at(t), w = Math.max(2, S.w.at(t)), h = Math.max(2, S.h.at(t)), r = Math.max(0, S.r.at(t));
    const sh = $('shape');
    sh.style.left = (x - w / 2).toFixed(2) + 'px'; sh.style.top = (y - h / 2).toFixed(2) + 'px';
    sh.style.width = w.toFixed(2) + 'px'; sh.style.height = h.toFixed(2) + 'px'; sh.style.borderRadius = r.toFixed(2) + 'px';
    sh.style.background = `rgb(${BG.map((q) => clamp(Math.round(q.at(t)), 0, 255)).join(',')})`;
    sh.style.opacity = t > b(35.4) ? clamp(1 - (t - b(35.4)) / 0.2).toFixed(3) : '1';
    // couches
    for (const [id, tin, tout, hard] of LAYERS) {
      const el = $(id); let v;
      if (hard) { const nx = (LAYERS.find((L) => L[1] >= tout - 0.001 && L[1] <= tout + 0.001 && L[3])); const xo = nx ? (t < tout ? 0 : 1) : clamp((t - tout) / 0.22) ** 2; v = { o: t >= tin ? 1 - xo : 0, bl: nx ? 0 : xo * 14, dy: 0 }; }
      else v = vis(t, tin, tout, 0.12);
      el.style.opacity = v.o.toFixed(4); el.style.filter = v.bl > 0.05 ? `blur(${v.bl.toFixed(2)}px)` : 'none';
      let p = 1; for (const tp of PUNCH) if (t >= tp && t < tp + 0.6 && tp >= tin - 0.01 && tp < tout) p = 1 + 0.09 * Math.exp(-(t - tp) * 6);
      if (id === 'L_compas') {        // le panneau « Où veux-tu aller ? » cadré plein champ
        const k = 1.303; el.style.width = (786 * k).toFixed(1) + 'px'; el.style.height = (1704 * k).toFixed(1) + 'px';
        el.style.left = (w / 2 - (394 - 18) * k - 18 * k + 0 * k).toFixed(1) + 'px';
        el.style.top = (h / 2 - (1230) * k).toFixed(1) + 'px';
        el.style.transform = 'none';
      } else el.style.transform = `scale(${p.toFixed(4)})`;
    }
    // textes
    for (const [id, tin, tout] of TEXTS) setVis($(id), vis(t, tin, tout, 0.12));
    // curseur
    const cs = CS.at(t), cx = CX.at(t), cy = CY.at(t);
    let press = 1; for (const tc of CLICKS) press -= 0.16 * Math.exp(-(((t - tc) / 0.05) ** 2));
    if (t > HOLD0 && t < HOLD1 + 0.15) press = 1 - 0.16 * Math.min(1, (t - HOLD0) / 0.06) * (t < HOLD1 ? 1 : Math.exp(-(t - HOLD1) * 30));
    const cur = $('cursor');
    cur.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) scale(${(Math.max(0, cs) * press).toFixed(4)})`;
    // ondes de clic
    const rp = $('ripple'); let ro = 0, rs = 0;
    for (const tc of CLICKS.concat([HOLD1])) if (t >= tc && t < tc + 0.5) { const u = (t - tc) / 0.5; ro = 1 - u; rs = 0.3 + u * (tc === HOLD1 ? 6 : 1.6); }
    rp.style.opacity = ro.toFixed(3); rp.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) scale(${rs.toFixed(3)})`;
    // anneau de maintien (le voyage se « charge »)
    const hp = clamp((t - HOLD0) / (HOLD1 - HOLD0)), hr = $('holdring');
    hr.style.opacity = (t > HOLD0 && t < HOLD1 + 0.05 ? 1 : 0).toString();
    hr.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)`;
    $('holdarc').setAttribute('stroke-dashoffset', (377 * (1 - hp)).toFixed(2));
    // barre de préparation sous le bandeau
    const pg = clamp((t - b(10.5)) / (b(12) - 0.1 - b(10.5))), pv = vis(t, b(10.4), b(12) - 0.1);
    const bar = $('prepbar'); bar.style.opacity = pv.o.toFixed(3); $('prepfill').style.transform = `scaleX(${(1 - Math.pow(1 - pg, 3)).toFixed(4)})`;
    // tuiles
    for (const n of TORD) {
      const { tr, dw } = TILE[n], el = $('tile_' + n);
      el.style.opacity = clamp(tr.o.at(t)).toFixed(3);
      el.style.transform = `translate(${(tr.x.at(t) - dw / 2).toFixed(2)}px,${(tr.y.at(t)).toFixed(2)}px) translateY(-50%) rotate(${tr.r.at(t).toFixed(2)}deg) scale(${tr.s.at(t).toFixed(4)})`;
    }
    // compteurs
    for (const [id, val, t0] of ODO) {
      const u = clamp((t - t0) / 1.0), e = 1 - Math.pow(1 - u, 4), n = Math.round(val * e);
      $(id).textContent = fmt(n, val >= 1000);
      const v = vis(t, t0 - 0.05, b(26) - 0.1); setVis($(id + 'w'), v);
    }
    // carte Rencontre
    const rc = $('rencontre');
    rc.style.opacity = clamp(RC.o.at(t)).toFixed(3);
    rc.style.transform = `translate(-50%,-50%) translate(540px,${RC.y.at(t).toFixed(2)}px) rotate(${RC.r.at(t).toFixed(2)}deg) scale(${RC.s.at(t).toFixed(4)})`;
    // point → anneau → logo
    const rg = RING.at(t), ring = $('ring');
    ring.style.opacity = (t > b(34.5) ? clamp(1 - Math.max(0, LOGO.at(t) - 0.4) / 0.6) : 0).toFixed(3);
    ring.setAttribute('r', (14 + 136 * rg).toFixed(2));
    const lg = LOGO.at(t), logo = $('logo');
    logo.style.opacity = clamp(lg).toFixed(3); logo.style.transform = `translate(-50%,-50%) scale(${(0.8 + 0.2 * lg).toFixed(4)}) rotate(${((1 - lg) * -30).toFixed(2)}deg)`;
    // fondu final
    $('fin').style.opacity = clamp((t - (D - 0.3)) / 0.3).toFixed(3);
  }

  window.__timelines = window.__timelines || {};
  const proxy = { t: 0 };
  const tl = gsap.timeline({ paused: true, onUpdate: () => draw(tl.time()) });
  tl.to(proxy, { t: D, duration: D, ease: 'none', onUpdate: () => draw(proxy.t) }, 0);
  window.__timelines['main'] = tl;
  window.__filmDraw = draw;
  draw(0);
})();
