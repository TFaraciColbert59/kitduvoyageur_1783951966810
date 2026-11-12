/* b-descent.js — équipe B (cosmos-vfx). Module 6,00 → 12,50 s.
   Descente sur l'Islande : point sage qui tombe, zoom logarithmique, satellites, route 1 (~1 322 km, vraies
   villes), vent, avion, nuits ambre, pluie de 38 objets, montgolfière, oies, puis voile de nuages
   (troué → opaque Stone → déchiré du centre vers les bords, transparent à 12,5).
   draw() est une fonction pure de t (LKDV.hash, graine 1783). */
(function () {
  "use strict";
  var L = window.LKDV, E = null, U = null, D2R = Math.PI / 180;

  /* Route 1, sens horaire depuis Reykjavík (lat, lon des localités traversées). */
  var ROUTE = [
    [64.146, -21.942], [64.167, -21.700], [64.330, -21.790], [64.539, -21.920], [64.766, -21.556], [64.980, -21.120],
    [65.124, -21.083], [65.330, -20.850], [65.660, -20.279], [65.553, -19.452], [65.470, -18.750], [65.683, -18.091],
    [65.683, -17.550], [65.640, -16.910], [65.642, -16.118], [65.265, -14.395], [65.030, -14.220], [64.930, -14.020], [64.830, -13.870], [64.790, -14.010], [64.656, -14.281],
    [64.600, -14.550], [64.430, -14.950], [64.300, -15.300], [64.048, -16.180], [64.016, -16.966], [63.789, -18.054], [63.419, -19.006], [63.528, -19.511],
    [63.752, -20.224], [63.836, -20.400], [63.933, -20.997], [64.000, -21.187],
  ];
  /* 9 étapes (nuits) : indices dans ROUTE */
  var STAGES = [0, 27, 25, 23, 15, 13, 11, 8, 3];
  var routeLL = null, routeCum = null, routeTot = 0, stageS = [];

  function prep() {
    if (routeLL) return;
    var u = E.util, sp = E.spline(ROUTE, 10, true);
    routeLL = sp; routeCum = [0];
    for (var i = 1; i < sp.length; i++) { routeCum.push(routeCum[i - 1] + E.lengthKm([sp[i - 1], sp[i]])); }
    routeTot = routeCum[routeCum.length - 1];
    stageS = STAGES.map(function (k) { return routeCum[k * 10] / routeTot; });
    void u;
  }
  /* point de la route à l'abscisse s ∈ [0,1] */
  function routeAt(s) {
    var d = U.clamp(s, 0, 1) * routeTot, i = 1; while (i < routeCum.length - 1 && routeCum[i] < d) i++;
    var a = routeLL[i - 1], b = routeLL[i], k = (d - routeCum[i - 1]) / Math.max(1e-6, routeCum[i] - routeCum[i - 1]);
    return [U.lerp(a[0], b[0], k), U.lerp(a[1], b[1], k)];
  }

  /* ---------- caméra ---------- */
  /* Altitude de caméra (km). 6,0 → 7,0 : chute exponentielle depuis le globe entier ; 7,0 → 10,25 : l'île reste
     cadrée entière (route, nuits, pluie d'objets) ; 10,25 → 10,75 : plongée jusqu'à LKDV.altitude(10,75), puis la
     caméra suit exactement la loi de l'altimètre (LKDV.altitude) dans les nuages. */
  function camAt(C, t) {
    var m = Math.min(C.W, C.H), v = C.fmt && C.fmt.vertical, R = 6371;
    var c6 = E.camera(C, { lat: E.ICELAND.lat, lon: E.ICELAND.lon, Rs: E.FRAME6.rs * m, fov: 30 });
    var h0 = (c6.d - 1) * R, h1 = v ? 1250 : 880, h2 = v ? 800 : 560;
    var HMIN = 28; /* sous ~25 km la Blue Marble (500 m) devient floue : le voile prend le relais à 10,75 */
    var h, lat = E.ICELAND.lat, lon = E.ICELAND.lon, pitch = 0, fov = 30;
    if (t < 7) h = U.loglerp(h0, h1, U.easeOut(t - 6, 4.2));
    else if (t < 10.25) h = U.loglerp(h1, h2, (t - 7) / 3.25);
    else h = U.loglerp(h2, HMIN, U.easeIn(U.clamp((t - 10.25) / 0.5, 0, 1), 2.2));
    if (t > 10.25) {
      var u = U.clamp((t - 10.25) / 0.5, 0, 1);
      lat = U.lerp(lat, 64.05, U.ease(u)); lon = U.lerp(lon, -19.4, U.ease(u));
      pitch = 40 * U.ease(U.clamp((t - 10.3) / 0.45, 0, 1)); fov = U.lerp(30, 52, U.ease(u));
    }
    var cam = E.camera(C, { lat: lat, lon: lon, d: 1 + h / R, fov: fov, pitch: pitch });
    cam.h = h;
    return cam;
  }
  function sunFor(cam) { var s = E.FRAME6.sun; return E.sunCam(cam, s[0], s[1], s[2]); }
  function P(cam, lat, lon, alt) { return E.project(cam, U.ll(lat, lon, alt || 0)); }

  /* ---------- shaders propres au module ---------- */
  var NOISE2 = [
    "float h21(vec2 p){ p=fract(p*vec2(.1031,.1030)); p+=dot(p,p.yx+33.33); return fract((p.x+p.y)*p.x); }",
    "float vn2(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }",
    "float fbm2(vec2 p,int n){ float s=0.,a=.5; for(int k=0;k<6;k++){ if(k>=n) break; s+=a*vn2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s; }",
  ].join("\n");
  /* Voile de nuages plein écran, composé avec la Terre (rendue au demi) : sortie prémultipliée. */
  var FS_VEIL = "#version 300 es\nprecision highp float;\n" + NOISE2 + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform sampler2D uEarth; uniform float uEarthOn, uT, uZoom, uCover, uDiss, uOpaque, uTear, uAsp;",
    "uniform vec2 uRes;",
    "void void_ang(float a){}",
    "void main(){",
    "  vec2 q=(vUv-.5)*vec2(uAsp,1.);",
    "  float r=length(q);",
    /* on traverse la couche : les motifs grossissent depuis le centre */
    "  vec2 p=q/uZoom*2.6+vec2(0.,uT*.12);",
    "  float n=fbm2(p,5); float n2=fbm2(p*2.3+7.,3);",
    "  float d=n*.8+n2*.35;",
    "  float cov=smoothstep(1.-uCover,1.-uCover+.22,d);",
    /* ombrage : lumière chaude venue du haut à droite */
    "  float ns=fbm2(p+vec2(-.05,-.05),4);",
    "  float sh=clamp(.5+(n-ns)*5.,0.,1.);",
    "  vec3 cc=mix(vec3(.72,.75,.78),vec3(.98,.97,.95),sh); cc=mix(cc,vec3(1.,.93,.80),pow(sh,3.)*.35);",
    /* voile opaque Stone (silence) : presque uni, à peine modelé */
    "  vec3 stone=vec3(.980,.973,.961)-(1.-sh)*.035;",
    "  cc=mix(cc,stone,uOpaque); cov=mix(cov,1.,uOpaque);",
    /* déchirure : trou du centre vers les bords, bord effiloché et étiré radialement */
    "  if(uTear>0.){ vec2 qe=(q-vec2(0.,.30))*vec2(.55,1.4); float re=length(qe); float ang=atan(qe.y,qe.x); float rag=fbm2(q*3.2+vec2(uT*.2,0.),4)*.42+fbm2(q*9.,2)*.10; r=re; void_ang(ang);",
    "    float edge=uTear*1.55-.14+rag*uTear;",
    "    float hole=smoothstep(edge-.02,edge+.10,r);",
    "    float wisp=smoothstep(.55,.85,fbm2(q*9.+vec2(0.,uTear*1.5),3))*(1.-hole)*smoothstep(edge-.18,edge,r)*.5;",
    "    cov=cov*max(hole,wisp)*(1.-smoothstep(.96,1.,uTear)); }",
    /* la Terre vue d'en haut cède au voile (dissolution en formes de nuages) */
    "  vec4 ea=vec4(0.);",
    "  if(uEarthOn>0.){ ea=texture(uEarth,vUv); float ev=smoothstep(uDiss-.12,uDiss+.12,n*1.1+.1*n2); ea*=ev*uEarthOn; }",
    "  vec3 col=cc*cov+ea.rgb*(1.-cov); float a=cov+ea.a*(1.-cov);",
    "  o=vec4(col,a);",
    "}",
  ].join("\n");
  /* Montgolfière : enveloppe à fuseaux Forest / Paper, éclairée d'or ; nacelle. Quad centré, coordonnées locales. */
  var FS_BALLOON = "#version 300 es\nprecision highp float;\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uC; uniform float uS, uA, uT;",
    "void main(){",
    "  vec2 q=(gl_FragCoord.xy-uC)/uS;", /* unités : rayon de l'enveloppe = 1, y vers le haut */
    "  if(abs(q.x)>1.3||q.y<-2.2||q.y>1.3){ o=vec4(0.); return; }",
    "  vec3 col=vec3(0.); float a=0.;",
    /* enveloppe : sphère étirée vers le bas en goutte */
    "  float yy=q.y; float w=yy>0.?sqrt(max(1.-yy*yy,0.)):mix(1.,.28,pow(clamp(-yy/1.25,0.,1.),1.15))*sqrt(max(1.-pow(clamp(-yy/1.35,0.,1.),4.),0.));",
    "  float ex=abs(q.x)/max(w,1e-3);",
    "  if(yy>-1.3&&ex<1.){",
    "    float nx=q.x/max(w,1e-3); float nz=sqrt(max(1.-nx*nx,0.)); float ph=asin(clamp(nx,-1.,1.));",
    "    float gore=step(.5,fract(ph*8./3.14159+.25));",
    "    vec3 base=mix(vec3(.09,.25,.17),vec3(.96,.95,.92),gore);",
    "    vec3 n=normalize(vec3(nx*nz*1.1,yy>0.?yy:yy*.35,nz));",
    "    vec3 L=normalize(vec3(.65,.45,.6)); float dif=max(dot(n,L),0.);",
    "    float rim=pow(1.-nz,2.)*smoothstep(-.2,.6,nx);",
    "    col=base*(.22+.85*dif)+vec3(1.,.72,.32)*(rim*.9+pow(dif,6.)*.25);",
    "    float seam=smoothstep(.035,.0,abs(fract(ph*8./3.14159+.25)-.5))*.25; col*=1.-seam;",
    "    a=smoothstep(1.,.96,ex); }",
    /* jupe et suspentes */
    "  if(yy<-1.25&&yy>-1.75){ float l=smoothstep(.025,.0,abs(abs(q.x)-mix(.26,.14,(-1.25-yy)/.5)));",
    "    col=mix(col,vec3(.25,.22,.18),l*.9); a=max(a,l*.9); }",
    /* nacelle */
    "  if(yy<-1.72&&yy>-1.98&&abs(q.x)<.15){ float sh=.5+.5*smoothstep(-.15,.15,q.x); col=vec3(.42,.28,.16)*(.5+.6*sh); a=1.; }",
    "  o=vec4(col*a*uA,a*uA);",
    "}",
  ].join("\n");
  function void_(x) { return x; }
  var progVeil = null, progBalloon = null;

  /* ---------- pièces du plan ---------- */
  var SAGE, SAGEL, AMBER, PAPER, BLUEL, INK;

  /* 6,00 : point sage qui tombe du centre sur Reykjavík */
  function fallingPoint(C, t, cam) {
    var B = E.batch, tau = t - 6; if (tau < 0 || tau > 0.9) return;
    var k = C.fmt && C.fmt.vertical ? C.fmt.column.scale : 1;
    var tgt = P(cam, 64.146, -21.942, 0.0004);
    var x0 = C.W / 2, y0 = C.H / 2, cx = x0 - 0.12 * cam.m, cy = y0 - 0.22 * cam.m;
    var T = 0.42;
    function at(u) { u = U.clamp(u, 0, 1); var a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [a * x0 + b * cx + c * tgt[0], a * y0 + b * cy + c * tgt[1]]; }
    var u = U.easeIn(tau / T, 1.6);
    if (tau < T) {
      var pts = []; for (var i = 0; i <= 18; i++) { var uu = Math.max(0, u - 0.45 * (1 - i / 18)); pts.push(at(uu)); }
      B.line(pts, function (s) { return (1 + 5 * s) * k; }, SAGEL, function (s) { return 0.9 * s * s; }, 0.6, 0.5);
      var h = at(u), r = 7 * k * U.lerp(1, 0.55, u);
      B.dot(h[0], h[1], r * 6, SAGEL, 0.45, 0, 1); B.dot(h[0], h[1], r, SAGEL, 1, 1, 0.2);
    } else {
      /* impact : onde sur le sol, la traînée retombe */
      var w = (tau - T) / 0.48, R = U.easeOut(w, 3) * 0.09 * cam.m;
      for (var j = 0; j < 2; j++) {
        var rr = R * (1 - j * 0.35), pts2 = [];
        for (var a2 = 0; a2 <= 48; a2++) { var an = a2 / 48 * Math.PI * 2; pts2.push([tgt[0] + Math.cos(an) * rr, tgt[1] + Math.sin(an) * rr * 0.92]); }
        B.line(pts2, 1.6 * k, SAGEL, 0.8 * (1 - w) * (1 - j * 0.4), 0.7, 0.6);
      }
      B.dot(tgt[0], tgt[1], 5 * k, SAGEL, 1, 1, 0.3); B.dot(tgt[0], tgt[1], 22 * k, SAGE, 0.5 * (1 - w), 0, 1);
    }
  }

  /* 7,00 : route qui se trace, 9 étapes qui s'allument ; 9,00 nuits ambre */
  function route(C, t, cam, fade) {
    var B = E.batch, k = cam.m / 1080; if (t < 7.0 || fade <= 0) return;
    var prog = U.ease(U.clamp((t - 7.05) / 0.85, 0, 1));
    var n = 320, pts = [];
    for (var i = 0; i <= n; i++) {
      var s = i / n * prog, g = routeAt(s), p = P(cam, g[0], g[1], 0.0003); pts.push(p[2] > 0 ? [p[0], p[1]] : null);
    }
    var w = 1.6 * k * (cam.h < 300 ? 1.6 : 1);
    B.line(pts, w * 5, SAGE, 0.22 * fade, 0, 1);
    B.line(pts, w, SAGEL, 0.95 * fade, 0.8, 0.4);
    if (prog < 1) { var hd = pts[n]; if (hd) { B.dot(hd[0], hd[1], 16 * k, SAGEL, 0.6 * fade, 0, 1); B.dot(hd[0], hd[1], 3.5 * k, PAPER, fade, 1, 0.3); } }
    for (var j = 0; j < STAGES.length; j++) {
      var sj = stageS[j] || 1; if (sj > prog + 1e-4 && !(j === 0)) continue;
      var tOn = 7.05 + (j === 0 ? 0 : 0.85 * sj), age = t - tOn; if (age < 0) continue;
      var g2 = ROUTE[STAGES[j]], q = P(cam, g2[0], g2[1], 0.0003); if (q[2] <= 0) continue;
      var pop = L.spring(age, 0.55, 26);
      B.dot(q[0], q[1], 26 * k * Math.exp(-age * 4), SAGEL, 0.6 * fade, 0, 1);
      B.dot(q[0], q[1], 4.2 * k * pop, PAPER, fade, 1, 0.3);
      /* nuits : lueur ambre, une par double-croche à partir de 9,00 */
      var tn = 9.0 + j * 0.0625, an = t - tn;
      if (an > 0) { var gl = U.sstep(0, 0.25, an); B.dot(q[0], q[1], 30 * k, AMBER, 0.55 * gl * fade, 0, 1); B.dot(q[0], q[1], 9 * k, [1, 0.82, 0.5], 0.8 * gl * fade, 0.2, 1); }
    }
  }

  /* 7,00 : trois satellites génériques au premier plan, flous ; un faisceau touche l'île */
  function satellites(C, t, cam) {
    var B = E.batch, m = cam.m; if (t < 6.95 || t > 7.9) return;
    var S = [
      { t0: 6.95, d: 0.55, a: [-0.12, 0.22], b: [1.12, 0.08], s: 0.075, r: 0.3 },
      { t0: 7.08, d: 0.50, a: [1.10, 0.86], b: [-0.10, 0.66], s: 0.05, r: -0.5 },
      { t0: 7.20, d: 0.60, a: [0.22, -0.10], b: [0.62, 1.10], s: 0.10, r: 1.2 },
    ];
    var dark = [0.07, 0.10, 0.12], glint = [1, 0.9, 0.7];
    for (var i = 0; i < 3; i++) {
      var o = S[i], u = (t - o.t0) / o.d; if (u < -0.1 || u > 1.1) continue;
      var shutter = 0.10, NS = 24; /* flou de mouvement : 24 positions sur l'obturation, bords doux (hors mise au point) */
      for (var j = 0; j < NS; j++) {
        var uu = u - shutter * (j / (NS - 1));
        var x = U.lerp(o.a[0], o.b[0], uu) * C.W, y = U.lerp(o.a[1], o.b[1], uu) * C.H, sz = o.s * m;
        var ang = o.r + uu * 0.3, ca = Math.cos(ang), sa = Math.sin(ang), al = 0.065;
        B.seg(x - ca * sz, y - sa * sz, x + ca * sz, y + sa * sz, sz * 0.17, sz * 0.17, [0.46, 0.58, 0.68], al, [0.62, 0.72, 0.80], al, 0.3, 0);
        B.seg(x - sa * sz * 0.12, y + ca * sz * 0.12, x + sa * sz * 0.12, y - ca * sz * 0.12, sz * 0.2, sz * 0.2, AMBER, al * 1.6, [0.95, 0.80, 0.45], al * 1.6, 0.3, 0);
        B.seg(x - ca * sz * 0.9, y - sa * sz * 0.9, x + ca * sz * 0.9, y + sa * sz * 0.9, sz * 0.02, sz * 0.02, dark, al, dark, al, 0.5, 0);
      }
      var gx = U.lerp(o.a[0], o.b[0], u) * C.W, gy = U.lerp(o.a[1], o.b[1], u) * C.H;
      B.dot(gx + Math.cos(o.r) * o.s * m * 0.5, gy + Math.sin(o.r) * o.s * m * 0.5, o.s * m * 0.5, glint, 0.35, 0, 1);
      if (i === 0 && t > 7.08 && t < 7.6) {
        var tg = P(cam, 64.95, -18.75, 0.0003);
        var ba = U.sstep(7.08, 7.18, t) * (1 - U.sstep(7.4, 7.6, t));
        B.seg(gx, gy, tg[0], tg[1], m * 0.003, m * 0.05, SAGEL, 0.22 * ba, SAGE, 0.04 * ba, 0, 1);
        B.seg(gx, gy, tg[0], tg[1], m * 0.0012, m * 0.006, SAGEL, 0.5 * ba, SAGEL, 0.22 * ba, 0.3, 0.8);
        B.dot(tg[0], tg[1], m * 0.06, SAGE, 0.3 * ba, 0, 1);
      }
    }
  }

  /* 8,00 : milliers de traits de vent qui suivent les masses d'air (dépression au sud-ouest de l'île) */
  function windField(x, y) { /* km locaux (est, nord) → vitesse (km/s fictifs) */
    var vx = 0.8, vy = 0.2, cx = -330, cy = -170, dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy, s = 2.6 * 120000 / (r2 + 40000);
    vx += -dy / Math.sqrt(r2 + 1) * s; vy += dx / Math.sqrt(r2 + 1) * s;
    var dx2 = x - 520, dy2 = y - 420, r3 = dx2 * dx2 + dy2 * dy2, s2 = -0.7 * 90000 / (r3 + 70000); vx += -dy2 / Math.sqrt(r3 + 1) * s2; vy += dx2 / Math.sqrt(r3 + 1) * s2;
    return [vx, vy];
  }
  function localToLL(x, y) { var lat0 = E.ICELAND.lat, lon0 = E.ICELAND.lon; return [lat0 + y / 111.2, lon0 + x / (111.2 * Math.cos(lat0 * D2R))]; }
  function wind(C, t, cam) {
    var B = E.batch, k = cam.m / 1080; if (t < 7.95 || t > 9.35) return;
    var env = U.sstep(7.95, 8.2, t) * (1 - U.sstep(8.95, 9.35, t));
    var N = 2200, age = t - 7.95;
    for (var i = 0; i < N; i++) {
      var x = (L.hash(i, 51) - 0.5) * 1700, y = (L.hash(i, 52) - 0.5) * 1100, ph = L.hash(i, 53);
      var travel = (age * 1.0 + ph * 0.6) * 200, steps = 8, st = travel / steps;
      /* avance le long du champ (intégration d'Euler depuis la graine) */
      var px = x, py = y;
      for (var j = 0; j < steps; j++) { var v = windField(px, py), vl = Math.hypot(v[0], v[1]) || 1; px += v[0] / vl * st; py += v[1] / vl * st; }
      var pts = [], len = 90 + 90 * L.hash(i, 54), seg = 8;
      for (var q = 0; q <= seg; q++) {
        var gg = localToLL(px, py), pp = P(cam, gg[0], gg[1], 0.0016); pts.push(pp[2] > 0 ? [pp[0], pp[1]] : null);
        var v2 = windField(px, py), vl2 = Math.hypot(v2[0], v2[1]) || 1; px -= v2[0] / vl2 * len / seg; py -= v2[1] / vl2 * len / seg;
      }
      pts.reverse();
      var life = Math.sin(Math.PI * U.clamp(((age + ph * 1.3) % 1.3) / 1.3, 0, 1));
      B.line(pts, function (s) { return (0.6 + 1.3 * s) * k; }, function (s) { return [U.lerp(BLUEL[0], SAGEL[0], s), U.lerp(BLUEL[1], SAGEL[1], s), U.lerp(BLUEL[2], SAGEL[2], s)]; },
        function (s) { return s * 0.75 * env * life; }, 0.5, 0.35);
    }
  }

  /* 9,00 : avion de ligne générique sous la caméra ; sa traînée se pose sur la route (côte sud) */
  function plane(C, t, cam) {
    var B = E.batch, m = cam.m; if (t < 8.95 || t > 10.2) return;
    var s0 = 0.86, s1 = 0.60; /* tronçon de route survolé : de Vík vers Höfn (sens inverse de la route) */
    var u = U.clamp((t - 8.95) / 0.85, 0, 1);
    var trailPts = [], N = 40;
    var settle = U.sstep(9.35, 9.95, t);
    for (var i = 0; i <= N; i++) {
      var uu = u * i / N, s = U.lerp(s0, s1, uu), g = routeAt(s);
      var gp = P(cam, g[0], g[1], 0.0003);
      /* la traînée est d'abord haute (décalée vers l'avion), puis se pose sur la route */
      var off = (1 - settle) * 0.05 * m * Math.sin(Math.PI * uu);
      trailPts.push(gp[2] > 0 ? [gp[0] - off, gp[1] - off * 0.6] : null);
    }
    var ta = 1 - U.sstep(9.9, 10.2, t);
    B.line(trailPts, function (s) { return U.lerp(2.5, 7, 1 - s) * (1 - settle * 0.7) * m / 1080; }, function () { return [U.lerp(0.97, SAGEL[0], settle), U.lerp(0.96, SAGEL[1], settle), U.lerp(0.94, SAGEL[2], settle)]; },
      function (s) { return (0.25 + 0.5 * s) * ta; }, 0.3, 0.5);
    if (u >= 1) return;
    /* l'avion : plus haut, donc plus grand, passe vite ; silhouette Paper, sans marque */
    var g1 = routeAt(U.lerp(s0, s1, u)), g0 = routeAt(U.lerp(s0, s1, Math.max(0, u - 0.02)));
    var p1 = P(cam, g1[0], g1[1]), p0 = P(cam, g0[0], g0[1]);
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    var off2 = 0.05 * m * Math.sin(Math.PI * u), x = p1[0] - off2, y = p1[1] - off2 * 0.6, L0 = 0.17 * m * (1 + 0.7 * Math.sin(Math.PI * u));
    var nx = -dy, ny = dx, al = U.sstep(0, 0.08, u) * (1 - U.sstep(0.9, 1, u));
    /* ombre portée lointaine, très douce */
    B.dot(x + 0.06 * m, y + 0.09 * m, L0 * 0.35, [0.02, 0.04, 0.05], 0.18 * al, 0, 0);
    for (var j = 0; j < 4; j++) { /* flou de mouvement */
      var bx = x - dx * j * L0 * 0.05, by = y - dy * j * L0 * 0.05, a = al * (j === 0 ? 0.7 : 0.15);
      B.seg(bx - dx * L0 * 0.5, by - dy * L0 * 0.5, bx + dx * L0 * 0.5, by + dy * L0 * 0.5, L0 * 0.055, L0 * 0.045, PAPER, a, PAPER, a, 0.8, 0);
      var wx = bx - dx * L0 * 0.02, wy = by - dy * L0 * 0.02;
      B.seg(wx, wy, wx - dx * L0 * 0.2 + nx * L0 * 0.48, wy - dy * L0 * 0.2 + ny * L0 * 0.48, L0 * 0.07, L0 * 0.025, PAPER, a, PAPER, a, 0.8, 0);
      B.seg(wx, wy, wx - dx * L0 * 0.2 - nx * L0 * 0.48, wy - dy * L0 * 0.2 - ny * L0 * 0.48, L0 * 0.07, L0 * 0.025, PAPER, a, PAPER, a, 0.8, 0);
      var tx = bx - dx * L0 * 0.44, ty = by - dy * L0 * 0.44;
      B.seg(tx, ty, tx - dx * L0 * 0.06 + nx * L0 * 0.16, ty - dy * L0 * 0.06 + ny * L0 * 0.16, L0 * 0.03, L0 * 0.012, PAPER, a, PAPER, a, 0.8, 0);
      B.seg(tx, ty, tx - dx * L0 * 0.06 - nx * L0 * 0.16, ty - dy * L0 * 0.06 - ny * L0 * 0.16, L0 * 0.03, L0 * 0.012, PAPER, a, PAPER, a, 0.8, 0);
      if (j === 0) { /* réacteurs et éclat du soleil sur l'aile */
        B.dot(wx + nx * L0 * 0.17, wy + ny * L0 * 0.17, L0 * 0.022, [0.55, 0.58, 0.6], a, 1, 0);
        B.dot(wx - nx * L0 * 0.17, wy - ny * L0 * 0.17, L0 * 0.022, [0.55, 0.58, 0.6], a, 1, 0);
        B.dot(wx + nx * L0 * 0.3, wy + ny * L0 * 0.3, L0 * 0.12, [1, 0.85, 0.6], 0.25 * a, 0, 1);
      }
    }
  }

  /* 10,00 : 38 silhouettes en pluie d'étoiles filantes vers les étapes */
  function rain(C, t, cam) {
    var B = E.batch, k = cam.m / 1080; if (t < 9.95 || t > 10.95) return;
    for (var i = 0; i < 38; i++) {
      var t0 = 10.0 + (i % 19) * 0.022 + Math.floor(i / 19) * 0.11, d = 0.32 + 0.12 * L.hash(i, 61), u = (t - t0) / d;
      if (u < 0 || u > 1.6) continue;
      var st = ROUTE[STAGES[i % 9]], tg = P(cam, st[0], st[1], 0.0003); if (tg[2] <= 0) continue;
      var ang = (-55 + 25 * L.hash(i, 62)) * D2R, dist = (0.45 + 0.35 * L.hash(i, 63)) * cam.m;
      var sx = tg[0] - Math.cos(ang) * dist, sy = tg[1] + Math.sin(ang) * dist;
      var uu = U.easeIn(Math.min(u, 1), 1.8), x = U.lerp(sx, tg[0], uu), y = U.lerp(sy, tg[1], uu);
      if (u <= 1) {
        var tl = Math.max(0, uu - 0.35), tx = U.lerp(sx, tg[0], tl), ty = U.lerp(sy, tg[1], tl);
        B.seg(tx, ty, x, y, 0.3 * k, 2.4 * k, SAGE, 0, SAGEL, 0.8, 0.5, 0.6);
        /* petite silhouette d'objet : losange / carré arrondi Paper */
        var sz = (3.2 + 2 * L.hash(i, 64)) * k, sh = i % 3;
        if (sh === 0) B.dot(x, y, sz, PAPER, 1, 1, 0.2);
        else B.seg(x - sz * 0.7, y, x + sz * 0.7, y, sz * 0.75, sz * 0.75, PAPER, 1, PAPER, 1, sh === 1 ? 0.9 : 0.6, 0.2);
        B.dot(x, y, sz * 4, SAGEL, 0.35, 0, 1);
      } else {
        var w = (u - 1) / 0.6; B.dot(tg[0], tg[1], (6 + 20 * w) * k, SAGEL, 0.6 * (1 - w), 0, 1);
      }
    }
  }

  /* 11,00 : vol d'oies en V */
  function geese(C, t) {
    var B = E.batch, m = Math.min(C.W, C.H), k = m / 1080; if (t < 10.75 || t > 11.4) return;
    var u = (t - 10.75) / 0.6, lx = U.lerp(-0.1, 1.1, u) * C.W, ly = U.lerp(0.62, 0.28, u) * C.H, dir = Math.atan2(-0.34 * C.H, 1.2 * C.W);
    var ca = Math.cos(dir), sa = Math.sin(dir);
    for (var i = 0; i < 11; i++) {
      var side = i === 0 ? 0 : (i % 2 ? 1 : -1), rank = Math.ceil(i / 2);
      var bx = lx - ca * rank * 110 * k + (-sa) * side * rank * 80 * k * (side ? 1 : 0), by = ly - sa * rank * 110 * k + ca * side * rank * 80 * k;
      bx += (L.hash(i, 71) - 0.5) * 8 * k; by += (L.hash(i, 72) - 0.5) * 8 * k;
      var flap = Math.sin(t * 16 + i * 0.9), span = 30 * k, c = [0.10, 0.14, 0.13];
      var jy = -flap * 9 * k, ty = flap * 12 * k + 4 * k; /* coude et pointe de l'aile (vue de côté, en « m ») */
      B.dot(bx, by, 3.2 * k, c, 0.9, 0.9, 0);
      B.seg(bx + 2 * k, by, bx + 9 * k, by - 2 * k, 1.8 * k, 1.2 * k, c, 0.9, c, 0.9, 0.8, 0);
      B.seg(bx, by, bx - span * 0.45, by + jy, 2.6 * k, 1.8 * k, c, 0.9, c, 0.9, 0.8, 0);
      B.seg(bx - span * 0.45, by + jy, bx - span, by + ty, 1.8 * k, 0.7 * k, c, 0.9, c, 0.85, 0.8, 0);
      B.seg(bx, by, bx + span * 0.45, by + jy, 2.6 * k, 1.8 * k, c, 0.9, c, 0.9, 0.8, 0);
      B.seg(bx + span * 0.45, by + jy, bx + span, by + ty, 1.8 * k, 0.7 * k, c, 0.9, c, 0.85, 0.8, 0);
    }
  }

  /* 11,00–11,5 : gouttelettes sur l'objectif */
  function droplets(C, t) {
    var B = E.batch, m = Math.min(C.W, C.H), k = m / 1080; if (t < 10.95 || t > 11.55) return;
    for (var i = 0; i < 16; i++) {
      var t0 = 10.98 + L.hash(i, 81) * 0.3; if (t < t0) continue;
      var age = t - t0, a = U.sstep(0, 0.05, age) * (1 - U.sstep(11.42, 11.52, t));
      var x = (0.08 + 0.84 * L.hash(i, 82)) * C.W, y = (0.08 + 0.84 * L.hash(i, 83)) * C.H + age * age * 160 * k * L.hash(i, 84);
      var r = (10 + 26 * Math.pow(L.hash(i, 85), 2)) * k;
      B.dot(x, y, r, [0.55, 0.60, 0.62], 0.10 * a, 0.2, 0);
      B.dot(x + r * 0.15, y + r * 0.2, r * 0.9, [0.98, 0.98, 0.96], 0.10 * a, 0.3, 0);
      B.dot(x - r * 0.35, y - r * 0.38, r * 0.22, [1, 1, 1], 0.75 * a, 0.6, 0);
      B.dot(x + r * 0.35, y + r * 0.45, r * 0.12, [1, 0.95, 0.85], 0.4 * a, 0.5, 0);
    }
  }

  function balloon(C, t, cam) {
    if (t < 9.95 || t >= 10.75) return;
    var gl = C.gl, u = U.clamp((t - 9.95) / 0.8, 0, 1), m = cam.m;
    var v = C.fmt && C.fmt.vertical;
    var x = U.lerp(v ? 0.70 : 0.76, v ? 0.60 : 0.64, u) * C.W, y = U.lerp(1.15, -0.28, Math.pow(u, 1.15)) * C.H;
    var s = U.loglerp(0.04, 0.15, u) * m;
    var a = U.sstep(9.95, 10.05, t);
    gl.useProgram(progBalloon.p);
    gl.uniform2f(progBalloon.u.uC, x, C.H - y); gl.uniform1f(progBalloon.u.uS, s); gl.uniform1f(progBalloon.u.uA, a); gl.uniform1f(progBalloon.u.uT, t);
    C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); C.quad();
  }

  /* état de la Terre pendant la descente */
  function globeParams(C, t, cam) {
    var p = { state: 4, t: t, bg: 1, atmo: 1, city: 0, spec: 0.12, expo: 1, oceanGrade: U.sstep(6.0, 6.6, t) * 0.8 };
    p.sun = sunFor(cam);
    p.patch = U.sstep(6.2, 6.9, t);
    p.band = U.sstep(7.7, 8.5, t);
    p.cloud = t < 8 ? U.lerp(0.45, 0.16, U.sstep(6.0, 6.8, t)) : t < 10.25 ? U.lerp(0.16, 0.42, U.sstep(8.0, 8.9, t)) : U.lerp(0.42, 0.55, U.sstep(10.25, 10.75, t));
    p.cloudShift = -t * 0.004 - U.sstep(8, 9.5, t) * 0.002;
    p.detail = U.sstep(10.2, 10.6, t);
    p.city = U.lerp(0.65, 0, U.sstep(6, 6.6, t));
    return p;
  }

  L.cosmos.register({
    id: "b-descent", order: 21, ranges: [[6.0, 12.5]],
    init: function (C) {
      E = L.cosmos.earth; U = E.util;
      SAGE = E.COL.sage; SAGEL = E.COL.sageL; AMBER = E.COL.amber; PAPER = E.COL.paper; BLUEL = [0.42, 0.62, 0.78]; INK = E.COL.ink;
      progVeil = C.program(C.VS_QUAD, FS_VEIL); progBalloon = C.program(C.VS_QUAD, FS_BALLOON);
      E.ICELAND_ROUTE = ROUTE;
      return E.init(C).then(prep);
    },
    draw: function (C, t) {
      var gl = C.gl, cam = camAt(C, t), B = E.batch;
      var veil = t >= 10.75;
      if (t < 11.0) {
        var p = globeParams(C, t, cam);
        if (!veil) E.drawGlobe(C, cam, p);
        else E.drawGlobe(C, cam, p, E.half);
      }
      if (!veil) {
        B.reset();
        var ov = 1 - U.sstep(10.22, 10.42, t);
        if (t < 7.2) E.stars(C, cam, 1 - U.sstep(6.2, 6.9, t));
        wind(C, t, cam); B.flush(C, 0);
        route(C, t, cam, ov); fallingPoint(C, t, cam); rain(C, t, cam); plane(C, t, cam); satellites(C, t, cam);
        B.flush(C, 0);
        balloon(C, t, cam);
        B.reset(); geese(C, t); B.flush(C, 0);
        return;
      }
      /* ---- voile de nuages ---- */
      var zoom = U.loglerp(1.0, 0.45, U.clamp((t - 10.75) / 0.75, 0, 1)) * U.loglerp(1, 0.8, U.clamp((t - 11.5) / 1.0, 0, 1));
      var cover = t < 11.0 ? U.lerp(0.25, 0.62, U.sstep(10.75, 11.0, t)) : t < 11.4 ? 0.62 : U.lerp(0.62, 1.0, U.sstep(11.35, 11.5, t));
      var opaque = U.sstep(11.42, 11.5, t);
      var tear = t < 12 ? 0 : U.ease(U.clamp((t - 12.0) / 0.5, 0, 1));
      if (tear > 0) opaque = 1;
      gl.useProgram(progVeil.p); var u = progVeil.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, E.half.tex); gl.uniform1i(u.uEarth, 0);
      gl.uniform1f(u.uEarthOn, t < 11.0 ? 1 : 0); gl.uniform1f(u.uT, t); gl.uniform1f(u.uZoom, zoom); gl.uniform1f(u.uCover, cover);
      gl.uniform1f(u.uDiss, U.lerp(-0.1, 1.2, U.sstep(10.75, 11.0, t))); gl.uniform1f(u.uOpaque, opaque); gl.uniform1f(u.uTear, tear);
      gl.uniform1f(u.uAsp, C.W / C.H); gl.uniform2f(u.uRes, C.W, C.H);
      C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); C.quad();
      B.reset(); geese(C, t); droplets(C, t); B.flush(C, 1);
    },
  });
  void void_; void INK;
})();
