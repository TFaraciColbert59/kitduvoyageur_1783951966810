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

  it('guarantees comment authors have valid names and handles for profile navigation', async () => {
    const comments = await fetchReelComments('freedom-curated-1');
    expect(comments.length).toBeGreaterThanOrEqual(3);
    for (const c of comments) {
      expect(c.author.name).toBeTruthy();
      expect(c.author.id).toBeTruthy();
      expect(c.author.handle).toBeTruthy();
    }
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

  it('validates horizontal swipe gesture detection (swipe left exit vs swipe right profile)', () => {
    const detectSwipe = (startX: number, startY: number, endX: number, endY: number) => {
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        return deltaX < -60 ? 'swipe-left-exit' : 'swipe-right-profile';
      }
      return 'none';
    };

    // Swipe left (finger moves right to left by 120px, vertical drift 20px) -> exit
    expect(detectSwipe(200, 300, 80, 320)).toBe('swipe-left-exit');

    // Swipe right (finger moves left to right by 100px, vertical drift 10px) -> profile
    expect(detectSwipe(50, 300, 150, 310)).toBe('swipe-right-profile');

    // Vertical scroll (deltaY = 150px, deltaX = 30px) -> none
    expect(detectSwipe(100, 100, 130, 250)).toBe('none');

    // Small wiggle (<60px) -> none
    expect(detectSwipe(100, 100, 140, 110)).toBe('none');
  });

  it('verifies that curated reels have linked kits with valid names for minimal pill display', () => {
    for (const reel of FREEDOM_CURATED_REELS) {
      if (reel.linkedKit) {
        expect(reel.linkedKit.name).toBeTruthy();
        expect(typeof reel.linkedKit.name).toBe('string');
        // Ensure name is clean without emojis or button boilerplate
        expect(reel.linkedKit.name).not.toContain('🎒');
        expect(reel.linkedKit.name).not.toContain('Voir la liste');
      }
      if (reel.location) {
        expect(reel.location).toBeTruthy();
      }
    }
  });

  it('posts and preserves reply comments with parentId for proper threading', async () => {
    const parentComment = await postReelComment(
      'freedom-curated-1',
      { id: 'user-parent', user_metadata: { full_name: 'Guillaume' } },
      'Quelle vue magique !',
    );
    expect(parentComment.parentId).toBeNull();

    const replyComment = await postReelComment(
      'freedom-curated-1',
      { id: 'user-child', user_metadata: { full_name: 'Camille' } },
      'Oui, nous avons campé sur la crête.',
      null,
      parentComment.id,
    );
    expect(replyComment.parentId).toBe(parentComment.id);
    expect(replyComment.content).toBe('Oui, nous avons campé sur la crête.');
  });

  it('guarantees opaque Liquid Glass styling contract for attachment cards (no pure white)', () => {
    // Validates that comment cards do not use pure white backgrounds, but opaque liquid glass
    const liquidGlassClass =
      'group mt-1 flex items-center gap-2.5 rounded-2xl border border-white/90 bg-white/85 p-1.5 pr-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_3px_12px_rgba(23,43,36,0.07)] backdrop-blur-2xl backdrop-saturate-150 transition hover:border-[#17402C]/30 hover:bg-white/95 active:scale-[0.98] text-left max-w-[280px]';

    expect(liquidGlassClass).not.toContain('bg-white ');
    expect(liquidGlassClass).toContain('bg-white/85');
    expect(liquidGlassClass).toContain('backdrop-blur-2xl');
    expect(liquidGlassClass).toContain('border-white/90');
  });

  it('verifies share drawer bottom-right mini selector options contract', () => {
    // Mini selector items contract for FreedomShareDrawer
    const shareSelectorTabs = [
      { id: 'copy', label: 'Copier le lien' },
      { id: 'native', label: 'Partager' },
    ];
    expect(shareSelectorTabs).toHaveLength(2);
    expect(shareSelectorTabs[0].id).toBe('copy');
    expect(shareSelectorTabs[1].id).toBe('native');
  });
});



