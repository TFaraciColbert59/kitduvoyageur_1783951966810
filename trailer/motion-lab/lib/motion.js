/* LKDV trailer — motion-lab/lib/motion.js
 * Un seul système graphique pour les propositions de motion design : le tracé (trait Stone 2,5 px, arrondi,
 * halo léger, ombre très douce pour les fonds clairs), le point, l'anneau, une donnée, le cadre large, l'iris,
 * les courbes de niveau. Tout est dessiné en canevas 2D à 1920×1080, image par image (aucune horloge).
 */
(function (root) {
  "use strict";
  var W = 1920,
    H = 1080;
  var STONE = [250, 248, 245]; // #FAF8F5
  var INK = [6, 18, 12]; // forest-950 #06120C, pour l'ombre portée du trait
  var SAGE = [91, 127, 85]; // #5B7F55

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function clamp(x, a, b) {
    a = a === undefined ? 0 : a;
    b = b === undefined ? 1 : b;
    return Math.min(b, Math.max(a, x));
  }
  function ramp(a, b, x) {
    return clamp((x - a) / (b - a));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  /* Amortis longs uniquement : aucune courbe ne dépasse 1 (rien ne rebondit). */
  var ease = {
    inOut: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    inOutQuint: function (t) {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    },
    out: function (t) {
      return 1 - Math.pow(1 - t, 3);
    },
    outQuint: function (t) {
      return 1 - Math.pow(1 - t, 5);
    },
    outExpo: function (t) {
      return t >= 1 ? 1 : 1 - Math.pow(2, -9 * t);
    },
    inOutSine: function (t) {
      return -(Math.cos(Math.PI * t) - 1) / 2;
    },
  };

  /* Homographie 3×3 (ligne par ligne) appliquée à un point. */
  function applyH(Hm, p) {
    if (!Hm) return [p[0], p[1]];
    var x = p[0],
      y = p[1];
    var w = Hm[6] * x + Hm[7] * y + Hm[8];
    return [(Hm[0] * x + Hm[1] * y + Hm[2]) / w, (Hm[3] * x + Hm[4] * y + Hm[5]) / w];
  }

  /* Catmull-Rom centripète échantillonnée finement, avec longueurs cumulées. */
  function spline(pts, step) {
    step = step || 2;
    if (pts.length < 2) return { p: pts.slice(), s: [0], L: 0 };
    var P = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    P[0] = [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
    var n = pts.length;
    P[P.length - 1] = [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]];
    var out = [];
    function tj(ti, a, b) {
      return ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, 0.5);
    }
    for (var i = 1; i < P.length - 2; i++) {
      var p0 = P[i - 1],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[i + 2];
      var t0 = 0,
        t1 = tj(t0, p0, p1),
        t2 = tj(t1, p1, p2),
        t3 = tj(t2, p2, p3);
      var segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var m = Math.max(2, Math.ceil(segLen / step));
      for (var k = 0; k < m; k++) {
        var t = t1 + ((t2 - t1) * k) / m;
        var A1 = lerp2(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0));
        var A2 = lerp2(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
        var A3 = lerp2(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2));
        var B1 = lerp2(A1, A2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0));
        var B2 = lerp2(A2, A3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1));
        out.push(lerp2(B1, B2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)));
      }
    }
    out.push(pts[n - 1]);
    var s = [0];
    for (var j = 1; j < out.length; j++) s.push(s[j - 1] + Math.hypot(out[j][0] - out[j - 1][0], out[j][1] - out[j - 1][1]));
    return { p: out, s: s, L: s[s.length - 1] };
  }
  function lerp2(a, b, wa, wb) {
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb];
  }
  /* Point à l'abscisse curviligne u (0…1). */
  function at(sp, u) {
    var target = clamp(u) * sp.L;
    var i = 1;
    while (i < sp.s.length - 1 && sp.s[i] < target) i++;
    var a = sp.p[i - 1],
      b = sp.p[i];
    var seg = sp.s[i] - sp.s[i - 1] || 1;
    var t = (target - sp.s[i - 1]) / seg;
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  }
  /* Morceau de courbe entre u0 et u1 (« trim path »). */
  function trim(sp, u0, u1) {
    u0 = clamp(u0);
    u1 = clamp(u1);
    if (u1 <= u0) return [];
    var out = [at(sp, u0)];
    var s0 = u0 * sp.L,
      s1 = u1 * sp.L;
    for (var i = 0; i < sp.p.length; i++) if (sp.s[i] > s0 && sp.s[i] < s1) out.push(sp.p[i]);
    out.push(at(sp, u1));
    return out;
  }

  function canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w || W;
    c.height = h || H;
    return c;
  }

  /* Calque lumineux : on dessine en Stone opaque sur un calque, puis on le pose sur l'image en trois passes
   * (ombre encre très douce pour les fonds clairs, halo Stone flou, trait net). */
  var layer = null,
    tint = null;
  function glow(ctx, drawFn, o) {
    o = o || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.001) return;
    layer = layer || canvas();
    tint = tint || canvas();
    var l = layer.getContext("2d");
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, W, H);
    l.globalAlpha = 1;
    l.strokeStyle = rgba(STONE, 1);
    l.fillStyle = rgba(STONE, 1);
    l.lineCap = "round";
    l.lineJoin = "round";
    drawFn(l);
    ctx.save();
    var shadow = o.shadow === undefined ? 0.32 : o.shadow;
    if (shadow > 0) {
      var t = tint.getContext("2d");
      t.globalCompositeOperation = "source-over";
      t.clearRect(0, 0, W, H);
      t.drawImage(layer, 0, 0);
      t.globalCompositeOperation = "source-in";
      t.fillStyle = rgba(INK, 1);
      t.fillRect(0, 0, W, H);
      t.globalCompositeOperation = "source-over";
      ctx.globalAlpha = shadow * alpha;
      ctx.filter = "blur(" + (o.shadowBlur || 3) + "px)";
      ctx.drawImage(tint, 0, o.shadowDy === undefined ? 1 : o.shadowDy);
    }
    var halo = o.halo === undefined ? 0.55 : o.halo;
    if (halo > 0) {
      ctx.globalAlpha = halo * alpha;
      ctx.filter = "blur(" + (o.haloBlur || 7) + "px)";
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(layer, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.filter = "none";
    ctx.globalAlpha = (o.core === undefined ? 1 : o.core) * alpha;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  function polyline(c, pts) {
    if (pts.length < 2) return;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
  }

  /* Le tracé : courbe (points écran), dessinée de u0 à u1, avec une tête (point) facultative.
   * fade : longueur (px) de la queue qui s'estompe vers son début (dégradé le long du trait). */
  function trace(ctx, sp, u0, u1, o) {
    o = o || {};
    var width = o.width || 2.5;
    var pts = trim(sp, u0, u1);
    if (pts.length < 2) return;
    glow(
      ctx,
      function (c) {
        c.lineWidth = width;
        var fade = o.fade || 0;
        if (fade > 0) {
          // queue dégradée : segments courts, alpha croissant, posés en « max » (pas de bosses aux jonctions)
          var len = 0;
          var lens = [0];
          for (var i = 1; i < pts.length; i++) lens.push((len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
          var total = len;
          var cut = 0;
          while (cut < pts.length - 1 && lens[cut] < fade) cut++;
          polyline(c, pts.slice(cut));
          for (var k = 0; k < cut; k++) {
            var a = Math.pow(clamp(lens[k + 1] / fade), 1.6);
            c.globalAlpha = a;
            c.globalCompositeOperation = "lighten";
            polyline(c, [pts[k], pts[k + 1]]);
          }
          c.globalAlpha = 1;
          c.globalCompositeOperation = "source-over";
          if (total < 1) return;
        } else polyline(c, pts);
        if (o.head) {
          var hp = pts[pts.length - 1];
          c.beginPath();
          c.arc(hp[0], hp[1], o.headR || 3.6, 0, Math.PI * 2);
          c.fill();
        }
      },
      o
    );
  }

  /* L'anneau qui pulse une fois autour d'un sujet minuscule (k : 0 → 1 sur la durée du pulse). */
  function ring(ctx, p, k, o) {
    o = o || {};
    if (k <= 0 || k >= 1) return;
    var r0 = o.r0 || 9,
      r1 = o.r1 || 30;
    var r = lerp(r0, r1, ease.outQuint(k));
    var a = Math.sin(Math.PI * Math.min(1, k * 1.15)) * (o.alpha === undefined ? 1 : o.alpha);
    a = clamp(a);
    glow(
      ctx,
      function (c) {
        c.lineWidth = o.width || 1.6;
        c.beginPath();
        c.arc(p[0], p[1], r, 0, Math.PI * 2);
        c.stroke();
      },
      { alpha: a, halo: 0.45, shadow: 0.28 }
    );
  }

  function dot(ctx, p, r, alpha) {
    glow(
      ctx,
      function (c) {
        c.beginPath();
        c.arc(p[0], p[1], r, 0, Math.PI * 2);
        c.fill();
      },
      { alpha: alpha, halo: 0.7, haloBlur: 6 }
    );
  }

  /* La donnée juste : libellé de l'app (capitales espacées) + valeur en mono, accrochée par un trait de rappel. */
  function datum(ctx, o) {
    // o : anchor [x,y] (sujet), at [x,y] (coin du bloc), label, value, k (0…1 entrée), alpha, side ('right'|'left')
    var a = o.alpha === undefined ? 1 : o.alpha;
    var k = o.k === undefined ? 1 : o.k;
    var side = o.side || "right";
    var sgn = side === "right" ? 1 : -1;
    glow(
      ctx,
      function (c) {
        // trait de rappel : du sujet vers le bloc, trim selon k
        var A = o.anchor,
          B = o.at;
        var e = ease.outQuint(ramp(0, 0.6, k));
        c.lineWidth = 1.25;
        var gap = 10; // le trait s'arrête avant le sujet
        var dx = B[0] - A[0],
          dy = B[1] - A[1],
          d = Math.hypot(dx, dy);
        var sx = A[0] + (dx / d) * gap,
          sy = A[1] + (dy / d) * gap;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + (B[0] - sx) * e, sy + (B[1] - sy) * e);
        c.stroke();
        // point d'accroche
        c.beginPath();
        c.arc(A[0], A[1], 2.6, 0, Math.PI * 2);
        c.fill();
        // texte
        var te = ease.outQuint(ramp(0.35, 1, k));
        if (te <= 0) return;
        c.globalAlpha = te;
        var tx = B[0] + sgn * (12 + 6 * (1 - te));
        c.textBaseline = "alphabetic";
        c.textAlign = side === "right" ? "left" : "right";
        c.font = "600 15px Inter";
        try {
          c.letterSpacing = "2.6px";
        } catch (e2) {}
        c.globalAlpha = te * 0.78;
        c.fillText(o.label, tx, B[1] - 13);
        c.font = "400 30px 'JetBrains Mono'";
        try {
          c.letterSpacing = "0px";
        } catch (e3) {}
        c.globalAlpha = te;
        c.fillText(o.value, tx, B[1] + 22);
        c.globalAlpha = 1;
      },
      { alpha: a, halo: 0.35, haloBlur: 6, shadow: 0.45, shadowBlur: 4 }
    );
  }

  /* Cadre 2,39:1 : k = 1 bandes pleines (138 px), k = 0 plein cadre. */
  function letterbox(ctx, k) {
    if (k <= 0) return;
    var full = Math.round((H - W / 2.39) / 2); // 138
    var h = full * k;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h, W, h);
    ctx.restore();
  }

  /* Bruit doux déterministe (somme de sinus) pour les courbes de niveau. */
  function wob(theta, level, seed) {
    return (
      0.075 * Math.sin(2 * theta + 1.3 + seed + level * 0.21) +
      0.05 * Math.sin(3 * theta + 0.4 + seed * 1.7 - level * 0.33) +
      0.03 * Math.sin(5 * theta + 2.1 + seed * 0.6 + level * 0.47) +
      0.015 * Math.sin(8 * theta + seed * 2.3 + level * 0.9)
    );
  }
  /* Courbes de niveau autour d'un sommet, vues en perspective (écrasées verticalement).
   * o : c [x,y] sommet, r0, dr, n, squash, rot, seed, reveal (0…1, les courbes se dessinent du centre vers l'extérieur) */
  function contours(ctx, o, clipFn) {
    var n = o.n || 10;
    var alpha = o.alpha === undefined ? 0.22 : o.alpha;
    glow(
      ctx,
      function (c) {
        c.save();
        if (clipFn) clipFn(c);
        c.lineWidth = o.width || 1.3;
        for (var i = 0; i < n; i++) {
          var r = o.r0 + o.dr * i * (1 + 0.04 * i);
          var start = (i / n) * 0.55;
          var u = ease.inOut(ramp(start, start + 0.45, o.reveal === undefined ? 1 : o.reveal));
          if (u <= 0) continue;
          c.globalAlpha = (i % 5 === 4 ? 1 : 0.62) * (1 - 0.35 * (i / n));
          c.beginPath();
          var N = 220;
          var th0 = (o.phase || -Math.PI / 2) + i * 0.4;
          for (var k = 0; k <= Math.round(N * u); k++) {
            var th = th0 + (k / N) * Math.PI * 2;
            var rr = r * (1 + wob(th, i, o.seed || 0));
            var x = rr * Math.cos(th),
              y = rr * Math.sin(th) * (o.squash || 0.4);
            var cr = Math.cos(o.rot || 0),
              sr = Math.sin(o.rot || 0);
            var X = o.c[0] + x * cr - y * sr,
              Y = o.c[1] + x * sr + y * cr;
            if (k === 0) c.moveTo(X, Y);
            else c.lineTo(X, Y);
          }
          c.stroke();
        }
        c.restore();
      },
      { alpha: alpha, halo: 0.25, shadow: 0.25 }
    );
  }

  root.LKDVM = {
    W: W,
    H: H,
    STONE: STONE,
    INK: INK,
    SAGE: SAGE,
    rgba: rgba,
    clamp: clamp,
    ramp: ramp,
    lerp: lerp,
    ease: ease,
    applyH: applyH,
    spline: spline,
    at: at,
    trim: trim,
    canvas: canvas,
    glow: glow,
    polyline: polyline,
    trace: trace,
    ring: ring,
    dot: dot,
    datum: datum,
    letterbox: letterbox,
    contours: contours,
    scenes: {},
  };
})(window);
