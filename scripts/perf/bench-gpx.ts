#!/usr/bin/env node
/**
 * Banc GPX (hors zones gelées HUB/Compas) : compare l'ancien parseur/exporteur
 * (copie verbatim de `GPXEngine` avant optimisation, commit 3cb7d51e) au moteur
 * actuel : export sur 1 000 / 5 000 / 20 000 points, parsing sur 1 000 / 5 000.
 *
 * Usage : npm run perf:gpx -- [--runs=10] [--json] [--out=fichier.json]
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('');
(globalThis as unknown as { DOMParser: typeof DOMParser }).DOMParser =
  dom.window.DOMParser as unknown as typeof DOMParser;

const { GPXEngine } = await import('../../src/features/hiking/gpx/GPXEngine');

const args = process.argv.slice(2);
const runsArg = args.find((arg) => arg.startsWith('--runs='));
const runs = Math.max(3, Number(runsArg?.split('=')[1] ?? 5));
const asJson = args.includes('--json');
const outArg = args.find((arg) => arg.startsWith('--out='));

/* ── Ancien parseur, copie verbatim (archive de comparaison) ───────────────── */

interface LegacyPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
}

function legacyParse(gpxXmlStr: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxXmlStr, 'application/xml');
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) throw new Error('Format GPX invalide ou fichier XML corrompu.');
  const nameEl = xmlDoc.querySelector('gpx > name, trk > name, metadata > name');
  const title = nameEl?.textContent?.trim() || 'Tracé GPX Importé';
  const trkptNodes = xmlDoc.querySelectorAll('trkpt');
  const positions: LegacyPosition[] = [];
  trkptNodes.forEach((node, index) => {
    const lat = parseFloat(node.getAttribute('lat') || '0');
    const lon = parseFloat(node.getAttribute('lon') || '0');
    const eleNode = node.querySelector('ele');
    const timeNode = node.querySelector('time');
    const altitude = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;
    const timestamp = timeNode ? new Date(timeNode.textContent || Date.now()).getTime() : Date.now() + index * 1000;
    if (!isNaN(lat) && !isNaN(lon)) {
      positions.push({
        latitude: lat,
        longitude: lon,
        altitude: altitude != null && !isNaN(altitude) ? altitude : undefined,
        timestamp,
      });
    }
  });
  return { title, positions };
}

function legacyExport(positions: LegacyPosition[], title: string): string {
  const timeNow = new Date().toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<gpx version="1.1" creator="Le Kit du Voyageur - https://kitduvoyageur.app"\n`;
  xml += `     xmlns="http://www.topografix.com/GPX/1/1"\n`;
  xml += `     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;
  xml += `  <metadata>\n    <name>${title}</name>\n    <time>${timeNow}</time>\n  </metadata>\n`;
  xml += `  <trk>\n    <name>${title}</name>\n    <trkseg>\n`;
  positions.forEach((pos) => {
    xml += `      <trkpt lat="${pos.latitude}" lon="${pos.longitude}">\n`;
    if (pos.altitude != null) xml += `        <ele>${pos.altitude.toFixed(1)}</ele>\n`;
    xml += `        <time>${new Date(pos.timestamp).toISOString()}</time>\n`;
    xml += `      </trkpt>\n`;
  });
  xml += `    </trkseg>\n  </trk>\n</gpx>`;
  return xml;
}

/** Ancien extracteur de l'aperçu pièce jointe (copie verbatim, AttachmentDrawer). */
function legacyRegexExtract(xml: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const re = /<(?:trkpt|rtept|wpt)\b[^>]*\blat="(-?\d+(?:\.\d+)?)"[^>]*\blon="(-?\d+(?:\.\d+)?)"/g;
  let match = re.exec(xml);
  while (match) {
    const lat = Number.parseFloat(match[1]);
    const lon = Number.parseFloat(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lon, lat]);
    match = re.exec(xml);
  }
  return points;
}

/* ── Outils de mesure ─────────────────────────────────────────────────────── */

function makeGpx(points: number): string {
  const body = Array.from(
    { length: points },
    (_, index) =>
      `<trkpt lat="${45 + index * 1e-5}" lon="${6 + index * 1e-5}"><ele>${1000 + (index % 800)}</ele><time>2026-08-09T08:00:00Z</time></trkpt>`,
  ).join('');
  return `<?xml version="1.0"?><gpx version="1.1"><metadata><name>Banc GPX</name></metadata><trk><trkseg>${body}</trkseg></trk></gpx>`;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * values.length) - 1));
  return sorted[index];
}

function stats(values: number[]) {
  return {
    p50: Number(percentile(values, 0.5).toFixed(2)),
    p95: Number(percentile(values, 0.95).toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
  };
}

/** Mesure appariée : alterne ancien/nouveau pour annuler la dérive de charge. */
function paired(legacy: () => unknown, optimized: () => unknown, runsCount: number) {
  for (let warmup = 0; warmup < 2; warmup += 1) { legacy(); optimized(); }
  const legacyTimes: number[] = [];
  const optimizedTimes: number[] = [];
  for (let run = 0; run < runsCount; run += 1) {
    let start = performance.now();
    legacy();
    legacyTimes.push(performance.now() - start);
    start = performance.now();
    optimized();
    optimizedTimes.push(performance.now() - start);
  }
  return {
    before: stats(legacyTimes),
    after: stats(optimizedTimes),
    medianRatio: Number((percentile(legacyTimes, 0.5) / Math.max(percentile(optimizedTimes, 0.5), 0.001)).toFixed(2)),
  };
}

const EXPORT_SIZES = [1_000, 5_000, 20_000];
const PARSE_SIZES = [1_000, 5_000];

const exportResults = EXPORT_SIZES.map((points) => {
  const gpx = makeGpx(points);
  const positions = GPXEngine.parseGPX(gpx).positions;
  const legacyPositions = legacyParse(gpx).positions;
  return {
    points,
    gpxBytes: Buffer.byteLength(gpx, 'utf8'),
    export: paired(
      () => legacyExport(legacyPositions, 'Banc GPX'),
      () => GPXEngine.exportGPX(positions, [], 'Banc GPX'),
      runs,
    ),
    extract: paired(
      () => legacyRegexExtract(gpx),
      () => GPXEngine.extractCoordinates(gpx),
      Math.max(3, Math.min(runs, 5)),
    ),
  };
});

const parseResults = PARSE_SIZES.map((points) => {
  const gpx = makeGpx(points);
  const legacy = legacyParse(gpx).positions;
  const current = GPXEngine.parseGPX(gpx).positions;
  const parity =
    legacy.length === current.length &&
    legacy[0].latitude === current[0].latitude &&
    legacy[legacy.length - 1].longitude === current[current.length - 1].longitude;
  if (!parity) throw new Error(`parité rompue sur ${points} points`);
  return {
    points,
    gpxBytes: Buffer.byteLength(gpx, 'utf8'),
    parity,
    parse: paired(() => legacyParse(gpx), () => GPXEngine.parseGPX(gpx), Math.max(3, Math.min(runs, 5))),
  };
});

const results = { export: exportResults, parse: parseResults };
const payload = { generatedAt: new Date().toISOString(), runs, results };

for (const r of results.export) {
  console.log(
    `export ${String(r.points).padStart(6)} pts (${r.gpxBytes} o) : avant p50 ${r.export.before.p50} ms → après ${r.export.after.p50} ms ` +
      `(x${r.export.medianRatio}) · extract : ${r.extract.before.p50} ms → ${r.extract.after.p50} ms (x${r.extract.medianRatio})`,
  );
}
for (const r of results.parse) {
  console.log(
    `parse  ${String(r.points).padStart(6)} pts : avant p50 ${r.parse.before.p50} ms → après ${r.parse.after.p50} ms ` +
      `(x${r.parse.medianRatio}, parité ${r.parity ? 'OK' : 'ROMPUE'})`,
  );
}
console.log('\nMesures appariées (chaque passe mesure l ancien puis le nouveau) : le ratio est robuste à la charge, les ms absolues ne le sont pas.');

if (asJson) console.log(JSON.stringify(payload, null, 2));

if (outArg) {
  const path = outArg.split('=')[1];
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Résultats écrits dans ${path}`);
}
