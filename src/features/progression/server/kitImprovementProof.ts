import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T23 — Amélioration de kit éprouvée.
 *
 * Preuve exigée (économie P3) : un DIFF pertinent entre versions persistées
 * après un retour terrain — un problème réellement signalé (défaillant ou
 * manquant) puis résolu dans une version postérieure, les éléments VITAUX
 * conservés. Exclus : achat/prix/poids seul, version inverse, auto-fork,
 * même problème déjà payé (claim par version).
 *
 * L'émission (`kit_improved`) reste fermée en v1 : le moteur refuse
 * `action_non_autorisee` jusqu'au registre v2 — la preuve et son contrôle
 * sont néanmoins livrés ici.
 */

export type KitImprovementRefusal =
  | 'kit_introuvable'
  | 'aucun_probleme_terrain'
  | 'version_anterieure'
  | 'versions_illisibles'
  | 'essentiel_retire'
  | 'aucune_amelioration'
  | 'auto_fork';

export interface KitImprovementProof {
  ok: true;
  resolvedKeys: string[];
  newVersionId: string;
}

export type KitImprovementResult = KitImprovementProof | { ok: false; reason: KitImprovementRefusal };

export interface KitHistoryRow {
  id: string;
  created_at: string | null;
  payload: unknown;
}

interface ParsedItem {
  key: string;
  vital: boolean;
}

/** Lecture tolérante de l'inventaire persisté (payload de version). */
export function extractVersionItems(payload: unknown): ParsedItem[] | null {
  if (payload === null || payload === undefined) return null;
  let rows: unknown[] | null = null;
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) rows = record.items;
  }
  if (!rows) return null;
  const items: ParsedItem[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const key = item.item_key ?? item.key ?? item.name;
    if (typeof key !== 'string' || key.trim().length === 0) continue;
    const vital = item.is_vital === true || item.vital === true;
    items.push({ key: key.trim(), vital });
  }
  return items.length > 0 ? items : null;
}

/**
 * Contrôle pur (testable sans base) : le détail des refus est stable.
 */
export function evaluateKitImprovement(input: {
  history: KitHistoryRow[];
  problemKeys: readonly string[];
  autoFork: boolean;
}): KitImprovementResult {
  if (input.autoFork) return { ok: false, reason: 'auto_fork' };
  if (input.problemKeys.length === 0) return { ok: false, reason: 'aucun_probleme_terrain' };

  const ordered = [...input.history]
    .filter((row) => typeof row.created_at === 'string' && row.created_at.length > 0)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (ordered.length < 2) return { ok: false, reason: 'version_anterieure' };

  const previous = extractVersionItems(ordered[ordered.length - 2].payload);
  const next = extractVersionItems(ordered[ordered.length - 1].payload);
  if (!previous || !next) return { ok: false, reason: 'versions_illisibles' };

  const nextKeys = new Set(next.map((item) => item.key));
  const previousVitals = previous.filter((item) => item.vital).map((item) => item.key);
  const removedVital = previousVitals.some((key) => !nextKeys.has(key));
  if (removedVital) return { ok: false, reason: 'essentiel_retire' };

  const previousKeys = new Set(previous.map((item) => item.key));
  const resolvedKeys = input.problemKeys.filter(
    (key) => previousKeys.has(key) && !nextKeys.has(key)
  );
  if (resolvedKeys.length === 0) return { ok: false, reason: 'aucune_amelioration' };

  return {
    ok: true,
    resolvedKeys,
    newVersionId: ordered[ordered.length - 1].id,
  };
}

function createKitClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour la preuve kit.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface KitImprovementContext {
  userId: string;
  autoFork: boolean;
}

export async function loadKitImprovementProof(
  kitId: string
): Promise<({ ok: true } & KitImprovementContext & KitImprovementProof) | { ok: false; reason: KitImprovementRefusal }> {
  const supabase = createKitClient();

  const { data: kit, error: kitError } = await supabase
    .from('materiel_kits')
    .select('user_id, origin, forked_from')
    .eq('id', kitId)
    .maybeSingle();
  if (kitError || !kit) return { ok: false, reason: 'kit_introuvable' };

  const { data: reports, error: reportsError } = await supabase
    .from('kit_field_reports')
    .select('item_key, verdict')
    .eq('kit_id', kitId);
  if (reportsError) return { ok: false, reason: 'versions_illisibles' };
  const problemKeys = ((reports ?? []) as Array<{ item_key: string | null; verdict: string | null }>)
    .filter((row) => row.verdict === 'defaillant' || row.verdict === 'manquait')
    .map((row) => row.item_key ?? '')
    .filter((key) => key.length > 0);

  const { data: history, error: historyError } = await supabase
    .from('materiel_kit_history')
    .select('id, created_at, payload')
    .eq('kit_id', kitId)
    .order('created_at', { ascending: true });
  if (historyError) return { ok: false, reason: 'versions_illisibles' };

  const autoFork = kit.origin === 'manuel' && kit.forked_from === null;
  const evaluated = evaluateKitImprovement({
    history: (history ?? []) as KitHistoryRow[],
    problemKeys,
    autoFork,
  });
  if (!evaluated.ok) return { ok: false, reason: evaluated.reason };
  return { userId: kit.user_id, autoFork, ...evaluated };
}
