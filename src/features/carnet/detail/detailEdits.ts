/**
 * Réducteurs purs appliqués à la fiche après une écriture réussie du mode
 * modification : l'écran ne recharge pas la page, il reflète ce que la base
 * vient d'accepter (et le défait si la personne annule).
 */
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitVerdictItem,
  CarnetNightItem,
  CarnetParticipant,
} from './types';

const byDay = <T extends { dayNumber: number }>(a: T, b: T) => a.dayNumber - b.dayNumber;

export function upsertEtape(detail: CarnetDetail, etape: CarnetEtapeDay): CarnetDetail {
  const previous = detail.etapes.find((e) => e.id === etape.id);
  const merged = {
    ...etape,
    overnight:
      etape.overnight ??
      previous?.overnight ??
      detail.nights?.find((n) => n.dayNumber === etape.dayNumber)?.name ??
      null,
  };
  const etapes = previous
    ? detail.etapes.map((e) => (e.id === etape.id ? merged : e))
    : [...detail.etapes, merged];
  return { ...detail, etapes: [...etapes].sort(byDay) };
}

export function removeEtape(detail: CarnetDetail, etapeId: string): CarnetDetail {
  return { ...detail, etapes: detail.etapes.filter((e) => e.id !== etapeId) };
}

/** Une nuit par jour : écrire la nuit d'un jour remplace celle qui s'y trouvait. */
export function upsertNight(
  detail: CarnetDetail,
  night: CarnetNightItem,
  replacedId?: string
): CarnetDetail {
  const nights = (detail.nights ?? []).filter(
    (n) => n.id !== night.id && n.id !== replacedId && n.dayNumber !== night.dayNumber
  );
  nights.push(night);
  return {
    ...detail,
    nights: nights.sort(byDay),
    etapes: detail.etapes.map((e) =>
      e.dayNumber === night.dayNumber ? { ...e, overnight: night.name } : e
    ),
  };
}

export function removeNight(detail: CarnetDetail, nightId: string): CarnetDetail {
  const gone = (detail.nights ?? []).find((n) => n.id === nightId);
  return {
    ...detail,
    nights: (detail.nights ?? []).filter((n) => n.id !== nightId),
    etapes: gone
      ? detail.etapes.map((e) => (e.dayNumber === gone.dayNumber ? { ...e, overnight: null } : e))
      : detail.etapes,
  };
}

export function applyVerdict(detail: CarnetDetail, verdict: CarnetKitVerdictItem): CarnetDetail {
  const kitVerdicts = { ...(detail.kitVerdicts ?? {}) };
  if (verdict.verdict) kitVerdicts[verdict.itemId] = verdict;
  else delete kitVerdicts[verdict.itemId];
  return {
    ...detail,
    kitVerdicts,
    kit: {
      ...detail.kit,
      items: detail.kit.items.map((item) =>
        item.id === verdict.itemId
          ? {
              ...item,
              verdict: verdict.verdict,
              verdictNote: verdict.verdictNote,
              joursUtilises: verdict.joursUtilises,
            }
          : item
      ),
    },
  };
}

export function addParticipant(detail: CarnetDetail, participant: CarnetParticipant): CarnetDetail {
  if (detail.participants.some((p) => p.userId === participant.userId)) return detail;
  return { ...detail, participants: [...detail.participants, participant] };
}

export function removeParticipant(detail: CarnetDetail, userId: string): CarnetDetail {
  return { ...detail, participants: detail.participants.filter((p) => p.userId !== userId) };
}

export function updateMomentText(
  detail: CarnetDetail,
  momentId: string,
  patch: { place: string; caption: string | null }
): CarnetDetail {
  const apply = <T extends { id: string; place: string | null; caption: string | null }>(m: T): T =>
    m.id === momentId ? { ...m, place: patch.place, caption: patch.caption } : m;
  return {
    ...detail,
    moments: detail.moments.map(apply),
    photoMoments: detail.photoMoments.map(apply),
    days: detail.days.map((day) => ({ ...day, moments: day.moments.map(apply) })),
  };
}
