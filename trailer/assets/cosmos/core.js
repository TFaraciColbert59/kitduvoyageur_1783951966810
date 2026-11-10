/* LKDV cosmos — noyau commun du seul contexte WebGL du film (chargé par index.html).
   Contrat : chaque module s'enregistre avec LKDV.cosmos.register({ id, order, ranges, init, draw }).
   - ranges : [[t0, t1], …] en secondes du film ; draw(C, t) n'est appelé que si t ∈ [t0, t1).
   - order  : ordre de peinture croissant (0 = fond). Mélange par défaut : alpha prémultiplié (ONE, ONE_MINUS_SRC_ALPHA).
   - init(C): compile les programmes, crée les tampons ; peut retourner une promesse (textures).
   - draw(C, t) : fonction pure de t. Aucune horloge, aucun état gardé d'une image à l'autre.
   Le canvas est transparent là où rien n'est dessiné : les plans au sol (z 10) se voient dessous. */
(function () {
  "use strict";
  var mods = [];
  var C = {
    gl: null, canvas: null, W: 1920, H: 1080, fmt: null, ready: null, t: 0,
    register: function (m) { mods.push(m); mods.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); },
    modules: function () { return mods.slice(); },
    /* Compile un programme ; lève une erreur lisible si le shader échoue. */
    program: function (vsSrc, fsSrc) {
      var gl = C.gl;
      function sh(type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("[cosmos] shader: " + gl.getShaderInfoLog(s));
        return s;
      }
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
      gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("[cosmos] link: " + gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: u };
    },
    /* Vertex shader plein écran standard : vUv ∈ [0,1], aPos ∈ [-1,1]. */
    VS_QUAD: "#version 300 es\nin vec2 aPos; out vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }",
    /* Dessine le quad plein écran avec le programme courant (gl.useProgram déjà appelé). */
    quad: function () { var gl = C.gl; gl.bindVertexArray(C._vao); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    /* Charge une texture ; la promesse est suivie par HyperFrames (rien n'est capturé avant). */
    texture: function (url, opts) {
      var gl = C.gl, tex = gl.createTexture(); opts = opts || {};
      var pr = new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY === false ? 0 : 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, opts.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeatS === false ? gl.CLAMP_TO_EDGE : gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mip === false ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
          if (opts.mip !== false) gl.generateMipmap(gl.TEXTURE_2D);
          res(tex);
        };
        img.onerror = function () { rej(new Error("[cosmos] texture introuvable : " + url)); };
        img.src = url;
      });
      C._pending.push(pr);
      return { tex: tex, ready: pr };
    },
    /* Tampon hors écran (RGBA8) de taille w × h, pour les passes intermédiaires (flou, composition). */
    target: function (w, h) {
      var gl = C.gl, tex = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb: fb, tex: tex, w: w, h: h };
    },
    /* Cible de dessin : null = écran. Règle le viewport. */
    bind: function (target) {
      var gl = C.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : C.W, target ? target.h : C.H);
    },
    active: function (t) {
      return mods.filter(function (m) { return m.ranges.some(function (r) { return t >= r[0] && t < r[1]; }); });
    },
    render: function (t) {
      var gl = C.gl; if (!gl) return;
      C.t = t;
      var list = C.active(t);
      C.canvas.style.display = list.length ? "block" : "none";
      if (!list.length) return;
      C.bind(null);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      for (var i = 0; i < list.length; i++) {
        C.bind(null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        list[i].draw(C, t);
      }
      gl.flush();
    },
    /* Appelé une fois par compositions/cosmos.html. */
    mount: function (canvas, root) {
      C.canvas = canvas; C.fmt = window.LKDV.format(root); C.W = C.fmt.W; C.H = C.fmt.H;
      canvas.width = C.W; canvas.height = C.H;
      var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      if (!gl) throw new Error("[cosmos] WebGL2 indisponible");
      C.gl = gl; C._pending = [];
      C._vao = gl.createVertexArray(); gl.bindVertexArray(C._vao);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var inits = mods.map(function (m) { return m.init ? m.init(C) : null; });
      C.ready = Promise.all(inits.concat(C._pending)).then(function () { C.render(C.t); });
      window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
      window.__hf.buildReady["cosmos"] = C.ready;
      window.addEventListener("hf-seek", function (e) {
        var t = e.detail.time;
        if (e.detail.waitUntil) e.detail.waitUntil(C.ready.then(function () { C.render(t); }));
        else C.render(t);
      });
      return C.ready;
    },
  };
  window.LKDV.cosmos = C;
})();
