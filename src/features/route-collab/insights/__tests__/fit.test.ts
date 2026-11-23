import { describe, expect, it } from 'vitest';
import { decodeFit } from '../fit';
import { parseTrackFile } from '../formats';
import { buildFit } from './fitBuilder';

const T0 = 1_100_000_000; // secondes depuis 1989-12-31 UTC
const recs = [
  { lat: 45.0, lon: 6.0, alt: 1000, ts: T0 },
  { lat: 45.01, lon: 6.02, alt: 1012.4, ts: T0 + 30 },
  { lat: 45.02, lon: 6.04, enhancedAlt: 1031.2, alt: 900, ts: T0 + 60 },
];

describe('5.9 décodeur FIT minimal', () => {
  it('lit les records : semicircles en degrés, altitude, horodatage ISO', () => {
    const r = decodeFit(buildFit({ records: recs }));
    if (!r.ok) throw new Error(r.message);
    expect(r.points).toHaveLength(3);
    expect(r.points[0].lat).toBeCloseTo(45.0, 6);
    expect(r.points[1].lon).toBeCloseTo(6.02, 6);
    expect(r.points[0].ele).toBeCloseTo(1000, 1);
    expect(r.points[1].ele).toBeCloseTo(1012.4, 1);
    // enhanced_altitude l'emporte sur altitude
    expect(r.points[2].ele).toBeCloseTo(1031.2, 1);
    expect(r.points[0].time).toBe(new Date((T0 + 631_065_600) * 1000).toISOString());
    expect(r.skippedPoints).toBe(0);
  });

  it('en-tête de 12 octets, big endian, messages et champs développeur sautés', () => {
    const r = decodeFit(buildFit({ records: recs, bigEndian: true, headerSize: 12, withNoise: true }));
    if (!r.ok) throw new Error(r.message);
    expect(r.points).toHaveLength(3);
    expect(r.points[2].lat).toBeCloseTo(45.02, 6);
  });

  it('record sans position : écarté et compté, jamais inventé ; sans heure ni altitude : champs absents', () => {
    const r = decodeFit(buildFit({ records: [{ ts: T0 }, { lat: 10, lon: 20 }, { lat: 10.1, lon: 20.1 }] }));
    if (!r.ok) throw new Error(r.message);
    expect(r.points).toHaveLength(2);
    expect(r.skippedPoints).toBe(1);
    expect(r.points[0].ele).toBeUndefined();
    expect(r.points[0].time).toBeUndefined();
  });

  it('temps compressé : l’horodatage suit le décalage sur 5 bits', () => {
    const r = decodeFit(buildFit({ compressed: true, records: [{ lat: 45, lon: 6, ts: T0 }, { lat: 45.01, lon: 6, ts: T0 + 7 }, { lat: 45.02, lon: 6, ts: T0 + 30 }, { lat: 45.03, lon: 6, ts: T0 + 36 }] }));
    if (!r.ok) throw new Error(r.message);
    const sec = (i: number) => Date.parse(r.points[i].time as string) / 1000 - 631_065_600;
    expect(sec(0)).toBe(T0);
    expect(sec(1)).toBe(T0 + 7);
    expect(sec(2)).toBe(T0 + 30);
    // Le compteur de 5 bits a bouclé : +32 s ajoutés.
    expect(sec(3)).toBe(T0 + 36);
  });

  it('CRC ignorée : un octet de CRC faux ne change rien, la taille déclarée est contrôlée', () => {
    const bytes = buildFit({ records: recs });
    const badCrc = bytes.slice();
    badCrc[badCrc.length - 1] ^= 0xff;
    expect(decodeFit(badCrc).ok).toBe(true);
    const cut = bytes.slice(0, bytes.length - 3);
    const r = decodeFit(cut);
    expect(r).toMatchObject({ ok: false, code: 'invalid_content' });
    if (!r.ok) expect(r.message).toMatch(/incomplet ou corrompu/);
  });

  it('refuse proprement : trop court, signature absente, en-tête inattendu, données vides, message sans définition', () => {
    expect(decodeFit(new Uint8Array([14, 16]))).toMatchObject({ ok: false, code: 'invalid_content' });
    const noSig = buildFit({ records: recs });
    noSig[8] = 0x58;
    const a = decodeFit(noSig);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.message).toMatch(/signature/);
    const badHeader = buildFit({ records: recs });
    badHeader[0] = 9;
    expect(decodeFit(badHeader)).toMatchObject({ ok: false, code: 'invalid_content' });
    const empty = buildFit({ records: [] });
    // Seule la définition reste : aucun point GPS.
    expect(decodeFit(empty)).toMatchObject({ ok: false, code: 'no_points' });
    const orphan = Uint8Array.from([12, 0x20, 0x34, 0x08, 2, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0x03, 0x01, 0, 0]);
    const o = decodeFit(orphan);
    expect(o).toMatchObject({ ok: false, code: 'invalid_content' });
    if (!o.ok) expect(o.message).toMatch(/précède sa définition/);
  });

  it('fichier corrompu au milieu (champ qui dépasse la taille) : refusé, jamais lu à moitié', () => {
    const bytes = buildFit({ records: recs });
    // Fait croire que la taille de données couvre moins que le dernier message : le message est tronqué.
    const view = new DataView(bytes.buffer);
    view.setUint32(4, view.getUint32(4, true) - 4, true);
    const r = decodeFit(bytes);
    expect(r).toMatchObject({ ok: false, code: 'invalid_content' });
    if (!r.ok) expect(r.message).toMatch(/tronqué/);
  });

  it('parseTrackFile : un ArrayBuffer FIT donne format « fit », points exploitables ; un ArrayBuffer GPX reste du texte', () => {
    const bytes = buildFit({ records: recs });
    const r = parseTrackFile(bytes.buffer.slice(0) as ArrayBuffer, 'sortie.fit');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.format).toBe('fit');
    expect(r.points).toHaveLength(3);
    const gpx = '<gpx version="1.1"><trk><trkseg><trkpt lat="45" lon="5"/><trkpt lat="45.1" lon="5.1"/></trkseg></trk></gpx>';
    const g = parseTrackFile(new TextEncoder().encode(gpx), 'a.gpx');
    expect(g.ok && g.format).toBe('gpx');
    // Un fichier sans extension mais à signature .FIT est reconnu.
    expect(parseTrackFile(bytes, 'export').ok).toBe(true);
    // Corrompu : erreur propre, pas d'exception.
    const bad = parseTrackFile(bytes.slice(0, 20), 'x.fit');
    expect(bad).toMatchObject({ ok: false, error: { code: 'invalid_content' } });
  });
});
