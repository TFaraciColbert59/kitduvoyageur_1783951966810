/* LKDV trailer — lib/ouverture/ouverture.js (cosmos-vfx)
 * Ouverture « nébuleuse → création du système solaire → Terre d'aujourd'hui », 24 i/s, une seule caméra.
 * Lit window.LKDV_OUVERTURE (T_CREATION, T_SOLEIL, T_TERRE, DUREE, FPS) posé en tête de compositions/ouverture.html.
 *
 * Rendu WebGL2 en deux passes, chaque image est une fonction pure de son numéro :
 *   A. gaz (960×540) : nébuleuse en bruit fractal à domaine déformé, effondrement (chute radiale + rotation
 *      différentielle + aplatissement en disque), onde de choc de l'allumage, anneaux et sillons des planètes,
 *      voiles qui défilent pendant la plongée. Mipmaps → halo (bloom).
 *   B. composition (1920×1080) : gaz filé le long du mouvement de caméra, trois couches d'étoiles en parallaxe
 *      filées, Soleil (proto-étoile, éclair, couronne, traînée anamorphique), planètes et leurs traînées d'orbite,
 *      Terre (procédurale, puis plaque img01 fondue dans le disque), limbe, grade encre/crème, grain.
 * Caméra : similitude (point d'ancrage écran S, échelle Z en px par unité, roulis ψ) calculée en JS par intégration
 * à pas fixe (1/16 d'image) depuis l'image 0 : aucune horloge réelle, aucun Math.random().
 */
(function () {
  "use strict";
  var CFG = window.LKDV_OUVERTURE || { T_CREATION: 35, T_SOLEIL: 47, T_TERRE: 59, DUREE: 106, FPS: 24 };
  var TC = CFG.T_CREATION, TS = CFG.T_SOLEIL, TT = CFG.T_TERRE, D = CFG.DUREE, FPS = CFG.FPS || 24;
  var W = 1920, H = 1080, GW = 1920, GH = 1080; // gaz en pleine résolution : filaments nets
  var N = TT - TS; // images entre l'éclair et la Terre

  /* Plaque d'arrivée img01 : limbe mesuré (cercle ajusté sur 47 points du limbe bleu, écart max 5,6 px). */
  var PLATE = { C: [2369, 3986], R: 3862, sun: [1750, 182], F: [1480, 560] };
  /* Arrivée : la caméra tombe vers les Alpes (F d'img01), qui glissent vers AIM_END ; img02 (Dolomites au lever)
   * est emboîtée dans img01 autour de F à l'échelle 1/IMG2_K et prend le relais quand la plaque devient trop douce. */
  var AIM_END = [1010, 610], IMG2_K = 4.2, ROLL_END = 8;
  var Z0 = 330; // px par unité (rayon de l'orbite terrestre = 1)
  var RHO = 0.005; // rayon de la Terre en unités
  var TILT = -0.26, CI = 0.36; // inclinaison du disque (roulis apparent, cos de l'inclinaison)
  var SHUTTER = 0.5; // obturateur 180° (en images)
  var PLAN = [
    { r: 0.38, c: [1.0, 0.86, 0.62], s: 1.7, ph: 0.4 },
    { r: 0.66, c: [1.0, 0.93, 0.78], s: 2.3, ph: 2.6 },
    { r: 1.0, c: [0.35, 0.72, 1.0], s: 2.6, ph: 0 }, // Terre
    { r: 1.48, c: [1.0, 0.66, 0.46], s: 2.0, ph: 4.1 },
    { r: 2.2, c: [1.0, 0.8, 0.5], s: 3.6, ph: 1.3 },
    { r: 2.95, c: [0.78, 0.84, 1.0], s: 3.0, ph: 5.2 },
  ];
  var LAYERS = [ // couches en parallaxe : p = exposant d'échelle, g = part de la translation suivie
    { p: 0.07, g: 0.12 }, { p: 0.17, g: 0.28 }, { p: 0.33, g: 0.5 }, { p: 0.42, g: 0.6 } /* gaz de fond */,
    { p: 1.75, g: 1.0 } /* 4 : voiles et poussières au premier plan */, { p: 2.5, g: 1.0 } /* 5 : étoiles proches qui passent */,
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ramp(a, b, v) { return b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a), 0, 1); }
  function sm(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rot(v, ang) { var c = Math.cos(ang), s = Math.sin(ang); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; }

  /* ---------- Courbes maîtresses (toutes normalisées sur les repères) ---------- */
  function bump(u) { return sm(ramp(0.3, 0.66, u)) * (1 - sm(ramp(0.7, 1.0, u))); }
  var V_END = 0.014;
  function vBase(fr) { // vitesse de poussée (ln Z par image) hors bosse de plongée
    if (fr < TC) return 0.021;
    if (fr < TS) return 0.021 + 0.014 * sm(ramp(TC, TS, fr));
    if (fr < TT) return lerp(0.035, V_END, ramp(TS, TT, fr));
    return V_END + 0.08 * Math.pow(ramp(TT, D - 1, fr), 2.2); // la chute s'amorce : poussée qui accélère vers les Alpes
  }
  function omega(fr) { // vitesse angulaire (rad/image à r = 1) du gaz puis des planètes
    if (fr < TC) return 0.011;
    if (fr < TS) return 0.011 + 0.285 * Math.pow(ramp(TC, TS, fr), 2);
    if (fr < TT) return 0.296 * (1 - sm(ramp(0.25, 0.92, ramp(TS, TT, fr))));
    return 0;
  }
  var STEP = 1 / 16, NT = Math.ceil((D + 2) / STEP) + 1;
  var tabL = new Float64Array(NT), tabSw = new Float64Array(NT);
  (function () {
    var Ltarget = Math.log(PLATE.R / (RHO * Z0));
    var LTS = 0, Ib = 0, Ibase = 0, i, fr;
    for (i = 0; i < NT - 1; i++) {
      fr = i * STEP + STEP / 2;
      if (fr < TS) LTS += vBase(fr) * STEP;
      else if (fr < TT) { Ibase += vBase(fr) * STEP; Ib += bump(ramp(TS, TT, fr)) * STEP; }
    }
    var amp = (Ltarget - LTS - Ibase) / Ib;
    tabL[0] = 0; tabSw[0] = 0;
    for (i = 1; i < NT; i++) {
      fr = (i - 0.5) * STEP;
      var v = vBase(fr) + (fr >= TS && fr < TT ? amp * bump(ramp(TS, TT, fr)) : 0);
      tabL[i] = tabL[i - 1] + v * STEP;
      tabSw[i] = tabSw[i - 1] + omega(fr) * STEP;
    }
  })();
  function look(tab, fr) {
    var x = clamp(fr, 0, D + 1) / STEP, i = Math.floor(x), t = x - i;
    if (i >= NT - 1) return tab[NT - 1];
    return tab[i] + (tab[i + 1] - tab[i]) * t;
  }
  function psiAt(fr) { // roulis (rad)
    var d;
    if (fr < TC) d = -2 * ramp(0, TC, fr);
    else if (fr < TS) d = -2 - 3 * sm(ramp(TC, TS, fr));
    else if (fr < TT) d = -5 + 5 * sm(ramp(TS, TT, fr));
    else { var u = ramp(TT, D - 1, fr); d = ROLL_END * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2); }
    return (d * Math.PI) / 180;
  }
  function diskToWorld(r, phi) { return rot([r * Math.cos(phi), r * Math.sin(phi) * CI], TILT); }

  /* Phase finale de la Terre : vue depuis le Soleil, elle doit être dans la direction (F − soleil) de la plaque,
   * pour que la plongée garde le Soleil en haut à droite et l'y pose sur le limbe d'img01. */
  var PHI_E_T = (function () {
    var dx = PLATE.F[0] - PLATE.sun[0], dy = PLATE.F[1] - PLATE.sun[1], dl = Math.hypot(dx, dy);
    dx /= dl; dy /= dl;
    var best = 0, bd = -2;
    for (var k = 0; k < 7200; k++) {
      var ph = (k / 7200) * Math.PI * 2, w = diskToWorld(1, ph), l = Math.hypot(w[0], w[1]);
      var d = (w[0] * dx + w[1] * dy) / l;
      if (d > bd) { bd = d; best = ph; }
    }
    return best;
  })();
  var SW_T = look(tabSw, TT);
  var UF = [(PLATE.F[0] - PLATE.C[0]) / PLATE.R, (PLATE.F[1] - PLATE.C[1]) / PLATE.R];
  function planetPhase(i, fr) {
    var sw = look(tabSw, fr), P = PLAN[i];
    if (i === 2) return PHI_E_T - (SW_T - sw);
    return P.ph + sw * Math.pow(P.r, -1.5);
  }

  /* Caméra principale (plan du système) à l'image fr. */
  var FB0 = TS + 0.3 * N;
  var G0 = null;
  function mainCam(fr) {
    var L = look(tabL, fr), Z = Z0 * Math.exp(L), psi = psiAt(fr);
    var E = diskToWorld(1, planetPhase(2, fr));
    var Fw = [E[0] + RHO * UF[0], E[1] + RHO * UF[1]];
    var a = sm(ramp(TS + 0.1 * N, TS + 0.45 * N, fr)), b = sm(ramp(FB0, TS + 0.6 * N, fr));
    var A = [a * Fw[0], a * Fw[1]];
    var ZA = rot([Z * A[0], Z * A[1]], psi);
    var nat = [960 + ZA[0], 540 + ZA[1]];
    var G;
    if (fr < TT) {
      if (!G0) { // position naturelle de la Terre quand la caméra commence à la viser
        var Lb = look(tabL, FB0), Zb = Z0 * Math.exp(Lb), Eb = diskToWorld(1, planetPhase(2, FB0));
        var ab = sm(ramp(TS + 0.1 * N, TS + 0.45 * N, FB0)), Fb = [ab * (Eb[0] + RHO * UF[0]), ab * (Eb[1] + RHO * UF[1])];
        var q = rot([Zb * Fb[0], Zb * Fb[1]], psiAt(FB0));
        // la Terre entière (pas seulement ab·F) : sa vraie position écran
        var qe = rot([Zb * Eb[0], Zb * Eb[1]], psiAt(FB0));
        G0 = [960 + qe[0], 540 + qe[1]];
        void q;
      }
      var u = ramp(FB0, TT, fr), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      G = [lerp(G0[0], PLATE.F[0], e), lerp(G0[1], PLATE.F[1], e)];
    } else {
      var ua = ramp(TT, D - 1, fr), ea = ua < 0.5 ? 2 * ua * ua : 1 - Math.pow(-2 * ua + 2, 2) / 2;
      G = [lerp(PLATE.F[0], AIM_END[0], ea), lerp(PLATE.F[1], AIM_END[1], ea)];
    }
    var S = [lerp(nat[0], G[0], b), lerp(nat[1], G[1], b)];
    function toScreen(w) { var v = rot([Z * (w[0] - A[0]), Z * (w[1] - A[1])], psi); return [S[0] + v[0], S[1] + v[1]]; }
    var PE = toScreen(E), Rc = Z * RHO;
    // Soleil : position naturelle (bornée), puis accroché à la plaque (sur le limbe d'img01).
    var on = toScreen([0, 0]), off = [on[0] - S[0], on[1] - S[1]], ol = Math.hypot(off[0], off[1]);
    var lim = 700;
    if (ol > lim) { off = [(off[0] / ol) * lim, (off[1] / ol) * lim]; }
    var gk = Math.max(1, Rc / PLATE.R);
    // après T_TERRE le Soleil continue de monter au-dessus du limbe (vers l'extérieur du cercle d'img01)
    var rise = 70 * Math.pow(ramp(TT, D - 1, fr), 0.8), nx = PLATE.sun[0] - PLATE.C[0], ny = PLATE.sun[1] - PLATE.C[1], nl = Math.hypot(nx, ny);
    var sImg = [PLATE.sun[0] + (nx / nl) * rise, PLATE.sun[1] + (ny / nl) * rise];
    var goal = rot([(sImg[0] - PLATE.F[0]) * gk, (sImg[1] - PLATE.F[1]) * gk], psi);
    var ws = sm(ramp(TS + 0.45 * N, TT - 0.1 * N, fr));
    var sun = [S[0] + lerp(off[0], goal[0], ws), S[1] + lerp(off[1], goal[1], ws)];
    return { fr: fr, L: L, Z: Z, psi: psi, A: A, S: S, E: E, PE: PE, Rc: Rc, sun: sun, toScreen: toScreen };
  }

  /* Couches en parallaxe : intégrées à pas fixe depuis l'image 0 (zoom vers S, translation partielle). */
  var layerTab = LAYERS.map(function () { return { ox: new Float64Array(NT), oy: new Float64Array(NT), k: new Float64Array(NT) }; });
  (function () {
    var prev = mainCam(0);
    LAYERS.forEach(function (Ly, j) {
      layerTab[j].ox[0] = 960; layerTab[j].oy[0] = 540; layerTab[j].k[0] = Z0;
    });
    for (var i = 1; i < NT; i++) {
      var cur = mainCam(i * STEP);
      for (var j = 0; j < LAYERS.length; j++) {
        var Ly = LAYERS[j], T = layerTab[j];
        var k0 = Z0 * Math.pow(prev.Z / Z0, Ly.p), k1 = Z0 * Math.pow(cur.Z / Z0, Ly.p);
        var rel = rot([T.ox[i - 1] - prev.S[0], T.oy[i - 1] - prev.S[1]], cur.psi - prev.psi);
        var dS = [cur.S[0] - prev.S[0], cur.S[1] - prev.S[1]];
        var dl = Math.hypot(dS[0], dS[1]);
        if (dl > 60) { dS = [(dS[0] / dl) * 60, (dS[1] / dl) * 60]; }
        T.ox[i] = prev.S[0] + (k1 / k0) * rel[0] + Ly.g * dS[0];
        T.oy[i] = prev.S[1] + (k1 / k0) * rel[1] + Ly.g * dS[1];
        T.k[i] = k1;
      }
      prev = cur;
    }
  })();
  function layerCam(j, fr) {
    var T = layerTab[j];
    return { o: [look(T.ox, fr), look(T.oy, fr)], k: look(T.k, fr), psi: psiAt(fr) };
  }

  /* ---------- WebGL2 ---------- */
  var canvas = document.getElementById("ouverture-canvas");
  var plateImg = document.getElementById("ouverture-plate");
  var plate2Img = document.getElementById("ouverture-plate2");
  var gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });

  var VS = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  var COMMON = [
    "#version 300 es",
    "precision highp float;",
    "float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}",
    "vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}",
    "float h31(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}",
    "float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);",
    " return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*vn(p);p=m*p+vec2(3.1,7.7);a*=.5;}return s/.96875;}",
    "float fbm3o(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){s+=a*vn(p);p=m*p+vec2(3.1,7.7);a*=.5;}return s/.875;}",
    "float vn3(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);",
    " return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),u.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),u.x),u.y),",
    "  mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),u.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),u.x),u.y),u.z);}",
    "float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn3(p);p=p*2.03+vec3(1.7,9.2,3.3);a*=.5;}return s/.9375;}",
    "vec2 rotv(vec2 v,vec2 cs){return vec2(cs.x*v.x-cs.y*v.y,cs.y*v.x+cs.x*v.y);}",
    "vec2 rotInv(vec2 v,vec2 cs){return vec2(cs.x*v.x+cs.y*v.y,-cs.y*v.x+cs.x*v.y);}",
  ].join("\n");

  /* Passe A — gaz. */
  var FS_GAS = COMMON + "\n" + [
    "out vec4 o;",
    "uniform vec2 uS;uniform float uZ;uniform vec2 uA;uniform vec2 uR;",
    "uniform vec2 uBO;uniform float uBK;uniform vec2 uFO;uniform float uFK,uFgAmt;", // couche de fond, premier plan
    "uniform float uFr,uC,uFlat,uSwirl,uSwRate,uIgn,uDisk,uHeat,uGasAmt,uTun,uTunAmt,uTunBlue,uGap,uBack;",
    "uniform vec2 uTilt;uniform float uCi;uniform float uPR[6];",
    "const vec3 MAG=vec3(1.,.10,.52),VIO=vec3(.46,.15,1.),CYA=vec3(.04,.78,1.),GOL=vec3(1.,.64,.14),HOT=vec3(1.,.80,.48);",
    "vec3 gas(vec2 w,float sw){",
    " vec2 q=vec2(uTilt.x*w.x+uTilt.y*w.y,-uTilt.y*w.x+uTilt.x*w.y);",
    " q.y/=mix(1.,uCi,uFlat);",
    " float r=length(q)+1e-4,th=atan(q.y,q.x);",
    " float r0=r*exp(1.15*uC);",
    " float th0=th-sw*pow(r+.25,-1.5);",
    " vec2 p=r0*vec2(cos(th0),sin(th0))+vec2(uFr*.0035,uFr*.0055);",
    " vec2 wv=vec2(fbm(p*.8+vec2(1.7,9.2)+uFr*.016),fbm(p*.8+vec2(8.3,2.8)-uFr*.013));", // le gaz respire : la déformation évolue lentement
    " float n=fbm(p*1.25+2.2*wv);",
    " float n2=fbm(p*2.6-1.6*wv+5.3);",
    " float zone=fbm3o(p*.33+11.);",
    " float env=exp(-pow(r0/2.8,2.));",
    " float dens=env*(smoothstep(.3,.82,n)*1.15+.3*smoothstep(.25,.9,n2))+.05*env;",
    " dens=pow(dens,1.15)*1.2;", // contraste local
    " float rid=1.-abs(2.*fbm(p*4.3+wv*2.4+3.7)-1.);float fil=pow(rid,5.)*env*.8;", // filaments nets
    " float rid2=1.-abs(2.*fbm(p*9.+wv*3.+17.)-1.);fil+=.12*pow(rid2,8.)*env;",
    " float lane=smoothstep(.545,.6,fbm(p*2.2+wv*1.7+21.))*smoothstep(.2,.9,env*3.);", // couloirs de poussière découpés
    " vec3 col=mix(VIO,MAG,smoothstep(.36,.62,zone));",
    " col=mix(col,CYA,smoothstep(.5,.74,wv.y)*.9);",
    " col=mix(col,GOL,smoothstep(.6,.86,n)*.75);",
    " float dust=smoothstep(.5,.74,fbm(p*1.9+2.6*wv+13.));",
    " dens*=1.-.8*dust*(1.-.6*uDisk);",
    " dens*=1.-.8*lane*(1.-uDisk);",
    " dens*=1.+1.5*uC*exp(-r*1.3);",
    // disque : anneaux, sillons des planètes, cavité et chaleur près du Soleil
    " float ring=.62+.38*sin(r*34.+n*6.);",
    " float gaps=1.;for(int i=0;i<6;i++){gaps*=1.-uGap*.85*exp(-pow((r-uPR[i])/(.035+.02*uPR[i]),2.));}",
    " dens*=mix(1.,ring*gaps*(1.+1.4*exp(-pow((r-1.2)/1.3,2.))),uDisk);",
    " col=mix(col,mix(GOL,HOT,exp(-r/.35)),uHeat*exp(-r/.9));",
    " col=mix(col,mix(vec3(1.,.5,.62),GOL,.4),uDisk*.5*smoothstep(.9,1.7,r));", // anneau extérieur rosé-or, pas kaki
    " float ig=clamp(uIgn/3.,0.,1.);",
    " dens*=mix(1.,smoothstep(.06,.28,r),ig);",
    " vec3 e=col*dens+mix(col,vec3(1.,.9,.85),.35)*fil*.95*(1.-.6*uDisk)*(1.-lane);",
    " if(uIgn>-.5){float rs=max(uIgn,0.)*.32+.05;float sh=exp(-pow((r-rs)/(.05+.025*max(uIgn,0.)),2.))*exp(-max(uIgn,0.)/5.);e+=HOT*sh*(.6+1.2*n)*1.6;}",
    " return e;}",
    "void main(){",
    " vec2 s=vec2(gl_FragCoord.x,1080.-gl_FragCoord.y);",
    " vec2 w=uA+rotInv(s-uS,uR)/uZ;",
    " vec3 e=vec3(0.);",
    " int ns=uSwRate>.02?3:1;",
    " for(int k=0;k<3;k++){if(k>=ns)break;e+=gas(w,uSwirl-float(k)*uSwRate*.25);}",
    " e/=float(ns);",
    " e*=uGasAmt*1.15;",
    // fond lointain (parallaxe) : voiles sarcelle/violet, jamais de noir pur
    " vec2 wb=rotInv(s-uBO,uR)/uBK;",
    " float nb=fbm(wb*.7+40.);float nb2=fbm(wb*1.6-nb*1.5+3.);",
    " vec3 bc=mix(vec3(.10,.30,.55),vec3(.42,.12,.55),smoothstep(.35,.65,nb2));",
    " e+=bc*smoothstep(.35,.85,nb)*.32*uBack;",
    " if(uFgAmt>.001){vec2 wf=rotInv(s-uFO,uR)/uFK;vec2 fw=vec2(fbm(wf*.9+31.+uFr*.01),fbm(wf*.9+47.));",
    "  float fr1=1.-abs(2.*fbm(wf*2.1+fw*2.+5.)-1.);float ff=pow(fr1,9.);",
    "  float fd=smoothstep(.58,.74,fbm(wf*1.4+fw*1.5+9.));",
    "  vec3 fc=mix(MAG,GOL,smoothstep(.4,.7,fw.x));",
    "  e*=1.-.55*fd*uFgAmt;e+=fc*ff*1.0*uFgAmt;}",
    // voiles qui défilent pendant la plongée (tunnel de zoom)
    " if(uTunAmt>.001){vec2 rel=(s-uS)/700.;for(int i=0;i<3;i++){float ph=fract(uTun+float(i)/3.);float sc=exp2(ph*4.-1.);",
    "  float a=pow(sin(3.14159*ph),2.);vec2 rr=rel/sc;float wsp=fbm(rr*1.4+float(i)*17.3+vec2(fbm(rr*.7+float(i)),0.)*2.);",
    "  vec3 tc=mix(mix(MAG,VIO,float(i)*.5),vec3(.45,.75,1.),uTunBlue);",
    "  e+=tc*smoothstep(.55,.9,wsp)*a*uTunAmt*.9*smoothstep(.0,.35,length(rel));}}",
    " o=vec4(1.-exp(-max(e,0.)*.5),1.);}", // encodage doux : pas d'aplat écrêté dans les cœurs brillants
  ].join("\n");

  /* Passe B — composition. */
  var FS_MAIN = COMMON + "\n" + [
    "out vec4 o;",
    "uniform sampler2D uGas;uniform sampler2D uPlate;uniform sampler2D uPlate2;",
    "uniform vec2 uS;uniform float uZ;uniform vec2 uA;uniform vec2 uR;", // caméra principale (t)
    "uniform vec2 uSp;uniform float uZp;uniform vec2 uAp;uniform vec2 uRp;", // caméra principale (t − obturateur)
    "uniform vec2 uLO[3];uniform float uLK[3];uniform vec2 uLOp[3];uniform float uLKp[3];",
    "uniform float uFr;uniform vec2 uSun;uniform float uSunI,uProto,uFlash,uSunR;",
    "uniform vec2 uTilt;uniform float uCi;",
    "uniform float uPR[6],uPPhi[6],uPTrail[6],uPOn[6],uPSize[6];uniform vec3 uPCol[6];uniform vec2 uPHead[6];",
    "uniform vec2 uPE;uniform float uRc,uEarthTone,uPlateW,uPlateFull,uPlateOk,uStarAmt,uOrbAmt;",
    "uniform vec2 uPlF;uniform float uPlR;uniform float uW2,uW2Full,uK2,uZb,uClAmt,uClNear,uClPh,uBreath,uNearAmt;uniform vec2 uNO;uniform float uNK,uNKp;",
    "const vec3 INK=vec3(11.,31.,23.)/255.,CREAM=vec3(250.,248.,245.)/255.;",
    "float starLayer(vec2 w,float k,float cell,float seed){",
    " vec2 g=w/cell;vec2 i=floor(g);float acc=0.;",
    " for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=i+vec2(x,y);vec2 h=h22(c+seed);float b=h21(c*1.7+seed);",
    "  float cl=smoothstep(.45,.8,vn(c*cell*1.4+seed*3.));",
    "  b=pow(b,7.)*(.78+.22*sin(uFr*.9+h.x*40.))*(.5+1.6*cl);vec2 sp=(c+.15+.7*h)*cell;float d=length(w-sp)*k;float rad=.55+1.4*min(b,1.5);",
    "  acc+=(.08+.25*cl+3.*b)*exp(-d*d/(rad*rad))+b*.35*exp(-d/(rad*5.));}",
    " return acc;}",
    "vec3 earthProc(vec2 u,vec2 sd){",
    " float z=sqrt(max(0.,1.-dot(u,u)));vec3 n=vec3(u.x,-u.y,z);",
    " vec3 q=vec3(n.x*.8+n.z*.6,n.y,-n.x*.6+n.z*.8);",
    " vec3 wp=q*2.+.55*vec3(fbm3(q*3.+5.),fbm3(q*3.+9.),fbm3(q*3.+1.));",
    " float cont=fbm3(wp*1.1+vec3(3.1,1.7,.4))+.06*fbm3(q*14.);float land=smoothstep(.535,.55,cont);",
    " float det=fbm3(q*11.+2.);float det2=fbm3(q*26.);",
    " vec3 ocean=mix(vec3(.02,.085,.13),vec3(.04,.14,.19),smoothstep(.35,.53,cont));",
    " vec3 ground=mix(vec3(.10,.14,.14),vec3(.20,.23,.23),det*.7+det2*.3);",
    " ground=mix(ground,vec3(.09,.13,.10),smoothstep(.45,.7,fbm3(q*5.+7.))*.6);",
    " vec3 col=mix(ocean,ground,land);",
    " vec3 wq=q*vec3(3.,6.,3.)+1.8*vec3(fbm3(q*2.+11.),fbm3(q*2.+23.),0.);",
    " float cw=fbm3(wq)*.7+fbm3(wq*3.1+4.)*.3;",
    " float cloud=smoothstep(.56,.76,cw)*(.55+.45*smoothstep(.4,.7,fbm3(q*20.)));",
    " col=mix(col,vec3(.58,.64,.69),cloud*.9);",
    " vec3 l=normalize(vec3(sd.x,-sd.y,.6));",
    " float diff=clamp(dot(n,l)*.7+.42,0.,1.);col*=diff*1.1;",
    " float fres=pow(1.-z,2.5);float side=.5+.5*dot(normalize(u+1e-5),sd);",
    " col=mix(col,vec3(.3,.62,1.)*(.55+.7*side),fres*.8);",
    " return col;}",
    "vec3 plates(vec2 ss){",
    " vec2 rel=rotInv(ss-uS,uR)*(uPlR/uRc);",
    " vec3 c1=texture(uPlate,(uPlF+rel)/vec2(1920.,1080.)).rgb;",
    " if(uW2>.001){vec2 p2=vec2(960.,540.)+rel*uK2;vec2 q2=(p2-vec2(960.,540.))/vec2(960.,540.);",
    "  float m2=smoothstep(1.1,.5,length(q2))*smoothstep(.02,.3,p2.y/1080.);m2=max(m2,uW2Full*smoothstep(.04,.24,p2.y/1080.));",
    "  vec3 c2=texture(uPlate2,p2/vec2(1920.,1080.)).rgb*vec3(.86,.88,.92);",
    "  c1=mix(c1,c2,m2*uW2);}",
    " return c1;}",
    "void main(){",
    " vec2 s=vec2(gl_FragCoord.x,1080.-gl_FragCoord.y);",
    " float jit=h21(s+fract(uFr*.618)*91.);",
    // gaz filé : position où ce pixel était il y a un demi-pas d'image, échantillons le long du segment
    " vec2 wNow=uA+rotInv(s-uS,uR)/uZ;",
    " vec2 sPrev=uSp+rotv((wNow-uAp)*uZp,uRp);",
    " vec2 back=s+(s-sPrev);",
    " vec2 dv=back-s;float dl=length(dv);if(dl>320.)dv*=320./dl;",
    " vec3 gas=vec3(0.);",
    " for(int k=0;k<14;k++){float t=(float(k)+jit)/14.;vec2 ss=s+dv*t;gas-=log(max(1.-texture(uGas,vec2(ss.x/1920.,1.-ss.y/1080.)).rgb,vec3(.004)));}",
    " gas*=2./14.;",
    " vec3 bloom=textureLod(uGas,vec2(s.x/1920.,1.-s.y/1080.),5.5).rgb*1.1+textureLod(uGas,vec2(s.x/1920.,1.-s.y/1080.),7.).rgb*1.4;",
    " vec3 hdr=gas+bloom*.55;",
    // étoiles en parallaxe, filées
    " float cells[3]=float[3](.07,.10,.14);",
    " for(int j=0;j<3;j++){",
    "  vec2 w1=rotInv(s-uLO[j],uR)/uLK[j];vec2 sp=uS+(s-uS)*(uLKp[j]/uLK[j]);vec2 dd=s-sp;float L=length(dd);", // filé radial
    "  float acc=0.;for(int k=0;k<8;k++){float t=(float(k)+jit)/8.;vec2 ss=s+dd*t;vec2 ww=rotInv(ss-uLO[j],uR)/uLK[j];acc+=starLayer(ww,uLK[j],cells[j],float(j)*13.1);}",
    "  acc/=8.;acc*=1.+min(L,200.)/40.;",
    "  vec3 sc=mix(vec3(.72,.82,1.),vec3(1.,.88,.7),h21(floor(w1/(.05))+float(j)));",
    "  hdr+=sc*acc*uStarAmt*(.55+.25*float(j));}",
    " if(uNearAmt>.001){vec2 wn=rotInv(s-uNO,uR)/uNK;vec2 dn=(s-uS)*(1.-uNKp/uNK);float an=0.;",
    "  for(int k=0;k<6;k++){float t=(float(k)+jit)/6.;vec2 ww=rotInv(s-dn*t-uNO,uR)/uNK;vec2 g=ww/.75;vec2 i=floor(g);",
    "   for(int y=0;y<=1;y++)for(int x=0;x<=1;x++){vec2 c=i+vec2(x,y);vec2 h=h22(c+71.);if(h21(c+5.)<.45)continue;",
    "    vec2 sp=(c+.2+.6*h)*.75;vec2 dv=(ww-sp)*uNK;float d=length(dv);float bb=.8+2.2*h21(c+9.);",
    "    an+=bb*(exp(-d*d/5.)*2.5+exp(-d/14.)*.5+exp(-d/60.)*.12+exp(-abs(dv.x)/1.2)*exp(-abs(dv.y)/40.)*.5+exp(-abs(dv.y)/1.2)*exp(-abs(dv.x)/40.)*.5);}}",
    "  hdr+=vec3(1.,.93,.85)*an/6.*uNearAmt*(1.+min(length(dn),150.)/30.);}",
    // planètes : traînées d'orbite (arcs) et grains
    " vec2 wq=uA+rotInv(s-uS,uR)/uZ;",
    " vec2 q=vec2(uTilt.x*wq.x+uTilt.y*wq.y,-uTilt.y*wq.x+uTilt.x*wq.y);q.y/=uCi;",
    " float r=length(q),th=atan(q.y,q.x);",
    " float rpx=max(length(vec2(dFdx(r),dFdy(r))),1e-6);",
    " for(int i=0;i<6;i++){if(uPOn[i]<.001)continue;",
    "  float dr=abs(r-uPR[i])/rpx;",
    "  float ang=mod(uPPhi[i]-th,6.2831853);",
    "  float tl=max(uPTrail[i],1e-3);",
    "  float tr=exp(-ang/tl*2.2)*step(ang,tl*1.6)*exp(-dr*dr/(2.2+.8*uPSize[i]))*2.4;",
    "  float orb=exp(-dr*dr/1.2)*.05*uOrbAmt;",
    "  vec2 dh=s-uPHead[i];float hd=dot(dh,dh);",
    "  float head=exp(-hd/(uPSize[i]*uPSize[i]))*3.+.6*exp(-sqrt(hd)/(uPSize[i]*4.));",
    "  vec3 pc=uPCol[i];if(i==2)pc=mix(vec3(1.,.82,.5),vec3(.3,.66,1.),uEarthTone);",
    "  hdr+=pc*(tr+head+orb)*uPOn[i];}",
    // Soleil derrière (couronne douce) — la proto-étoile magenta-or puis l'étoile
    " vec2 ds=s-uSun;float d=length(ds);",
    " vec3 proto=mix(vec3(1.,.3,.6),vec3(1.,.7,.35),uProto)*uProto*(exp(-d/60.)*1.4+exp(-d/220.)*.5);",
    " hdr+=proto;",
    " vec3 ldr=1.-exp(-hdr*1.05);",
    // Terre
    " vec2 du=rotInv(s-uPE,uR)/uRc;float rr=length(du);",
    " vec2 sd=normalize(rotInv(uSun-uPE,uR)+vec2(1e-4));",
    " if(uRc>.6&&rr<1.2&&uPOn[2]>.001){",
    "  float m=clamp((1.-rr)*uRc+.5,0.,1.)*uPOn[2];",
    "  vec3 ec=vec3(0.);",
    "  if(rr<1.){ec=earthProc(du*min(1.,.999/max(rr,1e-4)*rr),sd);}",
    "  if(uPlateOk>.5&&uPlateW>.001){vec2 pu=uPlF+rotInv(s-uS,uR)*(uPlR/uRc);",
    "   float ed=min(min(pu.x,1920.-pu.x),min(pu.y,1080.-pu.y));float pe=max(smoothstep(-320.,-30.,ed),uPlateFull);", // plaque prolongée en miroir
    "   vec3 pc=vec3(0.);if(uZb>.002){for(int k=0;k<6;k++){float t=(float(k)+jit)/6.;pc+=plates(uS+(s-uS)*(1.-uZb*t));}pc/=6.;}else{pc=plates(s);}",
    "   if(uClAmt>.001&&rr<1.){vec2 rel=rotInv(s-uS,uR)*(uPlR/uRc)*pow(max(uRc/uPlR,1.),-.15)+vec2(uFr*1.1,uFr*.4);", // nuages qui dérivent, en parallaxe
    "    vec2 cw=vec2(fbm(rel/260.+3.),fbm(rel/260.+8.));float cn=fbm(rel/95.+cw*1.6);float ca=smoothstep(.56,.8,cn)*(.55+.45*fbm(rel/30.));",
    "    float cside=.5+.5*dot(normalize(du+1e-5),sd);vec3 cc=mix(vec3(.62,.68,.74),vec3(.95,.86,.74),cside*.6);",
    "    pc=mix(pc,cc,ca*.38*uClAmt*smoothstep(1.,.97,rr));}",
    "   float pm=smoothstep(1.03,1.,rr)*pe*uPlateW;",
    "   ec=mix(ec,pc,pm*smoothstep(1.,.995,rr));",
    "   ldr=mix(ldr,max(ldr,pc),pm*(1.-m));}",
    "  ec=mix(ec,ec*vec3(.92,1.,1.1),(1.-uPlateW)*.7);",
    "  ldr=mix(ldr,ec,m*(uRc>2.?1.:smoothstep(.6,2.,uRc)));",
    "  float side=.5+.5*dot(normalize(du+1e-5),sd);",
    "  float og=(rr>1.)?exp(-(rr-1.)*uRc/(2.+uRc*.007))*(.25+.9*side)*(1.-.75*uPlateW):0.;",
    "  ldr=1.-(1.-ldr)*exp(-vec3(.3,.66,1.)*og*.9*uPOn[2]);",
    "  float lb=exp(-pow((rr-1.)*uRc/(5.+uRc*.004),2.))*(.5+.8*side)*uBreath;", // atmosphère qui respire
    "  float hz=(rr<1.)?exp(-(1.-rr)*uRc/90.)*uBreath*.5:0.;",
    "  ldr=1.-(1.-ldr)*exp(-vec3(.25,.6,1.)*(lb+hz)*.55);}",
    " if(uClNear>.001){float cn=0.;for(int i=0;i<3;i++){float ph=fract(uClPh+float(i)/3.);float sc=exp2(ph*3.5-1.);float a=pow(sin(3.14159*ph),2.);",
    "  for(int k=0;k<3;k++){vec2 ss=uS+(s-uS)*(1.-.06*float(k));vec2 rl=rotInv(ss-uS,uR)/(520.*sc);",
    "   float wv=fbm(rl*1.3+float(i)*13.7+vec2(fbm(rl*.6+float(i)*3.),0.)*1.6);cn+=smoothstep(.5,.82,wv)*a/3.;}}",
    "  cn*=smoothstep(80.,420.,length(s-uS));vec3 ncol=mix(vec3(.66,.72,.8),vec3(.98,.93,.86),.45);ldr=mix(ldr,ncol,clamp(cn*uClNear,0.,.85));}",
    // point bleu (la Terre trop petite pour un disque) : le grain du disque qui devient la Terre
    " float glare=0.;vec3 gcol=vec3(0.);",
    " {float de=length(s-uPE);float dot_=smoothstep(14.,2.,uRc)*uPOn[2];",
    "  vec3 ecol=mix(vec3(1.,.82,.5),vec3(.32,.68,1.),uEarthTone);",
    "  gcol+=ecol*dot_*(exp(-de*de/(4.+uRc*uRc))*2.4+exp(-de/16.)*.45);}",
    // Soleil : cœur, halo, traînée anamorphique, éclair (voile borné, jamais blanc plein)
    " {float core=exp(-d*d/(uSunR*uSunR));float halo=1./(1.+pow(d/(uSunR*3.),2.));",
    "  float an=exp(-abs(ds.y)/2.5)*exp(-pow(ds.x/(180.+uSunR*9.),2.));",
    "  float sp=0.;for(int k=0;k<3;k++){float a=.35+uFr*.006+float(k)*1.0472;vec2 dir=vec2(cos(a),sin(a));float al=dot(ds,dir),pe=abs(dot(ds,vec2(-dir.y,dir.x)));sp+=exp(-pe/1.3)*exp(-abs(al)/(26.+uSunR*4.5));}",
    "  vec3 sc=mix(vec3(1.,.82,.52),CREAM,.6);",
    "  gcol+=sc*uSunI*(core*3.5+halo*.55+an*.22+sp*.35)+vec3(1.,.78,.5)*uSunI*.18*exp(-d/900.);",
    "  gcol+=mix(vec3(1.,.72,.34),CREAM,.3)*uFlash*(.05+.45*exp(-d/600.)+1.8*exp(-d/200.));}",
    " ldr=1.-(1.-ldr)*exp(-gcol);",
    " {float lu=dot(ldr,vec3(.2126,.7152,.0722));ldr=clamp(mix(vec3(lu),ldr,1.14),0.,1.);}",
    // grade : vignette, grain, encre dans les noirs, crème dans les hautes lumières
    " vec2 vc=(s-vec2(960.,540.))/vec2(960.,540.);ldr*=1.-.16*pow(clamp(length(vc)/1.35,0.,1.),2.);",
    " ldr+=(h21(s*1.37+fract(uFr*.381)*173.)-.5)*.035*(1.-.5*ldr);",
    " ldr=clamp(ldr,0.,1.);",
    " vec3 outc=INK*pow(1.-ldr,vec3(3.))+ldr*CREAM;",
    " {float lu=dot(ldr,vec3(.2126,.7152,.0722));float sh=smoothstep(.0,.06,lu)*(1.-smoothstep(.12,.3,lu));outc=mix(outc,outc*vec3(.86,.94,1.2),sh);}",
    " o=vec4(outc,1.);}",
  ].join("\n");

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(sh));
    return sh;
  }
  function program(fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }

  var ok = !!gl, PG, PM, gasTex, fbo, plateTex, plateTex2, plateOk = 0, plate2Ok = 0;
  function mkPlate() { // plaque : bords prolongés en miroir (pas de trou quand la plaque est plus petite que la Terre)
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 31, 23, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    return t;
  }
  if (ok) {
    try {
      PG = program(FS_GAS);
      PM = program(FS_MAIN);
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gasTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, gasTex);
      gl.texStorage2D(gl.TEXTURE_2D, 11, gl.RGBA8, GW, GH);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gasTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      plateTex = mkPlate();
      plateTex2 = mkPlate();
    } catch (e) {
      ok = false;
      window.__ouvertureError = String(e && e.message);
      if (window.console) console.error(e);
    }
  }
  function uploadPlate() {
    if (!ok || !plateImg.complete || !plateImg.naturalWidth) return;
    gl.bindTexture(gl.TEXTURE_2D, plateTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plateImg);
    plateOk = 1;
  }
  function uploadPlate2() {
    if (!ok || !plate2Img || !plate2Img.complete || !plate2Img.naturalWidth) return;
    gl.bindTexture(gl.TEXTURE_2D, plateTex2);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate2Img);
    plate2Ok = 1;
  }

  /* ---------- Paramètres d'une image ---------- */
  function params(f) {
    var cam = mainCam(f), prv = mainCam(Math.max(0, f - SHUTTER));
    var lay = [0, 1, 2, 3, 4, 5].map(function (j) { return layerCam(j, f); });
    var nearP = layerCam(5, Math.max(0, f - SHUTTER));
    var layp = [0, 1, 2].map(function (j) { return layerCam(j, Math.max(0, f - SHUTTER)); });
    var uc = ramp(TC, TS, f), ud = ramp(TS, TT, f);
    var collapse = Math.pow(sm(ramp(TC, TS + 2, f)), 1.3);
    var lz = cam.L;
    var pulse = f >= TS - 1 ? Math.exp(-Math.pow((f - TS) / 0.85, 2)) : 0;
    var planets = PLAN.map(function (P, i) {
      var phi = planetPhase(i, f), om = omega(f) * Math.pow(P.r, -1.5);
      var on = sm(ramp(TS + 0.4 + i * 0.35, TS + 2.4 + i * 0.35, f));
      var w = diskToWorld(P.r, phi);
      return { r: P.r, phi: phi, trail: Math.min(om * 3.2, 4.6) + 0.02, on: on, head: cam.toScreen(w), size: P.s * (i === 2 ? 1 : 1), col: P.c };
    });
    // les planètes s'effacent pendant la plongée (sauf la Terre)
    var dive = sm(ramp(Math.log(4), Math.log(40), lz));
    planets.forEach(function (p, i) { if (i !== 2) p.on *= 1 - dive; });
    return {
      cam: cam, prv: prv, lay: lay, layp: layp,
      C: collapse,
      flat: sm(ramp(TC + 0.3 * (TS - TC), TS + 0.25 * N, f)),
      swirl: look(tabSw, f), swRate: omega(f),
      ign: f - TS,
      disk: sm(ramp(TS - 1, TS + 0.2 * N, f)),
      heat: sm(ramp(TS - 1, TS + 2, f)),
      gasAmt: (1 - sm(ramp(Math.log(5), Math.log(70), lz))) * (1 - 0.3 * sm(ramp(TS - 2, TS, f)) * (1 - sm(ramp(TS + 1, TS + 5, f)))),
      back: 1 - 0.6 * sm(ramp(Math.log(10), Math.log(200), lz)),
      tun: lz * 0.42,
      tunAmt: sm(ramp(Math.log(3), Math.log(9), lz)) * (1 - sm(ramp(TT - 3, TT + 3, f))),
      tunBlue: sm(ramp(Math.log(8), Math.log(400), lz)),
      gap: sm(ramp(TS + 1, TS + 0.35 * N, f)),
      sunI: f < TS - 1 ? 0 : sm(ramp(TS - 1, TS, f)) * (0.9 + 5.5 * pulse) * (1 - 0.35 * sm(ramp(TT - 4, TT + 6, f))) * (1 + 0.6 * sm(ramp(TT, D - 1, f)) + 0.12 * Math.sin(Math.max(0, f - TT) * 0.4)),
      proto: sm(ramp(TC - 2, TS, f)) * 0.9 * (1 - sm(ramp(TS, TS + 1, f))) + 0.12 * (1 - sm(ramp(TS - 2, TS, f))),
      flash: 0.42 * pulse,
      sunR: 9 + 14 * pulse + 5 * sm(ramp(TT, D - 1, f)),
      earthTone: sm(ramp(TS + 1, TS + 0.32 * N, f)),
      plateW: sm(ramp(TT - 0.4 * N, TT - 0.05 * N, f)),
      plateFull: sm(ramp(TT - 2, TT, f)),
      starAmt: 1 - 0.45 * sm(ramp(TT - 2, TT + 4, f)),
      orbAmt: sm(ramp(TS + 1, TS + 0.3 * N, f)) * (1 - dive),
      planets: planets,
      uc: uc, ud: ud, nearP: nearP,
      fgAmt: 1 - sm(ramp(TC, TS - 1, f)),
      nearAmt: 1 - sm(ramp(TC - 2, TC + 0.6 * (TS - TC), f)),
      w2: plate2Ok ? sm(ramp(2.4, 3.9, cam.Rc / PLATE.R)) : 0,
      w2Full: sm(ramp(3.7, 4.6, cam.Rc / PLATE.R)),
      zb: f > TT ? clamp(1 - Math.exp(-(cam.L - prv.L)), 0, 0.12) : 0,
      clAmt: sm(ramp(TT - 3, TT + 4, f)),
      clNear: sm(ramp(TT + 0.55 * (D - TT), D - 1, f)) * 0.95,
      clPh: cam.L * 0.85,
      breath: f < TT - 4 ? 0 : sm(ramp(TT - 4, TT + 2, f)) * (0.32 + 0.18 * Math.sin((f - TT) * 0.27) + 0.08 * Math.sin((f - TT) * 0.71)),
    };
  }

  function cs(a) { return [Math.cos(a), Math.sin(a)]; }
  function render(f) {
    if (!ok) {
      var c2 = canvas.getContext && null;
      void c2;
      return;
    }
    var P = params(f), cam = P.cam, prv = P.prv;
    // Passe A
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, GW, GH);
    gl.useProgram(PG.p);
    var u = PG.u;
    gl.uniform2fv(u.uS, cam.S); gl.uniform1f(u.uZ, cam.Z); gl.uniform2fv(u.uA, cam.A); gl.uniform2fv(u.uR, cs(cam.psi));
    gl.uniform2fv(u.uBO, P.lay[3].o); gl.uniform1f(u.uBK, P.lay[3].k);
    gl.uniform2fv(u.uFO, P.lay[4].o); gl.uniform1f(u.uFK, P.lay[4].k); gl.uniform1f(u.uFgAmt, P.fgAmt);
    gl.uniform1f(u.uFr, f); gl.uniform1f(u.uC, P.C); gl.uniform1f(u.uFlat, P.flat);
    gl.uniform1f(u.uSwirl, P.swirl); gl.uniform1f(u.uSwRate, P.swRate); gl.uniform1f(u.uIgn, P.ign);
    gl.uniform1f(u.uDisk, P.disk); gl.uniform1f(u.uHeat, P.heat); gl.uniform1f(u.uGasAmt, P.gasAmt);
    gl.uniform1f(u.uTun, P.tun); gl.uniform1f(u.uTunAmt, P.tunAmt); gl.uniform1f(u.uTunBlue, P.tunBlue);
    gl.uniform1f(u.uGap, P.gap); gl.uniform1f(u.uBack, P.back);
    gl.uniform2fv(u.uTilt, cs(TILT)); gl.uniform1f(u.uCi, CI);
    gl.uniform1fv(u.uPR, PLAN.map(function (p) { return p.r; }));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, gasTex);
    gl.generateMipmap(gl.TEXTURE_2D);
    // Passe B
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(PM.p);
    u = PM.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gasTex); gl.uniform1i(u.uGas, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, plateTex); gl.uniform1i(u.uPlate, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, plateTex2); gl.uniform1i(u.uPlate2, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2fv(u.uS, cam.S); gl.uniform1f(u.uZ, cam.Z); gl.uniform2fv(u.uA, cam.A); gl.uniform2fv(u.uR, cs(cam.psi));
    gl.uniform2fv(u.uSp, prv.S); gl.uniform1f(u.uZp, prv.Z); gl.uniform2fv(u.uAp, prv.A); gl.uniform2fv(u.uRp, cs(prv.psi));
    var lo = [], lk = [], lop = [], lkp = [];
    for (var j = 0; j < 3; j++) { lo.push(P.lay[j].o[0], P.lay[j].o[1]); lk.push(P.lay[j].k); lop.push(P.layp[j].o[0], P.layp[j].o[1]); lkp.push(P.layp[j].k); }
    gl.uniform2fv(u.uLO, lo); gl.uniform1fv(u.uLK, lk); gl.uniform2fv(u.uLOp, lop); gl.uniform1fv(u.uLKp, lkp);
    gl.uniform1f(u.uFr, f); gl.uniform2fv(u.uSun, cam.sun);
    gl.uniform1f(u.uSunI, P.sunI); gl.uniform1f(u.uProto, P.proto); gl.uniform1f(u.uFlash, P.flash); gl.uniform1f(u.uSunR, P.sunR);
    gl.uniform2fv(u.uTilt, cs(TILT)); gl.uniform1f(u.uCi, CI);
    var pl = P.planets;
    gl.uniform1fv(u.uPR, pl.map(function (p) { return p.r; }));
    gl.uniform1fv(u.uPPhi, pl.map(function (p) { return ((p.phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); }));
    gl.uniform1fv(u.uPTrail, pl.map(function (p) { return p.trail; }));
    gl.uniform1fv(u.uPOn, pl.map(function (p) { return p.on; }));
    gl.uniform1fv(u.uPSize, pl.map(function (p) { return p.size; }));
    gl.uniform3fv(u.uPCol, [].concat.apply([], pl.map(function (p) { return p.col; })));
    gl.uniform2fv(u.uPHead, [].concat.apply([], pl.map(function (p) { return [clamp(p.head[0], -1e5, 1e5), clamp(p.head[1], -1e5, 1e5)]; })));
    gl.uniform2fv(u.uPE, [clamp(cam.PE[0], -1e7, 1e7), clamp(cam.PE[1], -1e7, 1e7)]);
    gl.uniform1f(u.uRc, cam.Rc); gl.uniform1f(u.uEarthTone, P.earthTone);
    gl.uniform1f(u.uPlateW, P.plateW); gl.uniform1f(u.uPlateFull, P.plateFull); gl.uniform1f(u.uPlateOk, plateOk);
    gl.uniform1f(u.uStarAmt, P.starAmt); gl.uniform1f(u.uOrbAmt, P.orbAmt);
    gl.uniform2fv(u.uPlF, PLATE.F); gl.uniform1f(u.uPlR, PLATE.R);
    gl.uniform1f(u.uW2, P.w2); gl.uniform1f(u.uW2Full, P.w2Full); gl.uniform1f(u.uK2, IMG2_K); gl.uniform1f(u.uZb, P.zb);
    gl.uniform1f(u.uClAmt, P.clAmt); gl.uniform1f(u.uClNear, P.clNear); gl.uniform1f(u.uClPh, P.clPh); gl.uniform1f(u.uBreath, P.breath);
    gl.uniform1f(u.uNearAmt, P.nearAmt); gl.uniform2fv(u.uNO, P.lay[5].o); gl.uniform1f(u.uNK, P.lay[5].k); gl.uniform1f(u.uNKp, P.nearP.k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }

  /* ---------- Contrôle : DUREE (images) doit égaler data-duration × FPS sur la scène et son hôte ---------- */
  (function () {
    var bad = [];
    var host = canvas.closest("[data-composition-id='ouverture']");
    var hosts = [host].concat(Array.prototype.slice.call(document.querySelectorAll("[data-composition-src$='ouverture.html']")));
    hosts.forEach(function (el) {
      if (!el || !el.hasAttribute("data-duration")) return;
      var v = parseFloat(el.getAttribute("data-duration"));
      if (Math.abs(v * FPS - D) > 0.01) bad.push((el.id || "?") + " data-duration=" + v + " ≠ DUREE/FPS=" + D / FPS);
    });
    if (bad.length) { window.__ouvertureDureeErreur = bad; if (window.console) console.error("[ouverture] DUREE incohérente : " + bad.join(" ; ")); }
  })();

  /* ---------- Horloge HyperFrames : l'image vient de la timeline seekée ---------- */
  var tl = window.gsap.timeline({ paused: true });
  var st = { t: 0 }, last = -1, dur = D / FPS;
  function draw(force) {
    var f = Math.round(tl.time() * FPS);
    if (f < 0) f = 0;
    if (f > D - 1) f = D - 1;
    if (f === last && !force) return;
    last = f;
    render(f);
  }
  tl.to(st, { t: dur, duration: dur, ease: "none", onUpdate: function () { draw(false); } }, 0);
  window.addEventListener("hf-seek", function () { draw(false); });
  plateImg.addEventListener("load", function () { uploadPlate(); draw(true); });
  if (plate2Img) plate2Img.addEventListener("load", function () { uploadPlate2(); draw(true); });
  uploadPlate();
  uploadPlate2();
  draw(true);
  window.__timelines = window.__timelines || {};
  window.__timelines["ouverture"] = tl;
  window.__ouverture = { params: params, mainCam: mainCam, render: render, cfg: CFG };
})();
