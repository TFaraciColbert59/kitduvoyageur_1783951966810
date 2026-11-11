/* LKDV trailer — lib/fx/finale.js
 * Rendu commun de P53 et P54 : Terre de nuit + tracés + logo. Une seule fonction render(F) sur la séquence
 * F = 0 … 223 (P53 = 0 … 103, P54 = 104 … 223), pour que la coupe P53→P54 soit continue par construction.
 * Dépend de core.js, earth-data.js, earth.js, traces.js.
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Finale) return;
  var T = FX.Traces;

  /* Caméra : orbite lente et poussée sur P53, fixe ensuite (le recul est un zoom arrière de l'image). */
  function viewFor(F) {
    var u = FX.clamp(F, 0, T.NET_FRAME - 1) / (T.NET_FRAME - 1);
    return FX.Earth.viewAt({
      lon0: 12.2 - 3.2 * FX.ease.inOutSine(u),
      lat0: -8.5 + 0.8 * u,
      R: 2120 + 160 * FX.ease.outCubic(u),
      limbY: 150 - 30 * FX.ease.outCubic(u),
    });
  }
  function reculFor(F) {
    return 1 - 0.055 * FX.ease.outCubic(FX.ramp(T.NET_FRAME, T.TOTAL_FRAMES - 1, F));
  }

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var W = canvas.width,
      H = canvas.height;
    var E = FX.Earth.build({ seed: 5301 });
    var sim = T.build({ count: opts.count || 2600, seed: 5354 });
    var thr = FX.canvas(W, H),
      tctx = thr.getContext("2d");
    var glow = FX.canvas(W / 4, H / 4),
      gctx = glow.getContext("2d");
    var buf = null;
    var endFade = opts.endFadeFrames == null ? 24 : opts.endFadeFrames;
    var threadRGB = FX.mixRGB(FX.RGB.sageLight, FX.RGB.sagePale, 0.45);

    function setRecul(c, k) {
      c.setTransform(k, 0, 0, k, (W / 2) * (1 - k), (H / 2) * (1 - k));
    }

    var state = { plate: null };
    /* Plaque img39 (quand elle existe) : remplit le cadre, poussée lente sur P53 ; le recul vient de setRecul. */
    function drawPlate(img, F, dim) {
      var u = FX.clamp(F, 0, T.NET_FRAME - 1) / (T.NET_FRAME - 1);
      var push = 1 + 0.045 * FX.ease.outCubic(u);
      var sc = Math.max(W / img.width, H / img.height) * push;
      var dw = img.width * sc,
        dh = img.height * sc;
      ctx.globalAlpha = 1;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = FX.rgba(FX.RGB.ink, 1 - dim);
      ctx.fillRect(-W, -H, 3 * W, 3 * H);
    }
    function render(F) {
      var view = viewFor(F);
      var k = reculFor(F);
      var NET = T.NET_FRAME,
        LAST = T.TOTAL_FRAMES - 1;
      // Atténuations : la Terre s'efface sous les tracés, puis tout sort en fondu à la fin.
      var earthDim = 1 - 0.5 * FX.smooth(36, NET, F);
      var outAll = FX.smooth(LAST - 48, LAST, F); // fondu de sortie (0,8 s, comme la musique)
      earthDim *= 1 - outAll;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.fillStyle = FX.rgba(FX.RGB.ink, 1);
      ctx.fillRect(0, 0, W, H);
      setRecul(ctx, k);
      if (state.plate) drawPlate(state.plate, F, earthDim);
      else FX.Earth.draw(ctx, E, view, { dim: earthDim });

      // Tracés.
      buf = T.frame(sim, F, view, buf);
      var pos = buf.pos,
        N = sim.N,
        M = sim.M;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, W, H);
      setRecul(tctx, k);
      tctx.lineJoin = "round";
      tctx.lineCap = "round";
      var NB = 6,
        paths = [];
      for (var b = 0; b < NB; b++) paths.push([]);
      var heads = [];
      for (var n = 0; n < N; n++) {
        var rev = buf.rev[n];
        if (rev <= 0) continue;
        var e = buf.e[n];
        var a = (0.9 * (1 - e) + 0.42 * e) * sim.P.bright[n] * Math.min(1, rev * 3);
        var bi = Math.min(NB - 1, Math.floor(a * NB));
        paths[bi].push(n);
        if (e < 0.97) heads.push(n);
      }
      tctx.lineWidth = 1.15;
      for (var bb = 0; bb < NB; bb++) {
        var list = paths[bb];
        if (!list.length) continue;
        tctx.strokeStyle = FX.rgba(threadRGB, ((bb + 0.5) / NB).toFixed(3));
        tctx.beginPath();
        for (var li = 0; li < list.length; li++) {
          var nn = list[li];
          var upto = buf.rev[nn] * (M - 1);
          var full = Math.floor(upto);
          var base = nn * M * 2;
          tctx.moveTo(pos[base], pos[base + 1]);
          for (var m = 1; m <= full; m++) tctx.lineTo(pos[base + m * 2], pos[base + m * 2 + 1]);
          var fr = upto - full;
          if (fr > 0 && full < M - 1) {
            var x0 = pos[base + full * 2],
              y0 = pos[base + full * 2 + 1];
            tctx.lineTo(x0 + (pos[base + full * 2 + 2] - x0) * fr, y0 + (pos[base + full * 2 + 3] - y0) * fr);
          }
        }
        tctx.stroke();
      }
      // Pointes crème : la tête de chaque tracé encore en route.
      tctx.fillStyle = FX.rgba(FX.RGB.stone, 0.85);
      for (var h = 0; h < heads.length; h++) {
        var nh = heads[h];
        var idx = Math.min(M - 1, Math.round(buf.rev[nh] * (M - 1)));
        var hx = pos[(nh * M + idx) * 2],
          hy = pos[(nh * M + idx) * 2 + 1];
        tctx.fillRect(hx - 0.9, hy - 0.9, 1.8, 1.8);
      }

      // Halo : copie basse résolution floutée, en addition.
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.drawImage(thr, 0, 0, glow.width, glow.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      var impact = F >= NET ? Math.exp(-(F - NET) / 7) : 0;
      ctx.globalAlpha = (0.75 + 0.9 * impact) * (1 - outAll);
      ctx.filter = "blur(7px)";
      ctx.drawImage(glow, 0, 0, W, H);
      ctx.filter = "blur(2px)";
      ctx.globalAlpha = 0.5 * (1 - outAll);
      ctx.drawImage(glow, 0, 0, W, H);
      // Les fils eux-mêmes : doux tant que le logo n'est pas net.
      var sb = T.softBlur(F);
      ctx.filter = sb > 0.05 ? "blur(" + sb.toFixed(2) + "px)" : "none";
      ctx.globalAlpha = 1 - outAll;
      ctx.drawImage(thr, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Le logo net : à partir de NET_FRAME seulement.
      if (F >= NET) {
        var logoA = 1 - FX.smooth(LAST - endFade, LAST, F);
        var col = FX.mixRGB(FX.RGB.stone, FX.RGB.sagePale, 0.35 * FX.smooth(NET, NET + 40, F));
        T.drawLogo(ctx, FX.rgba(col, 1), logoA, k, 1);
        // Éclair d'impact crème, très bref.
        if (impact > 0.01) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = "lighter";
          var rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
          rg.addColorStop(0, FX.rgba(FX.RGB.stone, 0.18 * impact));
          rg.addColorStop(1, FX.rgba(FX.RGB.sage, 0));
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = "source-over";
        }
      }
    }
    return { render: render, sim: sim, earth: E, setPlate: function (img) { state.plate = img; } };
  }

  FX.Finale = { create: create, viewFor: viewFor, reculFor: reculFor };
})(typeof window !== "undefined" ? window : globalThis);
