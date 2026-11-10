import type { FieldErrors } from 'react-hook-form';
import { CREATE_FIELD_LABELS_V2 } from './createSchemasV2';
import type { CreateKindV2 } from './createSchemasV2';
import { stepIndexOfField } from './steps';

/**
 * Erreurs du moteur V2 — règle de la maison : **une erreur = un seul message**,
 * sous son champ (`aria-describedby`). Le compteur de tête ne répète jamais les
 * messages : il dit « 2 champs à corriger » et amène le focus.
 */

export interface FieldErrorEntry {
  /** Chemin RHF du champ (ex. `days.0.moments.1.text`). */
  path: string;
  /** Champ racine pour le focus DOM (`days`). */
  root: string;
  message: string;
}

/** Liste ordonnée des champs en erreur, dans l'ordre de déclaration des erreurs. */
export function collectFieldErrors(errors: FieldErrors, prefix = ''): FieldErrorEntry[] {
  const entries: FieldErrorEntry[] = [];
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      const root = path.split('.')[0] ?? path;
      entries.push({ path, root, message: record.message });
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'ref' || key === 'type' || key === 'types') continue;
      visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(errors, prefix);
  return entries;
}

/** Nombre de champs fautifs (racines distinctes, une erreur par champ affiché). */
export function countFieldErrors(errors: FieldErrors): number {
  const roots = new Set(collectFieldErrors(errors).map((entry) => entry.root));
  return roots.size;
}

/** Première erreur (parcours stable) : sert au focus et au compteur. */
export function firstFieldError(errors: FieldErrors): FieldErrorEntry | null {
  return collectFieldErrors(errors)[0] ?? null;
}

/** Libellé lisible d'un champ (pour le compteur, jamais pour répéter le message). */
export function fieldLabel(field: string): string {
  const root = field.split('.')[0] ?? field;
  return CREATE_FIELD_LABELS_V2[root] ?? root;
}

/** Phrase du compteur de tête : « 2 champs à corriger », « 1 champ à corriger ». */
export function errorCounterLabel(count: number): string {
  return count > 1 ? `${count} champs à corriger` : '1 champ à corriger';
}

const FIELD_SELECTORS = [
  (root: string) => `#cv2c-${root}`,
  (root: string) => `[name="${root}"]`,
  (root: string) => `[data-cv2c-field="${root}"]`,
];

/**
 * Focalise le champ fautif. Le champ peut être rendu dans une autre étape ou
 * un autre panneau : l'appelant change d'étape puis attend un rendu.
 */
export function focusFieldByName(root: string): boolean {
  if (typeof document === 'undefined') return false;
  for (const selector of FIELD_SELECTORS) {
    const element = document.querySelector<HTMLElement>(selector(root));
    if (!element) continue;
    element.focus?.({ preventScroll: false });
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return true;
  }
  return false;
}

export interface ServerErrorInfo {
  message: string;
  code: string | null;
  /** Champ à surligner, s'il est connu côté serveur. */
  field: string | null;
}

const SERVER_MESSAGES: Record<string, string> = {
  not_authenticated: 'Connecte-toi pour publier.',
  anonymous_not_allowed: 'Crée un compte pour publier.',
  validation_failed: 'Certaines informations sont invalides.',
  slug_taken: 'Cette adresse est déjà prise.',
  club_not_member: 'Tu dois être membre du club pour y publier.',
  kit_not_accessible: 'Ce kit n’est pas accessible.',
  not_found: 'Cet élément est introuvable.',
  banned: 'Tu ne peux pas rejoindre ce club.',
  forbidden: 'Action réservée aux administrateurs du club.',
};

function parseJsonMessage(raw: string): { code?: string; message?: string; field?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      field: typeof record.field === 'string' ? record.field : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Traduit une erreur Supabase/RPC en message français affiché **une seule fois**
 * près du bouton d'envoi. Les RPC lèvent `{"code","message","field"}` (SQLSTATE
 * P0001) ; les erreurs de trigger gardent un message brut, qu'on conserve.
 */
export function parseServerError(error: unknown): ServerErrorInfo {
  const fallback: ServerErrorInfo = {
    message: 'Enregistrement impossible pour le moment. Réessaie.',
    code: null,
    field: null,
  };
  if (!error) return fallback;
  const record = typeof error === 'object' ? (error as Record<string, unknown>) : null;
  const rawMessage = typeof record?.message === 'string' ? record.message : '';
  const code = typeof record?.code === 'string' ? record.code : null;
  const parsed = rawMessage ? parseJsonMessage(rawMessage) : null;
  if (parsed) {
    const message =
      parsed.message ||
      (parsed.code ? SERVER_MESSAGES[parsed.code] ?? '' : '') ||
      fallback.message;
    return { message, code: parsed.code ?? code, field: parsed.field ?? null };
  }
  if (code === '42501') {
    return { message: SERVER_MESSAGES.not_authenticated, code, field: null };
  }
  if (code === 'PGRST301' || /row-level security|permission denied|not authorized/i.test(rawMessage)) {
    return {
      message: 'Action non autorisée. Vérifie ton compte, puis réessaie.',
      code,
      field: null,
    };
  }
  if (rawMessage && rawMessage.length <= 300) {
    return { message: rawMessage, code, field: null };
  }
  return { ...fallback, code };
}

/** Libellé humain d'une étape pour un champ donné. */
export function stepLabelForField(kind: CreateKindV2, field: string): string {
  return String(stepIndexOfField(kind, field) + 1);
}

// ---------------------------------------------------------------------------
// Validation en direct d'un seul champ (Story#17)
// ---------------------------------------------------------------------------

export type LiveFieldOutcome =
  | { kind: 'ok' }
  | { kind: 'empty'; message: string }
  | { kind: 'invalid'; message: string };

interface SafeParseLike {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> };
  };
}

function readValueAt(values: unknown, name: string): unknown {
  let node: unknown = values;
  for (const key of name.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Revalide le schéma complet mais ne retient que le message du champ `name`
 * (chemin exact ou descendant). `empty` signale une erreur sur une valeur
 * vide : l'appelant la tait tant que la personne n'a rien tenté (aucune
 * remontrance avant la saisie).
 */
export function liveFieldIssue(schema: SafeParseLike, values: unknown, name: string): LiveFieldOutcome {
  const parsed = schema.safeParse(values);
  if (parsed.success || !parsed.error) return { kind: 'ok' };
  const issue = parsed.error.issues.find((entry) => {
    const path = entry.path.map(String).join('.');
    return path === name || path.startsWith(`${name}.`);
  });
  if (!issue) return { kind: 'ok' };
  return isBlank(readValueAt(values, name))
    ? { kind: 'empty', message: issue.message }
    : { kind: 'invalid', message: issue.message };
}
