/**
 * Lecture de fichiers de trace : GPX, KML, TCX, GeoJSON et FIT (binaire, `fit.ts`, reçu en `ArrayBuffer`).
 * Analyseur XML léger interne (sans DOM) : même résultat dans le navigateur, sur le serveur et en test ;
 * les entités personnalisées d'un DOCTYPE ne sont jamais développées.
 */

import { decodeFit } from './fit';

export type TrackFormat = 'gpx' | 'kml' | 'tcx' | 'geojson' | 'fit';

export interface TrackPoint {
  readonly lat: number;
  readonly lon: number;
  readonly ele?: number;
  readonly time?: string;
}

export interface TrackWaypoint {
  readonly lat: number;
  readonly lon: number;
  readonly name: string | null;
  readonly ele?: number;
}

export interface ParsedTrack {
  readonly ok: true;
  readonly format: TrackFormat;
  readonly name: string | null;
  readonly points: readonly TrackPoint[];
  readonly waypoints: readonly TrackWaypoint[];
  /** Points écartés (coordonnées non numériques ou hors bornes). */
  readonly skippedPoints: number;
}

export type TrackParseErrorCode = 'unsupported_format' | 'empty_file' | 'unrecognized_format' | 'invalid_content' | 'no_points';

export interface TrackParseError {
  readonly ok: false;
  readonly error: { readonly code: TrackParseErrorCode; readonly message: string };
}

export type TrackParseResult = ParsedTrack | TrackParseError;

const fail = (code: TrackParseErrorCode, message: string): TrackParseError => ({ ok: false, error: { code, message } });

/* ---------- XML minimal ---------- */

interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const localName = (n: string) => (n.includes(':') ? n.slice(n.indexOf(':') + 1) : n);
const MAX_NODES = 2_000_000;

function parseXml(source: string): XNode | null {
  const root: XNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XNode[] = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  let nodes = 0;
  while ((m = re.exec(source)) !== null) {
    if (m[1] !== undefined) stack[stack.length - 1].text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length < 2 || localName(stack[stack.length - 1].name) !== localName(m[2])) return null;
      stack.pop();
    } else if (m[3] !== undefined) {
      if (++nodes > MAX_NODES) return null;
      const attrs: Record<string, string> = {};
      const ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(m[4])) !== null) attrs[localName(a[1])] = decode(a[2] ?? a[3] ?? '');
      const node: XNode = { name: localName(m[3]), attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (m[5] !== '/') stack.push(node);
    } else if (m[6] !== undefined) stack[stack.length - 1].text += m[6];
  }
  if (stack.length !== 1) return null;
  return root.children[0] ?? null;
}

const kids = (n: XNode, name: string) => n.children.filter((c) => c.name === name);
const kid = (n: XNode, name: string) => n.children.find((c) => c.name === name);
const txt = (n: XNode | undefined): string | null => {
  if (!n) return null;
  const t = decode(n.text).trim();
  return t === '' ? null : t;
};
function walk(n: XNode, name: string, out: XNode[] = []): XNode[] {
  for (const c of n.children) {
    if (c.name === name) out.push(c);
    walk(c, name, out);
  }
  return out;
}

/* ---------- Points ---------- */

interface Collector {
  points: TrackPoint[];
  waypoints: TrackWaypoint[];
  skipped: number;
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function validLatLon(lat: number | null, lon: number | null): lat is number {
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function pushPoint(c: Collector, lat: number | null, lon: number | null, ele?: number | null, time?: string | null): void {
  if (!validLatLon(lat, lon)) {
    c.skipped += 1;
    return;
  }
  c.points.push({ lat, lon: lon as number, ...(ele != null ? { ele } : {}), ...(time ? { time } : {}) });
}

function pushWaypoint(c: Collector, lat: number | null, lon: number | null, name: string | null, ele?: number | null): void {
  if (!validLatLon(lat, lon)) {
    c.skipped += 1;
    return;
  }
  c.waypoints.push({ lat, lon: lon as number, name, ...(ele != null ? { ele } : {}) });
}

function done(format: TrackFormat, name: string | null, c: Collector): TrackParseResult {
  if (c.points.length === 0) return fail('no_points', 'Aucun point de trace exploitable dans ce fichier.');
  return { ok: true, format, name, points: c.points, waypoints: c.waypoints, skippedPoints: c.skipped };
}

function fromGpx(root: XNode): TrackParseResult {
  const c: Collector = { points: [], waypoints: [], skipped: 0 };
  const trks = kids(root, 'trk');
  for (const trk of trks) {
    for (const seg of kids(trk, 'trkseg')) {
      for (const pt of kids(seg, 'trkpt')) pushPoint(c, num(pt.attrs.lat), num(pt.attrs.lon), num(txt(kid(pt, 'ele'))), txt(kid(pt, 'time')));
    }
  }
  if (c.points.length === 0) {
    for (const rte of kids(root, 'rte')) {
      for (const pt of kids(rte, 'rtept')) pushPoint(c, num(pt.attrs.lat), num(pt.attrs.lon), num(txt(kid(pt, 'ele'))), txt(kid(pt, 'time')));
    }
  }
  for (const w of kids(root, 'wpt')) pushWaypoint(c, num(w.attrs.lat), num(w.attrs.lon), txt(kid(w, 'name')), num(txt(kid(w, 'ele'))));
  const name = txt(kid(kid(root, 'metadata') ?? root, 'name')) ?? txt(kid(trks[0] ?? root, 'name')) ?? txt(kid(kids(root, 'rte')[0] ?? root, 'name'));
  return done('gpx', name, c);
}

function parseCoordString(c: Collector, s: string): void {
  for (const tuple of s.trim().split(/\s+/)) {
    if (!tuple) continue;
    const [lon, lat, ele] = tuple.split(',');
    pushPoint(c, num(lat), num(lon), num(ele));
  }
}

function fromKml(root: XNode): TrackParseResult {
  const c: Collector = { points: [], waypoints: [], skipped: 0 };
  const placemarks = walk(root, 'Placemark');
  for (const pm of placemarks) {
    const lines = walk(pm, 'LineString');
    const tracks = walk(pm, 'Track');
    for (const ls of lines) {
      const t = txt(kid(ls, 'coordinates'));
      if (t) parseCoordString(c, t);
    }
    for (const tr of tracks) {
      const whens = kids(tr, 'when').map((w) => txt(w));
      kids(tr, 'coord').forEach((co, i) => {
        const [lon, lat, ele] = (txt(co) ?? '').split(/\s+/);
        pushPoint(c, num(lat), num(lon), num(ele), whens[i] ?? null);
      });
    }
    if (lines.length === 0 && tracks.length === 0) {
      for (const pt of walk(pm, 'Point')) {
        const [lon, lat, ele] = (txt(kid(pt, 'coordinates')) ?? '').split(',');
        pushWaypoint(c, num(lat), num(lon), txt(kid(pm, 'name')), num(ele));
      }
    }
  }
  const doc = walk(root, 'Document')[0] ?? root;
  const name = txt(kid(doc, 'name')) ?? (placemarks[0] ? txt(kid(placemarks[0], 'name')) : null);
  return done('kml', name, c);
}

function fromTcx(root: XNode): TrackParseResult {
  const c: Collector = { points: [], waypoints: [], skipped: 0 };
  for (const tp of walk(root, 'Trackpoint')) {
    const pos = kid(tp, 'Position');
    if (!pos) continue;
    pushPoint(c, num(txt(kid(pos, 'LatitudeDegrees'))), num(txt(kid(pos, 'LongitudeDegrees'))), num(txt(kid(tp, 'AltitudeMeters'))), txt(kid(tp, 'Time')));
  }
  for (const cp of walk(root, 'CoursePoint')) {
    const pos = kid(cp, 'Position');
    if (pos) pushWaypoint(c, num(txt(kid(pos, 'LatitudeDegrees'))), num(txt(kid(pos, 'LongitudeDegrees'))), txt(kid(cp, 'Name')), num(txt(kid(cp, 'AltitudeMeters'))));
  }
  const name = txt(kid(walk(root, 'Course')[0] ?? root, 'Name')) ?? txt(kid(walk(root, 'Activity')[0] ?? root, 'Id'));
  return done('tcx', name, c);
}

type Json = { [k: string]: unknown };
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function fromGeoJson(data: unknown): TrackParseResult {
  const c: Collector = { points: [], waypoints: [], skipped: 0 };
  let name: string | null = null;
  const pos = (p: unknown, kind: 'line' | 'wpt', label: string | null) => {
    if (!Array.isArray(p) || p.length < 2) {
      c.skipped += 1;
      return;
    }
    const lon = num(p[0] as number);
    const lat = num(p[1] as number);
    const ele = p.length > 2 ? num(p[2] as number) : null;
    if (kind === 'line') pushPoint(c, lat, lon, ele);
    else pushWaypoint(c, lat, lon, label, ele);
  };
  const geom = (g: unknown, label: string | null) => {
    if (!isObj(g)) return;
    const co = g.coordinates;
    switch (g.type) {
      case 'LineString': if (Array.isArray(co)) co.forEach((p) => pos(p, 'line', null)); break;
      case 'MultiLineString': if (Array.isArray(co)) co.forEach((l) => Array.isArray(l) && l.forEach((p) => pos(p, 'line', null))); break;
      case 'Point': pos(co, 'wpt', label); break;
      case 'MultiPoint': if (Array.isArray(co)) co.forEach((p) => pos(p, 'wpt', label)); break;
      case 'GeometryCollection': if (Array.isArray(g.geometries)) g.geometries.forEach((x) => geom(x, label)); break;
      default: break;
    }
  };
  const feature = (f: unknown) => {
    if (!isObj(f)) return;
    const props = isObj(f.properties) ? f.properties : {};
    const label = typeof props.name === 'string' && props.name.trim() ? props.name.trim() : null;
    if (f.type === 'Feature') {
      const g = f.geometry;
      const isLine = isObj(g) && (g.type === 'LineString' || g.type === 'MultiLineString');
      if (isLine && name === null) name = label;
      geom(g, label);
    } else geom(f, null);
  };
  if (isObj(data) && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    data.features.forEach(feature);
    if (name === null && typeof data.name === 'string') name = data.name;
  } else feature(data);
  return done('geojson', name, c);
}

/* ---------- Entrée publique ---------- */

export type TrackFileContent = string | ArrayBuffer | ArrayBufferView;

/** Un fichier FIT se lit en binaire : `.fit` ou signature « .FIT » aux octets 8 à 11 de l'en-tête. */
export function isFitFileName(name: string): boolean {
  return /\.fit$/i.test(name || '');
}

function hasFitSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54;
}

function fromFit(bytes: Uint8Array): TrackParseResult {
  const r = decodeFit(bytes);
  if (!r.ok) return fail(r.code, r.message);
  return {
    ok: true,
    format: 'fit',
    name: null,
    points: r.points,
    waypoints: [],
    skippedPoints: r.skippedPoints,
  };
}

export function parseTrackFile(content: TrackFileContent, filename: string): TrackParseResult {
  const lower = (filename || '').toLowerCase();
  if (typeof content !== 'string') {
    const bytes =
      content instanceof ArrayBuffer
        ? new Uint8Array(content)
        : new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    if (lower.endsWith('.fit') || hasFitSignature(bytes)) return fromFit(bytes);
    return parseTrackFile(new TextDecoder('utf-8').decode(bytes), filename);
  }
  const text = content;
  const head = text.slice(0, 16);
  if (lower.endsWith('.fit') || head.slice(8, 12) === '.FIT') {
    return fail('unsupported_format', 'Un fichier FIT est binaire : il doit être lu en binaire (ArrayBuffer), pas en texte.');
  }
  const body = text.replace(/^﻿/, '').trim();
  if (body === '') return fail('empty_file', 'Le fichier est vide.');
  if (body[0] === '{' || body[0] === '[') {
    try {
      return fromGeoJson(JSON.parse(body));
    } catch {
      return fail('invalid_content', 'Le fichier GeoJSON est illisible (JSON invalide).');
    }
  }
  if (body[0] === '<') {
    const root = parseXml(body);
    if (!root) return fail('invalid_content', 'Le fichier XML est mal formé.');
    const n = root.name.toLowerCase();
    if (n === 'gpx') return fromGpx(root);
    if (n === 'kml') return fromKml(root);
    if (n === 'trainingcenterdatabase') return fromTcx(root);
    return fail('unrecognized_format', 'Format XML non reconnu : attendu GPX, KML ou TCX.');
  }
  return fail('unrecognized_format', 'Format de fichier non reconnu : attendu GPX, KML, TCX ou GeoJSON.');
}

/* ---------- Validation GPX 1.1 ---------- */

export interface Gpx11Issue {
  readonly code: string;
  readonly message: string;
}

export interface Gpx11Validation {
  readonly valid: boolean;
  readonly errors: readonly Gpx11Issue[];
}

const GPX11_NS = 'http://www.topografix.com/GPX/1/1';

/** Contrôles structurels (pas une validation XSD complète). */
export function validateGpx11(xml: string): Gpx11Validation {
  const errors: Gpx11Issue[] = [];
  const add = (code: string, message: string) => errors.push({ code, message });
  const root = parseXml((xml ?? '').replace(/^﻿/, '').trim());
  if (!root) return { valid: false, errors: [{ code: 'xml_malformed', message: 'XML mal formé ou vide.' }] };
  if (root.name !== 'gpx') {
    return { valid: false, errors: [{ code: 'root_not_gpx', message: `La racine doit être <gpx> (trouvé <${root.name}>).` }] };
  }
  if (root.attrs.version !== '1.1') add('version', `Attribut version="1.1" requis (trouvé ${root.attrs.version ? `"${root.attrs.version}"` : 'aucun'}).`);
  if (root.attrs.xmlns !== GPX11_NS) add('namespace', `Espace de noms ${GPX11_NS} requis sur <gpx>.`);
  if (!root.attrs.creator) add('creator', 'Attribut creator requis sur <gpx>.');
  const trks = kids(root, 'trk');
  if (trks.length === 0) add('no_trk', 'Aucun <trk> dans le fichier.');
  const segs = trks.flatMap((t) => kids(t, 'trkseg'));
  if (trks.length > 0 && segs.length === 0) add('no_trkseg', 'Aucun <trkseg> dans <trk>.');
  const pts = segs.flatMap((s) => kids(s, 'trkpt'));
  if (segs.length > 0 && pts.length === 0) add('no_trkpt', 'Aucun <trkpt> dans <trkseg>.');
  const bad = (n: XNode): string | null => {
    const lat = num(n.attrs.lat);
    const lon = num(n.attrs.lon);
    if (lat === null || lon === null) return 'lat/lon absents ou non numériques';
    if (lat < -90 || lat > 90) return `lat hors bornes (${lat})`;
    if (lon < -180 || lon > 180) return `lon hors bornes (${lon})`;
    return null;
  };
  let reported = 0;
  const check = (nodes: XNode[], tag: string) =>
    nodes.forEach((n, i) => {
      const problem = bad(n);
      if (problem && reported < 10) {
        reported += 1;
        add('coordinates', `<${tag}> n°${i + 1} : ${problem}.`);
      }
    });
  check(pts, 'trkpt');
  check(kids(root, 'wpt'), 'wpt');
  return { valid: errors.length === 0, errors };
}
