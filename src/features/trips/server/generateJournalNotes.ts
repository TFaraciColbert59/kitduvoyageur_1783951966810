import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Task 13 — Notes de carnet pré-remplies : 1 note par jour/étape, rédigée
 * UNIQUEMENT avec les données réelles de l'étape (titre, distance, D+, POI).
 * Les questions ouvertes sont des invites de documentation, jamais des faits.
 *
 * Idempotent : un jour qui porte déjà une note n'est jamais dupliqué.
 */

export interface JournalNoteStepInput {
  dayNumber: number;
  title: string;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  /** Noms réels des POI du jour (déjà filtrés par l'appelant). */
  poiNames?: string[];
}

export interface GenerateJournalNotesResult {
  created: number;
  warnings: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POI_NAMES = 5;

function toFiniteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatKm(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** Titre factuel : « Jour N — <étape> ». */
export function buildJournalNoteTitle(step: JournalNoteStepInput): string {
  const title = typeof step.title === 'string' ? step.title.trim() : '';
  return `Jour ${Math.trunc(step.dayNumber)} — ${title !== '' ? title : 'Étape'}`;
}

/** Contenu réel de l'étape + 3 questions ouvertes de documentation. */
export function buildJournalNoteContent(step: JournalNoteStepInput): string {
  const title = typeof step.title === 'string' && step.title.trim() !== '' ? step.title.trim() : 'Étape';
  const lines: string[] = [`Étape du jour : ${title}.`];

  const facts: string[] = [];
  const distance = toFiniteNumberOrNull(step.distanceKm);
  if (distance !== null) facts.push(`distance prévue ${formatKm(distance)} km`);
  const gain = toFiniteNumberOrNull(step.elevationGainM);
  if (gain !== null) facts.push(`D+ prévu ${Math.round(gain)} m`);
  if (facts.length > 0) lines.push(`Repères réels : ${facts.join(', ')}.`);

  const pois = (step.poiNames ?? [])
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name !== '')
    .slice(0, MAX_POI_NAMES);
  if (pois.length > 0) {
    lines.push(`Points d’intérêt sur le parcours : ${pois.join(', ')}.`);
  }

  lines.push('');
  lines.push('À documenter :');
  lines.push('1. Quelles conditions de terrain avez-vous rencontrées ?');
  lines.push('2. Quel moment, rencontre ou paysage mérite d’être raconté ?');
  lines.push('3. Qu’auriez-vous ajusté pour l’étape suivante ?');

  return lines.join('\n');
}

function normalizeSteps(steps: JournalNoteStepInput[]): JournalNoteStepInput[] {
  if (!Array.isArray(steps)) return [];
  const byDay = new Map<number, JournalNoteStepInput>();
  for (const step of steps) {
    const day = toFiniteNumberOrNull(step?.dayNumber);
    const title = typeof step?.title === 'string' ? step.title.trim() : '';
    if (day === null || !Number.isInteger(day) || day < 1 || title === '') continue;
    if (!byDay.has(day)) {
      byDay.set(day, {
        dayNumber: day,
        title,
        distanceKm: step.distanceKm ?? null,
        elevationGainM: step.elevationGainM ?? null,
        poiNames: Array.isArray(step.poiNames) ? step.poiNames : [],
      });
    }
  }
  return [...byDay.values()].sort((left, right) => left.dayNumber - right.dayNumber);
}

/**
 * Crée les notes pré-remplies des jours réels (service-role). Best-effort :
 * toute erreur devient un avertissement, jamais de levée ni de fait inventé.
 */
export async function generateJournalNotes(
  tripId: string,
  userId: string,
  steps: JournalNoteStepInput[]
): Promise<GenerateJournalNotesResult> {
  if (!UUID_RE.test(tripId) || !UUID_RE.test(userId)) {
    return { created: 0, warnings: ['Identifiants invalides — aucune note créée.'] };
  }

  const normalized = normalizeSteps(steps);
  if (normalized.length === 0) {
    return { created: 0, warnings: ['Aucune étape réelle — aucune note pré-remplie créée.'] };
  }

  const db = getServiceSupabase();
  if (!db) {
    return { created: 0, warnings: ['Service indisponible — aucune note créée.'] };
  }

  const warnings: string[] = [];
  try {
    const { data: existing, error: readError } = await db
      .from('trip_notes')
      .select('day_number')
      .eq('trip_id', tripId);
    if (readError) {
      console.error('[LKDV journal-notes] lecture des notes en échec:', readError.message);
      return {
        created: 0,
        warnings: ['Notes existantes illisibles — aucune note pré-remplie créée (anti-doublon).'],
      };
    }

    const existingDays = new Set(
      (Array.isArray(existing) ? existing : [])
        .map((row) => toFiniteNumberOrNull((row as Record<string, unknown>).day_number))
        .filter((day): day is number => day !== null)
    );

    const rows = normalized
      .filter((step) => !existingDays.has(step.dayNumber))
      .map((step) => ({
        trip_id: tripId,
        author_id: userId,
        title: buildJournalNoteTitle(step),
        content: buildJournalNoteContent(step),
        day_number: step.dayNumber,
        is_pinned: false,
      }));
    if (rows.length === 0) return { created: 0, warnings };

    const { error } = await db.from('trip_notes').insert(rows);
    if (error) {
      console.error('[LKDV journal-notes] insertion en échec:', error.message);
      return { created: 0, warnings: ['Notes pré-remplies non créées (erreur d’écriture).'] };
    }
    return { created: rows.length, warnings };
  } catch (error) {
    console.error('[LKDV journal-notes] erreur inattendue:', error);
    return { created: 0, warnings: ['Notes pré-remplies non créées (erreur inattendue).'] };
  }
}
