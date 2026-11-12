/* LKDV trailer — lib/fx/earth.js
 * La Terre de nuit vue d'orbite (plaque de remplacement d'img39), entièrement en code.
 * Projection orthographique d'un globe dont le limbe passe en haut du cadre.
 * Contours : FX.EARTH_DATA (lib/fx/earth-data.js, Natural Earth 1:110m, domaine public).
 * Dépend de core.js. La partie projection est pure (testable sous Node) ; build/draw demandent un document.
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Earth) return;
  var D2R = Math.PI / 180;

  /* Vue : { lat0, lon0, R, cx, cy } — (lat0, lon0) est le point qui fait face à la caméra
   * (centre du disque, hors cadre en bas), R le rayon en px, (cx, cy) le centre du disque à l'écran. */
  function project(view, lat, lon, out) {
    var la = lat * D2R,
      dl = (lon - view.lon0) * D2R,
      l0 = view.lat0 * D2R;
    var cl = Math.cos(la);
    var x = cl * Math.sin(dl);
    var y = Math.cos(l0) * Math.sin(la) - Math.sin(l0) * cl * Math.cos(dl);
    var z = Math.sin(l0) * Math.sin(la) + Math.cos(l0) * cl * Math.cos(dl);
    out[0] = view.cx + view.R * x;
    out[1] = view.cy - view.R * y;
    out[2] = z;
    return out;
  }

  /* Vue par défaut du film : limbe vers y = 150, Europe au centre, Afrique du Nord en bas. */
  function viewAt(p) {
    p = p || {};
    var R = p.R || 2200;
    return {
      lat0: p.lat0 == null ? -8 : p.lat0,
      lon0: p.lon0 == null ? 10 : p.lon0,
      R: R,
      cx: p.cx == null ? 960 : p.cx,
      cy: p.cy == null ? (p.limbY == null ? 150 : p.limbY) + R : p.cy,
    };
  }

  /* Ancrages « aventure » : villes + massifs (lat, lon, poids, étalement en degrés). */
  function anchors() {
    var a = [];
    var data = FX.EARTH_DATA;
    for (var i = 0; i < data.cities.length; i++) {
      var c = data.cities[i];
      a.push([c[0], c[1], c[2], 1.6]);
    }
    var MOUNTAINS = [
      [46.5, 11.9, 14, 0.9], // Dolomites
      [46.0, 7.5, 12, 1.4], // Alpes occidentales
      [47.0, 10.5, 10, 1.4], // Alpes orientales
      [42.7, 0.5, 8, 1.6], // Pyrénées
      [31.2, -7.5, 6, 1.8], // Haut Atlas
      [46.5, 25.0, 6, 2.2], // Carpates
      [61.5, 8.5, 6, 2.6], // Norvège
      [42.2, 9.0, 5, 0.6], // GR20, Corse
      [40.8, 14.6, 3, 1.0], // Apennins sud
      [42.6, 23.4, 4, 1.4], // Balkans
      [64.0, -19.0, 4, 1.8], // Islande
      [56.8, -5.0, 4, 1.5], // Highlands
      [37.0, -3.4, 3, 1.0], // Sierra Nevada
      [40.1, 22.3, 3, 1.0], // Olympe
      [43.2, 42.5, 4, 2.0], // Caucase
    ];
    return a.concat(MOUNTAINS);
  }

  /* Construction : lumières des villes, étoiles. Demande un document (canevas de masque terrestre). */
  function build(opts) {
    opts = opts || {};
    var seed = opts.seed || 5301;
    var rnd = FX.mulberry32(seed);
    var data = FX.EARTH_DATA;
    var box = data.box;
    // Masque terre en équirectangulaire, 0,2° par pixel.
    var res = 5;
    var mw = (box.lon1 - box.lon0) * res,
      mh = (box.lat1 - box.lat0) * res;
    var mc = FX.canvas(mw, mh),
      mx = mc.getContext("2d");
    mx.fillStyle = "#fff";
    for (var r = 0; r < data.rings.length; r++) {
      var ring = data.rings[r];
      mx.beginPath();
      for (var k = 0; k < ring.length; k++) {
        var px = (ring[k][0] - box.lon0) * res,
          py = (box.lat1 - ring[k][1]) * res;
        if (k === 0) mx.moveTo(px, py);
        else mx.lineTo(px, py);
      }
      mx.closePath();
      mx.fill();
    }
    var mask = mx.getImageData(0, 0, mw, mh).data;
    function isLand(lat, lon) {
      var px = Math.floor((lon - box.lon0) * res),
        py = Math.floor((box.lat1 - lat) * res);
      if (px < 0 || py < 0 || px >= mw || py >= mh) return false;
      return mask[(py * mw + px) * 4] > 127;
    }
    function density(lat, lon) {
      // Densité d'éclairage : forte en Europe de l'Ouest, faible dans les déserts, les Alpes et le Grand Nord.
      var d = 0.35 + 0.65 * FX.fbm(lon * 0.35, lat * 0.35, 4, seed + 7);
      if (lat < 30 && !(lon > 29.5 && lon < 32.5)) d *= 0.12; // Sahara, sauf le Nil
      if (lat < 34 && lat >= 30 && lon > 0 && lon < 29) d *= 0.35;
      if (lat > 45.6 && lat < 47.3 && lon > 6.5 && lon < 13.5) d *= 0.28; // Alpes sombres
      if (lat > 58) d *= 0.35;
      if (lon > 45) d *= 0.4;
      return d;
    }
    var lights = [];
    // Villes : amas gaussiens.
    for (var i = 0; i < data.cities.length; i++) {
      var c = data.cities[i];
      var n = Math.round(16 + c[2] * c[2] * 4.5);
      for (var j = 0; j < n; j++) {
        var rr = Math.sqrt(-2 * Math.log(1 - rnd() * 0.999)) * (0.07 + 0.045 * c[2]);
        var th = rnd() * Math.PI * 2;
        var lat = c[0] + rr * Math.sin(th) * 0.75,
          lon = c[1] + (rr * Math.cos(th)) / Math.cos(c[0] * D2R);
        if (!isLand(lat, lon) && rnd() < 0.85) continue;
        lights.push(lat, lon, 0.45 + 0.55 * Math.exp(-rr * 6) * (0.4 + c[2] / 10));
      }
    }
    // Bourgs et routes : semis sur les terres selon la densité.
    var tries = opts.towns || 90000;
    for (var t = 0; t < tries; t++) {
      var la2 = box.lat0 + 15 + rnd() * (box.lat1 - box.lat0 - 18);
      var lo2 = box.lon0 + rnd() * (box.lon1 - box.lon0);
      if (!isLand(la2, lo2)) continue;
      var dd = density(la2, lo2);
      if (rnd() > dd * dd * 0.9) continue;
      lights.push(la2, lo2, 0.12 + 0.35 * rnd() * dd);
    }
    // Liseré côtier lumineux en Méditerranée : points de terre proches de la mer.
    for (var t2 = 0; t2 < 40000; t2++) {
      var la3 = 30 + rnd() * 16,
        lo3 = -9 + rnd() * 45;
      if (!isLand(la3, lo3)) continue;
      var e = 0.12;
      if (isLand(la3 + e, lo3) && isLand(la3 - e, lo3) && isLand(la3, lo3 + e) && isLand(la3, lo3 - e)) continue;
      if (rnd() > 0.55) continue;
      lights.push(la3, lo3, 0.25 + 0.4 * rnd());
    }
    var L = new Float32Array(lights);
    var stars = [];
    var srnd = FX.mulberry32(seed + 99);
    for (var s = 0; s < 260; s++) stars.push(srnd() * 1920, srnd() * 1080, 0.15 + 0.6 * Math.pow(srnd(), 3), srnd() < 0.15 ? 1.6 : 1);
    // Nuages éclairés par la lune : texture de bruit en lat/lon (basse résolution).
    var cw = 360,
      ch = 220;
    var cc = FX.canvas(cw, ch),
      cx2 = cc.getContext("2d");
    var img = cx2.createImageData(cw, ch);
    for (var y = 0; y < ch; y++)
      for (var x = 0; x < cw; x++) {
        var v = FX.fbm(x * 0.03, y * 0.05, 5, seed + 31);
        v = FX.smooth(0.52, 0.78, v);
        var o = (y * cw + x) * 4;
        img.data[o] = 120;
        img.data[o + 1] = 140;
        img.data[o + 2] = 165;
        img.data[o + 3] = Math.round(v * 255);
      }
    cx2.putImageData(img, 0, 0);
    var glow = FX.canvas(480, 270);
    return { lights: L, stars: stars, clouds: cc, glow: glow, gctx: glow.getContext("2d"), isLand: isLand };
  }

  /* Dessine la Terre de nuit. p : { dim (0–1, 1 = plein), lightGain, time (s, scintillement) } */
  function draw(ctx, E, view, p) {
    p = p || {};
    var dim = p.dim == null ? 1 : p.dim;
    var W = 1920,
      H = 1080;
    var ink = FX.RGB.ink;
    // Espace : encre verte, légèrement plus profonde en haut.
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgb(8,22,17)");
    g.addColorStop(1, FX.rgba(ink, 1));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // Étoiles au-dessus du limbe uniquement.
    ctx.fillStyle = FX.rgba(FX.RGB.stone, 1);
    for (var s = 0; s < E.stars.length; s += 4) {
      var sx = E.stars[s],
        sy = E.stars[s + 1];
      var dx = sx - view.cx,
        dy = sy - view.cy;
      if (dx * dx + dy * dy < (view.R + 30) * (view.R + 30)) continue;
      ctx.globalAlpha = E.stars[s + 2] * dim;
      ctx.fillRect(sx, sy, E.stars[s + 3], E.stars[s + 3]);
    }
    ctx.globalAlpha = 1;
    // Disque terrestre : océan nocturne bleu-vert très sombre.
    ctx.save();
    ctx.beginPath();
    ctx.arc(view.cx, view.cy, view.R, 0, Math.PI * 2);
    ctx.clip();
    var og = ctx.createRadialGradient(view.cx, view.cy, view.R * 0.4, view.cx, view.cy, view.R);
    og.addColorStop(0, "rgb(10,26,30)");
    og.addColorStop(0.92, "rgb(9,24,26)");
    og.addColorStop(1, "rgb(16,40,42)");
    ctx.fillStyle = og;
    ctx.fillRect(-W, -H, 3 * W, 3 * H);
    // Terres : à peine plus claires (clair de lune).
    var tmp = [0, 0, 0];
    var data = FX.EARTH_DATA;
    ctx.fillStyle = "rgba(20,33,27," + (0.9 * dim).toFixed(3) + ")";
    ctx.beginPath();
    for (var r = 0; r < data.rings.length; r++) {
      var ring = data.rings[r],
        started = false;
      for (var k = 0; k < ring.length; k++) {
        project(view, ring[k][1], ring[k][0], tmp);
        if (tmp[2] < -0.05) continue;
        if (!started) {
          ctx.moveTo(tmp[0], tmp[1]);
          started = true;
        } else ctx.lineTo(tmp[0], tmp[1]);
      }
      if (started) ctx.closePath();
    }
    ctx.fill();
    // Nuages lunaires : texture lat/lon projetée par bandes (approximation : on étire la texture sur la zone visible).
    ctx.globalAlpha = 0.16 * dim;
    var c0 = [0, 0, 0],
      c1 = [0, 0, 0];
    project(view, 72, view.lon0 - 40, c0);
    project(view, 18, view.lon0 + 40, c1);
    ctx.drawImage(E.clouds, -200 + (view.lon0 - 10) * -18, c0[1] - 60, W + 400, c1[1] - c0[1] + 300);
    ctx.globalAlpha = 1;
    // Lumières des villes : points dorés, composition additive, puis halo basse résolution.
    var L = E.lights,
      gain = (p.lightGain == null ? 1 : p.lightGain) * dim;
    var gx = E.gctx;
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, 480, 270);
    gx.globalCompositeOperation = "lighter";
    ctx.globalCompositeOperation = "lighter";
    var buckets = [[], [], []];
    for (var i = 0; i < L.length; i += 3) {
      project(view, L[i], L[i + 1], tmp);
      if (tmp[2] <= 0.02 || tmp[0] < -4 || tmp[0] > W + 4 || tmp[1] < -4 || tmp[1] > H + 4) continue;
      var b = L[i + 2] * (0.35 + 0.65 * FX.smooth(0.02, 0.5, tmp[2]));
      var bi = b > 0.6 ? 2 : b > 0.3 ? 1 : 0;
      buckets[bi].push(tmp[0], tmp[1]);
    }
    var cols = [
      [200, 140, 70, 0.32],
      [235, 175, 95, 0.55],
      [255, 214, 150, 0.85],
    ];
    for (var q = 0; q < 3; q++) {
      var B = buckets[q],
        col = cols[q];
      ctx.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (col[3] * gain).toFixed(3) + ")";
      gx.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (col[3] * gain * 0.16).toFixed(3) + ")";
      var sz = q === 2 ? 2 : 1.4;
      for (var m = 0; m < B.length; m += 2) {
        ctx.fillRect(B[m], B[m + 1], sz, sz);
        gx.fillRect(B[m] * 0.25 - 0.5, B[m + 1] * 0.25 - 0.5, 1, 1);
      }
    }
    gx.globalCompositeOperation = "source-over";
    ctx.filter = "blur(3px)";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(E.glow, 0, 0, W, H);
    ctx.filter = "blur(12px)";
    ctx.globalAlpha = 0.6;
    ctx.drawImage(E.glow, 0, 0, W, H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    // Atmosphère : liseré fin bleu-vert sur le limbe et halo extérieur.
    var R = view.R;
    var ag = ctx.createRadialGradient(view.cx, view.cy, R - 26, view.cx, view.cy, R + 46);
    var a = dim;
    ag.addColorStop(0, "rgba(40,110,120,0)");
    ag.addColorStop(0.3, "rgba(60,150,150," + (0.22 * a).toFixed(3) + ")");
    ag.addColorStop(0.36, "rgba(150,215,205," + (0.55 * a).toFixed(3) + ")");
    ag.addColorStop(0.42, "rgba(70,150,150," + (0.3 * a).toFixed(3) + ")");
    ag.addColorStop(0.7, "rgba(30,90,95," + (0.1 * a).toFixed(3) + ")");
    ag.addColorStop(1, "rgba(20,60,60,0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(view.cx, view.cy, R + 46, 0, Math.PI * 2);
    ctx.arc(view.cx, view.cy, R - 26, 0, Math.PI * 2, true);
    ctx.fill();
  }

  FX.Earth = { project: project, viewAt: viewAt, anchors: anchors, build: build, draw: draw };
})(typeof window !== "undefined" ? window : globalThis);
