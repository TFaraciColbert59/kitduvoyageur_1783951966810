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
