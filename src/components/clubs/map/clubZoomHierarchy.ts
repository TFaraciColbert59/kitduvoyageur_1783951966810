import { haversineM, type LngLat } from '@/features/explorer-v2/geo/track';
import {
  buildSlopeGradient,
  slopeGradientExpression,
  summarizeSlope,
  type SlopeProfilePoint,
  type SlopeSummary,
} from '@/features/explorer-v2/map/slope';
import type {
  ClubMapOutingTrack,
  ClubMapSelection,
  ClubRichMapPayload,
  ClubTrackCoord,
  ClubZoomStage,
} from './clubMapTypes';
import { snapPointAlongTrack } from './clubTrackGeometry';

export const CLUB_ZOOM_THRESHOLDS = {
  planetaryMax: 4.2,
  countryMax: 7.5,
  massifMax: 11.8,
  globeSwitch: 5.5,
} as const;

export interface ClubZoomStageConfig {
  stage: ClubZoomStage;
  showCountryPill: boolean;
  showCountryTint: boolean;
  showMassifCapsules: boolean;
  showMassifSilhouettes: boolean;
  showTracks3D: boolean;
  showUpcomingBadges: boolean;
  showLiveMembers: boolean;
  showPostClusters: boolean;
  showActiveSlope: boolean;
  showStoryBloom: boolean;
  dimInactiveTracksOpacity: number;
}

export function resolveClubZoomStage(
  zoom: number,
  selection?: ClubMapSelection | null,
): ClubZoomStage {
  if (
    selection &&
    (selection.kind === 'outing' || selection.kind === 'pokedex' || selection.kind === 'kit')
  ) {
    return 'trail';
  }
  const safeZoom = Number.isFinite(zoom) ? zoom : 6;
  if (safeZoom < CLUB_ZOOM_THRESHOLDS.planetaryMax) return 'planetary';
  if (safeZoom < CLUB_ZOOM_THRESHOLDS.countryMax) return 'country';
  if (safeZoom < CLUB_ZOOM_THRESHOLDS.massifMax) return 'massif';
  return 'trail';
}

export function getClubStageConfig(
  stage: ClubZoomStage,
  hasActiveOuting: boolean,
): ClubZoomStageConfig {
  // Architecture épurée "Tracés-first" : zéro capsules massifs empilées, zéro badges parasites.
  // Les tracés des sorties sont affichés directement à toutes les échelles et réagissent au clic.
  switch (stage) {
    case 'planetary':
      return {
        stage,
        showCountryPill: false,
        showCountryTint: false,
        showMassifCapsules: false,
        showMassifSilhouettes: false,
        showTracks3D: true,
        showUpcomingBadges: false,
        showLiveMembers: false,
        showPostClusters: false,
        showActiveSlope: hasActiveOuting,
        showStoryBloom: false,
        dimInactiveTracksOpacity: hasActiveOuting ? 0.18 : 0.88,
      };
    case 'country':
      return {
        stage,
        showCountryPill: false,
        showCountryTint: false,
        showMassifCapsules: false,
        showMassifSilhouettes: false,
        showTracks3D: true,
        showUpcomingBadges: false,
        showLiveMembers: false,
        showPostClusters: false,
        showActiveSlope: hasActiveOuting,
        showStoryBloom: hasActiveOuting,
        dimInactiveTracksOpacity: hasActiveOuting ? 0.18 : 0.92,
      };
    case 'massif':
      return {
        stage,
        showCountryPill: false,
        showCountryTint: false,
        showMassifCapsules: false,
        showMassifSilhouettes: false,
        showTracks3D: true,
        showUpcomingBadges: false,
        showLiveMembers: true,
        showPostClusters: false,
        showActiveSlope: hasActiveOuting,
        showStoryBloom: hasActiveOuting,
        dimInactiveTracksOpacity: hasActiveOuting ? 0.18 : 0.94,
      };
    case 'trail':
      return {
        stage,
        showCountryPill: false,
        showCountryTint: false,
        showMassifCapsules: false,
        showMassifSilhouettes: false,
        showTracks3D: true,
        showUpcomingBadges: false,
        showLiveMembers: true,
        showPostClusters: false,
        showActiveSlope: hasActiveOuting,
        showStoryBloom: hasActiveOuting,
        dimInactiveTracksOpacity: hasActiveOuting ? 0.16 : 0.96,
      };
  }
}

export function filterRichPayloadByPole(
  payload: ClubRichMapPayload,
  activePoleId?: string | null,
): ClubRichMapPayload {
  if (!activePoleId) return payload;
  const outings = payload.outings.filter(
    (o) => !o.poleId || o.poleId === activePoleId,
  );
  const outingIds = new Set(outings.map((o) => o.id));
  const posts = payload.posts.filter(
    (p) =>
      p.poleId === activePoleId ||
      (!p.poleId && (!p.outingId || outingIds.has(p.outingId))),
  );
  const massifCounts = new Map<string, { outings: number; posts: number }>();
  for (const o of outings) {
    const cur = massifCounts.get(o.massifId) ?? { outings: 0, posts: 0 };
    cur.outings += 1;
    massifCounts.set(o.massifId, cur);
  }
  for (const p of posts) {
    const cur = massifCounts.get(p.massifId) ?? { outings: 0, posts: 0 };
    cur.posts += 1;
    massifCounts.set(p.massifId, cur);
  }
  const massifs = payload.massifs
    .map((m) => {
      const c = massifCounts.get(m.id);
      return {
        ...m,
        outings: c?.outings ?? 0,
        postsCount: c?.posts ?? 0,
      };
    })
    .filter((m) => m.outings > 0 || m.postsCount > 0);

  return {
    ...payload,
    outings,
    posts,
    pokedex: payload.pokedex.filter((px) => outingIds.has(px.outingId)),
    kits: payload.kits.filter((k) => !k.outingId || outingIds.has(k.outingId)),
    massifs: massifs.length > 0 ? massifs : payload.massifs,
  };
}

/**
 * Enveloppe polygonale simplifiée pour le pays/arc alpin (vue planétaire / pays).
 */
export function buildCountryAreaGeoJSON(payload: ClubRichMapPayload) {
  const pts: Array<[number, number]> = payload.massifs.map((m) => m.center);
  if (pts.length === 0) pts.push(payload.center);
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of pts) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  const cLng = (minLng + maxLng) / 2;
  const cLat = (minLat + maxLat) / 2;
  const rx = Math.max(2.2, (maxLng - minLng) * 0.85 + 1.8);
  const ry = Math.max(1.8, (maxLat - minLat) * 0.85 + 1.4);

  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= 32; i += 1) {
    const a = (i / 32) * Math.PI * 2;
    const wobble = 1 + 0.08 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5);
    ring.push([
      Number((cLng + Math.cos(a) * rx * wobble).toFixed(4)),
      Number((cLat + Math.sin(a) * ry * wobble * 0.78).toFixed(4)),
    ]);
  }

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          code: payload.countrySummary.code,
          name: payload.countrySummary.name,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ring],
        },
      },
    ],
  };
}

/**
 * Silhouettes régionales simplifiées pour les massifs à l'échelle Pays (4.2 <= z < 7.5).
 */
export function buildMassifSilhouettesGeoJSON(payload: ClubRichMapPayload) {
  const features = payload.massifs.map((massif, idx) => {
    const outingsInMassif = payload.outings.filter((o) => o.massifId === massif.id);
    const radiusLng = Math.min(0.32, Math.max(0.11, 0.09 + outingsInMassif.length * 0.012));
    const radiusLat = radiusLng * 0.72;
    const ring: Array<[number, number]> = [];
    for (let i = 0; i <= 20; i += 1) {
      const a = (i / 20) * Math.PI * 2;
      const ridge = 0.86 + 0.18 * Math.sin(a * 4 + idx) + 0.1 * Math.cos(a * 3 - idx);
      ring.push([
        Number((massif.center[0] + Math.cos(a) * radiusLng * ridge).toFixed(4)),
        Number((massif.center[1] + Math.sin(a) * radiusLat * ridge).toFixed(4)),
      ]);
    }
    return {
      type: 'Feature' as const,
      properties: {
        id: massif.id,
        name: massif.name,
        outings: massif.outings,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features,
  };
}

function daysUntilIso(startsAtIso: string): number | null {
  const ts = Date.parse(startsAtIso);
  if (!Number.isFinite(ts)) return null;
  const diffDays = Math.ceil((ts - Date.now()) / 86_400_000);
  return Math.max(0, diffDays);
}

export function buildOutingTracksGeoJSON(
  outings: ClubMapOutingTrack[],
  activeOutingId?: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: outings
      .filter((o) => o.coords.length >= 2)
      .map((o) => ({
        type: 'Feature' as const,
        properties: {
          id: o.id,
          title: o.title,
          status: o.status,
          isActive: activeOutingId ? o.id === activeOutingId : false,
          massifId: o.massifId,
          poleId: o.poleId ?? '',
          km: o.km,
          dplus: o.dplus,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: o.coords.map(([lng, lat]) => [lng, lat]),
        },
      })),
  };
}

export function buildUpcomingBadgesGeoJSON(outings: ClubMapOutingTrack[]) {
  return {
    type: 'FeatureCollection' as const,
    features: outings
      .filter((o) => o.status === 'upcoming')
      .map((o) => {
        const d = daysUntilIso(o.startsAtIso);
        const label = d !== null ? (d === 0 ? 'J-0' : `J-${d}`) : 'À venir';
        return {
          type: 'Feature' as const,
          properties: {
            id: o.id,
            title: o.title,
            badge: label,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: o.start,
          },
        };
      }),
  };
}

export function buildPostsClusterGeoJSON(posts: ClubRichMapPayload['posts']) {
  return {
    type: 'FeatureCollection' as const,
    features: posts
      .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
      .map((p) => ({
        type: 'Feature' as const,
        properties: {
          id: p.id,
          outingId: p.outingId ?? '',
          massifId: p.massifId,
          spot: p.spot,
          likes: p.likes,
          authorName: p.authorName,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lng, p.lat],
        },
      })),
  };
}

export interface ActiveSlopeResult {
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: { id: string };
      geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
    }>;
  };
  gradientExpression: unknown;
  summary: SlopeSummary | null;
  profilePoints: SlopeProfilePoint[];
  totalDistanceM: number;
}

/**
 * Construit la source mono-feature `club-active-slope` (`lineMetrics: true`) et
 * le dégradé de pente réelle via `src/features/explorer-v2/map/slope.ts`.
 */
export function buildActiveSlopeData(outing: ClubMapOutingTrack): ActiveSlopeResult {
  const coords = outing.coords;
  if (coords.length < 2) {
    return {
      geojson: { type: 'FeatureCollection', features: [] },
      gradientExpression: null,
      summary: null,
      profilePoints: [],
      totalDistanceM: 0,
    };
  }

  const lineCoords: Array<[number, number]> = [];
  const profilePoints: SlopeProfilePoint[] = [];
  let cumulative = 0;

  for (let i = 0; i < coords.length; i += 1) {
    const pt = coords[i];
    const lngLat: LngLat = [pt[0], pt[1]];
    lineCoords.push([pt[0], pt[1]]);
    if (i > 0) {
      const prev = coords[i - 1];
      const seg = haversineM([prev[0], prev[1]], lngLat);
      if (Number.isFinite(seg)) cumulative += seg;
    }
    const ele = typeof pt[2] === 'number' && Number.isFinite(pt[2]) ? pt[2] : null;
    profilePoints.push({ d: cumulative, ele });
  }

  const totalDistanceM = cumulative > 0 ? cumulative : Math.max(100, outing.km * 1000);
  const stops = buildSlopeGradient(profilePoints, totalDistanceM);
  const gradientExpression = slopeGradientExpression(stops);
  const summary = summarizeSlope(profilePoints, totalDistanceM);

  return {
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: outing.id },
          geometry: {
            type: 'LineString',
            coordinates: lineCoords,
          },
        },
      ],
    },
    gradientExpression,
    summary,
    profilePoints,
    totalDistanceM,
  };
}

export type StoryBloomKind = 'pokedex' | 'kit' | 'post' | 'story' | 'member' | 'summit';

export interface StoryBloomItem {
  id: string;
  sourceId: string;
  kind: StoryBloomKind;
  outingId: string;
  memberHandle?: string;
  title: string;
  subtitle: string;
  emoji: string;
  lng: number;
  lat: number;
  ele: number;
  trackProgress: number;
  color: string;
  staggerMs: number;
  mediaUrl?: string | null;
  storyIds?: string[];
  clusterCount?: number;
}

export const STORY_BLOOM_COLORS: Record<StoryBloomKind, string> = {
  pokedex: '#e09f3e',
  kit: '#2d8a5b',
  post: '#38bdf8',
  story: '#17402c',
  member: '#e06d53',
  summit: '#f5c451',
};

function nearestTrackProgress(coords: ClubTrackCoord[], lng: number, lat: number): number {
  if (coords.length <= 1) return 0.5;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i += 1) {
    const d = Math.hypot(coords[i][0] - lng, coords[i][1] - lat);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx / (coords.length - 1);
}

/**
 * Rassemble en cascade (`stagger: 55ms`) tous les éléments réellement vécus
 * sur la sortie sélectionnée : Pokédex, Kits, Posts, Cordée, Sommet.
 */
export function computeStoryBloomItems(
  payload: ClubRichMapPayload,
  outing: ClubMapOutingTrack,
): StoryBloomItem[] {
  const raw: Array<Omit<StoryBloomItem, 'staggerMs'>> = [];

  for (const pkx of payload.pokedex.filter((item) => item.outingId === outing.id)) {
    const snapped = snapPointAlongTrack(outing.coords, pkx.trackProgress);
    const hasCoords = Number.isFinite(pkx.lng) && Number.isFinite(pkx.lat);
    raw.push({
      id: `bloom-pokedex-${pkx.id}`,
      sourceId: pkx.id,
      kind: 'pokedex',
      outingId: outing.id,
      title: pkx.commonName,
      subtitle: pkx.observerName
        ? `Observé par ${pkx.observerName}${pkx.confidence ? ` · ${pkx.confidence}` : ''}`
        : 'Observation faune',
      emoji: '🐾',
      lng: hasCoords ? pkx.lng : snapped[0],
      lat: hasCoords ? pkx.lat : snapped[1],
      ele: snapped[2] || outing.maxAlt * 0.8,
      trackProgress: pkx.trackProgress,
      color: STORY_BLOOM_COLORS.pokedex,
    });
  }

  for (const kit of payload.kits.filter((item) => item.outingId === outing.id)) {
    const snapped = snapPointAlongTrack(outing.coords, kit.trackProgress);
    const hasCoords = Number.isFinite(kit.lng) && Number.isFinite(kit.lat);
    raw.push({
      id: `bloom-kit-${kit.id}`,
      sourceId: kit.id,
      kind: 'kit',
      outingId: outing.id,
      title: kit.title,
      subtitle: `${(kit.totalWeightG / 1000).toFixed(1)} kg · ${kit.itemsCount} objets (${kit.season})`,
      emoji: '🎒',
      lng: hasCoords ? kit.lng : snapped[0],
      lat: hasCoords ? kit.lat : snapped[1],
      ele: snapped[2] || outing.maxAlt * 0.65,
      trackProgress: kit.trackProgress,
      color: STORY_BLOOM_COLORS.kit,
    });
  }

  const directPosts = payload.posts.filter((p) => p.outingId === outing.id).slice(0, 3);
  for (const post of directPosts) {
    const progress =
      typeof post.trackProgress === 'number'
        ? post.trackProgress
        : nearestTrackProgress(outing.coords, post.lng, post.lat);
    const snapped = snapPointAlongTrack(outing.coords, progress);
    raw.push({
      id: `bloom-post-${post.id}`,
      sourceId: post.id,
      kind: 'post',
      outingId: outing.id,
      title: post.spot || post.authorName,
      subtitle: post.caption.slice(0, 68),
      emoji: '📸',
      lng: post.lng,
      lat: post.lat,
      ele: snapped[2] || outing.maxAlt * 0.72,
      trackProgress: progress,
      color: STORY_BLOOM_COLORS.post,
      mediaUrl: post.mediaUrl,
    });
  }

  // Stories réelles du club sur le tracé — regroupées automatiquement en grappes compactes
  // lorsqu'elles sont proches ou nombreuses (<= 2 pastilles compactes par tracé).
  const outingStories = (payload.stories ?? [])
    .filter((s) => s.outingId === outing.id)
    .sort((a, b) => a.trackProgress - b.trackProgress);
  if (outingStories.length > 0) {
    const clusters: Array<typeof outingStories> = [];
    for (const st of outingStories) {
      const last = clusters[clusters.length - 1];
      const lastRef = last?.[last.length - 1];
      if (last && lastRef && (Math.abs(st.trackProgress - lastRef.trackProgress) <= 0.24 || clusters.length >= 2)) {
        last.push(st);
      } else {
        clusters.push([st]);
      }
    }
    for (let cIdx = 0; cIdx < clusters.length; cIdx += 1) {
      const group = clusters[cIdx];
      const lead = group[0];
      const avgProg =
        group.reduce((acc, s) => acc + s.trackProgress, 0) / Math.max(1, group.length);
      const snapped = snapPointAlongTrack(outing.coords, avgProg);
      const authorsLabel = Array.from(new Set(group.map((g) => g.authorName))).slice(0, 2).join(', ');
      raw.push({
        id: `bloom-story-${outing.id}-${cIdx}`,
        sourceId: lead.id,
        kind: 'story',
        outingId: outing.id,
        title: group.length > 1 ? `${group.length} stories` : lead.spot || lead.authorName.split(' ')[0],
        subtitle:
          group.length > 1
            ? `${group.length} stories par ${authorsLabel}`
            : `Story par ${lead.authorName}`,
        emoji: '✨',
        lng: Number.isFinite(lead.lng) && group.length === 1 ? lead.lng : snapped[0],
        lat: Number.isFinite(lead.lat) && group.length === 1 ? lead.lat : snapped[1],
        ele: snapped[2] || outing.maxAlt * 0.74,
        trackProgress: avgProg,
        color: STORY_BLOOM_COLORS.story,
        mediaUrl: lead.imageUrl,
        storyIds: group.map((g) => g.id),
        clusterCount: group.length,
      });
    }
  }

  // Chef de cordée & membres en partage live à proximité (< 18 km)
  let addedLiveMember = false;
  for (const member of payload.liveMembers) {
    const dist = haversineM([member.lng, member.lat], outing.start);
    if (Number.isFinite(dist) && dist <= 18_000) {
      addedLiveMember = true;
      const progress = nearestTrackProgress(outing.coords, member.lng, member.lat);
      const snapped = snapPointAlongTrack(outing.coords, progress);
      raw.push({
        id: `bloom-member-${member.id}`,
        sourceId: member.id,
        memberHandle: member.handle,
        kind: 'member',
        outingId: outing.id,
        title: member.name,
        subtitle: `${member.role} · En partage live`,
        emoji: '🧗',
        lng: member.lng,
        lat: member.lat,
        ele: snapped[2] || outing.maxAlt * 0.55,
        trackProgress: progress,
        color: STORY_BLOOM_COLORS.member,
        mediaUrl: member.avatarUrl,
      });
    }
  }

  if (
    !addedLiveMember &&
    outing.leaderName &&
    outing.leaderName.trim().toLowerCase() !== payload.clubName.trim().toLowerCase()
  ) {
    const cordeePt = snapPointAlongTrack(outing.coords, 0.06);
    raw.push({
      id: `bloom-leader-${outing.id}`,
      sourceId: outing.leaderId || outing.leaderHandle || outing.id,
      memberHandle: outing.leaderHandle,
      kind: 'member',
      outingId: outing.id,
      title: outing.leaderName,
      subtitle: `Chef de cordée · ${outing.participantsCount} participant(s)`,
      emoji: '🧗',
      lng: cordeePt[0],
      lat: cordeePt[1],
      ele: cordeePt[2],
      trackProgress: 0.06,
      color: STORY_BLOOM_COLORS.member,
    });
  }

  // Sommet / point culminant (icône + altitude uniquement, sans libellé)
  const peak = outing.peak;
  const peakAltM = Math.round(peak[2] || outing.maxAlt);
  raw.push({
    id: `bloom-summit-${outing.id}`,
    sourceId: outing.id,
    kind: 'summit',
    outingId: outing.id,
    title: `${peakAltM} m`,
    subtitle: `${outing.massif} · +${outing.dplus} m D+`,
    emoji: '🏔️',
    lng: peak[0],
    lat: peak[1],
    ele: peak[2] || outing.maxAlt,
    trackProgress: 0.5,
    color: '#17402c',
  });

  raw.sort((a, b) => a.trackProgress - b.trackProgress);

  // Écarte légèrement sur la trace les points trop proches pour éviter toute superposition
  const minProgressGap = raw.length > 8 ? 0.065 : 0.085;
  let lastProgress = -1;
  return raw.slice(0, 10).map((item, idx) => {
    let adjustedProgress = item.trackProgress;
    if (item.kind !== 'summit' && lastProgress >= 0 && adjustedProgress - lastProgress < minProgressGap) {
      adjustedProgress = Math.min(0.96, lastProgress + minProgressGap);
      const resnapped = snapPointAlongTrack(outing.coords, adjustedProgress);
      lastProgress = adjustedProgress;
      return {
        ...item,
        lng: resnapped[0],
        lat: resnapped[1],
        ele: resnapped[2] || item.ele,
        trackProgress: adjustedProgress,
        staggerMs: idx * 45,
      };
    }
    lastProgress = adjustedProgress;
    return {
      ...item,
      staggerMs: idx * 45,
    };
  });
}
