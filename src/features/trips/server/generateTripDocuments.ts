import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { generateTripGpx } from '../engine/exportEngine';
import type { TripFull } from '../types/trip.types';

/**
 * Task 11 — Documents réels d'un voyage (feuille de route PDF + tracé GPX).
 *
 * Réutilise les générateurs existants : le GPX passe par `generateTripGpx`
 * (même logique que `/api/voyages/[slug]/gpx`) et la feuille de route par un
 * builder PDF minimal déterministe (aucune dépendance ajoutée). Les deux
 * fichiers sont uploadés dans le bucket privé existant `user-documents`, puis
 * inscrits dans `trip_documents` avec une URL signée et des métadonnées réelles.
 *
 * La liste « documents attendus » (identité/assurance/visas) reste dans
 * `trip_checklist_items` (règle projet : `trip_documents.file_url` NOT NULL —
 * aucun document attendu n'est inventé avec un faux fichier). Le compteur
 * `expected` est lu depuis cette checklist existante.
 */

export interface GenerateTripDocumentsResult {
  files: number;
  expected: number;
  warnings: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TRIP_DOCUMENTS_BUCKET = 'user-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

interface TripRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface NormalizedStep {
  day_number: number;
  order_index: number;
  title: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  accommodation_name: string | null;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeSteps(data: unknown): NormalizedStep[] {
  if (!Array.isArray(data)) return [];
  const rows: NormalizedStep[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const day = toFiniteNumberOrNull(raw.day_number);
    const title = toStringOrNull(raw.title);
    if (day === null || title === null) continue;
    rows.push({
      day_number: Math.trunc(day),
      order_index: toFiniteNumberOrNull(raw.order_index) ?? 0,
      title,
      description: toStringOrNull(raw.description),
      latitude: toFiniteNumberOrNull(raw.latitude),
      longitude: toFiniteNumberOrNull(raw.longitude),
      distance_km: toFiniteNumberOrNull(raw.distance_km),
      elevation_gain_m: toFiniteNumberOrNull(raw.elevation_gain_m),
      accommodation_name: toStringOrNull(raw.accommodation_name),
    });
  }
  return rows;
}

function normalizePois(data: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const raw of data as Record<string, unknown>[]) {
    const name = toStringOrNull(raw.name);
    if (name === null) continue;
    rows.push({
      name,
      category: toStringOrNull(raw.category),
      latitude: toFiniteNumberOrNull(raw.latitude),
      longitude: toFiniteNumberOrNull(raw.longitude),
      notes: toStringOrNull(raw.notes),
    });
  }
  return rows;
}

// ───────────────────────── Feuille de route PDF (pur) ─────────────────────────

export interface RoadbookPdfStep {
  dayNumber: number;
  title: string;
  distanceKm?: number | null;
  elevationGainM?: number | null;
}

export interface RoadbookPdfInput {
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  steps: RoadbookPdfStep[];
}

interface PdfTextLine {
  text: string;
  size: number;
  gap: number;
}

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_X = 48;
const PDF_START_Y = 792;
const PDF_MIN_Y = 56;

/** Caractères typographiques hors WinAnsi → équivalents ASCII visuels. */
const PDF_REPLACEMENTS: Record<string, string> = {
  '\u2019': "'",
  '\u2018': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u20ac': 'EUR',
  '\u0153': 'oe',
  '\u0152': 'OE',
  '\u00a0': ' ',
};

/** Sanitize WinAnsi + échappement des chaînes littérales PDF. */
export function escapePdfText(value: string): string {
  let sanitized = '';
  for (const char of value) {
    const source = PDF_REPLACEMENTS[char] ?? char;
    for (const piece of source) {
      const code = piece.charCodeAt(0);
      if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
        sanitized += piece;
      } else if (code === 9) {
        sanitized += ' ';
      }
    }
  }
  return sanitized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Encodage Latin-1/WinAnsi : 1 caractère = 1 octet (jamais UTF-8 ici). */
function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    out[index] = text.charCodeAt(index) & 0xff;
  }
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function paginatePdfLines(lines: PdfTextLine[]): PdfTextLine[][] {
  const pages: PdfTextLine[][] = [];
  let current: PdfTextLine[] = [];
  let y = PDF_START_Y;
  for (const line of lines) {
    const height = line.size + line.gap;
    if (current.length > 0 && y - height < PDF_MIN_Y) {
      pages.push(current);
      current = [];
      y = PDF_START_Y;
    }
    current.push(line);
    y -= height;
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[{ text: '', size: 11, gap: 0 }]];
}

/**
 * PDF minimal 1.4 valide (Helvetica, WinAnsi) : titre « Feuille de route —
 * <trajet> », période réelle et tableau Jour/étape (distance, D+ quand connus).
 * Déterministe pour des entrées identiques (aucun horodatage généré).
 */
export function buildRoadbookPdf(input: RoadbookPdfInput): Uint8Array {
  const lines: PdfTextLine[] = [
    { text: `Feuille de route — ${input.title}`, size: 16, gap: 8 },
  ];
  const period = [input.startDate, input.endDate]
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .join(' → ');
  if (period !== '') lines.push({ text: `Période : ${period}`, size: 11, gap: 4 });
  lines.push({ text: '', size: 11, gap: 2 });

  if (input.steps.length === 0) {
    lines.push({ text: 'Aucune étape enregistrée pour ce trajet.', size: 11, gap: 6 });
  } else {
    for (const step of input.steps) {
      lines.push({ text: `Jour ${step.dayNumber} — ${step.title}`, size: 12, gap: 3 });
      const details: string[] = [];
      const distance = toFiniteNumberOrNull(step.distanceKm);
      if (distance !== null) {
        details.push(`Distance estimée : ${String(distance).replace('.', ',')} km`);
      }
      const gain = toFiniteNumberOrNull(step.elevationGainM);
      if (gain !== null) details.push(`D+ estimé : ${Math.round(gain)} m`);
      lines.push({
        text:
          details.length > 0
            ? `    ${details.join(' · ')}`
            : '    Distance et dénivelé non renseignés.',
        size: 10,
        gap: 6,
      });
    }
  }

  const pages = paginatePdfLines(lines);
  const maxObject = 3 + pages.length * 2;
  const objects: Uint8Array[] = [];
  const setObject = (number: number, body: string) => {
    objects[number] = latin1Bytes(`${number} 0 obj\n${body}\nendobj\n`);
  };

  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  setObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  setObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  setObject(
    3,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );

  pages.forEach((pageLines, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    setObject(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`
    );
    const commands: string[] = ['BT'];
    let y = PDF_START_Y;
    for (const line of pageLines) {
      if (line.text !== '') {
        commands.push(`/F1 ${line.size} Tf`);
        commands.push(`1 0 0 1 ${PDF_MARGIN_X} ${y} Tm`);
        commands.push(`(${escapePdfText(line.text)}) Tj`);
      }
      y -= line.size + line.gap;
    }
    commands.push('ET');
    const stream = commands.join('\n');
    setObject(contentObject, `<< /Length ${latin1Bytes(stream).byteLength} >>\nstream\n${stream}\nendstream`);
  });

  const header = latin1Bytes('%PDF-1.4\n');
  const parts: Uint8Array[] = [header];
  const offsets: number[] = new Array(maxObject + 1).fill(0);
  let position = header.byteLength;
  for (let number = 1; number <= maxObject; number += 1) {
    offsets[number] = position;
    const bytes = objects[number] ?? latin1Bytes('');
    parts.push(bytes);
    position += bytes.byteLength;
  }

  const xref: string[] = ['xref', `0 ${maxObject + 1}`, '0000000000 65535 f '];
  for (let number = 1; number <= maxObject; number += 1) {
    xref.push(`${String(offsets[number]).padStart(10, '0')} 00000 n `);
  }
  xref.push('trailer', `<< /Size ${maxObject + 1} /Root 1 0 R >>`, 'startxref', String(position), '%%EOF', '');
  parts.push(latin1Bytes(xref.join('\n')));

  return concatBytes(parts);
}

// ───────────────────────────── Génération serveur ─────────────────────────────

interface GeneratedArtifact {
  title: string;
  category: 'booking' | 'other';
  path: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * Génère et persiste les documents réels d'un voyage (propriétaire uniquement).
 * Best-effort : tout échec (stockage, signature, écriture) devient un
 * avertissement — jamais de levée, jamais de ligne inventée sans fichier réel.
 */
export async function generateTripDocuments(
  tripId: string,
  userId: string
): Promise<GenerateTripDocumentsResult> {
  const warnings: string[] = [];

  if (!UUID_RE.test(tripId) || !UUID_RE.test(userId)) {
    return { files: 0, expected: 0, warnings: ['Identifiants invalides — aucun document généré.'] };
  }

  const db = getServiceSupabase();
  if (!db) {
    return {
      files: 0,
      expected: 0,
      warnings: ['Service de stockage indisponible — aucun document généré.'],
    };
  }

  try {
    const { data: tripData, error: tripError } = await db
      .from('trips')
      .select('id, title, description, start_date, end_date')
      .eq('id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    if (tripError || !tripData) {
      return {
        files: 0,
        expected: 0,
        warnings: ['Voyage introuvable pour ce propriétaire — aucun document généré.'],
      };
    }
    const trip = tripData as TripRow;

    const [stepsResult, checklistResult, poisResult] = await Promise.all([
      db
        .from('trip_steps')
        .select(
          'day_number, order_index, title, description, latitude, longitude, distance_km, elevation_gain_m, accommodation_name'
        )
        .eq('trip_id', tripId)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true }),
      db
        .from('trip_checklist_items')
        .select('label')
        .eq('trip_id', tripId)
        .like('label', 'Document attendu%'),
      db
        .from('trip_pois')
        .select('name, category, latitude, longitude, notes')
        .eq('trip_id', tripId),
    ]);

    if (stepsResult.error) warnings.push('Étapes illisibles — feuille de route sans tableau.');
    if (checklistResult.error) {
      warnings.push('Liste des documents attendus illisible — comptage indisponible.');
    }
    if (poisResult.error) warnings.push('Points d’intérêt illisibles — GPX sans waypoints.');

    const steps = normalizeSteps(stepsResult.data);
    const pois = normalizePois(poisResult.data);
    const expected = Array.isArray(checklistResult.data) ? checklistResult.data.length : 0;

    const gpx = generateTripGpx({
      title: trip.title,
      description: trip.description,
      steps,
      pois,
    } as unknown as TripFull);
    const pdf = buildRoadbookPdf({
      title: trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      steps: steps.map((step) => ({
        dayNumber: step.day_number,
        title: step.title,
        distanceKm: step.distance_km,
        elevationGainM: step.elevation_gain_m,
      })),
    });

    const storageProbe = db as SupabaseClient & { storage?: { from?: unknown } };
    if (typeof storageProbe.storage?.from !== 'function') {
      return {
        files: 0,
        expected,
        warnings: [...warnings, 'Stockage indisponible — aucun document enregistré.'],
      };
    }

    const artifacts: GeneratedArtifact[] = [
      {
        title: `Feuille de route — ${trip.title}`,
        category: 'booking',
        path: `${userId}/trips/${tripId}/feuille-de-route.pdf`,
        fileName: 'feuille-de-route.pdf',
        mimeType: 'application/pdf',
        bytes: pdf,
      },
      {
        title: `Tracé GPX — ${trip.title}`,
        category: 'other',
        path: `${userId}/trips/${tripId}/itineraire.gpx`,
        fileName: 'itineraire.gpx',
        mimeType: 'application/gpx+xml',
        bytes: new TextEncoder().encode(gpx),
      },
    ];

    const rows: Array<Record<string, unknown>> = [];
    for (const artifact of artifacts) {
      const upload = await db.storage.from(TRIP_DOCUMENTS_BUCKET).upload(artifact.path, artifact.bytes, {
        contentType: artifact.mimeType,
        upsert: true,
      });
      if (upload.error) {
        warnings.push(`${artifact.title} non généré (échec du stockage).`);
        continue;
      }

      let fileUrl = artifact.path;
      const signed = await db.storage
        .from(TRIP_DOCUMENTS_BUCKET)
        .createSignedUrl(artifact.path, SIGNED_URL_TTL_SECONDS);
      if (signed.error || !signed.data?.signedUrl) {
        warnings.push(`Lien de téléchargement non signé pour ${artifact.title}.`);
      } else {
        fileUrl = signed.data.signedUrl;
      }

      rows.push({
        trip_id: tripId,
        user_id: userId,
        title: artifact.title,
        category: artifact.category,
        file_url: fileUrl,
        file_name: artifact.fileName,
        file_size_bytes: artifact.bytes.byteLength,
        mime_type: artifact.mimeType,
        notes: 'Document généré automatiquement à la préparation de l’activité.',
      });
    }

    if (rows.length === 0) return { files: 0, expected, warnings };

    const { error: insertError } = await db.from('trip_documents').insert(rows);
    if (insertError) {
      warnings.push('Documents générés mais non enregistrés (erreur d’écriture).');
      return { files: 0, expected, warnings };
    }

    return { files: rows.length, expected, warnings };
  } catch (error) {
    console.error('[LKDV trip-documents] génération en échec:', error);
    return {
      files: 0,
      expected: 0,
      warnings: [...warnings, 'Génération des documents en échec.'],
    };
  }
}
