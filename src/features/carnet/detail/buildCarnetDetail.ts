import { buildDays, buildSummary, toMomentItems } from './days';
import { formatDateRange, formatElevation, formatKm, toNumber } from './format';
import { buildCarnetPlace } from './place';
import type {
  BuildCarnetDetailInput,
  CarnetEtapeDay,
  CarnetDetail,
  CarnetMomentItem,
  CarnetParticipant,
  CarnetStatItem,
} from './types';

const UNTITLED = 'Carnet sans titre';

function buildAuthor(input: BuildCarnetDetailInput) {
  const { author, carnet } = input;
  if (!author) return null;
  return {
    id: author.id,
    name: author.full_name?.trim() || author.handle?.trim() || 'Auteur non renseigné',
    handle: author.handle ?? null,
    avatarUrl: author.avatar_url ?? null,
    trustScore: toNumber(author.trust_score) ?? 0,
  };
}

/**
 * Participants du carnet : l'auteur d'abord (`role: 'author'`), puis les
 * collaborateurs, puis les présents des sorties. Dédoublonné par `userId` :
 * la première occurrence gagne, donc l'auteur garde toujours son rôle et sa
 * position. Aucun liker n'entre ici. Un profil public absent laisse `name` à
 * `null` mais conserve la ligne (initiale du handle à l'affichage).
 */
export function buildParticipants(input: BuildCarnetDetailInput): CarnetParticipant[] {
  const byId = new Map<string, CarnetParticipant>();
  const push = (participant: CarnetParticipant | null) => {
    if (!participant?.userId || byId.has(participant.userId)) return;
    byId.set(participant.userId, participant);
  };

  const authorId = input.author?.id ?? input.carnet.author_id ?? null;
  if (authorId) {
    push({
      userId: authorId,
      name: input.author?.full_name?.trim() || input.author?.handle?.trim() || null,
      handle: input.author?.handle ?? null,
      avatarUrl: input.author?.avatar_url ?? null,
      role: 'author',
    });
  }

  for (const row of input.participants ?? []) {
    if (!row.user_id) continue;
    push({
      userId: row.user_id,
      name: row.profile?.full_name?.trim() || row.profile?.handle?.trim() || null,
      handle: row.profile?.handle ?? null,
      avatarUrl: row.profile?.avatar_url ?? null,
      role: row.source,
    });
  }

  return [...byId.values()];
}

function buildEtapes(input: BuildCarnetDetailInput): CarnetEtapeDay[] {
  const overnightByDay = new Map<number, string>();
  for (const h of input.hebergements) {
    const day = h.apres_jour_numero;
    if (day && h.nom) overnightByDay.set(day, h.nom);
  }

  if (input.etapes.length > 0) {
    return input.etapes.map((e) => {
      const dayNumber = e.jour_numero ?? e.ordre ?? 1;
      const dateLabel = e.date_etape
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
            new Date(`${e.date_etape}T12:00:00Z`),
          )
        : null;
      return {
        id: e.id,
        dayNumber,
        label: dateLabel ? `JOUR ${dayNumber} · ${dateLabel}` : `JOUR ${dayNumber}`,
        from: e.lieu_depart?.trim() || null,
        to: e.lieu_arrivee?.trim() || null,
        note: e.recit?.trim() || null,
        distanceKm: toNumber(e.distance_km),
        elevationM: toNumber(e.denivele_m),
        durationText: e.duree_texte?.trim() || null,
        weather:
          [e.meteo?.trim(), e.temperature_c !== null && e.temperature_c !== undefined ? `${e.temperature_c} °C` : null]
            .filter(Boolean)
            .join(' · ') || null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
  }

  // Pas d'étapes : les moments donnent les journées, sans récit inventé
  // et sans répartition des totaux (l'ancienne fiche divisait distance et D+).
  const byDay = new Map<number, CarnetMomentItem[]>();
  for (const moment of toMomentItems(input.moments)) {
    const list = byDay.get(moment.dayNumber) ?? [];
    list.push(moment);
    byDay.set(moment.dayNumber, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, list]) => {
      const places = list.map((m) => m.place).filter((p): p is string => Boolean(p));
      return {
        id: `moment-day-${dayNumber}`,
        dayNumber,
        label: `JOUR ${dayNumber}`,
        from: places[0] ?? null,
        to: places.length > 1 ? places[places.length - 1] : null,
        note: null,
        distanceKm: null,
        elevationM: null,
        durationText: null,
        weather: null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
}

export function buildCarnetDetail(input: BuildCarnetDetailInput): CarnetDetail {
  const { carnet, hikeSession } = input;
  const distanceKm = toNumber(hikeSession?.distance_km) ?? toNumber(carnet.distance_km);
  const elevationM = toNumber(hikeSession?.elevation_gain_m) ?? toNumber(carnet.denivele_m);
  const moments = toMomentItems(input.moments);
  const etapes = buildEtapes(input);

  /* Jours dérivés : les moments nomment leur jour, les points GPS des sorties
     datent le leur. Aucune valeur n'est inventée quand une source manque. */
  const sessions = input.sessions ?? (hikeSession ? [hikeSession] : []);
  const days = buildDays({ moments: input.moments, sessions, startDate: carnet.start_date ?? null });
  const summary = buildSummary(days);

  const stats: CarnetStatItem[] = [];
  const distanceLabel = formatKm(distanceKm);
  if (distanceLabel) stats.push({ key: 'distance', label: 'DISTANCE', value: distanceLabel });
  const elevationLabel = formatElevation(elevationM);
  if (elevationLabel) stats.push({ key: 'elevation', label: 'DÉNIVELÉ +', value: elevationLabel });
  if (etapes.length > 0) stats.push({ key: 'days', label: 'JOURS', value: String(etapes.length) });

  const kitWeight = input.kitItems.reduce<number | null>((total, item) => {
    const grams = toNumber(item.poids_g);
    if (grams === null || grams <= 0) return total;
    return (total ?? 0) + grams;
  }, null);

  /* La trace affichée est celle de la sortie la plus récente qui en porte une
     (`pickCarnetTrace`), pas forcément celle qui donne les statistiques. */
  const trace = input.trace ?? hikeSession?.positions_geojson ?? null;

  return {
    id: carnet.id,
    title: carnet.title?.trim() || carnet.destination?.trim() || UNTITLED,
    destination: carnet.destination?.trim() || null,
    description: carnet.description?.trim() || null,
    coverImage: carnet.cover_image?.trim() || null,
    coverImageAlt: carnet.cover_image_alt?.trim() || null,
    startDate: carnet.start_date ?? null,
    endDate: carnet.end_date ?? null,
    dateRange: formatDateRange(carnet.start_date, carnet.end_date),
    visibility: carnet.visibility ?? 'public',
    isPublic: (carnet.visibility ?? 'public') === 'public',
    verified: carnet.verified === true,
    isOwner: Boolean(input.viewerId && carnet.author_id && input.viewerId === carnet.author_id),
    author: buildAuthor(input),
    participants: buildParticipants(input),
    stats,
    engagement: {
      likes: input.counts?.likes ?? toNumber(carnet.likes_count) ?? 0,
      comments: input.counts?.comments ?? toNumber(carnet.comments_count) ?? 0,
      liked: input.liked,
      favorited: input.favorited,
    },
    likers: (input.likers ?? []).map((liker) => ({
      id: liker.user_id,
      name: liker.profile?.full_name?.trim() || liker.profile?.handle?.trim() || 'Auteur',
      handle: liker.profile?.handle ?? null,
      avatarUrl: liker.profile?.avatar_url ?? null,
      reaction: liker.reaction ?? 'like',
    })),
    moments,
    photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
    days,
    etapes,
    summary,
    kit: {
      totalWeightG: kitWeight,
      items: input.kitItems.map((k) => ({
        id: k.id,
        name: k.nom?.trim() || 'Élément sans nom',
        detail: k.detail?.trim() || null,
        weightG: toNumber(k.poids_g),
        color: k.couleur_tag ?? null,
      })),
    },
    trace,
    place: buildCarnetPlace(carnet, trace),
    distanceKm,
    elevationM,
  };
}
