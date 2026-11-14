#!/usr/bin/env node
/* LKDV trailer — motion-lab/render.mjs
 * Rend des images de proposition (motion design posé sur les vraies images du montage) avec Chrome sans tête.
 * Usage :
 *   node motion-lab/render.mjs still <scène> <image-du-film> <sortie.jpg> [paramsJSON]
 *   node motion-lab/render.mjs seq   <scène> <première> <dernière> <dossier-sortie> [paramsJSON]
 * Un petit serveur local sert le dépôt (racine = dossier parent de trailer/) pour que les images et les polices
 * se chargent sans « canvas taint ». Chrome système (CHROME_PATH pour en choisir un autre).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml" };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(repo, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function main() {
  const [mode, scene, ...rest] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--force-color-profile=srgb", "--disable-gpu-vsync"],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on("console", (m) => console.log("[page]", m.text()));
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto(`http://127.0.0.1:${port}/trailer/motion-lab/stage.html`, { waitUntil: "load" });
  const grab = async (n, params) => {
    const url = await page.evaluate((s, nn, pp) => window.renderFrame(s, nn, pp), scene, n, params);
    return Buffer.from(url.split(",")[1], "base64");
  };
  try {
    if (mode === "still") {
      const [n, out, pj] = rest;
      const params = pj ? JSON.parse(pj) : {};
      const png = await grab(Number(n), params);
      let q = 90;
      let buf;
      do {
        buf = await sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer();
        q -= 3;
      } while (buf.length > 395 * 1024 && q > 60);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      console.log(out, Math.round(buf.length / 1024) + " Ko", "q" + (q + 3));
    } else if (mode === "seq") {
      const [a, b, dir, pj] = rest;
      const params = pj ? JSON.parse(pj) : {};
      fs.mkdirSync(dir, { recursive: true });
      for (let n = Number(a); n <= Number(b); n++) {
        const png = await grab(n, params);
        fs.writeFileSync(path.join(dir, `f${String(n).padStart(4, "0")}.png`), png);
        if (n % 20 === 0) console.log("image", n);
        if (n % 30 === 0) await page.evaluate(() => window.dropCache());
      }
    } else throw new Error("mode inconnu : " + mode);
  } finally {
    await browser.close();
    srv.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
