import type { SupabaseClient } from '@supabase/supabase-js';

export type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  trust_score: number | null;
};

export const PUBLIC_PROFILES_VIEW = 'public_profiles';
export const PUBLIC_PROFILES_SELECT = 'id, full_name, avatar_url, trust_score';
export const PUBLIC_PROFILES_MAX_IDS = 200;

export function limitPublicProfileIds(ids: Array<string | null | undefined>): string[] {
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    wanted.push(id);
    if (wanted.length >= PUBLIC_PROFILES_MAX_IDS) break;
  }
  return wanted;
}

export function indexPublicProfiles(
  rows: PublicProfile[] | null | undefined
): Record<string, PublicProfile> {
  const byId: Record<string, PublicProfile> = {};
  for (const row of rows ?? []) {
    if (row?.id) byId[row.id] = row;
  }
  return byId;
}

export async function fetchPublicProfilesWith(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, PublicProfile>> {
  const wanted = limitPublicProfileIds(ids);
  if (wanted.length === 0) return {};
  const { data, error } = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(PUBLIC_PROFILES_SELECT)
    .in('id', wanted);
  if (error) return {};
  return indexPublicProfiles(data as unknown as PublicProfile[] | null);
}
