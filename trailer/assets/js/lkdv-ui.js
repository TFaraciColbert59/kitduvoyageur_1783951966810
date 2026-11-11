/* LKDV.ui — petites aides SANS ÉTAT pour les scènes d'interface (à charger après gsap, CustomEase et lkdv-stage.js).
   Règles : tout est fonction du temps de la timeline ; fromTo, jamais from ; aucun repeat infini ; ni Date.now() ni Math.random().
   Toutes les aides prennent la timeline `tl` de la scène et un temps absolu `at` (secondes locales) ; elles renvoient `tl`
   (ou le temps de fin pour typeText) afin d'être chaînées. Mode d'emploi : docs/UI-LIB.md. */
(function () {
  "use strict";
  var L = (window.LKDV = window.LKDV || {});
  var PHONE_W = 390, PHONE_H = 693;

  /* ---- Ressort fermé (amortissement zeta, pulsation w) : 0 → 1 en fonction de t. ---- */
  function springValue(t, zeta, w) {
    if (t <= 0) return 0;
    if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    var wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
  }
  /* Ease GSAP (fonction de p ∈ [0,1]) reproduisant un ressort qui se pose en `dur` secondes. */
  function springEase(zeta, dur) {
    var w = 4.4 / (zeta * dur); /* ≈ 1 % de l'amplitude restante à la fin */
    return function (p) { return p >= 1 ? 1 : p <= 0 ? 0 : springValue(p * dur, zeta, w); };
  }
  function $(x) { return typeof x === "string" ? document.querySelector(x) : x; }
  function pick(o, k, d) { return o && o[k] != null ? o[k] : d; }
  /* Premier tween posé sur un élément : il fixe l'état de départ dès le montage (immediateRender) ; les suivants non. */
  function first(el, opts) {
    el = $(el);
    if (opts && opts.immediate != null) return !!opts.immediate;
    if (!el || !el.getAttribute) return true;
    if (el.getAttribute("data-lk-init")) return false;
    el.setAttribute("data-lk-init", "1");
    return true;
  }

  /* ---- Colonne sûre : pose .lk-col et .lk-phone d'après LKDV.format(root) ----
     16:9 : colonne 608 × 1080 à x = 656 ; 9:16 : la même colonne à l'échelle 1080/608 (1080 × 1918). Le téléphone logique
     fait toujours 390 × 693 ; son échelle est --lk-s = largeur de colonne / 390. Retourne { col, phone, s, vertical }. */
  function mountColumn(root, opts) {
    var f = L.format(root), c = f.column;
    if (opts && opts.x != null) c = { x: opts.x, y: c.y, w: c.w, h: c.h, scale: c.scale }; /* colonnes supplémentaires (galerie) */
    var s = c.w / PHONE_W;
    var col = (opts && opts.el) || root.querySelector(".lk-col");
    if (!col) { col = document.createElement("div"); col.className = "lk-col"; root.appendChild(col); }
    var phone = col.querySelector(".lk-phone");
    if (!phone) { phone = document.createElement("div"); phone.className = "lk-phone"; col.appendChild(phone); }
    var st = col.style;
    st.setProperty("--lk-col-x", c.x + "px");
    st.setProperty("--lk-col-y", c.y + "px");
    st.setProperty("--lk-col-w", c.w + "px");
    st.setProperty("--lk-col-h", PHONE_H * s + "px");
    st.setProperty("--lk-s", String(s));
    st.setProperty("--lk-band-top", (f.band.top - c.y) / s + "px");
    st.setProperty("--lk-band-bottom", (f.band.bottom - c.y) / s + "px");
    return { col: col, phone: phone, s: s, vertical: f.vertical };
  }

  /* ---- Entrée ressort 250 ms : amortissement 0,8, scale 0,86 → 1, opacité 0 → 1 (0,12 s, sans rebond) ---- */
  function springIn(tl, target, at, opts) {
    var dur = pick(opts, "dur", 0.25), z = pick(opts, "zeta", 0.8), from = pick(opts, "from", 0.86);
    var imm = first(target, opts);
    var a = { scale: from, opacity: 0 }, b = { scale: 1, duration: dur, ease: springEase(z, dur), immediateRender: imm };
    if (opts && opts.y != null) { a.y = opts.y; b.y = 0; }
    if (opts && opts.x != null) { a.x = opts.x; b.x = 0; }
    if (opts && opts.origin) { a.transformOrigin = opts.origin; b.transformOrigin = opts.origin; }
    tl.fromTo(target, a, b, at);
    tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: Math.min(0.12, dur), ease: "power2.out", immediateRender: imm }, at);
    return tl;
  }
  /* ---- Sortie : 40–50 % plus courte que l'entrée (0,13 s) ---- */
  function popOut(tl, target, at, opts) {
    var dur = pick(opts, "dur", 0.13);
    tl.fromTo(target, { scale: 1, opacity: 1 }, { scale: pick(opts, "to", 0.92), opacity: 0, duration: dur, ease: "power2.in", immediateRender: false }, at);
    return tl;
  }
  /* ---- Appui d'un bouton (bouton d'envoi) : s'enfonce en 0,08 s puis revient en ressort ---- */
  function press(tl, target, at, opts) {
    var depth = pick(opts, "depth", 0.88);
    tl.fromTo(target, { scale: 1 }, { scale: depth, duration: 0.08, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(target, { scale: depth }, { scale: 1, duration: 0.22, ease: springEase(0.6, 0.22), immediateRender: false }, at + 0.08);
    return tl;
  }

  /* ---- Frappe : cps caractères par seconde (40 par défaut). La part visible est fonction du temps. Renvoie le temps de fin. ---- */
  function typeText(tl, el, text, at, cps) {
    cps = cps || 40; el = $(el);
    var n = Array.from(text).length, chars = Array.from(text), proxy = { n: 0 };
    el.textContent = "";
    tl.fromTo(proxy, { n: 0 }, {
      n: n, duration: n / cps, ease: "none", immediateRender: false,
      onUpdate: function () { el.textContent = chars.slice(0, Math.floor(proxy.n + 1e-6)).join(""); },
    }, at);
    return at + n / cps;
  }
  /* ---- Curseur qui clignote (finis : `times` clignotements de `per` secondes) ---- */
  function caret(tl, el, at, dur, per) {
    per = per || 0.5;
    var times = Math.max(1, Math.floor(dur / per));
    tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: per / 2, ease: "steps(1)", repeat: times - 1, repeatDelay: per / 2, yoyo: false, immediateRender: false }, at);
    return tl;
  }

  /* ---- Formats de compteur ---- */
  var fmt = {
    int: function (v) { return String(Math.round(v)); },
    thousands: function (v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); },
    dec1: function (v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); },
    plus: function (v) { return "+" + String(Math.round(v)); },
    pct: function (v) { return Math.round(v) + " %"; },
  };
  /* ---- Compteur en chiffres tabulaires ---- */
  function countTo(tl, el, from, to, at, dur, format) {
    format = format || fmt.int; el = $(el);
    var proxy = { v: from };
    el.textContent = format(from);
    tl.fromTo(proxy, { v: from }, {
      v: to, duration: dur, ease: "power2.out", immediateRender: false,
      onUpdate: function () { el.textContent = format(proxy.v); },
    }, at);
    return tl;
  }
  /* ---- Anneau SVG (circle avec pathLength="100" : classe .lk-ring__fg) : fraction from → to ---- */
  function ringTo(tl, circleEl, from, to, at, dur, ease) {
    circleEl = $(circleEl);
    if (from <= 0.001 && first(circleEl, { immediate: null })) { /* le bout rond d'un tracé vide dessine un point : on masque jusqu'au départ */
      tl.set(circleEl, { opacity: 0 }, 0); tl.set(circleEl, { opacity: 1 }, at + 0.001); circleEl.setAttribute("data-lk-init", "1");
    }
    tl.fromTo(circleEl, { strokeDashoffset: 100 * (1 - from) }, { strokeDashoffset: 100 * (1 - to), duration: dur, ease: ease || "power2.inOut", immediateRender: first(circleEl) }, at);
    return tl;
  }
  /* ---- Barre (.lk-bar > i) : fraction from → to, par clip-path (aucun layout) ---- */
  function barTo(tl, fillEl, from, to, at, dur, ease) {
    fillEl = $(fillEl);
    function cp(v) { return "inset(0% " + (100 * (1 - v)).toFixed(3) + "% 0% 0% round 99px)"; }
    tl.fromTo(fillEl, { clipPath: cp(from) }, { clipPath: cp(to), duration: dur, ease: ease || "power2.out", immediateRender: first(fillEl) }, at);
    return tl;
  }
  /* ---- Rotation du Spinner officiel, pilotée par la timeline (linéaire, `turns` tours finis) ---- */
  function spin(tl, el, at, dur, turns) {
    tl.fromTo(el, { rotation: 0 }, { rotation: 360 * (turns == null ? dur : turns), duration: dur, ease: "none", immediateRender: false }, at);
    return tl;
  }
  /* ---- Lentille d'une capsule (.lk-tabbar__lens, .lk-steps__lens) : de l'onglet `from` à `to` ---- */
  function lensTo(tl, lens, from, to, at, dur) {
    dur = dur || 0.3;
    tl.fromTo(lens, { xPercent: from * 100 }, { xPercent: to * 100, duration: dur, ease: springEase(0.8, dur), immediateRender: false }, at);
    return tl;
  }
  /* ---- Onde de ping (.lk-ping) : anneau qui s'étend et s'efface (une seule fois) ---- */
  function ping(tl, el, at, dur, scaleTo) {
    dur = dur || 0.5;
    if (first(el)) tl.set(el, { opacity: 0, scale: 0.5 }, 0); /* invisible avant l'onde */
    tl.fromTo(el, { scale: 0.5, opacity: 0.9 }, { scale: scaleTo || 2.6, opacity: 0, duration: dur, ease: "power2.out", immediateRender: false }, at);
    return tl;
  }
  /* ---- Écriture manuscrite (.lk-scrib) : la ligne se révèle de gauche à droite ---- */
  function write(tl, el, at, dur) {
    tl.fromTo(el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: dur || 0.4, ease: "none", immediateRender: first(el) }, at);
    return tl;
  }

  /* ---- Pastilles de provenance : mêmes pictos partout ---- */
  var PROV = { pret: "handshake", occasion: "recycle", location: "calendar", achat: "tag" };
  function provHTML(kind, size) {
    return '<span class="lk-prov lk-prov--' + kind + (size ? " lk-prov--" + size : "") + '"><span class="lk-ic" data-ic="' + PROV[kind] + '"></span></span>';
  }
  /* ---- 12 objets du kit (pictos réels de l'app + extra) ---- */
  var ITEMS12 = ["tent", "backpack", "sneaker", "shirt", "bed-double", "flame", "battery", "compass", "droplet", "thermometer", "map", "watch"];
  var KINDS = ["pret", "occasion", "location", "achat"];
  function itemHTML(icon, kind, cls) {
    return '<i class="lk-item' + (cls ? " " + cls : "") + '"><span class="lk-ic" data-ic="' + icon + '"></span><b class="lk-item__lit"><span class="lk-ic" data-ic="' + icon + '"></span></b>' + (kind ? provHTML(kind) : "") + "</i>";
  }
  /* ---- Grille de 38 : remplit `container` (.lk-grid38) de 38 cellules fantômes, retourne le tableau des éléments.
     La provenance de chaque cellule est tirée de LKDV.hash (déterministe). opts.kinds = tableau de 38 clés pour la fixer. ---- */
  function fillGrid38(container, opts) {
    var html = "";
    for (var i = 0; i < 38; i++) {
      var kind = opts && opts.kinds ? opts.kinds[i] : KINDS[Math.floor(L.hash(i, 38) * 4)];
      html += itemHTML(ITEMS12[i % 12], kind);
    }
    container.innerHTML = html;
    return Array.prototype.slice.call(container.children);
  }
  /* ---- Allume des cellules : calque .lk-item__lit et pastille de provenance (décalage `stagger` s) ---- */
  function lightUp(tl, items, at, opts) {
    var dur = pick(opts, "dur", 0.2), stagger = pick(opts, "stagger", 0);
    var lits = [], provs = [];
    items.forEach(function (it) { var l = it.querySelector(".lk-item__lit"), p = it.querySelector(".lk-prov"); if (l) lits.push(l); if (p) provs.push(p); });
    tl.fromTo(lits, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power2.out", stagger: stagger, immediateRender: false }, at);
    if (provs.length) tl.fromTo(provs, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.25, ease: springEase(0.8, 0.25), stagger: stagger, immediateRender: false }, at + dur * 0.5);
    return tl;
  }

  L.ui = {
    PHONE: { w: PHONE_W, h: PHONE_H }, PROV: PROV, ITEMS12: ITEMS12, fmt: fmt,
    springEase: springEase, mountColumn: mountColumn,
    springIn: springIn, popOut: popOut, press: press,
    typeText: typeText, caret: caret, countTo: countTo, ringTo: ringTo, barTo: barTo,
    spin: spin, lensTo: lensTo, ping: ping, write: write,
    provHTML: provHTML, itemHTML: itemHTML, fillGrid38: fillGrid38, lightUp: lightUp,
  };
})();
