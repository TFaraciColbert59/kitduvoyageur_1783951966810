import { GPSPosition, Waypoint } from '../types';

export interface ParsedGPXData {
  title: string;
  description?: string;
  positions: GPSPosition[];
  waypoints: Waypoint[];
}

export interface ExtractedGpxTrack {
  /** Points `[lng, lat]` du tracé. */
  coordinates: Array<[number, number]>;
  /** Altitudes alignées sur `coordinates` (`null` si le point n'en porte pas). */
  elevations: Array<number | null>;
  /** `track` (trkpt), `route` (rtept) ou `null` quand le fichier n'a pas de tracé. */
  kind: 'track' | 'route' | null;
}

/** Balise ouvrante d'un point de trace : le groupe 1 porte les attributs. */
const TRKPT_OPEN = /<(?:[\w-]+:)?trkpt\b([^>]*)>/;
const RTEPT_OPEN = /<(?:[\w-]+:)?rtept\b([^>]*)>/;
/** `lat` ou `lon`, guillemets doubles (groupe 2) ou simples (groupe 3), ordre libre. */
const ATTR_RE = /\b(lat|lon)\s*=\s*(?:"([^"]*)"|'([^']*)')/;
const ELE_RE = /<(?:[\w-]+:)?ele>\s*([^<\s]+)\s*<\/(?:[\w-]+:)?ele>/;

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
   * Extrait les coordonnées `[lng, lat]` du TRACÉ d'un GPX, sans DOM :
   * les `trkpt` d'abord, à défaut les `rtept`. Les `wpt` (points d'intérêt)
   * ne sont jamais mêlés au tracé : un fichier qui n'a que des `wpt` n'a pas
   * de tracé et rend `[]`.
   *
   * Lecture tolérante : `lat` et `lon` dans n'importe quel ordre, guillemets
   * simples ou doubles, préfixe d'espace de noms. Un attribut absent ou non
   * numérique écarte le point (jamais de point à 0,0). Borné par `limit`.
   */
  public static extractCoordinates(gpxXmlStr: string, limit = 50_000): Array<[number, number]> {
    return GPXEngine.extractTrack(gpxXmlStr, limit).coordinates;
  }

  /**
   * Comme `extractCoordinates`, avec les altitudes (`<ele>`) alignées sur les
   * points (`null` quand le point n'en porte pas) et l'origine du tracé.
   */
  public static extractTrack(gpxXmlStr: string, limit = 50_000): ExtractedGpxTrack {
    const empty: ExtractedGpxTrack = { coordinates: [], elevations: [], kind: null };
    if (limit <= 0 || !gpxXmlStr) return empty;
    const track = GPXEngine.scanPoints(gpxXmlStr, TRKPT_OPEN, '</trkpt', limit);
    if (track.coordinates.length > 0) return { ...track, kind: 'track' };
    const route = GPXEngine.scanPoints(gpxXmlStr, RTEPT_OPEN, '</rtept', limit);
    if (route.coordinates.length > 0) return { ...route, kind: 'route' };
    return empty;
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

  private static scanPoints(
    xml: string,
    openTag: RegExp,
    closeToken: string,
    limit: number,
  ): { coordinates: Array<[number, number]>; elevations: Array<number | null> } {
    const coordinates: Array<[number, number]> = [];
    const elevations: Array<number | null> = [];
    const open = new RegExp(openTag.source, 'g');
    let match: RegExpExecArray | null = open.exec(xml);
    while (match && coordinates.length < limit) {
      const attrs = match[1];
      const point = GPXEngine.readLatLon(attrs);
      if (point) {
        coordinates.push([point.lon, point.lat]);
        let elevation: number | null = null;
        if (!attrs.trimEnd().endsWith('/')) {
          const end = xml.indexOf(closeToken, open.lastIndex);
          const body = end === -1 ? '' : xml.slice(open.lastIndex, end);
          const ele = ELE_RE.exec(body);
          if (ele) {
            const parsed = Number(ele[1]);
            elevation = Number.isFinite(parsed) ? parsed : null;
          }
        }
        elevations.push(elevation);
      }
      match = open.exec(xml);
    }
    return { coordinates, elevations };
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
    const points = coordinates
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
      .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"/>`)
      .join('\n');
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<gpx version="1.1" creator="Le Kit du Voyageur - https://kitduvoyageur.app" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `  <metadata><name>${this.escapeXml(title)}</name></metadata>\n` +
      `  <trk>\n    <name>${this.escapeXml(title)}</name>\n    <trkseg>\n${points}\n    </trkseg>\n  </trk>\n</gpx>\n`
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
