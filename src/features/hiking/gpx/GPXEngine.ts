import { GPSPosition, Waypoint } from '../types';

export interface ParsedGPXData {
  title: string;
  description?: string;
  positions: GPSPosition[];
  waypoints: Waypoint[];
}

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
   * Extrait uniquement les coordonnées `[lng, lat]` d'un GPX (trkpt, rtept, wpt)
   * dans l'ordre du document, sans construire de DOM.
   *
   * Utilisé par l'aperçu de pièce jointe de la messagerie : lecture tolérante
   * (attributs simples ou doubles quotes), bornée pour ne jamais matérialiser
   * une trace démesurée.
   */
  public static extractCoordinates(gpxXmlStr: string, limit = 50_000): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    if (limit <= 0) return points;
    const re = /<(?:trkpt|rtept|wpt)\b[^>]*\blat="(-?\d+(?:\.\d+)?)"[^>]*\blon="(-?\d+(?:\.\d+)?)"/g;
    let match: RegExpExecArray | null = re.exec(gpxXmlStr);
    while (match && points.length < limit) {
      const lat = Number.parseFloat(match[1]);
      const lon = Number.parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lon, lat]);
      match = re.exec(gpxXmlStr);
    }
    return points;
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
