/* b-orbit.js — équipe B (cosmos-vfx). Module 46,25 → 54,00 s.
   46,25 voile de nuages qui monte (alpha 0 → opaque à 47,0), traversée, sortie en orbite à 48,0 ;
   48,00 / 48,25 / 48,50 / 48,75 : traces du film (Islande, Karakoram, Lyon, Bourgogne) + pastilles L, N, T, C ;
   49,0 milliers de traces sage sur les terres, points ambre ; 50,0 respiration : le globe seul, lever de soleil
   sur le limbe ; 51,0–52,0 les traces quittent le globe et redessinent le tracé du logo, le Soleil devient le point ;
   52,0–52,25 tracé tenu, fondu à 52,5 ; Terre floutée jusqu'à 54,0 (transparent ensuite).
   draw() est une fonction pure de t (LKDV.hash, graine 1783). */
(function () {
  "use strict";
  var L = window.LKDV, E = null, U = null, D2R = Math.PI / 180;
  var SAGE, SAGEL, AMBER, PAPER, FOREST;

  /* Traces du film (lat, lon) */
  var K2 = [[35.680, 75.820], [35.690, 76.070], [35.730, 76.290], [35.740, 76.400], [35.745, 76.510], [35.800, 76.515], [35.850, 76.520], [35.880, 76.513]];
  var LYON = [[45.780, 4.845], [45.770, 4.838], [45.757, 4.836], [45.742, 4.835], [45.745, 4.851], [45.760, 4.853], [45.775, 4.852], [45.780, 4.845]];
  var BOURG = [[47.025, 4.840], [47.010, 4.790], [46.983, 4.768], [46.960, 4.740], [46.990, 4.700], [47.050, 4.780], [47.100, 4.880], [47.140, 4.950], [47.080, 4.890], [47.025, 4.840]];
  /* décalage écran de la pastille (unités de rayon du globe) : évite le chevauchement Lyon / Bourgogne */
  var MAIN = null;

  var others = null, sparks = null;
  /* traces de tous les continents : marches aléatoires sur la terre ferme (masque cuit de la Blue Marble) */
  function buildOthers() {
    if (others) return;
    others = []; sparks = [];
    var n = 0, i = 0;
    while (others.length < 1900 && i < 60000) {
      var lat = Math.asin(L.hash(i, 101) * 2 - 1) / D2R, lon = L.hash(i, 102) * 360 - 180; i++;
      if (lat > 72 || lat < -56 || !E.isLand(lat, lon)) continue;
      var pts = [[lat, lon]], hd = L.hash(i, 103) * 6.283, len = 4 + Math.floor(L.hash(i, 104) * 9), st = 0.25 + 0.9 * L.hash(i, 105);
      for (var k = 0; k < len; k++) {
        hd += (L.hash(i * 31 + k, 106) - 0.5) * 1.4;
        var nl = pts[k][0] + Math.sin(hd) * st, no = pts[k][1] + Math.cos(hd) * st / Math.cos(pts[k][0] * D2R);
        if (!E.isLand(nl, no)) break; pts.push([nl, no]);
      }
      if (pts.length < 3) continue;
      others.push({ p: pts.map(function (q) { return U.ll(q[0], q[1], 0.0015); }), t0: 49.0 + L.hash(n, 107) * 0.55, w: 0.6 + L.hash(n, 108) * 0.8 }); n++;
    }
    for (var j = 0, c = 0; c < 900 && j < 40000; j++) {
      var la = Math.asin(L.hash(j, 111) * 2 - 1) / D2R, lo = L.hash(j, 112) * 360 - 180;
      if (la > 70 || la < -55 || !E.isLand(la, lo)) continue;
      sparks.push({ P: U.ll(la, lo, 0.001), ph: L.hash(j, 113) * 6.283, f: 5 + 9 * L.hash(j, 114), t0: 49.05 + L.hash(j, 115) * 0.6 }); c++;
    }
  }

  /* ---------- caméra ---------- */
  var REY = [64.15, -21.94], VIEW = [47, 30];
  function camAt(C, t) {
    var m = Math.min(C.W, C.H), R = 6371;
    var g = E.camera(C, { lat: VIEW[0], lon: VIEW[1], Rs: 0.40 * m, fov: 30 }), hG = (g.d - 1) * R;
    var h, lat, lon, cx = C.W / 2, cy = C.H / 2, Rs = null;
    if (t < 48.0) {
      h = U.loglerp(12, 5200, U.easeIn(U.clamp((t - 47.0) / 1.0, 0, 1), 2.4)); lat = REY[0]; lon = REY[1];
    } else if (t < 51.0) {
      var u = U.clamp((t - 48.0) / 0.75, 0, 1);
      h = U.loglerp(5200, hG, U.easeOut(u, 3.5));
      var e = U.ease(U.clamp((t - 48.0) / 0.8, 0, 1));
      lat = U.lerp(REY[0], VIEW[0], e); lon = U.lerp(REY[1], VIEW[1], e) + (t - 48.8) * 2.2 * (t > 48.8 ? 1 : 0);
    } else {
      /* 51 → 52 : le globe descend et grossit un peu sous le logo, puis reste en fond */
      var u2 = U.ease(U.clamp((t - 51.0) / 1.0, 0, 1)), dr = U.clamp((t - 52) / 2, 0, 1);
      lat = VIEW[0]; lon = VIEW[1] + 2.2 * 2.2 + (t - 51) * 2.2;
      Rs = U.lerp(0.40, 0.52, u2) * m; cy = C.H / 2 + U.lerp(0, 0.16, u2) * C.H + dr * 0.02 * C.H; h = null;
    }
    var o = { lat: lat, lon: lon, fov: 30, cx: cx, cy: cy };
    if (Rs) o.Rs = Rs; else o.d = 1 + h / R;
    var cam = E.camera(C, o); cam.h = h;
    return cam;
  }
  /* soleil : de face (48–49,2) → sur le limbe en haut à droite (50,0) */
  function sunLimbPos(cam) { var a = 38 * D2R, r = cam.Rs * 1.035; return [cam.px + r * Math.sin(a), cam.py - r * Math.cos(a)]; }
  function sunAt(C, t, cam) {
    var day = E.sunCam(cam, 0.6, 0.38, -0.70);
    if (t < 49.2) return day;
    var sp = sunLimbPos(cam), rise = E.ray(cam, sp[0], sp[1]);
    var w = U.ease(U.clamp((t - 49.2) / 0.8, 0, 1));
    return U.norm(U.add(U.mul(day, 1 - w), U.mul(rise, w)));
  }

  /* ---------- voile de nuages (montée) ---------- */
  var NOISE2 = [
    "float h21(vec2 p){ p=fract(p*vec2(.1031,.1030)); p+=dot(p,p.yx+33.33); return fract((p.x+p.y)*p.x); }",
    "float vn2(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }",
    "float fbm2(vec2 p,int n){ float s=0.,a=.5; for(int k=0;k<6;k++){ if(k>=n) break; s+=a*vn2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s; }",
  ].join("\n");
  var FS_VEIL = "#version 300 es\nprecision highp float;\n" + NOISE2 + "\n" + [
    "in vec2 vUv; out vec4 o; uniform float uT, uCover, uOpaque, uScroll, uZoom, uAsp;",
    "void main(){ vec2 q=(vUv-.5)*vec2(uAsp,1.);",
    "  vec2 p=q*uZoom*2.4+vec2(0.,uScroll);",
    "  float n=fbm2(p,5), n2=fbm2(p*2.3+7.,3); float d=n*.8+n2*.35;",
    "  float cov=smoothstep(1.-uCover,1.-uCover+.22,d);",
    "  float ns=fbm2(p+vec2(-.05,.05),4); float sh=clamp(.5+(n-ns)*5.,0.,1.);",
    "  vec3 cc=mix(vec3(.70,.74,.78),vec3(.98,.97,.95),sh); cc=mix(cc,vec3(1.,.92,.78),pow(sh,3.)*.3);",
    "  cc=mix(cc,vec3(.95,.95,.94)-(1.-sh)*.08,uOpaque*.6); cov=mix(cov,1.,uOpaque);",
    "  o=vec4(cc*cov,cov); }",
  ].join("\n");
  var progVeil = null;

  /* ---------- pastilles d'avatar (texte : les 4 initiales seulement) ---------- */
  var atlas = null;
  function buildAtlas(C) {
    var cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
    var x = cv.getContext("2d"), letters = ["L", "N", "T", "C"];
    for (var i = 0; i < 4; i++) {
      var cx = i * 128 + 64, cy = 64;
      x.beginPath(); x.arc(cx, cy, 58, 0, Math.PI * 2); x.fillStyle = "#A6C1A0"; x.fill();
      x.beginPath(); x.arc(cx, cy, 51, 0, Math.PI * 2); x.fillStyle = "#17402C"; x.fill();
      x.fillStyle = "#F5F2EC"; x.font = "700 62px LKDVManrope, Manrope, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(letters[i], cx, cy + 3);
    }
    var gl = C.gl, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    atlas = tex;
  }
  function avatar(i, x, y, r, a) {
    var B = E.batch, u0 = i * 0.25, u1 = u0 + 0.25;
    var V = [[x - r, y - r, u0, 0], [x + r, y - r, u1, 0], [x + r, y + r, u1, 1], [x - r, y + r, u0, 1]], idx = [0, 1, 2, 0, 2, 3];
    for (var k = 0; k < 6; k++) { var v = V[idx[k]]; B._v(v[0], v[1], v[2], v[3], 1, 1, 1, a, 1, 1); }
  }

  /* ---------- logo ---------- */
  function logoBox(C) { var LM = C.fmt && C.fmt.vertical ? L.LOGO_MARK.v : L.LOGO_MARK.h; return { cx: LM.cx, cy: LM.cy, s: LM.w / 32 }; }
  function logoXY(C, x, y) { var b = logoBox(C); return [b.cx + (x - 16) * b.s, b.cy + (y - 16) * b.s]; }
  var OUT = null;

  /* projection d'une trace (points 3D) : tableau de [x, y, visibilité] */
  function projTrace(cam, P, upto) {
    var n = P.length, m = Math.max(2, Math.ceil(upto * (n - 1)) + 1), out = [];
    for (var i = 0; i < m && i < n; i++) {
      var q = P[i];
      if (i === m - 1 && upto < 1) { var f = upto * (n - 1) - (m - 2); if (i > 0) q = U.add(U.mul(P[i - 1], 1 - f), U.mul(P[i], f)); }
      var s = E.project(cam, q); if (s[2] <= 0) { out.push(null); continue; }
      out.push([s[0], s[1], E.visible(cam, q)]);
    }
    return out;
  }

  function mainTraces() {
    if (MAIN) return MAIN;
    var ice = E.spline(E.ICELAND_ROUTE || [[64.15, -21.94], [65.68, -18.09], [64.25, -15.21], [63.42, -19.0]], 6, true);
    function P3(a) { return a.map(function (q) { return U.ll(q[0], q[1], 0.0015); }); }
    MAIN = [
      { p: P3(ice), t0: 48.0, av: 0, off: [-0.22, -0.20] },
      { p: P3(E.spline(K2, 4, false)), t0: 48.25, av: 1, off: [0.20, -0.20] },
      { p: P3(LYON), t0: 48.5, av: 2, off: [-0.24, 0.16] },
      { p: P3(E.spline(BOURG, 3, false)), t0: 48.75, av: 3, off: [0.12, -0.26] },
    ];
    return MAIN;
  }

  /* traces sur le globe (avant le départ de 51,0) */
  function traces(C, t, cam, fadeAll) {
    var B = E.batch, k = cam.m / 1080, M = mainTraces();
    if (fadeAll <= 0) return;
    var calm = 1 - 0.45 * U.sstep(49.6, 50.0, t);
    /* milliers de traces */
    if (t >= 49.0) {
      for (var i = 0; i < others.length; i++) {
        var o = others[i], u = U.clamp((t - o.t0) / 0.45, 0, 1); if (u <= 0) continue;
        var pts = projTrace(cam, o.p, U.easeOut(u, 2));
        B.line(pts, 0.75 * k * o.w, SAGEL, 0.55 * fadeAll * calm, 0.4, 0.8);
        var hd = pts[pts.length - 1]; if (hd && u < 1) B.dot(hd[0], hd[1], 3 * k, [0.85, 0.95, 0.85], 0.8 * (1 - u) * hd[2] * fadeAll, 0.3, 1);
      }
      for (var j = 0; j < sparks.length; j++) {
        var sp = sparks[j]; if (t < sp.t0) continue;
        var q = E.project(cam, sp.P); if (q[2] <= 0) continue; var v = E.visible(cam, sp.P); if (v <= 0) continue;
        var tw = 0.55 + 0.45 * Math.sin(t * sp.f + sp.ph), ap = U.sstep(sp.t0, sp.t0 + 0.15, t) * tw * v * fadeAll * calm;
        B.dot(q[0], q[1], 2.2 * k, [1, 0.80, 0.45], ap, 0.5, 1); B.dot(q[0], q[1], 7 * k, AMBER, 0.25 * ap, 0, 1);
      }
    }
    /* les quatre traces du film, une par croche ; pastille au bout */
    for (var a = 0; a < M.length; a++) {
      var tr = M[a], uu = U.clamp((t - tr.t0) / 0.3, 0, 1); if (uu <= 0) continue;
      var pp = projTrace(cam, tr.p, U.easeOut(uu, 3));
      B.line(pp, 6 * k, SAGE, 0.35 * fadeAll * calm, 0, 1);
      B.line(pp, 1.8 * k, SAGEL, 1.0 * fadeAll * calm, 0.8, 0.5);
      var end = pp[pp.length - 1]; if (!end) continue;
      B.dot(end[0], end[1], 26 * k * Math.exp(-(t - tr.t0) * 5), SAGEL, 0.7 * fadeAll * end[2], 0, 1);
      B.dot(end[0], end[1], 3.4 * k, PAPER, fadeAll * end[2] * calm, 1, 0.3);
    }
  }
  function avatars(C, t, cam, fade) {
    var B = E.batch, k = cam.m / 1080, M = mainTraces(); if (fade <= 0) return;
    for (var a = 0; a < M.length; a++) {
      var tr = M[a], age = t - tr.t0 - 0.12; if (age <= 0) continue;
      var end = E.project(cam, tr.p[tr.p.length - 1]); if (end[2] <= 0) continue;
      var vis = E.visible(cam, tr.p[tr.p.length - 1]); if (vis <= 0) continue;
      var pop = L.spring(age, 0.6, 24), ox = end[0] + tr.off[0] * cam.Rs * 0.55 * pop, oy = end[1] + tr.off[1] * cam.Rs * 0.55 * pop;
      B.seg(end[0], end[1], ox, oy, 1.2 * k, 1.2 * k, SAGEL, 0.7 * fade * vis, SAGEL, 0.7 * fade * vis, 0.8, 0.4);
      void ox;
    }
    B.flush(C, 0);
    for (var b = 0; b < M.length; b++) {
      var tr2 = M[b], age2 = t - tr2.t0 - 0.12; if (age2 <= 0) continue;
      var e2 = E.project(cam, tr2.p[tr2.p.length - 1]); if (e2[2] <= 0) continue;
      var v2 = E.visible(cam, tr2.p[tr2.p.length - 1]); if (v2 <= 0) continue;
      var pop2 = L.spring(age2, 0.6, 24), x2 = e2[0] + tr2.off[0] * cam.Rs * 0.55 * pop2, y2 = e2[1] + tr2.off[1] * cam.Rs * 0.55 * pop2;
      avatar(tr2.av, x2, y2, 19 * k * Math.min(1, pop2 * 1.05), fade * v2);
    }
    B.flush(C, 0, atlas);
  }

  /* 51 → 52 : les traces quittent le globe et redessinent le tracé du logo */
  var NPART = 420;
  function converge(C, t, cam51, cam, sunFrom) {
    var B = E.batch, k = cam.m / 1080, b = logoBox(C), M = mainTraces();
    if (!OUT) OUT = E.logoOutline(NPART);
    var hold = 1 - U.sstep(52.25, 52.5, t);
    if (hold <= 0) return;
    var front = 0; /* proportion du tracé déjà posée */
    for (var i = 0; i < NPART; i++) {
      var src = i < 4 ? M[i].p[M[i].p.length - 1] : others[(i * 7) % others.length].p[others[(i * 7) % others.length].p.length - 1];
      var s0 = E.project(cam51, src), x0 = s0[0], y0 = s0[1];
      var j = Math.floor(L.hash(i, 121) * NPART), dest = OUT[j], dxy = logoXY(C, dest[0], dest[1]);
      var delay = 0.32 * (j / NPART) + 0.08 * L.hash(i, 122), dur = 0.55;
      var u = U.clamp((t - 51.0 - delay) / dur, 0, 1); if (u >= 1) { front = Math.max(front, j / NPART); }
      if (u <= 0) continue;
      /* courbe : s'élève hors du globe (radialement), puis file vers le tracé */
      var rx = x0 - cam51.px, ry = y0 - cam51.py, rl = Math.hypot(rx, ry) || 1;
      var c1x = x0 + rx / rl * 0.25 * cam.m, c1y = y0 + ry / rl * 0.25 * cam.m - 0.1 * cam.m;
      function at(w) { w = U.clamp(w, 0, 1); var a1 = (1 - w) * (1 - w), b1 = 2 * w * (1 - w), c1 = w * w; return [a1 * x0 + b1 * c1x + c1 * dxy[0], a1 * y0 + b1 * c1y + c1 * dxy[1]]; }
      var e = U.ease(u), p1 = at(e), p0 = at(Math.max(0, e - 0.07));
      var col = [U.lerp(SAGEL[0], PAPER[0], u), U.lerp(SAGEL[1], PAPER[1], u), U.lerp(SAGEL[2], PAPER[2], u)];
      var al = (u < 1 ? 0.6 : 0.0) * hold;
      B.seg(p0[0], p0[1], p1[0], p1[1], 0.4 * k, 1.2 * k, col, 0, col, al, 0.5, 0.6);
      B.dot(p1[0], p1[1], 2.2 * k, col, al, 0.5, 0.5);
    }
    /* le tracé lui-même (trait Paper, épaisseur 1,6/32 de la largeur), posé dans l'ordre d'arrivée */
    var draw = U.clamp((t - 51.25) / 0.7, 0, 1); draw = Math.max(draw, t >= 52 ? 1 : 0);
    var w = b.s * 1.6, hw = w / 2;
    var P = [[2, 24], [10, 10], [14, 16], [20, 6], [30, 24], [2, 24]], tot = 0, segs = [];
    for (var q = 0; q < 5; q++) { var l = Math.hypot(P[q + 1][0] - P[q][0], P[q + 1][1] - P[q][1]); segs.push(l); tot += l; }
    var left = draw * tot;
    var glowA = 0.35 * hold * (1 - U.sstep(52.0, 52.25, t) * 0.6);
    for (var z = 0; z < 5 && left > 0; z++) {
      var f = Math.min(1, left / segs[z]); left -= segs[z];
      var A = logoXY(C, P[z][0], P[z][1]), Bq = logoXY(C, U.lerp(P[z][0], P[z + 1][0], f), U.lerp(P[z][1], P[z + 1][1], f));
      B.seg(A[0], A[1], Bq[0], Bq[1], hw * 3.2, hw * 3.2, SAGEL, glowA * 0.5, SAGEL, glowA * 0.5, 0, 0.9);
      B.seg(A[0], A[1], Bq[0], Bq[1], hw, hw, PAPER, hold, PAPER, hold, 1, 0);
      B.dot(A[0], A[1], hw, PAPER, hold, 1, 0);
      if (f >= 1) { var Z = logoXY(C, P[z + 1][0], P[z + 1][1]); B.dot(Z[0], Z[1], hw, PAPER, hold, 1, 0); }
    }
    /* le Soleil vient se placer : c'est le point (cx 24, cy 9, r 1,6) */
    var su = U.ease(U.clamp((t - 51.0) / 0.95, 0, 1)), dot = logoXY(C, 24, 9);
    var sx = U.lerp(sunFrom[0], dot[0], su), sy = U.lerp(sunFrom[1], dot[1], su) - Math.sin(Math.PI * su) * 0.06 * cam.m;
    var r = U.lerp(7 * k, b.s * 1.6, su);
    B.dot(sx, sy, U.lerp(90, 40, su) * k, [1, 0.8, 0.5], 0.4 * hold * (1 - 0.7 * su), 0, 1);
    B.dot(sx, sy, r, PAPER, hold, 1, 0);
  }

  function sunFlare(C, t, cam, pos, a) {
    var B = E.batch, k = cam.m / 1080, x = pos[0], y = pos[1]; if (a <= 0.01) return;
    B.dot(x, y, 80 * k, [1, 0.78, 0.5], 0.35 * a, 0, 1);
    B.dot(x, y, 18 * k, [1, 0.93, 0.8], 0.9 * a, 0.2, 1);
    B.dot(x, y, 7 * k, PAPER, a, 1, 0.3);
    for (var i = 0; i < 6; i++) {
      var an = i * Math.PI / 3 + 0.26 + t * 0.04, len = (i % 2 ? 130 : 230) * k;
      B.seg(x, y, x + Math.cos(an) * len, y + Math.sin(an) * len, 2.2 * k, 0.4 * k, [1, 0.9, 0.75], 0.45 * a, [1, 0.8, 0.6], 0, 0, 1);
    }
  }

  L.cosmos.register({
    id: "b-orbit", order: 22, ranges: [[46.25, 54.0]],
    init: function (C) {
      E = L.cosmos.earth; U = E.util;
      SAGE = E.COL.sage; SAGEL = E.COL.sageL; AMBER = E.COL.amber; PAPER = E.COL.paper; FOREST = E.COL.forest;
      progVeil = C.program(C.VS_QUAD, FS_VEIL);
      return E.init(C).then(function () { buildOthers(); buildAtlas(C); });
    },
    draw: function (C, t) {
      var gl = C.gl, B = E.batch, cam = camAt(C, t);
      /* ---- montée à travers les nuages ---- */
      if (t < 48.0) {
        var cover = t < 47.0 ? Math.pow(U.clamp((t - 46.25) / 0.75, 0, 1), 0.6) : U.lerp(1.0, 0.0, U.sstep(47.45, 47.98, t));
        var opaque = U.sstep(46.8, 47.0, t) * (1 - U.sstep(47.3, 47.5, t));
        var ea = U.sstep(46.25, 46.4, t);
        if (t >= 47.0) {
          var p0 = { state: 4, t: t, bg: 1, sun: sunAt(C, t, cam), cloud: 0.42, cloudShift: -t * 0.004, spec: 0.15, oceanGrade: 0.8, band: 1 - U.sstep(47.6, 48.0, t), detail: 0 };
          E.drawGlobe(C, cam, p0);
        }
        gl.useProgram(progVeil.p); var u = progVeil.u;
        gl.uniform1f(u.uT, t); gl.uniform1f(u.uCover, cover); gl.uniform1f(u.uOpaque, opaque);
        gl.uniform1f(u.uScroll, -(t - 46.25) * 1.6); gl.uniform1f(u.uZoom, U.loglerp(0.7, 2.0, U.clamp((t - 46.25) / 1.75, 0, 1))); gl.uniform1f(u.uAsp, C.W / C.H);
        if (u.uAlpha) gl.uniform1f(u.uAlpha, ea);
        C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); C.quad();
        return;
      }
      /* ---- orbite ---- */
      var sun = sunAt(C, t, cam);
      var night = U.sstep(49.2, 50.0, t);
      var p = { state: 4, t: t, bg: 1, sun: sun, cloud: 0.42, cloudShift: -t * 0.004, spec: U.lerp(0.15, 0.5, U.sstep(48.0, 48.6, t)), oceanGrade: 0.5, city: night, atmo: 1 };
      var blur = U.sstep(51.55, 52.0, t);
      if (blur > 0) {
        var pb = Object.assign({}, p); pb.expo = U.lerp(1, 0.75, U.sstep(52, 52.6, t));
        E.drawGlobeBlurred(C, cam, pb, 3, 1);
        if (blur < 1) { var ps = Object.assign({}, p); ps.bg = 0; ps.alpha = 1 - blur; E.drawGlobe(C, cam, ps); }
      } else E.drawGlobe(C, cam, p);
      B.reset();
      E.stars(C, cam, 1 - blur);
      var sp = sunLimbPos(cam);
      var flareA = U.sstep(49.55, 50.0, t) * (1 - U.sstep(51.0, 51.15, t));
      sunFlare(C, t, cam, sp, flareA);
      var fade = 1 - U.sstep(51.0, 51.45, t);
      traces(C, t, cam, fade);
      B.flush(C, 0);
      if (t < 50.0) avatars(C, t, cam, 1 - U.sstep(49.5, 49.85, t));
      if (t >= 51.0) {
        var cam51 = camAt(C, 51.0);
        B.reset(); converge(C, t, cam51, cam, sunLimbPos(cam51)); B.flush(C, 0);
      }
    },
  });
})();
