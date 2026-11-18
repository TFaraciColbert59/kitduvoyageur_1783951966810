// Rend les plans du storyboard en PNG 1080 × 1920.
// node render.mjs [p01 p02 …]   (sans argument : les 22 plans)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Array.from({ length: 22 }, (_, i) => "p" + String(i + 1).padStart(2, "0"));

// Serveur statique sur le dossier video/ (les plans lisent aussi ../../assets et ../../../film-lkdv/assets).
import http from "node:http";
const ROOT = path.resolve(here, "../../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".otf": "font/otf", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = "http://127.0.0.1:" + server.address().port + "/" + path.relative(ROOT, here) + "/";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const id of ids) {
  const file = path.join(here, id + ".html");
  if (!fs.existsSync(file)) { console.log("absent", id); continue; }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(id, "ERREUR", e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.text().startsWith("fit")) console.log(id, m.type(), m.text()); });
  await page.goto(BASE + id + ".html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ready !== false, null, { timeout: 120000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, id + ".png"), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await page.close();
  console.log("ok", id);
}
await browser.close();
server.close();
