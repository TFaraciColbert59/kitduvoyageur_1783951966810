#!/usr/bin/env node
/* LKDV trailer — motion-lab/v6/render-v6.mjs
 * Rend les surcouches de motion design de la v6 d'après motion-lab/v6/reglages-v6.json :
 *   motion-lab/renders/v6/avant/fNNNN.png  (transparence, posées avant le grain : fil, logo, point du Soleil)
 *   motion-lab/renders/v6/apres/fNNNN.png  (transparence, posées après le grain : bandes du cadre)
 *   motion-lab/renders/v6/fin-base.mkv     (la fin 1335–1439 refaite à 24 i/s : plaque + tracés, sans logo ;
 *                                            FFV1, Rec.709 ; image 0 = image 1335 du film)
 * NNNN = image du film. Une image sans rien n'est pas écrite (build-ours.mjs met alors une image vide).
 * Usage (depuis trailer/) : node motion-lab/v6/render-v6.mjs [--sans-fin] [--de N --a M]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(here, "..");
const trailer = path.resolve(lab, "..");
const repo = path.resolve(trailer, "..");
const OUT = path.join(lab, "renders/v6");
const args = process.argv.slice(2);
const argN = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const DE = argN("--de", 0), A = argN("--a", 1439);
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      const p = path.join(repo, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        r.writeHead(404);
        return r.end();
      }
      r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(p).pipe(r);
    });
    srv.listen(0, "127.0.0.1", () => res(srv));
  });
}

const srv = await serve();
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--force-color-profile=srgb"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/trailer/motion-lab/stage.html`, { waitUntil: "load" });
  const actifs = await page.evaluate((a, b) => {
    const o = [];
    for (let n = a; n <= b; n++) o.push(LKDVM.v6.actif(n));
    return o;
  }, DE, A);
  const grab = async (scene, n, params) => {
    const url = await page.evaluate((s, nn, pp) => window.renderFrame(s, nn, pp), scene, n, params);
    return Buffer.from(url.split(",")[1], "base64");
  };
  const counts = { avant: [], apres: [] };
  for (const cle of ["avant", "apres"]) {
    const dir = path.join(OUT, cle);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      const n = Number(f.slice(1, 5));
      if (n >= DE && n <= A) fs.rmSync(path.join(dir, f));
    }
  }
  for (let n = DE; n <= A; n++) {
    const act = actifs[n - DE];
    for (const cle of ["avant", "apres"]) {
      if (!act[cle]) continue;
      const png = await grab(`v6-${cle}`, n, { transparent: true });
      fs.writeFileSync(path.join(OUT, cle, `f${String(n).padStart(4, "0")}.png`), png);
      counts[cle].push(n);
    }
    if (n % 100 === 0) console.log("image", n);
  }
  let fin = null;
  if (!args.includes("--sans-fin")) {
    const dir = path.join(OUT, "fin-base");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (let n = 1335; n <= 1439; n++) fs.writeFileSync(path.join(dir, `f${String(n - 1335).padStart(4, "0")}.png`), await grab("v6-fin-base", n, {}));
    fin = path.join(OUT, "fin-base.mkv");
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "24", "-i", path.join(dir, "f%04d.png"),
      "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
      "-c:v", "ffv1", "-level", "3", fin], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr);
    console.log("→ fin-base.mkv (105 images)");
  }
  const man = { reglages: JSON.parse(fs.readFileSync(path.join(here, "reglages-v6.json"), "utf8")).interrupteurs,
    avant: { images: counts.avant.length, plages: plages(counts.avant) }, apres: { images: counts.apres.length, plages: plages(counts.apres) },
    fin_base: fin ? path.relative(trailer, fin) : null };
  fs.writeFileSync(path.join(OUT, "manifeste.json"), JSON.stringify(man, null, 1));
  console.log(JSON.stringify(man));
} finally {
  await browser.close();
  srv.close();
}
function plages(l) {
  const o = [];
  for (const n of l) {
    if (o.length && o.at(-1)[1] === n - 1) o.at(-1)[1] = n;
    else o.push([n, n]);
  }
  return o;
}
