/* a-finale.js — cosmos, équipe A, 57,5 → 60,0 s (order 30–39).
   Sous nous : gnd-finale (plan 21, fjord de Norvège sous l'aurore) bascule vers le haut jusqu'à 58,5.
   57,50 → 58,25 : le gaz d'aurore entre par-dessus le ciel (alpha 0 → 1, bord qui descend du haut du cadre).
   58,25 → 59,25 : les rideaux d'aurore se détendent en voiles de gaz, les étoiles se multiplient puis s'enfoncent dans le gaz.
   59,25 → 60,00 : réglages EXACTEMENT ceux de la nébuleuse (gas.NEBULA), phase de mouvement = t − 60 :
   l'image 3599 (t = 59,9833, phase −1/60) précède l'image 0 (phase 0) par construction. */
(function () {
  "use strict";
  var LK = window.LKDV, CO = LK.cosmos, G = CO.gas;
  var T_IN = 57.5, T_OPAQUE = 58.25, T_NEB = 59.25, T_LOOP = 60.0;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* Réglages du gaz à l'instant t (exposés pour le contrôle de la boucle). */
  function paramsAt(t, C) {
    if (t >= T_NEB) return G.NEBULA;                               // identité exacte : aucune erreur d'arrondi
    var mn = Math.min(C.W, C.H), top = C.H / (2 * mn), bottom = -top;
    var A = G.mix(G.AURORA, {}, 0);
    var tilt = 0.55 * Math.max(T_NEB - t, 0);                       // la caméra bascule vers le haut : le ciel descend
    A.camY = tilt;
    A.curtY = -0.30 + tilt * 0.9;
    A.drift = (t - T_LOOP) * 0.14;
    A.extra = 0.15 + 0.85 * sstep(57.9, 58.7, t);
    var k = sstep(T_OPAQUE, T_NEB, t);
    var P = G.mix(A, G.NEBULA, k);
    P.extra = A.extra * (1 - sstep(58.8, T_NEB, t));
    var e = sstep(T_IN, T_OPAQUE, t);
    P.alpha = e;
    P.horizon = lerp(top + 0.15, bottom - 0.35, e); P.horizonSoft = 0.22;
    return P;
  }

  CO.register({
    id: "a-finale", order: 30, ranges: [[T_IN, T_LOOP]],
    init: function (C) { return G.init(C); },
    draw: function (C, t) { G.render(C, t - T_LOOP, paramsAt(t, C)); },
  });
  CO.finaleDebug = { paramsAt: paramsAt };
})();
