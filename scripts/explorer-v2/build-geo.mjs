#!/usr/bin/env node
/**
 * Explorer v2 — génération des fonds géographiques (05_DONNEES.md §2).
 *
 * Sources (domaine public / ODbL, attribution obligatoire) :
 *   - Natural Earth 1:50m admin-0 pays  → public/data/explorer-v2/countries.geojson
 *   - Natural Earth 1:10m admin-1       → public/data/explorer-v2/regions/<ISO2>.geojson
 *
 * Le script télécharge une fois dans `.cache/`, simplifie (Douglas-Peucker),
 * arrondit les coordonnées et écrit des fichiers servis en statique.
 *
 * Usage : node scripts/explorer-v2/build-geo.mjs [--force]
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const ROOT = process.cwd();
const CACHE = join(ROOT, '.cache/explorer-v2');
const OUT = join(ROOT, 'public/data/explorer-v2');
const REGIONS_OUT = join(OUT, 'regions');

const SOURCES = {
  countries: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
    file: 'ne_50m_admin_0_countries.geojson',
    tolerance: 0.02,
  },
  regions: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
    file: 'ne_10m_admin_1_states_provinces.geojson',
    tolerance: 0.01,
  },
};

const force = process.argv.includes('--force');

async function ensure(file, url) {
  const dest = join(CACHE, file);
  if (existsSync(dest) && !force) return dest;
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement ${url} : HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  return dest;
}

/** Distance perpendiculaire d'un point au segment [a,b] (degrés). */
function segmentDistance(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

/** Douglas-Peucker itératif (pas de récursion profonde sur les longues côtes). */
function simplifyLine(points, tolerance) {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const dist = segmentDistance(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  return out;
}

function round(points) {
  return points.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
}

function simplifyGeometry(geometry, tolerance) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates
      .map((ring) => round(simplifyLine(ring, tolerance)))
      .filter((ring) => ring.length >= 4);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates
      .map((poly) =>
        poly
          .map((ring) => round(simplifyLine(ring, tolerance)))
          .filter((ring) => ring.length >= 4),
      )
      .filter((poly) => poly.length > 0);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  return null;
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data), 'utf8');
  return JSON.stringify(data).length;
}

async function buildCountries() {
  const src = join(CACHE, SOURCES.countries.file);
  const raw = JSON.parse(readFileSync(src, 'utf8'));
  const features = [];
  for (const feature of raw.features) {
    const p = feature.properties || {};
    const iso = (p.ISO_A2_EH || p.ISO_A2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso)) continue;
    const geometry = simplifyGeometry(feature.geometry, SOURCES.countries.tolerance);
    if (!geometry) continue;
    features.push({
      type: 'Feature',
      properties: {
        iso_a2: iso,
        name: p.NAME_FR || p.NAME || p.ADMIN,
        name_en: p.NAME_EN || p.NAME,
        continent: p.CONTINENT || null,
      },
      geometry,
    });
  }
  const bytes = writeJson(join(OUT, 'countries.geojson'), {
    type: 'FeatureCollection',
    attribution: 'Natural Earth 1:50m (domaine public)',
    features,
  });
  return { features: features.length, bytes };
}

async function buildRegions() {
  const src = join(CACHE, SOURCES.regions.file);
  const raw = JSON.parse(readFileSync(src, 'utf8'));
  const perCountry = new Map();
  for (const feature of raw.features) {
    const p = feature.properties || {};
    const iso = (p.iso_a2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso)) continue;
    const geometry = simplifyGeometry(feature.geometry, SOURCES.regions.tolerance);
    if (!geometry) continue;
    if (!perCountry.has(iso)) perCountry.set(iso, []);
    // `group` = unité de niveau 1 affichée (région française, préfecture, État).
    const group = p.region && p.region !== 'NA' ? p.region : p.name;
    perCountry.get(iso).push({
      type: 'Feature',
      properties: {
        name: p.name,
        name_local: p.name_local || null,
        group,
        iso_a2: iso,
        code: p.iso_3166_2 || p.adm1_code || null,
        type_en: p.type_en || null,
      },
      geometry,
    });
  }

  mkdirSync(REGIONS_OUT, { recursive: true });
  const index = {};
  let total = 0;
  for (const [iso, features] of perCountry) {
    const bytes = writeJson(join(REGIONS_OUT, `${iso}.geojson`), {
      type: 'FeatureCollection',
      attribution: 'Natural Earth 1:10m admin-1 (domaine public)',
      features,
    });
    const groups = new Set(features.map((f) => f.properties.group));
    index[iso] = { units: features.length, groups: groups.size, bytes };
    total += bytes;
  }
  writeJson(join(OUT, 'regions-index.json'), index);
  return { countries: perCountry.size, bytes: total, index };
}

await ensure(SOURCES.countries.file, SOURCES.countries.url);
await ensure(SOURCES.regions.file, SOURCES.regions.url);

const countries = await buildCountries();
const regions = await buildRegions();

console.log(`pays : ${countries.features} entités, ${(countries.bytes / 1024).toFixed(0)} Ko`);
console.log(
  `régions : ${regions.countries} pays, ${(regions.bytes / 1024 / 1024).toFixed(2)} Mo, FR=${JSON.stringify(regions.index.FR)}`,
);
