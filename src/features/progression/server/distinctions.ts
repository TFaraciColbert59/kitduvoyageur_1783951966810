import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T15 — Distinctions unifiées.
 *
 * Les définitions de badges sont dédupliquées par clé canonique (nom
 * normalisé, table `progression_badge_links`) ; les possessions historiques
 * (`user_badges`) sont conservées telles quelles et préférées à l'affichage.
 * Aucun crédit : un badge est une vue d'un fait déjà validé — ce module ne
 * lit et n'écrit aucun solde, aucune transaction.
 */

export interface UnifiedDistinction {
  canonicalKey: string;
  badgeId: string;
  name: string;
  icon: string | null;
  rarity: string | null;
  earned: boolean;
  earnedAt: string | null;
  conditionVersion: number;
}

function createDistinctionClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour lire les distinctions.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface LinkRow {
  badge_id: string;
  canonical_key: string;
  condition_version: number | null;
  badges:
    | { name: string | null; icon: string | null; rarity: string | null }
    | Array<{ name: string | null; icon: string | null; rarity: string | null }>
    | null;
}

function readBadge(
  value: LinkRow['badges']
): { name: string; icon: string | null; rarity: string | null } | null {
  const badge = Array.isArray(value) ? (value[0] ?? null) : value;
  if (!badge || typeof badge.name !== 'string' || badge.name.trim().length === 0) return null;
  return {
    name: badge.name.trim(),
    icon: typeof badge.icon === 'string' && badge.icon.length > 0 ? badge.icon : null,
    rarity: typeof badge.rarity === 'string' && badge.rarity.length > 0 ? badge.rarity : null,
  };
}

export async function getUnifiedDistinctions(userId: string): Promise<UnifiedDistinction[]> {
  const supabase = createDistinctionClient();

  const [ownedRes, linksRes] = await Promise.all([
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', userId),
    supabase
      .from('progression_badge_links')
      .select('badge_id, canonical_key, condition_version, badges(name, icon, rarity)'),
  ]);
  if (ownedRes.error) throw new Error(ownedRes.error.message);
  if (linksRes.error) throw new Error(linksRes.error.message);

  const owned = new Map<string, string | null>();
  for (const row of (ownedRes.data ?? []) as Array<{ badge_id: string; earned_at: string | null }>) {
    owned.set(row.badge_id, row.earned_at ?? null);
  }

  const byKey = new Map<string, UnifiedDistinction>();
  for (const row of (linksRes.data ?? []) as unknown as LinkRow[]) {
    const badge = readBadge(row.badges);
    if (!badge) continue;
    const earned = owned.has(row.badge_id);
    const entry: UnifiedDistinction = {
      canonicalKey: row.canonical_key,
      badgeId: row.badge_id,
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      earned,
      earnedAt: earned ? owned.get(row.badge_id) ?? null : null,
      conditionVersion:
        Number.isFinite(Number(row.condition_version)) && Number(row.condition_version) >= 1
          ? Math.floor(Number(row.condition_version))
          : 1,
    };
    const existing = byKey.get(row.canonical_key);
    // Une possession historique est préférée à une variante non possédée.
    if (!existing || (!existing.earned && entry.earned)) {
      byKey.set(row.canonical_key, entry);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
