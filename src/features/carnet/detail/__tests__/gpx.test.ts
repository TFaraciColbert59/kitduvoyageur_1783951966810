import { describe, expect, it } from 'vitest';
import { buildGpx } from '../gpx';

describe('buildGpx', () => {
  it('écrit une trace GPX 1.1 et échappe le titre', () => {
    const xml = buildGpx('Tour <des> Écrins & co', {
      type: 'LineString',
      coordinates: [
        [6.2916, 44.9455],
        [6.301, 44.9561],
      ],
    }) as string;
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('Tour &lt;des&gt; Écrins &amp; co');
    expect(xml).toContain('<trkpt lat="44.945500" lon="6.291600"/>');
    expect((xml.match(/<trkpt /g) ?? []).length).toBe(2);
  });

  it('ne produit rien sans deux points GPS', () => {
    expect(buildGpx('x', null)).toBeNull();
    expect(buildGpx('x', { type: 'LineString', coordinates: [[1, 2]] })).toBeNull();
  });
});
