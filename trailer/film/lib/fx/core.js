/* LKDV trailer — lib/fx/core.js
 * Socle commun des effets : palette, aléatoire à graine, bruit, courbes, horloge de scène.
 * Aucune horloge réelle, aucun Math.random() : tout ce qui se dessine dépend du temps de la scène.
 * Chargé par <script src="lib/fx/core.js"> ; utilisable aussi sous Node (tests) via globalThis.
 */
(function (root) {
  "use strict";
  var FX = (root.LKDVFX = root.LKDVFX || {});
  if (FX.__core) return;
  FX.__core = true;

  FX.FPS = 60;
  FX.W = 1920;
  FX.H = 1080;

  /* Palette du film (CONVENTIONS.md). Encre jamais noir pur, crème pour les pointes. */
  FX.RGB = {
    ink: [11, 31, 23], // #0B1F17 encre verte
    inkDeep: [8, 24, 18],
    forest: [23, 64, 44], // #17402C
    sage: [91, 127, 85], // #5B7F55
    sageLight: [143, 174, 134],
    sagePale: [201, 216, 194],
    stone: [250, 248, 245], // #FAF8F5 crème
  };
  FX.rgba = function (c, a) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a == null ? 1 : a) + ")";
  };
  FX.mixRGB = function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  /* Aléatoire à graine. */
  FX.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  FX.hash2 = function (x, y, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /* Bruit de valeur 2D lissé et fBm. */
  FX.noise2 = function (x, y, seed) {
    var xi = Math.floor(x),
      yi = Math.floor(y);
    var xf = x - xi,
      yf = y - yi;
    var u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    var a = FX.hash2(xi, yi, seed),
      b = FX.hash2(xi + 1, yi, seed),
      c = FX.hash2(xi, yi + 1, seed),
      d = FX.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  FX.fbm = function (x, y, octaves, seed) {
    var s = 0,
      amp = 0.5,
      f = 1,
      n = 0;
    for (var i = 0; i < octaves; i++) {
      s += amp * FX.noise2(x * f, y * f, seed + i * 101);
      n += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / n;
  };

  /* Courbes. */
  FX.clamp = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };
  FX.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  FX.smooth = function (a, b, v) {
    var t = FX.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  FX.ramp = function (a, b, v) {
    return FX.clamp((v - a) / (b - a), 0, 1);
  };
  FX.ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inExpo: function (t) { return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); },
  };

  /* Canevas hors écran (navigateur). */
  FX.canvas = function (w, h) {
    var c = root.document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  /* Flou de zoom (radial) : empile des copies agrandies autour d'une origine.
   * amount = agrandissement de la copie la plus grande (0,08 = 8 %). Coût : `samples` drawImage plein cadre. */
  FX.zoomBlur = function (ctx, src, ox, oy, amount, samples, w, h) {
    w = w || ctx.canvas.width;
    h = h || ctx.canvas.height;
    samples = samples || 8;
    if (amount <= 0.0005) {
      ctx.drawImage(src, 0, 0, w, h);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(src, 0, 0, w, h);
    for (var i = 1; i < samples; i++) {
      var k = 1 + (amount * i) / (samples - 1);
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(src, ox - ox * k, oy - oy * k, w * k, h * k);
    }
    ctx.restore();
  };

  /* Caméra prolongée avant l'image 0 (CORRECTIONS-4, « image flash ») : les caméras des plans bornent leurs
   * courbes à f >= 0 (clamp), si bien que les sous-poses du filé de l'image 0 (f - shutter < 0) retombaient
   * toutes sur la pose de l'image 0 : image nette, alors que l'image 1, à pleine vitesse d'entrée, était filée.
   * Ici, pour f < 0, la caméra continue en ligne droite à la vitesse de l'entrée (pente entre f = 0 et f = 1),
   * comme si le mouvement venait du plan précédent. Champs numériques extrapolés, autres recopiés ; échelle
   * gardée au-dessus de la couverture du cadre, puis recadrage par `fit` du plan s'il est fourni. */
  FX.pastCam = function (camAt, fit) {
    if (camAt.__past) return camAt;
    var c0 = null, c1 = null;
    var g = function (f) {
      if (f >= 0) return camAt(f);
      if (!c0) { c0 = camAt(0); c1 = camAt(1); }
      var c = {};
      for (var k in c0) {
        if (typeof c0[k] === "number" && typeof c1[k] === "number") c[k] = c0[k] + (c1[k] - c0[k]) * f;
        else c[k] = c0[k];
      }
      if (typeof c.S === "number") {
        var r = Math.abs(c.rot || 0), co = Math.cos(r), si = Math.sin(r);
        var smin = Math.max(co + si * (FX.H / FX.W), co + si * (FX.W / FX.H)) + 0.004;
        // La caméra d'entrée part souvent au bord de l'image (le `fit` du plan la bloque) : plutôt que de laisser
        // `fit` annuler le mouvement prolongé, on resserre un peu la sous-pose (≤ 8 %) pour qu'elle couvre le cadre.
        // Seulement si l'entrée est surtout un glissé : pour une entrée en zoom, resserrer inverserait le zoom.
        var zoomPx = Math.abs(c.S - c0.S) * 1100, slidePx = (Math.abs(c.cx - c0.cx) + Math.abs(c.cy - c0.cy)) * c0.S;
        if (typeof c.cx === "number" && typeof c.cy === "number" && slidePx > zoomPx) {
          var mx = Math.min(c.cx, FX.W - c.cx) - 2, my = Math.min(c.cy, FX.H - c.cy) - 2;
          if (mx > 1) smin = Math.max(smin, (FX.W / 2 * co + FX.H / 2 * si) / mx);
          if (my > 1) smin = Math.max(smin, (FX.W / 2 * si + FX.H / 2 * co) / my);
          smin = Math.min(smin, c0.S * 1.08);
        }
        if (c.S < smin) c.S = smin;
      }
      return fit ? fit(c) : c;
    };
    g.__past = true;
    return g;
  };

  /* Horloge de scène : le temps local vient de la timeline GSAP de la scène (seekée par le runtime),
   * relu aussi à chaque `hf-seek`. render(t, frame) n'est appelé que si l'image change.
   * Retourne { tl, redraw } ; la timeline est enregistrée dans window.__timelines[id]. */
  FX.bindClock = function (id, frames, render) {
    var duration = frames / FX.FPS;
    var tl = root.gsap.timeline({ paused: true });
    var st = { t: 0 };
    var last = -1;
    function draw(force) {
      var f = Math.round(tl.time() * FX.FPS);
      if (f < 0) f = 0;
      if (f > frames - 1) f = frames - 1;
      if (f === last && !force) return;
      last = f;
      render(f / FX.FPS, f);
    }
    tl.to(st, { t: duration, duration: duration, ease: "none", onUpdate: function () { draw(false); } }, 0);
    root.addEventListener("hf-seek", function () { draw(false); });
    draw(true);
    return { tl: tl, redraw: function () { draw(true); } };
  };
})(typeof window !== "undefined" ? window : globalThis);
