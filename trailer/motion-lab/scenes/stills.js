/* LKDV trailer — motion-lab/scenes/stills.js
 * Images clés des propositions (une image du film + l'idée posée dessus). Coordonnées relevées sur l'image
 * indiquée, à 1920×1080. Les états intermédiaires (k) montrent l'idée à son moment le plus lisible.
 */
(function () {
  "use strict";
  var M = LKDVM;
  var FR = function (n) {
    return "frames/f" + String(n).padStart(4, "0") + ".png";
  };
  function plate(ctx, im) {
    ctx.drawImage(im, 0, 0, M.W, M.H);
  }
  function still(name, frameNo, drawFn, extra) {
    M.scenes[name] = {
      images: function (n, p) {
        var o = { a: FR(p.frame || frameNo) };
        if (extra) for (var k in extra) o[k] = extra[k];
        return o;
      },
      draw: function (ctx, n, im, p) {
        plate(ctx, im.a);
        drawFn(ctx, im, p);
      },
    };
  }
  /* Petit texte de planche (hors film), en haut à gauche, pour les images en deux volets. */
  function caption(ctx, x, y, txt) {
    ctx.save();
    ctx.font = "600 14px Inter";
    try {
      ctx.letterSpacing = "3px";
    } catch (e) {}
    ctx.fillStyle = M.rgba(M.STONE, 0.75);
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  /* 01 — Le fil */
  // Soleil (image 36) : l'étincelle part du cœur et suit une orbite qui s'ouvre (spirale dans le plan incliné de la galaxie).
  function spiral(c, a0, a1, r0, r1, tilt, squash, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var a = a0 + (a1 - a0) * t;
      var r = r0 * Math.pow(r1 / r0, t);
      var x = r * Math.cos(a),
        y = r * Math.sin(a) * squash;
      pts.push([c[0] + x * Math.cos(tilt) - y * Math.sin(tilt), c[1] + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    return pts;
  }
  M.spiral = spiral;
  still("idee-01-fil-soleil", 36, function (ctx) {
    // du cœur vers la tête du trait bleu existant de l'ouverture (1490, 685), qui file ensuite vers la Terre
    var pts = [[968, 540], [1040, 580], [1150, 630], [1280, 668], [1400, 686], [1478, 688]];
    M.trace(ctx, M.spline(pts, 2), 0.0, 1, { head: true, fade: 380, headR: 4 });
  });
  still("idee-01-fil-seceda", 600, function (ctx) {
    M.trace(ctx, M.spline(M.GEO.seceda600.ahead, 2), 0, 1, { head: true, fade: 140 });
  });
  still("idee-01-fil-tofana", 905, function (ctx) {
    M.trace(ctx, M.spline(M.GEO.p38ref905.devant, 2), 0, 1, { head: true, fade: 90 });
  });
  // P42 (image 1010), épingle vue du ciel : axe de la route devant la cycliste, relevé au 1/1,5.
  // axe calculé (motion-lab/work/centerline.py, crête de la carte de distance du gravier) puis lissé à la main ; la cycliste
  // roule vers le haut du cadre (roue avant en haut à droite), le fil part de sa roue avant.
  var LACETS = [[1100, 528], [1106, 470], [1082, 412], [1034, 376], [966, 342], [905, 302], [840, 266], [760, 260], [690, 256], [628, 240], [566, 213], [505, 182], [458, 142], [428, 88], [408, 20]];
  M.GEO.p42ref1010 = { lacets: LACETS };
  still("idee-01-fil-epingle", 1010, function (ctx) {
    M.trace(ctx, M.spline(LACETS, 2), 0, 0.86, { head: true, fade: 110, width: 2.75, shadow: 0.45 });
  });

  /* 02 — Le point qui vit : Sorapis (image 735), une onde au sol autour des pieds de Léa, puis le fil part. */
  still("idee-02-point-sorapis", 735, function (ctx, im, p) {
    // le « ping » de position (comme le point GPS de l'app) : un point posé à ses pieds, un anneau qui s'ouvre une fois
    var c = [1090, 990];
    var k = p.k === undefined ? 0.4 : p.k;
    M.dot(ctx, c, 3.2, 1);
    M.ring(ctx, c, k, { r0: 8, r1: 46, width: 1.5 });
    // l'anneau passe DERRIÈRE Léa : on repose ses pixels sombres (silhouette) par-dessus
    occlude(ctx, im.a, [1050, 820, 90, 178], 95);
  });
  function occlude(ctx, img, box, lumMax) {
    var c = M.canvas(box[2], box[3]),
      o = c.getContext("2d");
    o.drawImage(img, box[0], box[1], box[2], box[3], 0, 0, box[2], box[3]);
    var d = o.getImageData(0, 0, box[2], box[3]);
    for (var i = 0; i < d.data.length; i += 4) {
      var l = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
      d.data[i + 3] = l < lumMax ? 255 : l < lumMax + 25 ? Math.round(255 * (1 - (l - lumMax) / 25)) : 0;
    }
    o.putImageData(d, 0, 0);
    ctx.drawImage(c, box[0], box[1]);
  }
  M.occlude = occlude;

  /* 03 — Le cadre qui s'ouvre : deux volets (P25 dernière image en 2,39:1 | P26 première image ouverte). */
  M.scenes["idee-03-cadre"] = {
    images: function () {
      return { a: FR(588), b: FR(589) };
    },
    draw: function (ctx, n, im) {
      ctx.fillStyle = "#0B1F17";
      ctx.fillRect(0, 0, M.W, M.H);
      var w = 900,
        h = 506.25,
        y = 290,
        g = 40;
      var off = M.canvas(),
        o = off.getContext("2d");
      o.drawImage(im.a, 0, 0);
      M.letterbox(o, 1);
      ctx.drawImage(off, 0, 0, M.W, M.H, (M.W - 2 * w - g) / 2, y, w, h);
      ctx.drawImage(im.b, 0, 0, M.W, M.H, (M.W - 2 * w - g) / 2 + w + g, y, w, h);
      caption(ctx, (M.W - 2 * w - g) / 2, y - 22, "IMAGE 588 · FIN DE P25 · 2,39:1");
      caption(ctx, (M.W - 2 * w - g) / 2 + w + g, y - 22, "IMAGE 589 · DROP · P26 S'OUVRE EN 16:9 (8 IMAGES)");
    },
  };

  /* 04 — L'iris : image tirée de l'essai 2 (rendu de la scène essai-2). */
  M.scenes["png"] = {
    images: function (n, p) {
      return { a: p.src };
    },
    draw: function (ctx, n, im) {
      plate(ctx, im.a);
    },
  };

  /* 05 — Les courbes de niveau : Tre Cime (image 650), autour du sommet que le groupe gravit. */
  still("idee-05-courbes-tre-cime", 650, function (ctx, im, p) {
    M.contours(
      ctx,
      { c: [1062, 690], r0: 26, dr: 31, n: 10, squash: 0.52, rot: -0.32, seed: 1.7, phase: -2.2, reveal: p.reveal === undefined ? 1 : p.reveal, alpha: 0.4, width: 1.2 },
      function (c) {
        // uniquement sur le relief du premier plan (sous la ligne d'horizon du sommet), pas sur le ciel ni les Tre Cime
        c.beginPath();
        // silhouette du rocher du premier plan (relevée sur l'image 650) : sentier à gauche, sommet, versant droit
        c.moveTo(380, 1080);
        c.lineTo(520, 900);
        c.lineTo(700, 805);
        c.lineTo(880, 728);
        c.lineTo(1000, 668);
        c.lineTo(1060, 648);
        c.lineTo(1110, 652);
        c.lineTo(1170, 700);
        c.lineTo(1235, 780);
        c.lineTo(1310, 860);
        c.lineTo(1400, 960);
        c.lineTo(1460, 1080);
        c.closePath();
        c.clip();
      }
    );
  });

  /* 06 — La constellation : bivouac (image 1240). Cinq étoiles RÉELLES de l'image (écart ≤ 7 px à la géométrie exacte du
   * logo à l'échelle 15, centre 1168/288 ; recherche dans motion-lab/work) dessinent le logo dans le ciel ; une sixième est
   * son soleil. Annonce discrète de la fin, sans un mot. */
  var STARS = [[964, 423], [1072, 215], [1135, 302], [1228, 161], [1376, 427], [964, 423]];
  var STAR_SUN = [1294, 191];
  M.scenes["idee-06-constellation"] = {
    images: function () {
      return { a: FR(1240) };
    },
    draw: function (ctx, n, im) {
      plate(ctx, im.a);
      M.glow(
        ctx,
        function (c) {
          c.lineWidth = 1.25;
          for (var i = 0; i < STARS.length - 1; i++) {
            var a = STARS[i],
              b = STARS[i + 1];
            var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            var ux = (b[0] - a[0]) / d,
              uy = (b[1] - a[1]) / d,
              gap = 9;
            c.beginPath();
            c.moveTo(a[0] + ux * gap, a[1] + uy * gap);
            c.lineTo(b[0] - ux * gap, b[1] - uy * gap);
            c.stroke();
          }
          STARS.concat([STAR_SUN]).forEach(function (s) {
            c.beginPath();
            c.arc(s[0], s[1], 2.4, 0, Math.PI * 2);
            c.fill();
          });
          c.lineWidth = 1.2;
          c.beginPath();
          c.arc(STAR_SUN[0], STAR_SUN[1], 7, 0, Math.PI * 2);
          c.stroke();
        },
        { alpha: 0.7, halo: 0.6, shadow: 0 }
      );
    },
  };

  /* 07 — La donnée juste : Tre Cime (image 650), D+ 172 m (capture E08). */
  still("idee-07-donnee-tre-cime", 650, function (ctx) {
    M.datum(ctx, { anchor: [884, 729], at: [1150, 560], label: "D+", value: "172 m", k: 1 });
  });

  /* 08 — Le total qui fond, faute de montant réel : le poids sur le dos (capture E05b : 2,8 kg). */
  still("idee-08-poids-lit", 405, function (ctx, im, p) {
    M.glow(
      ctx,
      function (c) {
        c.textBaseline = "alphabetic";
        c.textAlign = "left";
        c.font = "600 15px Inter";
        try {
          c.letterSpacing = "3px";
        } catch (e) {}
        c.globalAlpha = 0.8;
        c.fillText("SUR LE DOS", 1414, 742);
        c.font = "200 128px Inter";
        try {
          c.letterSpacing = "-2px";
        } catch (e) {}
        c.globalAlpha = 1;
        c.fillText("2,8 kg", 1404, 868);
      },
      { alpha: 1, halo: 0.25, haloBlur: 10, shadow: 0.55, shadowBlur: 8, shadowDy: 2 }
    );
  });

  /* 09 — Quatre verbes : Georgia italique, petit, bas du cadre, centré. */
  function verb(ctx, word) {
    M.glow(
      ctx,
      function (c) {
        // en bas à gauche, dans la zone titre (10 % du cadre) : le centre bas est souvent occupé (feu, mains, téléphone)
        c.textAlign = "left";
        c.textBaseline = "alphabetic";
        c.font = "italic 40px Georgia";
        c.fillText(word, 192, M.H - 108);
      },
      { alpha: 0.95, halo: 0.3, haloBlur: 8, shadow: 0.6, shadowBlur: 6, shadowDy: 2 }
    );
  }
  still("idee-09-verbes-rever", 160, function (ctx) {
    verb(ctx, "Rêver");
  });
  still("idee-09-verbes-raconter", 1155, function (ctx) {
    verb(ctx, "Raconter");
  });

  /* 10 — Le logo : géométrie et placement du logo de p54 (film/lib/fx/traces.js : PLACE, LOGO). */
  var PL = { cx: 960, cy: 540, ux: 16, uy: 15, s: 21 };
  function L(p) {
    return [PL.cx + (p[0] - PL.ux) * PL.s, PL.cy + (p[1] - PL.uy) * PL.s];
  }
  var RIDGE = [[2, 24], [10, 10], [14, 16], [20, 6], [30, 24]].map(L);
  var SUN = L([24, 9]);
  // le fil unique du film arrive par la gauche et devient la ligne de crête du logo, pendant que les tracés convergent
  still("idee-10-logo-crete", 1378, function (ctx, im, p) {
    var u = p.u === undefined ? 0.68 : p.u;
    // seule la crête du logo (2,24 → 10,10 → 14,16 → 20,6 → 30,24), en polyligne nette : les angles du logo sont vifs
    var sp = { p: [RIDGE[0]], s: [0], L: 0 };
    for (var i = 1; i < RIDGE.length; i++) {
      var a = RIDGE[i - 1],
        b = RIDGE[i];
      var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var m = Math.ceil(d / 2);
      for (var k = 1; k <= m; k++) sp.p.push([a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
    }
    for (var j = 1; j < sp.p.length; j++) sp.s.push(sp.s[j - 1] + Math.hypot(sp.p[j][0] - sp.p[j - 1][0], sp.p[j][1] - sp.p[j - 1][1]));
    sp.L = sp.s[sp.s.length - 1];
    M.trace(ctx, sp, 0.0, u, { head: true, fade: 260, width: 3, headR: 4.5 });
  });
  // variante C : la ligne de signature sous le logo posé (image 1420)
  still("idee-10-logo-signature", 1420, function (ctx) {
    M.glow(
      ctx,
      function (c) {
        c.textAlign = "center";
        c.font = "600 22px Inter";
        try {
          c.letterSpacing = "9px";
        } catch (e) {}
        c.fillText("LE KIT DU VOYAGEUR", M.W / 2 + 4.5, 820);
      },
      { alpha: 0.9, halo: 0.3, shadow: 0 }
    );
  });

  /* 11 — La carte qui annonce (mon idée) : P13 (image 345), l'itinéraire se trace sur la carte papier, flou comme elle. */
  still("idee-11-carte", 345, function (ctx) {
    var route = [[1418, 300], [1470, 318], [1512, 352], [1560, 372], [1606, 396], [1640, 440], [1690, 462], [1742, 500]];
    var off = M.canvas(),
      o = off.getContext("2d");
    M.trace(o, M.spline(route, 2), 0, 1, { head: true, fade: 60, width: 2.4, shadow: 0.25 });
    ctx.save();
    ctx.filter = "blur(1.6px)";
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  });

  /* 12 — Le point du Soleil (mon idée) : l'étincelle de l'image 32 est le point du logo. Deux volets. */
  M.scenes["idee-12-point-soleil"] = {
    images: function () {
      return { a: FR(36), b: FR(1420) };
    },
    draw: function (ctx, n, im) {
      ctx.fillStyle = "#0B1F17";
      ctx.fillRect(0, 0, M.W, M.H);
      var w = 900,
        h = 506.25,
        y = 290,
        g = 40,
        x0 = (M.W - 2 * w - g) / 2;
      var off = M.canvas(),
        o = off.getContext("2d");
      o.drawImage(im.a, 0, 0);
      M.dot(o, [962, 538], 5, 1);
      M.ring(o, [962, 538], 0.35, { r0: 10, r1: 40, width: 2 });
      ctx.drawImage(off, 0, 0, M.W, M.H, x0, y, w, h);
      var off2 = M.canvas(),
        o2 = off2.getContext("2d");
      o2.drawImage(im.b, 0, 0);
      M.ring(o2, SUN, 0.35, { r0: 40, r1: 90, width: 2 });
      ctx.drawImage(off2, 0, 0, M.W, M.H, x0 + w + g, y, w, h);
      caption(ctx, x0, y - 22, "IMAGE 36 · LE SOLEIL VIENT DE S'ALLUMER : UN POINT");
      caption(ctx, x0 + w + g, y - 22, "IMAGE 1420 · LE MÊME POINT SE POSE EN DERNIER : LE SOLEIL DU LOGO");
    },
  };
})();
