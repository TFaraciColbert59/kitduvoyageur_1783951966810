/* LKDV trailer — lib/fx/transitions.js
 * Bibliothèque de transitions et d'effets lumineux, pilotés par le temps (fonctions pures de leurs entrées).
 * Chaque effet dessine sur un contexte 2D ; aucun état n'est gardé d'une image à l'autre, sauf des caches
 * construits une fois (textures, particules) à partir d'une graine. Signature et paramètres : fx-lab/FX.md.
 * Dépend de core.js (et de plates.js pour les nuages par défaut).
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Transitions) return;
  var W = 1920,
    H = 1080;
  var cache = {};
  function tmpCanvas(key, w, h) {
    var c = cache[key];
    if (!c) c = cache[key] = FX.canvas(w || W, h || H);
    return c;
  }

  /* 1. Flash solaire de coupe. f = image locale, o.cut = image de la coupe (première image du plan entrant).
   * Blanchit l'image sur o.pre images avant et o.post images après la coupe (2 à 4 au total). */
  function solarFlash(ctx, f, o) {
    o = o || {};
    var cut = o.cut || 0,
      pre = o.pre == null ? 2 : o.pre,
      post = o.post == null ? 2 : o.post;
    var I = o.intensity == null ? 1 : o.intensity;
    var col = o.color || FX.RGB.stone;
    var org = o.origin || [W * 0.75, H * 0.2];
    var d = f - (cut - 0.5);
    var wdt = d < 0 ? pre * 0.62 : post * 0.75;
    if (Math.abs(d) > (d < 0 ? pre : post) + 0.5) return 0;
    var env = Math.exp(-(d * d) / (wdt * wdt)) * I;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(org[0], org[1], 0, org[0], org[1], W * 0.9);
    g.addColorStop(0, FX.rgba(col, Math.min(1, env)));
    g.addColorStop(0.4, FX.rgba(col, Math.min(1, env * 0.6)));
    g.addColorStop(1, FX.rgba(col, env * 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = FX.rgba(col, Math.min(0.96, Math.pow(env, 1.6) * 0.9));
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return env;
  }

  /* 2. Flou radial de chute : src (canevas) dessiné avec un flou de zoom autour de o.origin,
   * plus une vibration à graine (o.shake px, image o.frame). */
  function radialBlur(ctx, src, o) {
    o = o || {};
    var org = o.origin || [W / 2, H / 2];
    var sx = 0,
      sy = 0;
    if (o.shake) {
      var f = o.frame || 0;
      sx = (FX.hash2(f, 1, o.seed || 3) - 0.5) * 2 * o.shake;
      sy = (FX.hash2(f, 2, o.seed || 3) - 0.5) * 2 * o.shake;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    FX.zoomBlur(ctx, src, org[0], org[1], o.amount == null ? 0.06 : o.amount, o.samples || 10, W, H);
    ctx.restore();
  }

  /* 3. Traversée de nuage. p ∈ [0, 1] : les nappes arrivent sur la caméra, blanchiment au milieu,
   * puis (o.hole) la couche se déchire en trouée autour de o.origin. Rejouée avec p décroissant = remontée. */
  function cloudPass(ctx, p, o) {
    o = o || {};
    var cl = o.clouds || (cache.clouds = cache.clouds || FX.Plates.clouds(o.seed || 404));
    var org = o.origin || [W / 2, H / 2];
    var dens = o.density == null ? 1 : o.density;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var tex = [cl.a, cl.b, cl.c];
    var NL = 7;
    for (var i = 0; i < NL; i++) {
      var z = (i / NL + p * 1.15) % 1; // profondeur : 0 loin, 1 sur la caméra
      var sc = 0.6 / (1.04 - z);
      var a = FX.smooth(0, 0.25, z) * (1 - FX.smooth(0.72, 1, z)) * Math.sin(Math.PI * FX.clamp(p * 1.05, 0, 1)) * dens;
      if (a <= 0.01) continue;
      var t = tex[i % 3];
      var w = W * sc,
        h = H * sc;
      ctx.globalAlpha = Math.min(1, a * 1.25);
      ctx.drawImage(t, org[0] - w / 2 + (i - 3) * 40 * sc, org[1] - h / 2, w, h);
    }
    // Blanchiment au cœur du nuage.
    var wo = Math.pow(Math.sin(Math.PI * FX.clamp((p - 0.15) / 0.7, 0, 1)), 2) * 0.85 * dens;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(232,238,245," + wo.toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    // Couche avec trouée qui s'ouvre (P04).
    if (o.hole) {
      var hp = FX.ramp(0.55, 1, p);
      if (hp > 0) {
        var tc = tmpCanvas("cloudHole"),
          tx = tc.getContext("2d");
        tx.setTransform(1, 0, 0, 1, 0, 0);
        tx.globalCompositeOperation = "source-over";
        tx.clearRect(0, 0, W, H);
        tx.fillStyle = "rgb(214,222,234)";
        tx.fillRect(0, 0, W, H);
        tx.globalAlpha = 1;
        tx.drawImage(cl.a, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
        tx.globalAlpha = 0.7;
        tx.drawImage(cl.b, -W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
        tx.globalAlpha = 1;
        var r = FX.ease.inCubic(hp) * W * 0.9 + 4;
        tx.globalCompositeOperation = "destination-out";
        var hg = tx.createRadialGradient(org[0], org[1], r * 0.35, org[0], org[1], r);
        hg.addColorStop(0, "rgba(0,0,0,1)");
        hg.addColorStop(1, "rgba(0,0,0,0)");
        tx.fillStyle = hg;
        tx.fillRect(0, 0, W, H);
        // Déchirure : filaments de bruit sur le bord de la trouée.
        tx.globalAlpha = 0.6;
        tx.drawImage(cl.c, org[0] - r * 1.3, org[1] - r * 0.75, r * 2.6, r * 1.5);
        tx.globalAlpha = 1;
        tx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = Math.min(1, FX.ramp(0.55, 0.65, p) * 1) * dens;
        ctx.drawImage(tc, 0, 0);
      }
    }
    ctx.restore();
    return wo;
  }

  /* 4. Traversée de vitre. outC = plan sortant (vu de dehors, la fenêtre en o.rect), inC = plan entrant (dedans).
   * p ∈ [0, 1] : la fenêtre grandit jusqu'à remplir le cadre (p ≤ o.pass), on passe la vitre (gouttes et reflet
   * qui grossissent et s'effacent), éclat chaud au passage. */
  function glassPass(ctx, outC, inC, p, o) {
    o = o || {};
    var rect = o.rect || [W / 2 - 60, H / 2 - 40, 120, 80];
    var pass = o.pass || 0.62;
    var warm = o.warm || [255, 214, 160];
    var drops = cache["drops" + (o.seed || 6)];
    if (!drops) {
      var rnd = FX.mulberry32(o.seed || 6);
      drops = [];
      for (var i = 0; i < (o.drops || 140); i++) drops.push([rnd(), rnd(), 0.004 + 0.012 * Math.pow(rnd(), 2), rnd()]);
      cache["drops" + (o.seed || 6)] = drops;
    }
    var rcx = rect[0] + rect[2] / 2,
      rcy = rect[1] + rect[3] / 2;
    var k = FX.ease.inCubic(FX.ramp(0, pass, p));
    var Sfull = (W / rect[2]) * 1.12;
    var S = Math.exp(Math.log(Sfull) * k);
    var cx = FX.lerp(rcx, W / 2, k),
      cy = FX.lerp(rcy, H / 2, k);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p < pass) {
      // Dehors : on plonge vers la fenêtre (flou de zoom croissant).
      var tc = tmpCanvas("glassOut"),
        tx = tc.getContext("2d");
      tx.setTransform(S, 0, 0, S, cx - rcx * S, cy - rcy * S);
      tx.drawImage(outC, 0, 0, W, H);
      // L'intérieur dans le cadre de la fenêtre.
      tx.save();
      tx.beginPath();
      tx.rect(rect[0], rect[1], rect[2], rect[3]);
      tx.clip();
      var inner = FX.lerp(0.25, 1, k);
      var iw = (rect[2] * inner * 1.3),
        ih = (rect[3] * inner * 1.3);
      tx.drawImage(inC, rcx - iw / 2, rcy - ih / 2, iw, ih);
      // Vitre : reflet bleuté et gouttes.
      var rg = tx.createLinearGradient(rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]);
      rg.addColorStop(0, "rgba(140,170,210,0.22)");
      rg.addColorStop(0.5, "rgba(250,248,245,0.06)");
      rg.addColorStop(1, "rgba(60,90,130,0.2)");
      tx.fillStyle = rg;
      tx.fillRect(rect[0], rect[1], rect[2], rect[3]);
      tx.fillStyle = "rgba(250,248,245,0.22)";
      for (var d = 0; d < drops.length; d++) {
        var dr = drops[d];
        tx.beginPath();
        tx.arc(rect[0] + dr[0] * rect[2], rect[1] + dr[1] * rect[3], dr[2] * rect[2], 0, Math.PI * 2);
        tx.fill();
      }
      tx.restore();
      ctx.globalAlpha = 1;
      FX.zoomBlur(ctx, tc, W / 2, H / 2, 0.08 * k * k, 8, W, H);
    } else {
      // Dedans : la vitre passe sur la caméra.
      var q = FX.ramp(pass, 1, p);
      var settle = 1 + 0.08 * (1 - FX.ease.outCubic(q));
      ctx.drawImage(inC, W / 2 - (W * settle) / 2, H / 2 - (H * settle) / 2, W * settle, H * settle);
      var da = 1 - FX.smooth(0, 0.6, q);
      if (da > 0) {
        ctx.globalAlpha = da;
        ctx.filter = "blur(" + (2 + 10 * q).toFixed(1) + "px)";
        ctx.fillStyle = "rgba(250,248,245,0.16)";
        var big = 1 + 5 * q;
        for (var d2 = 0; d2 < drops.length; d2 += 3) {
          var e = drops[d2];
          ctx.beginPath();
          ctx.arc(W / 2 + (e[0] - 0.5) * W * big, H / 2 + (e[1] - 0.5) * H * big, e[2] * W * big * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      }
    }
    // Éclat chaud au passage de la vitre.
    var fl = Math.exp(-Math.pow((p - pass) / 0.06, 2)) * (o.intensity == null ? 1 : o.intensity);
    if (fl > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = FX.rgba(warm, 0.55 * fl);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  /* 5. Éclat d'objectif sobre : voile autour du soleil et quelques taches sur l'axe soleil → centre. */
  function lensFlare(ctx, o) {
    o = o || {};
    var sun = o.sun || [W * 0.78, H * 0.22];
    var I = o.intensity == null ? 1 : o.intensity;
    if (I <= 0) return;
    var col = o.color || [250, 236, 210];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    var v = ctx.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], W * 0.55);
    v.addColorStop(0, FX.rgba(col, 0.55 * I));
    v.addColorStop(0.08, FX.rgba(col, 0.22 * I));
    v.addColorStop(0.5, FX.rgba(col, 0.05 * I));
    v.addColorStop(1, FX.rgba(col, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // Voile général très léger (perte de contraste).
    ctx.fillStyle = FX.rgba(col, 0.04 * I);
    ctx.fillRect(0, 0, W, H);
    var axX = W / 2 - sun[0],
      axY = H / 2 - sun[1];
    var ghosts = o.ghosts || [
      [0.45, 26, 0.07, [180, 220, 200]],
      [0.8, 60, 0.04, [143, 174, 134]],
      [1.25, 14, 0.09, [250, 248, 245]],
      [1.55, 90, 0.03, [150, 190, 220]],
      [1.9, 36, 0.05, [201, 216, 194]],
    ];
    for (var i = 0; i < ghosts.length; i++) {
      var G = ghosts[i];
      var gx = sun[0] + axX * G[0],
        gy = sun[1] + axY * G[0];
      var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, G[1]);
      rg.addColorStop(0, FX.rgba(G[3], G[2] * I * 0.6));
      rg.addColorStop(0.75, FX.rgba(G[3], G[2] * I));
      rg.addColorStop(1, FX.rgba(G[3], 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(gx, gy, G[1], 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 6. Étincelle qui monte : particules précalculées (graine), une étincelle maîtresse qui file vers le ciel.
   * t en secondes locales. Retourne la position de l'étincelle maîtresse (pour qu'une caméra la suive). */
  function ember(ctx, t, o) {
    o = o || {};
    var org = o.origin || [W / 2, H * 0.86];
    var key = "ember" + (o.seed || 47) + "_" + (o.count || 46);
    var P = cache[key];
    if (!P) {
      var rnd = FX.mulberry32(o.seed || 47);
      P = [];
      for (var i = 0; i < (o.count || 46); i++)
        P.push({ b: rnd() * (o.span || 1.6), L: 0.5 + rnd() * 0.9, vx: (rnd() - 0.5) * 120, vy: 260 + rnd() * 340, sw: 10 + rnd() * 30, w: 4 + rnd() * 8, ph: rnd() * 6.28, s: 1 + rnd() * 1.6 });
      cache[key] = P;
    }
    var hot = o.color || [255, 190, 110];
    var tip = FX.RGB.stone;
    function posAt(q, a, out) {
      out[0] = org[0] + q.vx * a + q.sw * Math.sin(q.w * a + q.ph);
      out[1] = org[1] - q.vy * a + 60 * a * a;
      return out;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    var A = [0, 0],
      B = [0, 0];
    for (var j = 0; j < P.length; j++) {
      var q = P[j];
      var a = t - q.b;
      if (a < 0 || a > q.L) continue;
      var life = 1 - a / q.L;
      posAt(q, a, A);
      posAt(q, Math.max(0, a - 0.05), B);
      ctx.strokeStyle = FX.rgba(hot, 0.8 * life);
      ctx.lineWidth = q.s;
      ctx.beginPath();
      ctx.moveTo(B[0], B[1]);
      ctx.lineTo(A[0], A[1]);
      ctx.stroke();
    }
    // Étincelle maîtresse : part à o.heroStart, monte jusqu'au ciel en ralentissant.
    var hs = o.heroStart == null ? 0.2 : o.heroStart,
      hd = o.heroDuration || 1.3;
    var ha = FX.clamp((t - hs) / hd, 0, 1);
    var hero = null;
    if (t >= hs) {
      var rise = o.rise || H * 0.8;
      var e = FX.ease.outCubic(ha);
      var hx = org[0] + 40 * Math.sin(ha * 5.2) * (1 - ha * 0.5),
        hy = org[1] - rise * e;
      var glow = (1 - 0.6 * ha) * (o.intensity == null ? 1 : o.intensity);
      for (var k = 1; k <= 8; k++) {
        var ta = FX.clamp(ha - k * 0.012, 0, 1);
        var te = FX.ease.outCubic(ta);
        ctx.fillStyle = FX.rgba(hot, 0.35 * glow * (1 - k / 9));
        ctx.beginPath();
        ctx.arc(org[0] + 40 * Math.sin(ta * 5.2) * (1 - ta * 0.5), org[1] - rise * te, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      var g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      g.addColorStop(0, FX.rgba(tip, 0.95 * glow));
      g.addColorStop(0.2, FX.rgba(hot, 0.6 * glow));
      g.addColorStop(1, FX.rgba(hot, 0));
      ctx.fillStyle = g;
      ctx.fillRect(hx - 26, hy - 26, 52, 52);
      hero = [hx, hy];
    }
    ctx.restore();
    return hero;
  }

  /* 7. Remontée accélérée (P52). stages : [{ draw(ctx, k, local), from, to }] sur p ∈ [0, 1] (déjà accéléré par
   * l'appelant ou via o.accel), chaque étage dessiné dans un tampon puis flouté radialement selon la vitesse. */
  function ascent(ctx, stages, p, o) {
    o = o || {};
    var accel = o.accel == null ? 2.2 : o.accel;
    var u = Math.pow(FX.clamp(p, 0, 1), accel);
    var speed = accel * Math.pow(Math.max(p, 0.001), accel - 1); // du/dp
    var buf = tmpCanvas("ascent"),
      bx = buf.getContext("2d");
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = "source-over";
    bx.fillStyle = FX.rgba(FX.RGB.ink, 1);
    bx.fillRect(0, 0, W, H);
    for (var i = 0; i < stages.length; i++) {
      var st = stages[i];
      var fadeIn = st.fadeIn || 0;
      if (u < st.from - fadeIn || u > st.to) continue;
      var local = FX.ramp(st.from, st.to, u);
      bx.save();
      bx.globalAlpha = fadeIn > 0 ? FX.smooth(st.from - fadeIn, st.from, u) : 1;
      st.draw(bx, u, local);
      bx.restore();
    }
    var amount = (o.blur == null ? 0.05 : o.blur) * FX.clamp(speed / accel, 0, 1.6);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    FX.zoomBlur(ctx, buf, (o.origin || [W / 2, H / 2])[0], (o.origin || [W / 2, H / 2])[1], amount, o.samples || 9, W, H);
    ctx.restore();
    return u;
  }

  /* D. Logo fondu dans le halo du limbe (P01). Calque transparent ; jamais net (flou ≥ 6 px, masque d'anneau,
   * dissolution par bruit). f = image locale de P01 (0–89). o : { cx, cy, R (cercle du limbe en px),
   * angle (degrés, position sur le limbe ; −90 = sommet), size (px), intensity, appear [f0, f1], dissolve [f0, f1] }. */
  function limbHalo(ctx, f, o) {
    o = o || {};
    var cx = o.cx == null ? 1650 : o.cx,
      cy = o.cy == null ? 2820 : o.cy,
      R = o.R || 2600;
    var ang = ((o.angle == null ? -104 : o.angle) * Math.PI) / 180;
    var size = o.size || 300;
    var I = o.intensity == null ? 1 : o.intensity;
    var ap = o.appear || [8, 34],
      ds = o.dissolve || [46, 80];
    var vis = FX.smooth(ap[0], ap[1], f) * (1 - FX.smooth(ds[0], ds[1], f));
    if (vis <= 0.001) return 0;
    var dis = FX.ramp(ds[0], ds[1], f);
    var T = FX.Traces;
    var lc = tmpCanvas("haloLogo", 512, 512),
      lx = lc.getContext("2d");
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.clearRect(0, 0, 512, 512);
    var s = 12;
    lx.setTransform(s, 0, 0, s, 256 - 16 * s, 256 - 15 * s);
    lx.strokeStyle = "rgb(250,248,245)";
    lx.fillStyle = "rgb(250,248,245)";
    lx.lineWidth = T.LOGO.strokeWidth;
    lx.lineJoin = "round";
    lx.lineCap = "round";
    lx.stroke(new Path2D(T.LOGO.mountains));
    lx.stroke(new Path2D(T.LOGO.base));
    lx.beginPath();
    lx.arc(T.LOGO.sun.cx, T.LOGO.sun.cy, T.LOGO.sun.r, 0, Math.PI * 2);
    lx.fill();
    var oc = tmpCanvas("haloOut"),
      ox = oc.getContext("2d");
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.globalCompositeOperation = "source-over";
    ox.clearRect(0, 0, W, H);
    var lift = o.lift == null ? -6 : o.lift; // décalage radial du centre du logo (px, négatif = dans l'atmosphère)
    var px = cx + Math.cos(ang) * (R + lift),
      py = cy + Math.sin(ang) * (R + lift);
    ox.translate(px, py);
    ox.rotate(ang + Math.PI / 2);
    // Écrasé dans l'épaisseur de l'atmosphère, comme un relief de lumière.
    ox.scale(1, 0.45);
    ox.filter = "blur(" + (6 + 10 * dis).toFixed(1) + "px)";
    var sz = size * (1 + 0.15 * dis);
    ox.drawImage(lc, -sz / 2, -sz * 0.62, sz, sz);
    ox.filter = "none";
    ox.setTransform(1, 0, 0, 1, 0, 0);
    // Masque : seulement dans l'anneau lumineux du limbe.
    ox.globalCompositeOperation = "destination-in";
    var rg = ox.createRadialGradient(cx, cy, R - 45, cx, cy, R + 40);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(0.18, "rgba(0,0,0,0.75)");
    rg.addColorStop(0.32, "rgba(0,0,0,1)");
    rg.addColorStop(0.7, "rgba(0,0,0,0.35)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ox.fillStyle = rg;
    ox.fillRect(0, 0, W, H);
    // Dissolution granuleuse.
    if (dis > 0) {
      var nz = cache.haloNoise || (cache.haloNoise = FX.Plates.noiseCanvas(480, 270, { seed: 90, fx: 0.06, fy: 0.06, lo: 0.0, hi: 1.0, rgb: [0, 0, 0] }));
      ox.globalCompositeOperation = "destination-out";
      ox.globalAlpha = Math.min(1, dis * 1.3);
      ox.drawImage(nz, 0, 0, W, H);
      ox.globalAlpha = 1;
    }
    ox.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, 0.5 * vis * I);
    ctx.drawImage(oc, 0, 0);
    ctx.restore();
    return vis;
  }

  FX.Transitions = {
    solarFlash: solarFlash,
    radialBlur: radialBlur,
    cloudPass: cloudPass,
    glassPass: glassPass,
    lensFlare: lensFlare,
    ember: ember,
    ascent: ascent,
    limbHalo: limbHalo,
  };
})(typeof window !== "undefined" ? window : globalThis);
