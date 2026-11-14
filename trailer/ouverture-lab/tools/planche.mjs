// Planches et mesures des captures de l'ouverture (sharp, déjà dans trailer/node_modules).
// Usage (depuis trailer/ouverture-lab/) :
//   node tools/planche.mjs planche <dossier f-NN.png> <sortie.png> <cols> <largeur vignette> <images…|a-b|a-b:pas>
//   node tools/planche.mjs mesures <dossier f-NN.png> [sortie.json]
// Le numéro d'image est incrusté SOUS chaque vignette (preuve de QA, jamais dans le film).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

function frames(spec) {
  const out = [];
  for (const s of spec) {
    const m = /^(\d+)-(\d+)(?::(\d+))?$/.exec(s);
    if (m) for (let f = +m[1]; f <= +m[2]; f += +(m[3] || 1)) out.push(f);
    else out.push(+s);
  }
  return out;
}
const pad = (f) => String(f).padStart(2, "0");

async function planche(dir, outFile, cols, tw, list) {
  const th = Math.round((tw * 9) / 16), lab = 26, gap = 6;
  const rows = Math.ceil(list.length / cols);
  const W = cols * tw + (cols + 1) * gap, H = rows * (th + lab) + (rows + 1) * gap;
  const comps = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i], x = gap + (i % cols) * (tw + gap), y = gap + Math.floor(i / cols) * (th + lab + gap);
    const src = path.join(dir, `f-${pad(f)}.png`);
    if (!fs.existsSync(src)) continue;
    comps.push({ input: await sharp(src).resize(tw, th).toBuffer(), left: x, top: y });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${lab}"><text x="${tw / 2}" y="${lab - 7}" font-family="Menlo, monospace" font-size="17" fill="#FAF8F5" text-anchor="middle">${f}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y + th });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: "#16241d" } }).composite(comps).png({ palette: true, quality: 92, effort: 8, dither: 0.6 }).toFile(outFile); // PNG à palette : planche légère pour le dépôt
  console.log("planche", outFile, list.length, "images", W + "x" + H);
}

async function mesures(dir, outJson) {
  const files = fs.readdirSync(dir).filter((f) => /^f-\d+\.png$/.test(f)).sort();
  const res = [];
  for (const file of files) {
    const { data, info } = await sharp(path.join(dir, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    let sum = 0, white = 0, black = 0, forbA = 0, forbB = 0, sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sum += y; sr += r; sg += g; sb += b;
      if (y > 0.9) white++;
      if (r < 6 && g < 6 && b < 6) black++;
      if (Math.abs(r - 0xe4) + Math.abs(g - 0x50) + Math.abs(b - 0x1c) < 24) forbA++;
      if (Math.abs(r - 0x1c) + Math.abs(g - 0x26) + Math.abs(b - 0x20) < 9) forbB++;
    }
    res.push({
      image: +file.slice(2, -4),
      lumMoy: +(sum / n).toFixed(4),
      partBlanc90: +(white / n).toFixed(4),
      noirPur: black,
      procheE4501C: +(forbA / n).toFixed(5),
      proche1C2620: +(forbB / n).toFixed(5),
      rgbMoy: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
    });
  }
  if (outJson) fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
  for (const r of res) console.log(pad(r.image), "lum", r.lumMoy.toFixed(3), "blanc>0,9", (r.partBlanc90 * 100).toFixed(1) + "%", "noirPur", r.noirPur, "E4501C", (r.procheE4501C * 100).toFixed(2) + "%", "1C2620", (r.proche1C2620 * 100).toFixed(2) + "%", "rgb", r.rgbMoy.join(","));
  return res;
}

const [mode, dir, ...rest] = process.argv.slice(2);
if (mode === "planche") await planche(dir, rest[0], +rest[1], +rest[2], frames(rest.slice(3)));
else if (mode === "mesures") await mesures(dir, rest[0]);
else console.error("mode inconnu");
