/** GPX réel : aucun fichier stocké, un `<trkseg>` par morceau visible. */
export function downloadGpx(name: string, trace: unknown) {
  const raw =
    (trace as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates ??
    (trace as { coordinates?: unknown })?.coordinates ??
    [];
  if (!Array.isArray(raw) || raw.length === 0) return;

  const multiLine =
    Array.isArray(raw[0]) && Array.isArray((raw[0] as unknown[])[0]);
  const segments = multiLine ? raw : [raw];
  const track = segments
    .filter((segment): segment is unknown[] => Array.isArray(segment) && segment.length >= 2)
    .map((segment) => {
      const points = segment
        .map((point) => {
          const row = point as { lng?: unknown; lat?: unknown; ele?: unknown };
          const lng = Array.isArray(point) ? point[0] : row?.lng;
          const lat = Array.isArray(point) ? point[1] : row?.lat;
          const ele = Array.isArray(point) ? point[2] : row?.ele;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
          return `<trkpt lat="${lat}" lon="${lng}">${
            Number.isFinite(ele) ? `<ele>${ele}</ele>` : ''
          }</trkpt>`;
        })
        .join('');
      return `<trkseg>${points}</trkseg>`;
    })
    .join('');
  if (!track) return;

  const safeName = name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${safeName}</name></metadata><trk><name>${safeName}</name>${track}</trk></gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}
