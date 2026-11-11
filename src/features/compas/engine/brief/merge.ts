/**
 * Compas v6 — fusion des sources d'un Brief en un seul (ADR-V6-001 §3.2).
 *
 * Module PUR : aucune entrée n'est modifiée, même entrée → même sortie.
 *
 * Ordre : verrouillée > dit > profil > historique > déduit > défaut.
 * Règles et IA sont arbitrées entre elles à niveau égal (dit/dit, déduit/déduit),
 * jamais au-dessus d'un niveau supérieur.
 */
import {
  briefPaths,
  dropInvalid,
  emptyBrief,
  emptyValue,
  getValue,
  PRIVATE_SOURCES,
  withValue,
  type Brief,
  type BriefIssue,
  type BriefPath,
  type BriefSource,
  type BriefValue,
} from './schema';

export interface BriefDisagreement {
  path: BriefPath;
  rules: unknown;
  ai: unknown;
  kept: 'rules' | 'ai';
}

export interface MergeInput {
  phrase: string;
  /** Brief déjà rangé pour ce voyage (valeurs verrouillées à préserver), ou null. */
  stored: Brief | null;
  /** Ce que les règles ont lu de la phrase (source 'dit' ou 'deduit'), ou null. */
  rules: Brief | null;
  /** Ce que l'extraction IA a lu (source 'dit' ou 'deduit'), ou null si IA éteinte, muette ou non autorisée. */
  ai: Brief | null;
  /** Surcouche privée : valeurs de source 'profil'. */
  profile: Brief | null;
  /** Surcouche privée : valeurs de source 'historique'. */
  history: Brief | null;
  /** Défauts (source 'defaut'). */
  defaults: Brief | null;
}

/** Valeur écartée faute de preuve, avec le lecteur qui l'avait produite. */
export type BriefDroppedIssue = BriefIssue & { origin: 'rules' | 'ai' };

export interface MergeResult {
  brief: Brief;
  disagreements: BriefDisagreement[];
  dropped: BriefDroppedIssue[];
}

type AnyValue = BriefValue<unknown>;

export const CONFIDENCE_AGREE = 0.95;
export const CONFIDENCE_DISAGREE = 0.6;
export const CONFIDENCE_AI_ALONE_MAX = 0.85;

const DATE_PATHS: readonly BriefPath[] = ['quand.dateDebut', 'quand.dateFin'];

function normText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

/** Égalité profonde ; les textes sont comparés sans casse, sans accents, sans espaces de bord. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return normText(a) === normText(b);
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every((k) => k in (b as object) && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return a === b;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function out(
  v: AnyValue,
  source: BriefSource,
  confidence: number,
  evidence: string | null,
  prive: boolean
): AnyValue {
  return {
    value: structuredClone(v.value),
    source,
    confidence: clamp01(confidence),
    evidence: source === 'dit' ? evidence : null,
    locked: false,
    prive,
  };
}

/**
 * Valeur participante au niveau de source demandé. Pour règles et IA, `dropInvalid` a déjà écarté
 * verrous et sources interdites ; ici on ne fait que choisir le niveau (et défendre les surcouches).
 */
function usable(v: AnyValue | null, source: BriefSource): AnyValue | null {
  return v && v.value != null && v.source === source ? v : null;
}

export function mergeBrief(input: MergeInput): MergeResult {
  const { phrase } = input;
  const dropped: BriefDroppedIssue[] = [];

  let rules: Brief | null = null;
  if (input.rules) {
    const r = dropInvalid(input.rules, phrase, 'regles');
    rules = r.brief;
    for (const d of r.dropped) dropped.push({ ...d, origin: 'rules' });
  }
  let ai: Brief | null = null;
  if (input.ai) {
    const r = dropInvalid(input.ai, phrase, 'ia');
    ai = r.brief;
    for (const d of r.dropped) dropped.push({ ...d, origin: 'ai' });
  }

  const disagreements: BriefDisagreement[] = [];
  let brief = emptyBrief();

  /** Arbitrage règles / IA à un niveau de source donné. */
  const arbitrate = (path: BriefPath, source: 'dit' | 'deduit'): AnyValue | null => {
    const r = rules ? usable(getValue(rules, path), source) : null;
    const a = ai ? usable(getValue(ai, path), source) : null;
    if (r && a) {
      if (sameValue(r.value, a.value)) return out(r, source, CONFIDENCE_AGREE, r.evidence, r.prive || a.prive);
      const rulesWin =
        DATE_PATHS.includes(path) || typeof r.value === 'number' || typeof a.value === 'number';
      disagreements.push({
        path,
        rules: structuredClone(r.value),
        ai: structuredClone(a.value),
        kept: rulesWin ? 'rules' : 'ai',
      });
      const w = rulesWin ? r : a;
      return out(w, source, CONFIDENCE_DISAGREE, w.evidence, r.prive || a.prive);
    }
    if (r) return out(r, source, r.confidence, r.evidence, r.prive);
    if (a) return out(a, source, Math.min(a.confidence, CONFIDENCE_AI_ALONE_MAX), a.evidence, a.prive);
    return null;
  };

  for (const path of briefPaths()) {
    const locked = input.stored ? getValue(input.stored, path) : null;
    // Une valeur verrouillée privée ne peut pas exister légitimement (lockValue la rend publique).
    if (
      locked &&
      locked.locked &&
      locked.value != null &&
      !locked.prive &&
      !PRIVATE_SOURCES.includes(locked.source)
    ) {
      brief = withValue(brief, path, structuredClone(locked));
      continue;
    }

    let chosen: AnyValue | null = arbitrate(path, 'dit');
    if (!chosen) {
      const p = input.profile ? usable(getValue(input.profile, path), 'profil') : null;
      if (p) chosen = out(p, 'profil', p.confidence, null, true);
    }
    if (!chosen) {
      const h = input.history ? usable(getValue(input.history, path), 'historique') : null;
      if (h) chosen = out(h, 'historique', h.confidence, null, true);
    }
    if (!chosen) chosen = arbitrate(path, 'deduit');
    if (!chosen) {
      const d = input.defaults ? usable(getValue(input.defaults, path), 'defaut') : null;
      if (d) chosen = out(d, 'defaut', d.confidence, null, d.prive);
    }
    brief = withValue(brief, path, chosen ?? emptyValue());
  }

  return { brief, disagreements, dropped };
}
