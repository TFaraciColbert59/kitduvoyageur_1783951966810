/* LKDV trailer — motion-lab/scenes/scenes.js
 * Scènes de proposition. Chaque scène : images(n, params) → {clé: url} et draw(ctx, n, images, params).
 * Coordonnées relevées à la main sur les vraies images du montage (grilles de relevé dans motion-lab/work/).
 */
(function () {
  "use strict";
  var M = LKDVM;
  var FR = function (n) {
    return "frames/f" + String(n).padStart(4, "0") + ".png";
  };
  var SEQ = function (n) {
    return "frames/seq/f" + String(n).padStart(4, "0") + ".png";
  };
  function plate(ctx, im) {
    ctx.drawImage(im, 0, 0, M.W, M.H);
  }

  /* ---------- Géographies relevées (image de référence indiquée) ---------- */
  var GEO = {
    // P26 Seceda, image 600 : ligne de crête parcourue par les marcheurs, devant le premier (vers la droite).
    seceda600: {
      ahead: [[1146, 578], [1220, 593], [1300, 611], [1380, 630], [1460, 650], [1540, 671], [1620, 690], [1700, 704], [1780, 729]],
      group: [1062, 548],
      lead: [1120, 560],
    },
  };
  M.GEO = GEO;

  /* Suivi de caméra (motion-lab/track.py → work/track.json), chargé une fois. */
  var TRACK = null;
  function track() {
    if (TRACK) return TRACK;
    try {
      var x = new XMLHttpRequest();
      x.open("GET", "work/track.json", false);
      x.send();
      TRACK = JSON.parse(x.responseText);
    } catch (e) {
      TRACK = {};
    }
    return TRACK;
  }
  /* Points de référence → écran de l'image n (homographie du plan). */
  function proj(shot, n, pts) {
    var t = track()[shot];
    if (!t) return pts;
    var Hm = t.H[n - t.a];
    return pts.map(function (p) {
      return M.applyH(Hm, p);
    });
  }
  function subject(shot, name, n) {
    var t = track()[shot];
    return t.points[name][n - t.a];
  }
  M.proj = proj;
  M.subject = subject;

  /* Tracé animé : apparition de la tête (in), tenue, puis la queue rattrape la tête (out). */
  function traceAnim(ctx, sp, n, o) {
    var uIn = M.ease.inOutQuint(M.ramp(o.in0, o.in1, n));
    var uOut = M.ease.inOut(M.ramp(o.out0, o.out1, n));
    if (uIn <= 0 || uOut >= 1) return;
    var alpha = 1 - M.ease.inOut(M.ramp(o.out0 + (o.out1 - o.out0) * 0.55, o.out1, n));
    M.trace(ctx, sp, uOut, uIn, { head: true, fade: o.fade === undefined ? 120 : o.fade, alpha: alpha, width: o.width });
  }
  M.traceAnim = traceAnim;

  /* ---------- Essai 1 : images 547–673, le cadre qui s'ouvre au drop + le fil sur la crête + l'anneau ---------- */
  GEO.p27ref650 = { trail: [[906, 713], [930, 703], [960, 691], [990, 680], [1017, 669], [1037, 660], [1052, 654]] };
  M.scenes["essai-1"] = {
    images: function (n) {
      return { a: SEQ(n) };
    },
    draw: function (ctx, n, im, prm) {
      plate(ctx, im.a);
      if (n >= 589 && n <= 630) {
        // l'anneau, une fois, autour des quatre marcheurs, sur le drop
        var g = subject("p26", "tete", n);
        M.ring(ctx, [g[0], g[1] - 2], M.ramp(590, 608, n), { r0: 8, r1: 30, width: 1.5 });
        // le fil part du premier marcheur et file sur la crête
        var pts = proj("p26", n, GEO.seceda600.ahead);
        var sp = M.spline(pts, 2);
        traceAnim(ctx, sp, n, { in0: 600, in1: 616, out0: 622, out1: 631 });
      }
      if (n >= 631 && n <= 672) {
        var sp2 = M.spline(proj("p27", n, GEO.p27ref650.trail), 2);
        traceAnim(ctx, sp2, n, { in0: 637, in1: 655, out0: 660, out1: 671, fade: 60 });
      }
      // le cadre 2,39:1 tient tout le départ et s'ouvre sur le drop (8 images, amorti)
      var k = n < 589 ? 1 : 1 - M.ease.out(M.ramp(589, 597, n));
      if (!prm.noBars) M.letterbox(ctx, k);
    },
  };

  /* ---------- Essai 2 : images 210–294, l'iris (le lac grandit depuis la pupille de Léa) ---------- */
  var irisBuf = null;
  function drawScaled(c, im, p, s) {
    c.drawImage(im, p[0] - p[0] * s, p[1] - p[1] * s, M.W * s, M.H * s);
  }
  function iris(ctx, outer, inner, c, R, feather, sOut, sIn) {
    drawScaled(ctx, outer, c, sOut);
    if (R <= 0.5) return;
    irisBuf = irisBuf || M.canvas();
    var b = irisBuf.getContext("2d");
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = "source-over";
    b.clearRect(0, 0, M.W, M.H);
    drawScaled(b, inner, c, sIn);
    b.globalCompositeOperation = "destination-in";
    var g = b.createRadialGradient(c[0], c[1], Math.max(0, R * (1 - feather)), c[0], c[1], R);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    b.fillStyle = g;
    b.fillRect(0, 0, M.W, M.H);
    b.globalCompositeOperation = "source-over";
    ctx.drawImage(irisBuf, 0, 0);
  }
  var IRIS = { start: 237, end: 252, feather: 0.2 };
  M.scenes["essai-2"] = {
    images: function (n) {
      if (n < IRIS.start || n >= IRIS.end) return { a: SEQ(n) };
      return { a: SEQ(Math.min(n, 241)), b: SEQ(IRIS.end) };
    },
    draw: function (ctx, n, im) {
      if (n < IRIS.start || n >= IRIS.end) return plate(ctx, im.a);
      var c = subject("p08", "pupille", Math.min(n, 241));
      // fraction d'image (0…1) entre start et end, sous-image incluse pour que la fin tombe juste sur 252
      var u = M.ramp(IRIS.start - 0.5, IRIS.end - 0.5, n);
      var far = Math.max(Math.hypot(c[0], c[1]), Math.hypot(M.W - c[0], c[1]), Math.hypot(c[0], M.H - c[1]), Math.hypot(M.W - c[0], M.H - c[1]));
      var Rmax = far / (1 - IRIS.feather) + 4;
      var R = Rmax * Math.pow(M.ease.inOutSine(u), 1.8);
      var sOut = 1 + 0.6 * M.ease.inOut(M.ramp(IRIS.start - 3, IRIS.end, n));
      var sIn = 1 + 0.22 * (1 - M.ease.out(u));
      iris(ctx, im.a, im.b, c, R, IRIS.feather, sOut, sIn);
    },
  };
  M.irisAt = function (ctx, outer, inner, c, u) {
    var far = 1300;
    iris(ctx, outer, inner, c, (far / (1 - IRIS.feather)) * M.ease.inOut(u), IRIS.feather, 1 + 0.6 * M.ease.inOut(u), 1 + 0.22 * (1 - M.ease.out(u)));
  };

  /* ---------- Essai 3 : images 799–925, le coureur. Version A : le fil seul. Version B : la donnée juste. ---------- */
  GEO.p35ref840 = {
    // les lacets visibles au-delà de l'épaule droite du coureur (image 840)
    lacets: [[1102, 272], [1140, 274], [1172, 279], [1196, 290], [1212, 308], [1222, 330], [1234, 350], [1255, 361], [1285, 361], [1320, 360], [1350, 367], [1373, 380], [1384, 397]],
  };
  GEO.p38ref905 = {
    // le sentier dans l'éboulis, devant Malik (il court vers la gauche)
    devant: [[982, 910], [930, 907], [870, 905], [800, 902], [730, 900], [660, 897]],
  };
  // P33 : bord droit du short (ceinture), relevé à la main (le flou de bougé empêche le suivi automatique)
  var P33_HIP = { 799: [1030, 540], 804: [1040, 510], 809: [1045, 520], 814: [1045, 550], 819: [1035, 520] };
  function p33hip(n) {
    var ks = [799, 804, 809, 814, 819];
    for (var i = 0; i < ks.length - 1; i++)
      if (n <= ks[i + 1]) {
        var t = M.ease.inOutSine(M.ramp(ks[i], ks[i + 1], n));
        return [M.lerp(P33_HIP[ks[i]][0], P33_HIP[ks[i + 1]][0], t) + 14, M.lerp(P33_HIP[ks[i]][1], P33_HIP[ks[i + 1]][1], t) + 6];
      }
    return [P33_HIP[819][0] + 14, P33_HIP[819][1] + 6];
  }
  function datumAnim(ctx, n, o) {
    var k = M.ramp(o.in0, o.in1, n);
    var out = M.ease.inOut(M.ramp(o.out0, o.out1, n));
    if (k <= 0 || out >= 1) return;
    M.datum(ctx, { anchor: o.anchor, at: o.at, label: o.label, value: o.value, k: k, alpha: 1 - out, side: o.side });
  }
  M.datumAnim = datumAnim;
  M.scenes["essai-3"] = {
    images: function (n) {
      return { a: SEQ(n) };
    },
    draw: function (ctx, n, im, prm) {
      plate(ctx, im.a);
      var B = prm.version === "B";
      if (B && n >= 799 && n <= 819) {
        // TEMPS 36:18 : valeur réelle de la capture E10 (Explorer, activité en cours)
        var h = p33hip(n);
        datumAnim(ctx, n, { in0: 800, in1: 810, out0: 813, out1: 819, anchor: h, at: [h[0] + 170, h[1] + 92], label: "TEMPS", value: "36:18" });
      }
      if (n >= 830 && n <= 850) {
        var sp = M.spline(proj("p35", n, GEO.p35ref840.lacets), 2);
        traceAnim(ctx, sp, n, { in0: 831, in1: 843, out0: 844, out1: 851, fade: 70 });
      }
      if (n >= 883 && n <= 924) {
        var mk = subject("p38", "malik", n);
        if (!B) {
          M.ring(ctx, mk, M.ramp(884, 902, n), { r0: 7, r1: 26, width: 1.5 });
          var sp2 = M.spline(proj("p38", n, GEO.p38ref905.devant), 2);
          traceAnim(ctx, sp2, n, { in0: 894, in1: 912, out0: 914, out1: 924, fade: 80 });
        } else {
          // DISTANCE 2,1 km : valeur réelle de la capture E10
          datumAnim(ctx, n, { in0: 886, in1: 900, out0: 914, out1: 924, anchor: subject("p38", "pieds", n), at: [mk[0] + 150, mk[1] - 150], label: "DISTANCE", value: "2,1 km" });
        }
      }
    },
  };

  /* Carton de présentation (hors film) entre les versions d'un essai. */
  M.scenes["carton"] = {
    images: function () {
      return {};
    },
    draw: function (ctx, n, im, prm) {
      ctx.fillStyle = "#0B1F17";
      ctx.fillRect(0, 0, M.W, M.H);
      ctx.fillStyle = M.rgba(M.STONE, 0.92);
      ctx.textAlign = "center";
      ctx.font = "600 18px Inter";
      try {
        ctx.letterSpacing = "4px";
      } catch (e) {}
      ctx.fillText(prm.titre || "", M.W / 2, M.H / 2 - 6);
      ctx.font = "italic 26px Georgia";
      try {
        ctx.letterSpacing = "0px";
      } catch (e) {}
      ctx.fillStyle = M.rgba(M.STONE, 0.7);
      ctx.fillText(prm.sous || "", M.W / 2, M.H / 2 + 34);
    },
  };

  M.scenes["idee-01-fil-seceda"] = {
    images: function (n) {
      return { a: FR(n) };
    },
    draw: function (ctx, n, im) {
      plate(ctx, im.a);
      var sp = M.spline(GEO.seceda600.ahead, 2);
      M.trace(ctx, sp, 0, 1, { head: true, fade: 140 });
    },
  };
})();
