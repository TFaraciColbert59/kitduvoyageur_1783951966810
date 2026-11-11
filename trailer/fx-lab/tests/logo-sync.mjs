// Vérifie que la géométrie du logo codée dans lib/fx/traces.js est identique à public/assets/logo-mark.svg
// et à la copie assets/logo-mark.svg. Usage : node tests/logo-sync.mjs (depuis trailer/fx-lab/)
import fs from "node:fs";
import vm from "node:vm";
const g = { LKDVFX: {} };
g.globalThis = g;
vm.createContext(g);
for (const f of ["lib/fx/core.js", "lib/fx/traces.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), g);
const L = g.LKDVFX.Traces.LOGO;
let ok = true;
for (const svgPath of ["../../public/assets/logo-mark.svg", "assets/logo-mark.svg"]) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  const c = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
  const sw = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
  const same = ds[0] === L.mountains && ds[1] === L.base && +c[1] === L.sun.cx && +c[2] === L.sun.cy && +c[3] === L.sun.r && sw.every((w) => w === L.strokeWidth) && /viewBox="0 0 32 32"/.test(svg);
  console.log(svgPath, same ? "identique" : "DIFFÉRENT");
  ok = ok && same;
}
process.exit(ok ? 0 : 1);
