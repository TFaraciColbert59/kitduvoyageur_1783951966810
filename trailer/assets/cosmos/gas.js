/* gas.js — LKDV.cosmos.gas : LE shader de gaz unique du film (nébuleuse 0:00 et aurore 0:57–1:00).
   Bibliothèque, pas un module peint : a-nebula.js et a-finale.js l'appellent depuis leur draw(C, t).

   API
   - gas.NEBULA, gas.AURORA : jeux de réglages (objets de nombres, tous interpolables).
   - gas.mix(a, b, k)        : réglages interpolés (linéaire, clé par clé).
   - gas.init(C)             : compile, construit le volume de bruit (idempotent, promesse).
   - gas.render(C, ph, P)    : peint gaz + étoiles sur la cible courante (écran), phase de mouvement `ph` (s).
   - gas.drawGas / gas.drawStars : les deux passes séparées.
   - gas.toScreen(C, ph, P, X, D) : point d'un plan de profondeur D → pixels (même caméra que le shader).
   - gas.GLSL : bloc GLSL commun (palette linéaire, hachage, bruit) pour les autres modules ; gas.bindNoise(unit).
   La phase de mouvement est le seul temps du gaz : la boucle 60 → 0 tient parce que a-finale appelle
   render(C, t − 60, NEBULA) à la fin, exactement ce que a-nebula appelle avec render(C, t, NEBULA) au début. */
(function () {
  "use strict";
  var LK = window.LKDV;

  /* ---------- palette : jetons LKDV et nuances (sRGB → linéaire) ---------- */
  var PAL = {
    FOREST: "#17402C", SAGE: "#5B7F55", SAGE_L: "#A6C1A0", AMBER: "#C89A3B", BRICK: "#A8443A",
    DEEP: "#2A5A6E", SLATE: "#4B6B7C", STONE: "#F5F2EC",
    /* nuances */ EMERALD: "#2B6A4B", GOLD: "#E2C27A", INK: "#0A1A21", DEEP_D: "#123341", BRICK_L: "#D8826E",
  };
  function lin(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.pow(v / 255, 2.2); });
  }
  var palGLSL = Object.keys(PAL).map(function (k) {
    var c = lin(PAL[k]);
    return "const vec3 " + k + " = vec3(" + c.map(function (v) { return v.toFixed(5); }).join(",") + ");";
  }).join("\n");

  var GLSL = [
    "precision highp float; precision highp int; precision highp sampler3D;",
    palGLSL,
    "uniform sampler3D uN;",
    "vec2 rot2(vec2 v, float a){ float c=cos(a), s=sin(a); return vec2(c*v.x-s*v.y, s*v.x+c*v.y); }",
    "uint uh(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return x; }",
    "float h01(uint i, uint s){ return float(uh(i*0x9E3779B9u ^ uh(s+1783u)) >> 8) / 16777216.0; }",
    "float hpx(vec2 f){ return h01(uint(f.x)+uint(f.y)*7919u, 77u); }",
    "vec4 T3(vec3 p){ return texture(uN, p*0.125); }",
    "float n1(vec3 p){ return T3(p).r*2.0-1.0; }",
    "const mat3 OCT = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);",
    "float fbm(vec3 p, int o){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ if(i>=o) break; s+=a*n1(p); p=OCT*p*2.03; a*=0.5; } return s; }",
    "float ridge(vec3 p, int o){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ if(i>=o) break; float n=1.0-abs(T3(p).b*2.0-1.0); s+=a*n*n; p=OCT*p*2.07; a*=0.5; } return s; }",
    "vec3 toSRGB(vec3 c){ return pow(max(c,0.0), vec3(1.0/2.2)); }",
  ].join("\n");

  /* ---------- volume de bruit périodique 128³ (RGBA) : construit une fois, entiers hachés seulement ---------- */
  function buildNoise(N) {
    var P = 8, data = new Uint8Array(N * N * N * 4);
    function grads(salt) {
      var g = new Float32Array(P * P * P * 3);
      for (var i = 0; i < P * P * P; i++) {
        var u = LK.hash(i, salt) * 2 - 1, th = LK.hash(i, salt + 1) * Math.PI * 2, s = Math.sqrt(1 - u * u);
        g[i * 3] = s * Math.cos(th); g[i * 3 + 1] = s * Math.sin(th); g[i * 3 + 2] = u;
      }
      return g;
    }
    var gA = grads(11), gB = grads(23);
    var fp = new Float32Array(P * P * P * 3);
    for (var i = 0; i < P * P * P; i++) { fp[i * 3] = LK.hash(i, 41); fp[i * 3 + 1] = LK.hash(i, 42); fp[i * 3 + 2] = LK.hash(i, 43); }
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function perlin(g, x, y, z) {
      var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
      var u = fade(fx), v = fade(fy), w = fade(fz), r = 0;
      for (var c = 0; c < 8; c++) {
        var dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
        var k = (((ix + dx) % P) + ((iy + dy) % P) * P + ((iz + dz) % P) * P * P) * 3;
        var d = g[k] * (fx - dx) + g[k + 1] * (fy - dy) + g[k + 2] * (fz - dz);
        r += d * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
      }
      return r;
    }
    var s = P / N, o = 0;
    for (var z = 0; z < N; z++) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++, o += 4) {
      var X = x * s, Y = y * s, Z = z * s;
      var a = perlin(gA, X, Y, Z), b = perlin(gB, X + 0.5, Y + 0.25, Z + 0.75);
      var ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z), f1 = 9, f2 = 9;
      for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var cx = ix + dx, cy = iy + dy, cz = iz + dz;
        var k = ((((cx % P) + P) % P) + (((cy % P) + P) % P) * P + (((cz % P) + P) % P) * P * P) * 3;
        var ex = cx + fp[k] - X, ey = cy + fp[k + 1] - Y, ez = cz + fp[k + 2] - Z, d = ex * ex + ey * ey + ez * ez;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      f1 = Math.sqrt(f1); f2 = Math.sqrt(f2);
      data[o] = Math.max(0, Math.min(255, Math.round((a * 0.85 + 0.5) * 255)));
      data[o + 1] = Math.max(0, Math.min(255, Math.round(Math.min(1, f1 / 1.05) * 255)));
      data[o + 2] = Math.max(0, Math.min(255, Math.round((b * 0.85 + 0.5) * 255)));
      data[o + 3] = Math.max(0, Math.min(255, Math.round(Math.min(1, (f2 - f1) / 0.9) * 255)));
    }
    return data;
  }

  /* ---------- le shader de gaz (cible réduite) ---------- */
  var FS_GAS = "#version 300 es\n" + GLSL + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uRes; uniform float uMin;",
    "uniform float uZ, uW, uZoom, uRoll; uniform vec2 uCam; uniform vec2 uLs;",
    "uniform float uWarp, uDens, uExpo, uLight, uDust, uBg;",
    "uniform vec4 uMix;   // piliers émeraude, veines ambre, cœurs brique, brume bleue",
    "uniform vec4 uCurt;  // aurore : quantité, base y, étirement, dérive",
    "uniform vec4 uColl;  // effondrement : k, angle de spirale, aplatissement, rayon d'extinction",
    "uniform vec4 uWave;  // onde : amplitude, rayon du front, largeur",
    "uniform vec2 uWaveO;",
    "vec2 toL(vec2 p, float D){ return rot2((p-uCam)/uZoom, -uRoll)*(D-uZ); }",
    /* hauteur des falaises (repère du plan proche) : socle irrégulier + colonnes penchées vers la source */
    "float cliffH(vec2 q, vec2 L){",
    "  float base = -0.40 + 0.07*fbm(vec3(q.x*1.1, 2.0, 4.0), 3) + 0.10*(q.x - L.x)*(q.x - L.x);",
    "  float lean = q.x - (q.y - base)*0.22*clamp(q.x - L.x, -1.0, 1.0);",
    "  float tall = smoothstep(-0.1, 0.6, n1(vec3(lean*0.7, 14.0, 2.0)));",
    "  float c1 = pow(clamp(1.0 - abs(n1(vec3(lean*1.25, 9.0, 1.0))), 0.0, 1.0), 5.0);",
    "  float c2 = pow(clamp(1.0 - abs(n1(vec3(lean*3.6, 12.0, 3.0))), 0.0, 1.0), 7.0);",
    "  return base + 0.36*c1*tall + 0.07*c2*(0.4 + tall);",
    "}",
    "void main(){",
    "  vec2 fc = gl_FragCoord.xy;",
    "  vec2 p = (fc - 0.5*uRes)/uMin;",
    "  float cur = uCurt.x;",
    /* onde : front de compression */
    "  float wf = 0.0;",
    "  if (uWave.x > 0.0) { vec2 dw = p-uWaveO; float s = length(dw)-uWave.y; wf = exp(-s*s/(uWave.z*uWave.z))*uWave.x;",
    "    p -= normalize(dw)*wf*0.035; }",
    /* effondrement : spirale képlérienne + chute vers le centre + aplatissement */
    "  float kc = uColl.x; vec2 pc = p;",
    "  if (kc > 0.0) { vec2 d0 = p-uLs; d0.y *= 1.0 + uColl.z*2.6; float r0 = length(d0);",
    "    d0 = rot2(d0, uColl.y/pow(r0+0.10, 1.5)); d0 *= 1.0 + 2.4*kc*kc; pc = uLs + d0; }",
    /* aurore : étirement vertical (rideaux) */
    "  vec2 pa = vec2(p.x*(1.0+cur*uCurt.z*0.25), p.y/(1.0+cur*uCurt.z));",
    "  pc = mix(pc, pa, cur);",
    /* ---- fond ---- */
    "  vec3 col = mix(INK, DEEP_D, clamp(0.55+0.45*p.y - 0.25*length(p), 0.0, 1.0))*uBg;",
    /* ---- couche lointaine : brume bleue profonde (D = 3.4) ---- */
    "  vec2 qf = toL(pc, 3.4)*0.55 + vec2(11.3, 4.1);",
    "  float hf = fbm(vec3(qf*1.1, uW*0.4 + 3.0), 4);",
    "  col += (DEEP*0.30*smoothstep(-0.25, 0.7, hf) + SLATE*0.10*smoothstep(0.3, 0.9, hf))*uMix.w;",
    /* ---- couche moyenne : gaz en émission, champ de température, cavité, veines, cœurs (D = 1.8) ---- */
    "  vec2 qm = toL(pc, 1.8) + vec2(2.7, -5.1); vec2 Lm = toL(uLs, 1.8) + vec2(2.7, -5.1);",
    "  vec3 Pm = vec3(qm*1.4, uW + 1.3);",
    "  vec2 wv = vec2(fbm(Pm*0.7, 3), fbm(Pm*0.7 + vec3(5.2, 1.3, 2.8), 3));",
    "  vec2 qw = qm + uWarp*0.38*wv;",
    "  float rm = length(qw - Lm), rl = length(qm - Lm);",
    "  float e = fbm(vec3(qw*1.9, uW + 4.0), 6);",
    "  float e2 = fbm(vec3(qw*0.65 + 3.0, uW*0.5 + 8.0), 3);",
    "  float illum = uLight / (1.0 + pow(rm/0.24, 2.0));",
    "  float neb = smoothstep(-0.30, 0.70, e + 0.40*e2);",
    "  neb = neb*neb*(0.55 + 0.45*smoothstep(-0.3, 0.5, e2));",
    "  float wallR = 0.27 + 0.10*wv.x;",
    "  float cav = smoothstep(wallR*0.45, wallR*1.05, rm);",
    "  float wall = exp(-pow((rm - wallR)/0.12, 2.0))*smoothstep(-0.5, 0.5, e);",
    "  float dens = (neb*cav + wall*0.7)*uDens;",
    "  float temp = clamp(0.28 + 0.65*e2 + 0.75*illum, 0.0, 1.0);",
    "  vec3 gc = mix(DEEP*1.1 + EMERALD*0.35, EMERALD*1.5 + SAGE*0.25, smoothstep(0.0, 0.5, temp));",
    "  gc = mix(gc, mix(AMBER, GOLD, 0.35)*1.2, smoothstep(0.5, 1.0, temp));",
    "  vec3 em = gc*dens*(0.50 + 1.6*illum);",
    "  float v = ridge(vec3(qw*2.8 + wv*0.4, uW*1.2 + 9.0), 4);",
    "  float veins = pow(clamp(v*1.28, 0.0, 1.0), 8.0)*smoothstep(0.03, 0.35, dens);",
    "  em += mix(AMBER, GOLD, clamp(illum, 0.0, 1.0))*veins*(0.5 + 3.2*illum)*uMix.y;",
    "  float cell = T3(vec3(qw*4.2 + vec2(3.0, 1.0), uW*0.6 + 2.0)).g;",
    "  float cores = smoothstep(0.22, 0.02, cell)*smoothstep(0.15, 0.55, dens);",
    "  em += mix(BRICK, BRICK_L, 0.45)*cores*(1.6 + 3.0*illum)*uMix.z;",
    "  float lane = pow(clamp(1.0 - abs(fbm(vec3(qw*1.5 + wv*0.5, uW + 30.0), 4))*2.6, 0.0, 1.0), 5.0);",
    "  lane *= smoothstep(-0.2, 0.5, fbm(vec3(qw*0.8, uW + 33.0), 2));",
    "  col = col*(1.0 - 0.55*clamp(dens, 0.0, 1.0)) + em;",
    "  col *= 1.0 - uDust*0.88*lane;",
    "  col += (GOLD*0.55*exp(-rl/0.13) + STONE*1.4*exp(-rl/0.028) + AMBER*0.28*exp(-rl/0.5))*uLight;",
    /* ---- couche proche : falaises et colonnes sombres, bords fractals, vapeurs éclairées (D = 1.05) ---- */
    "  vec2 qn = toL(pc, 1.05); vec2 Ln = toL(uLs, 1.05);",
    "  vec2 wn = vec2(fbm(vec3(qn*2.2, uW + 21.0), 4), fbm(vec3(qn*2.2 + 7.1, uW + 22.0), 4));",
    "  vec2 qnw = qn + uWarp*0.07*wn;",
    "  float er = fbm(vec3(qnw*7.0, uW + 2.0), 5);",
    "  float H = cliffH(qnw, Ln);",
    "  float sd = H + 0.06*er - qnw.y;",
    "  vec2 tl = normalize(Ln - qnw + vec2(0.0, 0.001));",
    "  float sd2 = cliffH(qnw + tl*0.02, Ln) + 0.06*er - (qnw.y + tl.y*0.02);",
    "  float m = smoothstep(-0.012, 0.025, sd)*uMix.x*uDens;",
    "  float rn = length(qnw - Ln);",
    "  float illn = uLight / (1.0 + pow(rn/0.55, 2.0));",
    "  float facing = clamp((sd - sd2)*45.0, 0.0, 1.0);",
    "  float rimL = facing*exp(-abs(sd - 0.003)/0.008);",
    "  float inner = smoothstep(0.0, 0.09, sd);",
    "  float tex = fbm(vec3(qnw*3.5, uW + 40.0), 4);",
    "  vec3 cliff = mix(EMERALD*0.22 + AMBER*0.03, FOREST*0.05 + INK*0.25, inner)*(0.55 + 0.9*smoothstep(-0.5, 0.6, tex));",
    "  cliff += mix(EMERALD*1.2, SAGE_L*0.6, 0.3)*0.18*exp(-max(sd, 0.0)/0.018)*illn*(0.4 + 0.9*facing);",
    "  cliff += (GOLD*2.6 + AMBER*0.6 + STONE*0.25)*rimL*illn*(0.5 + 1.1*smoothstep(-0.3, 0.5, er));",
    "  cliff += BRICK_L*0.8*rimL*smoothstep(0.15, 0.55, er)*illn*uMix.z;",
    "  col = mix(col, cliff, m);",
    /* vapeurs : fins voiles éclairés qui montent des crêtes (photo-évaporation) */
    "  float st = fbm(vec3(qnw.x*9.0 + wn.y*2.0, qnw.y*2.2, uW*2.0 + 50.0), 4);",
    "  float steam = exp(-max(-sd, 0.0)/0.06)*(1.0 - m)*smoothstep(0.05, 0.6, st)*facing;",
    "  col += mix(GOLD, STONE, 0.3)*steam*illn*0.55*uMix.x*uDens;",
    /* onde : bord éclairé */
    "  col += (GOLD*1.1 + STONE*0.35)*wf*(0.04 + 1.2*dens + 2.0*veins)*0.9;",
    /* effondrement : extinction du nuage hors du disque en formation */
    "  if (kc > 0.0) { vec2 dd = p-uLs; dd.y *= 1.0+uColl.z*2.6; col = mix(col, mix(INK, DEEP_D, 0.4)*uBg, smoothstep(uColl.w, uColl.w+0.35, length(dd))*kc); }",
    /* ---- aurore : rideaux = le même gaz étiré en rayons verticaux ; bord inférieur net, frange haute brique ---- */
    "  if (cur > 0.0) {",
    "    float aur = 0.0; vec3 acol = vec3(0.0);",
    "    float gasRay = smoothstep(-0.25, 0.75, e + 0.4*e2);",
    "    for (int j = 0; j < 4; j++) {",
    "      float fj = float(j);",
    "      float x = p.x*(0.8 + 0.30*fj) + uCurt.w*(0.6 + 0.25*fj) + fj*3.7;",
    "      float yb = uCurt.y + 0.27*fj + 0.13*n1(vec3(x*0.8, fj*5.0, uW*0.3)) + 0.045*n1(vec3(x*2.9, fj*5.0 + 2.0, uW*0.5)) + 0.015*n1(vec3(x*9.0, fj*3.0, uW));",
    "      float h = p.y - yb;",
    "      float soft = 0.006 + 0.10*(1.0 - cur);",
    "      float ray = T3(vec3(x*17.0, h*0.22, uW*0.8 + fj)).r;",
    "      float rays = 0.20 + 1.3*clamp(ray*2.0 - 0.6, 0.0, 1.0) + 0.7*pow(clamp(1.0 - abs(n1(vec3(x*6.0, 3.0 + fj, uW))), 0.0, 1.0), 8.0);",
    "      float env = smoothstep(-soft, soft*1.5, h)*exp(-max(h, 0.0)*(4.5 + 2.5*fj)*cur*cur);",
    "      float edge = exp(-max(h, 0.0)/0.012)*smoothstep(-soft, 0.0, h);",
    "      float fold = pow(clamp(0.5 + 0.65*n1(vec3(x*1.3, 1.0 + fj, uW*0.25)), 0.0, 1.0), 2.2)*1.7;",
    "      float eA = (env*rays + 0.8*edge)*fold*(0.50 + 0.9*gasRay)*(1.0 - 0.2*fj);",
    "      vec3 c = mix(mix(SAGE_L, EMERALD*2.0, 0.35), EMERALD*1.8 + SAGE*0.4, smoothstep(0.0, 0.05, h));",
    "      c = mix(c, BRICK*0.9 + AMBER*0.1, smoothstep(0.12, 0.40, h)*0.55);",
    "      acol += c*eA; aur += eA;",
    "    }",
    "    vec3 sky = mix(INK*0.9, FOREST*0.30, 0.45) + col*0.45;",
    "    col = mix(col, sky + acol*2.0, cur);",
    "  }",
    "  col = vec3(1.0) - exp(-col*uExpo);",
    "  vec3 sc = toSRGB(col); sc = mix(sc, sc*sc*(3.0 - 2.0*sc), 0.45);",
    "  o = vec4(sc, 1.0);",
    "}",
  ].join("\n");

  /* ---------- composition plein format : agrandissement, masque d'horizon, tramage ---------- */
  var FS_COMP = "#version 300 es\n" + GLSL + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform sampler2D uG; uniform vec2 uView; uniform vec2 uSrc; uniform float uAlpha; uniform vec3 uHor; uniform float uMin;",
    /* B-spline bicubique en 4 lectures bilinéaires (lisse, sans marches) */
    "vec4 bicubic(vec2 uv){",
    "  vec2 st = uv*uSrc - 0.5; vec2 i = floor(st); vec2 f = st - i;",
    "  vec2 w0 = (1.0/6.0)*(-f*f*f + 3.0*f*f - 3.0*f + 1.0), w1 = (1.0/6.0)*(3.0*f*f*f - 6.0*f*f + 4.0);",
    "  vec2 w2 = (1.0/6.0)*(-3.0*f*f*f + 3.0*f*f + 3.0*f + 1.0), w3 = (1.0/6.0)*f*f*f;",
    "  vec2 s0 = w0+w1, s1 = w2+w3; vec2 f0 = w1/s0, f1 = w3/s1;",
    "  vec2 t0 = (i - 0.5 + f0)/uSrc, t1 = (i + 1.5 + f1)/uSrc;",
    "  return mix(mix(texture(uG, vec2(t1.x, t1.y)), texture(uG, vec2(t0.x, t1.y)), s0.x/(s0.x+s1.x)),",
    "             mix(texture(uG, vec2(t1.x, t0.y)), texture(uG, vec2(t0.x, t0.y)), s0.x/(s0.x+s1.x)), s0.y/(s0.y+s1.y));",
    "}",
    "void main(){",
    "  vec3 c = bicubic(gl_FragCoord.xy/uView).rgb;",
    "  c += (hpx(gl_FragCoord.xy) - 0.5)/255.0;",
    "  float py = (gl_FragCoord.y - 0.5*uView.y)/uMin;",
    "  float a = uAlpha * smoothstep(uHor.x - uHor.y, uHor.x + uHor.y, py);",
    "  o = vec4(c*a, a);",
    "}",
  ].join("\n");

  /* ---------- étoiles, halos, poussière crème : quads indexés (gl_VertexID), positions fermées ---------- */
  var N_HALO = 400, N_FIELD = 2400, N_DUST = 3000, N_EXTRA = 4200;
  var N_STARS = N_HALO + N_FIELD + N_DUST + N_EXTRA;
  var VS_STAR = "#version 300 es\n" + GLSL + "\n" + [
    "uniform vec2 uView; uniform float uMin, uZ, uZoom, uRoll; uniform vec2 uCam; uniform vec2 uLs;",
    "uniform float uExtra, uStarA, uDustA, uStreak; uniform vec2 uStreakC;",
    "out vec2 vL; out float vI; out vec3 vC; flat out vec4 vP; // vP : rayon cœur, rayon halo, longueur des aigrettes, type",
    "vec2 toS(vec2 X, float D){ return uCam + uZoom*rot2(X/max(D-uZ, 0.05), uRoll); }",
    "void main(){",
    "  int id = gl_VertexID/6, cn = gl_VertexID - id*6;",
    "  uint u = uint(id);",
    "  float ax = uView.x/(2.0*uMin), ay = uView.y/(2.0*uMin);",
    "  float D, rc, rh, sp = 0.0, I, kind; vec2 X; vec3 c;",
    "  float s = uMin/1080.0;",
    "  float r1 = h01(u,1u), r2 = h01(u,2u), r3 = h01(u,3u), r4 = h01(u,4u), r5 = h01(u,5u);",
    "  if (id < " + N_HALO + ") {",
    "    D = 1.1 + 2.6*r3;",
    "    if (r5 < 0.45) { vec2 g = vec2(sqrt(-2.0*log(r1+1e-4))*cos(6.2832*r2), sqrt(-2.0*log(r1+1e-4))*sin(6.2832*r2));",
    "      X = rot2((uLs-uCam)/uZoom, -uRoll)*(D-0.0) + g*0.28*D; }",
    "    else X = (vec2(r1, r2)*2.0-1.0)*vec2(ax, ay)*1.3*D;",
    "    float b = pow(r4, 5.0);",
    "    rc = (0.8 + 2.0*b)*s; rh = (3.0 + 16.0*b)*s; I = 0.55 + 1.8*b;",
    "    sp = id < 9 ? (60.0 + 110.0*r4)*s : 0.0;",
    "    c = r5 < 0.3 ? mix(STONE, GOLD, 0.6) : (r5 < 0.55 ? mix(STONE, SAGE_L, 0.7) : (r5 < 0.8 ? STONE : mix(STONE, SLATE, 0.6)));",
    "    kind = 0.0;",
    "  } else if (id < " + (N_HALO + N_FIELD) + ") {",
    "    D = 2.0 + 5.0*r3; X = (vec2(r1, r2)*2.0-1.0)*vec2(ax, ay)*1.25*D;",
    "    rc = (0.55 + 0.6*r4)*s; rh = 2.2*s; I = 0.25 + 0.6*pow(r4, 3.0); c = mix(STONE, r5<0.5?SLATE:GOLD, 0.35*r5); kind = 1.0;",
    "  } else if (id < " + (N_HALO + N_FIELD + N_DUST) + ") {",
    "    D = 0.95 + 1.2*r3; X = (vec2(r1, r2)*2.0-1.0)*vec2(ax, ay)*1.25*D;",
    "    rc = (0.9 + 1.3*r4)*s; rh = 3.0*s; I = 0.10*uDustA; c = mix(STONE, GOLD, 0.4); kind = 2.0;",
    "  } else {",
    "    D = 1.6 + 5.0*r3; X = (vec2(r1, r2)*2.0-1.0)*vec2(ax, ay)*1.3*D;",
    "    float vis = smoothstep(r5, r5 + 0.08, uExtra);",
    "    rc = (0.6 + 1.1*pow(r4, 2.0))*s; rh = (2.5 + 6.0*pow(r4, 4.0))*s; I = (0.3 + 0.9*pow(r4, 3.0))*vis; c = mix(STONE, r1<0.5?SAGE_L:SLATE, 0.3); kind = 1.0;",
    "  }",
    "  if (kind != 2.0) I *= uStarA;",
    "  vec2 pp = toS(X, D);",
    "  vec2 px = pp*uMin + 0.5*uView;",
    /* traînées : étirement radial vers le centre de fuite (plongée) */
    "  vec2 sd = pp - uStreakC; float sl = length(sd); vec2 dir = sl > 1e-4 ? sd/sl : vec2(1.0, 0.0);",
    "  float len = uStreak*sl*uMin*(0.4 + 1.2/D);",
    "  float ext = max(max(rh*3.0, rc*3.0), sp) + 1.5;",
    "  vec2 cv = vec2(cn==1||cn==2||cn==4 ? 1.0 : -1.0, cn==2||cn==4||cn==5 ? 1.0 : -1.0);",
    "  vec2 nrm = vec2(-dir.y, dir.x);",
    "  vec2 off = dir*(cv.x*(ext + len*0.5)) + nrm*(cv.y*ext);",
    "  vec2 ctr = px - dir*len*0.5;",
    "  vL = vec2(cv.x*(ext + len*0.5), cv.y*ext);",
    "  vP = vec4(rc, rh, sp, len);",
    "  vI = (pp.x < -ax-0.3 || pp.x > ax+0.3 || pp.y < -ay-0.3 || pp.y > ay+0.3 || D-uZ < 0.06) ? 0.0 : I;",
    "  vC = c;",
    "  vec2 fp = vI > 0.0 ? ctr + off : vec2(-100.0);",
    "  gl_Position = vec4(fp/uView*2.0-1.0, 0.0, 1.0);",
    "}",
  ].join("\n");
  var FS_STAR = "#version 300 es\n" + GLSL + "\n" + [
    "in vec2 vL; in float vI; in vec3 vC; flat in vec4 vP; out vec4 o;",
    "void main(){",
    "  if (vI <= 0.0) discard;",
    "  float L = vP.w;",
    "  vec2 v = vec2(max(abs(vL.x + 0.0) - L*0.5, 0.0)*sign(vL.x), vL.y);", // capsule le long de la traînée
    "  float d = length(v);",
    "  float I = exp(-d*d/(vP.x*vP.x)) + 0.16*exp(-d/vP.y);",
    "  if (vP.z > 0.0) { float sp = 0.0; for (int k = 0; k < 3; k++) { float a = 1.5708 + float(k)*1.0472; vec2 dr = vec2(cos(a), sin(a));",
    "      float al = abs(dot(v, dr)), pe = abs(dot(v, vec2(-dr.y, dr.x)));",
    "      sp += exp(-pe/(0.55 + al*0.008)) * exp(-al/(vP.z*0.35)); }",
    "    float al2 = abs(v.x), pe2 = abs(v.y); sp += 0.35*exp(-pe2/0.5)*exp(-al2/(vP.z*0.15));",
    "    I += 0.9*sp; }",
    "  if (L > 0.5) I *= clamp(6.0/(L + 6.0), 0.15, 1.0) * 1.6;",
    "  I *= vI;",
    "  vec3 c = mix(vC, vec3(1.0), clamp(exp(-d*d/(vP.x*vP.x))*0.6, 0.0, 1.0));",
    "  float ext = max(max(vP.y*3.0, vP.x*3.0), vP.z) + 1.5;",
    "  I *= 1.0 - smoothstep(0.6, 1.0, d/ext);",
    "  float a = 1.0 - exp(-I);",
    "  o = vec4(toSRGB(c)*a, a);",
    "}",
  ].join("\n");

  /* ---------- réglages ---------- */
  var NEBULA = {
    speed: 0.13, evolve: 0.045, zoom: 1.0, camX: 0.0, camY: 0.0, roll: 0.0, rollRate: 0.012,
    lightX: 0.05, lightY: 0.03, light: 1.0,
    warp: 1.0, dens: 1.0, expo: 1.35, dust: 1.0, bg: 1.0,
    pillar: 1.0, vein: 1.0, core: 1.0, blue: 1.0,
    curtain: 0.0, curtY: -0.2, stretch: 0.0, drift: 0.0,
    collapse: 0.0, swirl: 0.0, flatten: 0.0, fadeR: 3.0,
    wave: 0.0, waveR: 0.0, waveW: 0.06, waveX: -1.6, waveY: 1.1,
    stars: 1.0, extra: 0.0, dustA: 1.0, streak: 0.0, streakX: 0.0, streakY: 0.0,
    alpha: 1.0, horizon: -9.0, horizonSoft: 0.15,
  };
  var AURORA = {};
  for (var k in NEBULA) AURORA[k] = NEBULA[k];
  Object.assign(AURORA, {
    speed: 0.05, evolve: 0.10, light: 0.0, warp: 0.6, dens: 0.55, expo: 1.25, dust: 0.25, bg: 0.7,
    pillar: 0.0, vein: 0.25, core: 0.0, blue: 0.5,
    curtain: 1.0, curtY: -0.62, stretch: 7.0, drift: 0.0,
    stars: 0.9, extra: 0.15, dustA: 0.0,
  });
  function mix(a, b, k) { var r = {}; for (var key in a) r[key] = a[key] + ((key in b ? b[key] : a[key]) - a[key]) * k; return r; }

  /* ---------- état GPU (créé une fois) ---------- */
  var S = null;
  function init(C) {
    if (S) return S.ready;
    var gl = C.gl;
    S = {};
    S.gas = C.program(C.VS_QUAD, FS_GAS);
    S.comp = C.program(C.VS_QUAD, FS_COMP);
    S.star = C.program(VS_STAR, FS_STAR);
    S.vao = gl.createVertexArray();
    S.scale = 0.5;
    S.target = C.target(Math.round(C.W * S.scale), Math.round(C.H * S.scale));
    var N = 128, data = buildNoise(N);
    S.noise = gl.createTexture();
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_3D, S.noise);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, N, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach(function (w) { gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT); });
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    S.ready = Promise.resolve();
    return S.ready;
  }
  function bindNoise(prog) {
    var gl = LK.cosmos.gl;
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_3D, S.noise); gl.activeTexture(gl.TEXTURE0);
    if (prog.u.uN) gl.uniform1i(prog.u.uN, 7);
  }
  function camU(gl, u, C, ph, P) {
    var mn = Math.min(C.W, C.H);
    if (u.uMin) gl.uniform1f(u.uMin, mn);
    if (u.uZ) gl.uniform1f(u.uZ, P.speed * ph);
    if (u.uW) gl.uniform1f(u.uW, P.evolve * ph);
    if (u.uZoom) gl.uniform1f(u.uZoom, P.zoom);
    if (u.uRoll) gl.uniform1f(u.uRoll, P.roll + P.rollRate * ph);
    if (u.uCam) gl.uniform2f(u.uCam, P.camX, P.camY);
    if (u.uLs) gl.uniform2f(u.uLs, P.lightX, P.lightY);
  }
  function drawGas(C, ph, P) {
    var gl = C.gl, g = S.gas, u = g.u, T = S.target;
    C.bind(T); gl.disable(gl.BLEND);
    gl.useProgram(g.p); bindNoise(g);
    gl.uniform2f(u.uRes, T.w, T.h);
    camU(gl, u, C, ph, P);
    u.uMin && gl.uniform1f(u.uMin, Math.min(T.w, T.h));
    gl.uniform1f(u.uWarp, P.warp); gl.uniform1f(u.uDens, P.dens); gl.uniform1f(u.uExpo, P.expo);
    gl.uniform1f(u.uLight, P.light); gl.uniform1f(u.uDust, P.dust); gl.uniform1f(u.uBg, P.bg);
    gl.uniform4f(u.uMix, P.pillar, P.vein, P.core, P.blue);
    gl.uniform4f(u.uCurt, P.curtain, P.curtY, P.stretch, P.drift);
    gl.uniform4f(u.uColl, P.collapse, P.swirl, P.flatten, P.fadeR);
    gl.uniform4f(u.uWave, P.wave, P.waveR, P.waveW, 0);
    gl.uniform2f(u.uWaveO, P.waveX, P.waveY);
    C.quad();
    /* composition */
    C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var c = S.comp; gl.useProgram(c.p);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.uniform1i(c.u.uG, 6); gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(c.u.uView, C.W, C.H); gl.uniform2f(c.u.uSrc, T.w, T.h);
    gl.uniform1f(c.u.uAlpha, P.alpha); gl.uniform3f(c.u.uHor, P.horizon, P.horizonSoft, 0);
    gl.uniform1f(c.u.uMin, Math.min(C.W, C.H));
    C.quad();
  }
  function drawStars(C, ph, P) {
    if (P.stars <= 0.001 && P.extra <= 0.001 && P.dustA <= 0.001) return;
    var gl = C.gl, s = S.star, u = s.u;
    C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(s.p);
    gl.uniform2f(u.uView, C.W, C.H);
    camU(gl, u, C, ph, P);
    gl.uniform1f(u.uExtra, P.extra); gl.uniform1f(u.uStarA, P.stars * P.alpha); gl.uniform1f(u.uDustA, P.dustA * P.alpha);
    gl.uniform1f(u.uStreak, P.streak); gl.uniform2f(u.uStreakC, P.streakX, P.streakY);
    gl.bindVertexArray(S.vao);
    gl.drawArrays(gl.TRIANGLES, 0, N_STARS * 6);
    gl.bindVertexArray(null);
  }
  function render(C, ph, P) { drawGas(C, ph, P); drawStars(C, ph, P); }
  /* Point X d'un plan de profondeur D (unités du gaz) → pixels, même caméra que les shaders. */
  function toScreen(C, ph, P, X, D) {
    var mn = Math.min(C.W, C.H), z = P.speed * ph, r = P.roll + P.rollRate * ph, k = 1 / Math.max(D - z, 0.05);
    var x = X[0] * k, y = X[1] * k, c = Math.cos(r), s = Math.sin(r);
    var px = P.camX + P.zoom * (c * x - s * y), py = P.camY + P.zoom * (s * x + c * y);
    return [px * mn + C.W / 2, C.H / 2 - py * mn];
  }

  LK.cosmos.gas = {
    PAL: PAL, lin: lin, GLSL: GLSL, NEBULA: NEBULA, AURORA: AURORA, mix: mix,
    init: init, render: render, drawGas: drawGas, drawStars: drawStars, toScreen: toScreen,
    bindNoise: function (prog) { bindNoise(prog); }, state: function () { return S; },
  };
})();
