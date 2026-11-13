import { GPSPosition, Waypoint } from '../types';

export interface ParsedGPXData {
  title: string;
  description?: string;
  positions: GPSPosition[];
  waypoints: Waypoint[];
}

/** Un segment du tracé (`trkseg`, ou `rte`) : points `[lng, lat]` et altitudes alignées. */
export interface GpxSegment {
  coordinates: Array<[number, number]>;
  /** Altitudes alignées sur `coordinates` (`null` si le point n'en porte pas). */
  elevations: Array<number | null>;
}

export interface ExtractedGpxTrack {
  /** Points `[lng, lat]` de tous les segments, à plat. */
  coordinates: Array<[number, number]>;
  /** Altitudes alignées sur `coordinates` à plat. */
  elevations: Array<number | null>;
  /** Segments séparés (un par `trkseg` / `trk` / `rte`) : jamais reliés entre eux. */
  segments: GpxSegment[];
  /** `track` (trkpt), `route` (rtept) ou `null` quand le fichier n'a pas de tracé. */
  kind: 'track' | 'route' | null;
}

/** Taille maximale d'un fichier GPX analysé (octets) : au-delà, on ne l'analyse pas. */
export const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Début d'un élément qui structure le tracé : segment (`trkseg`, `trk`, `rte`)
 * ou point (`trkpt`, `rtept`). `trkseg` avant `trk` ; `\b` écarte `trkpt` et `rtept`.
 */
const STRUCTURE_OPEN = /<(?:[\w-]+:)?(trkseg|trk|rte|trkpt|rtept)\b/g;
/** Le prochain point ou segment : borne la recherche d'une altitude. */
const NEXT_STRUCTURE = /<\/?(?:[\w-]+:)?(?:trkseg|trk|rte|trkpt|rtept)\b/;
/** `lat` ou `lon`, guillemets doubles (groupe 2) ou simples (groupe 3), ordre libre. */
const ATTR_RE = /\b(lat|lon)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ELE_RE = /<(?:[\w-]+:)?ele>\s*([^<\s]+)\s*<\/(?:[\w-]+:)?ele>/;
/** Longueur maximale des attributs d'un point et du contenu cherché après lui : coût linéaire. */
const MAX_TAG_LENGTH = 600;
const MAX_BODY_LENGTH = 1200;

export class GPXEngine {
  /**
   * Parse a raw GPX XML string into structured positions & waypoints
   */
  public static parseGPX(gpxXmlStr: string): ParsedGPXData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxXmlStr, 'application/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Format GPX invalide ou fichier XML corrompu.');
    }

    // Title & Description
    const nameEl = xmlDoc.querySelector('gpx > name, trk > name, metadata > name');
    const descEl = xmlDoc.querySelector('gpx > desc, trk > desc, metadata > desc');

    const title = nameEl?.textContent?.trim() || 'Tracé GPX Importé';
    const description = descEl?.textContent?.trim() || undefined;

    // Extract Track Points (<trkpt>)
    const trkptNodes = xmlDoc.querySelectorAll('trkpt');
    const positions: GPSPosition[] = [];

    trkptNodes.forEach((node, index) => {
      // Un attribut absent ne vaut PAS 0 : l'ancien `|| '0'` fabriquait un point
      // fantôme au large du Golfe de Guinée pour tout `<trkpt>` incomplet.
      const latRaw = node.getAttribute('lat');
      const lonRaw = node.getAttribute('lon');
      const lat = latRaw === null ? Number.NaN : Number(latRaw);
      const lon = lonRaw === null ? Number.NaN : Number(lonRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const eleNode = node.querySelector('ele');
      const timeNode = node.querySelector('time');

      const altitude = eleNode ? parseFloat(eleNode.textContent || '') : undefined;
      const parsedTime = timeNode ? new Date(timeNode.textContent || '').getTime() : Number.NaN;
      const timestamp = Number.isFinite(parsedTime) ? parsedTime : Date.now() + index * 1000;

      positions.push({
        latitude: lat,
        longitude: lon,
        altitude: altitude != null && Number.isFinite(altitude) ? altitude : undefined,
        timestamp,
      });
    });

    // Extract Waypoints (<wpt>)
    const wptNodes = xmlDoc.querySelectorAll('wpt');
    const waypoints: Waypoint[] = [];

    wptNodes.forEach((node, index) => {
      const latRaw = node.getAttribute('lat');
      const lonRaw = node.getAttribute('lon');
      const lat = latRaw === null ? Number.NaN : Number(latRaw);
      const lon = lonRaw === null ? Number.NaN : Number(lonRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const wptName = node.querySelector('name')?.textContent?.trim() || `Waypoint ${index + 1}`;
      const wptEle = node.querySelector('ele');
      const elevation = wptEle ? parseFloat(wptEle.textContent || '') : Number.NaN;

      waypoints.push({
        id: `wpt-${index + 1}`,
        name: wptName,
        lat,
        lon,
        elevationM: Number.isFinite(elevation) ? elevation : undefined,
      });
    });

    return {
      title,
      description,
      positions,
      waypoints,
    };
  }

  /**
   * Extrait les coordonnées `[lng, lat]` du TRACÉ d'un GPX, sans DOM, à plat :
   * les `trkpt` d'abord, à défaut les `rtept`. Les `wpt` (points d'intérêt)
   * ne sont jamais mêlés au tracé : un fichier qui n'a que des `wpt` n'a pas
   * de tracé et rend `[]`.
   *
   * Lecture tolérante : `lat` et `lon` dans n'importe quel ordre, guillemets
   * simples ou doubles, préfixe d'espace de noms. Un attribut absent ou non
   * numérique écarte le point (jamais de point à 0,0). Borné par `limit`.
   * Coût linéaire : les attributs et le contenu d'un point sont lus sur une
   * fenêtre bornée, jamais jusqu'à la fin du fichier.
   */
  public static extractCoordinates(gpxXmlStr: string, limit = 50_000): Array<[number, number]> {
    return GPXEngine.extractTrack(gpxXmlStr, limit).coordinates;
  }

  /**
   * Comme `extractCoordinates`, avec les altitudes (`<ele>`), les SEGMENTS
   * (un par `trkseg`, `trk` ou `rte`, jamais reliés entre eux) et l'origine du tracé.
   */
  public static extractTrack(gpxXmlStr: string, limit = 50_000): ExtractedGpxTrack {
    const empty: ExtractedGpxTrack = { coordinates: [], elevations: [], segments: [], kind: null };
    if (limit <= 0 || !gpxXmlStr) return empty;
    const { track, route } = GPXEngine.scan(gpxXmlStr, limit);
    const kind = track.length > 0 ? 'track' : route.length > 0 ? 'route' : null;
    if (!kind) return empty;
    const segments = kind === 'track' ? track : route;
    return {
      coordinates: segments.flatMap((segment) => segment.coordinates),
      elevations: segments.flatMap((segment) => segment.elevations),
      segments,
      kind,
    };
  }

  /**
   * Dénivelé positif cumulé. Un seuil d'hystérésis (3 m par défaut) évite de
   * compter le bruit du capteur d'altitude comme de la montée.
   */
  public static elevationGain(elevations: Array<number | null>, thresholdM = 3): number | null {
    const values = elevations.filter((e): e is number => e != null && Number.isFinite(e));
    if (values.length < 2) return null;
    let gain = 0;
    let reference = values[0];
    for (const value of values) {
      if (value - reference >= thresholdM) {
        gain += value - reference;
        reference = value;
      } else if (reference - value >= thresholdM) {
        reference = value;
      }
    }
    return Math.round(gain);
  }

  /** Dénivelé positif sommé segment par segment (pas de saut d'altitude entre deux segments). `null` si inconnu. */
  public static segmentsElevationGain(segments: GpxSegment[], thresholdM = 3): number | null {
    let total = 0;
    let known = false;
    for (const segment of segments) {
      const gain = GPXEngine.elevationGain(segment.elevations, thresholdM);
      if (gain !== null) {
        total += gain;
        known = true;
      }
    }
    return known ? total : null;
  }

  /** Un seul balayage linéaire du document : segments de trace et de route. */
  private static scan(xml: string, limit: number): { track: GpxSegment[]; route: GpxSegment[] } {
    const track: GpxSegment[] = [];
    const route: GpxSegment[] = [];
    let currentTrack: GpxSegment | null = null;
    let currentRoute: GpxSegment | null = null;
    let total = 0;
    const open = new RegExp(STRUCTURE_OPEN.source, 'g');
    let match: RegExpExecArray | null = open.exec(xml);
    while (match && total < limit) {
      const name = match[1];
      if (name === 'trkseg' || name === 'trk') {
        currentTrack = null;
      } else if (name === 'rte') {
        currentRoute = null;
      } else {
        const start = match.index + match[0].length;
        // La balise doit se refermer dans une fenêtre bornée : sinon le point est ignoré (pas de balayage jusqu'à la fin).
        const head = xml.slice(start, start + MAX_TAG_LENGTH);
        const gt = head.indexOf('>');
        if (gt !== -1) {
          const attrs = head.slice(0, gt);
          open.lastIndex = start + gt + 1;
          const point = GPXEngine.readLatLon(attrs);
          if (point) {
            let elevation: number | null = null;
            if (!attrs.trimEnd().endsWith('/')) {
              const body = xml.slice(open.lastIndex, open.lastIndex + MAX_BODY_LENGTH);
              const stop = body.search(NEXT_STRUCTURE);
              const ele = ELE_RE.exec(stop === -1 ? body : body.slice(0, stop));
              if (ele) {
                const parsed = Number(ele[1]);
                elevation = Number.isFinite(parsed) ? parsed : null;
              }
            }
            let segment: GpxSegment;
            if (name === 'trkpt') {
              if (!currentTrack) {
                currentTrack = { coordinates: [], elevations: [] };
                track.push(currentTrack);
              }
              segment = currentTrack;
            } else {
              if (!currentRoute) {
                currentRoute = { coordinates: [], elevations: [] };
                route.push(currentRoute);
              }
              segment = currentRoute;
            }
            segment.coordinates.push([point.lon, point.lat]);
            segment.elevations.push(elevation);
            total += 1;
          }
        }
      }
      match = open.exec(xml);
    }
    return { track, route };
  }

  private static readLatLon(attrs: string): { lat: number; lon: number } | null {
    let lat = Number.NaN;
    let lon = Number.NaN;
    const re = new RegExp(ATTR_RE.source, 'g');
    let m: RegExpExecArray | null = re.exec(attrs);
    while (m) {
      const raw = (m[2] ?? m[3] ?? '').trim();
      // `Number('')` vaut 0 : une valeur vide ne doit pas devenir une coordonnée.
      const value = raw === '' ? Number.NaN : Number(raw);
      if (m[1] === 'lat') lat = value;
      else lon = value;
      m = re.exec(attrs);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }

  /**
   * Export positions & waypoints as valid GPX 1.1 XML string
   */
  public static exportGPX(
    positions: GPSPosition[],
    waypoints: Waypoint[] = [],
    title: string = 'Randonnée LKDV'
  ): string {
    const timeNow = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<gpx version="1.1" creator="Le Kit du Voyageur - https://kitduvoyageur.app"\n`;
    xml += `     xmlns="http://www.topografix.com/GPX/1/1"\n`;
    xml += `     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
    xml += `     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;
    xml += `  <metadata>\n`;
    xml += `    <name>${this.escapeXml(title)}</name>\n`;
    xml += `    <time>${timeNow}</time>\n`;
    xml += `  </metadata>\n`;

    // Export Waypoints
    waypoints.forEach((wpt) => {
      xml += `  <wpt lat="${wpt.lat}" lon="${wpt.lon}">\n`;
      xml += `    <name>${this.escapeXml(wpt.name)}</name>\n`;
      if (wpt.elevationM != null) xml += `    <ele>${wpt.elevationM.toFixed(1)}</ele>\n`;
      xml += `  </wpt>\n`;
    });

    // Export Track Points
    xml += `  <trk>\n`;
    xml += `    <name>${this.escapeXml(title)}</name>\n`;
    xml += `    <trkseg>\n`;

    positions.forEach((pos) => {
      xml += `      <trkpt lat="${pos.latitude}" lon="${pos.longitude}">\n`;
      if (pos.altitude != null) xml += `        <ele>${pos.altitude.toFixed(1)}</ele>\n`;
      xml += `        <time>${new Date(pos.timestamp).toISOString()}</time>\n`;
      xml += `      </trkpt>\n`;
    });

    xml += `    </trkseg>\n`;
    xml += `  </trk>\n`;
    xml += `</gpx>`;

    return xml;
  }

  /**
   * GPX 1.1 minimal (une trace, sans horodatage) à partir de points `[lng, lat]`.
   * Sert à partager un tracé connu comme un vrai fichier GPX, lisible par
   * `extractCoordinates` et par les autres applications.
   */
  public static fromCoordinates(coordinates: Array<[number, number]>, title: string = 'Tracé LKDV'): string {
    return GPXEngine.fromSegments([coordinates], title);
  }

  /** Comme `fromCoordinates`, avec un `trkseg` par segment (segments jamais reliés). */
  public static fromSegments(segments: Array<Array<[number, number]>>, title: string = 'Tracé LKDV'): string {
    const body = segments
      .map((segment) =>
        segment
          .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
          .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"/>`)
          .join('\n'),
      )
      .filter((points) => points.length > 0)
      .map((points) => `    <trkseg>\n${points}\n    </trkseg>`)
      .join('\n');
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<gpx version="1.1" creator="Le Kit du Voyageur - https://kitduvoyageur.app" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `  <metadata><name>${this.escapeXml(title)}</name></metadata>\n` +
      `  <trk>\n    <name>${this.escapeXml(title)}</name>\n${body}\n  </trk>\n</gpx>\n`
    );
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
