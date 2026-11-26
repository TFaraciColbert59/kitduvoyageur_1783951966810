/* LKDV trailer — lib/fx/plates.js
 * Plaques de remplacement en code, en attendant les images de Tony (img03, img04, img05) et plaques factices
 * des démonstrations. Chaque plaque est un canevas construit une fois au chargement, à graine fixe.
 * Dépend de core.js. Navigateur uniquement.
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Plates) return;

  function noiseCanvas(w, h, o) {
    // Texture de bruit fBm en RGBA : couleur fixe, alpha = bruit seuillé.
    var c = FX.canvas(w, h),
      x = c.getContext("2d");
    var img = x.createImageData(w, h),
      d = img.data;
    var fx = o.fx || 0.012,
      fy = o.fy || 0.012,
      seed = o.seed || 1;
    for (var j = 0; j < h; j++)
      for (var i = 0; i < w; i++) {
        var v = FX.fbm(i * fx, j * fy, o.oct || 5, seed);
        var a = FX.smooth(o.lo == null ? 0.42 : o.lo, o.hi == null ? 0.72 : o.hi, v);
        if (o.vignette) a *= FX.smooth(0, o.vignette, Math.min(i / w, 1 - i / w)) * FX.smooth(0, o.vignette, Math.min(j / h, 1 - j / h));
        var sh = FX.fbm(i * fx * 2 + 9, j * fy * 2, 3, seed + 3); // ombrage interne
        var k = (j * w + i) * 4;
        var lum = 0.78 + 0.22 * sh;
        d[k] = o.rgb[0] * lum;
        d[k + 1] = o.rgb[1] * lum;
        d[k + 2] = o.rgb[2] * lum;
        d[k + 3] = a * 255;
      }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* img05 de remplacement : ville européenne à l'heure bleue vue en plongée verticale, sous la pluie.
   * Plaque 3200×1800 ; la fenêtre de Léa est au centre exact. */
  function city(seed) {
    seed = seed || 505;
    var W = 3200,
      H = 1800;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var rnd = FX.mulberry32(seed);
    x.fillStyle = "rgb(24,34,46)";
    x.fillRect(0, 0, W, H);
    var lights = []; // [x, y, r, g, b, size]
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(-0.31);
    var span = 2300;
    var bx = -span;
    while (bx < span) {
      var bw = 150 + rnd() * 120;
      var by = -span;
      while (by < span) {
        var bh = 130 + rnd() * 110;
        // Toits de zinc mouillé.
        var z = 62 + rnd() * 30;
        x.fillStyle = "rgb(" + (z * 0.8) + "," + (z * 0.95) + "," + (z * 1.18) + ")";
        x.fillRect(bx, by, bw, bh);
        // Cour intérieure.
        x.fillStyle = "rgb(16,22,30)";
        var cw0 = 0.18 + rnd() * 0.3,
          ch0 = 0.18 + rnd() * 0.3;
        x.fillRect(bx + bw * (0.2 + rnd() * (0.6 - cw0)), by + bh * (0.22 + rnd() * (0.56 - ch0)), bw * cw0, bh * ch0);
        if (rnd() < 0.5) x.fillRect(bx + bw * (0.15 + rnd() * 0.5), by + bh * (0.2 + rnd() * 0.5), bw * 0.12, bh * 0.14);
        // Toits séparés : immeubles mitoyens de teintes différentes.
        for (var sp = 0; sp < 3; sp++) {
          var sx0 = bx + rnd() * bw;
          x.fillStyle = "rgba(10,16,24,0.55)";
          x.fillRect(sx0, by, 2, bh * (0.15 + rnd() * 0.2));
          x.fillRect(sx0, by + bh * (0.65 + rnd() * 0.2), 2, bh);
        }
        // Faîtages et reflets du ciel.
        x.fillStyle = "rgba(150,175,205,0.18)";
        x.fillRect(bx + 4, by + bh * 0.14, bw - 8, 3);
        x.fillRect(bx + 4, by + bh * 0.84, bw - 8, 3);
        // Cheminées.
        x.fillStyle = "rgb(30,36,44)";
        for (var ch = 0; ch < 6; ch++) x.fillRect(bx + rnd() * (bw - 10), by + rnd() * (bh - 10), 6 + rnd() * 6, 4 + rnd() * 4);
        // Lucarnes, certaines allumées.
        for (var lw = 0; lw < 16; lw++) {
          var side = rnd() < 0.5;
          var lx = bx + 8 + rnd() * (bw - 16),
            ly = side ? by + 8 + rnd() * 10 : by + bh - 18 + rnd() * 10;
          if (rnd() < 0.42) lights.push([lx, ly, 255, 176 + rnd() * 30, 90 + rnd() * 30, 3 + rnd() * 2]);
          else {
            x.fillStyle = "rgb(36,46,60)";
            x.fillRect(lx, ly, 5, 4);
          }
        }
        // Réverbères le long des rues.
        for (var s = 0; s < bw; s += 46) lights.push([bx + s, by - 12, 255, 190, 110, 2.6]);
        by += bh + 26;
      }
      bx += bw + 26;
    }
    x.restore();
    // Grande avenue en diagonale, mouillée, feux de voitures en filés.
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(0.55);
    x.fillStyle = "rgb(20,28,40)";
    x.fillRect(-2600, -46, 5200, 92);
    x.fillStyle = "rgba(120,150,190,0.10)";
    x.fillRect(-2600, -46, 5200, 92);
    // Arbres d'alignement.
    for (var tr = -2600; tr < 2600; tr += 34) {
      for (var sd = -1; sd <= 1; sd += 2) {
        x.fillStyle = "rgba(18,32,26,0.9)";
        x.beginPath();
        x.arc(tr + rnd() * 6, sd * (52 + rnd() * 4), 11 + rnd() * 4, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.lineCap = "round";
    for (var car = 0; car < 90; car++) {
      var lane = rnd() < 0.5 ? -1 : 1;
      var cx0 = -2400 + rnd() * 4800,
        len = 30 + rnd() * 70;
      x.strokeStyle = lane < 0 ? "rgba(255,60,50,0.85)" : "rgba(255,240,215,0.9)";
      x.lineWidth = 2.2;
      x.beginPath();
      x.moveTo(cx0, lane * (12 + rnd() * 22));
      x.lineTo(cx0 + len, lane * (12 + rnd() * 22));
      x.stroke();
    }
    x.restore();
    // Lumières : points nets + halo flou (reflets de pluie).
    var gl = FX.canvas(W / 4, H / 4),
      gx = gl.getContext("2d");
    gx.globalCompositeOperation = "lighter";
    var cos = Math.cos(-0.31),
      sin = Math.sin(-0.31);
    for (var i = 0; i < lights.length; i++) {
      var L = lights[i];
      var px = W / 2 + L[0] * cos - L[1] * sin,
        py = H / 2 + L[0] * sin + L[1] * cos;
      if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue;
      x.fillStyle = "rgb(" + (L[2] | 0) + "," + (L[3] | 0) + "," + (L[4] | 0) + ")";
      x.fillRect(px, py, L[5], L[5] * 0.8);
      gx.fillStyle = "rgba(" + (L[2] | 0) + "," + (L[3] | 0) + "," + (L[4] | 0) + ",0.5)";
      gx.fillRect(px / 4, py / 4, 1.2, 1.2);
    }
    // La fenêtre de Léa : la plus chaude, au centre exact.
    x.fillStyle = "rgb(255,214,150)";
    x.fillRect(W / 2 - 9, H / 2 - 6, 18, 12);
    gx.fillStyle = "rgba(255,190,110,1)";
    gx.beginPath();
    gx.arc(W / 8, H / 8, 5, 0, Math.PI * 2);
    gx.fill();
    x.globalCompositeOperation = "lighter";
    x.filter = "blur(4px)";
    x.drawImage(gl, 0, 0, W, H);
    x.filter = "blur(14px)";
    x.drawImage(gl, 0, 0, W, H);
    x.filter = "none";
    x.globalCompositeOperation = "source-over";
    // Ciel d'heure bleue reflété : voile acier.
    var vg = x.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, "rgba(60,90,130,0.05)");
    vg.addColorStop(1, "rgba(20,32,48,0.45)");
    x.fillStyle = vg;
    x.fillRect(0, 0, W, H);
    return c;
  }

  /* Couches de nuage (img04 de remplacement et traversées). */
  function clouds(seed) {
    seed = seed || 404;
    return {
      a: noiseCanvas(800, 450, { seed: seed, fx: 0.009, fy: 0.011, lo: 0.36, hi: 0.66, rgb: [238, 242, 248], vignette: 0.18 }),
      b: noiseCanvas(800, 450, { seed: seed + 17, fx: 0.016, fy: 0.014, lo: 0.42, hi: 0.7, rgb: [205, 214, 228], vignette: 0.18 }),
      c: noiseCanvas(640, 360, { seed: seed + 41, fx: 0.03, fy: 0.03, lo: 0.45, hi: 0.75, rgb: [250, 250, 252], vignette: 0.22 }),
    };
  }

  /* img03 de remplacement : stratosphère, mer de nuages, horizon courbe incliné de 10°. 2496×1404. */
  function strato(seed) {
    seed = seed || 303;
    var W = 2496,
      H = 1404;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var horizonY = H * 0.36;
    // Ciel.
    var g = x.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, "rgb(10,22,40)");
    g.addColorStop(0.55, "rgb(26,62,120)");
    g.addColorStop(0.9, "rgb(110,160,215)");
    g.addColorStop(1, "rgb(190,215,238)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // Mer de nuages en perspective (calcul basse résolution puis agrandi).
    var lw = 624,
      lh = 351;
    var lc = FX.canvas(lw, lh),
      lx = lc.getContext("2d");
    var img = lx.createImageData(lw, lh),
      d = img.data;
    var hy = horizonY / 4;
    for (var j = 0; j < lh; j++) {
      var dy = j - hy;
      if (dy <= 0) continue;
      var depth = 60 / (dy + 2);
      for (var i = 0; i < lw; i++) {
        var u = (i - lw / 2) * depth * 0.06,
          v = depth * 3;
        var n = FX.fbm(u + 50, v, 5, seed);
        var cov = FX.smooth(0.3, 0.6, n);
        var sh = FX.fbm(u * 2 + 3, v * 2, 3, seed + 5);
        var k = (j * lw + i) * 4;
        var haze = FX.smooth(0, 40, dy);
        // Nuage blanc ombré de bleu ; trouées bleu sombre (sol lointain).
        var r = FX.lerp(48, 236 - 50 * (1 - sh), cov),
          gg = FX.lerp(66, 242 - 40 * (1 - sh), cov),
          b = FX.lerp(98, 252 - 20 * (1 - sh), cov);
        d[k] = FX.lerp(200, r, haze);
        d[k + 1] = FX.lerp(220, gg, haze);
        d[k + 2] = FX.lerp(240, b, haze);
        d[k + 3] = 255;
      }
    }
    lx.putImageData(img, 0, 0);
    x.drawImage(lc, 0, 0, lc.width, lc.height, 0, 0, W, H);
    // Ciel au-dessus de l'horizon (recouvre la zone non calculée).
    x.save();
    x.beginPath();
    x.rect(0, 0, W, horizonY);
    x.clip();
    x.fillStyle = g;
    x.fillRect(0, 0, W, horizonY);
    x.restore();
    // Liseré lumineux de l'horizon.
    var hg = x.createLinearGradient(0, horizonY - 24, 0, horizonY + 18);
    hg.addColorStop(0, "rgba(220,235,250,0)");
    hg.addColorStop(0.6, "rgba(235,243,252,0.65)");
    hg.addColorStop(1, "rgba(235,243,252,0)");
    x.fillStyle = hg;
    x.fillRect(0, horizonY - 24, W, 42);
    return { canvas: c, horizonY: horizonY };
  }

  /* Démo : limbe terrestre au lever du soleil (pour le halo du logo et le flash solaire). */
  function limb(o) {
    o = o || {};
    var W = 1920,
      H = 1080;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var R = o.R || 2600,
      cx = o.cx == null ? 1650 : o.cx,
      cy = o.cy == null ? 2820 : o.cy;
    x.fillStyle = "rgb(8,20,16)";
    x.fillRect(0, 0, W, H);
    var rnd = FX.mulberry32(7);
    x.fillStyle = "rgba(250,248,245,0.7)";
    for (var s = 0; s < 160; s++) {
      var sx = rnd() * W,
        sy = rnd() * H;
      var dd = Math.hypot(sx - cx, sy - cy);
      if (dd < R + 60) continue;
      x.globalAlpha = 0.2 + rnd() * 0.6;
      x.fillRect(sx, sy, 1.2, 1.2);
    }
    x.globalAlpha = 1;
    // Disque : océans et nuages, plus clairs vers le soleil.
    x.save();
    x.beginPath();
    x.arc(cx, cy, R, 0, Math.PI * 2);
    x.clip();
    var g = x.createRadialGradient(cx + R * 0.35, cy - R * 0.95, 50, cx, cy, R * 1.1);
    g.addColorStop(0, "rgb(70,110,150)");
    g.addColorStop(0.35, "rgb(22,46,72)");
    g.addColorStop(1, "rgb(8,18,26)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    var cl = noiseCanvas(480, 270, { seed: 77, fx: 0.02, fy: 0.035, lo: 0.5, hi: 0.75, rgb: [210, 220, 230] });
    x.globalAlpha = 0.35;
    x.drawImage(cl, 0, 0, W, H);
    x.globalAlpha = 1;
    x.restore();
    // Atmosphère : orange au ras, puis cyan, bleu profond.
    var a = x.createRadialGradient(cx, cy, R - 6, cx, cy, R + 70);
    a.addColorStop(0, "rgba(255,190,120,0.55)");
    a.addColorStop(0.12, "rgba(250,248,245,0.6)");
    a.addColorStop(0.3, "rgba(120,210,235,0.45)");
    a.addColorStop(0.6, "rgba(40,90,170,0.18)");
    a.addColorStop(1, "rgba(20,40,90,0)");
    x.fillStyle = a;
    x.beginPath();
    x.arc(cx, cy, R + 70, 0, Math.PI * 2);
    x.arc(cx, cy, R - 6, 0, Math.PI * 2, true);
    x.fill();
    return { canvas: c, cx: cx, cy: cy, R: R };
  }

  /* Démo : crêtes au lever du jour (flash, éclat d'objectif, flou de chute). */
  function ridges(o) {
    o = o || {};
    var W = 1920,
      H = 1080;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgb(40,70,110)");
    g.addColorStop(0.5, "rgb(220,170,140)");
    g.addColorStop(1, "rgb(250,225,200)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    var layers = [
      [0.48, "rgb(150,140,160)", 120, 1],
      [0.6, "rgb(95,100,120)", 160, 2],
      [0.74, "rgb(48,64,70)", 200, 3],
      [0.88, "rgb(22,42,34)", 240, 4],
    ];
    for (var l = 0; l < layers.length; l++) {
      var L = layers[l];
      x.fillStyle = L[1];
      x.beginPath();
      x.moveTo(0, H);
      for (var i = 0; i <= W; i += 8) {
        var y = H * L[0] - L[2] * (FX.fbm(i * 0.003 * L[3], l * 10, 4, 21 + l) - 0.3) * 2;
        x.lineTo(i, y);
      }
      x.lineTo(W, H);
      x.closePath();
      x.fill();
    }
    return c;
  }

  /* Démo : bivouac de nuit, feu au premier plan (étincelle). */
  function campfire() {
    var W = 1920,
      H = 1080;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgb(8,16,28)");
    g.addColorStop(0.7, "rgb(16,30,44)");
    g.addColorStop(1, "rgb(12,22,18)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    var rnd = FX.mulberry32(36);
    for (var s = 0; s < 700; s++) {
      x.globalAlpha = 0.15 + 0.7 * Math.pow(rnd(), 3);
      x.fillStyle = "rgb(250,248,245)";
      x.fillRect(rnd() * W, rnd() * H * 0.7, 1.3, 1.3);
    }
    x.globalAlpha = 1;
    x.fillStyle = "rgb(10,20,16)";
    x.beginPath();
    x.moveTo(0, H);
    for (var i = 0; i <= W; i += 10) x.lineTo(i, H * 0.72 - 260 * Math.pow(FX.fbm(i * 0.002, 3, 4, 5), 2));
    x.lineTo(W, H);
    x.fill();
    var fg = x.createRadialGradient(960, 940, 4, 960, 940, 340);
    fg.addColorStop(0, "rgba(255,200,120,0.95)");
    fg.addColorStop(0.15, "rgba(255,140,60,0.55)");
    fg.addColorStop(1, "rgba(255,120,40,0)");
    x.fillStyle = fg;
    x.fillRect(0, 500, W, 580);
    return c;
  }

  /* Démo : salon chaud vu à travers une vitre (traversée de vitre). */
  function room() {
    var W = 1920,
      H = 1080;
    var c = FX.canvas(W, H),
      x = c.getContext("2d");
    var g = x.createRadialGradient(1100, 420, 40, 960, 540, 1300);
    g.addColorStop(0, "rgb(255,214,160)");
    g.addColorStop(0.35, "rgb(170,110,70)");
    g.addColorStop(1, "rgb(40,30,28)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(60,40,32,0.8)";
    x.fillRect(200, 640, 900, 260); // canapé
    x.fillStyle = "rgba(255,230,190,0.9)";
    x.beginPath();
    x.arc(1320, 360, 40, 0, Math.PI * 2);
    x.fill(); // lampe
    return c;
  }

  /* Plaques partagées entre scènes : construites une seule fois par page (même graine = même plaque). */
  var memo = {};
  function shared(name, arg) {
    var key = name + ":" + JSON.stringify(arg == null ? null : arg);
    if (!memo[key]) memo[key] = FX.Plates[name](arg);
    return memo[key];
  }

  function haloLayer() {
    return FX.canvas(1920, 1080);
  }

  FX.Plates = { shared: shared, haloLayer: haloLayer, noiseCanvas: noiseCanvas, city: city, clouds: clouds, strato: strato, limb: limb, ridges: ridges, campfire: campfire, room: room };
})(typeof window !== "undefined" ? window : globalThis);
