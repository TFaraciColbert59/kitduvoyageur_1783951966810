/* b-earth.js — équipe B (cosmos-vfx).
   1) Bibliothèque LKDV.cosmos.earth : globe tracé par rayon (Blue Marble NASA, Black Marble NASA, nuages
      procéduraux cuits une fois), caméra, projection monde → écran, lot de traits et de points lumineux,
      flou, pastilles de texte. Réutilisée par b-descent.js et b-orbit.js.
   2) Module « b-earth » : 2,00 → 6,00 s (proto-Terre, impact lunaire, refroidissement, Terre d'aujourd'hui,
      logo dans l'aurore, rotation, pivot vers l'Islande).
   Tout draw() est une fonction pure de t : aucune horloge, aucun Math.random (LKDV.hash, graine 1783). */
(function () {
  "use strict";
  var L = window.LKDV, D2R = Math.PI / 180;

  /* ---------- petits outils numériques ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function sstep(a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function ease(u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function easeOut(u, k) { u = clamp(u, 0, 1); k = k || 5; return (1 - Math.exp(-k * u)) / (1 - Math.exp(-k)); }
  function easeIn(u, k) { u = clamp(u, 0, 1); k = k || 5; return (Math.exp(k * u) - 1) / (Math.exp(k) - 1); }
  function loglerp(a, b, u) { return Math.exp(lerp(Math.log(a), Math.log(b), u)); }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function rot(v, axis, ang) { /* Rodrigues */
    var c = Math.cos(ang), s = Math.sin(ang), k = axis, d = dot(k, v), x = cross(k, v);
    return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
  }
  /* Repère terrestre : x = cosφ sinλ, y = sinφ, z = cosφ cosλ (rayon terrestre = 1). */
  function ll(lat, lon, alt) { var a = lat * D2R, b = lon * D2R, r = 1 + (alt || 0); return [r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b)]; }
  function toLL(p) { var n = norm(p); return [Math.asin(clamp(n[1], -1, 1)) / D2R, Math.atan2(n[0], n[2]) / D2R]; }
  function hx(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  var COL = { sage: hx("#5B7F55"), sageL: hx("#A6C1A0"), amber: hx("#C89A3B"), brick: hx("#A8443A"), blue: hx("#2A5A6E"), blueL: hx("#4B6B7C"), paper: hx("#F5F2EC"), stone: hx("#FAF8F5"), forest: hx("#17402C"), ink: [0.06, 0.09, 0.08] };

  /* ---------- shaders ---------- */
  var NOISE = [
    "float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }",
    "float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);",
    " return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),",
    "            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }",
    "float fbm(vec3 p, int n){ float s=0., a=.5; for(int k=0;k<6;k++){ if(k>=n) break; s+=a*vn(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }",
  ].join("\n");

  /* Globe : tracé de rayon sur la sphère unité ; atmosphère analytique ; Lune ; étoiles ; soleil. */
  var FS_GLOBE_BODY = NOISE + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uPP; uniform float uFocal; uniform vec3 uCam,uF,uR,uU,uSun;",
    "uniform sampler2D uDay,uNight,uCloud,uPatch,uMoonTex,uPatchCl;",
    "uniform vec4 uPatchBox; uniform float uPatchMix;",
    "uniform float uState,uT,uCity,uCloudAmt,uCloudShift,uAtmo,uAlpha,uBg,uStars,uSunGlow,uSunVis,uLavaGlow,uDust,uDetail,uSpec,uExpo,uImpact;",
    "uniform vec3 uImpactP; uniform vec4 uMoon; uniform float uMoonA;",
    "const float PI=3.14159265;",
    "vec2 llUV(vec3 p){ return vec2(atan(p.x,p.z)/(2.*PI)+.5, asin(clamp(p.y,-1.,1.))/PI+.5); }",
    "vec4 texLL(sampler2D s, vec2 uv){ vec2 dx=dFdx(uv), dy=dFdy(uv); dx.x-=floor(dx.x+.5); dy.x-=floor(dy.x+.5); return textureGrad(s,uv,dx,dy); }",
    "vec3 lin(vec3 c){ return c*c*(c*.2+.8); }", /* ≈ sRGB → linéaire, bon marché */
    "vec3 srgb(vec3 c){ c=max(c,0.); return sqrt(c)*1.04-c*0.04; }",
    "float sphere(vec3 ro, vec3 rd, vec3 c, float r, out float tn){ vec3 oc=ro-c; float b=dot(oc,rd), q=dot(oc,oc)-r*r, h=b*b-q; tn=-1.; if(h<0.) return -1.; h=sqrt(h); tn=-b-h; return h; }",
    "void main(){",
    "  vec2 pix=gl_FragCoord.xy;",
    "  vec3 rd=normalize(uF*uFocal+uR*(pix.x-uPP.x)+uU*(pix.y-uPP.y));",
    "  vec3 col=vec3(0.); float alpha=0.;",
    "  float tE; float hE=sphere(uCam,rd,vec3(0.),1.,tE);",
    "  float tM=-1.; float hM=-1.;",
    "#ifdef MOON",
    "  if(uMoonA>0.) hM=sphere(uCam,rd,uMoon.xyz,uMoon.w,tM);",
    "#endif",
    "  bool hitE=hE>0.&&tE>0., hitM=hM>0.&&tM>0.&&(!hitE||tM<tE);",
    /* fond : espace */
    "  if(uBg>0.){ col=vec3(.012,.022,.032);",
    "#ifdef EVO",
    "    if(uDust>0.){ float n=fbm(rd*3.+vec3(0.,0.,uT*.05),4); float band=exp(-pow(dot(rd,normalize(vec3(.2,1.,.35)))*3.2,2.));",
    "      col+=vec3(.78,.55,.24)*pow(n,2.2)*band*uDust*.55+vec3(.36,.16,.12)*pow(n,3.)*uDust*.3; }",
    "#endif",
    "    alpha=uBg; }",
    /* soleil (derrière tout) */
    "  float cs=dot(rd,uSun);",
    /* halo d'atmosphère (rayon qui frôle la Terre) */
    "  float tc=-dot(uCam,rd); vec3 cp=uCam+rd*max(tc,0.); float bd=length(cp);",
    "  if(!hitE && tc>0.){ float hh=bd-1.; vec3 q=cp/bd; float lit=smoothstep(-.35,.25,dot(q,uSun));",
    "    float fs=pow(max(cs,0.),6.); float tw=smoothstep(-.3,.0,dot(q,uSun))*(1.-smoothstep(.0,.45,dot(q,uSun)));",
    "    float near=max(cs,0.); near*=near; vec3 ac=vec3(.30,.55,.95)*lit*1.1+vec3(1.,.58,.28)*tw*(.12+1.6*near*near+2.5*fs)+vec3(.55,.75,1.)*fs*lit*1.5;",
    "    float g=exp(-hh/.008)*.9+exp(-hh/.04)*.16; g*=uAtmo;",
    "    col+=ac*g; alpha=max(alpha,clamp(g*max(ac.r,max(ac.g,ac.b)),0.,1.));",
    "    if(uLavaGlow>0.){ float lg=exp(-hh/.10)*uLavaGlow; col+=vec3(1.,.42,.16)*lg; alpha=max(alpha,clamp(lg,0.,1.)); } }",
    /* Lune */
    "#ifdef MOON",
    "  if(hitM){ vec3 P=uCam+rd*tM; vec3 N=normalize(P-uMoon.xyz); vec3 mc=lin(texture(uMoonTex,llUV(N)).rgb);",
    "    float nd=max(dot(N,uSun),0.); col=mix(col,srgb(mc*(nd*1.6+.015)+vec3(.9,.35,.12)*max(0.,1.-uMoonA*1.6)*.6),uMoonA); alpha=max(alpha,uMoonA); }",
    "#endif",
    /* Terre */
    "  if(hitE){ vec3 P=uCam+rd*tE; vec3 N=P; vec3 V=-rd; vec2 uv=llUV(N);",
    "    float ndl=dot(N,uSun); float day=smoothstep(-.12,.18,ndl); float lam=max(ndl,0.);",
    "    vec3 surf; vec3 emit=vec3(0.); float ocean=0.; float cl=0.;",
    "#ifdef EVO",
    "    if(uState<3.999){",
    "      vec3 q=N*2.6; float sw=uT*.6;",
    "      float n1=fbm(q+vec3(sw,0.,-sw*.5),4); float n2=vn(q*4.6+vec3(4.,1.,uT*.3))*.6+vn(q*9.+2.)*.4;",
    /* 0 lave */
    "      float crack=1.-smoothstep(.0,.06,abs(n1-.5)); float hot=smoothstep(.55,.85,n2);",
    "      vec3 lava=vec3(.42,.12,.08)*(.45+n2)+vec3(1.,.40,.10)*crack*1.5+vec3(1.,.80,.45)*crack*hot*1.4+vec3(.66,.20,.10)*hot*.8;",
    /* 1 vapeur */
    "      float vap=smoothstep(.3,.75,fbm(q*1.4+vec3(0.,uT*1.5,0.)+n1*1.2,3));",
    "      vec3 steam=mix(vec3(.30,.10,.06)*(1.+crack*2.),vec3(.86,.80,.72),vap);",
    /* 2 océan primitif */
    "      vec3 ocn=mix(vec3(.025,.10,.16),vec3(.05,.17,.24),n2)+vec3(.8)*smoothstep(.62,.82,n1)*.5;",
    /* 3 continents anciens */
    "      float land=uState>2.? smoothstep(.50,.53,fbm(N*1.5+vec3(3.1,.2,1.7),4)) : 0.;",
    "      vec3 anc=mix(vec3(.03,.11,.18),mix(vec3(.42,.27,.17),vec3(.55,.42,.30),n2),land)+vec3(.85)*smoothstep(.66,.84,n1)*.55;",
    "      vec3 now=lin(texLL(uDay,uv).rgb);",
    "      float s=uState; vec3 A=lava, B=steam; float u=s;",
    "      if(s>=1.&&s<2.){A=steam;B=ocn;u=s-1.;} else if(s>=2.&&s<3.){A=ocn;B=anc;u=s-2.;} else if(s>=3.){A=anc;B=now;u=s-3.;}",
    "      surf=lin(mix(A,B,smoothstep(0.,1.,u))); if(s>=3.) surf=mix(lin(anc),now,smoothstep(0.,1.,u));",
    "      float lavaW=clamp(1.-s,0.,1.)+clamp(1.-abs(s-1.),0.,1.)*.35*(1.-vap);",
    "      emit=lin(lava)*lavaW*(1.6+uLavaGlow); surf*=(1.-clamp(1.-s,0.,1.));",
    "      ocean=smoothstep(1.5,2.2,s)*(1.-land*smoothstep(2.5,3.,s));",
    "    } else {",
    "#else",
    "    {",
    "#endif",
    "      vec3 dc=texLL(uDay,uv).rgb;",
    "      if(uPatchMix>0.){ float lon=(uv.x-.5)*360., lat=(uv.y-.5)*180.;",
    "        vec2 pu=vec2((lon-uPatchBox.x)/(uPatchBox.z-uPatchBox.x),(lat-uPatchBox.y)/(uPatchBox.w-uPatchBox.y));",
    "        float e=min(min(pu.x,1.-pu.x)*7.,min(pu.y,1.-pu.y)*4.); float w=smoothstep(0.,1.,e)*uPatchMix;",
    "        if(w>0.) dc=mix(dc,texture(uPatch,pu).rgb,w); }",
    "      surf=lin(dc);",
    "      ocean=smoothstep(.02,.06,dc.b-max(dc.r,dc.g)*.85)*(1.-smoothstep(.25,.4,dc.r+dc.g));",
    "    }",
    /* nuages */
    "    if(uCloudAmt>0.){ vec2 cu=uv+vec2(uCloudShift,0.); vec4 cm=texLL(uCloud,cu); float cov=cm.r;",
    "      if(uDetail>0.){ cov+=(fbm(N*900.+vec3(0.,0.,uT*.02),3)-.5)*.35*uDetail; }",
    "      cl=smoothstep(1.-uCloudAmt,1.-uCloudAmt+.16,cov)*(.55+.45*cm.g); }",
    /* éclairage */
    "    vec3 lit=surf*(lam*1.25+.02)*day;",
    "    float term=smoothstep(-.1,.05,ndl)*(1.-smoothstep(.05,.35,ndl));",
    "    lit+=surf*vec3(1.,.45,.2)*term*.35;",
    "    vec3 Hh=normalize(uSun+V); float sp=pow(max(dot(N,Hh),0.),70.)*ocean*day*uSpec; lit+=vec3(1.,.9,.75)*sp*(1.-cl)*.9;",
    "    lit+=vec3(1.,.70,.40)*sp*0.;",
    "    if(uCity>0.){ vec3 nc=texture(uNight,uv).rgb; float lum=dot(nc,vec3(.3,.55,.15));",
    "      float lights=smoothstep(.20,.75,lum)*1.6; float moon=lum*.10;",
    "      lit+=(vec3(1.,.72,.38)*lights+vec3(.25,.35,.55)*moon)*(1.-day)*uCity*(1.-cl*.8); }",
    "    vec3 cc=vec3(1.)*(lam*1.15+.015)*day+vec3(1.,.5,.25)*term*.25+vec3(.03,.04,.06)*(1.-day);",
    "    lit=mix(lit,cc,cl*.92);",
    "    lit+=emit;",
    "    float fr=pow(1.-max(dot(N,V),0.),3.);",
    "    float al=smoothstep(-.4,.3,ndl);",
    "    lit+=(vec3(.30,.55,.95)*al*.55+vec3(1.,.5,.25)*term*.5)*fr*uAtmo;",
    "    lit*=uExpo;",
    "    if(uImpact>0.){ float di=distance(N,uImpactP); lit+=vec3(1.,.65,.3)*exp(-di*di*30.)*uImpact*3.; }",
    "    vec3 sc=srgb(lit);",
    "    col=mix(col,sc,1.); alpha=1.;",
    "    col+= vec3(0.);",
    "  }",
    "  col=min(col,vec3(1.6)); col=col/(1.+max(col-.85,0.)*1.2);",
    "  alpha*=uAlpha; o=vec4(col*uAlpha,alpha);",
    "  if(uBg==0.) o.rgb=min(o.rgb,vec3(o.a));",
    "}",
  ].join("\n");

  /* Cuisson des nuages (équirectangulaire 2048×1024) : couverture r, densité g. */
  var FS_BAKE_CLOUD = "#version 300 es\nprecision highp float;\n" + NOISE + "\n" + [
    "in vec2 vUv; out vec4 o; const float PI=3.14159265;",
    "void main(){ float lon=(vUv.x-.5)*2.*PI, lat=(vUv.y-.5)*PI; vec3 p=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));",
    "  vec3 w=vec3(fbm(p*2.2,4),fbm(p*2.2+5.2,4),fbm(p*2.2+9.7,4));",
    "  vec3 q=p*3.0+(w-.5)*2.2; q.x*=1.6;",
    "  float c=fbm(q,6); float al=abs(sin(lat));",
    "  float band=.55+.25*exp(-pow((degrees(lat)-58.)/14.,2.))+.25*exp(-pow((degrees(lat)+55.)/14.,2.))+.18*exp(-pow(degrees(lat)/8.,2.))-.18*exp(-pow((al*90.-25.)/9.,2.));",
    "  float d=fbm(q*3.1+3.,4);",
    "  o=vec4(clamp(c*band*1.25,0.,1.), d, 0., 1.); }",
  ].join("\n");

  /* Masque terre/mer depuis la Blue Marble (1024×512), lu ensuite par le processeur. */
  var FS_BAKE_LAND = "#version 300 es\nprecision highp float;\nin vec2 vUv; out vec4 o; uniform sampler2D uDay;\n" +
    "void main(){ vec3 c=texture(uDay,vUv).rgb; float ocean=smoothstep(.02,.06,c.b-max(c.r,c.g)*.85)*(1.-smoothstep(.25,.4,c.r+c.g)); float ice=smoothstep(.75,.9,min(c.r,min(c.g,c.b))); o=vec4(1.-ocean, ice, 0., 1.); }";

  /* Lot de formes lumineuses (traits, points) en pixels écran ; alpha prémultiplié. */
  var VS_BATCH = "#version 300 es\nlayout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aPar; uniform vec2 uRes; out vec2 vUV; out vec4 vCol; out vec2 vPar;\n" +
    "void main(){ vUV=aUV; vCol=aCol; vPar=aPar; vec2 p=aPos/uRes*2.-1.; gl_Position=vec4(p.x,-p.y,0.,1.); }";
  var FS_BATCH = "#version 300 es\nprecision highp float; in vec2 vUV; in vec4 vCol; in vec2 vPar; out vec4 o; uniform float uClampA;\n" +
    "void main(){ float d=length(vUV); if(d>1.) discard; float core=clamp((1.-d)*vPar.x,0.,1.); float glow=(1.-d)*(1.-d); float f=mix(glow,core,vPar.y);\n" +
    " o=vCol*f; if(uClampA>0.) o.a=max(o.a,max(o.r,max(o.g,o.b))); }";

  /* Sprites texturés (pastilles d'avatar). */
  var FS_SPRITE = "#version 300 es\nprecision highp float; in vec2 vUV; in vec4 vCol; in vec2 vPar; out vec4 o; uniform sampler2D uTex; uniform float uClampA;\n" +
    "void main(){ vec4 c=texture(uTex,vUV); o=c*vCol.a; }";

  /* Flou séparable 9 prises + composition. */
  var FS_BLUR = "#version 300 es\nprecision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;\n" +
    "void main(){ vec4 s=texture(uTex,vUv)*.2270; s+=(texture(uTex,vUv+uDir*1.3846)+texture(uTex,vUv-uDir*1.3846))*.3162; s+=(texture(uTex,vUv+uDir*3.2308)+texture(uTex,vUv-uDir*3.2308))*.0703; o=s; }";
  var FS_COPY = "#version 300 es\nprecision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uA;\nvoid main(){ o=texture(uTex,vUv)*uA; }";

  /* ---------- la bibliothèque ---------- */
  var E = {
    util: { clamp: clamp, lerp: lerp, sstep: sstep, ease: ease, easeOut: easeOut, easeIn: easeIn, loglerp: loglerp, add: add, sub: sub, mul: mul, dot: dot, cross: cross, norm: norm, rot: rot, ll: ll, toLL: toLL, hx: hx },
    COL: COL,
    ICELAND: { lat: 64.95, lon: -18.75 },
    PATCH_BOX: [-25.0, 62.8, -12.6, 67.2], /* lonMin, latMin, lonMax, latMax de iceland-bmng-nasa-gibs-4096.jpg */
    _p: null, tex: {}, land: null,
  };

  function loadImg(url) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("[b-earth] image introuvable : " + url)); }; im.src = url; });
  }
  function upload(C, src, opts) {
    var gl = C.gl, tex = gl.createTexture(); opts = opts || {};
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY === false ? 0 : 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.clampS ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mip === false ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
    if (opts.mip !== false) gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }
  /* Charge une image et la réduit proprement si elle dépasse gl.MAX_TEXTURE_SIZE (ou `max`). */
  function loadTex(C, url, opts) {
    opts = opts || {};
    return loadImg(url).then(function (im) {
      var mx = Math.min(C.gl.getParameter(C.gl.MAX_TEXTURE_SIZE), opts.max || 1e9), src = im;
      if (im.width > mx || im.height > mx) {
        var k = Math.min(mx / im.width, mx / im.height), cv = document.createElement("canvas");
        cv.width = Math.floor(im.width * k); cv.height = Math.floor(im.height * k);
        var cx = cv.getContext("2d"); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high"; cx.drawImage(im, 0, 0, cv.width, cv.height); src = cv;
      }
      return upload(C, src, opts);
    });
  }

  E.init = function (C) {
    if (E._p) return E._p;
    var gl = C.gl;
    E.C = C;
    E.progEvo = C.program(C.VS_QUAD, "#version 300 es\n#define EVO\n#define MOON\nprecision highp float;\n" + FS_GLOBE_BODY);
    E.prog = C.program(C.VS_QUAD, "#version 300 es\nprecision highp float;\n" + FS_GLOBE_BODY);
    E.progBatch = C.program(VS_BATCH, FS_BATCH);
    E.progSprite = C.program(VS_BATCH, FS_SPRITE);
    E.progBlur = C.program(C.VS_QUAD, FS_BLUR);
    E.progCopy = C.program(C.VS_QUAD, FS_COPY);
    var bakeC = C.program(C.VS_QUAD, FS_BAKE_CLOUD), bakeL = C.program(C.VS_QUAD, FS_BAKE_LAND);
    /* tampon du lot : aPos(2) aUV(2) aCol(4) aPar(2) = 10 flottants par sommet */
    E._vao = gl.createVertexArray(); gl.bindVertexArray(E._vao);
    E._buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, E._buf);
    var stride = 40;
    function attr(loc, size, off) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); }
    attr(0, 2, 0); attr(1, 2, 8); attr(2, 4, 16); attr(3, 2, 32);
    gl.bindVertexArray(C._vao);
    E._data = new Float32Array(10 * 6 * 60000); E._n = 0;
    /* 1×1 noir pour les échantillonneurs non utilisés */
    var black = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, black);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    E.tex.black = black;
    E.blurA = C.target(Math.ceil(C.W / 4), Math.ceil(C.H / 4)); E.blurB = C.target(Math.ceil(C.W / 4), Math.ceil(C.H / 4));
    E.half = C.target(Math.ceil(C.W / 2), Math.ceil(C.H / 2));

    var jobs = [
      loadTex(C, "assets/textures/earth-bluemarble-nasa-8192.jpg").then(function (t) { E.tex.day = t; }),
      loadTex(C, "assets/textures/earth-blackmarble-nasa-gibs-4096.jpg", { mip: true }).then(function (t) { E.tex.night = t; }),
      loadTex(C, "assets/textures/iceland-bmng-nasa-gibs-4096.jpg", { clampS: true }).then(function (t) { E.tex.patch = t; }),
      loadTex(C, "assets/textures/moon-lroc-color-poles-8k.jpg", { max: 2048 }).then(function (t) { E.tex.moon = t; }),
      (document.fonts && window.FontFace ? new FontFace("LKDVManrope", "url(assets/fonts/manrope.woff2)", { weight: "700" }).load().then(function (f) { document.fonts.add(f); }) : Promise.resolve()),
    ];
    E._p = Promise.all(jobs).then(function () {
      /* nuages cuits une fois (déterministe) */
      var tc = C.target(2048, 1024);
      gl.bindTexture(gl.TEXTURE_2D, tc.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      C.bind(tc); gl.disable(gl.BLEND); gl.useProgram(bakeC.p); C.quad();
      gl.bindTexture(gl.TEXTURE_2D, tc.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
      E.tex.cloud = tc.tex;
      /* masque des terres lu par le processeur */
      var tl = C.target(1024, 512); C.bind(tl); gl.useProgram(bakeL.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, E.tex.day); gl.uniform1i(bakeL.u.uDay, 0); C.quad();
      var px = new Uint8Array(1024 * 512 * 4); gl.readPixels(0, 0, 1024, 512, gl.RGBA, gl.UNSIGNED_BYTE, px);
      E.land = { w: 1024, h: 512, px: px };
      C.bind(null); gl.enable(gl.BLEND);
    });
    return E._p;
  };

  /* Terre ferme (sans glace) en (lat, lon) ? lecture du masque cuit. */
  E.isLand = function (lat, lon) {
    var m = E.land; if (!m) return false;
    var x = Math.floor(((lon + 180) / 360) * m.w) % m.w, y = Math.floor(((lat + 90) / 180) * m.h);
    if (x < 0) x += m.w; y = clamp(y, 0, m.h - 1);
    var i = (y * m.w + x) * 4; return m.px[i] > 140 && m.px[i + 1] < 120;
  };

  /* ---------- caméra ----------
     o : { lat, lon (point sous la caméra), d (distance au centre, rayons) ou Rs (rayon apparent en px),
           cx, cy (point principal = centre du globe à l'écran, px, origine en haut à gauche),
           fov (°, sur min(W,H)), heading (°), pitch (° vers l'avant), }
     La caméra regarde le centre de la Terre, nord en haut, est à droite (pitch = 0). */
  E.camera = function (C, o) {
    var m = Math.min(C.W, C.H), fov = (o.fov || 30) * D2R, F = (m / 2) / Math.tan(fov / 2);
    var d = o.d || 1 / Math.sin(Math.atan((o.Rs || 0.4 * m) / F));
    var a = o.lat * D2R, b = o.lon * D2R;
    var s = [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
    var f = mul(s, -1), u = [-Math.sin(a) * Math.sin(b), Math.cos(a), -Math.sin(a) * Math.cos(b)], r = [Math.cos(b), 0, -Math.sin(b)];
    if (o.heading) { var hh = o.heading * D2R; r = rot(r, f, -hh); u = rot(u, f, -hh); }
    if (o.pitch) { var pp = o.pitch * D2R; var f2 = norm(add(mul(f, Math.cos(pp)), mul(u, Math.sin(pp)))); u = norm(sub(mul(u, Math.cos(pp)), mul(f, Math.sin(pp)))); f = f2; }
    var cam = { pos: mul(s, d), f: f, r: r, u: u, F: F, d: d, px: o.cx == null ? C.W / 2 : o.cx, py: o.cy == null ? C.H / 2 : o.cy, W: C.W, H: C.H, m: m };
    cam.Rs = F * Math.tan(Math.asin(Math.min(1, 1 / d))); cam.pitched = !!o.pitch;
    return cam;
  };
  /* Monde → écran : [x, y, profondeur] (origine en haut à gauche) ; profondeur ≤ 0 = derrière la caméra. */
  E.project = function (cam, P) {
    var v = sub(P, cam.pos), z = dot(v, cam.f);
    if (z <= 1e-6) return [0, 0, z];
    return [cam.px + dot(v, cam.r) / z * cam.F, cam.py - dot(v, cam.u) / z * cam.F, z];
  };
  /* Écran → direction du rayon (monde). */
  E.ray = function (cam, x, y) { return norm(add(add(mul(cam.f, cam.F), mul(cam.r, x - cam.px)), mul(cam.u, cam.py - y))); };
  /* Visibilité d'un point (caché par la Terre ?) : 1 visible, 0 caché, fondu près du limbe. */
  E.visible = function (cam, P) {
    var v = sub(P, cam.pos), L2 = Math.sqrt(dot(v, v)), d = mul(v, 1 / L2);
    var b = dot(cam.pos, d), c = dot(cam.pos, cam.pos) - 1, h = b * b - c;
    if (h < 0) return 1;
    var t0 = -b - Math.sqrt(h); if (t0 < 0 || t0 > L2 - 1e-4) return 1;
    /* profondeur de la corde comme mesure douce */
    return clamp(1 - Math.sqrt(h) * 6, 0, 1);
  };
  /* Direction du soleil exprimée dans le repère caméra (droite, haut, profondeur ; profondeur > 0 = derrière la Terre). */
  E.sunCam = function (cam, x, y, z) { return norm(add(add(mul(cam.r, x), mul(cam.u, y)), mul(cam.f, z))); };

  /* ---------- dessin du globe ----------
     p : { sun, state(0..4), city, cloud, cloudShift, atmo, alpha, bg, stars, sunGlow, sunVis, lavaGlow, dust,
           detail, spec, expo, patch, impact, impactP, moon:[x,y,z,r], moonA, t } */
  E.drawGlobe = function (C, cam, p, target) {
    var gl = C.gl, evo = (p.state != null && p.state < 4) || (p.moonA || 0) > 0, pr = evo ? E.progEvo : E.prog, u = pr.u;
    C.bind(target || null);
    var tw = target ? target.w : C.W, th = target ? target.h : C.H;
    /* fond d'espace par effacement (gratuit) puis tracé limité au disque et à son halo */
    var bg = p.bg || 0, scis = null;
    if (bg >= 1 && !(p.dust > 0) && (p.alpha == null || p.alpha >= 1)) {
      gl.disable(gl.SCISSOR_TEST); gl.clearColor(0.012, 0.022, 0.032, 1); gl.clear(gl.COLOR_BUFFER_BIT); bg = -1;
    } else if (target) { gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    if (!cam.pitched && cam.d > 1.04 && !(p.dust > 0)) {
      var k0 = target ? target.w / C.W : 1, rr = (cam.Rs * ((p.lavaGlow || 0) > 0 ? 1.45 : 1.16) + 6) * k0;
      var x0 = Math.floor(cam.px * k0 - rr), y0 = Math.floor((C.H - cam.py) * k0 - rr), x1 = Math.ceil(cam.px * k0 + rr), y1 = Math.ceil((C.H - cam.py) * k0 + rr);
      x0 = clamp(x0, 0, tw); y0 = clamp(y0, 0, th); x1 = clamp(x1, 0, tw); y1 = clamp(y1, 0, th);
      if (x1 <= x0 || y1 <= y0) { return; }
      scis = [x0, y0, x1 - x0, y1 - y0];
    }
    var sx = target ? target.w / C.W : 1;
    gl.useProgram(pr.p);
    gl.uniform2f(u.uPP, cam.px * sx, (C.H - cam.py) * sx); gl.uniform1f(u.uFocal, cam.F * sx);
    gl.uniform3fv(u.uCam, cam.pos); gl.uniform3fv(u.uF, cam.f); gl.uniform3fv(u.uR, cam.r); gl.uniform3fv(u.uU, cam.u);
    gl.uniform3fv(u.uSun, p.sun || [1, 0, 0]);
    var tx = [["uDay", E.tex.day], ["uNight", E.tex.night], ["uCloud", E.tex.cloud], ["uPatch", E.tex.patch], ["uMoonTex", E.tex.moon]];
    for (var i = 0; i < tx.length; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx[i][1] || E.tex.black); if (u[tx[i][0]]) gl.uniform1i(u[tx[i][0]], i); }
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(u.uPatchBox, E.PATCH_BOX); gl.uniform1f(u.uPatchMix, p.patch || 0);
    function f1(n, v) { if (u[n]) gl.uniform1f(u[n], v); }
    f1("uState", p.state == null ? 4 : p.state); f1("uT", p.t || 0); f1("uCity", p.city || 0); f1("uCloudAmt", p.cloud || 0); f1("uCloudShift", p.cloudShift || 0);
    f1("uAtmo", p.atmo == null ? 1 : p.atmo); f1("uAlpha", p.alpha == null ? 1 : p.alpha); f1("uBg", bg); f1("uStars", p.stars == null ? 1 : p.stars);
    f1("uSunGlow", p.sunGlow || 0); f1("uSunVis", p.sunVis == null ? 1 : p.sunVis); f1("uLavaGlow", p.lavaGlow || 0); f1("uDust", p.dust || 0); f1("uDetail", p.detail || 0);
    f1("uSpec", p.spec == null ? 1 : p.spec); f1("uExpo", p.expo == null ? 1 : p.expo); f1("uImpact", p.impact || 0);
    if (u.uImpactP) gl.uniform3fv(u.uImpactP, p.impactP || [0, 0, 1]);
    if (u.uMoon) gl.uniform4fv(u.uMoon, p.moon || [0, 0, 0, 0]); f1("uMoonA", p.moonA || 0);
    if (target) gl.disable(gl.BLEND); else { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    if (scis) { gl.enable(gl.SCISSOR_TEST); gl.scissor(scis[0], scis[1], scis[2], scis[3]); }
    C.quad();
    gl.disable(gl.SCISSOR_TEST); gl.enable(gl.BLEND);
  };

  /* Globe flouté : rendu au quart, flou séparable (n passes), composé plein cadre avec alpha a. */
  E.drawGlobeBlurred = function (C, cam, p, passes, a) {
    var gl = C.gl;
    E.drawGlobe(C, cam, p, E.blurA);
    gl.useProgram(E.progBlur.p); gl.disable(gl.BLEND);
    for (var i = 0; i < (passes || 2); i++) {
      var k = 1 + i * 0.8;
      C.bind(E.blurB); gl.bindTexture(gl.TEXTURE_2D, E.blurA.tex); gl.uniform1i(E.progBlur.u.uTex, 0); gl.uniform2f(E.progBlur.u.uDir, k / E.blurA.w, 0); C.quad();
      C.bind(E.blurA); gl.bindTexture(gl.TEXTURE_2D, E.blurB.tex); gl.uniform2f(E.progBlur.u.uDir, 0, k / E.blurA.h); C.quad();
    }
    C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(E.progCopy.p); gl.bindTexture(gl.TEXTURE_2D, E.blurA.tex); gl.uniform1i(E.progCopy.u.uTex, 0); gl.uniform1f(E.progCopy.u.uA, a == null ? 1 : a); C.quad();
  };

  /* ---------- lot de formes lumineuses ----------
     Couleurs en [r,g,b] 0..1 + alpha a ; « add » ∈ [0,1] : 1 = lumière ajoutée (alpha nul), 0 = recouvrement. */
  var B = E.batch = {
    reset: function () { E._n = 0; },
    _v: function (x, y, u, v, r, g, b, a, hw, hard) {
      var o = E._n * 10, D = E._data; if (o + 10 > D.length) return;
      D[o] = x; D[o + 1] = y; D[o + 2] = u; D[o + 3] = v; D[o + 4] = r; D[o + 5] = g; D[o + 6] = b; D[o + 7] = a; D[o + 8] = hw; D[o + 9] = hard; E._n++;
    },
    _col: function (c, a, addk) { var k = a; return [c[0] * k, c[1] * k, c[2] * k, a * (1 - (addk == null ? 0.6 : addk))]; },
    /* point rond : rayon r px ; hard ∈ [0,1] (0 = halo doux, 1 = disque net) */
    dot: function (x, y, r, c, a, hard, addk) {
      if (a <= 0.002 || r <= 0.05) return; var q = B._col(c, a, addk), hw = Math.max(r, 1);
      var x0 = x - r, x1 = x + r, y0 = y - r, y1 = y + r;
      B._v(x0, y0, -1, -1, q[0], q[1], q[2], q[3], hw, hard); B._v(x1, y0, 1, -1, q[0], q[1], q[2], q[3], hw, hard); B._v(x1, y1, 1, 1, q[0], q[1], q[2], q[3], hw, hard);
      B._v(x0, y0, -1, -1, q[0], q[1], q[2], q[3], hw, hard); B._v(x1, y1, 1, 1, q[0], q[1], q[2], q[3], hw, hard); B._v(x0, y1, -1, 1, q[0], q[1], q[2], q[3], hw, hard);
    },
    /* segment épais : demi-largeurs w0, w1 ; couleurs c0/c1, alphas a0/a1 */
    seg: function (x0, y0, x1, y1, w0, w1, c0, a0, c1, a1, hard, addk) {
      if (a0 <= 0.002 && a1 <= 0.002) return;
      var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy); if (l < 1e-4) return;
      var tx = dx / l, ty = dy / l, nx = -ty, ny = tx, e0 = w0 * 0.5, e1 = w1 * 0.5;
      var q0 = B._col(c0, a0, addk), q1 = B._col(c1 || c0, a1 == null ? a0 : a1, addk), h0 = Math.max(w0, 1), h1 = Math.max(w1, 1);
      var ax = x0 - tx * e0, ay = y0 - ty * e0, bx = x1 + tx * e1, by = y1 + ty * e1;
      var P = [[ax + nx * w0, ay + ny * w0, 1, q0, h0], [ax - nx * w0, ay - ny * w0, -1, q0, h0], [bx - nx * w1, by - ny * w1, -1, q1, h1], [bx + nx * w1, by + ny * w1, 1, q1, h1]];
      var idx = [0, 1, 2, 0, 2, 3];
      for (var i = 0; i < 6; i++) { var p = P[idx[i]]; B._v(p[0], p[1], 0, p[2], p[3][0], p[3][1], p[3][2], p[3][3], p[4], hard); }
    },
    /* polyligne (tableau de [x,y]) ; w, c, a peuvent être des fonctions de l'index normalisé s ∈ [0,1] */
    line: function (pts, w, c, a, hard, addk) {
      var n = pts.length; if (n < 2) return;
      for (var i = 0; i < n - 1; i++) {
        var s0 = i / (n - 1), s1 = (i + 1) / (n - 1), p0 = pts[i], p1 = pts[i + 1]; if (!p0 || !p1) continue;
        var w0 = typeof w === "function" ? w(s0, i) : w, w1 = typeof w === "function" ? w(s1, i + 1) : w;
        var c0 = typeof c === "function" ? c(s0, i) : c, c1 = typeof c === "function" ? c(s1, i + 1) : c;
        var a0 = typeof a === "function" ? a(s0, i) : a, a1 = typeof a === "function" ? a(s1, i + 1) : a;
        if (p0[2] != null) a0 *= p0[2]; if (p1[2] != null) a1 *= p1[2];
        B.seg(p0[0], p0[1], p1[0], p1[1], w0, w1, c0, a0, c1, a1, hard, addk);
      }
    },
    /* quadrilatère texturé (pour les sprites) : 4 coins [x,y] dans l'ordre haut-gauche, haut-droite, bas-droite, bas-gauche */
    quad: function (pts, a) {
      var uvs = [[0, 1], [1, 1], [1, 0], [0, 0]], idx = [0, 1, 2, 0, 2, 3];
      for (var i = 0; i < 6; i++) { var p = pts[idx[i]]; B._v(p[0], p[1], uvs[idx[i]][0], uvs[idx[i]][1], 1, 1, 1, a, 1, 1); }
    },
    /* envoie le lot ; clampA = 1 quand le fond sous le canvas est transparent (évite la lumière « sans alpha ») */
    flush: function (C, clampA, spriteTex) {
      var gl = C.gl; if (!E._n) return;
      var pr = spriteTex ? E.progSprite : E.progBatch;
      C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pr.p); gl.uniform2f(pr.u.uRes, C.W, C.H); if (pr.u.uClampA) gl.uniform1f(pr.u.uClampA, clampA ? 1 : 0);
      if (spriteTex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, spriteTex); gl.uniform1i(pr.u.uTex, 0); }
      gl.bindVertexArray(E._vao); gl.bindBuffer(gl.ARRAY_BUFFER, E._buf);
      gl.bufferData(gl.ARRAY_BUFFER, E._data.subarray(0, E._n * 10), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, E._n);
      gl.bindVertexArray(C._vao); E._n = 0;
    },
  };

  /* Champ d'étoiles fixe (directions hachées), dessiné en points ; caché par la Terre. */
  E.stars = function (C, cam, a, n) {
    var B = E.batch, N = n || 4200, k = cam.m / 1080; if (a <= 0) return;
    for (var i = 0; i < N; i++) {
      var z = L.hash(i, 31) * 2 - 1, th = L.hash(i, 32) * 6.2831853, rr = Math.sqrt(1 - z * z);
      var d = [rr * Math.cos(th), z, rr * Math.sin(th)], fz = dot(d, cam.f); if (fz <= 0.05) continue;
      var x = cam.px + dot(d, cam.r) / fz * cam.F, y = cam.py - dot(d, cam.u) / fz * cam.F;
      if (x < -4 || y < -4 || x > cam.W + 4 || y > cam.H + 4) continue;
      var b = dot(cam.pos, d), c = dot(cam.pos, cam.pos) - 1.0004, h = b * b - c; if (h > 0 && -b > 0) continue;
      var m = Math.pow(L.hash(i, 33), 7), w = L.hash(i, 34);
      var col = w < 0.3 ? [1, 0.88, 0.72] : w < 0.75 ? [0.92, 0.95, 1] : [0.72, 0.84, 1];
      B.dot(x, y, (1.1 + 2.4 * m) * k, col, (0.22 + 0.78 * m) * a, 0.55, 1);
      if (m > 0.6) B.dot(x, y, 9 * m * k, col, 0.12 * m * a, 0, 1);
    }
  };

  /* Densifie une polyligne (lat, lon) en grand cercle ; renvoie des points 3D (altitude alt). */
  E.densify = function (lls, stepDeg, alt) {
    var out = [];
    for (var i = 0; i < lls.length - 1; i++) {
      var a = ll(lls[i][0], lls[i][1]), b = ll(lls[i + 1][0], lls[i + 1][1]);
      var ang = Math.acos(clamp(dot(a, b), -1, 1)), n = Math.max(1, Math.ceil(ang / D2R / (stepDeg || 0.2)));
      for (var k = 0; k < n; k++) { var u = k / n, so = Math.sin(ang); var p = so < 1e-6 ? a : add(mul(a, Math.sin((1 - u) * ang) / so), mul(b, Math.sin(u * ang) / so)); out.push(mul(norm(p), 1 + (alt || 0))); }
    }
    var z = lls[lls.length - 1]; out.push(ll(z[0], z[1], alt)); return out;
  };
  /* Spline de Catmull-Rom sur (lat, lon), fermée ou non. */
  E.spline = function (pts, per, closed) {
    var out = [], n = pts.length, m = closed ? n : n - 1;
    function P(i) { if (closed) return pts[(i + n) % n]; return pts[clamp(i, 0, n - 1)]; }
    for (var i = 0; i < m; i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (var k = 0; k < per; k++) {
        var t = k / per, t2 = t * t, t3 = t2 * t;
        var f = function (j) { return 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3); };
        out.push([f(0), f(1)]);
      }
    }
    out.push(closed ? pts[0] : pts[n - 1]); return out;
  };
  /* Longueur (km) d'une polyligne (lat, lon). */
  E.lengthKm = function (lls) { var s = 0; for (var i = 0; i < lls.length - 1; i++) { var a = ll(lls[i][0], lls[i][1]), b = ll(lls[i + 1][0], lls[i + 1][1]); s += Math.acos(clamp(dot(a, b), -1, 1)) * 6371; } return s; };

  /* Profil de crête du logo (viewBox 32) : y du tracé « M2 24 L10 10 L14 16 L20 6 L30 24 ». */
  E.LOGO_RIDGE = [[2, 24], [10, 10], [14, 16], [20, 6], [30, 24]];
  E.ridgeY = function (x) {
    var R = E.LOGO_RIDGE; if (x <= R[0][0]) return 24; if (x >= R[4][0]) return 24;
    for (var i = 0; i < 4; i++) if (x <= R[i + 1][0]) return lerp(R[i][1], R[i + 1][1], (x - R[i][0]) / (R[i + 1][0] - R[i][0]));
    return 24;
  };
  /* Points du tracé fermé du logo (crête + base), échantillonnés régulièrement en longueur : n points. */
  E.logoOutline = function (n) {
    var P = [[2, 24], [10, 10], [14, 16], [20, 6], [30, 24], [2, 24]], seg = [], tot = 0;
    for (var i = 0; i < P.length - 1; i++) { var l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); tot += l; }
    var out = [];
    for (var k = 0; k < n; k++) {
      var d = (k / (n - 1)) * tot, j = 0; while (j < seg.length - 1 && d > seg[j]) { d -= seg[j]; j++; }
      var u = clamp(d / seg[j], 0, 1); out.push([lerp(P[j][0], P[j + 1][0], u), lerp(P[j][1], P[j + 1][1], u)]);
    }
    return out;
  };

  L.cosmos.earth = E;

  /* =====================================================================================
     Module 2,00 → 6,00 s
     ===================================================================================== */
  /* Aurore en rideau au-dessus du limbe (passe écran). */
  var FS_AURORA = "#version 300 es\nprecision highp float;\n" + NOISE + "\n" + [
    "in vec2 vUv; out vec4 o;",
    "uniform vec2 uC; uniform float uRl, uS, uMorph, uT, uI, uH;", /* centre du globe (px, y vers le haut), rayon du limbe, px par unité logo, mise en forme, temps, intensité, H écran */
    "float ridge(float x){ if(x<=2.||x>=30.) return 24.; if(x<10.) return mix(24.,10.,(x-2.)/8.); if(x<14.) return mix(10.,16.,(x-10.)/4.); if(x<20.) return mix(16.,6.,(x-14.)/6.); return mix(6.,24.,(x-20.)/10.); }",
    "void main(){",
    "  vec2 p=gl_FragCoord.xy-uC; float r=length(p); float phi=atan(p.x,p.y);",
    "  float X=16.+phi*uRl/uS; float Y=(r-uRl)/uS;", /* unités du logo : X le long du limbe, Y hauteur au-dessus */
    "  if(Y<-1.5||Y>26.||X<-14.||X>46.) { o=vec4(0.); return; }",
    /* plis du rideau : le rideau ondule le long du limbe ; plus fort quand il se défait */
    "  float wob=(1.-uMorph*.85);",
    "  float Xf=X+sin(Y*.22+uT*2.3+X*.15)*.55*wob+sin(X*.6-uT*1.7)*.25*wob+ (Y*.05)*(X-16.)*.06;",
    /* sommet du rideau : aurore libre ↔ crête du logo */
    "  float free=6.+4.5*sin(Xf*.33+uT*1.9)+3.*sin(Xf*.71-uT*1.3)+2.*fbm(vec3(Xf*.18,uT*.6,1.),3);",
    "  float edge=mix(free, 24.-ridge(Xf), uMorph);",
    "  float span=smoothstep(-6.+uMorph*8.,1.+uMorph*2.,Xf)*(1.-smoothstep(31.-uMorph*1.5,40.-uMorph*10.,Xf));",
    /* rayons verticaux */
    "  float rays=.55+.45*fbm(vec3(Xf*1.9,Y*.05-uT*.8,uT*.3),3); rays*=.75+.25*sin(Xf*7.+fbm(vec3(Xf,uT,2.),2)*6.);",
    "  float body=smoothstep(-0.4,0.6,Y)*smoothstep(edge+.4,edge-1.2,Y)*pow(clamp(Y/max(edge,1.),0.,1.),1.6);",
    "  float line=exp(-pow((Y-edge)*uS/2.2,2.))*.9+exp(-pow((Y-edge)*uS/9.,2.))*.35;",
    "  line*=smoothstep(-.5,.8,edge-0.4);",
    "  float a=(body*rays*.55+line*mix(.45,1.,uMorph))*span*uI;",
    "  vec3 c=mix(vec3(.36,.50,.33),vec3(.65,.76,.63),clamp(Y/max(edge,1.),0.,1.));",
    "  c=mix(c,vec3(.80,.90,.78),line*.6);",
    "  c+=vec3(.16,.28,.33)*smoothstep(4.,0.,Y)*body*.6;", /* pied bleuté */
    "  o=vec4(c*a,0.);",
    "}",
  ].join("\n");
  var aur = null;

  /* Cadrages clés (partagés avec b-descent) */
  function heroFrame(C) {
    var m = Math.min(C.W, C.H), v = C.fmt && C.fmt.vertical;
    var Rs = 0.95 * m, top = C.H * (v ? 0.53 : 0.47);
    var logoW = v ? 0.62 * C.W : 0.27 * C.W;
    return { Rs: Rs, top: top, cx: C.W / 2, cy: top + Rs, s: logoW / 28, gap: 0.012 * Rs };
  }
  E.FRAME6 = { lat: E.ICELAND.lat, lon: E.ICELAND.lon, rs: 0.43, fov: 30, sun: [0.55, 0.50, -0.67] };

  /* État de la caméra et de l'éclairage pour t ∈ [2, 6]. */
  function shot(C, t) {
    var m = Math.min(C.W, C.H), hf = heroFrame(C), o = {};
    var R0 = 0.03 * C.H, top0 = C.H / 2 - R0;
    var lonHero = -20, latHero = 9;
    var sunH = null;
    var p = { state: 4, city: 0, cloud: 0.62, cloudShift: -t * 0.004, atmo: 1, bg: 1, stars: 1, sunGlow: 0, lavaGlow: 0, dust: 0, spec: 1, expo: 1, t: t };
    if (t < 2.25) {
      var u = (t - 2) / 0.25;
      o.Rs = R0 * Math.pow(2.8, u); o.cx = C.W / 2; o.cy = C.H / 2; o.lat = 12; o.lon = 140 - 60 * u;
      p.state = 0; p.bg = 0; p.atmo = 0; p.lavaGlow = 0.55 + 0.3 * u; p.cloud = 0; p.sunCam = [0.75, 0.35, -0.55];
    } else if (t < 3.0) {
      var u2 = (t - 2.25) / 0.75, e = ease(Math.pow(u2, 0.85));
      var Rs0 = R0 * 2.8;
      o.Rs = loglerp(Rs0, hf.Rs, e);
      var top = lerp(C.H / 2 - Rs0, hf.top, ease(u2));
      o.cx = C.W / 2; o.cy = top + o.Rs;
      o.lat = lerp(12, latHero, e); o.lon = lonHero + 80 * Math.pow(1 - u2, 2.2) + 0;
      p.state = clamp(4 * sstep(0.0, 0.93, u2) * 1.0, 0, 4);
      p.state = 4 * clamp((u2 - 0.1) / 0.78, 0, 1);
      p.lavaGlow = 0.85 * (1 - sstep(0, 0.35, u2));
      p.atmo = sstep(0.2, 0.75, u2); p.cloud = 0.62 * sstep(0.45, 0.95, u2);
      p.dust = 1 - sstep(0, 0.9, u2);
      p.city = sstep(0.82, 1.0, u2) * 0.6;
      p.sunCam = null; sunH = 1 - sstep(0.75, 1.0, u2);
    } else if (t < 3.75) {
      var u3 = (t - 3.0) / 0.75;
      o.Rs = hf.Rs * (1 + 0.035 * u3); o.cx = hf.cx; o.cy = hf.top + o.Rs; o.lat = latHero; o.lon = lonHero - 2.0 * u3;
      p.city = 0.6 + 0.4 * sstep(0, 0.4, u3); sunH = 0;
    } else if (t < 5.5) {
      /* recul vers le globe entier, la Terre tourne lentement, le jour se lève sur l'Europe */
      var u4 = clamp((t - 3.75) / 0.6, 0, 1), e4 = ease(u4), Rf = 0.40 * m;
      var Rh = hf.Rs * 1.035;
      o.Rs = loglerp(Rh, Rf, e4); var topH = hf.top, topF = C.H / 2 - Rf;
      var top4 = lerp(topH, topF, e4); o.cx = C.W / 2; o.cy = top4 + o.Rs;
      var w = clamp((t - 3.75) / 1.75, 0, 1);
      o.lat = lerp(latHero, 34, e4) + 4 * w; o.lon = lerp(lonHero - 2, -4, e4) - 9 * w;
      p.city = 1 - 0.35 * e4; sunH = 0; p._sunBlend = e4;
    } else {
      /* 5,50 : pivot sec vers l'Islande, centrée à 6,00 */
      var k = t >= 6 ? 1 : clamp(L.spring(t - 5.5, 0.78, 21), 0, 1.08);
      var Rf2 = 0.40 * m, Rk = E.FRAME6.rs * m;
      o.Rs = lerp(Rf2, Rk, clamp(k, 0, 1)); o.cx = C.W / 2; o.cy = C.H / 2;
      o.lat = lerp(38, E.FRAME6.lat, k); o.lon = lerp(-13, E.FRAME6.lon, k);
      p.city = 0.65; sunH = 0; p._sunBlend = 1; p._snap = k;
    }
    o.fov = 30;
    var cam = E.camera(C, o);
    /* soleil */
    var sunHero = function () {
      /* soleil = point du logo : (24, 9) dans la viewBox, rapporté au limbe */
      var Rl = cam.Rs + hf.gap, phi = (24 - 16) * hf.s / Rl, rr = Rl + 15 * hf.s;
      return E.ray(cam, cam.px + rr * Math.sin(phi), cam.py - rr * Math.cos(phi));
    };
    if (p.sunCam) p.sun = E.sunCam(cam, p.sunCam[0], p.sunCam[1], p.sunCam[2]);
    else if (t < 3.0) {
      /* refroidissement : le soleil tourne de face-droite vers l'arrière (lever) */
      var a = E.sunCam(cam, 0.75, 0.35, -0.55), b = sunHero();
      p.sun = norm(add(mul(a, sunH), mul(b, 1 - sunH)));
    } else if (t < 3.75) p.sun = sunHero();
    else {
      var sF = E.FRAME6.sun, sE = E.sunCam(cam, sF[0], sF[1], sF[2]), bl = p._sunBlend;
      p.sun = norm(add(mul(sunHero(), 1 - bl), mul(sE, bl)));
    }
    /* éclat du soleil quand il est derrière le limbe, visible */
    var sp = E.project(cam, add(cam.pos, mul(p.sun, 100)));
    var dl = Math.hypot(sp[0] - cam.px, sp[1] - cam.py) - cam.Rs;
    p.sunVis = sp[2] > 0 ? sstep(-6, 18, dl) : 0;
    p.sunGlow = t >= 2.6 ? sstep(2.6, 3.0, t) * (1 - sstep(3.8, 4.3, t)) : 0;
    p.sunScreen = sp;
    return { cam: cam, p: p, hf: hf };
  }
  E.shotEarth = shot;

  /* Impact géant (2,25) : éclat, éjecta qui s'enroulent et forment la Lune. */
  function impact(C, t, cam) {
    var B = E.batch, m = cam.m, tau = t - 2.25; if (tau < 0) return;
    var Rs = cam.Rs, cx = cam.px, cy = cam.py;
    var ia = 140 * D2R, ix = cx + Rs * Math.cos(ia), iy = cy - Rs * Math.sin(ia);
    /* éclat */
    var fl = Math.exp(-tau / 0.06);
    B.dot(ix, iy, m * (0.25 + 0.6 * (1 - fl)), COL.paper, fl, 0, 1);
    B.dot(ix, iy, m * 1.6, [1, 0.85, 0.6], 0.55 * Math.exp(-tau / 0.04), 0, 1);
    B.dot(ix, iy, m * 0.9 * (0.4 + tau), [1, 0.62, 0.3], 0.45 * Math.exp(-tau / 0.12), 0, 1);
    B.dot(ix, iy, m * 0.03, [1, 0.95, 0.85], fl, 0.4, 1);
    /* éjecta */
    var N = 1400;
    var moon = moonPos(C, t, cam);
    for (var i = 0; i < N; i++) {
      var h1 = L.hash(i, 11), h2 = L.hash(i, 12), h3 = L.hash(i, 13), h4 = L.hash(i, 14);
      var ang = ia + (h1 - 0.5) * 1.6 + (h4 - 0.5) * 0.4, sp = 0.6 + 2.6 * Math.pow(h2, 1.5);
      var k = (1 - Math.exp(-tau * 5.5)) / 5.5;
      var rr = 1 + sp * k * 1.25, swirl = k * (0.9 + h3) * 1.4;
      var a = ang + swirl, qx = Math.cos(a) * rr, qy = Math.sin(a) * rr;
      /* rassemblement vers la Lune */
      var g = sstep(0.12, 0.55, tau) * (0.55 + 0.45 * h3);
      var mx = (moon[0] - cx) / Rs, my = -(moon[1] - cy) / Rs, mr = moon[2] / Rs;
      var oa = h1 * 6.283 + tau * 3, od = mr * (1.1 + 2.5 * h2 * (1 - g));
      qx = lerp(qx, mx + Math.cos(oa) * od, g * 0.85); qy = lerp(qy, my + Math.sin(oa) * od, g * 0.85);
      var x = cx + qx * Rs, y = cy - qy * Rs;
      var life = 1 - sstep(0.35 + 0.3 * h4, 0.75, tau);
      var heat = Math.exp(-tau * (3 + 4 * h2));
      var c = [lerp(0.66, 1.0, heat), lerp(0.27, 0.85, heat), lerp(0.23, 0.6, heat)];
      var rad = (0.9 + 1.8 * h3) * Math.pow(m / 1080, 0.8) * (1 + 0.6 * heat);
      /* traînée de mouvement */
      var a2 = ang + swirl * 0.93, k2 = k * 0.9, rr2 = 1 + sp * k2 * 1.25;
      var px = cx + lerp(Math.cos(a2) * rr2, qx, g) * Rs, py = cy - lerp(Math.sin(a2) * rr2, qy, g) * Rs;
      if (tau < 0.4) B.seg(px, py, x, y, rad * 0.8, rad, c, 0.25 * life, c, 0.8 * life, 0.5, 0.7);
      B.dot(x, y, rad * 2.2, c, 0.9 * life, 0.35, 0.8);
    }
  }
  /* Position écran de la Lune naissante [x, y, rayon px] et son équivalent monde. */
  function moonPos(C, t, cam) {
    var tau = clamp(t - 2.25, 0, 1);
    var e = easeOut(tau / 0.75, 3);
    var qx = lerp(-1.25, -2.6, e), qy = lerp(1.15, 1.45, e);
    var r = 0.27 * lerp(0.4, 1, sstep(0.1, 0.5, tau));
    return [cam.px + qx * cam.Rs, cam.py - qy * cam.Rs, r * cam.Rs];
  }
  function moonWorld(C, t, cam) {
    var mp = moonPos(C, t, cam);
    /* placé dans le plan du centre de la Terre, perpendiculaire à la visée */
    var dist = dot(mul(cam.pos, -1), cam.f);
    var dir = E.ray(cam, mp[0], mp[1]); var k = dist / dot(dir, cam.f);
    var P = add(cam.pos, mul(dir, k));
    return [P[0], P[1], P[2], mp[2] / cam.F * k];
  }

  function drawAurora(C, t, s) {
    var gl = C.gl, cam = s.cam, hf = s.hf;
    if (t < 2.95 || t > 4.35) return;
    /* découverte : rideau libre (2,95) → crête du logo (3,10–3,58) → se défait */
    var morph = sstep(3.0, 3.24, t) * (1 - sstep(3.58, 3.86, t));
    var I = sstep(2.95, 3.12, t) * (1 - sstep(3.9, 4.35, t)) * 1.35;
    gl.useProgram(aur.p);
    gl.uniform2f(aur.u.uC, cam.px, C.H - cam.py);
    gl.uniform1f(aur.u.uRl, cam.Rs + hf.gap * (cam.Rs / hf.Rs)); gl.uniform1f(aur.u.uS, hf.s * Math.sqrt(cam.Rs / hf.Rs));
    gl.uniform1f(aur.u.uMorph, morph); gl.uniform1f(aur.u.uT, t); gl.uniform1f(aur.u.uI, I); gl.uniform1f(aur.u.uH, C.H);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); C.quad();
  }

  /* éclat à six branches du Soleil (le point du logo) */
  function sunFlare(C, t, s) {
    var B = E.batch, sp = s.p.sunScreen, v = s.p.sunVis * s.p.sunGlow; if (!sp || sp[2] <= 0 || v <= 0.01) return;
    var m = s.cam.m, x = sp[0], y = sp[1], k = m / 1080;
    var logoT = sstep(3.05, 3.25, t) * (1 - sstep(3.6, 3.9, t));
    B.dot(x, y, 70 * k, [1, 0.78, 0.5], 0.35 * v, 0, 1);
    B.dot(x, y, 16 * k, [1, 0.93, 0.8], 0.9 * v, 0.2, 1);
    B.dot(x, y, 7 * k * (1 + 0.25 * logoT), COL.paper, v, 1, 0.3);
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + 0.26 + t * 0.05, len = (i % 2 ? 120 : 210) * k * (0.8 + 0.4 * logoT);
      B.seg(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 2.2 * k, 0.4 * k, [1, 0.9, 0.75], 0.5 * v, [1, 0.8, 0.6], 0, 0, 1);
    }
  }

  L.cosmos.register({
    id: "b-earth", order: 20, ranges: [[2.0, 6.0]],
    init: function (C) { aur = C.program(C.VS_QUAD, FS_AURORA); return E.init(C); },
    draw: function (C, t) {
      var s = shot(C, t), p = s.p, cam = s.cam;
      if (t >= 2.25 && t < 3.1) { var mw = moonWorld(C, t, cam); p.moon = mw; p.moonA = sstep(2.42, 2.62, t) * (1 - sstep(2.95, 3.1, t)); }
      if (t >= 2.25 && t < 2.6) { var ia = 140 * D2R; p.impact = Math.exp(-(t - 2.25) / 0.1) * 1.5; p.impactP = norm(add(add(mul(cam.r, Math.cos(ia)), mul(cam.u, Math.sin(ia))), mul(cam.f, -0.35))); }
      /* 5,50–5,75 : flou de mouvement du pivot par 3 sous-images */
      if (false) {
        E.drawGlobe(C, cam, p);
        var gl = C.gl, k2;
        for (var j = 1; j <= 2; j++) {
          var s2 = shot(C, t - j * 0.012); k2 = 0.33;
          s2.p.alpha = k2; s2.p.bg = 1; E.drawGlobe(C, s2.cam, s2.p);
        }
        void gl;
      } else E.drawGlobe(C, cam, p);
      drawAurora(C, t, s);
      E.batch.reset();
      if (t >= 2.25) E.stars(C, cam, 1);
      if (t >= 2.25 && t < 3.1) impact(C, t, cam);
      sunFlare(C, t, s);
      E.batch.flush(C, t < 2.25);
    },
  });
})();
