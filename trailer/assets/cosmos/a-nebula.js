/* a-nebula.js — cosmos, équipe A, 0,00 → 2,25 s (order 0–9).
   0,00 nébuleuse plein cadre déjà en mouvement · 0,75 onde · 0,90–1,50 effondrement en spirale, disque ambre
   · 1,500 naissance du Soleil (éclat à 6 branches) · 1,50–2,00 sillons, grains agglomérés · 1,75–2,25 plongée en
   spirale vers la proto-Terre, Saturne puis Jupiter en flou de mouvement. Raccord équipe B : à 2,00 la proto-Terre
   (dessinée par B, order ≥ 10) est au centre du cadre, rayon 3 % de C.H ; on ne dessine plus de Terre à partir de 2,00.
   Tout est fonction fermée de t ; graine LKDV (1783). */
(function () {
  "use strict";
  var LK = window.LKDV, CO = LK.cosmos, G = CO.gas;
  var T_WAVE = 0.75, T_SUN = 1.5, T_RACCORD = 2.0, T_END = 2.25;
  var NP = 60000;                         // particules du disque
  var K = 0.8;                            // rotation képlérienne adoucie : ω = K / (r^1.5 + 0.04)
  var GAPS = [0.34, 0.56, 0.80];          // sillons (orbites des futures planètes) ; 0.34 = proto-Terre
  var R_E = GAPS[0], A_E = 2.35;          // orbite et phase de la proto-Terre
  var EARTH_R = 0.012;                    // rayon « monde » de la proto-Terre (calé pour 3 % de C.H à 2,00)
  var FOCAL = 1.15;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function v3(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return mul(a, 1 / l); }
  function omega(r) { return K / (Math.pow(r, 1.5) + 0.04); }
  function tau(t) { return Math.max(t - T_WAVE, 0); }
  function earthPos(t) { var a = A_E + omega(R_E) * tau(t); return v3(R_E * Math.cos(a), 0, R_E * Math.sin(a)); }

  /* ---------- caméra 3D du disque (soleil à l'origine, disque dans le plan y = 0) ---------- */
  var mnRef = 1;
  function camAt(t, C) {
    var mn = Math.min(C.W, C.H), targetRp = 0.03 * C.H / mn;     // rayon apparent voulu à 2,00 (unités « min »)
    var el = lerp(1.25, 0.40, sstep(0.80, 1.65, t)), az = -0.5 + 0.30 * t;
    var dist = lerp(3.0, 2.3, sstep(0.80, 1.70, t));
    var orbitPos = v3(dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az));
    var target = v3(0, 0, 0), pos = orbitPos, roll = 0;
    var sx = lerp(G.NEBULA.lightX, 0, sstep(0.9, 1.45, t)), sy = lerp(G.NEBULA.lightY, 0, sstep(0.9, 1.45, t));
    if (t > 1.75) {
      /* plongée : zoom logarithmique, position qui tourne vers une poursuite de la proto-Terre */
      var E = earthPos(t), s1 = sstep(1.75, 2.0, t);
      var dEnd = EARTH_R * FOCAL / targetRp;                      // distance pour 3 % de C.H à 2,00
      var g = function (x) { x = Math.max(x - 1.75, 0); return x - 0.07 * (1 - Math.exp(-x / 0.07)); };
      var rate = Math.log(2.3 / dEnd) / g(2.0);
      var d = 2.3 * Math.exp(-rate * g(t));
      var a = A_E + omega(R_E) * tau(t);
      var tang = v3(-Math.sin(a), 0, Math.cos(a)), radial = v3(Math.cos(a), 0, Math.sin(a));
      var chase = norm(add(add(mul(tang, -0.75), v3(0, 0.62, 0)), mul(radial, 0.35)));
      var o0 = norm(orbitPos);
      var dir = norm(add(mul(o0, 1 - s1), mul(chase, s1)));
      target = mul(E, s1);
      pos = add(target, mul(dir, d));
      roll = 1.9 * Math.pow(Math.max(t - 1.75, 0), 2) * 4.0;
    }
    var fwd = norm(sub(target, pos));
    var right = norm(cross(fwd, v3(0, 1, 0)));
    var up = cross(right, fwd);
    var c = Math.cos(roll), s = Math.sin(roll);
    var r2 = add(mul(right, c), mul(up, s)), u2 = sub(mul(up, c), mul(right, s));
    return { pos: pos, fwd: fwd, right: r2, up: u2, f: FOCAL, sx: sx, sy: sy, mn: mn };
  }
  function project(cam, P) { var d = sub(P, cam.pos), z = dot(d, cam.fwd); return [cam.sx + dot(d, cam.right) / z * cam.f, cam.sy + dot(d, cam.up) / z * cam.f, z]; }
  function camUniforms(gl, u, cam, pre) {
    pre = pre || "";
    gl.uniform3fv(u["uCP" + pre], cam.pos); gl.uniform3fv(u["uCF" + pre], cam.fwd);
    gl.uniform3fv(u["uCR" + pre], cam.right); gl.uniform3fv(u["uCU" + pre], cam.up);
    if (u["uS" + pre]) gl.uniform2f(u["uS" + pre], cam.sx, cam.sy);
  }

  /* ---------- particules du disque : quads indexés, position fermée de (i, t), traînée = obturateur ---------- */
  var VS_P = "#version 300 es\n" + G.GLSL + "\n" + [
    "uniform float uT, uT0, uK, uMin, uA; uniform vec2 uView; uniform float uF;",
    "uniform vec3 uCP, uCF, uCR, uCU; uniform vec2 uS; uniform vec3 uCP0, uCF0, uCR0, uCU0; uniform vec2 uS0;",
    "uniform vec3 uGaps; uniform float uAE;",
    "out vec2 vL; out float vI; out vec3 vC; flat out vec2 vR;",
    "float omg(float r){ return uK/(pow(r,1.5)+0.04); }",
    "vec3 ppos(uint u, float t){",
    "  float h1=h01(u,11u), h2=h01(u,12u), h3=h01(u,13u), h4=h01(u,14u), h5=h01(u,15u), h6=h01(u,16u), h7=h01(u,17u);",
    "  float rI = 0.06 + 1.0*pow(h1, 0.85);",
    "  float tau = max(t-0.75, 0.0);",
    "  float th = 6.2832*h2 + omg(rI)*tau;",
    "  float cz = 2.0*h3-1.0, sz = sqrt(1.0-cz*cz), ph = 6.2832*h4; float rc = 1.7*pow(h5, 0.4);",
    "  vec3 P0 = vec3(sz*cos(ph), cz*0.8, sz*sin(ph))*rc;",
    "  float c = smoothstep(0.80, 1.55, t); c = c*c*(3.0-2.0*c);",
    "  float r0 = length(P0.xz);",
    "  float r = mix(r0, rI, c);",
    "  float a0 = atan(P0.z, P0.x);",
    "  float a = mix(a0 + 0.6*tau, th, c);",
    "  float y = mix(P0.y, (h6-0.5)*0.035*rI, c);",
    /* sillons et agglomération : après 1,5 s */
    "  float g = smoothstep(1.50, 1.90, t);",
    "  for (int k = 0; k < 3; k++) { float rg = uGaps[k]; float dd = rI - rg;",
    "    if (abs(dd) < 0.045) {",
    "      float ac = uAE + float(k)*2.1 + omg(rg)*tau;",
    "      if (h7 < 0.45) { float agg = g*smoothstep(0.045, 0.0, abs(dd)*0.6);",
    "        float da = mod(a - ac + 3.14159, 6.28318) - 3.14159;",
    "        a = ac + da*(1.0 - 0.985*agg); r = mix(r, rg + dd*0.15, agg); y *= 1.0 - agg; }",
    "      else { r += sign(dd)*g*(0.045 - abs(dd))*0.9; }",
    "    } }",
    "  return vec3(r*cos(a), y, r*sin(a));",
    "}",
    "vec3 proj(vec3 P, vec3 cp, vec3 cf, vec3 cr, vec3 cu, vec2 s){ vec3 d=P-cp; float z=dot(d,cf); return vec3(s + vec2(dot(d,cr), dot(d,cu))/max(z,1e-3)*uF, z); }",
    "void main(){",
    "  int id = gl_VertexID/6, cn = gl_VertexID - id*6; uint u = uint(id);",
    "  vec3 P1 = ppos(u, uT), P0 = ppos(u, uT0);",
    "  vec3 a = proj(P1, uCP, uCF, uCR, uCU, uS), b = proj(P0, uCP0, uCF0, uCR0, uCU0, uS0);",
    "  vec2 pa = a.xy*uMin + 0.5*uView, pb = b.xy*uMin + 0.5*uView;",
    "  float s = uMin/1080.0;",
    "  float h8 = h01(u, 18u), h9 = h01(u, 19u), h1 = h01(u, 11u);",
    "  float rad = (0.9 + 1.2*h8*h8)*s*clamp(1.6/max(a.z, 0.05), 0.6, 6.0);",
    "  vec2 dv = pa - pb; float len = length(dv); vec2 dir = len > 1e-3 ? dv/len : vec2(1.0, 0.0);",
    "  len = min(len, 400.0*s);",
    "  vec2 nrm = vec2(-dir.y, dir.x);",
    "  float ext = rad*2.5 + 1.0;",
    "  vec2 cv = vec2(cn==1||cn==2||cn==4 ? 1.0 : -1.0, cn==2||cn==4||cn==5 ? 1.0 : -1.0);",
    "  vec2 ctr = pa - dir*len*0.5;",
    "  vL = vec2(cv.x*(ext + len*0.5), cv.y*ext); vR = vec2(rad, len);",
    "  float rI = 0.06 + pow(h1, 0.85);",
    "  vec3 c = mix(mix(STONE, GOLD, 0.5), AMBER, smoothstep(0.08, 0.40, rI));",
    "  c = mix(c, mix(BRICK, AMBER, 0.4), smoothstep(0.45, 0.95, rI)*h9);",
    "  if (h9 > 0.93) c = mix(SAGE_L, STONE, 0.4);",
    "  float I = uA*(0.35 + 0.65*h8)*(a.z > 0.02 && b.z > 0.02 ? 1.0 : 0.0);",
    "  vI = I; vC = c;",
    "  vec2 fp = I > 0.0 ? ctr + dir*(cv.x*(ext + len*0.5)) + nrm*(cv.y*ext) : vec2(-100.0);",
    "  gl_Position = vec4(fp/uView*2.0 - 1.0, 0.0, 1.0);",
    "}",
  ].join("\n");
  var FS_P = "#version 300 es\n" + G.GLSL + "\n" + [
    "in vec2 vL; in float vI; in vec3 vC; flat in vec2 vR; out vec4 o;",
    "void main(){",
    "  vec2 v = vec2(max(abs(vL.x) - vR.y*0.5, 0.0), vL.y);",
    "  float d = length(v);",
    "  float I = vI*exp(-d*d/(vR.x*vR.x))*clamp((vR.x*2.0)/(vR.y + vR.x*2.0), 0.08, 1.0);",
    "  float a = clamp(I, 0.0, 1.0)*0.85;",
    "  o = vec4(toSRGB(vC)*a, a);",
    "}",
  ].join("\n");

  /* ---------- gaz du disque (émission + absorption), même rotation képlérienne que les grains ---------- */
  var FS_DISK = "#version 300 es\n" + G.GLSL + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uView; uniform float uMin, uF, uTau, uK, uA, uGap, uHot;",
    "uniform vec3 uCP, uCF, uCR, uCU; uniform vec2 uS; uniform vec3 uGaps;",
    "void main(){",
    "  vec2 p = (gl_FragCoord.xy - 0.5*uView)/uMin - uS;",
    "  vec3 rd = normalize(uCF*uF + uCR*p.x + uCU*p.y);",
    "  if (abs(rd.y) < 1e-4 || (-uCP.y/rd.y) <= 0.0) { o = vec4(0.0); return; }",
    "  vec3 X = uCP + rd*(-uCP.y/rd.y);",
    "  float r = length(X.xz), th = atan(X.z, X.x);",
    "  float ths = th - uK*uTau/(pow(r, 1.5) + 0.04);",
    "  vec2 xy = vec2(cos(ths), sin(ths))*r;",
    "  float n = fbm(vec3(xy*3.2, r*1.5 + 4.0), 4);",
    "  float n2 = fbm(vec3(xy*10.0, 9.0), 2);",
    "  float prof = smoothstep(0.02, 0.10, r)*exp(-r/0.55)*(1.0 - smoothstep(0.85, 1.15, r));",
    "  for (int k = 0; k < 3; k++) prof *= 1.0 - uGap*0.9*exp(-pow((r - uGaps[k])/0.024, 2.0));",
    "  float dens = prof*clamp(0.45 + 0.9*n + 0.3*n2, 0.0, 2.0);",
    "  float lanes = smoothstep(0.15, -0.25, n)*prof;",
    "  vec3 c = mix(mix(STONE, GOLD, 0.6), AMBER, smoothstep(0.05, 0.35, r));",
    "  c = mix(c, BRICK*0.9 + AMBER*0.2, smoothstep(0.45, 1.0, r));",
    "  float thick = clamp(0.35/(abs(rd.y) + 0.12), 0.8, 2.6);",
    "  vec3 col = c*dens*2.2*thick*(1.0 + uHot*2.5*exp(-r/0.12));",
    "  float a = clamp(dens*1.6*thick + lanes*0.5, 0.0, 1.0)*uA;",
    "  col = vec3(1.0) - exp(-col);",
    "  o = vec4(toSRGB(col)*uA, a);",
    "}",
  ].join("\n");

  /* ---------- Soleil : proto-étoile, flash à 1,500, éclat à 6 branches, lueur ; plus la proto-Terre avant 2,00 ---------- */
  var FS_SUN = "#version 300 es\n" + G.GLSL + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uView; uniform float uMin; uniform vec3 uSun; uniform float uGlow, uFlash, uSpike, uRot;",
    "uniform vec4 uEarth;  // x, y (px), rayon (px), intensité",
    "void main(){",
    "  vec2 fc = gl_FragCoord.xy; float s = uMin/1080.0;",
    "  vec2 d = fc - uSun.xy; float r = length(d)/s;",
    "  vec3 col = vec3(0.0); float a = 0.0;",
    "  if (uSun.z > 0.0) {",
    "    float core = exp(-r*r/(14.0*14.0*(0.4 + uGlow)));",
    "    float halo = exp(-r/(45.0 + 160.0*uFlash))*0.9 + exp(-r/(200.0 + 700.0*uFlash))*0.25*uFlash;",
    "    float sp = 0.0;",
    "    for (int k = 0; k < 3; k++) { float an = uRot + 1.5708 + float(k)*1.0472; vec2 dr = vec2(cos(an), sin(an));",
    "      float al = abs(dot(d, dr))/s, pe = abs(dot(d, vec2(-dr.y, dr.x)))/s;",
    "      sp += exp(-pe/(1.2 + al*0.010))*exp(-al/(uSpike*0.30 + 1.0)); }",
    "    float an2 = uRot; vec2 d2 = vec2(cos(an2), sin(an2));",
    "    sp += 0.4*exp(-abs(dot(d, vec2(-d2.y, d2.x)))/s/0.9)*exp(-abs(dot(d, d2))/s/(uSpike*0.12 + 1.0));",
    "    float I = uGlow*(core*3.0 + halo) + uSpike*0.004*sp*(0.6 + uFlash) + uFlash*uFlash*2.2*exp(-r/420.0);",
    "    col = mix(mix(GOLD, AMBER, 0.3), STONE, clamp(core + uFlash*exp(-r/500.0), 0.0, 1.0))*I + mix(AMBER, GOLD, 0.55)*uFlash*uFlash*0.35;",
    "    a = 1.0 - exp(-I - uFlash*uFlash*0.35);",
    "  }",
    "  if (uEarth.w > 0.0) {",
    "    float re = length(fc - uEarth.xy)/max(uEarth.z, 0.5);",
    "    float disc = smoothstep(1.05, 0.9, re);",
    "    float glow = exp(-max(re - 1.0, 0.0)*2.2)*0.6;",
    "    vec3 ec = mix(BRICK_L*1.6, BRICK, smoothstep(0.0, 1.0, re)) * disc + mix(BRICK, AMBER, 0.3)*glow;",
    "    float ea = clamp(disc + glow*0.5, 0.0, 1.0)*uEarth.w;",
    "    col = col*(1.0 - ea) + ec*uEarth.w; a = a + ea*(1.0 - a);",
    "  }",
    "  vec3 c = vec3(1.0) - exp(-col*1.2);",
    "  o = vec4(toSRGB(c)*clamp(a, 0.0, 1.0)/max(a, 1e-4)*clamp(a, 0.0, 1.0), clamp(a, 0.0, 1.0));",
    "}",
  ].join("\n");

  /* ---------- planètes : sphères ombrées à bandes procédurales, flou de mouvement par 8 sous-échantillons ---------- */
  var FS_PL = "#version 300 es\n" + G.GLSL + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec4 uP0, uP1;   // centre px (x, y), rayon px, angle de roulis — début et fin de l'obturateur",
    "uniform vec3 uL; uniform float uKind, uRing;",
    "vec4 planet(vec2 fc, vec4 P){",
    "  vec2 q = (fc - P.xy)/P.z; q = rot2(q, -P.w);",
    "  vec4 res = vec4(0.0);",
    "  if (uKind > 0.5) {",          // anneaux de Saturne (ellipse inclinée)
    "    vec2 rq = vec2(q.x, q.y/0.28); float rr = length(rq);",
    "    float ring = smoothstep(1.35, 1.40, rr)*(1.0 - smoothstep(2.25, 2.30, rr));",
    "    ring *= 0.55 + 0.45*sin(rr*38.0) * 0.5 + 0.25*smoothstep(1.85, 1.9, rr)*(1.0 - smoothstep(1.95, 2.0, rr))*-2.0 + 0.3;",
    "    bool behind = q.y > 0.0 && length(q) < 1.0;",
    "    if (!behind && ring > 0.0) { vec3 rc = mix(GOLD, STONE, 0.4)*(0.5 + 0.6*clamp(-q.x*uL.x - q.y*uL.y + 0.6, 0.0, 1.0)); res = vec4(rc*ring*0.9, clamp(ring, 0.0, 1.0)*0.85); }",
    "  }",
    "  float r2 = dot(q, q);",
    "  if (r2 < 1.0) {",
    "    vec3 n = vec3(q, sqrt(1.0 - r2));",
    "    float lat = q.y + 0.06*n1(vec3(q*vec2(3.0, 9.0), uKind*7.0));",
    "    float b = n1(vec3(0.3, lat*(uKind > 0.5 ? 9.0 : 13.0), uKind*5.0 + 1.0));",
    "    vec3 base = uKind > 0.5 ? mix(GOLD, mix(STONE, AMBER, 0.3), 0.5 + 0.5*b) : mix(mix(STONE, GOLD, 0.4), mix(BRICK, AMBER, 0.5), 0.5 + 0.5*b);",
    "    if (uKind < 0.5) { float spot = exp(-dot((q - vec2(0.35, -0.28))*vec2(1.0, 2.4), (q - vec2(0.35, -0.28))*vec2(1.0, 2.4))/0.012); base = mix(base, BRICK, spot*0.8); }",
    "    float dif = clamp(dot(n, normalize(uL)), 0.0, 1.0);",
    "    vec3 c = base*(0.04 + 1.25*pow(dif, 0.8)) + mix(SLATE, STONE, 0.3)*0.10*pow(1.0 - n.z, 3.0);",
    "    float edge = smoothstep(1.0, 0.97, sqrt(r2));",
    "    if (uKind > 0.5) { vec2 rq = vec2(q.x, q.y/0.28); float rr = length(rq); if (q.y < 0.0 && rr > 1.35 && rr < 2.3) { } else {",
    "      float sh = smoothstep(0.05, 0.0, abs(q.y + 0.06 - 0.05*q.x))*0.0; c *= 1.0 - sh; } }",
    "    res = vec4(c, 1.0)*edge + res*(1.0 - edge);",
    "  }",
    "  return res;",
    "}",
    "void main(){",
    "  vec4 acc = vec4(0.0);",
    "  for (int k = 0; k < 8; k++) { float f = (float(k) + 0.5)/8.0; vec4 P = mix(uP0, uP1, f); vec4 s = planet(gl_FragCoord.xy, P);",
    "    acc += vec4(s.rgb*s.a, s.a); }",
    "  acc /= 8.0;",
    "  vec3 c = vec3(1.0) - exp(-acc.rgb/max(acc.a, 1e-4)*1.3);",
    "  o = vec4(toSRGB(c)*acc.a, acc.a);",
    "}",
  ].join("\n");

  var S = {};
  /* Trajectoires des planètes (unités « min », centre du cadre) : elles naissent près du point de fuite et filent vers les bords. */
  function planetAt(kind, t, C, cam) {
    var t0 = kind ? 1.78 : 1.86, t1 = kind ? 2.03 : 2.10;
    if (t < t0 || t > t1) return null;
    var dirA = kind ? 2.45 : -0.55;                         // Saturne vers le haut à gauche, Jupiter vers le bas à droite
    var z = lerp(1.0, 0.0, (t - t0) / (t1 - t0));
    var depth = 0.06 + 1.1 * z * z;
    var spin = 1.9 * Math.pow(Math.max(t - 1.75, 0), 2) * 4.0;
    var ang = dirA + spin * 0.5;
    var off = (kind ? 0.20 : 0.26) / depth;
    var R = (kind ? 0.045 : 0.060) / depth;
    var mn = Math.min(C.W, C.H);
    return { x: C.W / 2 + Math.cos(ang) * off * mn, y: C.H / 2 + Math.sin(ang) * off * mn, r: R * mn, roll: kind ? -0.35 + spin * 0.3 : spin * 0.3 };
  }

  CO.register({
    id: "a-nebula", order: 0, ranges: [[0, T_END]],
    init: function (C) {
      return G.init(C).then(function () {
        S.p = C.program(VS_P, FS_P);
        S.disk = C.program(C.VS_QUAD, FS_DISK);
        S.sun = C.program(C.VS_QUAD, FS_SUN);
        S.pl = C.program(C.VS_QUAD, FS_PL);
        S.vao = C.gl.createVertexArray();
      });
    },
    draw: function (C, t) {
      var gl = C.gl, mn = Math.min(C.W, C.H);
      var cam = camAt(t, C), SH = 1 / 120;                              // obturateur 180° à 60 i/s
      var cam0 = camAt(Math.max(t - SH, 0), C);

      /* 1. le gaz (la nébuleuse, puis son effondrement), réglages fonctions de t */
      var P = G.mix(G.NEBULA, {}, 0);
      var w = sstep(T_WAVE, T_WAVE + 0.05, t) * (1 - sstep(1.05, 1.30, t));
      P.wave = w * 0.6; P.waveR = 0.95 + Math.max(t - T_WAVE, 0) * 4.5;
      var kc = sstep(0.90, 1.50, t);
      P.collapse = kc; P.swirl = 1.2 * Math.pow(Math.max(t - 0.85, 0), 2); P.flatten = sstep(1.0, 1.5, t);
      P.fadeR = lerp(3.0, 0.45, kc);
      P.lightX = cam.sx; P.lightY = cam.sy;
      P.dens = 1 - 0.85 * sstep(1.15, 1.70, t);
      P.light = 1 - sstep(1.0, 1.35, t);
      P.pillar = 1 - sstep(0.95, 1.30, t);
      P.vein = 1 - 0.7 * sstep(1.1, 1.6, t);
      P.dustA = 1 - sstep(0.9, 1.2, t);
      P.stars = 1 - 0.45 * sstep(1.2, 1.6, t);
      /* plongée : traînées d'étoiles convergeant au centre (point de fuite = proto-Terre) */
      P.streak = 0.9 * sstep(1.85, 2.10, t); P.streakX = 0; P.streakY = 0;
      P.speed = G.NEBULA.speed; P.zoom = 1 + 1.6 * Math.pow(sstep(1.80, 2.25, t), 2);
      P.rollRate = G.NEBULA.rollRate; P.roll = 1.9 * Math.pow(Math.max(t - 1.75, 0), 2) * 4.0 * 0.5;
      G.render(C, t, P);

      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      var tauv = tau(t), gap = sstep(1.5, 1.9, t);

      /* 2. gaz du disque */
      var dA = sstep(1.05, 1.50, t) * (1 - 0.8 * sstep(1.70, 2.05, t));
      if (dA > 0) {
        var d = S.disk, u = d.u; gl.useProgram(d.p); G.bindNoise(d);
        gl.uniform2f(u.uView, C.W, C.H); gl.uniform1f(u.uMin, mn); gl.uniform1f(u.uF, cam.f);
        gl.uniform1f(u.uTau, tauv); gl.uniform1f(u.uK, K); gl.uniform1f(u.uA, dA);
        gl.uniform1f(u.uGap, gap); gl.uniform1f(u.uHot, sstep(1.3, 1.5, t) * (1 - sstep(1.75, 1.95, t)));
        gl.uniform3f(u.uGaps, GAPS[0], GAPS[1], GAPS[2]);
        camUniforms(gl, u, cam); C.quad();
      }
      /* 3. grains du disque (60 000) */
      var pA = sstep(0.82, 1.10, t);
      if (pA > 0) {
        var p = S.p, up = p.u; gl.useProgram(p.p);
        gl.uniform1f(up.uT, t); gl.uniform1f(up.uT0, Math.max(t - SH * (1 + 3 * sstep(1.8, 2.1, t)), 0)); gl.uniform1f(up.uK, K);
        gl.uniform1f(up.uMin, mn); gl.uniform1f(up.uA, pA * (1 - 0.55 * sstep(1.85, 2.05, t))); gl.uniform2f(up.uView, C.W, C.H); gl.uniform1f(up.uF, cam.f);
        gl.uniform3f(up.uGaps, GAPS[0], GAPS[1], GAPS[2]); gl.uniform1f(up.uAE, A_E);
        camUniforms(gl, up, cam); camUniforms(gl, up, cam0, "0");
        gl.bindVertexArray(S.vao); gl.drawArrays(gl.TRIANGLES, 0, NP * 6); gl.bindVertexArray(null);
      }
      /* 4. Soleil et proto-Terre */
      var sp = project(cam, [0, 0, 0]);
      var flash = t < T_SUN ? 0.45 * Math.exp((t - T_SUN) / 0.035) : Math.exp(-(t - T_SUN) / 0.09);
      var glow = sstep(1.05, 1.5, t) * (t < T_SUN ? 0.25 + 0.75 * sstep(1.3, 1.5, t) : 1.0);
      var spike = t < T_SUN ? 0 : (380 * Math.exp(-(t - T_SUN) / 0.35) + 140) * (1 - sstep(1.9, 2.15, t));
      var E = earthPos(t), ep = project(cam, E), eA = t < T_RACCORD ? sstep(1.55, 1.80, t) : 0;
      var s = S.sun, us = s.u; gl.useProgram(s.p);
      gl.uniform2f(us.uView, C.W, C.H); gl.uniform1f(us.uMin, mn);
      gl.uniform3f(us.uSun, sp[0] * mn + C.W / 2, sp[1] * mn + C.H / 2, sp[2] > 0.02 && glow > 0 ? 1 : 0);
      gl.uniform1f(us.uGlow, glow * (1 - 0.6 * sstep(1.85, 2.15, t))); gl.uniform1f(us.uFlash, flash); gl.uniform1f(us.uSpike, spike);
      gl.uniform1f(us.uRot, 0.18 + 0.2 * (t - T_SUN));
      gl.uniform4f(us.uEarth, ep[0] * mn + C.W / 2, ep[1] * mn + C.H / 2, EARTH_R * cam.f / Math.max(ep[2], 1e-3) * mn, ep[2] > 0.02 ? eA : 0);
      C.quad();
      /* 5. Saturne et Jupiter, en flou de mouvement */
      var lx = sp[0], ly = sp[1];
      for (var kind = 1; kind >= 0; kind--) {
        var a0 = planetAt(kind, t - SH * 2, C, cam0), a1 = planetAt(kind, t, C, cam);
        if (!a0 || !a1) continue;
        var pl = S.pl, ul = pl.u; gl.useProgram(pl.p); G.bindNoise(pl);
        var cx = (a1.x - C.W / 2) / mn, cy = (a1.y - C.H / 2) / mn;
        var L = norm([lx - cx, ly - cy, 0.55]);
        gl.uniform4f(ul.uP0, a0.x, a0.y, a0.r, a0.roll); gl.uniform4f(ul.uP1, a1.x, a1.y, a1.r, a1.roll);
        gl.uniform3f(ul.uL, L[0], L[1], L[2]); gl.uniform1f(ul.uKind, kind); gl.uniform1f(ul.uRing, kind);
        var ext = Math.max(a0.r, a1.r) * (kind ? 2.4 : 1.1) + 4;
        var x0 = Math.min(a0.x, a1.x) - ext, x1 = Math.max(a0.x, a1.x) + ext, y0 = Math.min(a0.y, a1.y) - ext, y1 = Math.max(a0.y, a1.y) + ext;
        x0 = clamp(Math.floor(x0), 0, C.W); x1 = clamp(Math.ceil(x1), 0, C.W); y0 = clamp(Math.floor(y0), 0, C.H); y1 = clamp(Math.ceil(y1), 0, C.H);
        if (x1 <= x0 || y1 <= y0) continue;
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0); C.quad(); gl.disable(gl.SCISSOR_TEST);
      }
    },
  });

  /* Outils de contrôle (aucun effet sur le rendu) : position de la proto-Terre et du Soleil à l'écran. */
  CO.nebulaDebug = { camAt: camAt, project: project, earthPos: earthPos };
})();
