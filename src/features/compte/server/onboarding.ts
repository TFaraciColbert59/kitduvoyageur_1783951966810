import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Parcours de démarrage — lecture des faits réels du compte.
 *
 * Rien n'est inventé : chaque étape est validée par une ligne réellement
 * présente en base. Le parcours est une aide, jamais un pré-requis.
 */

export type OnboardingStepId = 'profile' | 'outing' | 'kit' | 'cordee' | 'share';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  hint: string;
  done: boolean;
}

export interface OnboardingCounts {
  outings: number;
  kits: number;
  following: number;
  cordee: number;
  carnets: number;
  profileViews: number;
}

export interface OnboardingPayload {
  isNew: boolean;
  createdAt: string | null;
  counts: OnboardingCounts;
  profileCompletion: number;
  steps: OnboardingStep[];
}

const NEW_ACCOUNT_DAYS = 7;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

interface CountQuery {
  eq(column: string, value: unknown): CountQuery;
}

async function count(
  supabase: SupabaseClient,
  table: string,
  apply: (query: CountQuery) => CountQuery
): Promise<number> {
  try {
    const base = supabase
      .from(table)
      .select('id', { count: 'exact', head: true }) as unknown as CountQuery;
    const result = (await apply(base)) as unknown as {
      count?: number | null;
      error?: unknown;
    };
    if (result?.error) return 0;
    return typeof result?.count === 'number' ? result.count : 0;
  } catch {
    return 0;
  }
}

export async function loadOnboarding(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingPayload> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('created_at, full_name, handle, bio, location, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  const [
    outings,
    kits,
    following,
    cordee,
    carnets,
    profileViews,
  ] = await Promise.all([
    count(supabase, 'hike_sessions', (q) => q.eq('user_id', userId)),
    count(supabase, 'materiel_kits', (q) => q.eq('user_id', userId).eq('is_trashed', false)),
    count(supabase, 'user_follows', (q) => q.eq('follower_id', userId)),
    count(supabase, 'story_close_friends', (q) => q.eq('owner_id', userId)),
    count(supabase, 'carnets', (q) => q.eq('author_id', userId)),
    count(supabase, 'profile_views', (q) => q.eq('profile_id', userId)),
  ]);

  const row = (profile ?? {}) as Record<string, unknown>;
  const createdAt = text(row.created_at) || null;
  const ageDays = createdAt
    ? (Date.now() - new Date(createdAt).getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY;

  const filled = [row.full_name, row.handle, row.bio, row.location, row.avatar_url].filter(
    (value) => text(value).length > 0
  ).length;
  const profileCompletion = Math.round((filled / 5) * 100);
  const profileDone = filled >= 4;

  const counts: OnboardingCounts = {
    outings,
    kits,
    following,
    cordee,
    carnets,
    profileViews,
  };

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      title: 'Complète ton profil',
      hint: 'Une photo, un massif et deux lignes suffisent pour inspirer confiance.',
      done: profileDone,
    },
    {
      id: 'outing',
      title: 'Enregistre ta première sortie',
      hint: 'Ta trace devient une preuve terrain, pas un simple chiffre.',
      done: outings > 0,
    },
    {
      id: 'kit',
      title: 'Compose ton premier kit',
      hint: 'Le poids réel de ton sac, objet par objet, avec sa lignée.',
      done: kits > 0,
    },
    {
      id: 'cordee',
      title: 'Rejoins ta cordée',
      hint: 'Suis quelques voyageurs et montre tes sorties à ceux qui comptent.',
      done: following > 0 || cordee > 0,
    },
    {
      id: 'share',
      title: 'Partage ton profil',
      hint: 'Un lien, un QR : ta cordée arrive directement sur ton profil.',
      done: profileViews > 0,
    },
  ];

  const isNew =
    ageDays <= NEW_ACCOUNT_DAYS &&
    outings === 0 &&
    kits === 0 &&
    following === 0 &&
    carnets === 0;

  return { isNew, createdAt, counts, profileCompletion, steps };
}
