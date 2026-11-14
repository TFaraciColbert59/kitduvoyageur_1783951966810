// Vérifie que DUREE (bloc CONFIG) égale data-duration × FPS sur la scène et sur son hôte dans index.html.
// Usage : node tools/verifie-duree.mjs   (depuis trailer/ouverture-lab/) — code de sortie 1 si incohérent.
// Le moteur fait le même contrôle à l'exécution (console.error + window.__ouvertureDureeErreur).
import fs from "node:fs";
const comp = fs.readFileSync("compositions/ouverture.html", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const num = (re, s) => { const m = re.exec(s); return m ? +m[1] : NaN; };
const D = num(/DUREE:\s*(\d+)/, comp), FPS = num(/FPS:\s*(\d+)/, comp);
const durs = [
  ["compositions/ouverture.html #root", num(/data-composition-id="ouverture"[^>]*data-duration="([\d.]+)"/, comp)],
  ["index.html #ouverture", num(/id="ouverture"[^>]*data-duration="([\d.]+)"/, index)],
  ["index.html racine", num(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/, index)],
];
let ok = true;
for (const [n, v] of durs) {
  const good = Math.abs(v * FPS - D) < 0.01;
  ok &&= good;
  console.log(good ? "ok " : "ERREUR", n, "data-duration =", v, "→", (v * FPS).toFixed(3), "images ; DUREE =", D);
}
if (!ok) { console.log(`À corriger : data-duration="${D / FPS}"`); process.exit(1); }
