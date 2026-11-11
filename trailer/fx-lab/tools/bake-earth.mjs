// Cuit les contours des terres (Natural Earth 1:110m, domaine public) autour de l'Europe
// en un fichier JS chargé localement par les scènes (pas de fetch, pas de réseau).
// Usage : node tools/bake-earth.mjs   (depuis trailer/fx-lab/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../public/data/countries-110m.geojson");
const out = path.resolve(here, "../lib/fx/earth-data.js");
const BOX = { lon0: -40, lon1: 80, lat0: -5, lat1: 80 };

const gj = JSON.parse(fs.readFileSync(src, "utf8"));
const rings = [];
const inBox = (r) => r.some(([lo, la]) => lo >= BOX.lon0 && lo <= BOX.lon1 && la >= BOX.lat0 && la <= BOX.lat1);
for (const f of gj.features) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const p of polys) {
    const outer = p[0];
    if (!inBox(outer)) continue;
    rings.push(outer.map(([lo, la]) => [Math.round(lo * 100) / 100, Math.round(la * 100) / 100]));
  }
}

// Grandes agglomérations (lat, lon, poids 1–10) : lumières nocturnes principales.
const CITIES = [
  [48.86, 2.35, 10], [51.51, -0.13, 10], [40.42, -3.7, 8], [41.39, 2.17, 7], [45.46, 9.19, 8], [41.9, 12.5, 7],
  [52.52, 13.4, 8], [48.14, 11.58, 6], [50.11, 8.68, 6], [50.94, 6.96, 7], [51.23, 6.78, 6], [51.45, 7.01, 8],
  [52.37, 4.9, 7], [51.92, 4.48, 6], [50.85, 4.35, 7], [48.21, 16.37, 7], [47.5, 19.04, 7], [50.08, 14.44, 6],
  [52.23, 21.01, 7], [50.06, 19.94, 5], [45.76, 4.84, 6], [43.3, 5.37, 6], [43.6, 1.44, 5], [44.84, -0.58, 5],
  [47.22, -1.55, 4], [45.07, 7.69, 6], [44.49, 11.34, 5], [43.77, 11.25, 5], [40.85, 14.27, 7], [38.12, 13.36, 5],
  [45.44, 12.32, 4], [46.07, 11.12, 3], [46.5, 11.35, 2], [47.27, 11.39, 3], [47.37, 8.54, 5], [46.2, 6.14, 5],
  [46.95, 7.45, 3], [38.72, -9.14, 6], [41.15, -8.61, 5], [37.39, -5.98, 5], [39.47, -0.38, 5], [36.72, -4.42, 4],
  [53.48, -2.24, 7], [52.49, -1.89, 7], [53.8, -1.55, 5], [55.95, -3.19, 4], [55.86, -4.25, 5], [53.35, -6.26, 5],
  [55.68, 12.57, 5], [59.33, 18.07, 5], [59.91, 10.75, 4], [60.17, 24.94, 4], [53.55, 9.99, 7], [53.08, 8.8, 4],
  [52.37, 9.73, 4], [51.34, 12.37, 4], [51.05, 13.74, 4], [44.43, 26.1, 6], [42.7, 23.32, 5], [44.79, 20.45, 5],
  [45.81, 15.98, 4], [46.06, 14.51, 3], [37.98, 23.73, 7], [40.64, 22.94, 4], [41.01, 28.98, 10], [39.93, 32.86, 6],
  [38.42, 27.14, 5], [36.81, 10.18, 5], [36.75, 3.06, 6], [35.7, -0.63, 4], [33.57, -7.59, 7], [34.02, -6.83, 4],
  [34.03, -5.0, 4], [31.63, -8.0, 4], [35.76, -5.83, 3], [32.89, 13.19, 4], [30.04, 31.24, 10], [31.2, 29.92, 7],
  [32.08, 34.78, 6], [33.89, 35.5, 5], [36.2, 37.13, 5], [33.51, 36.28, 4], [50.45, 30.52, 7], [49.84, 24.03, 4],
  [46.48, 30.72, 4], [47.0, 28.86, 3], [55.76, 37.62, 10], [59.94, 30.31, 7], [53.9, 27.56, 5], [54.69, 25.28, 3],
  [56.95, 24.11, 3], [59.44, 24.75, 3], [35.9, 14.51, 2], [39.22, 9.12, 3], [35.34, 25.13, 2], [34.68, 33.04, 3],
];

const js =
  "/* Généré par tools/bake-earth.mjs — ne pas éditer à la main.\n" +
  " * Contours : Natural Earth 1:110m admin-0 (domaine public), copie locale public/data/countries-110m.geojson.\n" +
  " * Villes : coordonnées géographiques publiques, poids d'éclairage choisis à la main. */\n" +
  "(function(r){var FX=(r.LKDVFX=r.LKDVFX||{});FX.EARTH_DATA=" +
  JSON.stringify({ box: BOX, rings, cities: CITIES }) +
  ";})(typeof window!=='undefined'?window:globalThis);\n";
fs.writeFileSync(out, js);
console.log("anneaux", rings.length, "points", rings.reduce((s, r) => s + r.length, 0), "villes", CITIES.length, "octets", js.length);
