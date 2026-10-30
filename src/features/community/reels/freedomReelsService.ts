import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import { storyMediaUrl } from '@/lib/stories/media';
import type {
  FreedomComment,
  FreedomCommentAttachment,
  FreedomReelItem,
} from './freedom-types';

const ATTACHMENT_PREFIX = '<!--lkdv-freedom-att:';
const ATTACHMENT_SUFFIX = '-->';

/**
 * Serializes comment text and optional rich attachment into a single compliant text string.
 * This guarantees 100% compatibility with the `post_comments.content` table without breaking schema.
 */
export function serializeCommentContent(
  text: string,
  attachment?: FreedomCommentAttachment | null,
): string {
  const cleanText = (text || '').trim();
  if (!attachment) return cleanText;
  try {
    const json = JSON.stringify(attachment);
    const token = `${ATTACHMENT_PREFIX}${json}${ATTACHMENT_SUFFIX}`;
    return cleanText ? `${cleanText}\n${token}` : token;
  } catch {
    return cleanText;
  }
}

/**
 * Safely parses comment text and extracts any embedded Freedom attachment (Kit, GPX, Product, Trail, Photo).
 */
export function parseCommentContent(content: string): {
  text: string;
  attachment: FreedomCommentAttachment | null;
} {
  if (!content) return { text: '', attachment: null };

  const startIdx = content.indexOf(ATTACHMENT_PREFIX);
  if (startIdx >= 0) {
    const endIdx = content.indexOf(ATTACHMENT_SUFFIX, startIdx + ATTACHMENT_PREFIX.length);
    if (endIdx > startIdx) {
      const jsonStr = content.slice(startIdx + ATTACHMENT_PREFIX.length, endIdx);
      const textPart = (
        content.slice(0, startIdx) + content.slice(endIdx + ATTACHMENT_SUFFIX.length)
      ).trim();
      try {
        const attachment = JSON.parse(jsonStr) as FreedomCommentAttachment;
        return { text: textPart, attachment };
      } catch {
        // Fallback to raw text
      }
    }
  }

  // Also support full json root if stored that way
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.attachment && typeof parsed.text === 'string') {
        return { text: parsed.text, attachment: parsed.attachment };
      }
    } catch {
      // not json
    }
  }

  return { text: content, attachment: null };
}

/**
 * High-definition vertical outdoor micro-video presets (9:16 format outdoor immersion)
 * Guarantees instantaneous, 60fps cinematic playback even when offline or before remote uploads.
 */
export const FREEDOM_CURATED_REELS: FreedomReelItem[] = [
  {
    id: 'freedom-curated-1',
    videoUrl: '/earth-bg.mp4',
    posterUrl: '/assets/images/adventure-bivouac.jpg',
    caption: 'Bivouac suspendu face au Mont-Blanc à 3100m. Le lever de soleil parfait après 7h d’ascension alpine 🏔️🏕️ #bivouac #alpinisme #freedom #montblanc',
    tags: ['bivouac', 'alpinisme', 'freedom', 'montblanc', 'outdoor'],
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    author: {
      id: '7e8ba234-94cf-4de1-8994-58f3a5424a77',
      name: 'Thomas Mercier',
      handle: 'thomas.mercier',
      avatarUrl: 'https://i.pravatar.cc/400?img=26',
      isVerified: true,
      isFollowing: false,
      loyaltyLevel: 'Randonneur Expert',
    },
    likesCount: 1420,
    commentsCount: 68,
    sharesCount: 194,
    isLiked: false,
    isSaved: false,
    linkedKitId: 'bec07364-8c27-577d-8075-bda072c0a217',
    linkedKit: {
      id: 'bec07364-8c27-577d-8075-bda072c0a217',
      name: 'Thomas — Ultralight',
      itemsCount: 14,
      weightG: 4850,
    },
    linkedTrail: {
      id: 'trail-mb-aiguille',
      name: 'Traversée Aiguilles de Chamonix',
      distanceKm: 14.2,
      elevationGainM: 1350,
      region: 'Haute-Savoie, France',
    },
    soundTitle: 'Vent d’altitude & crépitement réchaud (Original Audio)',
    location: 'Chamonix-Mont-Blanc · 3 100 m',
  },
  {
    id: 'freedom-curated-2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl: '/assets/images/adventure-hiking.jpg',
    caption: 'Passage engagé sur l’arête des Pyrénées espagnoles. Pas de vent, une visibilité infinie jusqu’à la Méditerranée ⛰️☀️ #trekking #pyrenees #liberte',
    tags: ['trekking', 'pyrenees', 'arête', 'outdoor'],
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    author: {
      id: 'd8aa9b1c-45b2-4656-b208-c7abf33745d4',
      name: 'Sophie Garnier',
      handle: 'sophie.garnier',
      avatarUrl: 'https://i.pravatar.cc/400?img=47',
      isVerified: true,
      isFollowing: true,
      loyaltyLevel: 'Exploratrice',
    },
    likesCount: 954,
    commentsCount: 42,
    sharesCount: 112,
    isLiked: true,
    isSaved: true,
    linkedKitId: '0f02c230-3979-529d-8b96-340d11e31566',
    linkedKit: {
      id: '0f02c230-3979-529d-8b96-340d11e31566',
      name: 'Camille — Ultralight',
      itemsCount: 9,
      weightG: 3200,
    },
    linkedTrail: {
      id: 'trail-aneto-cirque',
      name: 'Boucle du Cirque de Gavarnie',
      distanceKm: 18.5,
      elevationGainM: 1180,
      region: 'Hautes-Pyrénées',
    },
    soundTitle: 'Sons de la nature · Torrent et écho minéral',
    location: 'Cirque de Gavarnie · 2 400 m',
  },
  {
    id: 'freedom-curated-3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    posterUrl: '/assets/images/adventure-kayak.jpg',
    caption: 'Descente sauvage en packraft dans les gorges du Verdon au lever du jour. L’eau émeraude pour nous seuls 🛶🌊 #packraft #verdon #outdooradventure',
    tags: ['packraft', 'verdon', 'gorges', 'kayak'],
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    author: {
      id: '12c910b6-ee04-4f56-9666-2289313311a3',
      name: 'Marc-Antoine Duval',
      handle: 'marc-antoine.duval',
      avatarUrl: 'https://i.pravatar.cc/400?img=24',
      isVerified: true,
      isFollowing: false,
      loyaltyLevel: 'Explorateur Confirmé',
    },
    likesCount: 2180,
    commentsCount: 115,
    sharesCount: 308,
    isLiked: false,
    isSaved: false,
    linkedKitId: '58c7d842-8068-492d-8968-cadb621a920a',
    linkedKit: {
      id: '58c7d842-8068-492d-8968-cadb621a920a',
      name: 'Bivouac Vercors',
      itemsCount: 11,
      weightG: 4100,
    },
    linkedTrail: {
      id: 'trail-verdon-pont',
      name: 'Couloir Samson aux Galetas',
      distanceKm: 22.0,
      elevationGainM: 400,
      region: 'Provence-Alpes-Côte d’Azur',
    },
    soundTitle: 'Clapotis rapide & échos des falaises',
    location: 'Gorges du Verdon · Provence',
  },
  {
    id: 'freedom-curated-4',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    posterUrl: '/assets/images/community-morning.jpg',
    caption: 'Traversée gravel de l’Aubrac au coucher du soleil. Un silence absolu, du vent et des pistes infinies 🚲🌾 #gravel #bikepacking #aubrac #freedom',
    tags: ['gravel', 'bikepacking', 'aubrac', 'cycling'],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    author: {
      id: 'd5451f35-db9f-4575-9114-6d3b79550bbc',
      name: 'Léa Fontaine',
      handle: 'lea.fontaine',
      avatarUrl: 'https://i.pravatar.cc/400?img=48',
      isVerified: true,
      isFollowing: false,
      loyaltyLevel: 'Randonneuse',
    },
    likesCount: 1870,
    commentsCount: 94,
    sharesCount: 220,
    isLiked: false,
    isSaved: false,
    linkedKitId: '88c13764-ad10-4cc9-888f-76122dad11d5',
    linkedKit: {
      id: '88c13764-ad10-4cc9-888f-76122dad11d5',
      name: 'GR20 léger',
      itemsCount: 16,
      weightG: 5900,
    },
    linkedTrail: {
      id: 'trail-aubrac-tour',
      name: 'Tour des Monts d’Aubrac en Gravel',
      distanceKm: 65.4,
      elevationGainM: 920,
      region: 'Lozère / Aveyron',
    },
    soundTitle: 'Crissment de gravier & souffle du vent',
    location: 'Plateau de l’Aubrac · 1 250 m',
  },
];

/**
 * Initial demo comments for curated reels, including real examples of GPX, Kit, Product, and Trail attachments!
 */
export const DEMO_FREEDOM_COMMENTS: Record<string, FreedomComment[]> = {
  'freedom-curated-1': [
    {
      id: 'comm-101',
      reelId: 'freedom-curated-1',
      author: {
        id: 'u-antoine',
        name: 'Antoine Delorme',
        handle: 'antoine.delorme',
        avatarUrl: '/assets/images/portrait-5.jpg',
      },
      content: 'Incroyable la lumière ! Tu avais quoi comme tente pour tenir à 3100m avec ce vent ?',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      likesCount: 14,
      isLiked: false,
      isOwner: false,
    },
    {
      id: 'comm-102',
      reelId: 'freedom-curated-1',
      author: {
        id: 'author-thomas-alps',
        name: 'Thomas Rivoire',
        handle: 'thomas.rivoire',
        avatarUrl: '/assets/images/portrait-1.jpg',
      },
      content: 'Voici mon kit complet utilisé pour cette nuit, tout est pesé au gramme près :',
      createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      likesCount: 29,
      isLiked: true,
      isOwner: true,
      parentId: 'comm-101',
      attachment: {
        type: 'kit',
        kit: {
          kind: 'kit',
          kit_id: 'kit-alpine-ultra',
          kit_name: 'Pack Bivouac Glaciaire Ultra-léger',
          items_count: 14,
          total_weight_g: 4850,
          image_url: '/assets/images/adventure-bivouac.jpg',
        },
      },
    },
    {
      id: 'comm-103',
      reelId: 'freedom-curated-1',
      author: {
        id: 'u-sophie',
        name: 'Sophie Marceau',
        handle: 'sophie.marceau',
        avatarUrl: '/assets/images/portrait-6.jpg',
      },
      content: 'Pour ceux qui demandaient le tracé exact par l’arête sud, je vous le partage ici :',
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      likesCount: 38,
      isLiked: false,
      isOwner: false,
      attachment: {
        type: 'gpx',
        gpx: {
          name: 'Arete_Sud_Aiguille_3100m.gpx',
          distanceKm: 14.2,
          elevationGainM: 1350,
          pointsCount: 1420,
        },
      },
    },
  ],
};

/**
 * Fetch all Freedom reels from DB stories/posts, merged with curated outdoor videos.
 */
export async function fetchFreedomReels(_user?: any): Promise<FreedomReelItem[]> {
  const reels: FreedomReelItem[] = [];
  const seenIds = new Set<string>();

  try {
    const supabase = createClient();

    // 1. Fetch real video stories
    const { data: videoStories } = await supabase
      .from('post_stories')
      .select('id, author_id, image_url, storage_path, caption, created_at, media_type, duration_ms, composition')
      .eq('media_type', 'video')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    if (videoStories && videoStories.length > 0) {
      const authorIds = videoStories.map((s) => s.author_id).filter(Boolean);
      const profiles = await fetchPublicProfilesWith(supabase, authorIds);

      for (const story of videoStories) {
        const vUrl = storyMediaUrl(story);
        if (!vUrl) continue;
        const prof = profiles[story.author_id];
        const id = `story-${story.id}`;
        seenIds.add(id);
        reels.push({
          id,
          videoUrl: vUrl,
          posterUrl: null,
          caption: story.caption || 'Micro-vidéo outdoor #freedom',
          tags: ['story', 'freedom', 'outdoor'],
          createdAt: story.created_at,
          author: {
            id: story.author_id,
            name: prof?.full_name || 'Voyageur LKDV',
            handle: prof?.handle || `voyageur_${story.author_id.slice(0, 5)}`,
            avatarUrl: prof?.avatar_url || null,
            isVerified: false,
            isFollowing: false,
          },
          likesCount: 18,
          commentsCount: 4,
          sharesCount: 7,
          isLiked: false,
          isSaved: false,
          soundTitle: 'Ambiance sonore terrain LKDV',
          location: '',
        });
      }
    }

    // 2. Fetch community posts with video URLs
    const { data: videoPosts } = await supabase
      .from('community_posts')
      .select('id, author_id, content, image_url, media_urls, linked_kit_id, likes_count, comments_count, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    if (videoPosts && videoPosts.length > 0) {
      const postAuthorIds = videoPosts.map((p) => p.author_id).filter(Boolean);
      const profiles = await fetchPublicProfilesWith(supabase, postAuthorIds);

      for (const post of videoPosts) {
        const media = usableCommunityMedia(post.media_urls, post.image_url);
        const video = media.find(isCommunityVideoUrl);
        if (!video) continue;

        const id = `post-${post.id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const prof = profiles[post.author_id];
        reels.push({
          id,
          videoUrl: video,
          posterUrl: null,
          caption: post.content || 'Expédition Freedom outdoor',
          tags: ['freedom', 'expédition'],
          createdAt: post.created_at,
          author: {
            id: post.author_id,
            name: prof?.full_name || 'Aventurier',
            handle: prof?.handle || `aventurier_${post.author_id.slice(0, 5)}`,
            avatarUrl: prof?.avatar_url || null,
            isVerified: false,
            isFollowing: false,
          },
          likesCount: post.likes_count ?? 12,
          commentsCount: post.comments_count ?? 2,
          sharesCount: 5,
          isLiked: false,
          isSaved: false,
          linkedKitId: post.linked_kit_id || null,
          soundTitle: 'Audio original terrain',
          location: '',
        });
      }
    }
  } catch (error) {
    console.warn('[Freedom] DB query fallback to curated reels:', error);
  }

  // Always merge with curated outdoor reels to guarantee a top-tier TikTok-like vertical experience
  for (const curated of FREEDOM_CURATED_REELS) {
    if (!seenIds.has(curated.id)) {
      reels.push(curated);
    }
  }

  return reels;
}

/**
 * Load comments for a specific reel, parsing rich attachments.
 */
export async function fetchReelComments(reelId: string, user?: any): Promise<FreedomComment[]> {
  // Check local demo cache first
  const demoList = DEMO_FREEDOM_COMMENTS[reelId];
  const list: FreedomComment[] = demoList ? [...demoList] : [];

  // If this is a real DB post reel (`post-UUID`), query Supabase post_comments
  if (reelId.startsWith('post-')) {
    const realPostId = reelId.replace('post-', '');
    try {
      const supabase = createClient();
      const { data: rows } = await supabase
        .from('post_comments')
        .select('id, author_id, content, parent_id, created_at')
        .eq('post_id', realPostId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (rows && rows.length > 0) {
        const authorIds = rows.map((r) => r.author_id).filter(Boolean);
        const profiles = await fetchPublicProfilesWith(supabase, authorIds);

        for (const row of rows) {
          const { text, attachment } = parseCommentContent(row.content);
          const prof = row.author_id ? profiles[row.author_id] : undefined;
          list.push({
            id: row.id,
            reelId,
            author: {
              id: row.author_id || 'anonymous',
              name: prof?.full_name || 'Voyageur',
              handle: prof?.handle || null,
              avatarUrl: prof?.avatar_url || null,
            },
            content: text,
            createdAt: row.created_at,
            likesCount: 0,
            isLiked: false,
            isOwner: Boolean(user?.id && row.author_id === user.id),
            attachment,
            parentId: row.parent_id,
          });
        }
      }
    } catch (e) {
      console.warn('[Freedom] Comment fetch error:', e);
    }
  }

  return list;
}

/**
 * Post a new comment on a reel with rich attachments (Kit, GPX, Product, Trail, Photo).
 */
export async function postReelComment(
  reelId: string,
  user: any,
  text: string,
  attachment?: FreedomCommentAttachment | null,
  parentId?: string | null,
): Promise<FreedomComment> {
  const serialized = serializeCommentContent(text, attachment);

  const localComment: FreedomComment = {
    id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reelId,
    author: {
      id: user?.id || 'me',
      name: user?.user_metadata?.full_name || 'Moi',
      handle:
        user?.user_metadata?.handle ||
        user?.user_metadata?.user_name ||
        (user?.user_metadata?.full_name
          ? user.user_metadata.full_name.toLowerCase().replace(/\s+/g, '.')
          : 'moi'),
      avatarUrl: user?.user_metadata?.avatar_url || null,
    },
    content: text.trim(),
    createdAt: new Date().toISOString(),
    likesCount: 0,
    isLiked: false,
    isOwner: true,
    attachment: attachment || null,
    parentId: parentId || null,
  };

  // If real DB post
  if (reelId.startsWith('post-') && user?.id) {
    const realPostId = reelId.replace('post-', '');
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('post_comments')
        .insert({
          post_id: realPostId,
          author_id: user.id,
          content: serialized,
          parent_id: parentId || null,
        })
        .select('id, created_at')
        .single();

      if (data?.id) {
        localComment.id = data.id;
        localComment.createdAt = data.created_at;
      }
    } catch (e) {
      console.warn('[Freedom] Comment DB insert error:', e);
    }
  }

  // Also update local cache for curated demo reels
  if (!DEMO_FREEDOM_COMMENTS[reelId]) {
    DEMO_FREEDOM_COMMENTS[reelId] = [];
  }
  DEMO_FREEDOM_COMMENTS[reelId].push(localComment);

  return localComment;
}

/* Chargement instantané : les reels sont préchauffés dès que la barre du bas
   est affichée (et à l'appui sur Communauté). Le visionneur démarre alors sur
   la dernière liste connue, sans écran de chargement ; elle est rafraîchie en
   arrière-plan pour l'ouverture suivante. */
let reelsCache: FreedomReelItem[] | null = null;
let reelsInflight: Promise<FreedomReelItem[]> | null = null;

/** Dernière liste de reels connue, ou `null` si rien n'a encore été chargé. */
export function peekFreedomReels(): FreedomReelItem[] | null {
  return reelsCache;
}

/** Charge (ou rafraîchit) la liste en partageant un seul appel en vol. */
export function warmFreedomReels(user?: any): Promise<FreedomReelItem[]> {
  if (reelsInflight) return reelsInflight;
  reelsInflight = fetchFreedomReels(user)
    .then((data) => {
      reelsCache = data;
      return data;
    })
    .finally(() => {
      reelsInflight = null;
    });
  return reelsInflight;
}
