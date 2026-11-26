/* LKDV trailer — motion-lab/scenes/v6.js
 * Intégration v6 du motion design dans le film (24 i/s, images du film 0 … 1439).
 * Trois scènes, toutes pilotées par les interrupteurs de motion-lab/v6/reglages-v6.json :
 *   « v6-avant »    : surcouche transparente posée APRÈS le look commun et AVANT le grain (le fil, le logo tracé,
 *                     le point du Soleil ; plus tard l'iris, le point qui vit, la constellation) ;
 *   « v6-apres »    : surcouche transparente posée APRÈS le grain (les bandes du cadre 2,39:1, couleur exacte) ;
 *   « v6-fin-base » : la fin refaite à 24 i/s natif (images 1335–1439) : plaque img39 + tracés qui convergent, SANS le
 *                     logo (posé en surcouche) ; remplace P53 et P54 dans la liste v6, étalonnée comme avant.
 * Suivi : motion-lab/v6/track-v6.json (homographies par image, sujets) ; géographies : motion-lab/v6/geo-v6.json.
 */
(function () {
  "use strict";
  var M = LKDVM;
  function getJSON(url) {
    var x = new XMLHttpRequest();
    x.open("GET", url, false);
    x.send();
    if (x.status !== 200) throw new Error(url + " : " + x.status);
    return JSON.parse(x.responseText);
  }
  var R = null,
    GEO = null,
    TR = null;
  function load() {
    if (R) return;
    R = getJSON("v6/reglages-v6.json");
    GEO = getJSON("v6/geo-v6.json");
    TR = getJSON("v6/track-v6.json");
  }
  var on = function (k) {
    load();
    return R.interrupteurs[k] === true;
  };

  /* ---------- outils ---------- */
  function H(key, n) {
    var t = TR[key];
    return t.H[Math.max(0, Math.min(t.H.length - 1, n - t.a))];
  }
  function proj(key, n, pts) {
    var h = H(key, n);
    return pts.map(function (p) {
      return M.applyH(h, p);
    });
  }
  function subject(key, n) {
    var t = TR[key];
    return t.sujet[Math.max(0, Math.min(t.sujet.length - 1, n - t.a))];
  }
  function nearestU(sp, p) {
    var best = 0,
      bd = 1e18;
    for (var i = 0; i < sp.p.length; i++) {
      var d = (sp.p[i][0] - p[0]) * (sp.p[i][0] - p[0]) + (sp.p[i][1] - p[1]) * (sp.p[i][1] - p[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return sp.s[best] / sp.L;
  }
  /* Une apparition du fil : la tête part de u0 et file jusqu'au bout (in0 → in1), tient, puis la queue rattrape la
   * tête (out0 → out1). uMin(n) (facultatif) : le sujet « consomme » le trait (la queue ne passe jamais derrière lui). */
  function apparition(ctx, sp, n, a, uMin) {
    var u0 = a.u0 || 0;
    var head = u0 + (1 - u0) * M.ease.inOutQuint(M.ramp(a.in0, a.in1, n));
    var tail = u0 + (1 - u0) * M.ease.inOut(M.ramp(a.out0, a.out1, n));
    if (uMin !== undefined) tail = Math.max(tail, uMin);
    if (head <= u0 + 1e-4 || tail >= head - 1e-4 || n > a.out1) return;
    var alpha = 1 - M.ease.inOut(M.ramp(a.out0 + (a.out1 - a.out0) * 0.55, a.out1, n));
    alpha *= M.ease.out(M.ramp(a.in0 - 0.5, a.in0 + 2, n)); // naissance douce (2 images)
    M.trace(ctx, sp, tail, head, { head: true, fade: a.fade || 110, alpha: alpha, width: a.width || 2.5, shadow: a.shadow });
  }

  /* ---------- 1 · le fil ---------- */
  // Calage sur les temps (qa/mix-v4.beats.json, 1 temps = 10,51 images) : voir v6/reglages-v6.json « fil ».
  function fil(ctx, n) {
    var A = R.fil;
    // Naissance au Soleil (ouverture) : écran fixe (le cœur de la galaxie reste en 962/540 de l'image 33 à 38).
    var s = A.soleil;
    if (n >= s.in0 - 1 && n <= s.out1) {
      var spS = M.spline(GEO.soleil.chemin, 2);
      var head = M.ease.out(M.ramp(s.in0, s.in1, n));
      var tail = M.ease.inOut(M.ramp(s.out0, s.out1, n));
      var al = 1 - M.ease.inOut(M.ramp(s.out0 + 2, s.out1, n));
      if (head > tail + 1e-3) M.trace(ctx, spS, tail, head, { head: true, fade: 260, alpha: al, headR: 4, shadow: 0 });
    }
    ["p26", "p35", "p38", "p42"].forEach(function (k) {
      var a = A[k];
      if (!a || n < GEO[k].a || n > GEO[k].b || n < a.in0 - 1 || n > a.out1) return;
      var pts = proj(k, n, GEO[k].chemin);
      if (k === "p26" && TR.p26b) {
        // partie lointaine de la pente : seconde homographie, mêlée de x 1380 à 1540 (image de référence)
        var far = proj("p26b", n, GEO[k].chemin);
        pts = pts.map(function (p, i) {
          var w = M.ease.inOutSine(M.ramp(1380, 1540, GEO[k].chemin[i][0]));
          return [M.lerp(p[0], far[i][0], w), M.lerp(p[1], far[i][1], w)];
        });
      }
      var sp = M.spline(pts, 2);
      var uMin;
      if (GEO[k].sujet && TR[k].sujet) uMin = nearestU(sp, subject(k, n)) + (a.ecartSujet || 24) / sp.L;
      apparition(ctx, sp, n, a, uMin);
    });
  }

  /* ---------- 10 · le logo tracé par le fil, 12 · le point du Soleil ---------- */
  var LOGO = { mountains: "M2 24 L10 10 L14 16 L20 6 L30 24 Z", base: "M2 24 L30 24", sun: [24, 9], r: 1.6, sw: 1.6 };
  var PLACE = { cx: 960, cy: 540, ux: 16, uy: 15, s: 21 }; // = film/lib/fx/traces.js (PLACE), logo de p54
  function Ffin(f) {
    // image du film → image de la séquence finale de film/lib/fx (0 … 223 à 60 i/s) : 1335 → 0, 1387 → 104 (logo net)
    return f < 1387 ? 2 * (f - 1335) : 104 + ((f - 1387) * 119) / 52;
  }
  function reculFin(F) {
    var T = window.LKDVFX.Traces,
      FX = window.LKDVFX;
    return 1 - 0.055 * FX.ease.outCubic(FX.ramp(T.NET_FRAME, T.TOTAL_FRAMES - 1, F));
  }
  function outFin(F) {
    var T = window.LKDVFX.Traces,
      u = window.LKDVFX.ramp(T.TOTAL_FRAMES - 48, T.TOTAL_FRAMES - 1, F);
    return 1 - u * u * u;
  }
  function Lpt(p, k) {
    return [PLACE.cx + (p[0] - PLACE.ux) * PLACE.s * k, PLACE.cy + (p[1] - PLACE.uy) * PLACE.s * k];
  }
  var CRETE = [[2, 24], [10, 10], [14, 16], [20, 6], [30, 24], [2, 24]]; // le contour du logo, dans l'ordre du SVG
  function polySp(pts) {
    var sp = { p: [pts[0]], s: [0], L: 0 };
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1],
        b = pts[i],
        d = Math.hypot(b[0] - a[0], b[1] - a[1]),
        m = Math.max(1, Math.ceil(d / 2));
      for (var k = 1; k <= m; k++) sp.p.push([a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
    }
    for (var j = 1; j < sp.p.length; j++) sp.s.push(sp.s[j - 1] + Math.hypot(sp.p[j][0] - sp.p[j - 1][0], sp.p[j][1] - sp.p[j - 1][1]));
    sp.L = sp.s[sp.s.length - 1];
    return sp;
  }
  function logoFin(ctx, n) {
    if (n < 1335) return;
    var L = R.logo,
      F = Ffin(n),
      k = reculFin(F),
      out = outFin(F);
    var pts = CRETE.map(function (p) {
      return Lpt(p, k);
    });
    if (on("logo_fil") && n < L.pose) {
      // le fil du film dessine le contour du logo pendant que les tracés convergent
      var u = M.ease.inOutSine(M.ramp(L.trace0, L.trace1, n));
      if (u > 0) M.trace(ctx, polySp(pts), 0, u, { head: true, fade: 0, width: 3, headR: 4.2, shadow: 0, halo: 0.6 });
    }
    if (n >= L.pose) {
      // le logo se pose sur le coup (1387) : le trait du fil s'épaissit jusqu'au trait du logo, sans dépassement
      var w = on("logo_fil") ? M.lerp(3, LOGO.sw * PLACE.s * k, M.ease.outQuint(M.ramp(L.pose, L.pose + L.epaissir, n))) : LOGO.sw * PLACE.s * k;
      var s = PLACE.s * k;
      M.glow(
        ctx,
        function (c) {
          c.save();
          c.setTransform(s, 0, 0, s, PLACE.cx - PLACE.ux * s, PLACE.cy - PLACE.uy * s);
          c.lineWidth = w / s;
          c.lineJoin = "round";
          c.lineCap = "round";
          c.stroke(new Path2D(LOGO.mountains));
          c.stroke(new Path2D(LOGO.base));
          c.restore();
        },
        { alpha: out, halo: 0.25, haloBlur: 10, shadow: 0 }
      );
    }
    // 12 · le point du Soleil : l'étincelle arrive en dernier et devient le soleil du logo
    var sun = Lpt(LOGO.sun, k);
    if (on("point_soleil")) {
      var P = L.point;
      if (n >= P.depart && n < P.arrivee + 1) {
        var path = M.spline([[sun[0] + 520, sun[1] - 300], [sun[0] + 300, sun[1] - 230], [sun[0] + 120, sun[1] - 90], sun], 2);
        var hu = M.ease.inOutQuint(M.ramp(P.depart, P.arrivee, n));
        var tu = Math.max(0, hu - 0.35);
        M.trace(ctx, path, tu, hu, { head: true, fade: 200, width: 2.5, headR: 4, shadow: 0, alpha: out });
      }
      if (n >= P.arrivee) {
        var g = M.ease.outQuint(M.ramp(P.arrivee, P.arrivee + P.grossir, n));
        var r = M.lerp(4, LOGO.r * PLACE.s * k, g);
        M.glow(
          ctx,
          function (c) {
            c.beginPath();
            c.arc(sun[0], sun[1], r, 0, Math.PI * 2);
            c.fill();
          },
          { alpha: out, halo: 0.35, haloBlur: 10, shadow: 0 }
        );
        M.ring(ctx, sun, M.ramp(P.arrivee, P.arrivee + P.anneau, n), { r0: 20, r1: 74, width: 1.6, alpha: out });
      }
    } else if (n >= L.pose) {
      // sans l'idée 12, le soleil du logo se pose avec le reste
      M.glow(
        ctx,
        function (c) {
          c.beginPath();
          c.arc(sun[0], sun[1], LOGO.r * PLACE.s * k, 0, Math.PI * 2);
          c.fill();
        },
        { alpha: out, halo: 0.25, shadow: 0 }
      );
    }
    if (on("nom_sous_logo") && n >= L.nom.in0) {
      var a = M.ease.out(M.ramp(L.nom.in0, L.nom.in1, n)) * out;
      M.glow(
        ctx,
        function (c) {
          c.textAlign = "center";
          c.font = "600 22px Inter";
          try {
            c.letterSpacing = "9px";
          } catch (e) {}
          c.fillText("LE KIT DU VOYAGEUR", M.W / 2 + 4.5, PLACE.cy + (24 - PLACE.uy) * PLACE.s * k + 92);
        },
        { alpha: a, halo: 0.3, shadow: 0 }
      );
    }
  }

  /* ---------- 3 · le cadre qui s'ouvre (bandes 2,39:1, posées après le grain) ---------- */
  function bandesK(n) {
    var C = R.cadre;
    var k = 0;
    if (n < C.ouverture[0]) k = 1;
    else if (n < C.ouverture[0] + C.ouverture[1]) k = 1 - M.ease.out(M.ramp(C.ouverture[0], C.ouverture[0] + C.ouverture[1], n));
    if (C.fermeture && n >= C.fermeture[0]) k = M.ease.inOut(M.ramp(C.fermeture[0], C.fermeture[0] + C.fermeture[1], n));
    if (C.reouverture && n >= C.reouverture[0]) k = 1 - M.ease.out(M.ramp(C.reouverture[0], C.reouverture[0] + C.reouverture[1], n));
    return k;
  }
  function bandes(ctx, n) {
    var k = bandesK(n);
    if (k <= 0) return;
    var full = (M.H - M.W / 2.39) / 2; // 138,3 px
    var h = full * k;
    ctx.fillStyle = R.cadre.couleur;
    // bord net à la ligne, sous-pixel arrondi (pas de liseré gris)
    var hh = Math.round(h);
    ctx.fillRect(0, 0, M.W, hh);
    ctx.fillRect(0, M.H - hh, M.W, hh);
  }

  /* ---------- scènes ---------- */
  M.scenes["v6-nom-still"] = {
    // image de contrôle : image du film v6 (étalonnée) + la ligne de nom (variante C, interrupteur éteint dans la v6)
    images: function (n, p) {
      return { a: p.src };
    },
    draw: function (ctx, n, im) {
      load();
      ctx.drawImage(im.a, 0, 0, M.W, M.H);
      var k = reculFin(Ffin(n)),
        out = outFin(Ffin(n));
      M.glow(
        ctx,
        function (c) {
          c.textAlign = "center";
          c.font = "600 22px Inter";
          try {
            c.letterSpacing = "9px";
          } catch (e) {}
          c.fillText("LE KIT DU VOYAGEUR", M.W / 2 + 4.5, PLACE.cy + (24 - PLACE.uy) * PLACE.s * k + 92);
        },
        { alpha: out, halo: 0.3, shadow: 0 }
      );
    },
  };
  M.scenes["v6-test-clair"] = {
    // le trait du fil sur fond clair : neige (P10, image 273) et brouillard (P26, image 612)
    images: function () {
      return { a: "frames/v4/f0273.jpg", b: "frames/v4/f0612.jpg" };
    },
    draw: function (ctx, n, im) {
      var off = M.canvas(),
        o = off.getContext("2d");
      o.drawImage(im.a, 0, 0);
      M.trace(o, M.spline([[700, 470], [860, 440], [1020, 452], [1180, 420], [1340, 440]], 2), 0, 1, { head: true, fade: 110 });
      ctx.drawImage(off, 560, 300, 960, 540, 0, 0, 960, 540);
      o.drawImage(im.b, 0, 0);
      M.trace(o, M.spline([[1250, 470], [1400, 455], [1560, 470], [1720, 450], [1860, 470]], 2), 0, 1, { head: true, fade: 110 });
      ctx.drawImage(off, 960, 240, 960, 540, 960, 0, 960, 540);
      o.drawImage(im.a, 0, 0);
      M.trace(o, M.spline([[700, 470], [860, 440], [1020, 452], [1180, 420], [1340, 440]], 2), 0, 1, { head: true, fade: 110 });
      ctx.drawImage(off, 0, 0, M.W, M.H, 0, 540, 960, 540);
      o.drawImage(im.b, 0, 0);
      M.trace(o, M.spline([[1250, 470], [1400, 455], [1560, 470], [1720, 450], [1860, 470]], 2), 0, 1, { head: true, fade: 110 });
      ctx.drawImage(off, 0, 0, M.W, M.H, 960, 540, 960, 540);
    },
  };

  M.v6 = {
    actif: function (n) {
      load();
      var o = { avant: false, apres: false };
      if (on("cadre") && bandesK(n) > 0) o.apres = true;
      if (on("fil")) {
        var A = R.fil;
        if (n >= A.soleil.in0 - 1 && n <= A.soleil.out1) o.avant = true;
        ["p26", "p35", "p38", "p42"].forEach(function (k) {
          if (A[k] && n >= Math.max(GEO[k].a, A[k].in0 - 1) && n <= Math.min(GEO[k].b, A[k].out1)) o.avant = true;
        });
      }
      if ((on("logo_fil") || on("point_soleil") || on("nom_sous_logo") || R.logo.toujours) && n >= 1335) o.avant = true;
      // idées du niveau équilibré (4 iris, 2 point qui vit, 6 constellation) : à brancher ici (voir le document)
      return o;
    },
  };
  M.scenes["v6-avant"] = {
    images: function () {
      return {};
    },
    draw: function (ctx, n) {
      load();
      if (on("fil")) fil(ctx, n);
      logoFin(ctx, n);
    },
  };
  M.scenes["v6-apres"] = {
    images: function () {
      return {};
    },
    draw: function (ctx, n) {
      load();
      if (on("cadre")) bandes(ctx, n);
    },
  };

  /* La fin à 24 i/s natif : plaque + tracés (repris de film/lib/fx/finale.js, sans le logo ni le soleil, posés en
   * surcouche). */
  var FIN = null;
  M.scenes["v6-fin-base"] = {
    images: function () {
      return { plaque: "/trailer/assets/footage/img39.png" };
    },
    draw: function (ctx, n, im) {
      var FX = window.LKDVFX,
        T = FX.Traces;
      var W = 1920,
        Hh = 1080;
      if (!FIN) {
        FIN = { sim: T.build({ count: 2200, seed: 5354 }), thr: FX.canvas(W, Hh), glow: FX.canvas(W / 4, Hh / 4), buf: null };
      }
      var F = Ffin(n),
        NET = T.NET_FRAME,
        k = reculFin(F),
        out = outFin(F);
      var setRecul = function (c) {
        c.setTransform(k, 0, 0, k, (W / 2) * (1 - k), (Hh / 2) * (1 - k));
      };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = FX.rgba(FX.RGB.ink, 1);
      ctx.fillRect(0, 0, W, Hh);
      setRecul(ctx);
      var pk = T.pushFor(F),
        img = im.plaque;
      // la plaque couvre toujours le cadre malgré le recul (pas de liseré encre sur les bords, défaut de l’ancienne p54)
      var sc = Math.max(W / img.width, Hh / img.height) * Math.max(pk, k < 1 ? 1 / k + 0.004 : 1);
      ctx.drawImage(img, (W - img.width * sc) / 2, (Hh - img.height * sc) / 2, img.width * sc, img.height * sc);
      var dim = 0.35 * FX.smooth(60, NET, F) + 0.65 * (1 - out);
      if (dim > 0.001) {
        ctx.fillStyle = FX.rgba(FX.RGB.ink, dim);
        ctx.fillRect(-W, -Hh, 3 * W, 3 * Hh);
      }
      var sim = FIN.sim,
        tctx = FIN.thr.getContext("2d");
      FIN.buf = T.frame(sim, F, FIN.buf);
      var buf = FIN.buf,
        pos = buf.pos,
        N = sim.N,
        Mm = sim.M;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, W, Hh);
      setRecul(tctx);
      tctx.lineJoin = "round";
      tctx.lineCap = "round";
      var THREAD = [124, 166, 112],
        NB = 5,
        paths = [],
        heads = [];
      for (var b = 0; b < NB; b++) paths.push([]);
      for (var i = 0; i < N; i++) {
        var rev = buf.rev[i];
        if (rev <= 0) continue;
        var e = buf.e[i];
        var a = (0.85 - 0.66 * e) * sim.P.bright[i] * Math.min(1, rev * 3);
        paths[Math.min(NB - 1, Math.floor(a * NB))].push(i);
        if ((e > 0.02 && e < 0.98) || (e <= 0.02 && rev < 1)) heads.push(i);
      }
      tctx.lineWidth = 1.3;
      for (var bb = 0; bb < NB; bb++) {
        var list = paths[bb];
        if (!list.length) continue;
        tctx.strokeStyle = FX.rgba(THREAD, ((bb + 0.5) / NB).toFixed(3));
        tctx.beginPath();
        for (var li = 0; li < list.length; li++) {
          var nn = list[li],
            upto = buf.rev[nn] * (Mm - 1),
            full = Math.floor(upto),
            base = nn * Mm * 2;
          tctx.moveTo(pos[base], pos[base + 1]);
          for (var m = 1; m <= full; m++) tctx.lineTo(pos[base + m * 2], pos[base + m * 2 + 1]);
          var fr = upto - full;
          if (fr > 0 && full < Mm - 1) {
            var x0 = pos[base + full * 2],
              y0 = pos[base + full * 2 + 1];
            tctx.lineTo(x0 + (pos[base + full * 2 + 2] - x0) * fr, y0 + (pos[base + full * 2 + 3] - y0) * fr);
          }
        }
        tctx.stroke();
      }
      tctx.fillStyle = FX.rgba(FX.RGB.stone, 0.9);
      for (var h2 = 0; h2 < heads.length; h2++) {
        var nh = heads[h2],
          idx = Math.min(Mm - 1, Math.round(buf.rev[nh] * (Mm - 1)));
        tctx.fillRect(pos[(nh * Mm + idx) * 2] - 1, pos[(nh * Mm + idx) * 2 + 1] - 1, 2, 2);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var gctx = FIN.glow.getContext("2d");
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, FIN.glow.width, FIN.glow.height);
      gctx.drawImage(FIN.thr, 0, 0, FIN.glow.width, FIN.glow.height);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.55 * out;
      ctx.filter = "blur(6px)";
      ctx.drawImage(FIN.glow, 0, 0, W, Hh);
      var sb = T.softBlur(F);
      ctx.filter = sb > 0.05 ? "blur(" + sb.toFixed(2) + "px)" : "none";
      ctx.globalAlpha = (F >= NET ? 0.6 : 1) * out;
      ctx.drawImage(FIN.thr, 0, 0);
      ctx.filter = "none";
      if (F >= NET) {
        var impact = Math.exp(-(F - NET) / 7);
        if (impact > 0.01) {
          var rg = ctx.createRadialGradient(W / 2, Hh / 2, 0, W / 2, Hh / 2, W * 0.6);
          rg.addColorStop(0, FX.rgba(FX.RGB.stone, 0.22 * impact));
          rg.addColorStop(1, FX.rgba(FX.RGB.sage, 0));
          ctx.globalAlpha = 1;
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, W, Hh);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  };
})();
