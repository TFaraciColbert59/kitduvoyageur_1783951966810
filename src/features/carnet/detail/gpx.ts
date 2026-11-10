import { parsePositions } from '@/features/compte/map/geometry';

const escapeXml = (text: string): string =>
  text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string);

/**
 * Trace réelle du carnet au format GPX 1.1 (une `<trk>` d'un seul segment).
 * `null` quand le carnet n'a pas deux points GPS : aucun fichier vide offert.
 */
export function buildGpx(title: string, trace: unknown): string | null {
  const points = parsePositions(trace);
  if (points.length < 2) return null;
  const trkpts = points
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"/>`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(title)}</name></metadata>`,
    '  <trk>',
    `    <name>${escapeXml(title)}</name>`,
    '    <trkseg>',
    trkpts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}
