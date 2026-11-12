/* LKDV trailer — lib/fx/finale.js
 * Rendu commun de P53 et P54 sur la plaque réelle img39 : tracés sauge + logo. Une seule fonction render(F)
 * sur la séquence F = 0 … 223 (P53 = 0 … 103, P54 = 104 … 223) : la coupe P53→P54 est continue par construction.
 * Dépend de core.js, img39-lights.js, traces.js. La plaque (Image chargée) est passée à create().
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.Finale) return;
  var T = FX.Traces;

  /* Recul de P54 (zoom arrière de 5,5 %). */
  function reculFor(F) {
    return 1 - 0.055 * FX.ease.outCubic(FX.ramp(T.NET_FRAME, T.TOTAL_FRAMES - 1, F));
  }
  /* Sortie : tenue pleine, puis la même durée que le fondu musical (48 images, 3552–3599) ; courbe 1 − u³,
   * qui garde le logo à ≥ 0,87 jusqu'à l'image 3575 et finit sur l'encre à 3599. */
  function outFor(F) {
    var u = FX.ramp(T.TOTAL_FRAMES - 48, T.TOTAL_FRAMES - 1, F);
    return 1 - u * u * u;
  }

  /* Dessine la plaque img39 telle qu'elle apparaît à l'image F (poussée P53). Partagé avec la fin de P52. */
  function drawPlate(ctx, img, F) {
    var k = T.pushFor(F);
    var W = 1920,
      H = 1080;
    var sc = Math.max(W / img.width, H / img.height) * k;
    var dw = img.width * sc,
      dh = img.height * sc;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  var THREAD = [124, 166, 112]; // sauge #5B7F55 éclairci, saturation 0,33
  var CREAM = FX.RGB.stone; // #FAF8F5

  function create(canvas, plate, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var W = canvas.width,
      H = canvas.height;
    var sim = T.build({ count: opts.count || 2200, seed: 5354 });
    var thr = FX.canvas(W, H),
      tctx = thr.getContext("2d");
    var glow = FX.canvas(W / 4, H / 4),
      gctx = glow.getContext("2d");
    var buf = null;

    function setRecul(c, k) {
      c.setTransform(k, 0, 0, k, (W / 2) * (1 - k), (H / 2) * (1 - k));
    }

    function render(F) {
      var NET = T.NET_FRAME;
      var k = reculFor(F),
        out = outFor(F);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.fillStyle = FX.rgba(FX.RGB.ink, 1);
      ctx.fillRect(0, 0, W, H);
      setRecul(ctx, k);
      drawPlate(ctx, plate, F);
      // La plaque s'assombrit un peu sous les tracés (le logo doit dominer), puis sort avec la musique.
      var dim = 0.35 * FX.smooth(60, NET, F) + 0.65 * (1 - out);
      if (dim > 0.001) {
        ctx.fillStyle = FX.rgba(FX.RGB.ink, dim);
        ctx.fillRect(-W, -H, 3 * W, 3 * H);
      }

      // Tracés : dessinés en recouvrement (pas en addition) → jamais plus clairs que le sauge choisi.
      buf = T.frame(sim, F, buf);
      var pos = buf.pos,
        N = sim.N,
        M = sim.M;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, W, H);
      setRecul(tctx, k);
      tctx.lineJoin = "round";
      tctx.lineCap = "round";
      var NB = 5,
        paths = [],
        heads = [];
      for (var b = 0; b < NB; b++) paths.push([]);
      for (var n = 0; n < N; n++) {
        var rev = buf.rev[n];
        if (rev <= 0) continue;
        var e = buf.e[n];
        var a = (0.85 - 0.6 * e) * sim.P.bright[n] * Math.min(1, rev * 3);
        paths[Math.min(NB - 1, Math.floor(a * NB))].push(n);
        if (e > 0.02 && e < 0.98) heads.push(n); // pointes crème sur les tracés en mouvement
        else if (e <= 0.02 && rev < 1) heads.push(n); // et sur ceux qui s'allument
      }
      tctx.lineWidth = 1.3;
      for (var bb = 0; bb < NB; bb++) {
        var list = paths[bb];
        if (!list.length) continue;
        tctx.strokeStyle = FX.rgba(THREAD, ((bb + 0.5) / NB).toFixed(3));
        tctx.beginPath();
        for (var li = 0; li < list.length; li++) {
          var nn = list[li];
          var upto = buf.rev[nn] * (M - 1),
            full = Math.floor(upto),
            base = nn * M * 2;
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
      tctx.fillStyle = FX.rgba(CREAM, 0.9);
      for (var h = 0; h < heads.length; h++) {
        var nh = heads[h];
        var idx = Math.min(M - 1, Math.round(buf.rev[nh] * (M - 1)));
        tctx.fillRect(pos[(nh * M + idx) * 2] - 1, pos[(nh * M + idx) * 2 + 1] - 1, 2, 2);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Halo doux (écran, basse résolution) puis les fils, en « screen » : pas de blanc brûlé.
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.drawImage(thr, 0, 0, glow.width, glow.height);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.55 * out;
      ctx.filter = "blur(6px)";
      ctx.drawImage(glow, 0, 0, W, H);
      var sb = T.softBlur(F);
      ctx.filter = sb > 0.05 ? "blur(" + sb.toFixed(2) + "px)" : "none";
      ctx.globalAlpha = (F >= NET ? 0.6 : 1) * out;
      ctx.drawImage(thr, 0, 0);
      ctx.filter = "none";

      if (F >= NET) {
        // Éclair d'impact (sous le logo, hors de son trait).
        var impact = Math.exp(-(F - NET) / 7);
        if (impact > 0.01) {
          var rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
          rg.addColorStop(0, FX.rgba(CREAM, 0.22 * impact));
          rg.addColorStop(1, FX.rgba(FX.RGB.sage, 0));
          ctx.globalAlpha = 1;
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, W, H);
        }
        // Le logo net, en crème exacte, posé en dernier.
        ctx.globalCompositeOperation = "source-over";
        T.drawLogo(ctx, FX.rgba(CREAM, 1), out, k, 1);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    return { render: render, sim: sim };
  }

  FX.Finale = { create: create, reculFor: reculFor, outFor: outFor, drawPlate: drawPlate };
})(typeof window !== "undefined" ? window : globalThis);
