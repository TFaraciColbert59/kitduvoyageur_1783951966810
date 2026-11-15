import type { HighlightFailure, Outcome } from '../types';

export function ok<T>(value: T): Outcome<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: HighlightFailure['code'], message: string): Outcome<T> {
  return { ok: false, error: { code, message } };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Nettoie un texte utilisateur : pas de balise, pas de caractère de contrôle. */
export function plainText(value: string, maxLength: number): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}
