/**
 * Pure, dependency-free, browser-safe GPX 1.1 builder, parser, and downloader
 * for Explorer v2 routes, tracks, and waypoints.
 */

export interface GpxTrackPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  time?: string | null;
}

export interface GpxWaypoint {
  name: string;
  lat: number;
  lng: number;
  desc?: string | null;
  ele?: number | null;
}

export type GpxTrackPointInput =
  | GpxTrackPoint
  | readonly [number, number]
  | readonly [number, number, number];

export interface BuildGpxXmlOptions {
  name: string;
  description?: string | null;
  trackPoints?: ReadonlyArray<GpxTrackPointInput>;
  waypoints?: ReadonlyArray<GpxWaypoint>;
}

export interface ParsedGpxWaypoint {
  name: string;
  lat: number;
  lng: number;
}

export interface ParsedGpxResult {
  name: string;
  /** GeoJSON `[lng, lat]` coordinate pairs ready for MapLibre / Explorer layers. */
  coordinates: [number, number][];
  waypoints: ParsedGpxWaypoint[];
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function normalizeTrackPoint(pt: GpxTrackPointInput): GpxTrackPoint | null {
  if (Array.isArray(pt)) {
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!isValidLatLng(lat, lng)) return null;
    const rawEle = pt.length >= 3 ? Number(pt[2]) : null;
    return {
      lat,
      lng,
      ele: rawEle !== null && Number.isFinite(rawEle) ? rawEle : null,
      time: null,
    };
  }
  const obj = pt as GpxTrackPoint;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  if (!isValidLatLng(lat, lng)) return null;
  const ele =
    typeof obj.ele === 'number' && Number.isFinite(obj.ele) ? obj.ele : null;
  const time =
    typeof obj.time === 'string' && obj.time.trim().length > 0
      ? obj.time.trim()
      : null;
  return { lat, lng, ele, time };
}

function formatCoord(value: number): string {
  return Number(value.toFixed(6)).toString();
}

/**
 * Generates a valid, XML-escaped GPX 1.1 document string containing
 * optional `<wpt>` waypoints and `<trk><trkseg><trkpt>` track segments.
 */
export function buildGpxXml({
  name,
  description = null,
  trackPoints = [],
  waypoints = [],
}: BuildGpxXmlOptions): string {
  const safeName = (name || 'Itinéraire Explorer').trim() || 'Itinéraire Explorer';
  const safeDesc = typeof description === 'string' && description.trim() ? description.trim() : null;
  const createdIso = new Date().toISOString();

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(safeName)}</name>`,
  ];

  if (safeDesc) {
    lines.push(`    <desc>${escapeXml(safeDesc)}</desc>`);
  }
  lines.push(`    <time>${escapeXml(createdIso)}</time>`);
  lines.push('  </metadata>');

  for (const wpt of waypoints) {
    const lat = Number(wpt.lat);
    const lng = Number(wpt.lng);
    if (!isValidLatLng(lat, lng)) continue;

    lines.push(`  <wpt lat="${formatCoord(lat)}" lon="${formatCoord(lng)}">`);
    if (typeof wpt.ele === 'number' && Number.isFinite(wpt.ele)) {
      lines.push(`    <ele>${Number(wpt.ele.toFixed(1))}</ele>`);
    }
    const wptName = (wpt.name || 'Point de passage').trim() || 'Point de passage';
    lines.push(`    <name>${escapeXml(wptName)}</name>`);
    if (typeof wpt.desc === 'string' && wpt.desc.trim()) {
      lines.push(`    <desc>${escapeXml(wpt.desc.trim())}</desc>`);
    }
    lines.push('  </wpt>');
  }

  const normalizedPoints: GpxTrackPoint[] = [];
  for (const rawPt of trackPoints) {
    const pt = normalizeTrackPoint(rawPt);
    if (pt) normalizedPoints.push(pt);
  }

  if (normalizedPoints.length > 0) {
    lines.push('  <trk>');
    lines.push(`    <name>${escapeXml(safeName)}</name>`);
    if (safeDesc) {
      lines.push(`    <desc>${escapeXml(safeDesc)}</desc>`);
    }
    lines.push('    <trkseg>');
    for (const pt of normalizedPoints) {
      const hasChildren = pt.ele !== null && pt.ele !== undefined || Boolean(pt.time);
      if (!hasChildren) {
        lines.push(`      <trkpt lat="${formatCoord(pt.lat)}" lon="${formatCoord(pt.lng)}" />`);
      } else {
        lines.push(`      <trkpt lat="${formatCoord(pt.lat)}" lon="${formatCoord(pt.lng)}">`);
        if (pt.ele !== null && pt.ele !== undefined && Number.isFinite(pt.ele)) {
          lines.push(`        <ele>${Number(pt.ele.toFixed(1))}</ele>`);
        }
        if (pt.time) {
          lines.push(`        <time>${escapeXml(pt.time)}</time>`);
        }
        lines.push('      </trkpt>');
      }
    }
    lines.push('    </trkseg>');
    lines.push('  </trk>');
  }

  lines.push('</gpx>');
  return lines.join('\n');
}

function sanitizeGpxFilename(filename: string): string {
  const cleaned = filename
    .trim()
    .replace(/\.gpx$/i, '')
    .replace(/[^a-zA-Z0-9À-ÿ._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = cleaned.slice(0, 80) || 'itineraire-lkdv';
  return `${base}.gpx`;
}

/**
 * Triggers a safe browser download for a GPX 1.1 XML string and revokes the Blob URL.
 * Returns `true` when the download trigger was dispatched in a browser environment.
 */
export function downloadGpxFile(filename: string, xmlString: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const safeName = sanitizeGpxFilename(filename);
  const blob = new Blob([xmlString], { type: 'application/gpx+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = safeName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}

function parseAttributesFromTag(attrText: string): { lat: number; lng: number } | null {
  const latMatch = /\blat\s*=\s*["']([^"']+)["']/i.exec(attrText);
  const lonMatch = /\blon\s*=\s*["']([^"']+)["']/i.exec(attrText);
  if (!latMatch || !lonMatch) return null;
  const lat = Number(latMatch[1]);
  const lng = Number(lonMatch[1]);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

function parseGpxWithRegex(xmlText: string): ParsedGpxResult {
  const trkNameMatch = /<(?:trk|rte|metadata)\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(xmlText);
  const anyNameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(xmlText);
  const rawName = trkNameMatch?.[1] ?? anyNameMatch?.[1] ?? '';
  const name = unescapeXml(rawName.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim() || 'Trace GPX';

  const extractCoordsForTag = (tag: 'trkpt' | 'rtept'): [number, number][] => {
    const out: [number, number][] = [];
    const re = new RegExp(`<${tag}\\b([^>]*)/?>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(xmlText)) !== null) {
      const parsed = parseAttributesFromTag(match[1] ?? '');
      if (parsed) {
        out.push([parsed.lng, parsed.lat]);
      }
    }
    return out;
  };

  let coordinates = extractCoordsForTag('trkpt');
  if (coordinates.length === 0) {
    coordinates = extractCoordsForTag('rtept');
  }

  const waypoints: ParsedGpxWaypoint[] = [];
  const wptRe = /<wpt\b([^>]*)(?:\/>|>([\s\S]*?)<\/wpt>)/gi;
  let wptMatch: RegExpExecArray | null;
  let wptIdx = 1;
  while ((wptMatch = wptRe.exec(xmlText)) !== null) {
    const parsed = parseAttributesFromTag(wptMatch[1] ?? '');
    if (!parsed) continue;
    const body = wptMatch[2] ?? '';
    const wptNameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(body);
    const wptName =
      unescapeXml((wptNameMatch?.[1] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim() ||
      `Point ${wptIdx}`;
    waypoints.push({ name: wptName, lat: parsed.lat, lng: parsed.lng });
    wptIdx += 1;
  }

  return { name, coordinates, waypoints };
}

/**
 * Parses a GPX 1.1 XML string into validated GeoJSON `[lng, lat]` track coordinates
 * (`<trkpt>` with fallback to `<rtept>`) and `<wpt>` waypoints.
 */
export function parseGpxXml(xmlText: string): ParsedGpxResult {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return { name: 'Trace GPX', coordinates: [], waypoints: [] };
  }

  if (typeof DOMParser === 'undefined') {
    return parseGpxWithRegex(xmlText);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return parseGpxWithRegex(xmlText);
    }

    const findFirstDirectName = (parentTag: string): string | null => {
      const parents = doc.getElementsByTagName(parentTag);
      for (let i = 0; i < parents.length; i += 1) {
        const parent = parents[i];
        const children = parent.childNodes;
        for (let j = 0; j < children.length; j += 1) {
          const child = children[j];
          if (child.nodeType === 1 && child.nodeName.toLowerCase() === 'name') {
            const text = (child.textContent ?? '').trim();
            if (text) return text;
          }
        }
      }
      return null;
    };

    const name =
      findFirstDirectName('trk') ??
      findFirstDirectName('rte') ??
      findFirstDirectName('metadata') ??
      (doc.getElementsByTagName('name')[0]?.textContent?.trim() || 'Trace GPX');

    const extractNodes = (tagName: 'trkpt' | 'rtept'): [number, number][] => {
      const nodes = doc.getElementsByTagName(tagName);
      const out: [number, number][] = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const lat = Number(node.getAttribute('lat'));
        const lng = Number(node.getAttribute('lon'));
        if (isValidLatLng(lat, lng)) {
          out.push([lng, lat]);
        }
      }
      return out;
    };

    let coordinates = extractNodes('trkpt');
    if (coordinates.length === 0) {
      coordinates = extractNodes('rtept');
    }

    const wptNodes = doc.getElementsByTagName('wpt');
    const waypoints: ParsedGpxWaypoint[] = [];
    for (let i = 0; i < wptNodes.length; i += 1) {
      const node = wptNodes[i];
      const lat = Number(node.getAttribute('lat'));
      const lng = Number(node.getAttribute('lon'));
      if (!isValidLatLng(lat, lng)) continue;
      const wptNameNode = node.getElementsByTagName('name')[0];
      const wptName = (wptNameNode?.textContent ?? '').trim() || `Point ${waypoints.length + 1}`;
      waypoints.push({ name: wptName, lat, lng });
    }

    return { name, coordinates, waypoints };
  } catch {
    return parseGpxWithRegex(xmlText);
  }
}
