/* LKDV — utilitaires communs à toutes les scènes du trailer (chargé une fois par index.html).
   Rien ici ne lit l'horloge réelle ni Math.random : tout est fonction du temps de la timeline. */
(function () {
  "use strict";
  var SEED = 1783;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Hachage déterministe d'un entier vers [0,1) : pour les particules indexées. */
  function hash(i, salt) {
    var x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt | 0) + SEED, 0xc2b2ae35);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  /* Format : la scène lit la taille de sa racine. Vertical = 1080×1920 recomposé (P6). */
  function format(root) {
    /* La taille fait foi sur la racine de la scène (data-width / data-height de son <template>) :
       HyperFrames dimensionne chaque scène d'après ces attributs. La version 9:16 (P6) est produite par
       tools/make-vertical.mjs, qui recopie les scènes avec 1080 × 1920 : la scène doit donc tout calculer
       depuis LKDV.format(root), jamais depuis 1920 ou 1080 écrits en dur. */
    var w = Number(root && root.getAttribute("data-width")) || 1920;
    var h = Number(root && root.getAttribute("data-height")) || 1080;
    var vertical = h > w;
    return {
      W: w, H: h, vertical: vertical,
      /* Colonne sûre de l'interface : 608×1080 centrée en 16:9 ; en 9:16 la même colonne est mise à l'échelle 1080/608. */
      column: vertical ? { x: 0, y: 0, w: 1080, h: 1920, scale: 1080 / 608 } : { x: 656, y: 0, w: 608, h: 1080, scale: 1 },
      /* Bande utile en vertical (interfaces des plateformes) : rien d'essentiel au-dessus de 168 px ni sous 1330 px. */
      band: vertical ? { top: 168, bottom: 1330 } : { top: 54, bottom: 1026 },
    };
  }
  /* Spring fermé (amortissement zeta, pulsation w) : valeur 0→1 en fonction de t, rendable image par image. */
  function spring(t, zeta, w) {
    if (t <= 0) return 0;
    zeta = zeta == null ? 0.8 : zeta; w = w == null ? 28 : w;
    if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    var wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
  }
  window.LKDV = {
    SEED: SEED, FPS: 60, BPM: 120, BEAT: 0.5, DURATION: 60,
    rng: function (salt) { return mulberry32(SEED + (salt | 0)); },
    hash: hash, format: format, spring: spring,
    beat: function (i) { return i * 0.5; },
    /* Temps absolu du film → temps local d'une scène dont l'hôte démarre à `start`. */
    local: function (abs, start) { return abs - start; },
    /* Boîte des montagnes du logo (logo-mark.svg, viewBox 0 0 32 32) à 0:52, en 16:9 et en 9:16. */
    LOGO_MARK: { h: { cx: 960, cy: 520, w: 420 }, v: { cx: 540, cy: 760, w: 420 } },
    /* Tracés exacts de public/assets/logo-mark.svg */
    LOGO_PATHS: { ridge: "M2 24 L10 10 L14 16 L20 6 L30 24 Z", base: "M2 24 L30 24", sun: { cx: 24, cy: 9, r: 1.6 } },
  };
})();
