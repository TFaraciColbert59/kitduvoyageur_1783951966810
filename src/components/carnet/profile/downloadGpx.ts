/** GPX réel : aucune trace, aucun fichier. */
export function downloadGpx(name: string, trace: unknown) {
  const raw = (trace as any)?.geometry?.coordinates ?? (trace as any)?.coordinates ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return;
  const points = raw
    .map((point: any) => {
      const lng = Array.isArray(point) ? point[0] : point?.lng;
      const lat = Array.isArray(point) ? point[1] : point?.lat;
      const ele = Array.isArray(point) ? point[2] : point?.ele;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
      return `<trkpt lat="${lat}" lon="${lng}">${Number.isFinite(ele) ? `<ele>${ele}</ele>` : ''}</trkpt>`;
    })
    .join('');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg>${points}</trkseg></trk></gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}
