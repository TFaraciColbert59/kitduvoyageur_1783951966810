/* LKDV trailer — lib/fx/traces.js
 * Les tracés d'aventures (P53–P54) : des milliers d'itinéraires GPS s'allument sur la Terre de nuit,
 * se détachent, convergent, se tressent et forment le vrai logo LKDV (assets/logo-mark.svg).
 *
 * Séquence commune aux deux plans, en images à 60 i/s : F = 0 … 223.
 *   P53 = F 0 … 103 (104 images), P54 = F 104 … 223 (120 images).
 *   NET_FRAME = 104 : première image où le logo est net (58,00 s du film, image 3480).
 * Les tracés partent des lumières réelles d'img39 (lib/fx/img39-lights.js). build() précalcule ; frame() est pure de F.
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Traces) return;

  var NET_FRAME = 104;
  var TOTAL_FRAMES = 224;

  /* Géométrie du logo, recopiée telle quelle de public/assets/logo-mark.svg (viewBox 0 0 32 32).
   * tests/logo-sync.mjs vérifie que ces chaînes sont identiques au fichier. */
  var LOGO = {
    viewBox: 32,
    strokeWidth: 1.6,
    mountains: "M2 24 L10 10 L14 16 L20 6 L30 24 Z",
    base: "M2 24 L30 24",
    sun: { cx: 24, cy: 9, r: 1.6 },
  };

  function parsePoly(d) {
    var nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    var pts = [];
    for (var i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (/Z\s*$/i.test(d)) pts.push([pts[0][0], pts[0][1]]);
    return pts;
  }

  /* Polyligne du contour (montagnes fermées ; la ligne de base coïncide avec le côté de fermeture). */
  var POLY = parsePoly(LOGO.mountains);
  var CUM = [0];
  for (var i = 1; i < POLY.length; i++) {
    var dx = POLY[i][0] - POLY[i - 1][0],
      dy = POLY[i][1] - POLY[i - 1][1];
    CUM.push(CUM[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  var PATH_LEN = CUM[CUM.length - 1];

  /* Point et normale à l'abscisse curviligne s (en unités du viewBox), avec bouclage. */
  function pathAt(s, out) {
    s = ((s % PATH_LEN) + PATH_LEN) % PATH_LEN;
    var k = 1;
    while (k < CUM.length - 1 && CUM[k] < s) k++;
    var a = POLY[k - 1],
      b = POLY[k];
    var L = CUM[k] - CUM[k - 1];
    var t = (s - CUM[k - 1]) / L;
    var tx = (b[0] - a[0]) / L,
      ty = (b[1] - a[1]) / L;
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = -ty;
    out[3] = tx;
    return out;
  }

  /* Placement du logo à l'écran : centre et échelle (px par unité de viewBox). */
  var PLACE = { cx: 960, cy: 540, ux: 16, uy: 15, scale: 21 };

  /* Poussée de la plaque img39 sur P53 (échelle autour du centre), fixe ensuite. Le recul de P54 est appliqué au dessin. */
  function pushFor(F) {
    var u = FX.clamp(F, 0, NET_FRAME - 1) / (NET_FRAME - 1);
    return 1 + 0.045 * FX.ease.outCubic(u);
  }

  /* Ancrage : chaque tracé part d'une lumière réelle d'img39 (FX.IMG39, positions écran de la plaque). */
  function build(opts) {
    opts = opts || {};
    var N = opts.count || 2200;
    var M = opts.points || 20;
    var seed = opts.seed || 5354;
    var rnd = FX.mulberry32(seed);
    var L = FX.IMG39.lights;
    var cum = new Float32Array(L.length),
      acc = 0;
    for (var a = 0; a < L.length; a++) {
      acc += L[a][2] * L[a][2];
      cum[a] = acc;
    }
    var geo = new Float32Array(N * M * 2);
    var P = {
      kind: new Uint8Array(N), s0: new Float32Array(N), len: new Float32Array(N), d: new Float32Array(N),
      phase: new Float32Array(N), freq: new Float32Array(N), ign: new Float32Array(N), conv: new Float32Array(N),
      dur: new Float32Array(N), lag: new Float32Array(N), swirl: new Float32Array(N), bright: new Float32Array(N),
    };
    for (var n = 0; n < N; n++) {
      var pick = rnd() * acc,
        lo = 0,
        hi = L.length - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (cum[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      var x = L[lo][0],
        y = L[lo][1];
      // Itinéraire GPS : marche à cap lissé, lacets occasionnels (pas de ligne droite), 2,5 à 6 px par pas.
      var h = rnd() * Math.PI * 2,
        step = 2.5 + rnd() * 3.5,
        wig = 0.35 + rnd() * 0.9;
      for (var m = 0; m < M; m++) {
        geo[(n * M + m) * 2] = x;
        geo[(n * M + m) * 2 + 1] = y;
        h += (FX.noise2(n * 1.7, m * 0.45, seed) - 0.5) * wig * 2;
        if (rnd() < 0.08) h += Math.PI * (0.55 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1);
        x += Math.cos(h) * step;
        y += Math.sin(h) * step * 0.7; // aplati par l'obliquité de la vue
      }
      if (rnd() < 0.07) {
        P.kind[n] = 1;
        P.d[n] = 0.25 + rnd() * 1.15;
        P.s0[n] = rnd() * Math.PI * 2;
        P.len[n] = (0.6 + rnd() * 1.4) * Math.PI;
      } else {
        P.kind[n] = 0;
        P.len[n] = 7 + rnd() * 12;
        P.s0[n] = rnd() * PATH_LEN;
        P.d[n] = (rnd() * 2 - 1) * 0.7;
      }
      P.phase[n] = rnd();
      P.freq[n] = 0.8 + rnd() * 1.6;
      P.ign[n] = Math.pow(rnd(), 1.3) * 36; // allumage F 0–36
      P.conv[n] = 34 + rnd() * 36 + P.ign[n] * 0.3; // départ du glissement vers la forme
      P.lag[n] = 3 + rnd() * 5;
      P.dur[n] = Math.max(10, Math.min(16 + rnd() * 12, 98 - P.conv[n] - P.lag[n]));
      P.swirl[n] = (rnd() < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.35);
      P.bright[n] = 0.6 + rnd() * 0.4;
    }
    return { N: N, M: M, geo: geo, P: P };
  }

  /* Rassemblement final : jusqu'à F 88 la forme cible est tournée, élargie et tressée (illisible) ;
   * elle se referme sur le vrai dessin pendant les 16 dernières images de P53, et n'est exacte qu'à NET_FRAME. */
  function gather(F) {
    if (F >= NET_FRAME) return 1;
    return FX.ease.inOutCubic(FX.ramp(88, NET_FRAME - 1, F)) * 0.94;
  }
  function braidAmp(F) {
    if (F >= NET_FRAME) return 0;
    return FX.lerp(2.4, 0.4, gather(F) / 0.94);
  }
  function softBlur(F) {
    if (F >= NET_FRAME) return 0;
    if (F < 88) return 0.4 + 0.8 * FX.smooth(26, 60, F);
    return 1.2 + 2.8 * FX.ramp(88, 100, F);
  }

  /* Positions à l'image F (coordonnées écran avant recul). */
  function frame(sim, F, out) {
    var N = sim.N, M = sim.M, P = sim.P, geo = sim.geo;
    if (!out) out = { pos: new Float32Array(N * M * 2), e: new Float32Array(N), rev: new Float32Array(N) };
    var pos = out.pos, pa = [0, 0, 0, 0];
    var s = PLACE.scale, ox = PLACE.cx - PLACE.ux * s, oy = PLACE.cy - PLACE.uy * s;
    var amp = braidAmp(F), g = gather(F);
    var th = 0.9 * (1 - g), sc = 1 + 0.45 * (1 - g), ct = Math.cos(th), st = Math.sin(th);
    var k = pushFor(F), W2 = 960, H2 = 540;
    var ease = FX.ease.inOutCubic;
    for (var n = 0; n < N; n++) {
      out.rev[n] = FX.ramp(P.ign[n], P.ign[n] + 14, F);
      var c0 = P.conv[n], dur = P.dur[n], lag = P.lag[n];
      out.e[n] = ease(FX.ramp(c0, c0 + dur + lag, F));
      for (var m = 0; m < M; m++) {
        var u = m / (M - 1), gi = (n * M + m) * 2;
        var gx = W2 + (geo[gi] - W2) * k, gy = H2 + (geo[gi + 1] - H2) * k;
        var tx, ty;
        if (P.kind[n] === 1) {
          var rr = P.d[n] * (0.35 + 0.65 * u) + amp * 0.5 * Math.sin(6.283 * (P.phase[n] + u * P.freq[n]) + F * 0.09);
          var ang = P.s0[n] + u * P.len[n];
          tx = ox + (LOGO.sun.cx + Math.cos(ang) * rr) * s;
          ty = oy + (LOGO.sun.cy + Math.sin(ang) * rr) * s;
        } else {
          pathAt(P.s0[n] + P.len[n] * u, pa);
          var off = P.d[n] + amp * Math.sin(6.283 * (P.phase[n] + u * P.freq[n]) + F * 0.11);
          tx = ox + (pa[0] + pa[2] * off) * s;
          ty = oy + (pa[1] + pa[3] * off) * s;
        }
        // Forme cible tournée et élargie autour du centre du logo tant qu'elle n'est pas rassemblée.
        var rx = tx - PLACE.cx, ry = ty - PLACE.cy;
        tx = PLACE.cx + (rx * ct - ry * st) * sc;
        ty = PLACE.cy + (rx * st + ry * ct) * sc;
        var e = ease(FX.ramp(c0 + lag * u, c0 + lag * u + dur, F));
        var vx = tx - gx, vy = ty - gy;
        var sw = Math.sin(Math.PI * e) * P.swirl[n];
        pos[gi] = gx + vx * e - vy * sw * 0.35;
        pos[gi + 1] = gy + vy * e + vx * sw * 0.35;
      }
    }
    return out;
  }

  /* Dessine le vrai logo (chemins SVG recopiés) dans un repère écran ; k = recul. */
  function drawLogo(ctx, color, alpha, k, lineScale) {
    var s = PLACE.scale * (k || 1);
    var ox = PLACE.cx + (PLACE.cx - PLACE.ux * PLACE.scale - PLACE.cx) * (k || 1);
    var oy = PLACE.cy + (PLACE.cy - PLACE.uy * PLACE.scale - PLACE.cy) * (k || 1);
    ctx.save();
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = LOGO.strokeWidth * (lineScale || 1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (typeof Path2D !== "undefined") {
      ctx.stroke(new Path2D(LOGO.mountains));
      ctx.stroke(new Path2D(LOGO.base));
    }
    ctx.beginPath();
    ctx.arc(LOGO.sun.cx, LOGO.sun.cy, LOGO.sun.r * (lineScale ? Math.max(1, lineScale * 0.8) : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  FX.Traces = {
    NET_FRAME: NET_FRAME,
    TOTAL_FRAMES: TOTAL_FRAMES,
    LOGO: LOGO,
    PLACE: PLACE,
    PATH_LEN: PATH_LEN,
    pathAt: pathAt,
    build: build,
    frame: frame,
    pushFor: pushFor,
    gather: gather,
    braidAmp: braidAmp,
    softBlur: softBlur,
    drawLogo: drawLogo,
  };
})(typeof window !== "undefined" ? window : globalThis);
