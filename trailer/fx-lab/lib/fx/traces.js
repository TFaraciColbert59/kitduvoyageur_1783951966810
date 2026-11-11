/* LKDV trailer — lib/fx/traces.js
 * Les tracés d'aventures (P53–P54) : des milliers d'itinéraires GPS s'allument sur la Terre de nuit,
 * se détachent, convergent, se tressent et forment le vrai logo LKDV (assets/logo-mark.svg).
 *
 * Séquence commune aux deux plans, en images à 60 i/s : F = 0 … 223.
 *   P53 = F 0 … 103 (104 images), P54 = F 104 … 223 (120 images).
 *   NET_FRAME = 104 : première image où le logo est net (58,00 s du film, image 3480).
 * La simulation est précalculée par build() ; frame() est une fonction pure de F (testable sous Node).
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

  function build(opts) {
    opts = opts || {};
    var N = opts.count || 2600;
    var M = opts.points || 20;
    var seed = opts.seed || 5354;
    var rnd = FX.mulberry32(seed);
    var anchors = FX.Earth.anchors();
    var wsum = 0;
    for (var a = 0; a < anchors.length; a++) wsum += anchors[a][2];
    var geo = new Float32Array(N * M * 2);
    var P = {
      kind: new Uint8Array(N),
      s0: new Float32Array(N),
      len: new Float32Array(N),
      d: new Float32Array(N),
      phase: new Float32Array(N),
      freq: new Float32Array(N),
      ign: new Float32Array(N),
      conv: new Float32Array(N),
      dur: new Float32Array(N),
      lag: new Float32Array(N),
      swirl: new Float32Array(N),
      bright: new Float32Array(N),
    };
    for (var n = 0; n < N; n++) {
      // Ancrage pondéré : villes et massifs.
      var pick = rnd() * wsum,
        A = anchors[0];
      for (var q = 0; q < anchors.length; q++) {
        pick -= anchors[q][2];
        if (pick <= 0) {
          A = anchors[q];
          break;
        }
      }
      var g1 = Math.sqrt(-2 * Math.log(1 - rnd() * 0.999)),
        g2 = rnd() * Math.PI * 2;
      var lat = A[0] + g1 * Math.sin(g2) * A[3] * 0.6;
      var lon = A[1] + (g1 * Math.cos(g2) * A[3]) / Math.cos((A[0] * Math.PI) / 180);
      // Itinéraire : marche à cap lissé, lacets occasionnels (pas de ligne droite).
      var h = rnd() * Math.PI * 2,
        step = 0.045 + rnd() * 0.08,
        wig = 0.35 + rnd() * 0.9;
      for (var m = 0; m < M; m++) {
        geo[(n * M + m) * 2] = lat;
        geo[(n * M + m) * 2 + 1] = lon;
        h += (FX.noise2(n * 1.7, m * 0.45, seed) - 0.5) * wig * 2;
        if (rnd() < 0.08) h += Math.PI * (0.55 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1);
        lat += Math.sin(h) * step;
        lon += (Math.cos(h) * step) / Math.cos((lat * Math.PI) / 180);
      }
      // Cible sur le logo.
      if (rnd() < 0.07) {
        P.kind[n] = 1; // point-soleil
        P.d[n] = 0.25 + rnd() * 1.15; // rayon final
        P.s0[n] = rnd() * Math.PI * 2;
        P.len[n] = (0.6 + rnd() * 1.4) * Math.PI;
      } else {
        P.kind[n] = 0;
        P.len[n] = 7 + rnd() * 12;
        P.s0[n] = rnd() * PATH_LEN;
        P.d[n] = (rnd() * 2 - 1) * 0.72;
      }
      P.phase[n] = rnd();
      P.freq[n] = 0.8 + rnd() * 1.6;
      P.ign[n] = Math.pow(rnd(), 1.4) * 40; // allumage F 0–40
      P.conv[n] = 26 + rnd() * 30 + P.ign[n] * 0.25; // départ de la convergence
      P.lag[n] = 4 + rnd() * 8;
      P.dur[n] = Math.max(18, 100 - P.conv[n] - P.lag[n] - rnd() * 6); // arrivée au plus tard F 100
      P.swirl[n] = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.45);
      P.bright[n] = 0.6 + rnd() * 0.4;
    }
    return { N: N, M: M, geo: geo, P: P };
  }

  /* Amplitude du tressage (unités de viewBox). Jamais nulle avant NET_FRAME, nulle à partir de NET_FRAME. */
  function braidAmp(F) {
    if (F >= NET_FRAME) return 0;
    var u = 1 - FX.ramp(30, NET_FRAME - 1, F);
    return 0.32 + 2.6 * Math.pow(u, 1.6);
  }
  /* Flou d'approche (px) : le logo reste doux jusqu'à l'image 103 incluse. */
  function softBlur(F) {
    if (F >= NET_FRAME) return 0;
    var rise = FX.smooth(26, 60, F),
      fall = 1 - FX.ramp(72, NET_FRAME - 1, F);
    return 0.5 + 1.1 * rise + 3.4 * rise * fall;
  }
  /* Calcule toutes les positions à l'image F.
   * view : vue Terre (FX.Earth.viewAt) ; out : { pos Float32Array N*M*2, e Float32Array N (convergence), rev Float32Array N }.
   * Coordonnées écran avant recul (le recul est appliqué au dessin, pas à la simulation). */
  function frame(sim, F, view, out) {
    var N = sim.N,
      M = sim.M,
      P = sim.P,
      geo = sim.geo;
    if (!out) out = { pos: new Float32Array(N * M * 2), e: new Float32Array(N), rev: new Float32Array(N) };
    var pos = out.pos;
    var tmp = [0, 0, 0],
      pa = [0, 0, 0, 0];
    var s = PLACE.scale,
      ox = PLACE.cx - PLACE.ux * s,
      oy = PLACE.cy - PLACE.uy * s;
    var amp = braidAmp(F);
    var ease = FX.ease.inOutCubic;
    for (var n = 0; n < N; n++) {
      var rev = FX.ramp(P.ign[n], P.ign[n] + 16, F);
      out.rev[n] = rev;
      var conv0 = P.conv[n],
        dur = P.dur[n],
        lag = P.lag[n];
      out.e[n] = ease(FX.ramp(conv0, conv0 + dur + lag, F));
      for (var m = 0; m < M; m++) {
        var u = m / (M - 1);
        var gi = (n * M + m) * 2;
        FX.Earth.project(view, geo[gi], geo[gi + 1], tmp);
        var gx = tmp[0],
          gy = tmp[1];
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
        var e = ease(FX.ramp(conv0 + lag * u, conv0 + lag * u + dur, F));
        var vx = tx - gx,
          vy = ty - gy;
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
    braidAmp: braidAmp,
    softBlur: softBlur,
    drawLogo: drawLogo,
  };
})(typeof window !== "undefined" ? window : globalThis);
