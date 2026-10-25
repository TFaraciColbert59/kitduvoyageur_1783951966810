/**
 * H5.4 — Suggestion d'aventure (surcouche IA déterministe, repli inclus).
 *
 * Fonction PURE : mêmes entrées → même sortie (R5 : zéro non-déterminisme,
 * testé SUG-8). Elle SUGGÈRE le contexte par défaut mais ne restreint jamais
 * la liste (le switcher affiche toujours les 3 natures).
 * Un futur appel LLM serveur pourra RÉORDONNER/ reformuler `reason` — jamais
 * décider à la place de ces règles (l'IA explique, les règles décident).
 */

export interface SuggestTrip {
  id: string;
  slug: string;
  title: string;
  start_date?: string | null;
}

export interface SuggestGroup {
  id: string;
  name: string;
  member_count: number;
}

export interface SuggestLists {
  trips: SuggestTrip[];
  groups: SuggestGroup[];
  possession: { itemsCount: number; loansCount: number; alertsCount: number };
  pendingInvites: number;
}

export interface AdventureSuggestion {
  /** Clé stable (adventureKey) — résolue par le contexte en aventure. */
  key: string;
  reason: string;
}

function daysUntil(dateStr: string | null | undefined, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / 86400000);
}

export function suggestActiveAdventure(lists: SuggestLists, now: Date): AdventureSuggestion {
  const nowMs = now.getTime();

  // Règle 1 : voyage imminent (0–7 j, le plus proche).
  const upcoming = lists.trips
    .map((t) => ({ trip: t, inDays: daysUntil(t.start_date, nowMs) }))
    .filter((x): x is { trip: SuggestTrip; inDays: number } => x.inDays !== null && x.inDays >= 0 && x.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays)[0];
  if (upcoming) {
    return {
      key: `sortie:${upcoming.trip.slug}`,
      reason: `suggéré : départ dans ${upcoming.inDays} j (J-${upcoming.inDays}) — « ${upcoming.trip.title} »`,
    };
  }

  // Règle 2 : invitations en attente (1er groupe).
  if (lists.pendingInvites > 0 && lists.groups.length > 0) {
    const g = lists.groups[0];
    return {
      key: `collectif:${g.id}`,
      reason: `suggéré : ${lists.pendingInvites} invitation(s) en attente — « ${g.name} »`,
    };
  }

  // Règle 3 : alertes matériel (possession).
  if (lists.possession.alertsCount > 0) {
    return {
      key: 'possession',
      reason: `suggéré : ${lists.possession.alertsCount} alerte(s) matériel à traiter`,
    };
  }

  // Règle 4 : voyage le plus récent (start_date max).
  const recent = [...lists.trips]
    .filter((t) => t.start_date)
    .sort((a, b) => (b.start_date as string).localeCompare(a.start_date as string))[0];
  if (recent) {
    return {
      key: `sortie:${recent.slug}`,
      reason: `suggéré : voyage le plus récent — « ${recent.title} »`,
    };
  }

  // Règle 5 : défaut possession (toujours disponible).
  return { key: 'possession', reason: 'suggéré par défaut : le matériel est toujours disponible' };
}
