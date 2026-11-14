/* lib/reframe.js — déclinaison 9:16 (1080×1920) du trailer LKDV.
 *
 * Chargé UNIQUEMENT par film/index-9x16.html. Le film 16:9 (index.html) ne le charge pas.
 *
 * Chaque plan dessine son image 1920×1080 (canvas, incrustation du téléphone et étalonnage compris) dans le #root
 * de sa composition. En 9:16, ce #root (enfant de l'hôte .clip, jamais l'élément minuté) reçoit une transformation
 * qui fait remplir l'écran vertical par un rectangle de l'image 16:9 : le cadre `start` de crops.json à la première
 * image du plan, le cadre `end` à la dernière (interpolation linéaire, vitesse constante à travers la coupe).
 * La caméra et l'incrustation du plan ne sont pas touchées : elles vivent dans l'image 1920×1080.
 *
 * Rectangles en % de l'image 16:9 : x, y = coin haut gauche, w, h = taille ; w/h = 81/256 pour remplir le 9:16.
 * Un cadre plus large que la bande (h > 100, « boîte aux lettres ») montre l'image entière sur fond encre.
 *
 * Tout est fonction du temps : des fromTo sur des objets proxy (un par plan) dans la timeline racine, et un
 * onUpdate de la timeline qui pose la transformation du plan actif. Aucune lecture réseau : les cadres sont
 * incorporés dans index-9x16.html par tools/crops/build-9x16.mjs.
 */
(function () {
  var W = 1920, H = 1080, TW = 1080;

  function transformFor(r) {
    var x0 = (r.x / 100) * W, y0 = (r.y / 100) * H, w = (r.w / 100) * W;
    var S = TW / w;
    return 'translate(' + (-x0 * S).toFixed(3) + 'px,' + (-y0 * S).toFixed(3) + 'px) scale(' + S.toFixed(5) + ')';
  }

  function install(tl, crops, opts) {
    opts = opts || {};
    var plans = [];
    Object.keys(crops).forEach(function (id) {
      var host = document.getElementById(id);
      if (!host) return;
      var c = crops[id];
      var start = parseFloat(host.getAttribute('data-start'));
      var dur = parseFloat(host.getAttribute('data-duration'));
      var a = c.start, b = c.end || c.start;
      var proxy = { x: a.x, y: a.y, w: a.w, h: a.h };
      tl.fromTo(proxy, { x: a.x, y: a.y, w: a.w, h: a.h }, { x: b.x, y: b.y, w: b.w, h: b.h, duration: dur, ease: c.ease || 'none', immediateRender: false }, start);
      plans.push({ id: id, host: host, start: start, end: start + dur, proxy: proxy });
    });
    // Le runtime monte (et peut remonter) la scène dans un enveloppe 1920×1080, enfant direct de l'hôte .clip :
    // la transformation passe par une feuille de style réécrite à chaque image, qui survit aux remontages.
    var sheet = document.createElement('style');
    sheet.id = 'lkdv-reframe';
    document.head.appendChild(sheet);
    var base = '';
    plans.forEach(function (p) {
      base += '#' + p.id + ' > *{position:absolute!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;' +
        'width:1920px!important;height:1080px!important;margin:0!important;transform-origin:0 0!important;}\n';
    });
    function apply() {
      var t = tl.time(), css = base;
      for (var i = 0; i < plans.length; i++) {
        var p = plans[i];
        // pose aussi la transformation des plans voisins : la scène est juste dès qu'elle apparaît
        var r = t < p.start ? (crops[p.id].start) : p.proxy;
        css += '#' + p.id + ' > *{transform:' + transformFor(t >= p.end ? (crops[p.id].end || crops[p.id].start) : r) + '!important;}\n';
      }
      if (sheet.textContent !== css) sheet.textContent = css;
    }
    tl.eventCallback('onUpdate', apply);
    // la timeline couvre toute la durée du film, même sans plan à la fin
    if (opts.duration) tl.set({}, {}, opts.duration);
    apply();
    return { apply: apply, plans: plans };
  }

  window.LKDVReframe = { install: install, transformFor: transformFor };
})();
