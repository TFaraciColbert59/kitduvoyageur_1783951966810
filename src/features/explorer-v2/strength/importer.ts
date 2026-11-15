import type { StrengthExercise, StrengthLoadUnit, StrengthLog, StrengthSet } from '../state/types';
import { addStrengthExercise, addStrengthSet, createStrengthLog } from './model';

export interface ParsedStrengthExercise {
  name: string;
  sets: Array<{ reps: number; load: number | null; unit: StrengthLoadUnit }>;
}

export interface StrengthImportParseResult {
  exercises: ParsedStrengthExercise[];
  unparsedLines: string[];
  format: 'json' | 'csv' | 'text';
}

/**
 * Analyse une saisie texte libre, CSV ou JSON (notes carnet, captures OCR,
 * export Strong/Hevy) et en extrait des exercices/séries sans jamais inventer
 * de valeurs absentes (`load: null` si poids du corps).
 */
export function parseStrengthImportText(rawText: string): StrengthImportParseResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { exercises: [], unparsedLines: [], format: 'text' };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const candidateExercises = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { exercises?: unknown }).exercises)
          ? (parsed as { exercises: unknown[] }).exercises
          : null;
      if (candidateExercises) {
        const exercises: ParsedStrengthExercise[] = [];
        for (const item of candidateExercises) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as Record<string, unknown>;
          if (typeof rec.name !== 'string' || !rec.name.trim()) continue;
          const rawSets = Array.isArray(rec.sets) ? rec.sets : [];
          const sets = rawSets
            .map((s) => {
              if (!s || typeof s !== 'object') return null;
              const sr = s as Record<string, unknown>;
              const reps = typeof sr.reps === 'number' && Number.isInteger(sr.reps) && sr.reps > 0 ? sr.reps : null;
              if (!reps) return null;
              const load = typeof sr.load === 'number' && Number.isFinite(sr.load) && sr.load >= 0 ? sr.load : null;
              const unit: StrengthLoadUnit = sr.unit === 'lb' ? 'lb' : 'kg';
              return { reps, load, unit };
            })
            .filter((s): s is { reps: number; load: number | null; unit: StrengthLoadUnit } => s !== null);
          if (sets.length > 0) {
            exercises.push({ name: rec.name.trim(), sets });
          }
        }
        if (exercises.length > 0) {
          return { exercises, unparsedLines: [], format: 'json' };
        }
      }
    } catch {
      /* fallback text parser */
    }
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exercisesMap = new Map<string, ParsedStrengthExercise>();
  const unparsedLines: string[] = [];
  let isCsv = false;

  const pushSets = (
    name: string,
    setsToAdd: Array<{ reps: number; load: number | null; unit: StrengthLoadUnit }>
  ) => {
    const cleanName = name.replace(/[:\-–|]+$/, '').trim();
    if (!cleanName || setsToAdd.length === 0) return;
    const existing = exercisesMap.get(cleanName) ?? { name: cleanName, sets: [] };
    existing.sets.push(...setsToAdd);
    exercisesMap.set(cleanName, existing);
  };

  for (const line of lines) {
    // Format CSV: "Squat,4,8,80,kg" ou "Squat;8;80;kg"
    if (line.includes(',') || line.includes(';')) {
      const parts = line.split(/[;,]/).map((p) => p.trim());
      if (parts.length >= 3 && !/exercise|exercice|name|nom/i.test(parts[0])) {
        isCsv = true;
        const exName = parts[0];
        if (parts.length >= 4 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
          const count = Math.min(20, Number(parts[1]));
          const reps = Number(parts[2]);
          const load = parts[3] !== '' && Number.isFinite(Number(parts[3])) ? Number(parts[3]) : null;
          const unit: StrengthLoadUnit = parts[4]?.toLowerCase() === 'lb' ? 'lb' : 'kg';
          if (reps >= 1 && count >= 1) {
            pushSets(
              exName,
              Array.from({ length: count }, () => ({ reps, load, unit }))
            );
            continue;
          }
        }
        if (/^\d+$/.test(parts[1])) {
          const reps = Number(parts[1]);
          const load = parts[2] !== '' && Number.isFinite(Number(parts[2])) ? Number(parts[2]) : null;
          const unit: StrengthLoadUnit = parts[3]?.toLowerCase() === 'lb' ? 'lb' : 'kg';
          if (reps >= 1) {
            pushSets(exName, [{ reps, load, unit }]);
            continue;
          }
        }
      } else if (/exercise|exercice|name|nom/i.test(parts[0])) {
        isCsv = true;
        continue;
      }
    }

    // Format texte: "Squat 4x8 @ 80kg" ou "Développé couché: 3 x 10 60 kg" ou "Pompes 3x15"
    const matchMulti = line.match(
      /^(.+?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*(?:@|a|à)?\s*(\d+(?:[.,]\d+)?)\s*(kg|lb)?)?$/i
    );
    if (matchMulti) {
      const exName = matchMulti[1].trim();
      const setsCount = Math.min(20, Number(matchMulti[2]));
      const reps = Number(matchMulti[3]);
      const loadRaw = matchMulti[4] ? Number(matchMulti[4].replace(',', '.')) : null;
      const unit: StrengthLoadUnit = matchMulti[5]?.toLowerCase() === 'lb' ? 'lb' : 'kg';
      if (setsCount >= 1 && reps >= 1 && (loadRaw === null || Number.isFinite(loadRaw))) {
        pushSets(
          exName,
          Array.from({ length: setsCount }, () => ({ reps, load: loadRaw, unit }))
        );
        continue;
      }
    }

    // Format simple: "Tractions 12 reps" ou "Squat 10 @ 70kg"
    const matchSingle = line.match(
      /^(.+?)\s+(\d+)\s*(?:reps?|rép\.?)(?:\s*(?:@|a|à)?\s*(\d+(?:[.,]\d+)?)\s*(kg|lb)?)?$/i
    );
    if (matchSingle) {
      const exName = matchSingle[1].trim();
      const reps = Number(matchSingle[2]);
      const loadRaw = matchSingle[3] ? Number(matchSingle[3].replace(',', '.')) : null;
      const unit: StrengthLoadUnit = matchSingle[4]?.toLowerCase() === 'lb' ? 'lb' : 'kg';
      if (reps >= 1 && (loadRaw === null || Number.isFinite(loadRaw))) {
        pushSets(exName, [{ reps, load: loadRaw, unit }]);
        continue;
      }
    }

    unparsedLines.push(line);
  }

  return {
    exercises: Array.from(exercisesMap.values()),
    unparsedLines,
    format: isCsv ? 'csv' : 'text',
  };
}

export function applyParsedStrengthImport(
  baseLog: StrengthLog | null,
  parsed: StrengthImportParseResult,
  now = Date.now()
): StrengthLog {
  let nextLog = baseLog ?? createStrengthLog(now);
  for (const item of parsed.exercises) {
    const existing = nextLog.exercises.find(
      (ex) => ex.name.toLowerCase() === item.name.toLowerCase()
    );
    let exId = existing?.id ?? null;
    if (!exId) {
      const added = addStrengthExercise(nextLog, item.name, { now });
      if (!added) continue;
      nextLog = added.log;
      exId = added.exercise.id;
    }
    for (const setItem of item.sets) {
      const setAdded = addStrengthSet(nextLog, exId, setItem, { now });
      if (setAdded) nextLog = setAdded.log;
    }
  }
  return nextLog;
}

export interface StrengthWorkoutTemplate {
  id: string;
  name: string;
  createdAt: string;
  exercises: Array<{
    name: string;
    sets: Array<{ reps: number; load: number | null; unit: StrengthLoadUnit }>;
  }>;
}

const TEMPLATES_STORAGE_KEY = 'lkdv.strength.templates.v1';

export function readStrengthTemplates(): StrengthWorkoutTemplate[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StrengthWorkoutTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveStrengthTemplateFromLog(
  name: string,
  log: StrengthLog
): StrengthWorkoutTemplate | null {
  const cleanName = name.trim();
  if (!cleanName || log.exercises.length === 0) return null;
  const template: StrengthWorkoutTemplate = {
    id: `tpl-${Date.now().toString(36)}`,
    name: cleanName,
    createdAt: new Date().toISOString(),
    exercises: log.exercises.map((ex: StrengthExercise) => ({
      name: ex.name,
      sets: ex.sets.map((s: StrengthSet) => ({
        reps: s.reps,
        load: s.load,
        unit: s.unit,
      })),
    })),
  };
  const next = [template, ...readStrengthTemplates().filter((t) => t.name !== cleanName)].slice(0, 30);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return template;
}

export function deleteStrengthTemplate(templateId: string): StrengthWorkoutTemplate[] {
  const next = readStrengthTemplates().filter((t) => t.id !== templateId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return next;
}
