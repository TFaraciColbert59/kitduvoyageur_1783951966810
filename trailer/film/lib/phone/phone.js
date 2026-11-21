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

  /* ---------- Compositeur canvas (film) ----------
   * Le plan dessine son image source sur un canvas avec SA caméra (et son flou de mouvement multi-échantillons).
   * On lui fournit à la place une image source déjà incrustée (espace 1920×1080 de l'image) : l'écran suit
   * donc la caméra au pixel près, sans calque séparé ni glissement.
   * opts : { base:<img>, plate:<img> (plaque percée recadrée), meta:{box,corners,radius,blur,ambient},
   *          states:[{img, from, to}] (images du plan ; fondu de l'état i sur [from,to]),
   *          level (luminosité de l'écran, 1 = défaut), tint (0..1, part de la teinte de scène),
   *          glare (0..1), cam:function(f)->{cx,cy} (reflet qui glisse), res (px d'écran rendus en largeur) }
   */
  function hom(c) {
    var src = [[0, 0], [1, 0], [1, 1], [0, 1]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = c[i][0], v = c[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve8(A, b);
    return function (x, y) {
      var w = h[6] * x + h[7] * y + 1;
      return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
    };
  }

  function ok(im) { return im && im.complete && im.naturalWidth > 0; }

  function compositor(o) {
    var m = o.meta, box = m.box, k = m.corners, H = hom(k);
    var W0 = 1920, H0 = 1080;
    var out = document.createElement('canvas'); out.width = W0; out.height = H0;
    var ox = out.getContext('2d');
    var sw = o.res || 540, sh = Math.round(sw * SH / SW);
    var scr = document.createElement('canvas'); scr.width = sw; scr.height = sh;
    var sx = scr.getContext('2d');
    var tmp = document.createElement('canvas'); tmp.width = box[2]; tmp.height = box[3];
    var tx = tmp.getContext('2d');
    var amb = m.ambient || { rgb: [1, 1, 1], luminance: 0.5 };
    var level = o.level == null ? 1 : o.level;
    var tintA = o.tint == null ? 0.28 : o.tint;
    var glareA = o.glare == null ? 0.5 : o.glare;
    // rayon des coins en coordonnées normalisées de l'écran (u sur la largeur, v sur la hauteur)
    var topLen = Math.hypot(k[1][0] - k[0][0], k[1][1] - k[0][1]);
    var sideLen = Math.hypot(k[3][0] - k[0][0], k[3][1] - k[0][1]);
    var ru = (m.radius || 0) / Math.max(1, topLen), rv = (m.radius || 0) / Math.max(1, sideLen);
    var outline = (function () {
      var pts = [], n = 10, i, a;
      function arc(cu, cv, a0) {
        for (i = 0; i <= n; i++) { a = a0 + (Math.PI / 2) * i / n; pts.push(H(cu + ru * Math.cos(a), cv + rv * Math.sin(a))); }
      }
      arc(1 - ru, rv, -Math.PI / 2); arc(1 - ru, 1 - rv, 0); arc(ru, 1 - rv, Math.PI / 2); arc(ru, rv, Math.PI);
      return pts;
    })();
    var cache = { f: null, n: -1 };

    function loadedCount() {
      var c = (ok(o.base) ? 1 : 0) + (ok(o.plate) ? 1 : 0);
      (o.states || []).forEach(function (s) { if (ok(s.img)) c++; });
      return c;
    }

    function drawScreen(f) {
      sx.globalCompositeOperation = 'source-over';
      sx.globalAlpha = 1;
      sx.fillStyle = '#FAF8F5';
      sx.fillRect(0, 0, sw, sh);
      (o.states || []).forEach(function (s, i) {
        if (!ok(s.img)) return;
        var p = i === 0 ? 1 : Math.max(0, Math.min(1, (f - s.from) / Math.max(1e-3, s.to - s.from)));
        p = p * p * (3 - 2 * p);
        if (p <= 0) return;
        sx.globalAlpha = p;
        var ih = s.img.naturalHeight * sw / s.img.naturalWidth;
        var dy = 0;
        if (s.scroll) {
          var q = Math.max(0, Math.min(1, (f - s.scroll.f0) / Math.max(1e-3, s.scroll.f1 - s.scroll.f0)));
          q = 1 - Math.pow(1 - q, 3);
          dy = -(s.scroll.from + (s.scroll.to - s.scroll.from) * q) * sw / SW;
        }
        sx.drawImage(s.img, 0, dy, sw, ih);
      });
      sx.globalAlpha = 1;
      // lumière de la scène : multiplication par la teinte ambiante
      if (tintA > 0) {
        sx.globalCompositeOperation = 'multiply';
        sx.globalAlpha = tintA;
        sx.fillStyle = 'rgb(' + amb.rgb.map(function (v) { return Math.round(255 * Math.min(1, 0.55 + 0.45 * v)); }).join(',') + ')';
        sx.fillRect(0, 0, sw, sh);
      }
      // reflet de vitre : bande diagonale qui glisse avec la caméra
      if (glareA > 0) {
        var c = o.cam ? o.cam(f) : { cx: 960, cy: 540 };
        var off = ((c.cx - 960) * 0.9 + (c.cy - 540) * 0.4) / 900;
        var g = sx.createLinearGradient(0, 0, sw, sh * 0.55);
        var mid = 0.5 + off;
        function st(p, a) { if (p > 0 && p < 1) g.addColorStop(p, 'rgba(255,255,255,' + a + ')'); }
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        st(mid - 0.14, 0); st(mid - 0.03, 0.12 * glareA); st(mid + 0.03, 0.04 * glareA); st(mid + 0.16, 0);
        sx.globalCompositeOperation = 'screen';
        sx.globalAlpha = 1;
        sx.fillStyle = g;
        sx.fillRect(0, 0, sw, sh);
      }
      sx.globalCompositeOperation = 'source-over';
    }

    function warp() {
      // écran normalisé -> quadrilatère, par triangles affines (grille fine), dans la boîte de la plaque
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.clearRect(0, 0, box[2], box[3]);
      tx.save();
      tx.beginPath();
      outline.forEach(function (p, i) { if (i) tx.lineTo(p[0] - box[0], p[1] - box[1]); else tx.moveTo(p[0] - box[0], p[1] - box[1]); });
      tx.closePath();
      tx.clip();
      var nu = 8, nv = 16, i, j;
      // passe grossière dessous (5×11, diagonale opposée, lignes décalées de la grille fine) : les joints
      // antialiasés de la grille fine retombent sur un contenu quasi identique au lieu du fond
      var cu = 5, cv = 11;
      for (j = 0; j < cv; j++) for (i = 0; i < cu; i++) {
        tri([i / cu, j / cv], [(i + 1) / cu, j / cv], [i / cu, (j + 1) / cv]);
        tri([(i + 1) / cu, j / cv], [(i + 1) / cu, (j + 1) / cv], [i / cu, (j + 1) / cv]);
      }
      for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
        var u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
        tri([u0, v0], [u1, v0], [u1, v1]);
        tri([u0, v0], [u1, v1], [u0, v1]);
      }
      tx.restore();
    }

    function tri(a, b, c) {
      var P = [H(a[0], a[1]), H(b[0], b[1]), H(c[0], c[1])].map(function (p) { return [p[0] - box[0], p[1] - box[1]]; });
      var S = [[a[0] * sw, a[1] * sh], [b[0] * sw, b[1] * sh], [c[0] * sw, c[1] * sh]];
      // triangle légèrement dilaté autour de son centre (pas de joint visible)
      var gx = (P[0][0] + P[1][0] + P[2][0]) / 3, gy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      tx.save();
      tx.beginPath();
      P.forEach(function (p, i) {
        var dx = p[0] - gx, dy = p[1] - gy, L = Math.hypot(dx, dy) || 1, e = (L + 0.9) / L;
        if (i) tx.lineTo(gx + dx * e, gy + dy * e); else tx.moveTo(gx + dx * e, gy + dy * e);
      });
      tx.closePath();
      tx.clip();
      // affine S -> P
      var x0 = S[0][0], y0 = S[0][1], x1 = S[1][0], y1 = S[1][1], x2 = S[2][0], y2 = S[2][1];
      var det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      var a11 = ((P[1][0] - P[0][0]) * (y2 - y0) - (P[2][0] - P[0][0]) * (y1 - y0)) / det;
      var a12 = ((P[2][0] - P[0][0]) * (x1 - x0) - (P[1][0] - P[0][0]) * (x2 - x0)) / det;
      var a21 = ((P[1][1] - P[0][1]) * (y2 - y0) - (P[2][1] - P[0][1]) * (y1 - y0)) / det;
      var a22 = ((P[2][1] - P[0][1]) * (x1 - x0) - (P[1][1] - P[0][1]) * (x2 - x0)) / det;
      var b1 = P[0][0] - a11 * x0 - a12 * y0, b2 = P[0][1] - a21 * x0 - a22 * y0;
      tx.setTransform(a11, a21, a12, a22, b1, b2);
      tx.drawImage(scr, 0, 0);
      tx.restore();
    }

    function frame(f) {
      var n = loadedCount();
      if (cache.f === f && cache.n === n) return out;
      cache.f = f; cache.n = n;
      ox.setTransform(1, 0, 0, 1, 0, 0);
      ox.globalAlpha = 1;
      ox.filter = 'none';
      if (!ok(o.base)) { ox.fillStyle = '#0B1F17'; ox.fillRect(0, 0, W0, H0); return out; }
      ox.drawImage(o.base, 0, 0, W0, H0);
      if (!ok(o.plate)) return out; // plaque absente : image d'origine, jamais d'écran inventé
      drawScreen(f);
      warp();
      ox.fillStyle = '#0a0b0c'; // vitre éteinte sous les bords percés
      ox.fillRect(box[0], box[1], box[2], box[3]);
      var bright = level * (0.86 + 0.16 * Math.min(1, amb.luminance * 1.6));
      ox.filter = 'blur(' + Math.max(0, m.blur || 0).toFixed(2) + 'px) brightness(' + bright.toFixed(3) + ')';
      ox.drawImage(tmp, box[0], box[1]);
      ox.filter = 'none';
      ox.drawImage(o.plate, box[0], box[1], box[2], box[3]);
      return out;
    }

    return { frame: frame, canvas: out };
  }

  window.LKDVPhone = { matrix3d: matrix3d, render: render, setup: setup, compositor: compositor };
})();
