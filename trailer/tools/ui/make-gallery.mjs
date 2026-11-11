// Génère les deux galeries de contrôle (16:9 et 9:16) de la bibliothèque d'interface. Usage : node qa/tmp/ui-lib/make-gallery.mjs
import fs from "node:fs";
import path from "node:path";
const base = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const ic = (n, cls = "") => `<span class="lk-ic ${cls}" data-ic="${n}"></span>`;

function colA(id) {
  return `
<div class="lk-col" id="${id}"><div class="lk-phone">
  <div class="lk-abs" style="left:12px;right:12px;top:var(--lk-band-top)">
    <div class="lk-island" id="${id}-isl"><span class="lk-avatar lk-avatar--on lk-avatar--s">H</span>${ic("bottle", "lk-ic--l")}<span class="lk-island__sp"></span><b class="lk-num" id="${id}-isl-n">0</b></div>
  </div>
  <div class="lk-abs" style="left:12px;right:12px;top:calc(var(--lk-band-top) + 76px)">
    <div class="lk-ask lk-glass" id="${id}-ask"><span class="lk-avatar">L</span><div class="lk-ask__txt"><span id="${id}-ask-t"></span><i class="lk-caret" id="${id}-caret"></i></div><button class="lk-send" id="${id}-send">${ic("arrow-right", "lk-ic--m")}</button></div>
    <div class="lk-stack-h" style="margin-top:14px;gap:8px">
      <span class="lk-pill lk-pill--round lk-glass" id="${id}-p1">${ic("map-pin")}</span>
      <span class="lk-pill lk-pill--round lk-glass" id="${id}-p2">${ic("van")}</span>
      <span class="lk-pill lk-glass" id="${id}-p3">${ic("calendar")}<b class="lk-num">10</b></span>
      <span class="lk-pill lk-glass" id="${id}-p4">${ic("users")}<b class="lk-num">4</b></span>
      <span class="lk-spinner lk-spinner--lg lk-spinner--inverted" id="${id}-spin"></span>
    </div>
  </div>
  <div class="lk-sheet lk-sheet-glass lk-sheet--mid" id="${id}-sheet" style="--lk-sheet-h:330px">
    <i class="lk-sheet__grab"></i>
    <div class="lk-seg"><span class="is-on">${ic("map-pin", "lk-ic--s")}</span><span>${ic("users", "lk-ic--s")}</span><span>${ic("ticket", "lk-ic--s")}</span></div>
    <div class="lk-row"><span class="lk-row__tile">${ic("route", "lk-ic--s")}</span><i class="lk-row__line" style="--w:52%"></i><b class="lk-num lk-row__val" id="${id}-km">0</b>${ic("chevron-right", "lk-row__chev")}</div>
    <div class="lk-row"><span class="lk-row__tile">${ic("moon", "lk-ic--s")}</span><i class="lk-row__line" style="--w:38%"></i><span class="lk-chip" data-tone="warn">${ic("wind", "lk-ic--s")}<span>3</span></span>${ic("chevron-right", "lk-row__chev")}</div>
    <div class="lk-row"><span class="lk-row__tile">${ic("banknote", "lk-ic--s")}</span><div class="lk-bar lk-bar--thick" style="flex:1"><i id="${id}-bud"></i></div><b class="lk-num lk-row__val" id="${id}-pct">0</b></div>
  </div>
  <div class="lk-abs" style="left:12px;right:12px;bottom:14px"><div class="lk-tabbar" id="${id}-tab"><i class="lk-tabbar__lens" id="${id}-lens"></i>
    <span class="lk-tab is-active">${ic("home")}</span><span class="lk-tab">${ic("compass")}</span><span class="lk-tab">${ic("users")}</span><span class="lk-tab">${ic("send")}</span><span class="lk-tab">${ic("user")}</span></div></div>
</div></div>`;
}

function colB(id) {
  const ticks = Array.from({ length: 12 }, () => `<span class="lk-check lk-check--soft" style="width:22px;height:22px">${ic("check", "lk-ic--s")}</span>`).join("");
  const skill = (icn, n, i) => `<div class="lk-skill"><span class="lk-skill__ic">${ic(icn, "lk-ic--s")}</span><div class="lk-bar lk-bar--thick"><i id="${id}-sk${i}"></i></div><b class="lk-num lk-skill__plus" id="${id}-skn${i}">+0</b></div>`;
  return `
<div class="lk-col" id="${id}"><div class="lk-phone">
  <div class="lk-abs" style="left:12px;right:12px;top:var(--lk-band-top)">
    <div class="lk-steps lk-glass" id="${id}-steps"><i class="lk-steps__lens" id="${id}-slens"></i><span class="lk-step is-active">${ic("map")}</span><span class="lk-step">${ic("users")}</span><span class="lk-step">${ic("ticket")}</span><span class="lk-step">${ic("shield-check")}</span><span class="lk-step">${ic("backpack")}</span></div>
    <div class="lk-card lk-glass lk-stack-v" id="${id}-card" style="margin-top:12px;align-items:center;padding:20px 16px 26px;gap:16px">
      <div class="lk-ring lk-ring--big" id="${id}-ring"><svg viewBox="0 0 100 100"><circle class="lk-ring__bg" cx="50" cy="50" r="44"/><circle class="lk-ring__fg" id="${id}-rfg" cx="50" cy="50" r="44" pathLength="100" transform="rotate(-90 50 50)"/></svg><div class="lk-ring__ctr"><span class="lk-avatar lk-avatar--l">M</span></div><b class="lk-num lk-ring__num lk-flat" id="${id}-rnum">0</b></div>
      <div class="lk-stack-h" style="gap:3px;flex-wrap:wrap;justify-content:center;margin-top:8px">${ticks}</div>
    </div>
    <div class="lk-card lk-glass lk-stack-v" style="margin-top:10px;gap:0;padding:8px 14px">${skill("compass", 25, 1)}${skill("backpack", 40, 2)}${skill("feather", 60, 3)}${skill("handshake", 10, 4)}</div>
    <div class="lk-stack-h" style="margin-top:12px;gap:8px">
      <span class="lk-obj lk-glass" id="${id}-o1">${ic("satellite")}</span>
      <span class="lk-obj lk-glass" id="${id}-o2">${ic("watch")}<b class="lk-num" id="${id}-o2n">0</b></span>
      <span class="lk-obj lk-glass" id="${id}-o3">${ic("battery")}<span class="lk-bar"><i id="${id}-o3b"></i></span></span>
      <span class="lk-check lk-check--double" id="${id}-dc">${ic("check-check")}</span>
    </div>
  </div>
</div></div>`;
}

function colC(id) {
  const prov = ["pret", "occasion", "location", "achat"].map((k) => `<span id="${id}-pv-${k}">${"__P" + k}</span>`).join("");
  return `
<div class="lk-col lk-outdoor" id="${id}"><div class="lk-phone">
  <div class="lk-abs" style="left:12px;right:12px;top:var(--lk-band-top)">
    <div class="lk-card lk-glass" id="${id}-card" style="padding:14px 12px 20px"><div class="lk-grid38" id="${id}-grid"></div></div>
    <div class="lk-stack-h" style="margin-top:14px;justify-content:space-between" id="${id}-provs">__PROVS</div>
    <div class="lk-stack-h" style="margin-top:12px;justify-content:space-between" id="${id}-avs"><span class="lk-avatars"><span class="lk-avatar">L</span><span class="lk-avatar">S</span><span class="lk-avatar">I</span><span class="lk-avatar lk-avatar--empty">+</span></span><span class="lk-avatar lk-avatar--on">H</span><span class="lk-chip" data-tone="soft">${ic("handshake", "lk-ic--s")}<span>2,1</span></span><span class="lk-chip" data-tone="good">${ic("check", "lk-ic--s")}<span>6/38</span></span></div>
    <div class="lk-stack-h" style="margin-top:12px;justify-content:space-between" id="${id}-ico">${["snowflake", "camera", "sneaker", "run", "wheelchair", "hot-spring", "paddle", "bookmark-fill", "pause-fill"].map((n) => `<span class="lk-pill lk-pill--round lk-flat" style="width:36px;height:36px;min-width:0">${ic(n, "lk-ic--s")}</span>`).join("")}</div>
  </div>
</div></div>`;
}

function colD(id) {
  return `
<div class="lk-col" id="${id}"><div class="lk-phone">
  <div class="lk-abs" style="left:14px;top:40px"><div class="lk-cover" id="${id}-cover" style="--lk-pg-w:160px;--lk-pg-h:230px"><i class="lk-cover__logo"></i></div></div>
  <div class="lk-abs" style="left:190px;top:50px"><div class="lk-page" id="${id}-page" style="--lk-pg-w:186px;--lk-pg-h:250px;padding:0">
    <i class="lk-page__photo" style="--x:10px;--y:10px;--w:84px;--h:64px"></i><i class="lk-page__photo" style="--x:102px;--y:18px;--w:72px;--h:56px;--ph:linear-gradient(160deg, var(--sky-600), var(--sage-300))"></i>
    <i class="lk-scrib" id="${id}-s1" style="--x:12px;--y:96px;--w:160px"></i><i class="lk-scrib lk-scrib--b" id="${id}-s2" style="--x:12px;--y:116px;--w:140px"></i><i class="lk-scrib lk-scrib--c" id="${id}-s3" style="--x:12px;--y:136px;--w:120px"></i>
    <i class="lk-rule" style="--x:12px;--y:160px"></i><i class="lk-scrib" style="--x:12px;--y:170px;--w:90px"></i></div></div>
  <div class="lk-abs" style="left:48px;top:300px"><div class="lk-device" id="${id}-dev" style="--lk-dev-w:150px;--lk-dev-h:300px;border-radius:30px;padding:6px"><div class="lk-device__screen" style="border-radius:24px"><i class="lk-device__isl" style="width:46px;height:13px;margin-left:-23px;top:6px"></i>
    <div class="lk-abs" style="left:8px;right:8px;top:34px"><div class="lk-island" style="min-height:40px;padding:4px 10px 4px 5px;border-radius:20px"><span class="lk-avatar lk-avatar--ink lk-avatar--s" style="width:30px;height:30px;font-size:18px">N</span>${ic("run", "lk-ic--s")}<span class="lk-island__sp"></span><b class="lk-num" style="font-size:17px">5,2</b></div></div></div></div></div>
  <div class="lk-abs" style="left:230px;top:330px;display:grid;gap:12px">
    <div class="lk-stack-h" style="gap:10px">${[1, 2, 3].map((i) => `<span class="lk-tick lk-glass">${ic(["route", "moon", "backpack"][i - 1])}<span class="lk-check">${ic("check")}</span></span>`).join("")}</div>
    <span class="lk-item lk-item--l is-on"><span class="lk-ic" data-ic="tent"></span><b class="lk-item__lit"><span class="lk-ic" data-ic="tent"></span></b>${"__PROV"}</span>
  </div>
</div></div>`;
}

const provHTMLs = {
  pret: `<span class="lk-prov lk-prov--pret">${ic("handshake")}</span>`,
  occasion: `<span class="lk-prov lk-prov--occasion">${ic("recycle")}</span>`,
  location: `<span class="lk-prov lk-prov--location">${ic("calendar")}</span>`,
  achat: `<span class="lk-prov lk-prov--achat">${ic("tag")}</span>`,
};

function scene(vertical) {
  const W = vertical ? 1080 : 1920, H = vertical ? 1920 : 1080;
  const cols = vertical
    ? colA("gA")
    : colA("gA") + colB("gB") + colC("gC") + colD("gD");
  let html = cols.replace("__PROVS", Object.values(provHTMLs).join("")).replace('"__PROV"', "").replace("${\"__PROV\"}", provHTMLs.pret);
  html = html.replace("__PROV", provHTMLs.pret);
  const mountBlock = vertical
    ? `var mA = LKDV.ui.mountColumn(root, { el: document.getElementById("gA") });`
    : `var mA = LKDV.ui.mountColumn(root, { el: document.getElementById("gA"), x: 40 });
    var mB = LKDV.ui.mountColumn(root, { el: document.getElementById("gB"), x: 656 });
    var mC = LKDV.ui.mountColumn(root, { el: document.getElementById("gC"), x: 1272 });
    var mD = LKDV.ui.mountColumn(root, { el: document.getElementById("gD"), x: 1272 });`;
  const motionBig = vertical ? "" : `
    /* B : anneau, compteurs, barres, onde, lentille */
    U.springIn(tl, "#gB-steps", 0.25); U.springIn(tl, "#gB-card", 0.3);
    U.ringTo(tl, "#gB-rfg", 0, 0.96, 0.4, 1.0); U.countTo(tl, document.getElementById("gB-rnum"), 0, 96, 0.4, 1.0);
    [1,2,3,4].forEach(function (i) { var v = [0.8,0.55,0.7,0.35][i-1]; U.barTo(tl, document.getElementById("gB-sk"+i), 0, v, 0.5 + i*0.08, 0.7); U.countTo(tl, document.getElementById("gB-skn"+i), 0, [25,40,60,10][i-1], 0.5 + i*0.08, 0.7, U.fmt.plus); U.springIn(tl, "#gB-sk"+i, 0.45+i*0.08); });
    ["gB-o1","gB-o2","gB-o3","gB-dc"].forEach(function (id, i) { U.springIn(tl, "#"+id, 0.9 + i*0.125); });
    U.countTo(tl, document.getElementById("gB-o2n"), 0, 14.2, 1.0, 0.6, U.fmt.dec1); U.barTo(tl, document.getElementById("gB-o3b"), 0, 0.82, 1.0, 0.6);
    U.lensTo(tl, "#gB-slens", 0, 2, 1.6, 0.35);
    /* C : grille de 38 allumée par vagues */
    var items = U.fillGrid38(document.getElementById("gC-grid"));
    U.springIn(tl, "#gC-card", 0.2);
    U.lightUp(tl, items.slice(0, 6), 0.8, { stagger: 0.04 }); U.lightUp(tl, items.slice(6, 20), 1.3, { stagger: 0.03 }); U.lightUp(tl, items.slice(20), 1.9, { stagger: 0.02 });
    ["gC-provs","gC-avs","gC-ico"].forEach(function (id, i) { U.springIn(tl, "#"+id, 0.5 + i*0.15); });
    /* sortie de A, B, C puis entrée de D (et réticule) */
    ["#gA","#gB","#gC"].forEach(function (s) { U.popOut(tl, s, 2.9); });
    U.springIn(tl, "#gD", 3.1);
    U.write(tl, "#gD-s1", 3.4, 0.4); U.write(tl, "#gD-s2", 3.8, 0.4); U.write(tl, "#gD-s3", 4.2, 0.3);
    var sp2 = document.getElementById("gD-ret");
    U.springIn(tl, "#gD-ret", 3.2);
    U.ping(tl, "#gD-ping", 3.6, 0.6);`;
  return `<template>
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; }
    #gal-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #0e2a4a 0%, #2c5d86 34%, #e9a85a 56%, #6a8a5c 70%, #3a4a32 100%); }
    #gal-snow { position: absolute; right: 0; top: 0; width: 640px; height: 100%; background: linear-gradient(180deg, #ffffff 0%, #dfeaf0 55%, #f6f3ec 100%); }
    #gal-sun { position: absolute; left: 200px; top: 380px; width: 240px; height: 240px; border-radius: 50%; background: #ffe9b0; }
    .lk-col .lk-glass, .lk-col .lk-sheet-glass { }
  </style>
  <div id="root" data-composition-id="gallery" data-width="${W}" data-height="${H}">
    <div id="gal-bg"></div>${vertical ? "" : `<div id="gal-snow"></div>`}<div id="gal-sun"></div>
    ${html}
    ${vertical ? "" : `<div class="lk-reticle" id="gD-ret" style="left:90px;top:70px;--lk-ret-w:380px;--lk-ret-h:230px"><i class="lk-reticle__c lk-reticle__c--tl"></i><i class="lk-reticle__c lk-reticle__c--tr"></i><i class="lk-reticle__c lk-reticle__c--bl"></i><i class="lk-reticle__c lk-reticle__c--br"></i><span class="lk-reticle__lbl lk-reticle__lbl--t">408 M</span><span class="lk-reticle__lbl lk-reticle__lbl--b">64.1°N 21.9°W</span></div><span class="lk-ping" id="gD-ping" style="left:300px;top:185px"></span>`}
  </div>
  <script>
    (function () {
    var root = document.querySelector('[data-composition-id="gallery"]');
    var U = LKDV.ui;
    ${mountBlock}
    var tl = gsap.timeline({ paused: true });
    /* A : barre de saisie, îlot, pastilles, tiroir, capsule */
    U.springIn(tl, "#gA-isl", 0.15); U.countTo(tl, document.getElementById("gA-isl-n"), 0, 3, 0.3, 0.4);
    U.springIn(tl, "#gA-ask", 0.2);
    var end = U.typeText(tl, document.getElementById("gA-ask-t"), "Islande · van · 10 jours · 4", 0.4, 40);
    U.caret(tl, "#gA-caret", 0.4, 1.4);
    U.press(tl, "#gA-send", end + 0.1);
    ["gA-p1","gA-p2","gA-p3","gA-p4"].forEach(function (id, i) { U.springIn(tl, "#"+id, 0.5 + i*0.125); });
    U.springIn(tl, "#gA-spin", 1.2); U.spin(tl, "#gA-spin", 1.2, 1.7, 1.7);
    U.springIn(tl, "#gA-sheet", 0.05, { y: 40 }); U.springIn(tl, "#gA-tab", 0.5);
    U.countTo(tl, document.getElementById("gA-km"), 0, 1322, 0.9, 0.8, U.fmt.thousands); U.barTo(tl, document.getElementById("gA-bud"), 0, 0.98, 0.9, 0.8); U.countTo(tl, document.getElementById("gA-pct"), 0, 98, 0.9, 0.8, U.fmt.pct);
    U.lensTo(tl, "#gA-lens", 0, 3, 1.4, 0.35);
    ${motionBig}
    window.__timelines = window.__timelines || {};
    window.__timelines["gallery"] = tl;
    })();
  </script>
</template>`;
}

function indexHtml(vertical) {
  const W = vertical ? 1080 : 1920, H = vertical ? 1920 : 1080;
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=${W}, height=${H}" /><title>UI lib gallery</title>
<script src="assets/vendor/gsap.min.js"></script><script src="assets/vendor/CustomEase.min.js"></script>
<script src="assets/js/lkdv-stage.js"></script><script src="assets/js/lkdv-ui.js"></script>
<link rel="stylesheet" href="assets/lkdv-tokens.css" /><link rel="stylesheet" href="assets/lkdv-ui.css" />
<style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #141916; } #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; } #root > [data-composition-src] { position: absolute; inset: 0; }</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="6" data-fps="60" data-width="${W}" data-height="${H}">
  <div id="gallery" data-composition-id="gallery" data-composition-src="compositions/gallery.html" data-start="0" data-duration="6" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index: 10"></div>
</div>
<script>gsap.registerPlugin(CustomEase); window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script>
</body></html>
`;
}

for (const [dir, v] of [["gallery", false], ["gallery-v", true]]) {
  const d = path.join(base, dir);
  fs.mkdirSync(path.join(d, "compositions"), { recursive: true });
  fs.writeFileSync(path.join(d, "index.html"), indexHtml(v));
  fs.writeFileSync(path.join(d, "compositions/gallery.html"), scene(v));
  const link = path.join(d, "assets");
  if (!fs.existsSync(link)) fs.symlinkSync("../../../../assets", link);
  fs.writeFileSync(path.join(d, "hyperframes.json"), fs.readFileSync(path.join(base, "../../../hyperframes.json")));
}
console.log("ok");
