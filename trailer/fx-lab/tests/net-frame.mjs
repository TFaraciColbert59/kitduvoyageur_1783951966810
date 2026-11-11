// Mesure, sur la simulation elle-même, l'écart des tracés à leur forme finale autour de l'instant net.
// Écart = distance moyenne (px) de chaque point à sa position à NET_FRAME. Usage : node tests/net-frame.mjs
import fs from "node:fs";
import vm from "node:vm";
const g = { LKDVFX: {} };
g.globalThis = g;
vm.createContext(g);
for (const f of ["lib/fx/core.js", "lib/fx/earth-data.js", "lib/fx/earth.js", "lib/fx/traces.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), g);
// finale.js demande un document pour create(), mais viewFor/reculFor sont purs : on les charge aussi.
vm.runInContext(fs.readFileSync("lib/fx/finale.js", "utf8"), g);
const FX = g.LKDVFX, T = FX.Traces;
const sim = T.build({ count: 2600, seed: 5354 });
const NET = T.NET_FRAME;
const ref = T.frame(sim, NET, FX.Finale.viewFor(NET)).pos.slice();
let ok = true;
for (let F = NET - 6; F <= NET + 4; F++) {
  const p = T.frame(sim, F, FX.Finale.viewFor(F)).pos;
  let s = 0;
  for (let i = 0; i < p.length; i += 2) s += Math.hypot(p[i] - ref[i], p[i + 1] - ref[i + 1]);
  const d = s / (p.length / 2);
  const blur = T.softBlur(F);
  console.log(`F ${F} (${F < NET ? "P53 img " + F : "P54 img " + (F - NET)}) écart moyen ${d.toFixed(2)} px, flou ${blur.toFixed(2)} px, tressage ${T.braidAmp(F).toFixed(3)} u`);
  if (F < NET && d + blur < 1) ok = false; // net trop tôt
  if (F >= NET && (d > 0.01 || blur > 0)) ok = false; // pas net à l'instant voulu
}
console.log(ok ? "OK : net pour la première fois à F = " + NET + " (image 3480 du film)" : "ÉCHEC");
process.exit(ok ? 0 : 1);
