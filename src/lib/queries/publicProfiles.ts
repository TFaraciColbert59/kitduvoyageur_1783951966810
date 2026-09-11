import { createClient } from '@/lib/supabase/server';
import {
  fetchPublicProfilesWith,
  limitPublicProfileIds,
  type PublicProfile,
} from './publicProfilesCore';

export type { PublicProfile } from './publicProfilesCore';
export {
  PUBLIC_PROFILES_VIEW,
  PUBLIC_PROFILES_SELECT,
  PUBLIC_PROFILES_MAX_IDS,
  indexPublicProfiles,
  limitPublicProfileIds,
} from './publicProfilesCore';

export async function fetchPublicProfiles(ids: string[]): Promise<Record<string, PublicProfile>> {
  if (limitPublicProfileIds(ids).length === 0) return {};
  try {
    const supabase = await createClient();
    return await fetchPublicProfilesWith(supabase, ids);
  } catch {
    return {};
  }
}
