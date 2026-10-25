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

    // Extract Waypoints (<wpt>)
    const wptNodes = xmlDoc.querySelectorAll('wpt');
    const waypoints: Waypoint[] = [];

    wptNodes.forEach((node, index) => {
      const lat = parseFloat(node.getAttribute('lat') || '0');
      const lon = parseFloat(node.getAttribute('lon') || '0');
      const wptName = node.querySelector('name')?.textContent?.trim() || `Waypoint ${index + 1}`;
      const wptEle = node.querySelector('ele');

      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({
          id: `wpt-${index + 1}`,
          name: wptName,
          lat,
          lon,
          elevationM: wptEle ? parseFloat(wptEle.textContent || '0') : undefined,
        });
      }
    });

    return {
      title,
      description,
      positions,
      waypoints,
    };
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
