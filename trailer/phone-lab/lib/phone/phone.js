/* LKDV — incrustation d'un écran de téléphone derrière une plaque percée.
 *
 * Structure attendue (dans la caméra du plan, pour suivre poussée et roulis) :
 *   <div class="ph-cam">                     calque animé par le plan (transform)
 *     <div class="ph-screen" data-phone='{…}'>  écran 1290×2796, homographie vers les 4 coins
 *       <img class="ph-layer" …>             états successifs (opacité) ou capture haute (défilement)
 *       <div class="ph-tint"></div>          lumière de la scène (multiplication)
 *       <div class="ph-glare"></div>         reflet de vitre, glisse avec la caméra
 *     </div>
 *     <img class="ph-plate" src="…keyed.png"> plaque percée PAR-DESSUS : doigts devant
 *   </div>
 *
 * data-phone : { corners:[[x,y]×4] TL,TR,BR,BL en px plaque, radius (px plaque),
 *                blur (sigma px plaque), ambient:{rgb:[r,g,b] 0..1, luminance} }
 * Tout est fonction du temps : LKDVPhone.render(el, t, cam) est appelé depuis le onUpdate
 * d'une interpolation GSAP du plan ; aucune horloge, aucun réseau.
 */
(function () {
  var SW = 1290, SH = 2796;

  function solve8(A, b) {
    // élimination de Gauss avec pivot partiel, 8×8
    var n = 8, i, j, k;
    for (i = 0; i < n; i++) A[i] = A[i].concat([b[i]]);
    for (i = 0; i < n; i++) {
      var p = i;
      for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
      var tmp = A[i]; A[i] = A[p]; A[p] = tmp;
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k <= n; k++) A[j][k] -= f * A[i][k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = A[i][n];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /** Homographie rectangle 1290×2796 -> quadrilatère, en matrix3d CSS. */
  function matrix3d(c) {
    var src = [[0, 0], [SW, 0], [SW, SH], [0, SH]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = c[i][0], v = c[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve8(A, b);
    return 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(',') + ')';
  }

  function cfg(el) {
    if (!el.__ph) el.__ph = JSON.parse(el.getAttribute('data-phone'));
    return el.__ph;
  }

  function setup(el) {
    var c = cfg(el), k = c.corners;
    var topLen = Math.hypot(k[1][0] - k[0][0], k[1][1] - k[0][1]);
    var scale = topLen / SW; // px plaque par px d'écran (sur le bord haut)
    c._scale = scale;
    el.style.width = SW + 'px';
    el.style.height = SH + 'px';
    el.style.transformOrigin = '0 0';
    el.style.transform = matrix3d(k);
    el.style.borderRadius = ((c.radius || 0) / scale).toFixed(1) + 'px';
    var tint = el.querySelector('.ph-tint');
    if (tint && c.ambient) {
      var a = c.ambient.rgb;
      tint.style.background = 'rgb(' + a.map(function (v) { return Math.round(255 * Math.min(1, 0.55 + 0.45 * v)); }).join(',') + ')';
    }
  }

  /**
   * t : temps local du plan (s). cam : { x, y, speed } déplacement de caméra (px) et vitesse (px/s)
   * states : [{ sel, from, to }] fondus d'états ; scroll : { sel, from, to, t0, t1 } défilement (px écran).
   */
  function render(el, t, cam, timing) {
    var c = cfg(el);
    if (c._scale == null) setup(el);
    cam = cam || { x: 0, y: 0, speed: 0 };
    timing = timing || {};
    // netteté de la plaque + flou de mouvement (vitesse du plan), convertis en px d'écran
    var sigma = Math.sqrt(Math.pow(c.blur || 0, 2) + Math.pow((cam.speed || 0) / 60 * 0.35, 2));
    var lum = c.ambient ? c.ambient.luminance : 0.5;
    var bright = (0.82 + 0.2 * Math.min(1, lum * 1.6)).toFixed(3);
    el.style.filter = 'blur(' + (sigma / c._scale).toFixed(2) + 'px) brightness(' + bright + ')';
    var glare = el.querySelector('.ph-glare');
    if (glare) glare.style.backgroundPosition = (50 + cam.x * 0.25).toFixed(1) + '% ' + (50 + cam.y * 0.1).toFixed(1) + '%';
    (timing.states || []).forEach(function (s) {
      var n = el.querySelector(s.sel);
      if (!n) return;
      var p = Math.max(0, Math.min(1, (t - s.from) / Math.max(1e-3, s.to - s.from)));
      n.style.opacity = (p * p * (3 - 2 * p)).toFixed(3);
    });
    if (timing.scroll) {
      var sc = timing.scroll, n2 = el.querySelector(sc.sel);
      if (n2) {
        var q = Math.max(0, Math.min(1, (t - sc.t0) / Math.max(1e-3, sc.t1 - sc.t0)));
        q = 1 - Math.pow(1 - q, 3); // le pouce ralentit
        n2.style.transform = 'translateY(' + (-(sc.from + (sc.to - sc.from) * q)).toFixed(1) + 'px)';
      }
    }
  }

  window.LKDVPhone = { matrix3d: matrix3d, render: render, setup: setup };
})();
