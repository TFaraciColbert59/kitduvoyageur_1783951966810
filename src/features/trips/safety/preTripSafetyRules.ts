import type { KitRouteContext } from '../engine/kitCompletenessEngine';

/**
 * Phase 5 — Contrôles de sécurité AVANT départ, adaptés au pays et à l'activité.
 *
 * Complément pré-trip du `SafetyEngine` temps réel : les alertes d'exécution
 * (immobilité, batterie, hors-trace, météo, nuit) restent dans
 * `src/features/hiking/safety/SafetyEngine.ts` ; ici, les contrôles sont
 * persistés dans la MÊME checklist de préparation (`trip_checklist_items`) —
 * aucun écran parallèle.
 *
 * Chaque contrôle est une RÈGLE explicite déclenchée par une donnée réelle
 * (activité, pays, durée, difficulté, D+, taille du groupe). Le libellé cite
 * la valeur déclenchante : la raison est donc vérifiable dans le contrôle
 * lui-même, sans inventer de numéro de secours ni de réglementation locale.
 */

export interface PreTripSafetyInput {
  activity?: string | null;
  countryCode?: string | null;
  durationDays?: number | null;
  partySize?: number | null;
  route?: KitRouteContext | null;
}

export interface PreTripSafetyControl {
  code: string;
  label: string;
  /** Échéance relative au départ (jours avant). */
  dueOffsetDays: number;
  reason: string;
}

function fmtInt(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

export function buildPreTripSafetyControls(
  input: PreTripSafetyInput
): PreTripSafetyControl[] {
  const activity = input.activity ?? null;
  const days =
    typeof input.durationDays === 'number' && input.durationDays > 0
      ? Math.trunc(input.durationDays)
      : null;
  const partySize = Math.max(1, Math.trunc(input.partySize ?? 1));
  const difficulty = input.route?.difficulty ?? null;
  const gain = input.route?.elevationGainM ?? null;
  const hasRoute = Boolean(input.route);
  const controls: PreTripSafetyControl[] = [];
  const push = (control: PreTripSafetyControl) => {
    if (controls.some((entry) => entry.code === control.code)) return;
    controls.push(control);
  };

  // 1. Toute sortie réelle : itinéraire communiqué.
  if (activity || hasRoute || days) {
    push({
      code: 'safety-plan-shared',
      label: `Déclarer l'itinéraire et l'heure de retour à un proche${
        days ? ` (${fmtInt(days)} jour${days > 1 ? 's' : ''})` : ''
      }`,
      dueOffsetDays: 7,
      reason: 'Règle LKDV sécurité : plan de marche transmis avant tout départ.',
    });
  }

  // 2. Plus d'une journée : point de contact régulier.
  if ((days ?? 0) >= 2) {
    push({
      code: 'safety-checkin',
      label: `Définir un point de contact quotidien sur ${fmtInt(days!)} jours`,
      dueOffsetDays: 7,
      reason: 'Règle LKDV sécurité : veille active pour les sorties de plusieurs jours.',
    });
  }

  // 3. Numéros de secours : vérification par pays réel (jamais de numéro inventé).
  if (input.countryCode) {
    push({
      code: 'safety-rescue-contacts',
      label: `Vérifier les numéros de secours locaux du pays ${input.countryCode} avant le départ`,
      dueOffsetDays: 7,
      reason: `Donnée du voyage : destination ${input.countryCode} — les coordonnées de secours doivent être vérifiées à la source officielle.`,
    });
  }

  // 4. Parcours réel : conditions météo à 72 h.
  if (hasRoute) {
    push({
      code: 'safety-weather-window',
      label: 'Vérifier la météo à 72 h et la veille du départ',
      dueOffsetDays: 3,
      reason: 'Règle LKDV sécurité : fenêtre météo revue à J-3 sur le parcours sélectionné.',
    });
  }

  // 5. Trekking / bivouac : partage de trace + autonomie.
  if (activity === 'trekking' || activity === 'bivouac') {
    push({
      code: 'safety-track-shared',
      label: 'Partager la trace GPX du parcours avec le groupe et un contact',
      dueOffsetDays: 7,
      reason: `Donnée du voyage : activité « ${activity} » en autonomie.`,
    });
  }

  // 6. Difficulté réelle du parcours : repérage des passages techniques.
  if (difficulty === 'hard' || difficulty === 'expert') {
    push({
      code: 'safety-technical-sections',
      label: `Repérer les passages techniques du parcours (difficulté ${difficulty})`,
      dueOffsetDays: 14,
      reason: `Donnée du parcours retenu : difficulté ${difficulty}.`,
    });
  }

  // 7. D+ réel élevé : gestion de l'eau et de l'effort.
  if (typeof gain === 'number' && gain >= 1000) {
    push({
      code: 'safety-water-effort',
      label: `Planifier les points d'eau et l'effort réel (D+ ${fmtInt(gain)} m)`,
      dueOffsetDays: 7,
      reason: `Donnée du parcours retenu : D+ ${fmtInt(gain)} m.`,
    });
  }

  // 8. Pays à terrain froid documenté par la règle produit : neige/glace.
  if (input.countryCode === 'IS' || input.countryCode === 'NP' || input.countryCode === 'CH') {
    push({
      code: 'safety-snow-ice',
      label: `Vérifier les conditions neige/glace du pays ${input.countryCode} à la date de départ`,
      dueOffsetDays: 7,
      reason: `Règle LKDV terrain froid : destination ${input.countryCode} (névés/glace possibles).`,
    });
  }

  // 9. Groupe : coordination explicite dès 4 personnes.
  if (partySize >= 4) {
    push({
      code: 'safety-group-coordination',
      label: `Désigner un co-organisateur et un point de rassemblement (${fmtInt(partySize)} personnes)`,
      dueOffsetDays: 7,
      reason: `Donnée du brief : groupe de ${fmtInt(partySize)} personnes.`,
    });
  }

  return controls;
}
