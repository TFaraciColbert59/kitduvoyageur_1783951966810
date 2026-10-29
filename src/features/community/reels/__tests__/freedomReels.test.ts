import { describe, it, expect } from 'vitest';
import {
  serializeCommentContent,
  parseCommentContent,
  FREEDOM_CURATED_REELS,
  postReelComment,
  fetchReelComments,
} from '../freedomReelsService';
import type { FreedomCommentAttachment } from '../freedom-types';

describe('Freedom Reels & Comments Attachment System', () => {
  it('parses plain text comments without attachments', () => {
    const raw = 'Superbe bivouac au sommet !';
    const result = parseCommentContent(raw);
    expect(result.text).toBe('Superbe bivouac au sommet !');
    expect(result.attachment).toBeNull();
  });

  it('serializes and parses Kit attachments correctly', () => {
    const attachment: FreedomCommentAttachment = {
      type: 'kit',
      kit: {
        kind: 'kit',
        kit_id: 'kit-123-abc',
        kit_name: 'Bivouac Glaciaire 3800m',
        items_count: 14,
        total_weight_g: 4850,
      },
    };

    const text = 'Voici mon matériel pour cette course :';
    const serialized = serializeCommentContent(text, attachment);

    expect(serialized).toContain('Voici mon matériel pour cette course :');
    expect(serialized).toContain('<!--lkdv-freedom-att:');

    const parsed = parseCommentContent(serialized);
    expect(parsed.text).toBe(text);
    expect(parsed.attachment).not.toBeNull();
    expect(parsed.attachment?.type).toBe('kit');
    expect(parsed.attachment?.kit?.kit_name).toBe('Bivouac Glaciaire 3800m');
    expect(parsed.attachment?.kit?.items_count).toBe(14);
  });

  it('serializes and parses GPX trace attachments correctly', () => {
    const attachment: FreedomCommentAttachment = {
      type: 'gpx',
      gpx: {
        name: 'Arete_Des_Cosmiques.gpx',
        distanceKm: 12.4,
        elevationGainM: 950,
        pointsCount: 1200,
      },
    };

    const text = 'Le fichier GPX est téléchargeable ici :';
    const serialized = serializeCommentContent(text, attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe(text);
    expect(parsed.attachment?.type).toBe('gpx');
    expect(parsed.attachment?.gpx?.name).toBe('Arete_Des_Cosmiques.gpx');
    expect(parsed.attachment?.gpx?.distanceKm).toBe(12.4);
    expect(parsed.attachment?.gpx?.elevationGainM).toBe(950);
  });

  it('serializes and parses Product / Equipment attachments correctly', () => {
    const attachment: FreedomCommentAttachment = {
      type: 'product',
      product: {
        kind: 'product',
        id: 'prod-msr-hubba',
        name: 'Tente MSR Hubba Hubba',
        category: 'Tentes',
        price_cents: 48900,
        photo_url: '/assets/images/product-tent.jpg',
      },
    };

    const text = 'Recommandation équipement :';
    const serialized = serializeCommentContent(text, attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe(text);
    expect(parsed.attachment?.type).toBe('product');
    expect(parsed.attachment?.product?.name).toBe('Tente MSR Hubba Hubba');
    expect(parsed.attachment?.product?.price_cents).toBe(48900);
  });

  it('serializes and parses Trail attachments correctly', () => {
    const attachment: FreedomCommentAttachment = {
      type: 'trail',
      trail: {
        kind: 'trail',
        id: 'trail-aneto',
        name: 'Tour du Cirque de Gavarnie',
        distance_km: 18.5,
        elevation_gain_m: 1180,
        region: 'Pyrénées',
      },
    };

    const text = 'Itinéraire complet sur la carte LKDV :';
    const serialized = serializeCommentContent(text, attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe(text);
    expect(parsed.attachment?.type).toBe('trail');
    expect(parsed.attachment?.trail?.name).toBe('Tour du Cirque de Gavarnie');
    expect(parsed.attachment?.trail?.region).toBe('Pyrénées');
  });

  it('handles attachment with empty text', () => {
    const attachment: FreedomCommentAttachment = {
      type: 'photo',
      photoUrl: 'https://example.com/photo.jpg',
    };

    const serialized = serializeCommentContent('', attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe('');
    expect(parsed.attachment?.type).toBe('photo');
    expect(parsed.attachment?.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('tolerates corrupted or malformed tokens safely', () => {
    const broken = 'Voici un message <!--lkdv-freedom-att:{broken json--> fin';
    const parsed = parseCommentContent(broken);
    expect(parsed.text).toBe(broken);
    expect(parsed.attachment).toBeNull();
  });

  it('loads curated reels with valid 9:16 outdoor vertical videos and authors', () => {
    expect(FREEDOM_CURATED_REELS.length).toBeGreaterThanOrEqual(4);

    for (const reel of FREEDOM_CURATED_REELS) {
      expect(reel.id).toBeDefined();
      expect(reel.videoUrl).toMatch(/\.(mp4|webm|mov)|blob:/i);
      expect(reel.author.name).toBeDefined();
      expect(reel.caption).toBeDefined();
      expect(reel.location).toBeDefined();
      expect(reel.soundTitle).toBeDefined();
      expect(reel.likesCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('posts and retrieves local comments on curated reels', async () => {
    const testReelId = 'freedom-curated-1';
    const user = {
      id: 'test-user-123',
      user_metadata: { full_name: 'Arthur Rimbaud', avatar_url: null },
    };

    const initialComments = await fetchReelComments(testReelId, user);
    const initialCount = initialComments.length;

    const newComment = await postReelComment(
      testReelId,
      user,
      'Test comment with kit',
      {
        type: 'kit',
        kit: { kind: 'kit', kit_id: 'k-99', kit_name: 'Kit Alpinisme', items_count: 7 },
      },
    );

    expect(newComment.content).toBe('Test comment with kit');
    expect(newComment.attachment?.type).toBe('kit');
    expect(newComment.author.name).toBe('Arthur Rimbaud');

    const updatedComments = await fetchReelComments(testReelId, user);
    expect(updatedComments.length).toBe(initialCount + 1);
    expect(updatedComments[updatedComments.length - 1].content).toBe('Test comment with kit');
  });

  it('correctly preserves full GPX XML fileContent through serialization', () => {
    const fakeGpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LKDV Outdoor">
  <trk><name>Mont Blanc 4810m</name><trkseg>
    <trkpt lat="45.8326" lon="6.8652"><ele>4810</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    const attachment: FreedomCommentAttachment = {
      type: 'gpx',
      gpx: {
        name: 'Mont_Blanc_Summit.gpx',
        fileContent: fakeGpxXml,
        distanceKm: 28.5,
        elevationGainM: 3800,
        pointsCount: 1,
      },
    };

    const text = 'Voici le tracé complet avec fichier brut :';
    const serialized = serializeCommentContent(text, attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe(text);
    expect(parsed.attachment?.type).toBe('gpx');
    expect(parsed.attachment?.gpx?.fileContent).toBe(fakeGpxXml);
    expect(parsed.attachment?.gpx?.elevationGainM).toBe(3800);
  });

  it('correctly handles multiline text with unicode, emojis, and special chars', () => {
    const complexText = `Ligne 1 : Bivouac magique ⛺❄️\nLigne 2 : Température -8°C & vent 45km/h\n"C'était inoubliable !" <test>`;
    const attachment: FreedomCommentAttachment = {
      type: 'kit',
      kit: {
        kind: 'kit',
        kit_id: 'kit-winter',
        kit_name: 'Pack Hivernal Grand Froid -20°C',
        items_count: 18,
        total_weight_g: 6200,
      },
    };

    const serialized = serializeCommentContent(complexText, attachment);
    const parsed = parseCommentContent(serialized);

    expect(parsed.text).toBe(complexText);
    expect(parsed.attachment?.kit?.kit_name).toBe('Pack Hivernal Grand Froid -20°C');
    expect(parsed.attachment?.kit?.total_weight_g).toBe(6200);
  });

  it('validates double click timing logic (<450ms is double click, >=450ms is single click)', () => {
    const isDoubleClick = (lastClickTime: number, now: number, threshold = 450) => {
      const diff = now - lastClickTime;
      return diff > 0 && diff < threshold;
    };

    // First click: lastClick was 0
    expect(isDoubleClick(0, 1000)).toBe(false);

    // Fast second click: 250ms later -> True double click
    expect(isDoubleClick(1000, 1250)).toBe(true);

    // Slow second click: 600ms later -> Not a double click
    expect(isDoubleClick(1000, 1600)).toBe(false);

    // Simultaneous / negative timestamps safeguard
    expect(isDoubleClick(1000, 1000)).toBe(false);
  });
});

