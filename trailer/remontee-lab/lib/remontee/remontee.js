/* LKDV trailer — lib/remontee/remontee.js (cosmos-vfx) — P52, la remontée de nuit, 24 i/s.
 * Lit window.LKDV_REMONTEE (T_NUAGES, T_SORTIE, T_ORBITE, DUREE, FPS) posé dans compositions/p52.html.
 *
 * Un seul mouvement de caméra qui recule et monte : plaques emboîtées autour d'un même point de fuite S
 * (Paris dans img39, qui est aussi le point de la vitre d'où l'on part dans P51) :
 *   P51 (image source 43, la vitre du bus) ⊂ img05 (la rue, de nuit) ⊂ img04 (la ville, de nuit) ⊂ img39 (la Terre de nuit).
 * Échelle écran d'img39 : S39 = exp(L(f)), interpolation monotone entre les repères ; à la dernière image S39 = 1
 * (img39 plein cadre, centrée, sans roulis = cadrage de l'image 1335 du film, motion-lab/scenes/v6.js : k = 1, pushFor(0) = 1).
 * Par-dessus : pluie sur la vitre et néons flous au départ, nuages sombres en nappes et lambeaux (coordonnées
 * log-polaires autour de S, même grammaire que la descente de l'ouverture, en sens inverse), flou de zoom radial.
 * Pas d'étalonnage du film ici (l'assemblage l'applique) : seul un plancher « encre » évite les noirs purs au milieu
 * du plan ; il s'efface aux deux bouts pour que la première et la dernière image restent les plaques brutes.
 * Chaque image est une fonction pure de son numéro : aucune horloge, aucun Math.random().
 */
(function () {
  "use strict";
  var CFG = window.LKDV_REMONTEE || { T_NUAGES: 10, T_SORTIE: 21, T_ORBITE: 31, DUREE: 42, FPS: 24 };
  var TN = CFG.T_NUAGES, TX = CFG.T_SORTIE, TO = CFG.T_ORBITE, D = CFG.DUREE, FPS = CFG.FPS || 24, LAST = D - 1;
  var W = 1920, H = 1080;

  var S = [844, 425]; // point de fuite : Paris dans img39 = un point de la vitre dans P51
  var A4 = [1130, 505]; // dans img04 : l'îlot de toits où se trouve la rue d'img05 (même visée que l'ouverture)
  var A5 = [1520, 600]; // dans img05 : la rue aux phares (le bus)
  var K4 = 12, K5 = 3, K51 = 8; // agrandissements emboîtés (img04 dans img39, img05 dans img04, P51 dans img05)
  var KALL = K4 * K5 * K51;
  var ROLL = 12; // vrille (degrés) au milieu de la montée, nulle aux deux bouts

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ramp(a, b, v) { return b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a), 0, 1); }
  function sm(t) { return t * t * (3 - 2 * t); }

  /* ln S39 aux repères (monotone, Fritsch–Carlson) : le recul part fort dès l'image 0, accélère encore dans les nuages,
   * freine à l'arrivée en orbite et se pose à l'échelle 1. */
  var KX = [0, TN, TX, TO, LAST];
  var KY = [Math.log(KALL), Math.log(K4 * 2.5), Math.log(2.1), Math.log(1.08), 0];
  var KM = (function () {
    var n = KX.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((KY[i + 1] - KY[i]) / (KX[i + 1] - KX[i]));
    m[0] = d[0] * 0.85; m[n - 1] = -0.004;
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 1; i < n - 1; i++) { if (Math.abs(m[i]) > 3 * Math.abs(d[i - 1])) m[i] = 3 * d[i - 1]; if (Math.abs(m[i]) > 3 * Math.abs(d[i])) m[i] = 3 * d[i]; }
    return m;
  })();
  function lnS(fr) {
    if (fr <= 0) return KY[0] + KM[0] * fr;
    if (fr >= LAST) return KM[4] * (fr - LAST);
    var i = 0; while (i < 3 && fr > KX[i + 1]) i++;
    var h = KX[i + 1] - KX[i], t = (fr - KX[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * KY[i] + (t3 - 2 * t2 + t) * h * KM[i] + (-2 * t3 + 3 * t2) * KY[i + 1] + (t3 - t2) * h * KM[i + 1];
  }
  function psi(fr) { var u = Math.sin(Math.PI * ramp(0, LAST, fr)); return (ROLL * u * u * Math.PI) / 180; }

  function params(f) {
    var L = lnS(f), S39 = Math.exp(L), ls04 = L - Math.log(K4), ls05 = ls04 - Math.log(K5);
    var cw = TX - TN;
    return {
      S39: S39, psi: psi(f),
      zb: clamp(1 - Math.exp(-Math.abs(L - lnS(f - 0.5))), 0, 0.2),
      w04: sm(ramp(Math.log(0.7), Math.log(1.1), ls04)),
      w05: sm(ramp(Math.log(0.55), Math.log(0.95), ls05)),
      rain: (0.55 + 0.45 * sm(ramp(0, 2, f))) * (1 - sm(ramp(2, 0.8 * TN, f))),
      bokeh: 1 - sm(ramp(0.45 * TN, TN + 2, f)),
      wisp: sm(ramp(0.35 * TN, TN, f)) * (1 - sm(ramp(TX + 2, TO + 2, f))),
      cover: 0.93 * sm(ramp(TN, TN + 0.35 * cw, f)),
      hole: -420 + 2900 * Math.pow(sm(ramp(TN + 0.62 * cw, TX + 1.5, f)), 1.15),
      moon: sm(ramp(TN + 0.35 * cw, TX + 1, f)),
      phase: -L * 1.25,
      p51Full: sm(ramp(Math.log(0.8), 0, L - Math.log(KALL))), // au départ la vitre couvre tout le cadre, sans bord fondu
      floorAmt: sm(ramp(0, 3, f)) * (1 - sm(ramp(TO, LAST - 1, f))),
    };
  }

  var canvas = document.getElementById("p52-canvas");
  var gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
  var VS = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "#version 300 es",
    "precision highp float;",
    "out vec4 o;",
    "uniform sampler2D uP51,uI05,uI04,uI39;",
    "uniform vec2 uS,uR,uA4,uA5;uniform float uS39,uK4,uK45,uKall,uZb,uW04,uW05,uRain,uBokeh,uWisp,uCover,uHole,uMoon,uPhase,uFloor,uFr,uP51Full;",
    "float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}",
    "vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}",
    "float h31(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}",
    "float vn3(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);",
    " return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),u.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),u.x),u.y),",
    "  mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),u.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),u.x),u.y),u.z);}",
    "float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn3(p);p=p*2.03+vec3(1.7,9.2,3.3);a*=.5;}return s/.9375;}",
    "vec2 rotInv(vec2 v,vec2 cs){return vec2(cs.x*v.x+cs.y*v.y,-cs.y*v.x+cs.x*v.y);}",
    "const vec3 INK=vec3(11.,31.,23.)/255.;",
    "float edgeA(vec2 p,float w){float ed=min(min(p.x,1920.-p.x),min(p.y,1080.-p.y));return smoothstep(0.,w,ed);}",
    "vec3 tx(sampler2D t,vec2 p){return texture(t,clamp(p,vec2(1.),vec2(1919.,1079.))/vec2(1920.,1080.)).rgb;}",
    "vec3 night(vec3 c){float l=dot(c,vec3(.2126,.7152,.0722));return c*vec3(.62,.68,.86)+smoothstep(.42,.85,l)*vec3(.34,.21,.07);}", // ville passée de nuit, lumières chaudes gardées
    // la scène sans les nuages, en un point écran
    "vec3 scene(vec2 s){",
    " vec2 off=rotInv(s-uS,uR)/uS39;", // écart au point de fuite, en pixels d'img39
    " vec3 c=tx(uI39,uS+off);",
    " if(uW04>.001){vec2 p=uA4+off*uK4;c=mix(c,night(tx(uI04,p)),uW04*edgeA(p,220.));}",
    " if(uW05>.001){vec2 p=uA5+off*uK45;float a5=uW05*edgeA(p,220.);c=mix(c,night(tx(uI05,p)),a5);",
    "  vec2 q=uS+off*uKall;", // P51 : la vitre du bus, entourée de la carrosserie sombre
    "  float ed=min(min(q.x,1920.-q.x),min(q.y,1080.-q.y));",
    "  float fe=max(smoothstep(-20.,200.,ed),uP51Full*step(0.,ed));", // bord de la vitre fondu dans la rue (pas de cadre « photo »)
    "  c=mix(c*(1.-.35*smoothstep(-260.,0.,ed)*(1.-fe)),tx(uP51,q),a5*fe);}",
    " return c;}",
    "void main(){",
    " vec2 s=vec2(gl_FragCoord.x,1080.-gl_FragCoord.y);",
    " float jit=h21(s+fract(uFr*.618)*91.);",
    " vec3 c=vec3(0.);",
    " if(uZb>.002){for(int k=0;k<8;k++){float t=(float(k)+jit)/8.;c+=scene(uS+(s-uS)*(1.+.6*uZb*t));}c/=8.;}else{c=scene(s);}",
    // pluie sur la vitre (plan plus proche que P51 : il rétrécit plus vite) et néons flous de la ville
    " if(uRain>.001){vec2 g=uS+rotInv(s-uS,uR)/pow(uS39/uKall,1.35)*.62;",
    "  vec2 cell=floor(g/38.);float acc=0.,shade=0.;",
    "  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 cc=cell+vec2(x,y);vec2 h=h22(cc);if(h21(cc+3.)<.7)continue;",
    "   vec2 dp=(cc+.05+.9*h)*38.;float r=3.+9.*h21(cc+7.);float d=length(g-dp);",
    "   shade+=smoothstep(r,r*.45,d)*.22;vec2 sp=g-dp+vec2(r*.32,r*.36);acc+=exp(-dot(sp,sp)/(r*r*.06))*.55;}",
    "  float col=floor(g.x/26.);float hy=h21(vec2(col,4.));float y0=mod(hy*1400.+uFr*55.,1400.)-160.;", // coulures
    "  float st=step(h21(vec2(col,9.)),.22)*exp(-pow((fract(g.x/26.)-.5)*26./2.4,2.))*smoothstep(y0,y0+30.,g.y)*(1.-smoothstep(y0+90.,y0+220.,g.y));",
    "  float inG=smoothstep(-40.,10.,min(min(g.x,1920.-g.x),min(g.y,1080.-g.y)));",
    "  c=mix(c,c*.7+vec3(.05,.06,.08),shade*uRain*inG)+vec3(.75,.8,.95)*(acc*.5+st*.18)*uRain*inG;}",
    " if(uBokeh>.001){vec3 bk=vec3(0.);for(int i=0;i<14;i++){vec2 h=h22(vec2(float(i),17.));",
    "  vec2 pb=uA5+(h-.5)*vec2(1700.,1100.);vec2 sb=uS+(pb-uA5)*(uS39/uK45);",
    "  float rad=(30.+60.*h21(vec2(float(i),3.)))*clamp(uS39/uK45,.25,2.2);",
    "  float d=length(s-sb);float m=smoothstep(rad,rad*.45,d)*.42+exp(-d/(rad*1.4))*.22;",
    "  float k=h21(vec2(float(i),5.));vec3 nc=k<.4?vec3(1.,.22,.62):(k<.75?vec3(.15,.78,1.):vec3(1.,.6,.22));bk+=nc*m;}",
    "  c=1.-(1.-c)*exp(-bk*.38*uBokeh);}",
    // nuages sombres : lambeaux étirés vers le point de fuite, nappe pleine, trouée qui s'ouvre sur la Terre
    " if(uWisp+uCover>.001){vec2 rel=rotInv(s-uS,uR);float rl=length(rel)+1.;vec2 dir=rel/rl;float lr=log(rl);",
    "  float acc=0.,lit=0.;",
    "  for(int k=0;k<3;k++){float t=(float(k)+jit)/3.;float l2=lr+uZb*1.6*t;",
    "   vec3 q=vec3(dir*4.5,l2*1.25-uPhase);vec3 qw=q+1.1*vec3(fbm3(q*.6+3.),fbm3(q*.6+7.),0.);",
    "   float n=fbm3(qw);float wsp=smoothstep(.5,.78,n)*smoothstep(40.,700.,rl);",
    "   vec3 q2=vec3(dir*2.,l2*.75-uPhase*.8);float n2=fbm3(q2+1.6*vec3(fbm3(q2*1.2+5.),fbm3(q2*1.2+9.),0.));",
    "   float cov=clamp(uCover*1.4-.4+.7*(n2-.5),0.,1.)*smoothstep(uHole-380.,uHole+380.,rl);",
    "   acc+=clamp(max(wsp*uWisp*.8,cov),0.,1.)/3.;lit+=n*.6+n2*.4;}",
    "  lit/=3.;float cf=1.-smoothstep(40.,340.,rl);lit=mix(lit,.5,cf);acc=max(acc,min(uCover*1.02,.95)*cf*smoothstep(uHole-380.,uHole+380.,rl));",
    "  float lt=smoothstep(.3,.78,lit);",
    "  vec3 low=mix(vec3(.045,.052,.105),vec3(.27,.19,.15),lt);", // dessous : lueur orangée de la ville
    "  vec3 high=mix(vec3(.042,.055,.115),vec3(.24,.30,.40),lt);", // dessus : un peu de lune
    "  c=mix(c,mix(low,high,uMoon),clamp(acc,0.,.93));}",
    " c+=INK*.55*pow(1.-max(max(c.r,c.g),c.b),6.)*uFloor;c=max(c,INK*.35);", // noirs jamais purs : léger relevé au milieu, plancher encre partout (n'affecte que les pixels plus sombres que l'encre ×0,35)
    " o=vec4(clamp(c,0.,1.),1.);}",
  ].join("\n");

  function compile(type, src) { var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(sh)); return sh; }
  var ok = !!gl, P, U = {}, tex = {}, imgs = {};
  var IDS = { uP51: "p52-p51", uI05: "p52-img05", uI04: "p52-img04", uI39: "p52-img39" };
  if (ok) {
    try {
      P = gl.createProgram();
      gl.attachShader(P, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(P, compile(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(P, 0, "p");
      gl.linkProgram(P);
      if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(P));
      var n = gl.getProgramParameter(P, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var inf = gl.getActiveUniform(P, i); U[inf.name] = gl.getUniformLocation(P, inf.name); }
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      Object.keys(IDS).forEach(function (k) {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 31, 23, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex[k] = t;
        imgs[k] = { el: document.getElementById(IDS[k]), ok: 0 };
      });
    } catch (e) { ok = false; window.__remonteeError = String(e && e.message); if (window.console) console.error(e); }
  }
  function upload() {
    if (!ok) return;
    Object.keys(imgs).forEach(function (k) {
      var im = imgs[k];
      if (im.ok || !im.el || !im.el.complete || !im.el.naturalWidth) return;
      gl.bindTexture(gl.TEXTURE_2D, tex[k]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im.el);
      im.ok = 1;
    });
  }
  function render(f) {
    if (!ok) return;
    var p = params(f);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P);
    Object.keys(IDS).forEach(function (k, i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[k]); gl.uniform1i(U[k], i); });
    gl.uniform2fv(U.uS, S); gl.uniform2fv(U.uR, [Math.cos(p.psi), Math.sin(p.psi)]); gl.uniform2fv(U.uA4, A4); gl.uniform2fv(U.uA5, A5);
    gl.uniform1f(U.uS39, p.S39); gl.uniform1f(U.uK4, K4); gl.uniform1f(U.uK45, K4 * K5); gl.uniform1f(U.uKall, KALL);
    gl.uniform1f(U.uZb, p.zb); gl.uniform1f(U.uW04, imgs.uI04.ok ? p.w04 : 0); gl.uniform1f(U.uW05, imgs.uI05.ok ? p.w05 : 0);
    gl.uniform1f(U.uRain, p.rain); gl.uniform1f(U.uBokeh, p.bokeh); gl.uniform1f(U.uWisp, p.wisp); gl.uniform1f(U.uCover, p.cover);
    gl.uniform1f(U.uHole, p.hole); gl.uniform1f(U.uMoon, p.moon); gl.uniform1f(U.uPhase, p.phase); gl.uniform1f(U.uFloor, p.floorAmt); gl.uniform1f(U.uFr, f); gl.uniform1f(U.uP51Full, p.p51Full);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }

  /* Contrôle : DUREE doit égaler data-duration × FPS (scène et hôte). */
  (function () {
    var bad = [];
    [canvas.closest("[data-composition-id='p52']")].concat(Array.prototype.slice.call(document.querySelectorAll("[data-composition-src$='p52.html']"))).forEach(function (el) {
      if (!el || !el.hasAttribute("data-duration")) return;
      var v = parseFloat(el.getAttribute("data-duration"));
      if (Math.abs(v * FPS - D) > 0.01) bad.push((el.id || "?") + " data-duration=" + v + " ≠ DUREE/FPS=" + D / FPS);
    });
    if (bad.length) { window.__remonteeDureeErreur = bad; if (window.console) console.error("[p52] DUREE incohérente : " + bad.join(" ; ")); }
  })();

  var tl = window.gsap.timeline({ paused: true });
  var st = { t: 0 }, last = -1, dur = D / FPS;
  function draw(force) {
    var f = Math.round(tl.time() * FPS);
    if (f < 0) f = 0;
    if (f > LAST) f = LAST;
    if (f === last && !force) return;
    last = f;
    render(f);
  }
  tl.to(st, { t: dur, duration: dur, ease: "none", onUpdate: function () { draw(false); } }, 0);
  window.addEventListener("hf-seek", function () { draw(false); });
  Object.keys(IDS).forEach(function (k) { var el = document.getElementById(IDS[k]); if (el) el.addEventListener("load", function () { upload(); draw(true); }); });
  upload();
  draw(true);
  window.__timelines = window.__timelines || {};
  window.__timelines["p52"] = tl;
  window.__remontee = { params: params, lnS: lnS, render: render, cfg: CFG };
})();
