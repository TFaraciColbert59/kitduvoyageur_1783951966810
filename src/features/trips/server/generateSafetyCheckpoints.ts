import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { addCivilDays, getCivilDurationDays, parseCivilDate } from '@/lib/dates/tripDates';
import { buildPreTripSafetyControls } from '../safety/preTripSafetyRules';

/**
 * Task 12 — Points de contrôle sécurité d'un voyage, générés depuis les règles
 * réelles `preTripSafetyRules` et les dates réelles du voyage.
 *
 * Calendrier (heures civiles, sérialisées en ISO UTC) :
 *   • J-1 18:00 — vérifications de la veille (contrôles terrain réels) ;
 *   • J1 08:00 — départ, itinéraire déclaré ;
 *   • quotidien 20:00 — point de contact (jours 1 à N-1) ;
 *   • dernier jour 18:00 — fin de sortie, retour confirmé.
 *
 * Règle dure : sans date de départ réelle, AUCUN point n'est créé (jamais de
 * date inventée) — un avertissement explicite est retourné.
 */

export interface GenerateSafetyCheckpointsInput {
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  activity: string;
  difficulty: string | null;
  countryCode: string | null;
  partySize: number;
}

export interface GenerateSafetyCheckpointsResult {
  created: number;
  warnings: string[];
}

export interface SafetyCheckpointDraft {
  label: string;
  scheduledAt: string;
  notes: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LABEL_LENGTH = 160;
/** Borne dure d'écriture (un point de contact par jour reste raisonnable). */
export const MAX_SAFETY_CHECKPOINT_DAYS = 60;

function clampLabel(label: string): string {
  const clean = label.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_LABEL_LENGTH ? `${clean.slice(0, MAX_LABEL_LENGTH - 1)}…` : clean;
}

/** `YYYY-MM-DD` + heure civile → ISO UTC déterministe (`…T18:00:00.000Z`). */
function atCivilTime(dateIso: string, hours: number): string {
  const parsed = parseCivilDate(dateIso);
  if (!parsed) return '';
  return new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day, hours, 0, 0)
  ).toISOString();
}

/**
 * Brouillons purs et ordonnés des points de contrôle (exportés pour les tests).
 * Retourne [] si aucune date de départ réelle n'est exploitable.
 */
export function buildSafetyCheckpointDrafts(
  input: GenerateSafetyCheckpointsInput
): SafetyCheckpointDraft[] {
  const start = parseCivilDate(input.startDate ?? '');
  if (!start) return [];

  const requestedDays = Math.max(1, Math.trunc(input.durationDays || 1));
  const endParsed = parseCivilDate(input.endDate ?? '');
  const tripDays = Math.min(
    MAX_SAFETY_CHECKPOINT_DAYS,
    endParsed ? getCivilDurationDays(input.startDate as string, input.endDate as string) : requestedDays
  );

  const controls = buildPreTripSafetyControls({
    activity: input.activity,
    countryCode: input.countryCode,
    durationDays: tripDays,
    partySize: Math.max(1, Math.trunc(input.partySize || 1)),
    route: input.difficulty ? { difficulty: input.difficulty } : null,
  });

  const drafts: SafetyCheckpointDraft[] = [];
  const preDepartureDate = addCivilDays(input.startDate as string, -1);
  const lastDayDate = addCivilDays(input.startDate as string, tripDays - 1);

  // J-1 18:00 — contrôles de la veille (tous sauf départ/quotidien).
  for (const control of controls) {
    if (control.code === 'safety-checkin' || control.code === 'safety-plan-shared') continue;
    drafts.push({
      label: control.label,
      scheduledAt: atCivilTime(preDepartureDate, 18),
      notes: control.reason,
    });
  }

  // J1 08:00 — départ : itinéraire déclaré (règle LKDV).
  const planShared = controls.find((control) => control.code === 'safety-plan-shared');
  if (planShared) {
    drafts.push({
      label: planShared.label,
      scheduledAt: atCivilTime(input.startDate as string, 8),
      notes: planShared.reason,
    });
  }

  // Quotidien 20:00 — point de contact (jours 1 à N-1 ; le dernier jour a son
  // propre point de clôture).
  const checkin = controls.find((control) => control.code === 'safety-checkin');
  if (checkin) {
    for (let day = 1; day < tripDays; day += 1) {
      drafts.push({
        label: `Point de contact quotidien — Jour ${day}`,
        scheduledAt: atCivilTime(addCivilDays(input.startDate as string, day - 1), 20),
        notes: checkin.reason,
      });
    }
  }

  // Dernier jour 18:00 — fin de sortie.
  drafts.push({
    label: `Fin de sortie — confirmer le retour (Jour ${tripDays})`,
    scheduledAt: atCivilTime(lastDayDate, 18),
    notes: 'Point de clôture : retour confirmé auprès du contact, alerte levée si nécessaire.',
  });

  return drafts
    .filter((draft) => draft.scheduledAt !== '')
    .sort(
      (left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt) || left.label.localeCompare(right.label)
    );
}

/** Insère les points de contrôle réels (service-role, statut `pending`). */
export async function generateSafetyCheckpoints(
  tripId: string,
  input: GenerateSafetyCheckpointsInput
): Promise<GenerateSafetyCheckpointsResult> {
  if (!UUID_RE.test(tripId)) {
    return {
      created: 0,
      warnings: ['Identifiant de voyage invalide — aucun point de contrôle créé.'],
    };
  }

  if (!parseCivilDate(input.startDate ?? '')) {
    return {
      created: 0,
      warnings: ['Dates réelles absentes — aucun point de contrôle créé (jamais de date inventée).'],
    };
  }

  const drafts = buildSafetyCheckpointDrafts(input);
  if (drafts.length === 0) {
    return { created: 0, warnings: ['Aucun point de contrôle calculable pour ces dates.'] };
  }

  const db = getServiceSupabase();
  if (!db) {
    return {
      created: 0,
      warnings: ['Service indisponible — aucun point de contrôle créé.'],
    };
  }

  try {
    const { error } = await db.from('trip_safety_checkpoints').insert(
      drafts.map((draft) => ({
        trip_id: tripId,
        label: clampLabel(draft.label),
        scheduled_at: draft.scheduledAt,
        status: 'pending',
        notes: draft.notes,
      }))
    );
    if (error) {
      console.error('[LKDV safety-checkpoints] insertion en échec:', error.message);
      return { created: 0, warnings: ['Points de contrôle non créés (erreur d’écriture).'] };
    }
    return { created: drafts.length, warnings: [] };
  } catch (error) {
    console.error('[LKDV safety-checkpoints] erreur inattendue:', error);
    return { created: 0, warnings: ['Points de contrôle non créés (erreur inattendue).'] };
  }
}
